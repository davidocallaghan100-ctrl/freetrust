export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/push/sendPushNotification'

async function canPostAsOrganisation(admin: ReturnType<typeof createAdminClient>, userId: string, organisationId: string) {
  const { data: membership } = await admin
    .from('organisation_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organisation_id', organisationId)
    .in('role', ['owner', 'admin'])
    .maybeSingle()

  if (membership) return true

  const { data: created } = await admin
    .from('organisations')
    .select('id')
    .eq('id', organisationId)
    .eq('creator_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  return Boolean(created)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: comments, error } = await supabase
      .from('feed_comments')
      .select(`
        id, content, created_at, posted_as_organisation_id,
        profiles!feed_comments_user_id_fkey(id, full_name, avatar_url),
        posted_as_organisation:organisations!feed_comments_posted_as_organisation_id_fkey(id, name, slug, logo_url)
      `)
      .eq('post_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('feed comments GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }

    return NextResponse.json({ comments: comments ?? [] })
  } catch (err) {
    console.error('GET comments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const content = (body?.content ?? '').trim()
    const postedAsOrganisationId = typeof body?.posted_as_organisation_id === 'string' && body.posted_as_organisation_id.trim()
      ? body.posted_as_organisation_id.trim()
      : null

    if (!content) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (postedAsOrganisationId) {
      const allowed = await canPostAsOrganisation(admin, user.id, postedAsOrganisationId)
      if (!allowed) {
        return NextResponse.json({ error: 'You are not allowed to comment as this page' }, { status: 403 })
      }
    }

    const { data: comment, error: insertError } = await supabase
      .from('feed_comments')
      .insert({ post_id: id, user_id: user.id, content, posted_as_organisation_id: postedAsOrganisationId })
      .select(`
        id, content, created_at, posted_as_organisation_id,
        profiles!feed_comments_user_id_fkey(id, full_name, avatar_url),
        posted_as_organisation:organisations!feed_comments_posted_as_organisation_id_fkey(id, name, slug, logo_url)
      `)
      .single()

    if (insertError) {
      console.error('feed_comments insert error:', insertError)
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
    }

    // Increment comments_count + email the post author (if not self)
    const { data: postData } = await supabase
      .from('feed_posts')
      .select('user_id, comments_count')
      .eq('id', id)
      .single()

    if (postData) {
      await supabase
        .from('feed_posts')
        .update({ comments_count: (postData.comments_count ?? 0) + 1 })
        .eq('id', id)

      // Email the post author (preference-checked, skip self-comments)
      if (postData.user_id && postData.user_id !== user.id) {
        let commenterName = 'Someone'
        if (postedAsOrganisationId) {
          const { data: org } = await admin
            .from('organisations')
            .select('name')
            .eq('id', postedAsOrganisationId)
            .maybeSingle()
          commenterName = org?.name ?? 'A page'
        } else {
          const { data: commenter } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle()
          commenterName = commenter?.full_name ?? 'Someone'
        }
        const preview = content.length > 200 ? content.slice(0, 200) + '…' : content
        sendEmail({
          type: 'new_comment',
          userId: postData.user_id,
          payload: { commenterName, preview, postId: id },
        }).catch(() => {})

        // Push notification (fire-and-forget)
        sendPushNotification({
          userId: postData.user_id,
          title: 'New comment on your post',
          message: `${commenterName}: "${preview}"`,
          url: `/feed/${id}`,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true, comment })
  } catch (err) {
    console.error('POST comment error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
