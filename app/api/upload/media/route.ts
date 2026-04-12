export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeFilename } from '@/lib/security/sanitize'

// Upload route for feed post media. Handles photos AND videos with different
// size limits, uploads to the public `feed-media` bucket via the service-role
// client so storage RLS never blocks the upload. Always returns JSON — the
// frontend's res.json() can never receive an HTML error page.

const BUCKET = 'feed-media'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
const ALL_TYPES   = [...IMAGE_TYPES, ...VIDEO_TYPES]

const MAX_IMAGE_BYTES = 10 * 1024 * 1024   //  10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024  // 100 MB

export async function POST(req: NextRequest) {
  console.log('[upload/media] POST received')

  try {
    // ── 1. Auth (regular client) ─────────────────────────────────────────────
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Parse FormData ────────────────────────────────────────────────────
    let formData: FormData
    try {
      formData = await req.formData()
    } catch (err) {
      console.error('[upload/media] formData parse error:', err)
      return NextResponse.json({ error: 'Invalid upload — could not parse form data' }, { status: 400 })
    }

    const raw = formData.get('file')
    const typeParam = (formData.get('type') as string | null) ?? 'photo'

    if (!raw || typeof raw === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const file = raw as File
    console.log('[upload/media] file:', file.name, file.type, file.size, 'bytes', 'as', typeParam)

    // ── 3. Validate ──────────────────────────────────────────────────────────
    if (!file.type) {
      return NextResponse.json({ error: 'File has no MIME type' }, { status: 400 })
    }

    const isImage = IMAGE_TYPES.includes(file.type)
    const isVideo = VIDEO_TYPES.includes(file.type)

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: jpg, png, gif, webp, mp4, webm, mov` },
        { status: 400 }
      )
    }

    const sizeLimit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (file.size > sizeLimit) {
      const limitMb = Math.round(sizeLimit / 1024 / 1024)
      return NextResponse.json(
        { error: `File too large (max ${limitMb} MB for ${isVideo ? 'videos' : 'images'})` },
        { status: 400 }
      )
    }

    // Cross-check the `type` param — the frontend sends 'photo' | 'video' | 'short'
    // Reject obvious mismatches (e.g. uploading an mp4 but sending type=photo)
    const mediaKind: 'photo' | 'video' = isVideo ? 'video' : 'photo'
    if (typeParam === 'photo' && isVideo) {
      return NextResponse.json({ error: 'Use the video uploader for video files' }, { status: 400 })
    }

    // ── 4. Build storage path ────────────────────────────────────────────────
    const safeFilename = sanitizeFilename(file.name || `upload.${mediaKind === 'video' ? 'mp4' : 'jpg'}`)
    const ext = safeFilename.split('.').pop()?.toLowerCase() ?? (mediaKind === 'video' ? 'mp4' : 'jpg')
    const storagePath = `${mediaKind}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    console.log('[upload/media] buffer:', buffer.byteLength, 'bytes → path:', storagePath)

    const admin = createAdminClient()

    // ── 5. Ensure bucket exists (idempotent) ─────────────────────────────────
    // If the bucket is missing, create it with public access and the
    // combined file-type allowlist. If it already exists we swallow the
    // "already exists" / "duplicate" error.
    const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_VIDEO_BYTES, // use the larger limit for the bucket
      allowedMimeTypes: ALL_TYPES,
    })
    if (bucketErr) {
      const msg = bucketErr.message?.toLowerCase() ?? ''
      if (!msg.includes('already exists') && !msg.includes('duplicate') && !msg.includes('resource already')) {
        console.warn('[upload/media] createBucket warning (non-fatal):', bucketErr.message)
      }
    }

    // ── 6. Upload via service-role client ────────────────────────────────────
    const { data: uploadData, error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    console.log('[upload/media] result — data:', JSON.stringify(uploadData), 'error:', uploadError?.message ?? 'ok')

    if (uploadError) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // ── 7. Public URL ────────────────────────────────────────────────────────
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
    console.log('[upload/media] public URL:', urlData.publicUrl)

    return NextResponse.json({
      url: urlData.publicUrl,
      path: storagePath,
      kind: mediaKind,
      mime: file.type,
      size: file.size,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[upload/media] unhandled:', message, err)
    return NextResponse.json({ error: `Upload error: ${message}` }, { status: 500 })
  }
}
