import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createClient()

    const now = new Date().toISOString()
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Run all queries in parallel
    //
    // Trust figures come from a single SQL aggregate RPC (`trust_stats`
    // in 20260415000007_trust_stats_rpc.sql) — NOT from two separate
    // JS-summed selects like the old implementation used. The old
    // approach had two compounding bugs:
    //
    //   1. Supabase's default 1000-row response limit silently
    //      truncated the .select('balance') / .select('lifetime')
    //      queries at any scale beyond that, so the two JS sums
    //      were computed against different row subsets and could
    //      return contradictory totals (e.g. circulation > issued).
    //
    //   2. Summing two independent columns on the same table had no
    //      way to enforce the mathematical invariant that
    //      circulation <= issued. The RPC now clamps
    //      total_issued = GREATEST(gross_issued, circulation) so the
    //      invariant holds even if the two source tables disagree.
    //
    // The RPC filters out transfer_* ledger types from the issued
    // total so internal wallet transfers (which are zero-sum for
    // platform-wide supply) are not double-counted.
    const [
      profilesRes,
      profilesWeekRes,
      profilesMonthRes,
      listingsServicesRes,
      listingsProductsRes,
      eventsRes,
      articlesRes,
      communitiesRes,
      trustStatsRes,
      trustWeekRes,
      recentProfilesRes,
      recentTrustRes,
      recentArticlesRes,
      // Growth data - profiles by day for last 14 days
      growthRes,
    ] = await Promise.allSettled([
      // Total members
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      // Members this week
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      // Members this month
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
      // Services listed (from listings table)
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('product_type', 'service').eq('status', 'active'),
      // Products listed (from listings table) — physical/digital/everything non-service
      supabase.from('listings').select('id', { count: 'exact', head: true }).neq('product_type', 'service').eq('status', 'active'),
      // Upcoming events
      supabase.from('community_events').select('id', { count: 'exact', head: true }).gte('starts_at', now),
      // Published articles
      supabase.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      // Communities
      supabase.from('communities').select('id', { count: 'exact', head: true }),
      // Trust stats (total_issued + in_circulation + members_holding)
      // from the authoritative SQL aggregate. Single source of truth.
      supabase.rpc('trust_stats'),
      // Trust this week — use the trust_ledger directly so the week
      // figure is computed from the same authoritative source as the
      // total. Summed over positive ledger entries in the last 7 days,
      // excluding transfer_* types to match the RPC's filter.
      supabase
        .from('trust_ledger')
        .select('amount, type, created_at')
        .gte('created_at', weekAgo)
        .gt('amount', 0)
        .limit(10000),
      // Recent member joins (for ticker)
      supabase.from('profiles').select('id, full_name, location, created_at').order('created_at', { ascending: false }).limit(10),
      // Recent trust events — pull from the ledger directly so the
      // ticker reflects real mint events, not stale balance row
      // updated_at timestamps. Include the description so the ticker
      // can show a meaningful label instead of a generic "trust earned".
      supabase
        .from('trust_ledger')
        .select('id, user_id, amount, type, description, created_at')
        .gt('amount', 0)
        .order('created_at', { ascending: false })
        .limit(10),
      // Recent articles (for ticker)
      supabase.from('articles').select('id, title, created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(5),
      // Growth: last 30 profiles with created_at for sparkline
      supabase.from('profiles').select('created_at').order('created_at', { ascending: true }).limit(200),
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
    const servicesListed = getCount(listingsServicesRes)
    const productsListed = getCount(listingsProductsRes)
    const upcomingEvents = getCount(eventsRes)
    const articlesPublished = getCount(articlesRes)
    const communitiesCount = getCount(communitiesRes)

    // ── Trust stats from the authoritative RPC ──────────────────────────────
    // trust_stats() returns a single JSONB object:
    //   { total_issued, in_circulation, ledger_net, ledger_entries,
    //     members_holding, computed_at }
    //
    // Defensive fallback: if the RPC is missing (fresh DB that hasn't
    // run the 20260415000007 migration yet) we degrade to zero rather
    // than crashing the endpoint — the old JS-summed path is NOT
    // restored because its 1000-row truncation and column-drift bugs
    // are exactly what we're fixing.
    //
    // Invariant clamp — GREATEST enforcement happens SQL-side in the
    // RPC, but we also clamp in JS as a belt-and-braces so any future
    // RPC regression can't leak a circulation > total number to the
    // homepage. The UI cannot display the bug again.
    interface TrustStatsPayload {
      total_issued?: number | string
      in_circulation?: number | string
      ledger_net?: number | string
      ledger_entries?: number | string
      members_holding?: number | string
    }
    const trustStatsPayload: TrustStatsPayload | null =
      trustStatsRes.status === 'fulfilled' && !trustStatsRes.value.error
        ? (trustStatsRes.value.data as TrustStatsPayload | null)
        : null

    if (trustStatsRes.status === 'fulfilled' && trustStatsRes.value.error) {
      console.error('[GET /api/stats] trust_stats RPC failed:', trustStatsRes.value.error.message)
    }

    const rawIssued      = Number(trustStatsPayload?.total_issued    ?? 0)
    const rawCirculation = Number(trustStatsPayload?.in_circulation  ?? 0)
    const totalTrust         = Math.max(rawIssued, rawCirculation)
    const trustInCirculation = Math.min(rawCirculation, totalTrust)
    const membersHoldingTrust = Number(trustStatsPayload?.members_holding ?? 0)

    // Trust this week — sum of positive ledger entries in the last
    // 7 days (excluding transfer types which are zero-sum internal
    // movements). Matches the type filter used by trust_stats().
    interface LedgerRow { amount: number; type: string; created_at: string }
    const trustWeekRows = getData<LedgerRow>(trustWeekRes)
    const trustThisWeek = trustWeekRows
      .filter(r => r.type !== 'transfer_received' && r.type !== 'transfer_sent' && r.type !== 'transfer_rollback')
      .reduce((sum, r) => sum + (r.amount ?? 0), 0)

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

    // Recent trust events — pulled directly from trust_ledger so the
    // ticker reflects real mint events with proper timestamps instead
    // of stale trust_balances.updated_at values. Each ledger row has
    // amount + type + description + created_at.
    interface RecentLedgerRow {
      id: string
      user_id: string
      amount: number
      type: string
      description: string | null
      created_at: string
    }
    const recentTrust = getData<RecentLedgerRow>(recentTrustRes)
    for (const t of recentTrust) {
      const desc = t.description?.trim() || `₮${t.amount} trust earned`
      ticker.push({
        id: t.id,
        type: 'trust',
        text: `₮${t.amount} — ${desc}`,
        time: t.created_at,
      })
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
      trust: { total: totalTrust, thisWeek: trustThisWeek, inCirculation: trustInCirculation, membersHolding: membersHoldingTrust },
      ticker: tickerFeed,
      growth: growthChart,
      foundingGoal: 1000,
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (err) {
    console.error('[GET /api/stats]', err)
    return NextResponse.json({
      members: { total: 0, thisWeek: 0, thisMonth: 0 },
      listings: { services: 0, products: 0 },
      events: { upcoming: 0 },
      articles: { published: 0 },
      communities: { total: 0 },
      trust: { total: 0, thisWeek: 0, inCirculation: 0, membersHolding: 0 },
      ticker: [],
      growth: [],
      foundingGoal: 1000,
    }, { status: 200 })
  }
}
