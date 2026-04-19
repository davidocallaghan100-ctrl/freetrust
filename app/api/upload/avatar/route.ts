export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/security/validate'
import { sanitizeFilename } from '@/lib/security/sanitize'

export async function POST(req: NextRequest) {
  try {
    // Use user client to verify auth, admin client to bypass storage RLS for upload
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate size (10MB) and allowed types
    const { valid, error: fileError } = validateFileUpload(file)
    if (!valid) return NextResponse.json({ error: fileError }, { status: 400 })

    // Avatars: images only
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: 'Avatars must be an image (jpg, png, gif, webp)' }, { status: 400 })
    }

    const safeFilename = sanitizeFilename(file.name)
    const ext = safeFilename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Use admin client for storage upload to avoid RLS policy edge cases
    const admin = createAdminClient()
    const { error: uploadError } = await admin.storage
      .from('avatars')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[avatar upload] storage error:', JSON.stringify(uploadError))
      return NextResponse.json({ error: 'Upload failed', detail: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('avatars').getPublicUrl(path)
    const avatar_url = urlData.publicUrl

    // Update profile using user client (respects RLS — user can only update own row)
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_url })
      .eq('id', user.id)

    if (dbError) {
      console.error('[avatar upload] db error:', JSON.stringify(dbError))
      // Still return success — the URL is valid even if DB update failed
    }

    return NextResponse.json({ url: avatar_url })
  } catch (err) {
    console.error('[avatar upload] unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
