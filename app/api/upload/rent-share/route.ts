export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/security/validate'
import { sanitizeFilename } from '@/lib/security/sanitize'

const BUCKET = 'rent-share'

function jsonError(message: string, status = 500) {
  console.error(`[rent-share upload] ERROR ${status}:`, message)
  return new NextResponse(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: NextRequest) {
  console.log('[rent-share upload] POST received')

  // ── 1. Environment check ──────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  console.log('[rent-share upload] env — URL:', !!supabaseUrl, 'SERVICE_KEY:', !!serviceKey)

  if (!supabaseUrl || !serviceKey) {
    return jsonError('Server configuration error: missing Supabase credentials', 500)
  }

  // ── 2. Auth ───────────────────────────────────────────────────────────────
  let userId: string
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      console.warn('[rent-share upload] auth failed:', authErr?.message)
      return jsonError('Unauthorized', 401)
    }
    userId = user.id
    console.log('[rent-share upload] auth ok, user:', userId)
  } catch (err) {
    console.error('[rent-share upload] auth exception:', err)
    return jsonError('Auth error', 500)
  }

  // ── 3. Parse FormData ─────────────────────────────────────────────────────
  let file: File
  try {
    const formData = await req.formData()
    const raw = formData.get('file')
    if (!raw || typeof raw === 'string') return jsonError('No file provided', 400)
    file = raw as File
    console.log('[rent-share upload] file:', file.name, file.type, file.size, 'bytes')
  } catch (err) {
    console.error('[rent-share upload] formData exception:', err)
    return jsonError('Failed to parse request body', 400)
  }

  // ── 4. Validate ───────────────────────────────────────────────────────────
  const { valid, error: fileError } = validateFileUpload(file)
  if (!valid) return jsonError(fileError ?? 'Invalid file', 400)
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return jsonError('Only jpg, png, gif, and webp images are allowed', 400)
  }

  // ── 5. Upload via service-role client ─────────────────────────────────────
  try {
    const admin = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const safeFilename = sanitizeFilename(file.name)
    const ext = safeFilename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
    console.log('[rent-share upload] path:', storagePath)

    // Ensure bucket exists (idempotent)
    const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    })
    if (bucketErr) {
      const msg = bucketErr.message?.toLowerCase() ?? ''
      if (!msg.includes('already exists') && !msg.includes('duplicate')) {
        console.warn('[rent-share upload] createBucket (non-fatal):', bucketErr.message)
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('[rent-share upload] upload failed:', JSON.stringify(uploadError))
      return jsonError(`Storage upload failed: ${uploadError.message}`, 500)
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
    console.log('[rent-share upload] success:', urlData.publicUrl)
    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error('[rent-share upload] storage exception:', err)
    return jsonError(`Storage error: ${err instanceof Error ? err.message : String(err)}`, 500)
  }
}
