export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const content = (body?.content ?? '').trim()
    const category = (body?.category ?? 'General').trim()
    // Optional: publish as an organisation. Same auth shape as the
    // /api/create/publish route — caller must be creator or have
    // owner/admin role in organisation_members for that org.
    const organisationId: string | null = typeof body?.organisation_id === 'string'
      ? body.organisation_id
      : null

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Post too long (max 2000 chars)' }, { status: 400 })
    }

    // Verify the caller can post as the requested org. The check
    // mirrors the full publish route: membership row first (canonical,
    // correct for all orgs post-migration), creator_id fallback for
    // dev environments that haven't run 20260414000001 yet.
    let postedAsOrganisationId: string | null = null
    if (organisationId) {
      const { data: membership } = await supabase
        .from('organisation_members')
        .select('role')
        .eq('organisation_id', organisationId)
        .eq('user_id', user.id)
        .maybeSingle()
      let authorised = membership?.role === 'owner' || membership?.role === 'admin'
      if (!authorised) {
        const { data: org } = await supabase
          .from('organisations')
          .select('creator_id')
          .eq('id', organisationId)
          .maybeSingle()
        authorised = org?.creator_id === user.id
      }
      if (!authorised) {
        console.warn('[feed/post] user', user.id, 'tried to post as org', organisationId, '— not authorised')
        return NextResponse.json(
          { error: 'You are not authorised to post as that organisation' },
          { status: 403 },
        )
      }
      postedAsOrganisationId = organisationId
    }

    const { data: post, error: insertError } = await supabase
      .from('feed_posts')
      .insert({
        author_id: user.id,
        content,
        category,
        // Display override — null for personal, set for "as org"
        posted_as_organisation_id: postedAsOrganisationId,
      })
      .select()
      .single()

    if (insertError) {
      console.error('feed_posts insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
    }

    return NextResponse.json({ success: true, post })
  } catch (err) {
    console.error('POST /api/feed/post error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
