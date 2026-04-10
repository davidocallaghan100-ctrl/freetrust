'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────────
interface StatsData {
  totalMembers: number
  totalTransactions: number
  platformRevenue: number
  trustIssued: number
  activeListings: number
  activeCommunities: number
}

interface TrustLedgerRow {
  id: string
  user_id: string
  amount: number
  type: string
  description: string
  created_at: string
  profile?: { full_name: string | null; email: string }
}

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: string
  trust_balance: number
  created_at: string
}

interface TrustTypeBreakdown {
  type: string
  total: number
}

interface TopEarner {
  user_id: string
  balance: number
  lifetime: number
  full_name?: string | null
  email?: string
}

interface AnalyticsData {
  summary: {
    totalMembers: number
    activeListings: number
    totalListingViews: number
    totalTrustIssued: number
    totalOrders: number
    completedOrders: number
    totalRevenue: number
    totalCommunities: number
    totalArticles: number
    totalClaps: number
    totalArticleComments: number
  }
  memberGrowth: Record<string, number>
  roleCounts: Record<string, number>
  trustByType: Record<string, number>
  topListings: { id: string; title: string; views: number; status: string; product_type: string; price: number }[]
  recentLedger: TrustLedgerRow[]
  profiles: UserRow[]
}

// ── Mock fallback data ─────────────────────────────────────────────────────────
const MOCK_STATS: StatsData = {
  totalMembers: 24187,
  totalTransactions: 8432,
  platformRevenue: 142600,
  trustIssued: 487200,
  activeListings: 3841,
  activeCommunities: 127,
}

const MOCK_LEDGER: TrustLedgerRow[] = [
  { id: '1', user_id: 'u1', amount: 25, type: 'signup_bonus', description: 'Welcome to FreeTrust!', created_at: new Date().toISOString(), profile: { full_name: 'Amara Diallo', email: 'amara@example.com' } },
  { id: '2', user_id: 'u2', amount: 20, type: 'article_published', description: 'Published article: The Trust Economy', created_at: new Date(Date.now() - 3600000).toISOString(), profile: { full_name: 'Tom Walsh', email: 'tom@example.com' } },
  { id: '3', user_id: 'u3', amount: -5, type: 'platform_fee', description: 'Platform fee on community join', created_at: new Date(Date.now() - 7200000).toISOString(), profile: { full_name: 'Priya Nair', email: 'priya@example.com' } },
  { id: '4', user_id: 'u4', amount: 15, type: 'event_hosted', description: 'Hosted: Founder Summit 2025', created_at: new Date(Date.now() - 10800000).toISOString(), profile: { full_name: 'James Okafor', email: 'james@example.com' } },
  { id: '5', user_id: 'u5', amount: 5, type: 'job_application', description: 'Applied for: Senior UX Designer', created_at: new Date(Date.now() - 14400000).toISOString(), profile: { full_name: 'Sarah Chen', email: 'sarah@example.com' } },
]

const MOCK_USERS: UserRow[] = [
  { id: 'u1', email: 'amara@example.com', full_name: 'Amara Diallo', role: 'seller', trust_balance: 840, created_at: '2024-01-15T00:00:00Z' },
  { id: 'u2', email: 'tom@example.com', full_name: 'Tom Walsh', role: 'seller', trust_balance: 620, created_at: '2024-02-20T00:00:00Z' },
  { id: 'u3', email: 'priya@example.com', full_name: 'Priya Nair', role: 'buyer', trust_balance: 180, created_at: '2024-03-10T00:00:00Z' },
  { id: 'u4', email: 'james@example.com', full_name: 'James Okafor', role: 'seller', trust_balance: 990, created_at: '2024-01-05T00:00:00Z' },
  { id: 'u5', email: 'sarah@example.com', full_name: 'Sarah Chen', role: 'buyer', trust_balance: 310, created_at: '2024-04-01T00:00:00Z' },
]

const MOCK_TOP_EARNERS: TopEarner[] = [
  { user_id: 'u4', balance: 990, lifetime: 1200, full_name: 'James Okafor', email: 'james@example.com' },
  { user_id: 'u1', balance: 840, lifetime: 1050, full_name: 'Amara Diallo', email: 'amara@example.com' },
  { user_id: 'u2', balance: 620, lifetime: 780, full_name: 'Tom Walsh', email: 'tom@example.com' },
  { user_id: 'u5', balance: 310, lifetime: 400, full_name: 'Sarah Chen', email: 'sarah@example.com' },
  { user_id: 'u3', balance: 180, lifetime: 230, full_name: 'Priya Nair', email: 'priya@example.com' },
]

const MOCK_TYPE_BREAKDOWN: TrustTypeBreakdown[] = [
  { type: 'signup_bonus', total: 120250 },
  { type: 'article_published', total: 87400 },
  { type: 'event_hosted', total: 64800 },
  { type: 'job_application', total: 42100 },
  { type: 'platform_fee', total: -28300 },
  { type: 'review_received', total: 31200 },
]

const MOCK_DISPUTES = [
  { id: 'd1', title: 'Service not delivered', buyer: 'Tom Walsh', seller: 'Yuki Tanaka', amount: 320, status: 'Open', created: '2 days ago' },
  { id: 'd2', title: 'Product damaged in transit', buyer: 'Lena Fischer', seller: 'Marcus Obi', amount: 89, status: 'Under Review', created: '5 days ago' },
  { id: 'd3', title: 'Gig delivered late', buyer: 'Priya Nair', seller: 'Sarah Chen', amount: 150, status: 'Resolved', created: '1 week ago' },
]

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const gradients = [
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  'linear-gradient(135deg,#fb923c,#ea580c)',
]

function pickGradient(str: string): string {
  let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return gradients[h % gradients.length]
}

const TYPE_LABELS: Record<string, string> = {
  signup_bonus: 'Signup Bonus',
  article_published: 'Article Published',
  event_hosted: 'Event Hosted',
  job_application: 'Job Application',
  platform_fee: 'Platform Fee',
  review_received: 'Review Received',
  hired_via_freetrust: 'Hired',
  manual: 'Manual',
}

const STATUS_COLORS: Record<string, string> = {
  Open: '#ef4444',
  'Under Review': '#fbbf24',
  Resolved: '#34d399',
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#a78bfa',
  seller: '#38bdf8',
  buyer: '#64748b',
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1rem', borderBottom: '1px solid rgba(56,189,248,0.1)', paddingBottom: '0.5rem' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [stats, setStats] = useState<StatsData>(MOCK_STATS)
  const [ledger, setLedger] = useState<TrustLedgerRow[]>(MOCK_LEDGER)
  const [users, setUsers] = useState<UserRow[]>(MOCK_USERS)
  const [topEarners, setTopEarners] = useState<TopEarner[]>(MOCK_TOP_EARNERS)
  const [typeBreakdown, setTypeBreakdown] = useState<TrustTypeBreakdown[]>(MOCK_TYPE_BREAKDOWN)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'trust' | 'disputes' | 'fees' | 'growth'>('overview')
  const [confirmModal, setConfirmModal] = useState<{ userId: string; action: string; value?: string } | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Check admin role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || profile.role !== 'admin') { router.push('/'); return }
      setAuthorized(true)

      // Load real stats
      try {
        const [membersRes, listingsRes, ledgerRes] = await Promise.allSettled([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('trust_ledger').select('amount, type, description, created_at, user_id').order('created_at', { ascending: false }).limit(20),
        ])
        if (membersRes.status === 'fulfilled' && membersRes.value.count != null)
          setStats(s => ({ ...s, totalMembers: membersRes.value.count! }))
        if (listingsRes.status === 'fulfilled' && listingsRes.value.count != null)
          setStats(s => ({ ...s, activeListings: listingsRes.value.count! }))
        if (ledgerRes.status === 'fulfilled' && ledgerRes.value.data)
          setLedger(ledgerRes.value.data as TrustLedgerRow[])
      } catch { /* use mock */ }

      // Load users
      try {
        const { data: profilesData } = await supabase.from('profiles').select('id, email, full_name, role, created_at').limit(50)
        if (profilesData && profilesData.length > 0) {
          const enriched = profilesData.map(p => ({ ...p, trust_balance: 0 }))
          setUsers(enriched as UserRow[])
        }
      } catch { /* use mock */ }

      // Load growth analytics in background
      setAnalyticsLoading(true)
      fetch('/api/admin/analytics')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setAnalyticsData(data) })
        .catch(() => {})
        .finally(() => setAnalyticsLoading(false))

      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading admin dashboard…</div>
      </div>
    )
  }

  if (!authorized) return null

  const filteredUsers = users.filter(u =>
    !userSearch || (u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
  )

  const statCards = [
    { label: 'Total Members', value: stats.totalMembers.toLocaleString(), icon: '👥', color: '#38bdf8' },
    { label: 'Total Transactions', value: stats.totalTransactions.toLocaleString(), icon: '💳', color: '#a78bfa' },
    { label: 'Platform Revenue', value: `£${(stats.platformRevenue / 1000).toFixed(1)}k`, icon: '💰', color: '#34d399' },
    { label: 'Trust Issued', value: `₮${(stats.trustIssued / 1000).toFixed(1)}k`, icon: '⚡', color: '#fbbf24' },
    { label: 'Active Listings', value: stats.activeListings.toLocaleString(), icon: '📦', color: '#fb923c' },
    { label: 'Communities', value: stats.activeCommunities.toLocaleString(), icon: '🏘️', color: '#f472b6' },
  ]

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'growth', label: '📈 Sales & Growth' },
    { id: 'users', label: 'Users' },
    { id: 'trust', label: 'Trust Economy' },
    { id: 'disputes', label: 'Disputes' },
    { id: 'fees', label: 'Fees & Reports' },
  ]

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .admin-stat-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { text-align: left; font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.65rem 1rem; border-bottom: 1px solid rgba(56,189,248,0.08); }
        .admin-table td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(56,189,248,0.05); font-size: 0.85rem; color: #cbd5e1; }
        .admin-table tr:hover td { background: rgba(56,189,248,0.03); }
        .admin-tab { background: transparent; border: 1px solid transparent; border-radius: 7px; padding: 0.4rem 0.9rem; font-size: 0.82rem; font-weight: 500; color: #64748b; cursor: pointer; transition: all 0.15s; font-family: inherit; }
        .admin-tab:hover { color: #94a3b8; background: rgba(148,163,184,0.06); }
        .admin-tab.active { background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.25); color: #38bdf8; font-weight: 700; }
        .admin-role-badge { border-radius: 999px; padding: 0.15rem 0.6rem; font-size: 0.72rem; font-weight: 700; border: 1px solid transparent; }
        @media (max-width: 900px) { .admin-stat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 600px) { .admin-stat-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2rem 1.5rem 1.5rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                <span style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: '#a78bfa' }}>ADMIN</span>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Platform Dashboard</h1>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>FreeTrust platform control centre</p>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569' }}>
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button key={t.id} className={`admin-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id as typeof activeTab)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <>
            {/* Stats grid */}
            <div className="admin-stat-grid" style={{ marginBottom: '2rem' }}>
              {statCards.map(s => (
                <div key={s.label} style={{ background: '#1e293b', border: `1px solid ${s.color}20`, borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{s.icon}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent trust ledger */}
            <Section title="Recent Trust Ledger Activity">
              <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Amount</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map(row => (
                        <tr key={row.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: pickGradient(row.user_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                                {getInitials(row.profile?.full_name)}
                              </div>
                              <span style={{ fontSize: '0.82rem' }}>{row.profile?.full_name || row.user_id.slice(0, 8)}</span>
                            </div>
                          </td>
                          <td style={{ color: row.amount >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                            {row.amount >= 0 ? '+' : ''}₮{row.amount}
                          </td>
                          <td>
                            <span style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                              {TYPE_LABELS[row.type] || row.type}
                            </span>
                          </td>
                          <td style={{ color: '#64748b', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</td>
                          <td style={{ color: '#475569', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{new Date(row.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ── Users Tab ── */}
        {activeTab === 'users' && (
          <Section title="User Management">
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by name or email…"
                style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, color: '#f1f5f9', padding: '0.55rem 1rem', fontSize: '0.88rem', width: 280, outline: 'none', fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{filteredUsers.length} users</span>
            </div>
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Trust Balance</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: pickGradient(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                              {getInitials(u.full_name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f1f5f9' }}>{u.full_name || 'Unknown'}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="admin-role-badge" style={{ background: `${ROLE_COLORS[u.role] || '#64748b'}15`, color: ROLE_COLORS[u.role] || '#64748b', borderColor: `${ROLE_COLORS[u.role] || '#64748b'}30` }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ color: '#38bdf8', fontWeight: 700 }}>₮{u.trust_balance}</td>
                        <td style={{ color: '#475569', fontSize: '0.78rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button onClick={() => router.push(`/profile?id=${u.id}`)} style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 6, padding: '0.3rem 0.7rem', fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit' }}>
                              View
                            </button>
                            <button onClick={() => setConfirmModal({ userId: u.id, action: 'role', value: u.role })} style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 6, padding: '0.3rem 0.7rem', fontSize: '0.75rem', color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit' }}>
                              Role
                            </button>
                            <button onClick={() => setConfirmModal({ userId: u.id, action: 'suspend' })} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '0.3rem 0.7rem', fontSize: '0.75rem', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}>
                              Suspend
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}

        {/* ── Trust Economy Tab ── */}
        {activeTab === 'trust' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Top earners */}
              <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>Top Trust Earners</h3>
                {topEarners.map((e, i) => (
                  <div key={e.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? ['#fbbf24','#94a3b8','#b87333'][i] : 'rgba(148,163,184,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: pickGradient(e.user_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                      {getInitials(e.full_name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>{e.full_name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Lifetime: ₮{e.lifetime}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.9rem' }}>₮{e.balance}</div>
                  </div>
                ))}
              </div>

              {/* Type breakdown */}
              <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>Trust by Type</h3>
                {typeBreakdown.map(t => {
                  const maxAbs = Math.max(...typeBreakdown.map(x => Math.abs(x.total)))
                  const pct = Math.abs(t.total) / maxAbs * 100
                  return (
                    <div key={t.type} style={{ marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{TYPE_LABELS[t.type] || t.type}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: t.total >= 0 ? '#34d399' : '#f87171' }}>
                          {t.total >= 0 ? '+' : ''}₮{t.total.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(148,163,184,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: t.total >= 0 ? '#38bdf8' : '#f87171', borderRadius: 3, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  )
                })}
                <div style={{ borderTop: '1px solid rgba(56,189,248,0.08)', paddingTop: '0.75rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Total supply issued</span>
                  <span style={{ fontWeight: 800, color: '#38bdf8' }}>₮{typeBreakdown.filter(t => t.total > 0).reduce((a, b) => a + b.total, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Sales & Growth Tab ── */}
        {activeTab === 'growth' && (
          <>
            {analyticsLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading analytics…</div>
            ) : !analyticsData ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Failed to load analytics data.</div>
            ) : (
              <>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  {[
                    { label: 'Members', value: analyticsData.summary.totalMembers, icon: '👥', color: '#38bdf8' },
                    { label: 'Active Listings', value: analyticsData.summary.activeListings, icon: '📦', color: '#fbbf24' },
                    { label: 'Listing Views', value: analyticsData.summary.totalListingViews.toLocaleString(), icon: '👁', color: '#818cf8' },
                    { label: 'Trust Issued', value: `₮${analyticsData.summary.totalTrustIssued.toLocaleString()}`, icon: '⚡', color: '#34d399' },
                    { label: 'Total Orders', value: analyticsData.summary.totalOrders, icon: '💳', color: '#f472b6' },
                    { label: 'Revenue', value: `€${analyticsData.summary.totalRevenue.toFixed(2)}`, icon: '💰', color: '#34d399' },
                    { label: 'Articles', value: analyticsData.summary.totalArticles, icon: '✍️', color: '#a78bfa' },
                    { label: 'Communities', value: analyticsData.summary.totalCommunities, icon: '🏘️', color: '#fb923c' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#1e293b', border: `1px solid ${s.color}20`, borderRadius: 12, padding: '1rem' }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>{s.icon}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value.toLocaleString()}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Member growth by day */}
                <Section title="Member Growth (Signups by Day)">
                  <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
                    {Object.keys(analyticsData.memberGrowth).length === 0 ? (
                      <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No member signup data yet</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {Object.entries(analyticsData.memberGrowth).sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => (
                          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', width: 90, flexShrink: 0 }}>{day}</span>
                            <div style={{ flex: 1, background: '#0f172a', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(count * 50, 100)}%`, background: 'linear-gradient(90deg,#38bdf8,#818cf8)', borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8', width: 24, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Section>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                  {/* Top listings by views */}
                  <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>Top Listings by Views</h3>
                    {analyticsData.topListings.length === 0 ? (
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No listing data</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {analyticsData.topListings.slice(0, 8).map((l, i) => (
                          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.72rem', color: '#475569', width: 18, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#cbd5e1' }}>{l.title}</div>
                              <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 2 }}>
                                {l.product_type} · €{l.price?.toFixed(2) ?? '—'} · <span style={{ color: l.status === 'active' ? '#34d399' : '#64748b' }}>{l.status}</span>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', flexShrink: 0 }}>👁 {(l.views ?? 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Trust by type */}
                  <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>Trust Economy Breakdown</h3>
                    {Object.keys(analyticsData.trustByType).length === 0 ? (
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No trust data</div>
                    ) : (() => {
                      const maxAbs = Math.max(...Object.values(analyticsData.trustByType).map(Math.abs), 1)
                      return Object.entries(analyticsData.trustByType)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, total]) => (
                          <div key={type} style={{ marginBottom: '0.7rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{TYPE_LABELS[type] || type}</span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: total >= 0 ? '#34d399' : '#f87171' }}>
                                {total >= 0 ? '+' : ''}₮{total.toLocaleString()}
                              </span>
                            </div>
                            <div style={{ height: 5, background: 'rgba(148,163,184,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(Math.abs(total) / maxAbs) * 100}%`, background: total >= 0 ? '#38bdf8' : '#f87171', borderRadius: 3, transition: 'width 0.4s' }} />
                            </div>
                          </div>
                        ))
                    })()}
                  </div>
                </div>

                {/* Role breakdown */}
                <Section title="Member Role Breakdown">
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {Object.entries(analyticsData.roleCounts).map(([role, count]) => (
                      <div key={role} style={{ background: '#1e293b', border: `1px solid ${ROLE_COLORS[role] || '#64748b'}25`, borderRadius: 10, padding: '0.9rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: ROLE_COLORS[role] || '#94a3b8' }}>{count}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize', marginTop: 2 }}>{role}</div>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Recent trust ledger */}
                <Section title="Recent Trust Activity">
                  <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>User ID</th>
                            <th>Amount</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsData.recentLedger.slice(0, 15).map(row => (
                            <tr key={row.id}>
                              <td style={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'monospace' }}>{row.user_id?.slice(0, 8)}…</td>
                              <td style={{ color: (row.amount ?? 0) >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                                {(row.amount ?? 0) >= 0 ? '+' : ''}₮{row.amount}
                              </td>
                              <td>
                                <span style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                                  {TYPE_LABELS[row.type] || row.type}
                                </span>
                              </td>
                              <td style={{ color: '#64748b', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</td>
                              <td style={{ color: '#475569', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{new Date(row.created_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Section>
              </>
            )}
          </>
        )}

        {/* ── Disputes Tab ── */}
        {activeTab === 'disputes' && (
          <Section title="Dispute Management">
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Dispute</th>
                      <th>Buyer</th>
                      <th>Seller</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_DISPUTES.map(d => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600, color: '#f1f5f9' }}>{d.title}</td>
                        <td>{d.buyer}</td>
                        <td>{d.seller}</td>
                        <td style={{ color: '#38bdf8', fontWeight: 700 }}>£{d.amount}</td>
                        <td>
                          <span style={{ background: `${STATUS_COLORS[d.status]}15`, border: `1px solid ${STATUS_COLORS[d.status]}30`, borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: STATUS_COLORS[d.status] }}>
                            {d.status}
                          </span>
                        </td>
                        <td style={{ color: '#475569', fontSize: '0.78rem' }}>{d.created}</td>
                        <td>
                          <button style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 6, padding: '0.3rem 0.7rem', fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}

        {/* ── Fees & Reports Tab ── */}
        {activeTab === 'fees' && (
          <>
            <Section title="Platform Fee Settings">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'Services', fee: '8%', icon: '🔧', note: 'On all service transactions' },
                  { label: 'Products', fee: '5%', icon: '📦', note: 'On all product sales' },
                  { label: 'Communities', fee: '5%', icon: '🏘️', note: 'On paid memberships' },
                  { label: 'Job — Apply', fee: '₮5 Trust', icon: '💼', note: 'Trust awarded to applicant' },
                  { label: 'Job — Hire', fee: '₮25 Trust', icon: '🤝', note: 'Trust awarded to employer' },
                  { label: 'Event Hosting', fee: '₮15 Trust', icon: '🎪', note: 'Trust awarded to organiser' },
                ].map(f => (
                  <div key={f.label} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{f.icon}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>{f.label}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>{f.fee}</div>
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.3rem' }}>{f.note}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Report Generation">
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {[
                  { label: '⬇ Export Members CSV', color: '#38bdf8' },
                  { label: '⬇ Export Transactions CSV', color: '#a78bfa' },
                  { label: '⬇ Export Trust Ledger CSV', color: '#34d399' },
                  { label: '⬇ Export Revenue Report', color: '#fbbf24' },
                ].map(btn => (
                  <button key={btn.label} onClick={() => alert('Export feature coming soon')} style={{ background: `${btn.color}10`, border: `1px solid ${btn.color}25`, borderRadius: 8, padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: btn.color, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                    {btn.label}
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 14, padding: '1.75rem', maxWidth: 360, width: '90%' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              {confirmModal.action === 'suspend' ? 'Suspend User?' : 'Change Role?'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              {confirmModal.action === 'suspend'
                ? 'This will prevent the user from logging in. You can unsuspend them later.'
                : 'Select the new role for this user.'}
            </p>
            {confirmModal.action === 'role' && (
              <select style={{ background: '#0f172a', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 7, color: '#f1f5f9', padding: '0.5rem 0.75rem', fontSize: '0.88rem', width: '100%', marginBottom: '1rem', fontFamily: 'inherit' }}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="admin">Admin</option>
              </select>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)} style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 7, padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={() => setConfirmModal(null)} style={{ background: confirmModal.action === 'suspend' ? '#ef4444' : '#38bdf8', border: 'none', borderRadius: 7, padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', fontFamily: 'inherit' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
