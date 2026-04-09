export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateFileUpload } from '@/lib/security/validate'
import { sanitizeFilename } from '@/lib/security/sanitize'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string) ?? 'photo'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Validate size (10MB) and type allowlist (jpg, png, gif, mp4, pdf)
    const { valid, error: fileError } = validateFileUpload(file)
    if (!valid) return NextResponse.json({ error: fileError }, { status: 400 })

    const safeFilename = sanitizeFilename(file.name)
    const ext = safeFilename.split('.').pop()?.toLowerCase() ?? 'bin'
    // Sanitise type param — only allow known bucket folders
    const safeType = ['photo', 'video', 'document', 'listing'].includes(type) ? type : 'photo'
    const path = `${safeType}/${user.id}/${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)

    return NextResponse.json({ url: publicUrl, path })
  } catch (err) {
    console.error('[upload/media]', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
