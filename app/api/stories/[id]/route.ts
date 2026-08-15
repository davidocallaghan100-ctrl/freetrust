export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { storiesPathFromPublicUrl } from '@/lib/storage/directUpload'

// DELETE /api/stories/[id]
// Owner-only (enforced by RLS via the user-scoped client). Also removes the
// underlying storage object, but ONLY if no other stories/memories row still
// references the same media_url (e.g. it was already saved as a Memory, or
// reposted into another live story).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: story, error: fetchErr } = await supabase
      .from('stories')
      .select('id, user_id, media_url')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }
    if (story.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to delete this story' }, { status: 403 })
    }

    // RLS ("stories delete own") enforces ownership again at the DB layer.
    const { error: deleteErr } = await supabase.from('stories').delete().eq('id', id)
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    // Clean up storage only if nothing else still points at this media_url.
    const [{ count: storyRefs }, { count: memoryRefs }] = await Promise.all([
      admin.from('stories').select('id', { count: 'exact', head: true }).eq('media_url', story.media_url),
      admin.from('memories').select('id', { count: 'exact', head: true }).eq('media_url', story.media_url),
    ])

    if (!storyRefs && !memoryRefs) {
      const path = storiesPathFromPublicUrl(story.media_url as string)
      if (path) {
        await admin.storage.from('stories').remove([path])
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/stories/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
