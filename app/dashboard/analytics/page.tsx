'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import type { AnalyticsEventType } from '@/lib/analytics'

type RangeDays = 7 | 30 | 90

type AnalyticsRow = {
  id: string
  user_id: string
  actor_id: string | null
  event_type: AnalyticsEventType
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type ProfileSummary = {
  full_name: string | null
  username: string | null
  trust_balance: number | null
}

const LOGO_SRC = '/icons/freetrust-mark-perfect-transparent-20260521.png'
const RANGE_OPTIONS: RangeDays[] = [7, 30, 90]
const BRAND = {
  navy: '#0A1628',
  blue: '#1B4F8A',
  teal: '#0D9488',
  white: '#FFFFFF',
  grey: '#F4F7FC',
  muted: '#6B7A90',
  border: 'rgba(27,79,138,0.14)',
}

const VIEW_EVENTS = new Set<AnalyticsEventType>(['profile_view', 'service_view', 'product_view', 'post_view'])
const ENGAGEMENT_EVENTS = new Set<AnalyticsEventType>(['post_like', 'post_comment', 'post_share', 'service_enquiry', 'product_enquiry', 'message_received', 'follower_gained'])
const EVENT_LABELS: Record<AnalyticsEventType, string> = {
  profile_view: 'Profile view',
  service_view: 'Service view',
  product_view: 'Product view',
  post_view: 'Post view',
  post_like: 'Post reaction',
  post_comment: 'Post comment',
  post_share: 'Post share',
  service_enquiry: 'Service enquiry',
  product_enquiry: 'Product enquiry',
  message_received: 'Message received',
  follower_gained: 'Follower gained',
  profile_search_appearance: 'Search appearance',
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shortDate(isoDate: string, rangeDays: RangeDays) {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('en', rangeDays <= 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' })
}

function getEventTitle(event: AnalyticsRow) {
  const title = event.metadata?.title
  if (typeof title === 'string' && title.trim()) return title.trim()
  if (event.entity_type === 'profile') return 'Profile'
  if (event.entity_type === 'service') return 'Service listing'
  if (event.entity_type === 'product') return 'Product listing'
  if (event.entity_type === 'post') return 'Feed post'
  return EVENT_LABELS[event.event_type]
}

function countEvents(events: AnalyticsRow[], types: AnalyticsEventType[]) {
  const set = new Set(types)
  return events.filter(event => set.has(event.event_type)).length
}

function formatDelta(current: number, previous: number) {
  if (previous === 0 && current === 0) return 'No change yet'
  if (previous === 0) return '+100% from prior period'
  const pct = Math.round(((current - previous) / previous) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}% from prior period`
}

function splitCurrentAndPrevious(events: AnalyticsRow[], rangeDays: RangeDays) {
  const now = Date.now()
  const periodMs = rangeDays * 24 * 60 * 60 * 1000
  const currentStart = now - periodMs
  const previousStart = now - (periodMs * 2)
  return {
    current: events.filter(event => new Date(event.created_at).getTime() >= currentStart),
    previous: events.filter(event => {
      const ts = new Date(event.created_at).getTime()
      return ts >= previousStart && ts < currentStart
    }),
  }
}

function buildDailySeries(events: AnalyticsRow[], rangeDays: RangeDays) {
  const days: Array<{ key: string; label: string; profileViews: number; postViews: number; followers: number }> = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (rangeDays - 1))

  for (let i = 0; i < rangeDays; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    const key = dateKey(day)
    days.push({ key, label: shortDate(key, rangeDays), profileViews: 0, postViews: 0, followers: 0 })
  }

  const byKey = new Map(days.map(day => [day.key, day]))
  events.forEach(event => {
    const day = byKey.get(dateKey(new Date(event.created_at)))
    if (!day) return
    if (event.event_type === 'profile_view') day.profileViews++
    if (event.event_type === 'post_view') day.postViews++
    if (event.event_type === 'follower_gained') day.followers++
  })
  return days
}

function buildTopContent(events: AnalyticsRow[]) {
  const grouped = new Map<string, { key: string; title: string; type: string; views: number; engagement: number; total: number }>()
  events.forEach(event => {
    if (!event.entity_id || !event.entity_type || !['post', 'service', 'product', 'profile'].includes(event.entity_type)) return
    const key = `${event.entity_type}:${event.entity_id}`
    const existing = grouped.get(key) ?? { key, title: getEventTitle(event), type: event.entity_type, views: 0, engagement: 0, total: 0 }
    if (VIEW_EVENTS.has(event.event_type)) existing.views++
    if (ENGAGEMENT_EVENTS.has(event.event_type)) existing.engagement++
    existing.total++
    grouped.set(key, existing)
  })
  return Array.from(grouped.values()).sort((a, b) => b.total - a.total).slice(0, 10)
}

function getBestDay(dailySeries: ReturnType<typeof buildDailySeries>) {
  return dailySeries.reduce((best, day) => {
    const dayTotal = day.profileViews + day.postViews + day.followers
    const bestTotal = best.profileViews + best.postViews + best.followers
    return dayTotal > bestTotal ? day : best
  }, dailySeries[0] ?? { key: '', label: '—', profileViews: 0, postViews: 0, followers: 0 })
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 24, boxShadow: '0 18px 48px rgba(10,22,40,0.07)', ...style }}>{children}</div>
}

function KpiCard({ label, value, sub, accent }: { label: string; value: number | string; sub: string; accent: string }) {
  return (
    <Card style={{ padding: 18, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ color: BRAND.navy, fontSize: 30, lineHeight: 1.1, fontWeight: 900, letterSpacing: '-0.04em', marginTop: 8 }}>{value}</div>
        </div>
        <div style={{ width: 42, height: 42, minWidth: 42, borderRadius: 16, background: `${accent}18`, border: `1px solid ${accent}2b`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: accent, boxShadow: `0 0 22px ${accent}66` }} />
        </div>
      </div>
      <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 12, lineHeight: 1.45 }}>{sub}</div>
    </Card>
  )
}

function EmptyState() {
  return (
    <Card style={{ padding: 28, textAlign: 'center' }}>
      <div style={{ width: 58, height: 58, borderRadius: 22, margin: '0 auto 14px', background: 'linear-gradient(135deg, rgba(27,79,138,0.12), rgba(13,148,136,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND.blue, fontSize: 24 }}>📊</div>
      <h2 style={{ color: BRAND.navy, fontSize: 22, margin: '0 0 8px', letterSpacing: '-0.03em' }}>Analytics will appear as members interact with you</h2>
      <p style={{ color: BRAND.muted, margin: '0 auto', maxWidth: 540, lineHeight: 1.6, fontSize: 14 }}>Profile views, listing views, messages, followers, comments, shares, and enquiries are tracked from real FreeTrust activity only. No sample or fake results are shown here.</p>
    </Card>
  )
}

export default function DashboardAnalyticsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rangeDays, setRangeDays] = useState<RangeDays>(30)
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<AnalyticsRow[]>([])
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [viewportWidth, setViewportWidth] = useState<number | null>(null)

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth)
    updateViewportWidth()
    window.addEventListener('resize', updateViewportWidth)
    return () => window.removeEventListener('resize', updateViewportWidth)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push('/login?redirect=/dashboard/analytics')
          return
        }
        const since = new Date(Date.now() - rangeDays * 2 * 24 * 60 * 60 * 1000).toISOString()
        const [{ data: profileData }, { data: eventData, error }] = await Promise.all([
          supabase.from('profiles').select('full_name, username, trust_balance').eq('id', session.user.id).maybeSingle(),
          supabase
            .from('analytics_events')
            .select('id,user_id,actor_id,event_type,entity_type,entity_id,metadata,created_at')
            .eq('user_id', session.user.id)
            .gte('created_at', since)
            .order('created_at', { ascending: false }),
        ])
        if (error) throw error
        if (!cancelled) {
          setProfile((profileData ?? null) as ProfileSummary | null)
          setEvents((eventData ?? []) as AnalyticsRow[])
        }
      } catch (err) {
        console.error('[dashboard/analytics] load failed:', err)
        if (!cancelled) setEvents([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [rangeDays, router, supabase])

  const { current, previous } = useMemo(() => splitCurrentAndPrevious(events, rangeDays), [events, rangeDays])
  const dailySeries = useMemo(() => buildDailySeries(current, rangeDays), [current, rangeDays])
  const topContent = useMemo(() => buildTopContent(current), [current])
  const recent48h = useMemo(() => current.filter(event => Date.now() - new Date(event.created_at).getTime() <= 48 * 60 * 60 * 1000).slice(0, 20), [current])
  const engagementData = useMemo(() => [
    { name: 'Reactions', value: countEvents(current, ['post_like']), color: BRAND.blue },
    { name: 'Comments', value: countEvents(current, ['post_comment']), color: BRAND.teal },
    { name: 'Shares', value: countEvents(current, ['post_share']), color: '#64748B' },
    { name: 'Enquiries', value: countEvents(current, ['service_enquiry', 'product_enquiry', 'message_received']), color: '#38BDF8' },
    { name: 'Followers', value: countEvents(current, ['follower_gained']), color: '#22C55E' },
  ].filter(item => item.value > 0), [current])

  const kpis = [
    { label: 'Profile views', value: countEvents(current, ['profile_view']), prev: countEvents(previous, ['profile_view']), accent: BRAND.blue },
    { label: 'Service views', value: countEvents(current, ['service_view']), prev: countEvents(previous, ['service_view']), accent: BRAND.teal },
    { label: 'Product views', value: countEvents(current, ['product_view']), prev: countEvents(previous, ['product_view']), accent: '#38BDF8' },
    { label: 'Post views', value: countEvents(current, ['post_view']), prev: countEvents(previous, ['post_view']), accent: '#2563EB' },
    { label: 'Engagements', value: countEvents(current, ['post_like', 'post_comment', 'post_share']), prev: countEvents(previous, ['post_like', 'post_comment', 'post_share']), accent: '#14B8A6' },
    { label: 'Enquiries', value: countEvents(current, ['service_enquiry', 'product_enquiry', 'message_received']), prev: countEvents(previous, ['service_enquiry', 'product_enquiry', 'message_received']), accent: '#22C55E' },
    { label: 'New followers', value: countEvents(current, ['follower_gained']), prev: countEvents(previous, ['follower_gained']), accent: '#64748B' },
  ]

  const totalViews = current.filter(event => VIEW_EVENTS.has(event.event_type)).length
  const totalEngagement = current.filter(event => ENGAGEMENT_EVENTS.has(event.event_type)).length
  const conversion = totalViews > 0 ? Math.round((totalEngagement / totalViews) * 100) : 0
  const displayName = profile?.full_name || profile?.username || 'FreeTrust member'
  const bestDay = getBestDay(dailySeries)
  const mostViewed = topContent[0]
  const isMobile = (viewportWidth ?? 390) < 760
  const chartGridColumns = isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.55fr) minmax(280px, 0.85fr)'
  const contentGridColumns = isMobile ? 'minmax(0, 1fr)' : 'minmax(280px, 1fr) minmax(280px, 1fr)'
  const kpiGridColumns = isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(158px, 1fr))'

  return (
    <main style={{ minHeight: '100vh', width: '100%', maxWidth: '100%', overflowX: 'hidden', background: `linear-gradient(180deg, ${BRAND.grey} 0%, #FFFFFF 58%, ${BRAND.grey} 100%)`, color: BRAND.navy, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: isMobile ? '18px 12px 110px' : '82px 16px 34px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1180, width: '100%', margin: '0 auto', minWidth: 0 }}>
        <section style={{ background: `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.blue})`, borderRadius: isMobile ? 24 : 32, padding: isMobile ? '20px 16px' : '24px clamp(18px, 4vw, 34px)', color: BRAND.white, boxShadow: '0 28px 70px rgba(10,22,40,0.24)', overflow: 'hidden', position: 'relative', minWidth: 0 }}>
          <div style={{ position: 'absolute', right: -80, top: -110, width: 260, height: 260, borderRadius: '50%', background: 'rgba(13,148,136,0.22)', filter: 'blur(2px)' }} />
          <div style={{ position: 'absolute', right: 86, bottom: -120, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 420px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', marginBottom: 16 }}>
                <Image src={LOGO_SRC} alt="FreeTrust logo" width={26} height={26} style={{ width: 26, height: 26, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.35))' }} />
                <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>FreeTrust Analytics</span>
              </div>
              <h1 style={{ margin: 0, fontSize: isMobile ? 34 : 'clamp(30px, 6vw, 56px)', lineHeight: 0.95, letterSpacing: '-0.065em', fontWeight: 950 }}>Your trust graph, in real time.</h1>
              <p style={{ margin: '16px 0 0', maxWidth: 620, color: 'rgba(255,255,255,0.78)', lineHeight: 1.65, fontSize: 15 }}>Performance for {displayName}: profile attention, marketplace demand, post engagement, enquiries, and community momentum from real member activity.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 999 }}>
              {RANGE_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRangeDays(option)}
                  style={{ border: 'none', borderRadius: 999, padding: '10px 14px', background: rangeDays === option ? BRAND.white : 'transparent', color: rangeDays === option ? BRAND.navy : 'rgba(255,255,255,0.78)', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}
                >{option}d</button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <Card style={{ marginTop: 18, padding: 28, color: BRAND.muted }}>Loading analytics…</Card>
        ) : current.length === 0 ? (
          <div style={{ marginTop: 18 }}><EmptyState /></div>
        ) : (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: kpiGridColumns, gap: isMobile ? 10 : 14, marginTop: 18, minWidth: 0 }}>
              {kpis.map(kpi => <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} sub={formatDelta(kpi.value, kpi.prev)} accent={kpi.accent} />)}
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: chartGridColumns, gap: isMobile ? 12 : 16, marginTop: 16, minWidth: 0 }}>
              <Card style={{ padding: isMobile ? 16 : 20, minHeight: isMobile ? 320 : 360, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, color: BRAND.navy, fontSize: isMobile ? 18 : 20, letterSpacing: '-0.03em' }}>Growth over time</h2>
                    <p style={{ margin: '5px 0 0', color: BRAND.muted, fontSize: 13 }}>Profile views, post views, and new followers across the selected window.</p>
                  </div>
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'wrap', maxWidth: '100%' }}>
                    <span style={{ color: BRAND.blue, fontSize: 12, fontWeight: 900 }}>● Profile views</span>
                    <span style={{ color: BRAND.teal, fontSize: 12, fontWeight: 900 }}>● Post views</span>
                    <span style={{ color: '#22C55E', fontSize: 12, fontWeight: 900 }}>● Followers</span>
                  </div>
                </div>
                <div style={{ width: '100%', height: isMobile ? 235 : 285, minWidth: 0 }}>
                  <ResponsiveContainer>
                    <LineChart data={dailySeries} margin={{ top: 8, right: isMobile ? 4 : 8, left: isMobile ? -30 : -20, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(10,22,40,0.08)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: BRAND.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: BRAND.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ border: `1px solid ${BRAND.border}`, borderRadius: 14, boxShadow: '0 18px 38px rgba(10,22,40,0.12)' }} />
                      <Line type="monotone" dataKey="profileViews" name="Profile views" stroke={BRAND.blue} strokeWidth={3} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="postViews" name="Post views" stroke={BRAND.teal} strokeWidth={3} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="followers" name="New followers" stroke="#22C55E" strokeWidth={3} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card style={{ padding: isMobile ? 16 : 20, minHeight: isMobile ? 300 : 360, minWidth: 0, overflow: 'hidden' }}>
                <h2 style={{ margin: 0, color: BRAND.navy, fontSize: isMobile ? 18 : 20, letterSpacing: '-0.03em' }}>Engagement breakdown</h2>
                <p style={{ margin: '5px 0 10px', color: BRAND.muted, fontSize: 13 }}>{conversion}% engagement-to-view signal</p>
                {engagementData.length > 0 ? (
                  <div style={{ width: '100%', height: isMobile ? 180 : 210, minWidth: 0 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={engagementData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={4}>
                          {engagementData.map(item => <Cell key={item.name} fill={item.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ border: `1px solid ${BRAND.border}`, borderRadius: 14 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div style={{ height: isMobile ? 150 : 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND.muted, fontSize: 13, textAlign: 'center' }}>No engagement events yet.</div>}
                <div style={{ display: 'grid', gap: 8 }}>
                  {(engagementData.length > 0 ? engagementData : [{ name: 'Waiting for real activity', value: 0, color: BRAND.muted }]).map(item => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: BRAND.muted, fontSize: 13 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 99, background: item.color }} />{item.name}</span>
                      <strong style={{ color: BRAND.navy }}>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: contentGridColumns, gap: isMobile ? 12 : 16, marginTop: 16, minWidth: 0 }}>
              <Card style={{ padding: isMobile ? 16 : 20, minWidth: 0, overflow: 'hidden' }}>
                <h2 style={{ margin: 0, color: BRAND.navy, fontSize: isMobile ? 18 : 20, letterSpacing: '-0.03em' }}>Top performing content</h2>
                <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                  {topContent.length > 0 ? topContent.map((item, index) => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, background: BRAND.grey, border: `1px solid ${BRAND.border}`, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ width: 34, height: 34, minWidth: 34, borderRadius: 13, background: index === 0 ? BRAND.teal : BRAND.blue, color: BRAND.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950 }}>{index + 1}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: BRAND.navy, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 3, textTransform: 'capitalize' }}>{item.type} · {item.views} views · {item.engagement} engagements</div>
                      </div>
                      <strong style={{ color: BRAND.blue }}>{item.total}</strong>
                    </div>
                  )) : <div style={{ color: BRAND.muted, fontSize: 14, lineHeight: 1.6 }}>No content-level analytics yet.</div>}
                </div>
              </Card>

              <Card style={{ padding: isMobile ? 16 : 20, minWidth: 0, overflow: 'hidden' }}>
                <h2 style={{ margin: 0, color: BRAND.navy, fontSize: isMobile ? 18 : 20, letterSpacing: '-0.03em' }}>Recent activity feed</h2>
                <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                  {recent48h.length > 0 ? recent48h.map(event => (
                    <div key={event.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottom: `1px solid ${BRAND.border}` }}>
                      <div style={{ width: 10, height: 10, borderRadius: 999, background: VIEW_EVENTS.has(event.event_type) ? BRAND.blue : BRAND.teal, marginTop: 5, boxShadow: `0 0 0 5px ${VIEW_EVENTS.has(event.event_type) ? 'rgba(27,79,138,0.1)' : 'rgba(13,148,136,0.1)'}` }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: BRAND.navy, fontSize: 14, fontWeight: 850 }}>{EVENT_LABELS[event.event_type]}</div>
                        <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getEventTitle(event)} · {new Date(event.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  )) : <div style={{ color: BRAND.muted, fontSize: 14, lineHeight: 1.6 }}>No activity in the last 48 hours.</div>}
                </div>
              </Card>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: isMobile ? 12 : 14, marginTop: 16, minWidth: 0 }}>
              <Card style={{ padding: 18 }}><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Best day</div><div style={{ color: BRAND.navy, fontSize: 26, fontWeight: 950, marginTop: 6 }}>{bestDay.label}</div><div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>{bestDay.profileViews + bestDay.postViews + bestDay.followers} growth signals</div></Card>
              <Card style={{ padding: 18 }}><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Most viewed content</div><div style={{ color: BRAND.navy, fontSize: 26, fontWeight: 950, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mostViewed?.title ?? '—'}</div><div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>{mostViewed ? `${mostViewed.views} views` : 'Waiting for real activity'}</div></Card>
              <Card style={{ padding: 18 }}><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Engagement rate</div><div style={{ color: BRAND.navy, fontSize: 26, fontWeight: 950, marginTop: 6 }}>{conversion}%</div><div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>{totalEngagement} engagement signals / {totalViews} views</div></Card>
              <Link href="/dashboard" style={{ textDecoration: 'none' }}><Card style={{ padding: 18, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><span style={{ color: BRAND.blue, fontWeight: 950 }}>Back to dashboard</span><span style={{ color: BRAND.teal, fontSize: 22 }}>→</span></Card></Link>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
