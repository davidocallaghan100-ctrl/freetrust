export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Legacy server-side upload route. The primary upload path is now a direct
// client-to-Supabase upload from app/create/page.tsx — this avoids Vercel's
// 4.5 MB body size limit on Hobby plans and the serverless memory cost of
// buffering large videos. This route is kept as a fallback for smaller
// files and any legacy callers that still hit it.
//
// Every error path returns JSON so the client's res.json() can never crash
// on an HTML error page. Every DB operation logs to console for easy
// diagnosis in Vercel logs.

const BUCKET = 'feed-media'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp']

const MAX_IMAGE_BYTES = 10 * 1024 * 1024   //  10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024  // 100 MB

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  console.log('[upload/media] POST received at', new Date().toISOString())

  try {
    // ── 0. Env check ─────────────────────────────────────────────────────────
    // Make a common misconfiguration really obvious in the logs instead of
    // throwing a generic "Missing Supabase admin credentials" from deep
    // inside createAdminClient().
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[upload/media] SUPABASE_SERVICE_ROLE_KEY is not set in the environment')
      return NextResponse.json(
        { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set. Add it to Vercel env vars and redeploy.' },
        { status: 500 }
      )
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('[upload/media] NEXT_PUBLIC_SUPABASE_URL is not set')
      return NextResponse.json(
        { error: 'Server misconfiguration: NEXT_PUBLIC_SUPABASE_URL is not set.' },
        { status: 500 }
      )
    }

    // ── 1. Auth (regular client) ─────────────────────────────────────────────
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError) {
      console.error('[upload/media] auth error:', authError.message)
    }
    if (!user) {
      console.warn('[upload/media] no user — returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[upload/media] authed user:', user.id)

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
    // Mobile browsers (older iOS, some Android builds) sometimes report an
    // empty `file.type` for HEIC and even plain JPEG camera uploads. Sniff
    // the extension and synthesise a MIME so we don't reject a real image.
    let fileType = file.type
    if (!fileType) {
      const ext = (file.name.split('.').pop() ?? '').toLowerCase()
      const EXT_TO_MIME: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        heic: 'image/heic',
        heif: 'image/heif',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        webm: 'video/webm',
        m4v: 'video/x-m4v',
        '3gp': 'video/3gpp',
      }
      if (ext in EXT_TO_MIME) {
        fileType = EXT_TO_MIME[ext]
        console.log('[upload/media] synthesised MIME from extension:', ext, '→', fileType)
      } else {
        return NextResponse.json(
          { error: `File has no MIME type and unrecognised extension: .${ext || '(none)'}` },
          { status: 400 }
        )
      }
    }

    const isImage = IMAGE_TYPES.includes(fileType)
    const isVideo = VIDEO_TYPES.includes(fileType)

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType}. Allowed: jpg, png, gif, webp, heic, heif, mp4, webm, mov` },
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
    // Do NOT trust file.name — mobile camera uploads often arrive with
    // uppercase filenames ("IMG_1234.HEIC"), unicode filenames, spaces
    // and parentheses ("Photo 2024-04-13 12.34.56 (1).heic"), or no
    // extension at all. Supabase Storage's path validator rejects many
    // of those patterns with a cryptic "The string did not match the
    // expected pattern" error that only reproduces on the affected
    // device — hence the "works on desktop, fails on mobile" report.
    //
    // Build a 100% synthetic filename instead. The extension is derived
    // from the MIME type we already validated above (not from the raw
    // filename) so we only ever produce ASCII, lowercase, no-space,
    // no-punctuation names that Supabase Storage always accepts.
    const MIME_TO_EXT: Record<string, string> = {
      'image/jpeg':      'jpg',
      'image/png':       'png',
      'image/gif':       'gif',
      'image/webp':      'webp',
      'image/heic':      'heic',
      'image/heif':      'heif',
      'video/mp4':       'mp4',
      'video/webm':      'webm',
      'video/quicktime': 'mov',
      'video/x-m4v':     'm4v',
      'video/3gpp':      '3gp',
    }
    const resolvedExtension = MIME_TO_EXT[fileType]
    const ext = resolvedExtension || (mediaKind === 'video' ? 'mp4' : 'jpg')
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const storagePath = `${mediaKind}/${user.id}/${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    console.log('[upload/media] buffer:', buffer.byteLength, 'bytes → path:', storagePath)

    let admin
    try {
      admin = createAdminClient()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[upload/media] createAdminClient threw:', msg)
      return NextResponse.json({ error: `Server misconfiguration: ${msg}` }, { status: 500 })
    }

    // ── 5. Ensure bucket exists (idempotent) ─────────────────────────────────
    // Do NOT set allowedMimeTypes here — bucket-level MIME restrictions cause
    // silent upload rejections when a file doesn't match the hardcoded list
    // (e.g. HEIC from iPhone). We validate MIME types in the application
    // layer above. The canonical bucket setup lives in
    // supabase/migrations/20260412_feed_media_bucket.sql which also sets up
    // RLS policies for direct client uploads.
    const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_VIDEO_BYTES,
    })
    if (bucketErr) {
      const msg = bucketErr.message?.toLowerCase() ?? ''
      const isAlreadyExists =
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        msg.includes('resource already') ||
        msg.includes('violates row-level security') // bucket may exist but we can't see it
      if (!isAlreadyExists) {
        console.error('[upload/media] createBucket error:', bucketErr.message)
      } else {
        console.log('[upload/media] bucket already exists (ok)')
      }
    }

    // ── 6. Upload via service-role client ────────────────────────────────────
    console.log('[upload/media] uploading to bucket', BUCKET, 'path', storagePath)
    const { data: uploadData, error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: fileType,
        upsert: false,
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('[upload/media] upload error:', JSON.stringify(uploadError))
      const msg = uploadError.message || 'unknown error'
      // Helpful hints for common failures
      if (msg.toLowerCase().includes('bucket not found')) {
        return NextResponse.json(
          { error: 'Upload failed — feed-media bucket does not exist. Run supabase/migrations/20260412_feed_media_bucket.sql.' },
          { status: 500 }
        )
      }
      return NextResponse.json(
        { error: `Storage upload failed: ${msg}` },
        { status: 500 }
      )
    }

    console.log('[upload/media] upload ok:', JSON.stringify(uploadData))

    // ── 7. Public URL ────────────────────────────────────────────────────────
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
    if (!urlData?.publicUrl) {
      console.error('[upload/media] getPublicUrl returned nothing')
      return NextResponse.json(
        { error: 'Upload succeeded but could not resolve public URL' },
        { status: 500 }
      )
    }
    console.log('[upload/media] ✓ done in', Date.now() - startedAt, 'ms:', urlData.publicUrl)

    return NextResponse.json({
      url: urlData.publicUrl,
      path: storagePath,
      kind: mediaKind,
      mime: fileType,
      size: file.size,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack    = err instanceof Error ? err.stack : undefined
    console.error('[upload/media] unhandled:', message, stack)
    return NextResponse.json({ error: `Upload error: ${message}` }, { status: 500 })
  }
}
