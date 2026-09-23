export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

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

    // SVG is deliberately rejected: an uploaded SVG is active content and
    // becomes publicly hosted when stored in the org-logos bucket.
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, WebP, or GIF.' }, { status: 400 })
    }

    if (file.size > 3 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 3MB.' }, { status: 400 })
    }

    // Use admin client to bypass RLS on storage
    const admin = createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const signatureMatches =
      (file.type === 'image/jpeg' && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
      (file.type === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (file.type === 'image/webp' && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') ||
      (file.type === 'image/gif' && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')))
    if (!signatureMatches) {
      return NextResponse.json({ error: 'The uploaded file does not match its declared image type.' }, { status: 400 })
    }

    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    const path = `${user.id}-${Date.now()}-${randomUUID()}.${extensionByType[file.type]}`

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
