import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/communities/[slug]/members
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const { data: community, error: commErr } = await supabase
      .from('communities')
      .select('id')
      .eq('slug', slug)
      .single()

    if (commErr || !community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 })
    }

    const { data: members, error } = await supabase
      .from('community_members')
      .select('id, user_id, role, tier, joined_at, profile:profiles!user_id(full_name, avatar_url, username)')
      .eq('community_id', community.id)
      .order('joined_at', { ascending: true })
      .limit(50)

    if (error) {
      console.error('[GET /api/communities/[slug]/members]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ members: members ?? [] })
  } catch (err) {
    console.error('[GET /api/communities/[slug]/members]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
