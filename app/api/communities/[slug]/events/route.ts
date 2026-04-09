export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/communities/[slug]/events — list events
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const { data: community } = await supabase
      .from('communities')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!community) return NextResponse.json({ error: 'Community not found' }, { status: 404 })

    const { data: events, error } = await supabase
      .from('community_events')
      .select('*')
      .eq('community_id', community.id)
      .order('starts_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ events: events ?? [] })
  } catch (err) {
    console.error('[GET /events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/communities/[slug]/events — create event (owner/mod only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: community } = await supabase
      .from('communities')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!community) return NextResponse.json({ error: 'Community not found' }, { status: 404 })

    // Check owner or moderator
    const { data: membership } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', community.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership || !['owner', 'moderator'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and moderators can create events.' }, { status: 403 })
    }

    const body = await request.json() as {
      title?: string
      description?: string
      starts_at?: string
      ends_at?: string
      is_online?: boolean
      meeting_url?: string
    }

    if (!body.title?.trim() || !body.starts_at || !body.ends_at) {
      return NextResponse.json({ error: 'Title, starts_at, and ends_at are required.' }, { status: 400 })
    }

    const { data: event, error: insertError } = await supabase
      .from('community_events')
      .insert({
        community_id: community.id,
        title: body.title.trim(),
        description: body.description?.trim() ?? '',
        starts_at: body.starts_at,
        ends_at: body.ends_at,
        is_online: body.is_online ?? true,
        meeting_url: body.meeting_url ?? null,
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ event }, { status: 201 })
  } catch (err) {
    console.error('[POST /events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
