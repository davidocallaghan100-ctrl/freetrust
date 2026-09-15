import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 3600

const FALLBACK_PATH = '/icons/freetrust-share-logo-20260524.png'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const FACEBOOK_SAFE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function fallback(request: NextRequest) {
  return NextResponse.redirect(new URL(FALLBACK_PATH, request.url), {
    status: 307,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}

function isAllowedServiceImage(value: unknown): value is string {
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
  const { id } = await params
  if (!UUID_PATTERN.test(id)) return fallback(request)

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('listings')
      .select('cover_image, images')
      .eq('id', id)
      .eq('product_type', 'service')
      .eq('status', 'active')
      .maybeSingle()

    if (error || !data) return fallback(request)

    const imageCandidates = [
      data.cover_image,
      ...(Array.isArray(data.images) ? data.images : []),
    ]
    const imageUrl = imageCandidates.find(isAllowedServiceImage)
    if (!imageUrl) return fallback(request)

    const upstream = await fetch(imageUrl, {
      headers: { Accept: 'image/jpeg,image/png,image/gif;q=0.9' },
      next: { revalidate: 3600 },
    })
    const contentType = (upstream.headers.get('content-type') ?? '').split(';')[0].toLowerCase()
    const contentLength = Number(upstream.headers.get('content-length') ?? 0)

    if (!upstream.ok || !FACEBOOK_SAFE_TYPES.has(contentType) || contentLength > MAX_IMAGE_BYTES) {
      return fallback(request)
    }

    const image = await upstream.arrayBuffer()
    if (!image.byteLength || image.byteLength > MAX_IMAGE_BYTES) return fallback(request)

    return new NextResponse(image, {
      status: 200,
      headers: {
        'Content-Type': contentType,
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
