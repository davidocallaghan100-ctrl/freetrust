export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function sinceDate(range: string): string {
  if (range === 'today') {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  if (range === '7d') return new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10) + 'T00:00:00.000Z'
  if (range === '30d') return new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10) + 'T00:00:00.000Z'
  return '2000-01-01T00:00:00.000Z' // all time
}

function dayKey(iso: string) { return iso.slice(0, 10) }

function buildDailySeries(rows: { created_at: string }[], since: string, range: string) {
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const k = dayKey(r.created_at)
    counts[k] = (counts[k] ?? 0) + 1
  }
  // Build full date range array so gaps show as 0
  const days: { date: string; count: number }[] = []
  const sinceDay = since.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  if (range === 'today') {
    days.push({ date: today, count: counts[today] ?? 0 })
  } else {
    const numDays = range === '7d' ? 7 : 30
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      if (d >= sinceDay) days.push({ date: d, count: counts[d] ?? 0 })
    }
  }
  return days
}

export async function GET(req: NextRequest) {
  try {
    // 1. Auth — must be admin
    const supabase = await createServerClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Service-role client for full data access
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createServiceClient(serviceUrl, serviceKey)

    // 3. Date range
    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') ?? 'all'
    const since = sinceDate(range)

    // ── Parallel fetch everything ──────────────────────────────────────────
    const [
      allMembersRes, newMembersRes, listingsRes, communitiesRes, articlesRes,
      ordersRes, feedPostsRes, feedCommentsRes, followsRes, gigsRes, eventsRes,
      noAvatarRes, noBioRes, noLocationRes,
    ] = await Promise.allSettled([
      admin.from('profiles').select('id, created_at, role').order('created_at', { ascending: true }),
      admin.from('profiles').select('id, created_at').gte('created_at', since).order('created_at', { ascending: true }),
      admin.from('listings').select('id, title, views, status, product_type, price, created_at').order('views', { ascending: false }),
      admin.from('communities').select('id, name, member_count, created_at'),
      admin.from('articles').select('id, title, clap_count, comment_count, status, author_id, created_at').eq('status', 'published'),
      admin.from('orders').select('id, buyer_id, seller_id, total_amount, status, created_at').order('created_at', { ascending: false }),
      admin.from('feed_posts').select('id, user_id, type, created_at').gte('created_at', since).order('created_at', { ascending: true }),
      admin.from('feed_comments').select('id, post_id, user_id, created_at').gte('created_at', since).order('created_at', { ascending: true }),
      admin.from('user_follows').select('follower_id, following_id, created_at').gte('created_at', since).order('created_at', { ascending: true }),
      admin.from('gigs').select('id, status, created_at'),
      admin.from('events').select('id, status, created_at'),
      admin.from('profiles').select('id', { count: 'exact', head: true }).is('avatar_url', null),
      admin.from('profiles').select('id', { count: 'exact', head: true }).is('bio', null),
      admin.from('profiles').select('id', { count: 'exact', head: true }).is('location', null),
    ])

    const allMembers  = allMembersRes.status  === 'fulfilled' ? (allMembersRes.value.data  ?? []) : []
    const newMembers  = newMembersRes.status  === 'fulfilled' ? (newMembersRes.value.data  ?? []) : []
    const listings    = listingsRes.status    === 'fulfilled' ? (listingsRes.value.data    ?? []) : []
    const communities = communitiesRes.status === 'fulfilled' ? (communitiesRes.value.data ?? []) : []
    const articles    = articlesRes.status    === 'fulfilled' ? (articlesRes.value.data    ?? []) : []
    const orders      = ordersRes.status      === 'fulfilled' ? (ordersRes.value.data      ?? []) : []
    const feedPosts   = feedPostsRes.status   === 'fulfilled' ? (feedPostsRes.value.data   ?? []) : []
    const feedComments= feedCommentsRes.status=== 'fulfilled' ? (feedCommentsRes.value.data?? []) : []
    const follows     = followsRes.status     === 'fulfilled' ? (followsRes.value.data     ?? []) : []
    const gigs        = gigsRes.status        === 'fulfilled' ? (gigsRes.value.data        ?? []) : []
    const events      = eventsRes.status      === 'fulfilled' ? (eventsRes.value.data      ?? []) : []
    const noAvatarCount   = noAvatarRes.status   === 'fulfilled' ? (noAvatarRes.value.count   ?? 0) : 0
    const noBioCount      = noBioRes.status      === 'fulfilled' ? (noBioRes.value.count      ?? 0) : 0
    const noLocationCount = noLocationRes.status === 'fulfilled' ? (noLocationRes.value.count ?? 0) : 0

    // ── Member stats ───────────────────────────────────────────────────────
    const roleCounts: Record<string, number> = {}
    for (const m of allMembers) {
      roleCounts[m.role ?? 'member'] = (roleCounts[m.role ?? 'member'] ?? 0) + 1
    }

    // All-time member growth (full history for all-time, or range daily series)
    const memberGrowth: Record<string, number> = {}
    for (const m of allMembers) {
      const day = dayKey(m.created_at)
      memberGrowth[day] = (memberGrowth[day] ?? 0) + 1
    }
    const dailySignups = buildDailySeries(newMembers, since, range)

    // ── Listing stats ──────────────────────────────────────────────────────
    const activeListings  = listings.filter(l => l.status === 'active').length
    const totalListingViews = listings.reduce((s, l) => s + (l.views ?? 0), 0)
    const topListings = listings.slice(0, 10).map(l => ({
      id: l.id, title: l.title, views: l.views ?? 0,
      status: l.status, product_type: l.product_type, price: l.price,
    }))

    // ── Order / revenue stats ──────────────────────────────────────────────
    const ordersInRange   = orders.filter(o => o.created_at >= since)
    const completedAll    = orders.filter(o => o.status === 'completed')
    const completedInRange = ordersInRange.filter(o => o.status === 'completed')
    const totalRevenue    = completedAll.reduce((s, o) => s + (o.total_amount ?? 0), 0)
    const revenueInRange  = completedInRange.reduce((s, o) => s + (o.total_amount ?? 0), 0)

    // ── Article stats ──────────────────────────────────────────────────────
    const totalClaps          = articles.reduce((s, a) => s + (a.clap_count ?? 0), 0)
    const totalArticleComments = articles.reduce((s, a) => s + (a.comment_count ?? 0), 0)

    // ── Daily activity series ──────────────────────────────────────────────
    const dailyPosts    = buildDailySeries(feedPosts,    since, range)
    const dailyComments = buildDailySeries(feedComments, since, range)
    const dailyFollows  = buildDailySeries(follows,      since, range)

    // ── Most active members in range (by posts + comments) ─────────────────
    const activityMap: Record<string, { posts: number; comments: number; follows: number }> = {}
    for (const p of feedPosts) {
      if (!activityMap[p.user_id]) activityMap[p.user_id] = { posts: 0, comments: 0, follows: 0 }
      activityMap[p.user_id].posts++
    }
    for (const c of feedComments) {
      if (!activityMap[c.user_id]) activityMap[c.user_id] = { posts: 0, comments: 0, follows: 0 }
      activityMap[c.user_id].comments++
    }
    for (const f of follows) {
      if (!activityMap[f.follower_id]) activityMap[f.follower_id] = { posts: 0, comments: 0, follows: 0 }
      activityMap[f.follower_id].follows++
    }

    const topUserIds = Object.entries(activityMap)
      .sort((a, b) => (b[1].posts + b[1].comments) - (a[1].posts + a[1].comments))
      .slice(0, 10)
      .map(([id]) => id)

    let mostActiveMembers: { id: string; full_name: string | null; avatar_url: string | null; posts: number; comments: number; follows: number }[] = []
    if (topUserIds.length > 0) {
      const { data: activeProfiles } = await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', topUserIds)
      mostActiveMembers = (activeProfiles ?? []).map(p => ({
        ...p,
        ...(activityMap[p.id] ?? { posts: 0, comments: 0, follows: 0 }),
      })).sort((a, b) => (b.posts + b.comments) - (a.posts + a.comments))
    }

    // ── Post type breakdown in range ────────────────────────────────────────
    const postTypeBreakdown: Record<string, number> = {}
    for (const p of feedPosts) {
      postTypeBreakdown[p.type] = (postTypeBreakdown[p.type] ?? 0) + 1
    }

    return NextResponse.json({
      range,
      summary: {
        // All-time
        totalMembers: allMembers.length,
        activeListings,
        totalListingViews,
        totalOrders: orders.length,
        completedOrders: completedAll.length,
        totalRevenue,
        totalCommunities: communities.length,
        totalArticles: articles.length,
        totalClaps,
        totalArticleComments,
        totalGigs: gigs.length,
        totalEvents: events.length,
        // In-range
        newSignups: newMembers.length,
        newPosts: feedPosts.length,
        newComments: feedComments.length,
        newFollows: follows.length,
        newOrders: ordersInRange.length,
        revenueInRange,
        // Profile completeness (all-time)
        noAvatarCount,
        noBioCount,
        noLocationCount,
      },
      roleCounts,
      memberGrowth,
      dailySignups,
      dailyPosts,
      dailyComments,
      dailyFollows,
      mostActiveMembers,
      topListings,
      postTypeBreakdown,
    })
  } catch (err) {
    console.error('[admin/analytics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
