export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — returns { following: [...], followers: [...], followingIds: string[] }
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const [followingRes, followersRes] = await Promise.all([
      admin
        .from('user_follows')
        .select('following_id, profiles!following_id(id, full_name, avatar_url, username, bio, location, follower_count, following_count, trust_balance)')
        .eq('follower_id', user.id),
      admin
        .from('user_follows')
        .select('follower_id, profiles!follower_id(id, full_name, avatar_url, username, bio, location, follower_count, following_count, trust_balance)')
        .eq('following_id', user.id),
    ])

    const following = (followingRes.data ?? []).map((r: Record<string, unknown>) => r.profiles).filter(Boolean)
    const followers = (followersRes.data ?? []).map((r: Record<string, unknown>) => r.profiles).filter(Boolean)
    const followingIds = (following as Array<{ id: string }>).map((p) => p.id)

    return NextResponse.json({ following, followers, followingIds })
  } catch (err) {
    console.error('[GET /api/connections]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — follow a user { targetUserId }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { targetUserId } = await req.json() as { targetUserId?: string }
    if (!targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
    if (targetUserId === user.id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

    const admin = createAdminClient()

    const { error } = await admin
      .from('user_follows')
      .insert({ follower_id: user.id, following_id: targetUserId })

    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Recalculate counts
    const [myFollowingCount, theirFollowerCount] = await Promise.all([
      admin.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
      admin.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', targetUserId),
    ])

    await Promise.allSettled([
      admin.from('profiles').update({ following_count: myFollowingCount.count ?? 0 }).eq('id', user.id),
      admin.from('profiles').update({ follower_count: theirFollowerCount.count ?? 0 }).eq('id', targetUserId),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/connections]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — unfollow a user { targetUserId }
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { targetUserId } = await req.json() as { targetUserId?: string }
    if (!targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })

    const admin = createAdminClient()

    await admin
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)

    // Recalculate counts
    const [myFollowingCount, theirFollowerCount] = await Promise.all([
      admin.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
      admin.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', targetUserId),
    ])

    await Promise.allSettled([
      admin.from('profiles').update({ following_count: myFollowingCount.count ?? 0 }).eq('id', user.id),
      admin.from('profiles').update({ follower_count: theirFollowerCount.count ?? 0 }).eq('id', targetUserId),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/connections]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
