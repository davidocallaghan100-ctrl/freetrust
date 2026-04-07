'use client'
import React from 'react'
import Link from 'next/link'

const stats = [
  { label: 'Trust Score', value: '96', unit: '/100', change: '+2', positive: true, icon: '⭐' },
  { label: 'Total Earned', value: '£1,840', unit: '', change: '+£405 this week', positive: true, icon: '💰' },
  { label: 'Active Listings', value: '8', unit: '', change: '2 pending review', positive: null, icon: '📋' },
  { label: 'Community Posts', value: '34', unit: '', change: '+124 reach', positive: true, icon: '📣' },
]

const recentActivity = [
  { icon: '💬', text: 'Tom Walsh messaged you about Brand Identity Design', time: '2h ago', type: 'message' },
  { icon: '⭐', text: 'Lena Fischer left you a 5-star review', time: '4h ago', type: 'review' },
  { icon: '🛒', text: 'New order: SEO Audit from Marcus Obi · £320', time: '6h ago', type: 'order' },
  { icon: '👥', text: '12 people joined SaaS Builders Circle after your post', time: '1d ago', type: 'community' },
  { icon: '📰', text: 'Your article "Building with Trust" got 234 claps', time: '2d ago', type: 'article' },
  { icon: '🌱', text: '£4.54 contributed to Pacific Plastic Clean-Up via Impact Fund', time: '2d ago', type: 'impact' },
]

const quickLinks = [
  { label: 'Post a Service', href: '/services', icon: '🛠️', color: '#38bdf8' },
  { label: 'List a Product', href: '/products', icon: '📦', color: '#a78bfa' },
  { label: 'Create Event', href: '/events', icon: '🗓️', color: '#34d399' },
  { label: 'Write Article', href: '/articles', icon: '✍️', color: '#fbbf24' },
  { label: 'Join Community', href: '/community', icon: '🤝', color: '#f472b6' },
  { label: 'View Wallet', href: '/wallet', icon: '💳', color: '#fb923c' },
]

const pendingTasks = [
  { text: 'Complete your profile (70% done)', priority: 'medium' },
  { text: 'Verify your email address', priority: 'high' },
  { text: 'Add your first service listing', priority: 'medium' },
  { text: 'Connect your bank account for withdrawals', priority: 'low' },
]

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  header: { borderBottom: '1px solid rgba(56,189,248,0.08)', padding: '1.5rem', background: 'rgba(56,189,248,0.02)' },
  headerInner: { maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' },
  greeting: { fontSize: '1.5rem', fontWeight: 800 },
  greetingSub: { color: '#64748b', fontSize: '0.88rem', marginTop: '0.2rem' },
  inner: { maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: '1rem', marginBottom: '2rem' },
  statCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' },
  statIcon: { fontSize: '1.5rem', marginBottom: '0.5rem' },
  statVal: { fontSize: '1.8rem', fontWeight: 800, color: '#f1f5f9' },
  statUnit: { fontSize: '1rem', color: '#64748b', fontWeight: 400 },
  statLabel: { fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' },
  statChange: { fontSize: '0.75rem', marginTop: '0.4rem', fontWeight: 600 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' },
  activityItem: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem', paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(56,189,248,0.04)' },
  actIcon: { width: 32, height: 32, borderRadius: '50%', background: 'rgba(56,189,248,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 },
  actText: { fontSize: '0.85rem', color: '#cbd5e1', flex: 1, lineHeight: 1.4 },
  actTime: { fontSize: '0.75rem', color: '#475569', marginTop: '0.15rem' },
  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.6rem', marginBottom: '1.5rem' },
  quickLink: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem', background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 8, textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', transition: 'all 0.15s' },
  taskItem: { display: 'flex', alignItems: 'center', gap: '0.6rem', paddingBottom: '0.65rem', marginBottom: '0.65rem', borderBottom: '1px solid rgba(56,189,248,0.04)', fontSize: '0.82rem', color: '#94a3b8' },
  taskDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
}

const priorityColors: Record<string, string> = { high: '#f87171', medium: '#fbbf24', low: '#64748b' }

export default function DashboardPage() {
  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.headerInner}>
          <div>
            <div style={S.greeting}>Good morning, David 👋</div>
            <div style={S.greetingSub}>Here&apos;s what&apos;s happening with your FreeTrust account</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8', cursor: 'pointer' }}>View Profile</button>
            <button style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>+ New Listing</button>
          </div>
        </div>
      </div>

      <div style={S.inner}>
        {/* Stats */}
        <div style={S.statsGrid}>
          {stats.map(s => (
            <div key={s.label} style={S.statCard}>
              <div style={S.statIcon}>{s.icon}</div>
              <div>
                <span style={S.statVal}>{s.value}</span>
                <span style={S.statUnit}>{s.unit}</span>
              </div>
              <div style={S.statLabel}>{s.label}</div>
              <div style={{ ...S.statChange, color: s.positive === true ? '#34d399' : s.positive === false ? '#f87171' : '#64748b' }}>
                {s.change}
              </div>
            </div>
          ))}
        </div>

        <div style={S.twoCol}>
          {/* Main column */}
          <div>
            {/* Recent Activity */}
            <div style={S.card}>
              <div style={S.cardTitle}>Recent Activity</div>
              {recentActivity.map((a, i) => (
                <div key={i} style={{ ...S.activityItem, ...(i === recentActivity.length - 1 ? { borderBottom: 'none', marginBottom: 0, paddingBottom: 0 } : {}) }}>
                  <div style={S.actIcon}>{a.icon}</div>
                  <div>
                    <div style={S.actText}>{a.text}</div>
                    <div style={S.actTime}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Metrics bar */}
            <div style={S.card}>
              <div style={S.cardTitle}>Profile Views This Week</div>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'flex-end', height: 80 }}>
                {[42, 67, 55, 89, 74, 112, 98].map((h, i) => (
                  <div key={i} style={{ flex: 1, background: i === 6 ? '#38bdf8' : 'rgba(56,189,248,0.2)', borderRadius: '3px 3px 0 0', height: `${(h / 112) * 100}%` }} title={`${h} views`} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.72rem', color: '#475569' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>537 views this week · <span style={{ color: '#34d399' }}>+23% vs last week</span></div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            {/* Quick actions */}
            <div style={S.card}>
              <div style={S.cardTitle}>Quick Actions</div>
              <div style={S.quickGrid}>
                {quickLinks.map(l => (
                  <Link key={l.href} href={l.href} style={S.quickLink}>
                    <span style={{ fontSize: '1rem' }}>{l.icon}</span>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Pending tasks */}
            <div style={S.card}>
              <div style={S.cardTitle}>To-Do List</div>
              {pendingTasks.map((t, i) => (
                <div key={i} style={{ ...S.taskItem, ...(i === pendingTasks.length - 1 ? { borderBottom: 'none', marginBottom: 0, paddingBottom: 0 } : {}) }}>
                  <div style={{ ...S.taskDot, background: priorityColors[t.priority] }} />
                  {t.text}
                </div>
              ))}
            </div>

            {/* Impact snapshot */}
            <div style={{ ...S.card, background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.15)', marginBottom: 0 }}>
              <div style={S.cardTitle}>🌱 Your Impact</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399' }}>£18.40</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', marginBottom: '0.75rem' }}>contributed to Impact Fund to date</div>
              <Link href="/impact" style={{ fontSize: '0.82rem', color: '#34d399', textDecoration: 'none' }}>See your projects →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
