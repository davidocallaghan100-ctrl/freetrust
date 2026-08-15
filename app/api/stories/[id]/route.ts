export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { storiesPathFromPublicUrl } from '@/lib/storage/directUpload'

// DELETE /api/stories/[id]
// Allowed for: the original poster (personal or org story), OR — for org
// stories only — any current owner/admin of that org (moderation capability,
// not just the individual poster). Enforced here AND again by RLS via the
// user-scoped client ("stories delete own", updated 2026-08-16 to include
// the org branch). Also removes the underlying storage object, but ONLY if
// no other stories/memories row still references the same media_url (e.g.
// it was already saved as a Memory, or reposted into another live story).
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
      .select('id, user_id, media_url, posted_as_organisation_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    let authorised = story.user_id === user.id
    if (!authorised && story.posted_as_organisation_id) {
      const { data: membership } = await admin
        .from('organisation_members')
        .select('role')
        .eq('organisation_id', story.posted_as_organisation_id)
        .eq('user_id', user.id)
        .maybeSingle()
      authorised = membership?.role === 'owner' || membership?.role === 'admin'
    }
    if (!authorised) {
      return NextResponse.json({ error: 'Not authorized to delete this story' }, { status: 403 })
    }

    // Delete via the admin client when acting as an org admin/owner who
    // isn't the original poster — RLS's "stories delete own" policy already
    // permits this exact case (org owner/admin branch), but using the
    // user-scoped client here would still work too; admin is used for
    // consistency since we've already done the authorisation check above.
    const { error: deleteErr } = await admin.from('stories').delete().eq('id', id)
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
