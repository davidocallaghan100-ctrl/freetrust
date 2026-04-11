export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/security/validate'
import { sanitizeFilename } from '@/lib/security/sanitize'

const BUCKET = 'rent-share'

export async function POST(req: NextRequest) {
  try {
    // Auth check via user client
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const { valid, error: fileError } = validateFileUpload(file)
    if (!valid) return NextResponse.json({ error: fileError }, { status: 400 })

    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: 'Only jpg, png, gif, and webp images are allowed' }, { status: 400 })
    }

    const safeFilename = sanitizeFilename(file.name)
    const ext = safeFilename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Use service-role client for storage — ensures the bucket exists and RLS
    // policies on the storage.objects table don't block the upload.
    const admin = createAdminClient()

    // Ensure the bucket exists (no-op if it already does)
    const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10485760, // 10 MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    })
    if (bucketErr && !bucketErr.message?.includes('already exists') && !bucketErr.message?.toLowerCase().includes('duplicate')) {
      console.error('[rent-share upload] bucket create error:', bucketErr)
      // Non-fatal: the bucket may already exist under a different error message,
      // so we proceed and let the upload fail if truly unavailable.
    }

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('[rent-share upload] upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error('[rent-share upload] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
