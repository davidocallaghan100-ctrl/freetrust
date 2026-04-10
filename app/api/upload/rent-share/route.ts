export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/security/validate'
import { sanitizeFilename } from '@/lib/security/sanitize'

export async function POST(req: NextRequest) {
  try {
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

    const { error: uploadError } = await supabase.storage
      .from('rent-share')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      // Bucket may not exist yet — try to create it, then retry
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket') || (uploadError as { statusCode?: string }).statusCode === '404') {
        const { error: bucketErr } = await supabase.storage.createBucket('rent-share', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        })
        if (bucketErr && !bucketErr.message?.includes('already exists')) {
          console.error('[rent-share upload] create bucket error:', bucketErr)
          return NextResponse.json({ error: 'Storage not available' }, { status: 500 })
        }
        // Retry upload
        const { error: retryErr } = await supabase.storage
          .from('rent-share')
          .upload(path, buffer, { contentType: file.type, upsert: false })
        if (retryErr) {
          console.error('[rent-share upload] retry error:', retryErr)
          return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
        }
      } else {
        console.error('[rent-share upload] upload error:', uploadError)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }
    }

    const { data: urlData } = supabase.storage.from('rent-share').getPublicUrl(path)
    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error('[rent-share upload] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
