export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// POST /api/organisations/upload-logo
// Accepts multipart/form-data with a "file" field
// Returns { url: string }
export async function POST(request: NextRequest) {
  try {
    // Auth check via server client (reads cookies correctly)
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, WebP, GIF, or SVG.' }, { status: 400 })
    }

    if (file.size > 3 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 3MB.' }, { status: 400 })
    }

    // Use admin client to bypass RLS on storage
    const admin = createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadErr } = await admin.storage
      .from('org-logos')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadErr) {
      console.error('[upload-logo] storage error:', uploadErr)
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage
      .from('org-logos')
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('[POST /api/organisations/upload-logo]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
