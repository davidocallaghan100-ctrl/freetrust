export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Use admin client for storage upload to avoid RLS policy edge cases
    const admin = createAdminClient()
    const { error: uploadError } = await admin.storage
      .from('covers')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[cover upload] storage error:', JSON.stringify(uploadError))
      return NextResponse.json({ error: 'Upload failed', detail: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('covers').getPublicUrl(path)
    const cover_url = urlData.publicUrl

    // Update profile using user client (respects RLS — user can only update own row)
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ cover_url })
      .eq('id', user.id)

    if (dbError) {
      console.error('[cover upload] db error:', JSON.stringify(dbError))
      // Still return success — the URL is valid even if the DB update failed
    }

    return NextResponse.json({ url: cover_url })
  } catch (err) {
    console.error('[cover upload] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
