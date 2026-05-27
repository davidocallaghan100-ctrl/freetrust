export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

type Preview = {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  hostname: string
}

function isBlockedHost(hostname: string) {
  const h = hostname.toLowerCase()
  return (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.startsWith('127.') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  )
}

function getMeta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeHtml(match[1].trim())
  }
  return null
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function getTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1] ? decodeHtml(match[1].replace(/\s+/g, ' ').trim()) : null
}

export async function GET(request: NextRequest) {
  try {
    const rawUrl = request.nextUrl.searchParams.get('url')
    if (!rawUrl) return NextResponse.json({ error: 'url is required' }, { status: 400 })

    let parsed: URL
    try { parsed = new URL(rawUrl) }
    catch { return NextResponse.json({ error: 'Invalid URL' }, { status: 400 }) }

    if (!['http:', 'https:'].includes(parsed.protocol) || isBlockedHost(parsed.hostname)) {
      return NextResponse.json({ error: 'Unsupported URL' }, { status: 400 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'FreeTrustBot/1.0 (+https://freetrust.co)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    const contentType = res.headers.get('content-type') ?? ''
    if (!res.ok || !contentType.toLowerCase().includes('text/html')) {
      return NextResponse.json({ preview: fallbackPreview(parsed) })
    }

    const html = (await res.text()).slice(0, 200_000)
    const imageRaw = getMeta(html, 'og:image') ?? getMeta(html, 'twitter:image')
    const image = imageRaw ? new URL(imageRaw, parsed).toString() : null
    const preview: Preview = {
      url: parsed.toString(),
      hostname: parsed.hostname.replace(/^www\./, ''),
      title: getMeta(html, 'og:title') ?? getMeta(html, 'twitter:title') ?? getTitle(html),
      description: getMeta(html, 'og:description') ?? getMeta(html, 'description') ?? getMeta(html, 'twitter:description'),
      image,
      siteName: getMeta(html, 'og:site_name'),
    }

    return NextResponse.json({ preview }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[link-preview]', message)
    return NextResponse.json({ error: 'Could not load preview' }, { status: 502 })
  }
}

function fallbackPreview(url: URL): Preview {
  return {
    url: url.toString(),
    hostname: url.hostname.replace(/^www\./, ''),
    title: url.hostname.replace(/^www\./, ''),
    description: null,
    image: null,
    siteName: null,
  }
}
