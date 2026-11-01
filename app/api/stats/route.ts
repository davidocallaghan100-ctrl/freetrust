import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PUBLIC_TRUST_STATS_PAGE_SIZE = 500

type PublicTrustMetrics = {
  total: number | null
  thisWeek: number | null
  inCirculation: number | null
  membersHolding: number | null
  trustProfileIds: Set<string> | null
}

async function fetchActiveProfileIds(admin: ReturnType<typeof createAdminClient>) {
  const ids = new Set<string>()
  let lastId: string | null = null

  while (true) {
    let query = admin
      .from('profiles')
      .select('id')
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .limit(PUBLIC_TRUST_STATS_PAGE_SIZE)
    if (lastId) query = query.gt('id', lastId)

    const { data, error } = await query
    if (error) throw error
    const page = data ?? []
    for (const profile of page) ids.add(profile.id)
    if (page.length < PUBLIC_TRUST_STATS_PAGE_SIZE) break

    const nextId = page[page.length - 1]?.id
    if (!nextId || nextId === lastId) throw new Error('Could not advance active-profile pagination')
    lastId = nextId
  }

  return ids
}

async function fetchTrustBalanceRows(admin: ReturnType<typeof createAdminClient>) {
  const rows: Array<{ user_id: string; lifetime: number | null; balance: number | null }> = []
  let lastUserId: string | null = null

  while (true) {
    let query = admin
      .from('trust_balances')
      .select('user_id, lifetime, balance')
      .order('user_id', { ascending: true })
      .limit(PUBLIC_TRUST_STATS_PAGE_SIZE)
    if (lastUserId) query = query.gt('user_id', lastUserId)

    const { data, error } = await query
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < PUBLIC_TRUST_STATS_PAGE_SIZE) break

    const nextUserId = page[page.length - 1]?.user_id
    if (!nextUserId || nextUserId === lastUserId) throw new Error('Could not advance TrustCoin-balance pagination')
    lastUserId = nextUserId
  }

  return rows
}

async function fetchTestSeedProfileIds(admin: ReturnType<typeof createAdminClient>) {
  const ids = new Set<string>()
  let lastLedgerId: string | null = null

  while (true) {
    let query = admin
      .from('trust_ledger')
      .select('id, user_id')
      .eq('type', 'test_seed')
      .order('id', { ascending: true })
      .limit(PUBLIC_TRUST_STATS_PAGE_SIZE)
    if (lastLedgerId) query = query.gt('id', lastLedgerId)

    const { data, error } = await query
    if (error) throw error
    const page = data ?? []
    for (const entry of page) {
      if (entry.user_id) ids.add(entry.user_id)
    }
    if (page.length < PUBLIC_TRUST_STATS_PAGE_SIZE) break

    const nextId = page[page.length - 1]?.id
    if (!nextId || nextId === lastLedgerId) throw new Error('Could not advance test-seed ledger pagination')
    lastLedgerId = nextId
  }

  return ids
}

async function fetchPublicTrustMetrics(weekAgo: string): Promise<PublicTrustMetrics> {
  try {
    const admin = createAdminClient()
    const [activeProfileIds, trustBalanceRows, testSeedProfileIds] = await Promise.all([
      fetchActiveProfileIds(admin),
      fetchTrustBalanceRows(admin),
      fetchTestSeedProfileIds(admin),
    ])

    // Exclude an account's residual balance and lifetime totals from public
    // Trust Economy figures when it has an explicit test_seed ledger entry.
    // Keep the stored wallet and ledger untouched; public stats must not
    // present seeded TrustCoin as real member-earned supply.
    const trustProfileIds = new Set(
      Array.from(activeProfileIds).filter((id) => !testSeedProfileIds.has(id)),
    )

    let thisWeek: number | null = null
    try {
      const { data, error } = await admin.rpc('get_public_trust_earned_since', { p_since: weekAgo })
      if (error) throw error
      const total = Number(data)
      if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid weekly TrustCoin total')
      thisWeek = total
    } catch (error) {
      console.warn('[GET /api/stats] weekly TrustCoin total unavailable:', error)
    }

    const activeTrustRows = trustBalanceRows.filter((row) => trustProfileIds.has(row.user_id))
    const total = activeTrustRows.reduce((sum, row) => sum + Number(row.lifetime ?? 0), 0)
    const inCirculation = activeTrustRows.reduce((sum, row) => sum + Number(row.balance ?? 0), 0)
    if (!Number.isFinite(total) || !Number.isFinite(inCirculation)) {
      throw new Error('TrustCoin aggregate is not a finite number')
    }

    return {
      total,
      thisWeek,
      inCirculation,
      membersHolding: activeTrustRows.filter((row) => Number(row.balance ?? 0) > 0).length,
      trustProfileIds,
    }
  } catch (error) {
    console.warn('[GET /api/stats] public Trust Economy metrics unavailable:', error)
    return { total: null, thisWeek: null, inCirculation: null, membersHolding: null, trustProfileIds: null }
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const now = new Date().toISOString()
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const publicTrustMetricsPromise = fetchPublicTrustMetrics(weekAgo)

    // Run all queries in parallel
    const [
      profilesRes,
      profilesWeekRes,
      profilesMonthRes,
      listingsServicesRes,
      listingsProductsRes,
      externalServicesRes,
      externalProductsRes,
      eventsRes,
      articlesRes,
      communitiesRes,
      recentProfilesRes,
      recentTrustRes,
      recentArticlesRes,
      // Growth data - profiles by day for last 14 days
      growthRes,
    ] = await Promise.allSettled([
      // Total members
      supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      // Members this week
      supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', weekAgo),
      // Members this month
      supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', monthAgo),
      // Services listed (from listings table)
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('product_type', 'service').eq('status', 'active'),
      // Products listed (from listings table) — physical/digital/everything non-service
      supabase.from('listings').select('id', { count: 'exact', head: true }).neq('product_type', 'service').eq('status', 'active'),
      // External service providers available in the Services Marketplace
      supabase.from('external_service_listings').select('id', { count: 'exact', head: true }),
      // External retailer products available in the Product Marketplace
      supabase.from('external_product_listings').select('id', { count: 'exact', head: true }),
      // Upcoming events
      supabase.from('community_events').select('id', { count: 'exact', head: true }).gte('starts_at', now),
      // Published articles
      supabase.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      // Communities
      supabase.from('communities').select('id', { count: 'exact', head: true }),
      // Recent member joins (for ticker)
      supabase.from('profiles').select('id, full_name, location, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(10),
      // Recent trust events — pull from trust_balances (fallback: no ledger table)
      supabase.from('trust_balances').select('user_id, lifetime, updated_at').order('updated_at', { ascending: false }).limit(10),
      // Recent articles (for ticker)
      supabase.from('articles').select('id, title, created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(5),
      // Growth: last 30 profiles with created_at for sparkline
      supabase.from('profiles').select('created_at').is('deleted_at', null).order('created_at', { ascending: true }).limit(200),
    ])

    // Helper to safely get count
    const getCount = (res: typeof profilesRes) =>
      res.status === 'fulfilled' ? (res.value.count ?? 0) : 0

    // Helper to safely get data
    const getData = <T>(res: PromiseSettledResult<{ data: T[] | null }>): T[] =>
      res.status === 'fulfilled' ? (res.value.data ?? []) : []

    const totalMembers = getCount(profilesRes)
    const membersThisWeek = getCount(profilesWeekRes)
    const membersThisMonth = getCount(profilesMonthRes)
    const servicesListed = getCount(listingsServicesRes) + getCount(externalServicesRes)
    const productsListed = getCount(listingsProductsRes) + getCount(externalProductsRes)
    const upcomingEvents = getCount(eventsRes)
    const articlesPublished = getCount(articlesRes)
    const communitiesCount = getCount(communitiesRes)

    // These two public landing metrics use the same definitions as the
    // investor deck. The ledger and wallet tables are protected by RLS, so
    // use the server-only admin client here and keep the whole block optional
    // so a missing admin configuration never prevents the landing page from
    // rendering its other live stats.
    let aiAgentRuns = 0
    let walletTransactions = 0
    try {
      const admin = createAdminClient()
      const [agentLedgerRes, walletLedgerRes, depositsRes, transfersRes, ordersRes] = await Promise.all([
        admin.from('trust_ledger').select('type').neq('type', 'test_seed'),
        admin.from('trust_ledger').select('*', { count: 'exact', head: true }).neq('type', 'test_seed'),
        admin.from('money_deposits').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        admin.from('wallet_transfers').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        admin.from('orders').select('*', { count: 'exact', head: true }).in('status', ['completed', 'delivered']),
      ])

      if (!agentLedgerRes.error && agentLedgerRes.data) {
        aiAgentRuns = agentLedgerRes.data.filter(({ type }) => {
          const ledgerType = type ?? ''
          return ledgerType.startsWith('agent_') && !ledgerType.startsWith('agent_refund_')
        }).length
      }

      walletTransactions =
        (walletLedgerRes.count ?? 0) +
        (depositsRes.count ?? 0) +
        (transfersRes.count ?? 0) +
        (ordersRes.count ?? 0)
    } catch (err) {
      console.warn('[GET /api/stats] wallet/agent metrics unavailable:', err)
    }

    const publicTrustMetrics = await publicTrustMetricsPromise
    const isActiveTrustProfile = (userId: string) => publicTrustMetrics.trustProfileIds?.has(userId) ?? false

    // Ticker feed — mix of recent joins, trust events, articles
    type TickerItem = {
      id: string
      type: 'join' | 'trust' | 'article' | 'service'
      text: string
      time: string
    }
    const ticker: TickerItem[] = []

    const recentProfiles = getData<{ id: string; full_name: string | null; location: string | null; created_at: string }>(recentProfilesRes)
    for (const p of recentProfiles) {
      const name = p.full_name ? p.full_name.split(' ')[0] : 'Someone'
      const loc = p.location ? ` from ${p.location}` : ''
      ticker.push({ id: p.id, type: 'join', text: `${name}${loc} just joined FreeTrust`, time: p.created_at })
    }

    const recentTrust = getData<{ user_id: string; lifetime: number; updated_at: string }>(recentTrustRes)
    for (const t of recentTrust) {
      if (!isActiveTrustProfile(t.user_id)) continue
      ticker.push({ id: t.user_id, type: 'trust', text: `₮${t.lifetime} Trust earned by a member`, time: t.updated_at })
    }

    const recentArticles = getData<{ id: string; title: string; created_at: string }>(recentArticlesRes)
    for (const a of recentArticles) {
      ticker.push({ id: a.id, type: 'article', text: `New article published: "${a.title}"`, time: a.created_at })
    }

    // Sort ticker by time desc, take top 20
    ticker.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    const tickerFeed = ticker.slice(0, 20)

    // Growth sparkline — bucket by week
    const growthProfiles = getData<{ created_at: string }>(growthRes)
    type BucketEntry = { date: string; count: number; cumulative: number }
    const buckets: Record<string, number> = {}
    for (const p of growthProfiles) {
      const d = new Date(p.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      buckets[key] = (buckets[key] ?? 0) + 1
    }
    // Fill last 14 days
    const growthChart: BucketEntry[] = []
    let cumulative = Math.max(0, totalMembers - growthProfiles.length)
    const sortedKeys = Object.keys(buckets).sort()
    for (const key of sortedKeys) {
      cumulative += buckets[key]
      growthChart.push({ date: key, count: buckets[key], cumulative })
    }

    return NextResponse.json({
      members: { total: totalMembers, thisWeek: membersThisWeek, thisMonth: membersThisMonth },
      listings: { services: servicesListed, products: productsListed },
      events: { upcoming: upcomingEvents },
      articles: { published: articlesPublished },
      communities: { total: communitiesCount },
      trust: {
        total: publicTrustMetrics.total,
        thisWeek: publicTrustMetrics.thisWeek,
        inCirculation: publicTrustMetrics.inCirculation,
        membersHolding: publicTrustMetrics.membersHolding,
      },
      aiAgentRuns,
      walletTransactions,
      ticker: tickerFeed,
      growth: growthChart,
      foundingGoal: 1000,
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (err) {
    console.error('[GET /api/stats]', err)
    return NextResponse.json({ error: 'Public stats are temporarily unavailable' }, { status: 503 })
  }
}
