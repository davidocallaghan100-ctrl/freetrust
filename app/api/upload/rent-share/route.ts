export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/security/validate'
import { sanitizeFilename } from '@/lib/security/sanitize'

const BUCKET = 'rent-share'

export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('[rent-share upload] POST received')

  try {
    // ── 1. Environment ──────────────────────────────────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    console.log('[rent-share upload] env — URL:', !!supabaseUrl, 'SERVICE_KEY:', !!serviceKey)

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: missing Supabase credentials' },
        { status: 500 }
      )
    }

    // ── 2. Auth ─────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    console.log('[rent-share upload] auth — user:', user?.id ?? null, 'err:', authErr?.message ?? null)

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 3. Parse FormData ────────────────────────────────────────────────────
    const formData = await req.formData()
    const raw = formData.get('file')
    console.log('[rent-share upload] formData — file field type:', typeof raw, raw instanceof File ? raw.name : 'n/a')

    if (!raw || typeof raw === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const file = raw as File
    console.log('[rent-share upload] file:', file.name, file.type, file.size, 'bytes')

    // ── 4. Validate ──────────────────────────────────────────────────────────
    const { valid, error: fileError } = validateFileUpload(file)
    if (!valid) {
      return NextResponse.json({ error: fileError ?? 'Invalid file' }, { status: 400 })
    }
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        { error: 'Only jpg, png, gif, and webp images are allowed' },
        { status: 400 }
      )
    }

    // ── 5. Prepare buffer ────────────────────────────────────────────────────
    const safeFilename  = sanitizeFilename(file.name)
    const ext           = safeFilename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const storagePath   = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
    const arrayBuffer   = await file.arrayBuffer()
    const buffer        = Buffer.from(arrayBuffer)   // Buffer is more reliable than Uint8Array on Vercel
    console.log('[rent-share upload] buffer size:', buffer.byteLength, 'path:', storagePath)

    // ── 6. Storage upload via service-role client ────────────────────────────
    const admin = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // Ensure bucket exists (idempotent — ignores "already exists")
    const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    })
    if (bucketErr) {
      const msg = bucketErr.message?.toLowerCase() ?? ''
      if (!msg.includes('already exists') && !msg.includes('duplicate')) {
        console.warn('[rent-share upload] createBucket warning:', bucketErr.message)
      }
    }

    const { data: uploadData, error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    console.log('[rent-share upload] upload result — data:', JSON.stringify(uploadData), 'error:', JSON.stringify(uploadError))

    if (uploadError) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
    console.log('[rent-share upload] public URL:', urlData.publicUrl)

    return NextResponse.json({ url: urlData.publicUrl })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[rent-share upload] unhandled exception:', message, err)
    return NextResponse.json({ error: `Upload error: ${message}` }, { status: 500 })
  }
}
