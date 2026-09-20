import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 3600

const FALLBACK_PATH = '/icons/freetrust-share-logo-20260524.png'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const SOCIAL_IMAGE_SOURCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function fallback(request: NextRequest) {
  return NextResponse.redirect(new URL(FALLBACK_PATH, request.url), {
    status: 307,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}

function isAllowedArticleImage(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false

  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.supabase.co') &&
      url.pathname.startsWith('/storage/v1/object/public/')
    )
  } catch {
    return false
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: slug } = await params

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('articles')
      .select('featured_image_url')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()

    if (error || !data || !isAllowedArticleImage(data.featured_image_url)) {
      return fallback(request)
    }

    const upstream = await fetch(data.featured_image_url, {
      headers: { Accept: 'image/jpeg,image/png,image/gif,image/webp;q=0.9' },
      next: { revalidate: 3600 },
    })
    const contentType = (upstream.headers.get('content-type') ?? '').split(';')[0].toLowerCase()
    const contentLength = Number(upstream.headers.get('content-length') ?? 0)

    if (!upstream.ok || !SOCIAL_IMAGE_SOURCE_TYPES.has(contentType) || contentLength > MAX_IMAGE_BYTES) {
      return fallback(request)
    }

    const source = Buffer.from(await upstream.arrayBuffer())
    if (!source.byteLength || source.byteLength > MAX_IMAGE_BYTES) return fallback(request)

    // LinkedIn and other social crawlers expect a wide preview image. Article
    // covers can be portrait photos or WebP uploads, so normalise every
    // compatible source into a 1200×630 JPEG and crop from the centre.
    const image = await sharp(source)
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88 })
      .toBuffer()

    return new NextResponse(image, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(image.byteLength),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return fallback(request)
  }
}
