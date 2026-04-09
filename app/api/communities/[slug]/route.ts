export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/communities/[slug] — get a single community by slug
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const { data: community, error } = await supabase
      .from('communities')
      .select('*, owner:profiles!owner_id(id, full_name, avatar_url)')
      .eq('slug', slug)
      .eq('is_archived', false)
      .single()

    if (error || !community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 })
    }

    // Check if current user is a member
    const { data: { user } } = await supabase.auth.getUser()
    let membership = null
    if (user) {
      const { data } = await supabase
        .from('community_members')
        .select('role, tier, joined_at')
        .eq('community_id', community.id)
        .eq('user_id', user.id)
        .maybeSingle()
      membership = data
    }

    return NextResponse.json({ community, membership, userId: user?.id ?? null })
  } catch (err) {
    console.error('[GET /api/communities/[slug]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
