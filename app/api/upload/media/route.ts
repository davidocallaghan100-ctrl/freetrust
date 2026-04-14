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

  // Step breadcrumb — updated before every operation so that any sync throw
  // caught by the outer try/catch tells us EXACTLY which line blew up. This
  // is how we finally pin down the "The string did not match the expected
  // pattern" DOMException that keeps hitting mobile despite multiple rounds
  // of path sanitisation. The step is echoed into the client error response
  // so the browser console on the affected device surfaces it without
  // needing Vercel logs.
  let step: string = 'init'
  // Diagnostic context accumulated as we go — included in the outer catch
  // response so we have the storage path, file info, etc. even when the
  // throw happens outside the wrapped .upload() call.
  const diag: Record<string, unknown> = {}

  try {
    step = 'env-check'
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
    step = 'auth-create-client'
    const authClient = await createClient()
    step = 'auth-get-user'
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError) {
      console.error('[upload/media] auth error:', authError.message)
    }
    if (!user) {
      console.warn('[upload/media] no user — returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[upload/media] authed user:', user.id)
    diag.userId = user.id

    // ── 2. Parse FormData ────────────────────────────────────────────────────
    step = 'parse-formdata'
    let formData: FormData
    try {
      formData = await req.formData()
    } catch (err) {
      console.error('[upload/media] formData parse error:', err)
      return NextResponse.json({ error: 'Invalid upload — could not parse form data' }, { status: 400 })
    }

    step = 'read-formdata-fields'
    const raw = formData.get('file')
    const typeParam = (formData.get('type') as string | null) ?? 'photo'

    if (!raw || typeof raw === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const file = raw as File
    console.log('[upload/media] file:', file.name, file.type, file.size, 'bytes', 'as', typeParam)
    diag.fileName = file.name
    diag.fileType = file.type
    diag.fileSize = file.size
    diag.typeParam = typeParam

    // ── 3. Validate ──────────────────────────────────────────────────────────
    step = 'validate-file'
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
    //
    // IMPORTANT — @supabase/storage-js validates the full path client-side
    // with a regex roughly equal to /^([a-zA-Z0-9!_\-.*'()]+\/)*[a-zA-Z0-9!_\-.*'()]+$/
    // and throws a synchronous DOMException "The string did not match the
    // expected pattern" BEFORE the HTTP call if anything in the path is
    // outside that set. Every segment of the path we build below is
    // aggressively sanitised so the regex can never fail — even if
    // user.id somehow contains an uppercase letter or a weird character,
    // or if Math.random().toString(36) collapses to empty on an edge case.
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

    // Sanitise user.id: Supabase UUIDs are always lowercase [0-9a-f-],
    // but we lowercase + strip anything outside [a-z0-9-] defensively.
    // If the result is empty (should never happen) fall back to 'anon'.
    const uidSafe = (user.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'anon'

    // Sanitise the random suffix: Math.random().toString(36) is normally
    // [0-9a-z.] but `.slice(2)` drops the leading "0." so we should be
    // left with only [0-9a-z]. Strip anything else defensively, and fall
    // back to a timestamp-based tail if the result is empty.
    const rand = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, '')
    const randSafe = rand || Date.now().toString(36)

    step = 'build-path'
    const safeName = `${Date.now()}-${randSafe}.${ext}`
    const storagePath = `${mediaKind}/${uidSafe}/${safeName}`
    diag.storagePath = storagePath
    diag.resolvedExtension = ext
    diag.mediaKind = mediaKind

    // Read the file into a Uint8Array. We intentionally pass a Uint8Array
    // (not a Node Buffer) to .upload() below. Buffer extends Uint8Array in
    // Node, but some older undici builds choke on Buffer specifically in
    // the fetch body path, while Uint8Array is always accepted. This also
    // sidesteps one theory for the "expected pattern" DOMException — that
    // Buffer detection in storage-js was falling through to an unhandled
    // branch.
    step = 'read-file-bytes'
    let bodyBytes: Uint8Array
    try {
      const ab = await file.arrayBuffer()
      bodyBytes = new Uint8Array(ab)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[upload/media] file.arrayBuffer() threw:', msg, diag)
      return NextResponse.json(
        { error: `Could not read file bytes: ${msg}`, step, detail: diag },
        { status: 400 }
      )
    }
    console.log('[upload/media] bytes:', bodyBytes.byteLength, '→ path:', storagePath)
    diag.byteLength = bodyBytes.byteLength

    step = 'admin-client'
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
    //
    // Wrapped in its own try/catch so a sync throw from the storage client
    // (e.g. URL construction or header validation) is caught with our step
    // breadcrumb intact rather than escaping to the outer catch-all as an
    // opaque "Upload error: ..." response.
    step = 'create-bucket'
    try {
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
    } catch (thrownErr) {
      const msg = thrownErr instanceof Error ? thrownErr.message : String(thrownErr)
      console.error('[upload/media] createBucket threw synchronously:', msg, diag)
      // Non-fatal: bucket almost certainly already exists in production, so
      // we log the throw for diagnostics but keep going to the upload step.
      // The upload itself will surface a real "bucket not found" error if
      // the bucket genuinely doesn't exist.
      diag.createBucketThrew = msg
    }

    // ── 6. Upload via service-role client ────────────────────────────────────
    // The admin.storage.upload() call can fail in TWO distinct ways:
    //
    //   a) Returns { data, error } with error.message set — the HTTP
    //      call succeeded but Supabase Storage rejected the upload
    //      (wrong bucket, size limit, duplicate, RLS, etc.)
    //
    //   b) Throws synchronously — @supabase/storage-js runs a regex
    //      on the path BEFORE any HTTP call and throws a DOMException
    //      with message "The string did not match the expected pattern"
    //      if anything fails its filename validation. This exception
    //      bypasses the { data, error } channel entirely and lands in
    //      our try/catch. We handle it explicitly below with the
    //      storagePath in the diagnostic body so the next investigation
    //      can see exactly which character leaked through.
    //
    // Path (a) is handled via the normal `if (uploadError)` branch
    // below; path (b) is handled by the dedicated try/catch wrapper.
    step = 'upload'
    console.log('[upload/media] uploading to bucket', BUCKET, 'path', storagePath)
    let uploadData: unknown = null
    let uploadError: { message?: string } | null = null
    try {
      const result = await admin.storage
        .from(BUCKET)
        .upload(storagePath, bodyBytes, {
          contentType: fileType,
          upsert: false,
          cacheControl: '31536000',
        })
      uploadData = result.data
      uploadError = result.error
    } catch (thrownErr) {
      // This is path (b): storage-js client-side path validation threw
      // synchronously. The usual culprit is a non-ASCII character in
      // the path — but we've sanitised everything we control, so if this
      // fires it's a real diagnostic clue worth surfacing in full.
      const msg = thrownErr instanceof Error ? thrownErr.message : String(thrownErr)
      const stk = thrownErr instanceof Error ? thrownErr.stack : undefined
      console.error('[upload/media] storage.upload threw synchronously:', {
        message: msg,
        stack: stk,
        storagePath,
        bucket: BUCKET,
        contentType: fileType,
        fileNameOriginal: file.name,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: `Upload rejected by storage client [step=${step}]: ${msg}`,
          step,
          detail: {
            reason: 'storage-js upload threw synchronously',
            hint: 'Either path validation or a URL/header construction step inside @supabase/storage-js threw. Check Vercel logs for the stack trace to identify the culprit.',
            storagePath,
            bucket: BUCKET,
            contentType: fileType,
            fileNameOriginal: file.name,
          },
        },
        { status: 500 }
      )
    }

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
      if (msg.toLowerCase().includes('expected pattern')) {
        return NextResponse.json(
          {
            error: `Upload rejected: ${msg}. The storage path failed Supabase's validator.`,
            detail: {
              reason: 'storage path rejected',
              storagePath,
            },
          },
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
    // Wrapped in its own try/catch — getPublicUrl internally does an
    // encodeURI() on the path and builds a URL with a template literal;
    // in theory nothing here should throw (the path is already sanitised
    // and the upload succeeded), but we keep the breadcrumb going so
    // that IF this is where the DOMException originates, the next bug
    // report tells us immediately rather than looping on more guesses.
    step = 'public-url'
    let publicUrl: string | undefined
    try {
      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
      publicUrl = urlData?.publicUrl
    } catch (thrownErr) {
      const msg = thrownErr instanceof Error ? thrownErr.message : String(thrownErr)
      console.error('[upload/media] getPublicUrl threw synchronously:', msg, diag)
      return NextResponse.json(
        {
          error: `getPublicUrl failed [step=${step}]: ${msg}`,
          step,
          detail: { ...diag, reason: 'getPublicUrl threw' },
        },
        { status: 500 }
      )
    }
    if (!publicUrl) {
      console.error('[upload/media] getPublicUrl returned nothing')
      return NextResponse.json(
        { error: 'Upload succeeded but could not resolve public URL', step, detail: diag },
        { status: 500 }
      )
    }
    console.log('[upload/media] ✓ done in', Date.now() - startedAt, 'ms:', publicUrl)

    step = 'respond'
    return NextResponse.json({
      url: publicUrl,
      path: storagePath,
      kind: mediaKind,
      mime: fileType,
      size: file.size,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack    = err instanceof Error ? err.stack : undefined
    const name     = err instanceof Error ? err.name : 'UnknownError'
    console.error('[upload/media] unhandled:', { step, message, name, stack, diag })
    // Include the step breadcrumb in the user-facing error so the next
    // failure report immediately tells us WHERE the throw happened. The
    // previous "Upload error: ..." string was opaque — the user saw a
    // cryptic DOMException with no indication of which line triggered it,
    // which is why we've been guessing for multiple iterations.
    return NextResponse.json(
      {
        error: `Upload error [step=${step}]: ${message}`,
        step,
        errorName: name,
        detail: diag,
      },
      { status: 500 }
    )
  }
}
