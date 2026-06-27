export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireFreeTrustAdmin } from '@/lib/admin/access'

type Row = Record<string, unknown>
type ChartPoint = { label: string; value: number }
type NamedCount = { name: string; count: number }

const DAY = 24 * 60 * 60 * 1000

function isoDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * DAY)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function dayKey(value: unknown): string {
  if (typeof value !== 'string') return 'Unknown'
  return value.slice(0, 10)
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function text(value: unknown, fallback = 'Unknown'): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function countBy(rows: Row[], key: string, fallback = 'Unknown'): NamedCount[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const name = text(row[key], fallback)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

function dailySeries(rows: Row[], days: number, dateField = 'created_at'): ChartPoint[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = dayKey(row[dateField])
    if (key !== 'Unknown') counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from({ length: days }).map((_, index) => {
    const offset = days - index - 1
    const key = new Date(Date.now() - offset * DAY).toISOString().slice(0, 10)
    return { label: key, value: counts.get(key) ?? 0 }
  })
}

function histogram(values: number[]): ChartPoint[] {
  const buckets = [
    { label: '0–20', min: 0, max: 20 },
    { label: '21–40', min: 21, max: 40 },
    { label: '41–60', min: 41, max: 60 },
    { label: '61–80', min: 61, max: 80 },
    { label: '81–100', min: 81, max: 100 },
  ]
  return buckets.map(bucket => ({
    label: bucket.label,
    value: values.filter(value => value >= bucket.min && value <= bucket.max).length,
  }))
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0
}

async function safeRows(table: string, select: string, options?: { since?: string; order?: string; ascending?: boolean; limit?: number }) {
  const admin = createAdminClient()
  let query = admin.from(table).select(select)
  if (options?.since) query = query.gte(options.order ?? 'created_at', options.since)
  if (options?.order) query = query.order(options.order, { ascending: options.ascending ?? false })
  query = query.limit(options?.limit ?? 10000)
  const { data, error } = await query
  return { rows: (data ?? []) as unknown as Row[], error: error?.message ?? null }
}

async function safeCount(table: string, idColumn = 'id') {
  const admin = createAdminClient()
  const { count, error } = await admin.from(table).select(idColumn, { count: 'exact', head: true })
  return { count: count ?? 0, error: error?.message ?? null }
}

export async function GET() {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response

  const queriedAt = new Date().toISOString()
  const since7 = isoDaysAgo(6)
  const since30 = isoDaysAgo(29)
  const since90 = isoDaysAgo(89)

  try {
    const [
      profilesRes,
      listingsRes,
      messagesRes,
      notificationsRes,
      campaignSendsRes,
      analyticsEventsRes,
      trustBalancesRes,
      trustLedgerRes,
      ordersRes,
      externalClicksRes,
      feedPostsRes,
      feedCommentsRes,
    ] = await Promise.all([
      safeRows('profiles', 'id,email,full_name,username,country,region,city,created_at,last_seen_at,is_verified,verification_status,trust_balance,avg_rating,notification_prefs,deleted_at', { order: 'created_at', ascending: true }),
      safeRows('listings', 'id,title,status,product_type,category,city,region,country,location,views,saves_count,created_at', { order: 'created_at' }),
      safeRows('messages', 'id,conversation_id,sender_id,status,created_at', { order: 'created_at' }),
      safeRows('notifications', 'id,user_id,type,read,created_at', { order: 'created_at' }),
      safeRows('campaign_sends', 'id,user_id,email,status,error,sent_at,created_at', { order: 'created_at' }),
      safeRows('analytics_events', 'id,user_id,actor_id,event_type,entity_type,created_at', { since: since90, order: 'created_at', ascending: true }),
      safeRows('trust_balances', 'user_id,balance,lifetime,updated_at', { order: 'updated_at' }),
      safeRows('trust_ledger', 'id,user_id,amount,type,description,created_at', { order: 'created_at' }),
      safeRows('orders', 'id,buyer_id,seller_id,amount,total_eur,freetrust_fee_eur,status,created_at', { order: 'created_at' }),
      safeRows('external_product_clicks', 'id,user_id,product_title,retailer_name,click_source,clicked_at', { order: 'clicked_at' }),
      safeRows('feed_posts', 'id,user_id,type,views_count,saves_count,created_at', { order: 'created_at' }),
      safeRows('feed_comments', 'id,user_id,post_id,created_at', { order: 'created_at' }),
    ])

    const profiles = profilesRes.rows.filter(row => !row.deleted_at)
    const listings = listingsRes.rows
    const messages = messagesRes.rows
    const notifications = notificationsRes.rows
    const campaignSends = campaignSendsRes.rows
    const analyticsEvents = analyticsEventsRes.rows
    const trustBalances = trustBalancesRes.rows
    const trustLedger = trustLedgerRes.rows
    const orders = ordersRes.rows
    const externalClicks = externalClicksRes.rows
    const feedPosts = feedPostsRes.rows
    const feedComments = feedCommentsRes.rows

    const profileMap = new Map(profiles.map(row => [String(row.id), row]))
    const newUsers7 = profiles.filter(row => String(row.created_at) >= since7).length
    const newUsers30 = profiles.filter(row => String(row.created_at) >= since30).length
    const verifiedUsers = profiles.filter(row => row.is_verified === true || row.verification_status === 'verified').length
    const usersWithTrustCoin = profiles.filter(row => num(row.trust_balance) > 0).length

    const activeListings = listings.filter(row => row.status === 'active')
    const newListings7 = listings.filter(row => String(row.created_at) >= since7).length
    const newListings30 = listings.filter(row => String(row.created_at) >= since30).length

    const messageSenders = new Set(messages.map(row => String(row.sender_id)).filter(Boolean))
    const conversations = countBy(messages, 'conversation_id', 'Unknown conversation').slice(0, 10)

    const campaignSent = campaignSends.filter(row => ['sent', 'delivered', 'success'].includes(text(row.status, '').toLowerCase())).length
    const campaignFailed = campaignSends.filter(row => ['failed', 'bounced', 'error'].includes(text(row.status, '').toLowerCase())).length
    const opt = profiles.reduce<{ enabled: number; disabled: number }>((acc, row) => {
      const prefs = asRecord(row.notification_prefs)
      const value = prefs.email ?? prefs.email_notifications ?? prefs.emailNotifications ?? prefs.marketing_emails ?? prefs.notifications_email
      const unsubscribed = prefs.unsubscribed === true || prefs.email_unsubscribed === true
      if (value === false || unsubscribed) acc.disabled += 1
      else acc.enabled += 1
      return acc
    }, { enabled: 0, disabled: 0 })

    const activeUserIds = (days: number) => new Set(
      analyticsEvents
        .filter(row => String(row.created_at) >= isoDaysAgo(days - 1))
        .map(row => String(row.user_id ?? row.actor_id ?? ''))
        .filter(Boolean)
    ).size

    const lastLoginBuckets = [
      { label: '24h', count: profiles.filter(row => String(row.last_seen_at ?? '') >= isoDaysAgo(0)).length },
      { label: '7d', count: profiles.filter(row => String(row.last_seen_at ?? '') >= since7).length },
      { label: '30d', count: profiles.filter(row => String(row.last_seen_at ?? '') >= since30).length },
      { label: '90d+', count: profiles.filter(row => !row.last_seen_at || String(row.last_seen_at) < since90).length },
    ]

    const trustCoinInCirculation = trustBalances.reduce((sum, row) => sum + num(row.balance), 0)
    const trustLedger30 = trustLedger.filter(row => String(row.created_at) >= since30)
    const trustTop = trustBalances
      .map(row => {
        const profile = profileMap.get(String(row.user_id))
        return {
          userId: String(row.user_id),
          name: text(profile?.full_name ?? profile?.username ?? profile?.email, 'Unknown user'),
          balance: num(row.balance),
          lifetime: num(row.lifetime),
        }
      })
      .sort((a, b) => b.lifetime - a.lifetime)
      .slice(0, 10)

    const tableCounts = await Promise.all([
      safeCount('profiles'), safeCount('listings'), safeCount('messages'), safeCount('notifications'),
      safeCount('analytics_events'), safeCount('trust_balances', 'user_id'), safeCount('trust_ledger'), safeCount('orders'),
    ])
    const majorTables = ['profiles', 'listings', 'messages', 'notifications', 'analytics_events', 'trust_balances', 'trust_ledger', 'orders']
      .map((table, index) => ({ table, ...tableCounts[index] }))

    const errors = [profilesRes, listingsRes, messagesRes, notificationsRes, campaignSendsRes, analyticsEventsRes, trustBalancesRes, trustLedgerRes, ordersRes, externalClicksRes, feedPostsRes, feedCommentsRes]
      .flatMap((result, index) => result.error ? [{ source: ['profiles', 'listings', 'messages', 'notifications', 'campaign_sends', 'analytics_events', 'trust_balances', 'trust_ledger', 'orders', 'external_product_clicks', 'feed_posts', 'feed_comments'][index], error: result.error }] : [])

    return NextResponse.json({
      queriedAt,
      adminEmail: auth.user.email,
      dataSource: {
        supabaseProjectRef: 'tioqakxnqjxyuzgnwhrb',
        emailTablesFound: {
          notifications: notificationsRes.error ? false : true,
          campaign_sends: campaignSendsRes.error ? false : true,
          email_logs: false,
          notification_logs: false,
        },
        emailDeliveryQuery: "from('campaign_sends').select('id,user_id,email,status,error,sent_at,created_at').order('created_at', { ascending: false })",
        errors,
      },
      website: {
        tokenConfigured: Boolean(process.env.VERCEL_ANALYTICS_TOKEN),
        dashboardUrl: 'https://vercel.com/dashboard',
        note: process.env.VERCEL_ANALYTICS_TOKEN
          ? 'Vercel Analytics token is configured; API wiring can be extended with the account/team endpoint once enabled.'
          : 'Vercel Analytics API token is not configured. Add VERCEL_ANALYTICS_TOKEN to surface Vercel Analytics API data here.',
        dailyPageViews: null,
        weeklyPageViews: null,
        monthlyPageViews: null,
        uniqueVisitors: null,
        topPages: [],
        bounceIndicators: [],
      },
      users: {
        total: profiles.length,
        new7: newUsers7,
        new30: newUsers30,
        byCountry: countBy(profiles, 'country', 'Not set'),
        byRegion: countBy(profiles, 'region', 'Not set'),
        signupSeries: dailySeries(profiles, 30),
        verified: verifiedUsers,
        unverified: Math.max(profiles.length - verifiedUsers, 0),
        withTrustCoin: usersWithTrustCoin,
        withoutTrustCoin: Math.max(profiles.length - usersWithTrustCoin, 0),
      },
      trustScores: {
        available: false,
        sourceTable: null,
        note: 'No dedicated trust_scores table was found in public schema. Trust Score cards intentionally show an empty state instead of inferring/fabricating a score from Trust Coin or ratings.',
        average: null,
        histogram: histogram([]),
        topUsers: [],
        trend: [],
      },
      marketplace: {
        totalActive: activeListings.length,
        new7: newListings7,
        new30: newListings30,
        byCategory: countBy(listings, 'category', 'Uncategorised'),
        byLocation: countBy(listings.map(row => ({ ...row, place: row.city ?? row.region ?? row.location ?? row.country })), 'place', 'Not set'),
        topListings: listings
          .map(row => ({ id: String(row.id), title: text(row.title, 'Untitled'), views: num(row.views), saves: num(row.saves_count), status: text(row.status), productType: text(row.product_type, 'listing') }))
          .sort((a, b) => (b.views + b.saves) - (a.views + a.saves))
          .slice(0, 10),
        externalProductClicks: externalClicks.length,
      },
      messaging: {
        total: messages.length,
        last7: messages.filter(row => String(row.created_at) >= since7).length,
        last30: messages.filter(row => String(row.created_at) >= since30).length,
        activeThreads: conversations,
        averagePerUser: messageSenders.size ? Math.round((messages.length / messageSenders.size) * 10) / 10 : 0,
      },
      emailNotifications: {
        totalSent: campaignSends.length,
        sent7: campaignSends.filter(row => String(row.created_at ?? row.sent_at) >= since7).length,
        sent30: campaignSends.filter(row => String(row.created_at ?? row.sent_at) >= since30).length,
        successRate: pct(campaignSent, campaignSent + campaignFailed),
        typeBreakdown: countBy(notifications, 'type', 'Unknown'),
        mostTriggeredType: countBy(notifications, 'type', 'Unknown')[0] ?? null,
        optInEnabled: opt.enabled,
        optInDisabled: opt.disabled,
        optInRate: pct(opt.enabled, opt.enabled + opt.disabled),
        recent: campaignSends
          .sort((a, b) => String(b.created_at ?? b.sent_at).localeCompare(String(a.created_at ?? a.sent_at)))
          .slice(0, 20)
          .map(row => ({ email: text(row.email, 'Unknown'), type: 'campaign', sentAt: text(row.sent_at ?? row.created_at, ''), status: text(row.status, 'unknown') })),
        dedicatedLoggingImplemented: false,
        emptyStateSchema: "create table email_logs (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), email text, notification_type text, status text, created_at timestamptz default now());",
      },
      engagement: {
        dau: activeUserIds(1),
        wau: activeUserIds(7),
        mau: activeUserIds(30),
        eventSeries: dailySeries(analyticsEvents, 30),
        eventsByType: countBy(analyticsEvents, 'event_type', 'Unknown'),
        lastLoginBuckets,
        averageSessionCountPerUser: profiles.length ? Math.round((analyticsEvents.length / profiles.length) * 10) / 10 : 0,
      },
      trustCoin: {
        inCirculation: trustCoinInCirculation,
        transactions30: trustLedger30.length,
        byType: countBy(trustLedger, 'type', 'Unknown'),
        trend: dailySeries(trustLedger30, 30),
        topEarners: trustTop,
        topSpenders: Array.from(trustLedger
          .filter(row => num(row.amount) < 0)
          .reduce((map, row) => {
            const id = String(row.user_id)
            map.set(id, (map.get(id) ?? 0) + Math.abs(num(row.amount)))
            return map
          }, new Map<string, number>()).entries())
          .map(([userId, spent]) => {
            const profile = profileMap.get(userId)
            return { userId, name: text(profile?.full_name ?? profile?.username ?? profile?.email, 'Unknown user'), spent }
          })
          .sort((a, b) => b.spent - a.spent)
          .slice(0, 10),
      },
      platformHealth: {
        databaseConnected: true,
        authActive: true,
        majorTables,
        recentAuthErrors: [],
        failedSignups: [],
      },
      contentActivity: {
        feedPosts: feedPosts.length,
        feedComments: feedComments.length,
        feedPostTypes: countBy(feedPosts, 'type', 'Unknown'),
      },
      orders: {
        total: orders.length,
        last30: orders.filter(row => String(row.created_at) >= since30).length,
        byStatus: countBy(orders, 'status', 'Unknown'),
      },
    })
  } catch (error) {
    console.error('[admin/analytics]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
