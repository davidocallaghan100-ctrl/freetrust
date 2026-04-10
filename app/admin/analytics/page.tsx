'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────────

type Range = 'today' | '7d' | '30d'

interface DailyPoint { date: string; count: number }

interface ActiveMember {
  id: string
  full_name: string | null
  avatar_url: string | null
  posts: number
  comments: number
  follows: number
}

interface TopListing {
  id: string
  title: string
  views: number
  status: string
  product_type: string
  price: number
}

interface AnalyticsPayload {
  range: string
  summary: {
    totalMembers: number
    activeListings: number
    totalListingViews: number
    totalOrders: number
    completedOrders: number
    totalRevenue: number
    totalCommunities: number
    totalArticles: number
    totalClaps: number
    totalArticleComments: number
    totalGigs: number
    totalEvents: number
    newSignups: number
    newPosts: number
    newComments: number
    newFollows: number
    newOrders: number
    revenueInRange: number
  }
  roleCounts: Record<string, number>
  dailySignups: DailyPoint[]
  dailyPosts: DailyPoint[]
  dailyComments: DailyPoint[]
  dailyFollows: DailyPoint[]
  mostActiveMembers: ActiveMember[]
  topListings: TopListing[]
  postTypeBreakdown: Record<string, number>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString() }
function fmtEur(n: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n / 100)
}
function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const GRADIENTS = [
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  'linear-gradient(135deg,#fb923c,#ea580c)',
]
function pickGrad(s: string) {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color = '#38bdf8' }: {
  icon: string; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div style={{ background: '#1e293b', border: `1px solid ${color}22`, borderRadius: 14, padding: '1.25rem 1.1rem' }}>
      <div style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.85rem', borderBottom: '1px solid rgba(56,189,248,0.08)', paddingBottom: '0.5rem' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ── Chart Card ─────────────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.25rem' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1rem' }}>{title}</div>
      {children}
    </div>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.78rem' }}>
      <div style={{ color: '#94a3b8', marginBottom: '0.35rem' }}>{fmtDate(label ?? '')}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

// ── Activity Chart — merged line chart ─────────────────────────────────────────

function ActivityChart({ posts, comments, follows }: {
  posts: DailyPoint[]; comments: DailyPoint[]; follows: DailyPoint[]
}) {
  // Merge into single series
  const merged = posts.map((p, i) => ({
    date: p.date,
    Posts: p.count,
    Comments: comments[i]?.count ?? 0,
    Follows: follows[i]?.count ?? 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={merged} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.07)" />
        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={fmtDate} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#64748b' }} />
        <Line type="monotone" dataKey="Posts"    stroke="#38bdf8" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Comments" stroke="#a78bfa" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Follows"  stroke="#34d399" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Signups Chart ──────────────────────────────────────────────────────────────

function SignupsChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.07)" />
        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={fmtDate} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" name="Signups" fill="#38bdf8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Post Types Chart ────────────────────────────────────────────────────────────

function PostTypesChart({ breakdown }: { breakdown: Record<string, number> }) {
  const data = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type: type.charAt(0).toUpperCase() + type.slice(1), count }))

  if (!data.length) return <div style={{ color: '#475569', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>No posts in this period</div>

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.07)" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="type" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          return (
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#a78bfa', fontWeight: 700 }}>
              {payload[0]?.value} posts
            </div>
          )
        }} />
        <Bar dataKey="count" fill="#a78bfa" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [fetching, setFetching]     = useState(false)
  const [range, setRange]           = useState<Range>('7d')
  const [data, setData]             = useState<AnalyticsPayload | null>(null)
  const [error, setError]           = useState('')

  // Auth guard on mount
  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login?redirect=/admin/analytics'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (!profile || profile.role !== 'admin') { router.replace('/feed'); return }
      setAuthorized(true)
      setLoading(false)
    }
    check()
  }, [router])

  const fetchData = useCallback(async (r: Range) => {
    setFetching(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/analytics?range=${r}`)
      if (!res.ok) { setError('Failed to load analytics data'); return }
      const json = await res.json() as AnalyticsPayload
      setData(json)
    } catch {
      setError('Could not connect to analytics API')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (authorized) fetchData(range)
  }, [authorized, range, fetchData])

  // ── Loading / auth states ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Checking access…</div>
      </div>
    )
  }
  if (!authorized) return null

  const s = data?.summary

  const rangeLabel = { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' }[range]

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        .an-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.85rem; }
        .an-chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .an-bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 900px) {
          .an-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .an-chart-grid { grid-template-columns: 1fr !important; }
          .an-bottom-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .an-stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        .range-btn { background: transparent; border: 1px solid #334155; border-radius: 8px; padding: 0.35rem 0.9rem; font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.15s; font-family: inherit; }
        .range-btn.active { background: rgba(56,189,248,0.12); border-color: rgba(56,189,248,0.35); color: #38bdf8; }
        .an-table { width: 100%; border-collapse: collapse; }
        .an-table th { text-align: left; font-size: 0.7rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.6rem 0.75rem; border-bottom: 1px solid rgba(56,189,248,0.08); }
        .an-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid rgba(56,189,248,0.05); font-size: 0.82rem; color: #cbd5e1; }
        .an-table tr:last-child td { border-bottom: none; }
        .an-table tr:hover td { background: rgba(56,189,248,0.025); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: '1px solid rgba(56,189,248,0.08)', background: 'linear-gradient(180deg,rgba(56,189,248,0.05) 0%,transparent 100%)', padding: '1.5rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                <Link href="/admin" style={{ fontSize: '0.78rem', color: '#475569', textDecoration: 'none' }}>← Admin</Link>
                <span style={{ color: '#334155' }}>/</span>
                <span style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 5, padding: '0.1rem 0.55rem', fontSize: '0.68rem', fontWeight: 700, color: '#a78bfa' }}>ANALYTICS</span>
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Platform Analytics</h1>
              <p style={{ color: '#475569', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
                {fetching ? 'Refreshing…' : `Showing data for: ${rangeLabel}`}
              </p>
            </div>

            {/* Range selector */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {(['today', '7d', '30d'] as Range[]).map(r => (
                <button
                  key={r}
                  className={`range-btn${range === r ? ' active' : ''}`}
                  onClick={() => setRange(r)}
                  disabled={fetching}
                >
                  {r === 'today' ? 'Today' : r === '7d' ? '7 days' : '30 days'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#f87171' }}>
            ⚠️ {error}
          </div>
        )}

        {!data && fetching && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#475569' }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Loading analytics…
          </div>
        )}

        {data && (
          <>
            {/* ── Section 1: Period metrics ── */}
            <Section title={`Activity — ${rangeLabel}`}>
              <div className="an-stat-grid" style={{ marginBottom: '1rem' }}>
                <StatCard icon="👥" label="New Signups"   value={fmt(s?.newSignups ?? 0)}  color="#38bdf8" />
                <StatCard icon="📝" label="New Posts"     value={fmt(s?.newPosts ?? 0)}    color="#a78bfa" />
                <StatCard icon="💬" label="New Comments"  value={fmt(s?.newComments ?? 0)} color="#f472b6" />
                <StatCard icon="🤝" label="New Follows"   value={fmt(s?.newFollows ?? 0)}  color="#34d399" />
              </div>
              <div className="an-stat-grid">
                <StatCard icon="🛍️" label="New Orders"   value={fmt(s?.newOrders ?? 0)}     color="#fb923c" />
                <StatCard icon="💰" label="Revenue"       value={fmtEur(s?.revenueInRange ?? 0)} color="#34d399" sub="completed orders" />
                <StatCard icon="📊" label="Total Members" value={fmt(s?.totalMembers ?? 0)} color="#64748b" sub="all time" />
                <StatCard icon="📦" label="Active Listings" value={fmt(s?.activeListings ?? 0)} color="#fbbf24" sub="all time" />
              </div>
            </Section>

            {/* ── Section 2: Charts ── */}
            <Section title="Trends">
              <div className="an-chart-grid">
                <ChartCard title="New Member Signups">
                  <SignupsChart data={data.dailySignups} />
                </ChartCard>
                <ChartCard title="Feed Activity (Posts · Comments · Follows)">
                  <ActivityChart
                    posts={data.dailyPosts}
                    comments={data.dailyComments}
                    follows={data.dailyFollows}
                  />
                </ChartCard>
              </div>
            </Section>

            {/* ── Section 3: Post type breakdown + Platform totals ── */}
            <Section title="Content">
              <div className="an-chart-grid">
                <ChartCard title={`Post Types — ${rangeLabel}`}>
                  <PostTypesChart breakdown={data.postTypeBreakdown} />
                </ChartCard>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {[
                    { icon: '🏘️', label: 'Communities',      value: fmt(s?.totalCommunities ?? 0),    color: '#f472b6' },
                    { icon: '📰', label: 'Published Articles', value: fmt(s?.totalArticles ?? 0),       color: '#38bdf8' },
                    { icon: '👏', label: 'Total Claps',        value: fmt(s?.totalClaps ?? 0),          color: '#fbbf24' },
                    { icon: '💼', label: 'Seller Gigs',        value: fmt(s?.totalGigs ?? 0),           color: '#a78bfa' },
                    { icon: '📅', label: 'Events',             value: fmt(s?.totalEvents ?? 0),         color: '#fb923c' },
                    { icon: '👁️', label: 'Listing Views',     value: fmt(s?.totalListingViews ?? 0),   color: '#64748b' },
                  ].map(row => (
                    <div key={row.label} style={{ background: '#1e293b', border: `1px solid ${row.color}20`, borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.83rem', color: '#94a3b8' }}>{row.icon} {row.label}</span>
                      <span style={{ fontWeight: 800, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* ── Section 4: Most active members + Top listings ── */}
            <Section title="Leaders">
              <div className="an-bottom-grid">

                {/* Most active members */}
                <ChartCard title={`Most Active Members — ${rangeLabel}`}>
                  {data.mostActiveMembers.length === 0 ? (
                    <div style={{ color: '#475569', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>No activity in this period</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="an-table">
                        <thead>
                          <tr>
                            <th>Member</th>
                            <th style={{ textAlign: 'right' }}>Posts</th>
                            <th style={{ textAlign: 'right' }}>Cmts</th>
                            <th style={{ textAlign: 'right' }}>Follows</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.mostActiveMembers.map((m, i) => (
                            <tr key={m.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: m.avatar_url ? undefined : pickGrad(m.id), flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 700, color: '#0f172a' }}>
                                    {m.avatar_url
                                      ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      : getInitials(m.full_name)}
                                  </div>
                                  <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                    {i < 3 && <span style={{ marginRight: 4 }}>{['🥇','🥈','🥉'][i]}</span>}
                                    {m.full_name ?? 'Unknown'}
                                  </span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', color: '#38bdf8', fontWeight: 700 }}>{m.posts}</td>
                              <td style={{ textAlign: 'right', color: '#a78bfa', fontWeight: 700 }}>{m.comments}</td>
                              <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 700 }}>{m.follows}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ChartCard>

                {/* Top listings by views */}
                <ChartCard title="Top Listings by Views">
                  {data.topListings.length === 0 ? (
                    <div style={{ color: '#475569', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>No listings found</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="an-table">
                        <thead>
                          <tr>
                            <th>Listing</th>
                            <th style={{ textAlign: 'right' }}>Views</th>
                            <th style={{ textAlign: 'right' }}>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.topListings.map(l => (
                            <tr key={l.id}>
                              <td>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, fontSize: '0.8rem' }}>
                                  {l.title}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.1rem' }}>{l.product_type ?? l.status}</div>
                              </td>
                              <td style={{ textAlign: 'right', color: '#38bdf8', fontWeight: 700 }}>{fmt(l.views)}</td>
                              <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 600 }}>
                                {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(l.price)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ChartCard>
              </div>
            </Section>

            {/* ── Section 5: Orders & Revenue ── */}
            <Section title="Commerce">
              <div className="an-stat-grid">
                <StatCard icon="🛒" label="Total Orders"     value={fmt(s?.totalOrders ?? 0)}      color="#38bdf8" sub="all time" />
                <StatCard icon="✅" label="Completed Orders" value={fmt(s?.completedOrders ?? 0)}  color="#34d399" sub="all time" />
                <StatCard icon="💶" label="Total Revenue"    value={fmtEur(s?.totalRevenue ?? 0)}   color="#34d399" sub="all time" />
                <StatCard icon="📈" label="Conversion Rate"  value={s?.totalOrders ? `${Math.round((s.completedOrders / s.totalOrders) * 100)}%` : '—'} color="#fbbf24" sub="completed / placed" />
              </div>
            </Section>

            {/* ── Section 6: User role breakdown ── */}
            <Section title="Member Roles">
              <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                {Object.entries(data.roleCounts).sort((a, b) => b[1] - a[1]).map(([role, count]) => {
                  const roleColors: Record<string, string> = { admin: '#a78bfa', seller: '#38bdf8', buyer: '#34d399', member: '#64748b' }
                  const col = roleColors[role] ?? '#64748b'
                  return (
                    <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: `${col}12`, border: `1px solid ${col}25`, borderRadius: 10, padding: '0.6rem 1rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: col }}>{fmt(count)}</span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>{role}</span>
                    </div>
                  )
                })}
              </div>
            </Section>

            <div style={{ fontSize: '0.72rem', color: '#334155', textAlign: 'right', paddingBottom: '2rem' }}>
              Last refreshed: {new Date().toLocaleTimeString()}
              {' · '}
              <button onClick={() => fetchData(range)} style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                Refresh
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
