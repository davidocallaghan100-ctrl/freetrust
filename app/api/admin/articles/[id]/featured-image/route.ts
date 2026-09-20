export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireFreeTrustAdmin } from '@/lib/admin/access'

const BUCKET = 'feed-media'
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

type RouteContext = { params: { id: string } }

/**
 * Mint a one-shot signed upload URL for an approved admin. The image bytes
 * then travel directly from the browser to Supabase Storage, avoiding the
 * serverless request-body limit while keeping the storage path privileged.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response

  try {
    const payload = await request.json().catch(() => null) as { contentType?: unknown } | null
    const contentType = typeof payload?.contentType === 'string' ? payload.contentType : ''
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: article, error: articleError } = await admin
      .from('articles')
      .select('id')
      .eq('id', params.id)
      .maybeSingle()

    if (articleError) {
      console.error('[POST /api/admin/articles/:id/featured-image]', articleError)
      return NextResponse.json({ error: articleError.message }, { status: 500 })
    }
    if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

    const storagePath = `article-covers/admin/${auth.user.id}/${randomUUID()}.${EXT_BY_MIME[contentType]}`
    const { data: signedUpload, error: signedUploadError } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath)

    if (signedUploadError || !signedUpload) {
      console.error('[POST /api/admin/articles/:id/featured-image] signed URL', signedUploadError)
      return NextResponse.json({ error: signedUploadError?.message ?? 'Unable to prepare image upload' }, { status: 500 })
    }

    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
    return NextResponse.json({
      signedUrl: signedUpload.signedUrl,
      publicUrl: publicUrl.publicUrl,
    })
  } catch (error) {
    console.error('[POST /api/admin/articles/:id/featured-image] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
