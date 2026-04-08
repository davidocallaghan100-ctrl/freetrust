'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const quickLinks = [
  { label: 'Post a Service', href: '/services', icon: '🛠️', color: '#38bdf8' },
  { label: 'List a Product', href: '/products', icon: '📦', color: '#a78bfa' },
  { label: 'Create Event', href: '/events', icon: '🗓️', color: '#34d399' },
  { label: 'Write Article', href: '/articles', icon: '✍️', color: '#fbbf24' },
  { label: 'Join Community', href: '/community', icon: '🤝', color: '#f472b6' },
  { label: 'View Wallet', href: '/wallet', icon: '💳', color: '#fb923c' },
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
  twoCol: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '1.5rem', alignItems: 'start' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' },
  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.6rem', marginBottom: '1.5rem' },
  quickLink: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem', background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 8, textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', transition: 'all 0.15s' },
  emptyState: { textAlign: 'center', padding: '3rem 1rem', color: '#64748b' },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string } } | null>(null)
  const [trust, setTrust] = useState<{ balance: number; lifetime: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
          router.push('/login?redirect=/dashboard')
          return
        }
        setUser(user)

        // Fetch trust balance
        const res = await fetch('/api/trust')
        if (res.ok) {
          const data = await res.json()
          setTrust({ balance: data.balance, lifetime: data.lifetime })
        }
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b' }}>Loading your dashboard…</div>
      </div>
    )
  }

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.headerInner}>
          <div>
            <div style={S.greeting}>{getGreeting()}, {displayName} 👋</div>
            <div style={S.greetingSub}>Here&apos;s what&apos;s happening with your FreeTrust account</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/browse" style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8', textDecoration: 'none' }}>
              Browse Marketplace
            </Link>
            <Link href="/services" style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>
              + New Listing
            </Link>
          </div>
        </div>
      </div>

      <div style={S.inner}>
        {/* Stats */}
        <div style={S.statsGrid}>
          <div style={S.statCard}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⭐</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{trust?.balance ?? '–'}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>Trust Score</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>Lifetime: {trust?.lifetime ?? 0}</div>
          </div>
          <div style={S.statCard}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>0</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>Active Listings</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
              <Link href="/services" style={{ color: '#38bdf8' }}>Create your first →</Link>
            </div>
          </div>
        </div>

        <div style={{ ...S.twoCol, gridTemplateColumns: 'minmax(0,1fr) minmax(0,300px)' }}>
          {/* Main column */}
          <div>
            <div style={S.card}>
              <div style={S.cardTitle}>Recent Activity</div>
              <div style={S.emptyState}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌱</div>
                <div>No activity yet. Start by creating a listing or joining a community.</div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
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

            <div style={{ ...S.card, background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.15)', marginBottom: 0 }}>
              <div style={S.cardTitle}>🌱 Your Impact</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399' }}>£0.00</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                contributed to Impact Fund
              </div>
              <Link href="/impact" style={{ fontSize: '0.82rem', color: '#34d399', textDecoration: 'none' }}>
                Learn about Impact →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
