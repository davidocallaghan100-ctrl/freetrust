export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const urlUserId = req.nextUrl.searchParams.get('userId')
    const targetId = urlUserId ?? user?.id

    if (!targetId) {
      return NextResponse.json({ error: 'No user' }, { status: 401 })
    }

    // ── Stats from profile ────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('follower_count, following_count, trust_balance, created_at')
      .eq('id', targetId)
      .maybeSingle()

    // ── Recent posts ─────────────────────────────────────────────────────────
    let recentPosts: { id: string; content: string | null; created_at: string; likes_count: number }[] = []
    try {
      const { data } = await supabase
        .from('feed_posts')
        .select('id, content, created_at, likes_count')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false })
        .limit(6)
      recentPosts = data ?? []
    } catch { /* table may not exist */ }

    // ── Active listings ───────────────────────────────────────────────────────
    let activeListings: { id: string; title: string; price: number | null; status: string }[] = []
    try {
      const { data } = await supabase
        .from('listings')
        .select('id, title, price, status')
        .eq('seller_id', targetId)
        .eq('status', 'active')
        .limit(6)
      activeListings = data ?? []
    } catch { /* table may not exist */ }

    // ── Total listing count ───────────────────────────────────────────────────
    let totalListings = 0
    try {
      const { count } = await supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', targetId)
      totalListings = count ?? 0
    } catch { /* skip */ }

    // ── Hosted/attended events ────────────────────────────────────────────────
    let hostedEvents: { id: string; title: string; starts_at: string | null; attendee_count: number }[] = []
    try {
      const { data } = await supabase
        .from('community_events')
        .select('id, title, starts_at, attendee_count, community_id')
        .order('starts_at', { ascending: false })
        .limit(6)
      hostedEvents = (data ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        starts_at: e.starts_at,
        attendee_count: e.attendee_count ?? 0,
      }))
    } catch { /* skip */ }

    // ── Joined communities ────────────────────────────────────────────────────
    let joinedCommunities: { id: string; name: string; member_count: number; role: string }[] = []
    try {
      const { data } = await supabase
        .from('community_members')
        .select('role, community_id, communities(id, name, member_count)')
        .eq('user_id', targetId)
        .limit(6)
      joinedCommunities = (data ?? []).map((m: any) => ({
        id: m.communities?.id ?? m.community_id,
        name: m.communities?.name ?? 'Community',
        member_count: m.communities?.member_count ?? 0,
        role: m.role ?? 'member',
      }))
    } catch { /* skip */ }

    // ── Recent reviews received ───────────────────────────────────────────────
    let recentReviews: { id: string; rating: number; comment: string | null; reviewer_name: string; created_at: string }[] = []
    try {
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, reviewer_id, profiles!reviews_reviewer_id_fkey(full_name, email)')
        .eq('reviewee_id', targetId)
        .order('created_at', { ascending: false })
        .limit(5)
      recentReviews = (data ?? []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reviewer_name: r.profiles?.full_name ?? r.profiles?.email ?? 'Anonymous',
        created_at: r.created_at,
      }))
    } catch { /* table may not exist */ }

    // ── Trust milestones ──────────────────────────────────────────────────────
    let trustMilestones: { amount: number; description: string | null; created_at: string }[] = []
    try {
      const { data } = await supabase
        .from('trust_ledger')
        .select('amount, description, created_at')
        .eq('user_id', targetId)
        .gt('amount', 0)
        .order('created_at', { ascending: false })
        .limit(5)
      trustMilestones = data ?? []
    } catch { /* skip */ }

    // ── Total posts count ─────────────────────────────────────────────────────
    let totalPosts = 0
    try {
      const { count } = await supabase
        .from('feed_posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetId)
      totalPosts = count ?? 0
    } catch { /* skip */ }

    return NextResponse.json({
      recentPosts,
      activeListings,
      hostedEvents,
      joinedCommunities,
      recentReviews,
      trustMilestones,
      stats: {
        followerCount: profile?.follower_count ?? 0,
        followingCount: profile?.following_count ?? 0,
        trustBalance: profile?.trust_balance ?? 0,
        memberSince: profile?.created_at ?? '',
        totalPosts,
        totalListings,
      },
    })
  } catch (err) {
    console.error('[profile/activity] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
