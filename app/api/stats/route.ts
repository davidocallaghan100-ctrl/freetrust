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
    const [
      profilesRes,
      profilesWeekRes,
      profilesMonthRes,
      listingsServicesRes,
      listingsProductsRes,
      eventsRes,
      articlesRes,
      communitiesRes,
      trustSumRes,
      trustWeekRes,
      recentProfilesRes,
      recentTrustRes,
      recentArticlesRes,
      // Growth data - profiles by day for last 14 days
      growthRes,
    ] = await Promise.allSettled([
      // Total members
      supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      // Members this week
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo).is('deleted_at', null),
      // Members this month
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo).is('deleted_at', null),
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
      // Total trust issued (sum lifetime balances across all users)
      supabase.from('trust_balances').select('lifetime'),
      // Trust this week — use balances updated this week as proxy
      supabase.from('trust_balances').select('lifetime').gte('updated_at', weekAgo),
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
    const servicesListed = getCount(listingsServicesRes)
    const productsListed = getCount(listingsProductsRes)
    const upcomingEvents = getCount(eventsRes)
    const articlesPublished = getCount(articlesRes)
    const communitiesCount = getCount(communitiesRes)

    // Sum trust from lifetime balances
    const trustRows = getData<{ lifetime: number }>(trustSumRes)
    const totalTrust = trustRows.reduce((sum, r) => sum + (r.lifetime ?? 0), 0)

    const trustWeekRows = getData<{ lifetime: number }>(trustWeekRes)
    const trustThisWeek = trustWeekRows.reduce((sum, r) => sum + (r.lifetime ?? 0), 0)

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
      trust: { total: totalTrust, thisWeek: trustThisWeek },
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
      trust: { total: 0, thisWeek: 0 },
      ticker: [],
      growth: [],
      foundingGoal: 1000,
    }, { status: 200 })
  }
}
