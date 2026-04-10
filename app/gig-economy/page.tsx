'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type GigListing = {
  id: string
  title: string
  status: 'active' | 'paused' | 'draft'
  price: number
  currency: string
  review_count: number
  avg_rating: number
  product_type: string
}

type Order = {
  id: string
  listing_id: string | null
  title: string
  amount: number
  currency: string
  status: 'pending' | 'active' | 'completed' | 'disputed' | 'cancelled'
  created_at: string
  buyer?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

type Dispute = {
  id: string
  order_id: string
  reason: string
  details: string | null
  status: 'open' | 'resolved' | 'escalated'
  created_at: string
  raised_by: string
  against_user: string
  raiser?: { id: string; full_name: string | null; avatar_url: string | null } | null
  against?: { id: string; full_name: string | null; avatar_url: string | null } | null
  order?: { id: string; title: string; amount: number; status: string } | null
}

type WalletData = {
  balance: number
  currency: string
  pending_balance: number
}

type WalletTx = {
  id: string
  amount: number
  type: 'credit' | 'debit'
  description: string
  created_at: string
  reference_id: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  border: 'rgba(56,189,248,0.1)',
  accent: '#38bdf8',
  text: '#f1f5f9',
  muted: '#64748b',
  subtle: '#475569',
}

const TABS = [
  { id: 'analytics', label: '📊 Analytics' },
  { id: 'management', label: '⚙️ My Gigs' },
  { id: 'performance', label: '📈 Performance' },
  { id: 'disputes', label: '⚖️ Disputes' },
  { id: 'payments', label: '💳 Payments' },
]

function fmt(amount: number, cur = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: cur || 'EUR' }).format(amount)
}

function timeAgo(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active:    { bg: 'rgba(52,211,153,0.15)', color: '#34d399', label: 'Active' },
    paused:    { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Paused' },
    draft:     { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', label: 'Draft' },
    pending:   { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Pending' },
    completed: { bg: 'rgba(52,211,153,0.15)', color: '#34d399', label: 'Completed' },
    disputed:  { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Disputed' },
    cancelled: { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', label: 'Cancelled' },
    open:      { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Open' },
    resolved:  { bg: 'rgba(52,211,153,0.15)', color: '#34d399', label: 'Resolved' },
    escalated: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Escalated' },
  }
  const s = map[status] ?? { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', label: status }
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: string | number }) {
  return <div style={{ height: h, width: w, background: 'linear-gradient(90deg,#1e293b 25%,#273548 50%,#1e293b 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', borderRadius: 6 }} />
}

function Avatar({ url, name, size = 32 }: { url: string | null | undefined; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.35) + 'px', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{initials}</div>
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [gigCount, setGigCount] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [ordersThisWeek, setOrdersThisWeek] = useState(0)
  const [ordersThisMonth, setOrdersThisMonth] = useState(0)
  const [avgOrderValue, setAvgOrderValue] = useState(0)
  const [topGigs, setTopGigs] = useState<{ title: string; count: number }[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ label: string; value: number }[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const sb = createClient()
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const [gigsRes, ordersRes] = await Promise.allSettled([
          sb.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', userId),
          sb.from('orders').select('id, amount, status, created_at, title, listing_id').eq('seller_id', userId),
        ])

        if (gigsRes.status === 'fulfilled') setGigCount(gigsRes.value.count ?? 0)

        if (ordersRes.status === 'fulfilled' && ordersRes.value.data) {
          const orders = ordersRes.value.data
          setTotalOrders(orders.length)
          const completed = orders.filter(o => o.status === 'completed')
          const revenue = completed.reduce((sum: number, o: { amount: number }) => sum + (o.amount ?? 0), 0)
          setTotalRevenue(revenue)
          setAvgOrderValue(completed.length > 0 ? revenue / completed.length : 0)
          setOrdersThisWeek(orders.filter((o: { created_at: string }) => o.created_at >= weekAgo).length)
          setOrdersThisMonth(orders.filter((o: { created_at: string }) => o.created_at >= monthAgo).length)

          // Top gigs by order count
          const countMap: Record<string, { title: string; count: number }> = {}
          for (const o of orders) {
            if (o.listing_id) {
              countMap[o.listing_id] = { title: o.title || 'Untitled', count: (countMap[o.listing_id]?.count || 0) + 1 }
            }
          }
          setTopGigs(Object.values(countMap).sort((a, b) => b.count - a.count).slice(0, 5))

          // Monthly revenue (last 6 months)
          const monthly: Record<string, number> = {}
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const label = d.toLocaleDateString('en-IE', { month: 'short', year: '2-digit' })
            monthly[label] = 0
          }
          for (const o of completed) {
            const d = new Date(o.created_at)
            const label = d.toLocaleDateString('en-IE', { month: 'short', year: '2-digit' })
            if (label in monthly) monthly[label] += o.amount ?? 0
          }
          setMonthlyRevenue(Object.entries(monthly).map(([label, value]) => ({ label, value })))
        }
      } catch { /* use defaults */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId])

  const maxRev = Math.max(...monthlyRevenue.map(m => m.value), 1)

  const statCards = [
    { label: 'Total Gigs', value: gigCount.toString(), icon: '🎯', accent: C.accent },
    { label: 'Total Revenue', value: fmt(totalRevenue), icon: '💶', accent: '#34d399' },
    { label: 'Total Orders', value: totalOrders.toString(), icon: '📦', accent: '#a78bfa' },
    { label: 'Avg Order Value', value: fmt(avgOrderValue), icon: '📊', accent: '#fbbf24' },
    { label: 'Orders This Week', value: ordersThisWeek.toString(), icon: '📅', accent: '#fb923c' },
    { label: 'Orders This Month', value: ordersThisMonth.toString(), icon: '🗓️', accent: '#f472b6' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '1rem' }}>
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '1rem' }}>
            <Skeleton h={10} w="60%" />
            <div style={{ marginTop: 10 }}><Skeleton h={28} w="80%" /></div>
          </div>
        )) : statCards.map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: s.accent, letterSpacing: '-0.5px' }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: 2, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>Revenue — Last 6 Months</div>
        {loading ? <Skeleton h={80} /> : monthlyRevenue.every(m => m.value === 0) ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: C.muted, fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
            No revenue yet — your completed order earnings will appear here
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: 100 }}>
            {monthlyRevenue.map(m => (
              <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: '0.6rem', color: C.muted }}>{m.value > 0 ? fmt(m.value) : ''}</div>
                <div style={{ width: '100%', background: m.value > 0 ? `linear-gradient(to top,${C.accent},rgba(56,189,248,0.5))` : '#1e3a4a', borderRadius: '4px 4px 0 0', height: Math.max((m.value / maxRev) * 80, m.value > 0 ? 4 : 2) + 'px', transition: 'height 0.5s' }} />
                <div style={{ fontSize: '0.62rem', color: C.subtle, whiteSpace: 'nowrap' }}>{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top gigs */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>Top Performing Gigs</div>
        {loading ? <Skeleton h={60} /> : topGigs.length === 0 ? (
          <div style={{ color: C.muted, fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>No orders yet — create your first gig to get started</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {topGigs.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#0f172a', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
                <div style={{ fontSize: '0.75rem', color: C.accent, fontWeight: 700, flexShrink: 0 }}>{g.count} order{g.count !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Management Tab ────────────────────────────────────────────────────────────

function ManagementTab({ userId }: { userId: string }) {
  const [gigs, setGigs] = useState<GigListing[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const loadGigs = useCallback(async () => {
    try {
      const sb = createClient()
      const { data } = await sb.from('listings').select('id, title, status, price, currency, review_count, avg_rating, product_type').eq('seller_id', userId).order('created_at', { ascending: false })
      setGigs((data as GigListing[]) ?? [])
    } catch { /* empty */ } finally { setLoading(false) }
  }, [userId])

  useEffect(() => { loadGigs() }, [loadGigs])

  const toggleStatus = async (gig: GigListing) => {
    const next = gig.status === 'active' ? 'paused' : 'active'
    setToggling(gig.id)
    try {
      await fetch(`/api/listings/${gig.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
      setGigs(prev => prev.map(g => g.id === gig.id ? { ...g, status: next } : g))
    } catch { /* silent */ } finally { setToggling(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/seller/gigs/create" style={{ background: `linear-gradient(135deg,${C.accent},#818cf8)`, color: '#fff', borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          + Create New Gig
        </Link>
      </div>

      {loading ? Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}><Skeleton h={14} w="60%" /><div style={{ marginTop: 8 }}><Skeleton h={10} w="30%" /></div></div>
          <Skeleton h={32} w={80} />
        </div>
      )) : gigs.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '3rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎯</div>
          <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem' }}>No gigs yet</div>
          <div style={{ color: C.muted, fontSize: '0.85rem', marginBottom: '1.25rem' }}>Create your first gig to start earning</div>
          <Link href="/seller/gigs/create" style={{ background: C.accent, color: '#0f172a', borderRadius: 8, padding: '0.65rem 1.5rem', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>
            Create First Gig
          </Link>
        </div>
      ) : gigs.map(gig => (
        <div key={gig.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gig.title}</div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={gig.status} />
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: C.text }}>€{gig.price?.toFixed(2)}</span>
              {gig.avg_rating > 0 && <span style={{ fontSize: '0.72rem', color: '#fbbf24' }}>★ {Number(gig.avg_rating).toFixed(1)}</span>}
              {gig.review_count > 0 && <span style={{ fontSize: '0.72rem', color: C.muted }}>({gig.review_count})</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
            <Link href={`/${gig.product_type === 'service' ? 'services' : 'products'}/${gig.id}`} style={{ padding: '0.4rem 0.85rem', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: '0.75rem', color: C.muted, textDecoration: 'none', fontWeight: 600 }}>View</Link>
            <button
              onClick={() => toggleStatus(gig)}
              disabled={toggling === gig.id}
              style={{ padding: '0.4rem 0.85rem', borderRadius: 8, border: `1px solid ${gig.status === 'active' ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)'}`, fontSize: '0.75rem', color: gig.status === 'active' ? '#fbbf24' : '#34d399', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', opacity: toggling === gig.id ? 0.5 : 1 }}
            >
              {toggling === gig.id ? '...' : gig.status === 'active' ? 'Pause' : 'Activate'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Performance Tab ───────────────────────────────────────────────────────────

function PerformanceTab({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const load = async () => {
      try {
        const sb = createClient()
        const { data } = await sb
          .from('orders')
          .select('id, listing_id, title, amount, currency, status, created_at, buyer:profiles!buyer_id(id, full_name, avatar_url)')
          .eq('seller_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
        setOrders((data as unknown as Order[]) ?? [])
      } catch { /* mock */ } finally { setLoading(false) }
    }
    load()
  }, [userId])

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const statuses = ['all', 'pending', 'active', 'completed', 'disputed', 'cancelled']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: filter === s ? C.accent : 'rgba(56,189,248,0.08)', color: filter === s ? '#0f172a' : C.muted, textTransform: 'capitalize' }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.9rem 1rem' }}>
          <Skeleton h={14} w="50%" />
          <div style={{ marginTop: 8 }}><Skeleton h={10} w="30%" /></div>
        </div>
      )) : filtered.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '3rem 1rem', textAlign: 'center', color: C.muted }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
          <div>No orders found {filter !== 'all' ? `with status "${filter}"` : 'yet'}</div>
        </div>
      ) : filtered.map(order => (
        <div key={order.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Avatar url={order.buyer?.avatar_url} name={order.buyer?.full_name || 'Buyer'} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.title || 'Order'}</div>
            <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>
              {order.buyer?.full_name || 'Buyer'} · {timeAgo(order.created_at)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <StatusBadge status={order.status} />
            <span style={{ fontSize: '0.88rem', fontWeight: 900, color: C.text }}>€{Number(order.amount).toFixed(2)}</span>
            {order.status === 'completed' && (
              <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 700 }}>₮ Trust Earned</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Disputes Tab ──────────────────────────────────────────────────────────────

function DisputesTab({ userId }: { userId: string }) {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [escalateId, setEscalateId] = useState<string | null>(null)
  const [escalateText, setEscalateText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/disputes')
        if (res.ok) {
          const data = await res.json()
          setDisputes(data.disputes ?? [])
        }
      } catch { /* silent */ } finally { setLoading(false) }
    }
    load()
  }, [])

  const handleEscalate = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 800)) // simulated submit
    setSubmitting(false)
    setSubmitted(true)
    setTimeout(() => { setEscalateId(null); setEscalateText(''); setSubmitted(false) }, 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {loading ? Array.from({ length: 2 }).map((_, i) => (
        <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem' }}>
          <Skeleton h={14} w="60%" />
          <div style={{ marginTop: 8 }}><Skeleton h={10} w="40%" /></div>
        </div>
      )) : disputes.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '3rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚖️</div>
          <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem' }}>No disputes</div>
          <div style={{ color: C.muted, fontSize: '0.85rem' }}>You have no open or past disputes. Keep up the great work!</div>
        </div>
      ) : disputes.map(dispute => {
        const isRaiser = dispute.raised_by === userId
        const otherParty = isRaiser ? dispute.against : dispute.raiser
        return (
          <div key={dispute.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.3rem' }}>{dispute.order?.title || 'Order Dispute'}</div>
                <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: '0.35rem' }}>
                  {isRaiser ? 'Against: ' : 'Raised by: '}<span style={{ color: '#94a3b8', fontWeight: 600 }}>{(otherParty as { full_name?: string | null } | null | undefined)?.full_name || 'Member'}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: C.subtle }}>
                  <strong style={{ color: C.muted }}>Reason:</strong> {dispute.reason}
                </div>
                {dispute.details && <div style={{ fontSize: '0.75rem', color: C.subtle, marginTop: '0.25rem' }}>{dispute.details}</div>}
                <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: '0.4rem' }}>{timeAgo(dispute.created_at)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                <StatusBadge status={dispute.status} />
                {dispute.status === 'open' && (
                  <button
                    onClick={() => setEscalateId(dispute.id)}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.72rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}
                  >
                    Raise with Admin
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Escalate modal */}
      {escalateId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '1.5rem', maxWidth: 420, width: '100%' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>Raise with Admin</h3>
            <p style={{ color: C.muted, fontSize: '0.85rem', margin: '0 0 1rem', lineHeight: 1.6 }}>
              Provide any additional context or evidence for this dispute. Our team will review and respond within 24-48 hours.
            </p>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#34d399', fontWeight: 700 }}>✅ Escalated successfully!</div>
            ) : (
              <>
                <textarea
                  value={escalateText}
                  onChange={e => setEscalateText(e.target.value)}
                  placeholder="Describe your concern and any relevant details..."
                  rows={4}
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: '0.65rem 0.9rem', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button onClick={() => setEscalateId(null)} style={{ padding: '0.55rem 1rem', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>Cancel</button>
                  <button onClick={handleEscalate} disabled={submitting || !escalateText.trim()} style={{ padding: '0.55rem 1rem', borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? 'Sending...' : 'Send to Admin'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Payments Tab ──────────────────────────────────────────────────────────────

const MOCK_TXS: WalletTx[] = [
  { id: '1', amount: 85.00, type: 'credit', description: 'Payment for SEO & Content Strategy', created_at: new Date(Date.now() - 86400000).toISOString(), reference_id: null },
  { id: '2', amount: 12.50, type: 'debit', description: 'Platform fee — Order #1234', created_at: new Date(Date.now() - 172800000).toISOString(), reference_id: null },
  { id: '3', amount: 200.00, type: 'credit', description: 'Payment for B2B Sales Outreach System', created_at: new Date(Date.now() - 345600000).toISOString(), reference_id: null },
  { id: '4', amount: 35.00, type: 'credit', description: 'Signup bonus', created_at: new Date(Date.now() - 432000000).toISOString(), reference_id: null },
]

function PaymentsTab({ userId }: { userId: string }) {
  const router = useRouter()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [txs, setTxs] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [withdrawModal, setWithdrawModal] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [walletRes, txRes] = await Promise.allSettled([
          fetch('/api/wallet'),
          (async () => {
            const sb = createClient()
            const { data } = await sb.from('wallet_transactions').select('id, amount, type, description, created_at, reference_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
            return data
          })(),
        ])

        if (walletRes.status === 'fulfilled' && walletRes.value.ok) {
          const d = await walletRes.value.json()
          setWallet({ balance: d.balance ?? 0, currency: d.currency ?? 'EUR', pending_balance: d.pending_balance ?? 0 })
        } else {
          setWallet({ balance: 0, currency: 'EUR', pending_balance: 0 })
        }

        if (txRes.status === 'fulfilled' && txRes.value && txRes.value.length > 0) {
          setTxs(txRes.value as WalletTx[])
        } else {
          setTxs(MOCK_TXS)
        }
      } catch {
        setWallet({ balance: 0, currency: 'EUR', pending_balance: 0 })
        setTxs(MOCK_TXS)
      } finally { setLoading(false) }
    }
    load()
  }, [userId])

  const earned = txs.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const spent = txs.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Wallet summary */}
      {loading ? <Skeleton h={120} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '1rem' }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(129,140,248,0.1))', border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Wallet Balance</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: C.accent }}>{fmt(wallet?.balance ?? 0, wallet?.currency)}</div>
            {(wallet?.pending_balance ?? 0) > 0 && <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: 4 }}>₮{wallet?.pending_balance?.toFixed(2)} pending</div>}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Total Earned</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399' }}>{fmt(earned)}</div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Fees Paid</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f87171' }}>{fmt(spent)}</div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link href="/wallet" style={{ background: C.accent, color: '#0f172a', borderRadius: 10, padding: '0.65rem 1.25rem', fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          💳 Top Up Wallet
        </Link>
        <button
          onClick={() => setWithdrawModal(true)}
          style={{ background: 'rgba(56,189,248,0.08)', border: `1px solid ${C.border}`, color: C.accent, borderRadius: 10, padding: '0.65rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          🏦 Withdraw
        </button>
      </div>

      {/* Transaction history */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '0.9rem 1rem', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: '0.88rem' }}>Transaction History</div>
        {loading ? (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={36} />)}
          </div>
        ) : txs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: C.muted, fontSize: '0.85rem' }}>No transactions yet</div>
        ) : (
          <div>
            {txs.map((tx, i) => (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderBottom: i < txs.length - 1 ? `1px solid rgba(56,189,248,0.05)` : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: tx.type === 'credit' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                  {tx.type === 'credit' ? '↓' : '↑'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                  <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: 2 }}>{timeAgo(tx.created_at)}</div>
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: tx.type === 'credit' ? '#34d399' : '#f87171', flexShrink: 0 }}>
                  {tx.type === 'credit' ? '+' : '-'}{fmt(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdraw modal */}
      {withdrawModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '1.5rem', maxWidth: 380, width: '100%' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>🏦 Withdraw Funds</h3>
            <p style={{ color: C.muted, fontSize: '0.88rem', lineHeight: 1.65, margin: '0 0 1.25rem' }}>
              Withdrawals are processed within <strong style={{ color: C.text }}>2–3 business days</strong> via bank transfer. For assistance, contact us at{' '}
              <a href="mailto:support@freetrust.co" style={{ color: C.accent }}>support@freetrust.co</a>.
            </p>
            <button onClick={() => setWithdrawModal(false)} style={{ width: '100%', padding: '0.75rem', borderRadius: 10, background: C.accent, border: 'none', color: '#0f172a', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GigEconomyPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('analytics')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      setAuthLoading(false)
    })
  }, [router])

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif', paddingBottom: 80 }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        .ge-tab-btn:hover { color: #e2e8f0 !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.08),rgba(129,140,248,0.05))', borderBottom: `1px solid ${C.border}`, padding: '1.5rem 1.25rem 0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1.8rem' }}>💰</div>
            <div>
              <h1 style={{ fontSize: 'clamp(1.3rem,4vw,1.8rem)', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>Gig Economy</h1>
              <p style={{ color: C.muted, margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Manage your gigs, track earnings and handle disputes</p>
            </div>
            <Link href="/seller/gigs/create" style={{ marginLeft: 'auto', background: `linear-gradient(135deg,${C.accent},#818cf8)`, color: '#fff', borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              + New Gig
            </Link>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none', marginTop: '0.5rem' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                className="ge-tab-btn"
                onClick={() => setActiveTab(tab.id)}
                style={{ padding: '0.85rem 1.1rem', background: 'none', border: 'none', borderBottom: activeTab === tab.id ? `2px solid ${C.accent}` : '2px solid transparent', color: activeTab === tab.id ? C.accent : C.muted, fontWeight: activeTab === tab.id ? 700 : 500, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, transition: 'color 0.15s', marginBottom: -1 }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem' }}>
        {userId && activeTab === 'analytics'   && <AnalyticsTab userId={userId} />}
        {userId && activeTab === 'management'  && <ManagementTab userId={userId} />}
        {userId && activeTab === 'performance' && <PerformanceTab userId={userId} />}
        {userId && activeTab === 'disputes'    && <DisputesTab userId={userId} />}
        {userId && activeTab === 'payments'    && <PaymentsTab userId={userId} />}
      </div>
    </div>
  )
}
