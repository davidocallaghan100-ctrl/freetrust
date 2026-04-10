export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Admin-only analytics endpoint — uses service role key to bypass RLS
export async function GET() {
  try {
    // 1. Verify the requesting user is an admin (using cookie-based client)
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

    // 2. Use service role client for full data access
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createServiceClient(serviceUrl, serviceKey)

    // ── Parallel fetch all analytics data ──────────────────────────────
    const [
      membersRes,
      listingsRes,
      communitiesRes,
      articlesRes,
      trustLedgerRes,
      ordersRes,
      profilesRes,
    ] = await Promise.allSettled([
      admin.from('profiles').select('id, created_at, role').order('created_at', { ascending: true }),
      admin.from('listings').select('id, title, views, status, product_type, price, seller_id, created_at').order('views', { ascending: false }),
      admin.from('communities').select('id, name, member_count, created_at'),
      admin.from('articles').select('id, title, clap_count, comment_count, status, author_id, created_at').eq('status', 'published'),
      admin.from('trust_ledger').select('id, user_id, amount, type, description, created_at').order('created_at', { ascending: false }).limit(50),
      admin.from('orders').select('id, buyer_id, seller_id, total_amount, status, created_at').order('created_at', { ascending: false }),
      admin.from('profiles').select('id, full_name, email, role, trust_balance, created_at').order('created_at', { ascending: true }),
    ])

    const members = membersRes.status === 'fulfilled' ? (membersRes.value.data ?? []) : []
    const listings = listingsRes.status === 'fulfilled' ? (listingsRes.value.data ?? []) : []
    const communities = communitiesRes.status === 'fulfilled' ? (communitiesRes.value.data ?? []) : []
    const articles = articlesRes.status === 'fulfilled' ? (articlesRes.value.data ?? []) : []
    const trustLedger = trustLedgerRes.status === 'fulfilled' ? (trustLedgerRes.value.data ?? []) : []
    const orders = ordersRes.status === 'fulfilled' ? (ordersRes.value.data ?? []) : []
    const profiles = profilesRes.status === 'fulfilled' ? (profilesRes.value.data ?? []) : []

    // ── Member growth by day ────────────────────────────────────────────
    const memberGrowth: Record<string, number> = {}
    for (const m of members) {
      const day = m.created_at?.slice(0, 10)
      if (day) memberGrowth[day] = (memberGrowth[day] ?? 0) + 1
    }

    // ── Trust economy summary ───────────────────────────────────────────
    const trustByType: Record<string, number> = {}
    let totalTrustIssued = 0
    for (const row of trustLedger) {
      trustByType[row.type] = (trustByType[row.type] ?? 0) + (row.amount ?? 0)
      if ((row.amount ?? 0) > 0) totalTrustIssued += row.amount
    }

    // ── Listing stats ───────────────────────────────────────────────────
    const activeListings = listings.filter(l => l.status === 'active').length
    const totalListingViews = listings.reduce((s, l) => s + (l.views ?? 0), 0)
    const topListings = listings.slice(0, 10).map(l => ({
      id: l.id,
      title: l.title,
      views: l.views ?? 0,
      status: l.status,
      product_type: l.product_type,
      price: l.price,
    }))

    // ── Order stats ─────────────────────────────────────────────────────
    const completedOrders = orders.filter(o => o.status === 'completed')
    const totalRevenue = completedOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)

    // ── Article stats ───────────────────────────────────────────────────
    const totalClaps = articles.reduce((s, a) => s + (a.clap_count ?? 0), 0)
    const totalArticleComments = articles.reduce((s, a) => s + (a.comment_count ?? 0), 0)

    // ── Role breakdown ──────────────────────────────────────────────────
    const roleCounts: Record<string, number> = {}
    for (const m of members) {
      roleCounts[m.role ?? 'unknown'] = (roleCounts[m.role ?? 'unknown'] ?? 0) + 1
    }

    return NextResponse.json({
      summary: {
        totalMembers: members.length,
        activeListings,
        totalListingViews,
        totalTrustIssued,
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        totalRevenue,
        totalCommunities: communities.length,
        totalArticles: articles.length,
        totalClaps,
        totalArticleComments,
      },
      memberGrowth,
      roleCounts,
      trustByType,
      topListings,
      recentLedger: trustLedger.slice(0, 20),
      profiles: profiles.slice(0, 100),
    })
  } catch (err) {
    console.error('[admin/analytics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
