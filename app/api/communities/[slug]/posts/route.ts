import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/communities/[slug]/posts — list posts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const { data: community, error: commErr } = await supabase
      .from('communities')
      .select('id, is_paid')
      .eq('slug', slug)
      .single()

    if (commErr || !community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 })
    }

    const { data: posts, error } = await supabase
      .from('community_posts')
      .select('*, author:profiles!author_id(id, full_name, avatar_url)')
      .eq('community_id', community.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /posts]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ posts: posts ?? [] })
  } catch (err) {
    console.error('[GET /api/communities/[slug]/posts]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/communities/[slug]/posts — create post (member only)
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

    const { data: community, error: commErr } = await supabase
      .from('communities')
      .select('id')
      .eq('slug', slug)
      .single()

    if (commErr || !community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 })
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('community_members')
      .select('id')
      .eq('community_id', community.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'You must be a member to post.' }, { status: 403 })
    }

    const body = await request.json() as {
      title?: string
      body?: string
      type?: string
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Post title is required.' }, { status: 400 })
    }

    const validTypes = ['discussion', 'announcement', 'question']
    const postType = validTypes.includes(body.type ?? '') ? body.type : 'discussion'

    const { data: post, error: insertError } = await supabase
      .from('community_posts')
      .insert({
        community_id: community.id,
        author_id: user.id,
        title: body.title.trim(),
        body: body.body?.trim() ?? '',
        type: postType,
      })
      .select('*, author:profiles!author_id(id, full_name, avatar_url)')
      .single()

    if (insertError) {
      console.error('[POST /posts]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/communities/[slug]/posts]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
