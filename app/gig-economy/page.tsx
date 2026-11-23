'use client'
import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient, getStoredSessionCredentials } from '@/lib/supabase/client'

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
  orderId: string
  listing_id: string | null
  title: string
  amount: number
  amountLabel: string
  currency: string
  status: string
  created_at: string
  buyer?: SellerProfileSummary | null
  isBasketItem?: boolean
  payoutReady?: boolean
}

type SellerProfileSummary = { id?: string; full_name: string | null; avatar_url: string | null }
type SellerOrderRow = {
  id: string
  listing_id: string | null
  title: string | null
  type?: string | null
  delivery_type?: string | null
  amount: number | null
  payment_amount_cents?: number | null
  seller_payout_cents?: number | null
  seller_fee_cents?: number | null
  currency: string | null
  status: string
  created_at: string
  buyer_profile?: SellerProfileSummary | null
}
type SellerBasketItem = {
  id: string
  listing_id: string | null
  title: string
  subtotal_cents: number | null
  seller_payout_cents: number | null
  payout_ready: boolean
  delivery_status: string | null
  created_at?: string
  buyer_profile?: SellerProfileSummary | null
}
type SellerBasketOrder = {
  id: string
  status: string
  currency: string | null
  created_at: string
  items?: SellerBasketItem[]
}
type SellerOrdersPayload = { orders?: SellerOrderRow[]; basketOrders?: SellerBasketOrder[] }
type SellerSale = {
  id: string
  orderId: string
  listingId: string | null
  title: string
  status: string
  orderStatus: string
  createdAt: string
  currency: string
  grossEur: number
  payoutEur: number
  earnedEur: number
  payoutReady: boolean
  isBasketItem: boolean
  buyer: SellerProfileSummary | null
}

function safeNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function getRegularOrderGrossCents(order: SellerOrderRow) {
  if (order.payment_amount_cents != null) return Math.max(0, Math.round(safeNumber(order.payment_amount_cents)))

  // Marketplace checkout orders store `amount` in cents. Custom proposals
  // and Rent & Share escrow orders store it in euros; the latter uses the
  // in_person delivery type and pays the full booking amount into the seller
  // wallet after buyer check-in.
  const amount = safeNumber(order.amount)
  const storedInEuros = order.type === 'custom' || order.delivery_type === 'in_person'
  return Math.max(0, Math.round(amount * (storedInEuros ? 100 : 1)))
}

function getRegularOrderPayoutCents(order: SellerOrderRow, grossCents: number) {
  if (order.seller_payout_cents != null) return Math.max(0, Math.round(safeNumber(order.seller_payout_cents)))
  if (order.seller_fee_cents != null) return Math.max(0, grossCents - Math.round(safeNumber(order.seller_fee_cents)))

  // Mirror the payout calculation in PATCH /api/orders/[id]. Rent & Share
  // bookings use the wallet ledger's full amount rather than the marketplace
  // seller-fee settlement path.
  const feeRate = order.delivery_type === 'in_person' ? 0 : order.type === 'product' ? 0.05 : 0.08
  return Math.max(0, grossCents - Math.round(grossCents * feeRate))
}

async function fetchSellerOrders(): Promise<SellerOrdersPayload> {
  const response = await fetch('/api/orders?role=seller', { cache: 'no-store' })
  const payload = await response.json().catch(() => null) as (SellerOrdersPayload & { error?: string }) | null
  if (!response.ok) throw new Error(payload?.error || 'Could not load your sales and product orders.')
  return payload ?? { orders: [], basketOrders: [] }
}

function getSellerSales(payload: SellerOrdersPayload): SellerSale[] {
  const regularSales = (payload.orders ?? []).map(order => {
    const grossCents = getRegularOrderGrossCents(order)
    const payoutCents = getRegularOrderPayoutCents(order, grossCents)
    return {
      id: order.id,
      orderId: order.id,
      listingId: order.listing_id,
      title: order.title || 'Marketplace order',
      status: order.status,
      orderStatus: order.status,
      createdAt: order.created_at,
      currency: order.currency || 'EUR',
      grossEur: grossCents / 100,
      payoutEur: payoutCents / 100,
      earnedEur: order.status === 'completed' ? payoutCents / 100 : 0,
      payoutReady: order.status === 'completed',
      isBasketItem: false,
      buyer: order.buyer_profile ?? null,
    }
  })

  const basketSales = (payload.basketOrders ?? []).flatMap(order => (order.items ?? []).map(item => {
    const payoutReady = item.payout_ready === true
    const payoutCents = safeNumber(item.seller_payout_cents)
    return {
      id: item.id,
      orderId: order.id,
      listingId: item.listing_id,
      title: item.title || 'Product basket item',
      status: item.delivery_status || order.status,
      orderStatus: order.status,
      createdAt: item.created_at || order.created_at,
      currency: order.currency || 'EUR',
      grossEur: safeNumber(item.subtotal_cents) / 100,
      payoutEur: payoutCents / 100,
      earnedEur: payoutReady && order.status !== 'refunded' && order.status !== 'cancelled' ? payoutCents / 100 : 0,
      payoutReady,
      isBasketItem: true,
      buyer: item.buyer_profile ?? null,
    }
  }))

  return [...regularSales, ...basketSales].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

type Dispute = {
  id: string
  order_id: string
  reason: string
  details: string | null
  status: 'open' | 'under_review' | 'resolved' | 'escalated' | 'closed'
  created_at: string
  raised_by: string
  against_user: string
  raiser?: { id: string; full_name: string | null; avatar_url: string | null } | null
  against?: { id: string; full_name: string | null; avatar_url: string | null } | null
  order?: { id: string; title: string; amount: number; status: string } | null
}

type WalletData = {
  available: number
  pendingPayout: number
  totalEarned: number
  totalSpent: number
  totalDeposited: number
  trustBalance: number
}

type WalletTx = {
  id: string
  category: 'earned' | 'spent' | 'pending' | 'withdrawn' | 'trust' | 'deposit' | 'transfer_sent' | 'transfer_received'
  amount: number
  currency: 'EUR' | 'TRUST'
  description: string
  date: string
  status: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const C = {
  bg: 'var(--ft-bg)',
  card: 'var(--ft-surface)',
  border: 'rgba(56,189,248,0.1)',
  accent: 'var(--ft-accent)',
  text: 'var(--ft-text)',
  muted: 'var(--ft-text-tertiary)',
  subtle: 'var(--ft-text-faint)',
}

const TABS = [
  { id: 'analytics', label: '📊 Analytics' },
  { id: 'management', label: '⚙️ My Gigs' },
  { id: 'bookings', label: '🏠 Bookings' },
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
    draft:     { bg: 'rgba(148,163,184,0.12)', color: 'var(--ft-text-secondary)', label: 'Draft' },
    pending:   { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Pending' },
    pending_escrow: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Payment pending' },
    paid:      { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', label: 'Paid' },
    in_progress: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', label: 'In progress' },
    processing: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', label: 'Processing' },
    shipped:   { bg: 'rgba(129,140,248,0.15)', color: '#818cf8', label: 'Shipped' },
    delivered: { bg: 'rgba(129,140,248,0.15)', color: '#818cf8', label: 'Delivered' },
    completed: { bg: 'rgba(52,211,153,0.15)', color: '#34d399', label: 'Completed' },
    disputed:  { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Disputed' },
    cancelled: { bg: 'rgba(148,163,184,0.12)', color: 'var(--ft-text-secondary)', label: 'Cancelled' },
    open:      { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Open' },
    under_review: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', label: 'Under review' },
    resolved:  { bg: 'rgba(52,211,153,0.15)', color: '#34d399', label: 'Resolved' },
    escalated: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Escalated' },
  }
  const s = map[status] ?? { bg: 'rgba(148,163,184,0.12)', color: 'var(--ft-text-secondary)', label: status }
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: string | number }) {
  return <div style={{ height: h, width: w, background: 'linear-gradient(90deg,var(--ft-surface) 25%,#273548 50%,var(--ft-surface) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', borderRadius: 6 }} />
}

function Avatar({ url, name, size = 32 }: { url: string | null | undefined; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,var(--ft-accent),#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.35) + 'px', fontWeight: 700, color: 'var(--ft-bg)', flexShrink: 0 }}>{initials}</div>
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gigCount, setGigCount] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [ordersThisWeek, setOrdersThisWeek] = useState(0)
  const [ordersThisMonth, setOrdersThisMonth] = useState(0)
  const [avgOrderValue, setAvgOrderValue] = useState(0)
  const [topGigs, setTopGigs] = useState<{ title: string; count: number }[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sellerOrders, gigsResult] = await Promise.all([
        fetchSellerOrders(),
        createClient().from('listings').select('id, title').eq('seller_id', userId),
      ])
      if (gigsResult.error) throw new Error('Could not load your gigs.')

      const sales = getSellerSales(sellerOrders)
      const countable = sales.filter(sale =>
        !['cancelled', 'refunded'].includes(sale.orderStatus)
        && !['cancelled', 'refunded'].includes(sale.status),
      )
      const now = new Date()
      const nowMs = now.getTime()
      const weekStart = nowMs - 7 * 24 * 60 * 60 * 1000
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      const earned = sales
        .filter(sale => !['cancelled', 'refunded'].includes(sale.orderStatus))
        .reduce((sum, sale) => sum + sale.earnedEur, 0)

      const gigCounts = new Map<string, { title: string; count: number }>()
      for (const sale of countable) {
        const key = sale.listingId || sale.title
        const current = gigCounts.get(key)
        gigCounts.set(key, { title: sale.title, count: (current?.count ?? 0) + 1 })
      }

      const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1))
      const revenueByMonth = months.map(month => {
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime()
        const value = sales
          .filter(sale => {
            const createdAt = Date.parse(sale.createdAt)
            return createdAt >= month.getTime() && createdAt < monthEnd
              && !['cancelled', 'refunded'].includes(sale.orderStatus)
          })
          .reduce((sum, sale) => sum + sale.earnedEur, 0)
        return { label: month.toLocaleDateString('en-IE', { month: 'short' }), value }
      })

      setGigCount(gigsResult.data?.length ?? 0)
      setTotalRevenue(earned)
      setTotalOrders(countable.length)
      setOrdersThisWeek(countable.filter(sale => Date.parse(sale.createdAt) >= weekStart && Date.parse(sale.createdAt) <= nowMs).length)
      setOrdersThisMonth(countable.filter(sale => Date.parse(sale.createdAt) >= monthStart && Date.parse(sale.createdAt) <= nowMs).length)
      setAvgOrderValue(countable.length ? countable.reduce((sum, sale) => sum + sale.grossEur, 0) / countable.length : 0)
      setTopGigs(Array.from(gigCounts.values()).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)).slice(0, 5))
      setMonthlyRevenue(revenueByMonth)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load Earn analytics.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void load() }, [load])

  if (error) {
    return (
      <div role="alert" style={{ background: C.card, border: '1px solid rgba(248,113,113,.35)', borderRadius: 14, padding: '1.25rem', color: C.text }}>
        <div style={{ fontWeight: 800, marginBottom: 5 }}>Your Earn analytics could not be loaded</div>
        <div style={{ color: C.muted, fontSize: '0.85rem' }}>{error}</div>
        <button type="button" onClick={() => void load()} style={{ marginTop: 14, minHeight: 44, padding: '0.6rem 1rem', border: 0, borderRadius: 9, background: C.accent, color: 'var(--ft-bg)', font: 'inherit', fontWeight: 800, cursor: 'pointer' }}>Try again</button>
      </div>
    )
  }

  const maxRev = Math.max(...monthlyRevenue.map(m => m.value), 1)

  const statCards = [
    { label: 'Total Listings', value: gigCount.toString(), icon: '🎯', accent: C.accent },
    { label: 'Seller Earnings', value: fmt(totalRevenue), icon: '💶', accent: '#34d399' },
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
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>Paid earnings — Last 6 Months</div>
        {loading ? <Skeleton h={80} /> : monthlyRevenue.every(m => m.value === 0) ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: C.muted, fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
            No paid earnings yet — completed escrow orders and confirmed basket payouts will appear here
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
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? 'var(--ft-text-secondary)' : '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: 'var(--ft-bg)', flexShrink: 0 }}>
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
  const [actionError, setActionError] = useState<Record<string, string>>({})

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
    setActionError(prev => ({ ...prev, [gig.id]: '' }))
    try {
      const response = await fetch(`/api/listings/${gig.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not update this gig.')
      setGigs(prev => prev.map(g => g.id === gig.id ? { ...g, status: next } : g))
    } catch (error) {
      setActionError(prev => ({ ...prev, [gig.id]: error instanceof Error ? error.message : 'Could not update this gig.' }))
    } finally { setToggling(null) }
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
          <div style={{ fontWeight: 700, color: 'var(--ft-text-secondary)', marginBottom: '0.4rem' }}>No gigs yet</div>
          <div style={{ color: C.muted, fontSize: '0.85rem', marginBottom: '1.25rem' }}>Create your first gig to start earning</div>
          <Link href="/seller/gigs/create" style={{ background: C.accent, color: 'var(--ft-bg)', borderRadius: 8, padding: '0.65rem 1.5rem', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>
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
          {actionError[gig.id] && <div role="alert" style={{ flexBasis: '100%', color: 'var(--ft-danger)', fontSize: '0.78rem' }}>{actionError[gig.id]}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Performance Tab ───────────────────────────────────────────────────────────

function PerformanceTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const sales = getSellerSales(await fetchSellerOrders())
      setOrders(sales.map(sale => {
        const amount = sale.isBasketItem
          ? (sale.payoutReady ? sale.payoutEur : sale.grossEur)
          : (sale.status === 'completed' ? sale.payoutEur : sale.grossEur)
        return {
          id: sale.id,
          orderId: sale.orderId,
          listing_id: sale.listingId,
          title: sale.title,
          amount,
          amountLabel: sale.isBasketItem
            ? (sale.payoutReady ? 'Seller proceeds' : 'Item subtotal')
            : (sale.status === 'completed' ? 'Seller proceeds' : 'Order total'),
          currency: sale.currency,
          status: sale.status,
          created_at: sale.createdAt,
          buyer: sale.buyer,
          isBasketItem: sale.isBasketItem,
          payoutReady: sale.payoutReady,
        }
      }))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your sales.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const statuses = ['all', 'pending', 'pending_escrow', 'paid', 'in_progress', 'processing', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: filter === s ? C.accent : 'rgba(56,189,248,0.08)', color: filter === s ? 'var(--ft-bg)' : C.muted, textTransform: 'capitalize' }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.9rem 1rem' }}>
          <Skeleton h={14} w="50%" />
          <div style={{ marginTop: 8 }}><Skeleton h={10} w="30%" /></div>
        </div>
      )) : loadError ? (
        <div role="alert" style={{ background: C.card, border: '1px solid rgba(248,113,113,.35)', borderRadius: 14, padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ color: C.text, fontWeight: 700 }}>{loadError}</div>
          <button type="button" onClick={() => void load()} style={{ marginTop: 12, minHeight: 44, padding: '0.55rem 1rem', border: 0, borderRadius: 9, background: C.accent, color: 'var(--ft-bg)', font: 'inherit', fontWeight: 800, cursor: 'pointer' }}>Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '3rem 1rem', textAlign: 'center', color: C.muted }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
          <div>No orders found {filter !== 'all' ? `with status "${filter}"` : 'yet'}</div>
        </div>
      ) : filtered.map(order => (
        <div key={order.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Avatar url={order.buyer?.avatar_url} name={order.buyer?.full_name || 'Buyer'} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link href={`/orders/${order.orderId}`} style={{ display: 'block', color: C.text, textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.title || 'Order'}</Link>
            <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>
              {order.buyer?.full_name || 'Buyer'} · {timeAgo(order.created_at)}{order.isBasketItem ? ' · Product basket item (no escrow)' : ''}
            </div>
            {order.isBasketItem && !order.payoutReady && <div role="status" style={{ fontSize: '0.7rem', color: '#fbbf24', marginTop: 4 }}>Payout reconciliation pending; fulfillment is paused.</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <StatusBadge status={order.status} />
            <span style={{ fontSize: '0.88rem', fontWeight: 900, color: C.text }}>{fmt(order.amount, order.currency)}</span>
            <span style={{ fontSize: '0.65rem', color: C.muted }}>{order.amountLabel}</span>
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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/disputes', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setDisputes(data.disputes ?? [])
        }
      } catch { /* silent */ } finally { setLoading(false) }
    }
    load()
  }, [])

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
          <div style={{ fontWeight: 700, color: 'var(--ft-text-secondary)', marginBottom: '0.4rem' }}>No disputes</div>
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
                  {isRaiser ? 'Against: ' : 'Raised by: '}<span style={{ color: 'var(--ft-text-secondary)', fontWeight: 600 }}>{(otherParty as { full_name?: string | null } | null | undefined)?.full_name || 'Member'}</span>
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
                  <a
                    href={`mailto:support@freetrust.co?subject=${encodeURIComponent(`Request for help with order ${dispute.order_id}`)}&body=${encodeURIComponent(`Please review dispute ${dispute.id} for order ${dispute.order_id}${dispute.order?.title ? ` (${dispute.order.title})` : ''}.\n\nReason: ${dispute.reason}${dispute.details ? `\n\nDetails: ${dispute.details}` : ''}\n\nAdditional information:\n`)}`}
                    style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.72rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', textDecoration: 'none', fontWeight: 700 }}
                  >
                    Email support
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })}

    </div>
  )
}

// ── Payments Tab ──────────────────────────────────────────────────────────────

function PaymentsTab({ userId }: { userId: string }) {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [txs, setTxs] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [withdrawModal, setWithdrawModal] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/wallet', { cache: 'no-store' })
        if (res.ok) {
          const d = await res.json()
          setWallet({
            available: d.money?.available ?? 0,
            pendingPayout: d.money?.pendingPayout ?? 0,
            totalEarned: d.money?.totalEarned ?? 0,
            totalSpent: d.money?.totalSpent ?? 0,
            totalDeposited: d.money?.totalDeposited ?? 0,
            trustBalance: d.trust?.balance ?? 0,
          })
          setTxs((d.transactions ?? []) as WalletTx[])
        } else {
          setWallet({ available: 0, pendingPayout: 0, totalEarned: 0, totalSpent: 0, totalDeposited: 0, trustBalance: 0 })
        }
      } catch {
        setWallet({ available: 0, pendingPayout: 0, totalEarned: 0, totalSpent: 0, totalDeposited: 0, trustBalance: 0 })
      } finally { setLoading(false) }
    }
    load()
  }, [userId])

  const eurTxs = txs.filter(t => t.currency === 'EUR')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Wallet summary */}
      {loading ? <Skeleton h={120} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '1rem' }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(129,140,248,0.1))', border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Wallet Balance</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: C.accent }}>{fmt(wallet?.available ?? 0)}</div>
            {(wallet?.pendingPayout ?? 0) > 0 && <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: 4 }}>{fmt(wallet?.pendingPayout ?? 0)} pending</div>}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Total Earned</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399' }}>{fmt(wallet?.totalEarned ?? 0)}</div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Total Spent</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--ft-danger)' }}>{fmt(wallet?.totalSpent ?? 0)}</div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link href="/wallet" style={{ background: C.accent, color: 'var(--ft-bg)', borderRadius: 10, padding: '0.65rem 1.25rem', fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          💳 Top Up Wallet
        </Link>
        <button
          onClick={() => setWithdrawModal(true)}
          style={{ background: 'rgba(56,189,248,0.08)', border: `1px solid ${C.border}`, color: C.accent, borderRadius: 10, padding: '0.65rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          🏦 Withdrawal help
        </button>
      </div>

      {/* Transaction history */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '0.9rem 1rem', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: '0.88rem' }}>Transaction History</div>
        {loading ? (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={36} />)}
          </div>
        ) : eurTxs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: C.muted, fontSize: '0.85rem' }}>No transactions yet</div>
        ) : (
          <div>
            {eurTxs.map((tx, i) => {
              const isCredit = tx.amount >= 0
              return (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderBottom: i < eurTxs.length - 1 ? `1px solid rgba(56,189,248,0.05)` : 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: isCredit ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                    {isCredit ? '↓' : '↑'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                    <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: 2 }}>{timeAgo(tx.date)}</div>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: isCredit ? '#34d399' : 'var(--ft-danger)', flexShrink: 0 }}>
                    {isCredit ? '+' : '-'}{fmt(Math.abs(tx.amount))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Withdraw modal */}
      {withdrawModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '1.5rem', maxWidth: 380, width: '100%' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>🏦 Withdrawal information</h3>
            <p style={{ color: C.muted, fontSize: '0.88rem', lineHeight: 1.65, margin: '0 0 1.25rem' }}>
              This Earn panel does not submit a withdrawal request. For help with a payout, contact{' '}
              <a href="mailto:support@freetrust.co" style={{ color: C.accent }}>support@freetrust.co</a>.
            </p>
            <button onClick={() => setWithdrawModal(false)} style={{ width: '100%', padding: '0.75rem', borderRadius: 10, background: C.accent, border: 'none', color: 'var(--ft-bg)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bookings Tab (owner side — Rent & Share booking calendar/management) ────
// Lives inside Earn because check-in on a booking triggers the wallet payout,
// so it belongs with the rest of the owner's earning activity.

type RentBookingRow = {
  id: string
  listing_id: string
  requester_id: string
  from_date: string
  to_date: string
  message: string | null
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed'
  amount: number | null
  currency: string
  order_status?: string | null
  checked_in_at: string | null
  created_at: string
  perspective: 'buyer' | 'seller'
  requester?: { full_name: string | null; avatar_url: string | null } | null
  rent_share_listings?: { id: string; title: string; images: string[] } | { id: string; title: string; images: string[] }[] | null
}

const BOOKING_STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Pending' },
  approved:  { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Approved' },
  declined:  { bg: 'rgba(239,68,68,0.15)',  color: 'var(--ft-danger)', label: 'Declined' },
  cancelled: { bg: 'rgba(100,116,139,0.15)', color: 'var(--ft-text-tertiary)', label: 'Cancelled' },
  completed: { bg: 'rgba(56,189,248,0.15)', color: 'var(--ft-accent)', label: 'Checked-in · Completed' },
}

function listingOf(row: RentBookingRow) {
  return Array.isArray(row.rent_share_listings) ? row.rent_share_listings[0] : row.rent_share_listings
}

function BookingsTab({ userId }: { userId: string }) {
  const [bookings, setBookings] = useState<RentBookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<Record<string, string>>({})
  const [actingOn, setActingOn] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/rent-share/requests?role=seller', { cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setBookings((d.requests ?? []) as RentBookingRow[])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, userId])

  const respond = async (id: string, action: 'approve' | 'decline') => {
    setActingOn(id)
    setActionError(prev => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch(`/api/rent-share/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json()
      if (!res.ok) {
        setActionError(prev => ({ ...prev, [id]: d.error ?? 'Something went wrong' }))
      } else {
        await load()
      }
    } catch {
      setActionError(prev => ({ ...prev, [id]: 'Network error' }))
    } finally {
      setActingOn(null)
    }
  }

  const pending = bookings.filter(b => b.status === 'pending')
  const upcoming = bookings.filter(b => b.status === 'approved').sort((a, b) => a.from_date.localeCompare(b.from_date))
  const past = bookings.filter(b => b.status === 'completed' || b.status === 'declined' || b.status === 'cancelled')
  const paidOut = bookings.filter(b => b.status === 'completed').reduce((sum, booking) => sum + Number(booking.amount ?? 0), 0)

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={70} />)}
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '2.5rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🏠</div>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>No booking requests yet</div>
        <div style={{ fontSize: '0.85rem', color: C.muted, marginBottom: '1rem' }}>Requests for your Rent & Share listings will appear here.</div>
        <Link href="/rent-share/new" style={{ color: C.accent, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.5rem 1rem', display: 'inline-block' }}>
          + List an item
        </Link>
      </div>
    )
  }

  const renderRow = (b: RentBookingRow) => {
    const listing = listingOf(b)
    const colors = BOOKING_STATUS_COLOR[b.status] ?? BOOKING_STATUS_COLOR.pending
    const payoutStatus = b.status === 'completed'
      ? 'Released to wallet'
      : b.order_status === 'pending_escrow'
        ? 'Pending until check-in'
        : b.status === 'approved'
          ? 'Awaiting escrow order'
          : 'Not applicable'
    return (
      <div key={b.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ minWidth: 0 }}>
            <Link href={`/rent-share/${b.listing_id}`} style={{ color: C.text, textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
              {listing?.title ?? 'Listing'}
            </Link>
            <div style={{ fontSize: '0.78rem', color: C.muted, marginTop: 2 }}>
              {b.requester?.full_name ?? 'A member'} · Check-in {b.from_date} · Check-out {b.to_date}
            </div>
            {b.message && <div style={{ fontSize: '0.78rem', color: C.subtle, marginTop: 4, fontStyle: 'italic' }}>&ldquo;{b.message}&rdquo;</div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: 999, background: colors.bg, color: colors.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {colors.label}
            </span>
            {b.amount != null && <div style={{ fontSize: '0.85rem', fontWeight: 800, color: C.text, marginTop: 6 }}>{fmt(b.amount, b.currency)}</div>}
          </div>
        </div>

        {b.status === 'pending' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              onClick={() => respond(b.id, 'approve')}
              disabled={actingOn === b.id}
              style={{ flex: 1, background: 'linear-gradient(135deg,#2dd4bf,#0891b2)', border: 'none', borderRadius: 8, padding: '0.55rem 0', color: 'var(--ft-bg)', fontWeight: 700, fontSize: '0.8rem', cursor: actingOn === b.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {actingOn === b.id ? '…' : '✅ Approve'}
            </button>
            <button
              onClick={() => respond(b.id, 'decline')}
              disabled={actingOn === b.id}
              style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.55rem 0', color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', cursor: actingOn === b.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              ❌ Decline
            </button>
          </div>
        )}
        {b.status === 'approved' && (
          <div style={{ fontSize: '0.75rem', color: '#fbbf24' }}>⏳ Payout status: {payoutStatus} — releases automatically when the guest confirms check-in.</div>
        )}
        {b.status === 'completed' && b.checked_in_at && (
          <div style={{ fontSize: '0.75rem', color: '#34d399' }}>💰 Payout status: {payoutStatus} on check-in ({new Date(b.checked_in_at).toLocaleDateString('en-IE')})</div>
        )}
        {actionError[b.id] && (
          <div style={{ fontSize: '0.75rem', color: 'var(--ft-danger)' }}>{actionError[b.id]}</div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Calendar overview */}
      <div style={{ background: 'linear-gradient(135deg,rgba(45,212,191,0.1),rgba(56,189,248,0.06))', border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📅 Booking calendar</div>
            <div style={{ fontSize: '0.82rem', color: C.muted, marginTop: 4 }}>Incoming requests, upcoming check-ins and payout tracking</div>
          </div>
          <Link href="/rent-share" style={{ color: C.accent, textDecoration: 'none', fontSize: '0.78rem', fontWeight: 700 }}>View listings →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: '0.6rem', marginTop: '1rem' }}>
          <div style={{ background: 'rgba(245,158,11,0.1)', borderRadius: 10, padding: '0.7rem' }}><div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fbbf24' }}>{pending.length}</div><div style={{ fontSize: '0.68rem', color: C.muted }}>Awaiting response</div></div>
          <div style={{ background: 'rgba(52,211,153,0.1)', borderRadius: 10, padding: '0.7rem' }}><div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#34d399' }}>{upcoming.length}</div><div style={{ fontSize: '0.68rem', color: C.muted }}>Upcoming stays</div></div>
          <div style={{ background: 'rgba(56,189,248,0.1)', borderRadius: 10, padding: '0.7rem' }}><div style={{ fontSize: '1.2rem', fontWeight: 900, color: C.accent }}>{fmt(paidOut)}</div><div style={{ fontSize: '0.68rem', color: C.muted }}>Paid out</div></div>
        </div>
      </div>
      {pending.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>Pending requests</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>{pending.map(renderRow)}</div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>Upcoming check-ins</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>{upcoming.map(renderRow)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>{past.map(renderRow)}</div>
        </div>
      )}
    </div>
  )
}

// ── Page-level skeleton shown while auth resolves ────────────────────────────

function PageSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.08),rgba(129,140,248,0.05))', borderBottom: `1px solid ${C.border}`, padding: '1.5rem 1.25rem 0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <Skeleton h={40} w={40} />
            <div style={{ flex: 1 }}>
              <Skeleton h={22} w="35%" />
              <div style={{ marginTop: 6 }}><Skeleton h={13} w="50%" /></div>
            </div>
            <Skeleton h={36} w={110} />
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => <div key={t.id} style={{ padding: '0.85rem 1.1rem', flexShrink: 0 }}><Skeleton h={13} w={70} /></div>)}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '1rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '1rem' }}>
              <Skeleton h={10} w="60%" />
              <div style={{ marginTop: 10 }}><Skeleton h={28} w="80%" /></div>
            </div>
          ))}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
          <Skeleton h={14} w="30%" />
          <div style={{ marginTop: 16 }}><Skeleton h={80} /></div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
          <Skeleton h={14} w="25%" />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={18} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page (inner — needs Suspense because it uses useSearchParams) ──────

function GigEconomyPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const initialTab = (searchParams.get('tab') && TABS.some(t => t.id === searchParams.get('tab')))
    ? (searchParams.get('tab') as string)
    : 'analytics'
  const [activeTab, setActiveTab] = useState(initialTab)
  // Track which tabs have been visited so they stay mounted (avoids re-fetching
  // data when switching back to a previously loaded tab).
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set([initialTab]))

  useEffect(() => {
    const sb = createClient()
    let cancelled = false
    const stored = getStoredSessionCredentials()
    const storedSessionIsValid = stored && (
      stored.expiresAt == null || stored.expiresAt > Math.floor(Date.now() / 1000) + 30
    )

    // iOS Safari/WKWebView can leave auth.getSession() pending even when the
    // signed SSR auth cookie is already available. Resolve the member locally
    // first so the Earn screen's data queries can start without waiting on
    // GoTrue's async session restore. The signed token remains subject to RLS.
    if (storedSessionIsValid) {
      setUserId(stored.userId)
      setAuthLoading(false)
      return () => { cancelled = true }
    }

    // Keep the normal Supabase path for missing/expired cookies, but don't let
    // a stalled auth restore leave the entire mobile page skeleton on screen.
    const timeout = window.setTimeout(() => {
      if (cancelled) return
      setAuthLoading(false)
      router.push('/login')
    }, 10_000)

    sb.auth.getSession().then(({ data }) => {
      window.clearTimeout(timeout)
      if (cancelled) return
      if (!data.session?.user) {
        setAuthLoading(false)
        router.push('/login')
        return
      }
      setUserId(data.session.user.id)
      setAuthLoading(false)
    }).catch(() => {
      window.clearTimeout(timeout)
      if (cancelled) return
      setAuthLoading(false)
      router.push('/login')
    })
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [router])

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    setMountedTabs(prev => { const next = new Set(prev); next.add(tabId); return next })
  }

  if (authLoading) return <PageSkeleton />

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

          <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, boxSizing: 'border-box', padding: '8px 12px', marginBottom: 8, borderRadius: 11, border: `1px solid ${C.border}`, background: 'rgba(56,189,248,0.06)', color: C.text, textDecoration: 'none' }}>
            <span aria-hidden="true" style={{ fontSize: 19 }}>📦</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 13 }}>My Orders</span>
              <span style={{ display: 'block', color: C.muted, fontSize: 11, marginTop: 2 }}>Purchases, sales, delivery updates and escrow</span>
            </span>
            <span aria-hidden="true" style={{ color: C.accent, fontSize: 18 }}>→</span>
          </Link>

          {/* Tab bar — horizontal swipe/scroll only. touchAction: 'pan-x' locks the
              browser's touch gesture handling on this element to horizontal panning
              so a vertical drag over the tab strip never scrolls/drags it (it should
              instead fall through to normal page vertical scroll). overflowY hidden
              is a defensive backstop in case any child content ever overflows. */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', overflowY: 'hidden', touchAction: 'pan-x', scrollbarWidth: 'none', marginTop: '0.5rem' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                className="ge-tab-btn"
                onClick={() => handleTabChange(tab.id)}
                style={{ padding: '0.85rem 1.1rem', background: 'none', border: 'none', borderBottom: activeTab === tab.id ? `2px solid ${C.accent}` : '2px solid transparent', color: activeTab === tab.id ? C.accent : C.muted, fontWeight: activeTab === tab.id ? 700 : 500, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, transition: 'color 0.15s', marginBottom: -1 }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content — tabs stay mounted after first visit to avoid re-fetching */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem' }}>
        {userId && (
          <>
            <div style={{ display: activeTab === 'analytics'   ? 'block' : 'none' }}>{mountedTabs.has('analytics')   && <AnalyticsTab userId={userId} />}</div>
            <div style={{ display: activeTab === 'management'  ? 'block' : 'none' }}>{mountedTabs.has('management')  && <ManagementTab  userId={userId} />}</div>
            <div style={{ display: activeTab === 'bookings'    ? 'block' : 'none' }}>{mountedTabs.has('bookings')    && <BookingsTab    userId={userId} />}</div>
            <div style={{ display: activeTab === 'performance' ? 'block' : 'none' }}>{mountedTabs.has('performance') && <PerformanceTab />}</div>
            <div style={{ display: activeTab === 'disputes'    ? 'block' : 'none' }}>{mountedTabs.has('disputes')    && <DisputesTab   userId={userId} />}</div>
            <div style={{ display: activeTab === 'payments'    ? 'block' : 'none' }}>{mountedTabs.has('payments')    && <PaymentsTab   userId={userId} />}</div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Default export wrapped in Suspense (required for useSearchParams) ───────

export default function GigEconomyPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GigEconomyPageInner />
    </Suspense>
  )
}
