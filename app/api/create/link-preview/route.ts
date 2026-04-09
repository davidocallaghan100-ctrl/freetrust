export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreeTrust/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    const html = await res.text()

    const getTag = (pattern: RegExp) => {
      const m = html.match(pattern)
      return m ? m[1]?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim() : null
    }

    const title =
      getTag(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
      getTag(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i) ||
      getTag(/<title[^>]*>([^<]+)<\/title>/i) ||
      null

    const description =
      getTag(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ||
      getTag(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i) ||
      getTag(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
      getTag(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i) ||
      null

    const image =
      getTag(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
      getTag(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i) ||
      null

    return NextResponse.json({ title, description, image, url })
  } catch (err) {
    console.error('[link-preview]', err)
    return NextResponse.json({ error: 'Failed to fetch preview' }, { status: 500 })
  }
}
