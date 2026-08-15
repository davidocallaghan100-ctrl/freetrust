export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { storiesPathFromPublicUrl } from '@/lib/storage/directUpload'

// DELETE /api/memories/[id]
// Owner-only (RLS: "memories delete own"). Removes the storage object only
// if no live story still references the same media_url (e.g. it was
// reposted and that repost hasn't expired/been cleaned up yet).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: memory, error: fetchErr } = await supabase
      .from('memories')
      .select('id, user_id, media_url')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !memory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
    }
    if (memory.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to delete this memory' }, { status: 403 })
    }

    const { error: deleteErr } = await supabase.from('memories').delete().eq('id', id)
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    const [{ count: storyRefs }, { count: memoryRefs }] = await Promise.all([
      admin.from('stories').select('id', { count: 'exact', head: true }).eq('media_url', memory.media_url),
      admin.from('memories').select('id', { count: 'exact', head: true }).eq('media_url', memory.media_url),
    ])

    if (!storyRefs && !memoryRefs) {
      const path = storiesPathFromPublicUrl(memory.media_url as string)
      if (path) {
        await admin.storage.from('stories').remove([path])
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/memories/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
