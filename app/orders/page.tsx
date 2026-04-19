'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus = 'pending' | 'paid' | 'in_progress' | 'delivered' | 'completed' | 'disputed' | 'refunded' | 'cancelled'

interface Order {
  id: string
  listing_id: string | null
  buyer_id: string
  seller_id: string
  status: OrderStatus
  amount: number
  currency: string
  notes: string | null
  buyer_reviewed: boolean
  seller_reviewed: boolean
  created_at: string
  updated_at: string
  listing?: { title: string | null; product_type: string | null } | null
  buyer_profile?: { full_name: string | null; avatar_url: string | null } | null
  seller_profile?: { full_name: string | null; avatar_url: string | null } | null
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<OrderStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:     { label: 'Pending',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   icon: '⏳' },
  paid:        { label: 'Paid',        color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',   icon: '💳' },
  in_progress: { label: 'In Progress', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '🔄' },
  delivered:   { label: 'Delivered',   color: '#818cf8', bg: 'rgba(129,140,248,0.12)', icon: '📦' },
  completed:   { label: 'Completed',   color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: '✅' },
  disputed:    { label: 'Disputed',    color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: '⚠️' },
  refunded:    { label: 'Refunded',    color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: '↩️' },
  cancelled:   { label: 'Cancelled',   color: '#475569', bg: 'rgba(71,85,105,0.12)',   icon: '✕'  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtAmount(amount: number, currency: string) {
  const sym = currency?.toUpperCase() === 'GBP' ? '£' : currency?.toUpperCase() === 'EUR' ? '€' : '$'
  return `${sym}${(amount / 100).toFixed(2)}`
}

function Avatar({ url, name, size = 36 }: { url: string | null | undefined; name: string | null | undefined; size?: number }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (url) return <img src={url} alt={name ?? ''} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.33, color: '#0f172a', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

// ── Order card ────────────────────────────────────────────────────────────────

function OrderCard({ order, role }: { order: Order; role: 'buyer' | 'seller' }) {
  const [releasing, setReleasing] = useState(false)
  const [released, setReleased] = useState(false)
  const st = STATUS[order.status] ?? STATUS.pending
  const isBuying = role === 'buyer'
  const counterparty = isBuying ? order.seller_profile : order.buyer_profile
  const counterLabel = isBuying ? 'Seller' : 'Buyer'
  const title = order.listing?.title ?? (isBuying ? 'Purchase' : 'Sale')
  const isEscrowable = isBuying && order.status === 'delivered' && !released

  const handleRelease = async () => {
    if (!confirm('Release escrow funds to the seller? This confirms delivery.')) return
    setReleasing(true)
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      setReleased(true)
    } catch { /* silent */ }
    finally { setReleasing(false) }
  }

  return (
    <Link href={`/orders/${order.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{ background: '#1e293b', border: `1px solid ${order.status === 'disputed' ? 'rgba(248,113,113,0.35)' : 'rgba(56,189,248,0.1)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.15s' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.3)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = order.status === 'disputed' ? 'rgba(248,113,113,0.35)' : 'rgba(56,189,248,0.1)'}>

        {/* Status bar */}
        <div style={{ height: 3, background: released ? STATUS.completed.color : st.color, opacity: 0.7 }} />

        <div style={{ padding: '1rem 1.1rem' }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <Avatar url={counterparty?.avatar_url} name={counterparty?.full_name} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                  color: isBuying ? '#60a5fa' : '#34d399',
                  background: isBuying ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                  border: `1px solid ${isBuying ? 'rgba(59,130,246,0.25)' : 'rgba(16,185,129,0.25)'}`,
                  borderRadius: 6, padding: '1px 6px',
                }}>
                  {isBuying ? '🛒 Buying' : '🏪 Selling'}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {counterLabel}: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{counterparty?.full_name ?? 'Unknown'}</span>
              </div>
            </div>
            {/* Status badge */}
            <div style={{ background: released ? STATUS.completed.bg : st.bg, color: released ? STATUS.completed.color : st.color, borderRadius: 999, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {released ? '✅ Completed' : `${st.icon} ${st.label}`}
            </div>
          </div>

          {/* Amount + meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f1f5f9' }}>{fmtAmount(order.amount, order.currency)}</span>
            <span style={{ fontSize: '0.72rem', color: '#475569', background: 'rgba(148,163,184,0.08)', padding: '2px 8px', borderRadius: 999 }}>
              {order.listing?.product_type === 'digital' ? '⚡ Digital' : order.listing?.product_type === 'physical' ? '📦 Physical' : '🛠 Service'}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#475569', marginLeft: 'auto' }}>{timeAgo(order.created_at)}</span>
          </div>

          {/* Escrow notice for active orders */}
          {['pending', 'paid', 'in_progress', 'delivered'].includes(order.status) && !released && (
            <div style={{ marginTop: '0.75rem', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔒</span>
              <span>Funds held in escrow · Ordered {fmtDate(order.created_at)}</span>
            </div>
          )}

          {/* Release escrow CTA for buyers when delivered */}
          {isEscrowable && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); handleRelease() }}
              disabled={releasing}
              style={{ marginTop: '0.75rem', width: '100%', background: 'linear-gradient(135deg,#34d399,#059669)', border: 'none', borderRadius: 9, padding: '10px', fontSize: '0.85rem', fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: releasing ? 0.7 : 1 }}>
              {releasing ? 'Releasing…' : '✅ Confirm Delivery & Release Escrow'}
            </button>
          )}

          {/* Notes */}
          {order.notes && (
            <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{order.notes}"</div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: '#1e293b', borderRadius: 14, padding: '1rem 1.1rem', height: 110 }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(90deg,#243047 25%,#2d3f55 50%,#243047 75%)', backgroundSize: '200%', animation: 'shimmer 1.5s infinite', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: '60%', background: 'linear-gradient(90deg,#243047 25%,#2d3f55 50%,#243047 75%)', backgroundSize: '200%', animation: 'shimmer 1.5s infinite', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ height: 11, width: '35%', background: 'linear-gradient(90deg,#243047 25%,#2d3f55 50%,#243047 75%)', backgroundSize: '200%', animation: 'shimmer 1.5s infinite', borderRadius: 6 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabKey = 'buying' | 'selling'
type StatusFilter = 'all' | OrderStatus

export default function OrdersPage() {
  const [tab, setTab] = useState<TabKey>('buying')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [buyingOrders, setBuyingOrders] = useState<Order[]>([])
  const [sellingOrders, setSellingOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bRes, sRes] = await Promise.all([
        fetch('/api/orders?role=buyer'),
        fetch('/api/orders?role=seller'),
      ])
      if (bRes.ok) {
        const { orders } = await bRes.json()
        setBuyingOrders(orders ?? [])
      }
      if (sRes.ok) {
        const { orders } = await sRes.json()
        setSellingOrders(orders ?? [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const orders = tab === 'buying' ? buyingOrders : sellingOrders
  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)

  const stats = {
    active: orders.filter(o => ['pending', 'paid', 'in_progress', 'delivered'].includes(o.status)).length,
    completed: orders.filter(o => o.status === 'completed').length,
    disputed: orders.filter(o => o.status === 'disputed').length,
    escrow: orders.filter(o => !['completed', 'cancelled', 'refunded'].includes(o.status)).reduce((s, o) => s + o.amount, 0),
    currency: orders[0]?.currency ?? 'GBP',
  }

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'disputed', label: 'Disputed' },
  ]

  void showToast

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .order-tab-btn { flex:1; padding:0.75rem 0.5rem; border:none; cursor:pointer; font-family:inherit; font-size:0.88rem; font-weight:600; transition:all 0.15s; border-bottom:2px solid transparent; background:transparent; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '11px 20px', fontSize: 13, color: '#f1f5f9', zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.5px' }}>Orders</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Track all your purchases and sales in one place</p>
        </div>

        {/* Buying / Selling tabs — visually distinct */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {/* Buying tab */}
          <button
            onClick={() => { setTab('buying'); setStatusFilter('all') }}
            style={{ background: tab === 'buying' ? 'rgba(56,189,248,0.12)' : '#1e293b', border: `2px solid ${tab === 'buying' ? '#38bdf8' : 'rgba(56,189,248,0.1)'}`, borderRadius: 12, padding: '14px 12px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>🛒</span>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: tab === 'buying' ? '#38bdf8' : '#f1f5f9' }}>Buying</span>
              <span style={{ marginLeft: 'auto', background: tab === 'buying' ? '#38bdf8' : 'rgba(56,189,248,0.15)', color: tab === 'buying' ? '#0f172a' : '#38bdf8', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{buyingOrders.length}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Your purchases &amp; escrow</div>
          </button>

          {/* Selling tab */}
          <button
            onClick={() => { setTab('selling'); setStatusFilter('all') }}
            style={{ background: tab === 'selling' ? 'rgba(52,211,153,0.1)' : '#1e293b', border: `2px solid ${tab === 'selling' ? '#34d399' : 'rgba(52,211,153,0.1)'}`, borderRadius: 12, padding: '14px 12px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>🏷️</span>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: tab === 'selling' ? '#34d399' : '#f1f5f9' }}>Selling</span>
              <span style={{ marginLeft: 'auto', background: tab === 'selling' ? '#34d399' : 'rgba(52,211,153,0.12)', color: tab === 'selling' ? '#0f172a' : '#34d399', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{sellingOrders.length}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Your sales &amp; earnings</div>
          </button>
        </div>

        {/* Stats strip */}
        {orders.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Active', value: stats.active, color: '#38bdf8' },
              { label: 'Completed', value: stats.completed, color: '#34d399' },
              { label: 'In Escrow', value: fmtAmount(stats.escrow, stats.currency), color: '#a78bfa' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Status filter pills */}
        {orders.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, marginBottom: '1.1rem' }}>
            {STATUS_FILTERS.map(f => {
              const count = f.value === 'all' ? orders.length : orders.filter(o => o.status === f.value).length
              return (
                <button key={f.value} onClick={() => setStatusFilter(f.value)}
                  style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: statusFilter === f.value ? 700 : 500, background: statusFilter === f.value ? (tab === 'buying' ? '#38bdf8' : '#34d399') : 'rgba(148,163,184,0.08)', color: statusFilter === f.value ? '#0f172a' : '#94a3b8', transition: 'all 0.15s' }}>
                  {f.label} {count > 0 && <span style={{ opacity: 0.75 }}>({count})</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Orders list */}
        {loading ? (
          <Skeleton />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{tab === 'buying' ? '🛒' : '🏷️'}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>
              {orders.length === 0
                ? (tab === 'buying' ? 'No purchases yet' : 'No sales yet')
                : `No ${statusFilter.replace('_', ' ')} orders`}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1.5rem' }}>
              {orders.length === 0
                ? (tab === 'buying' ? 'Browse services and products to make your first purchase.' : 'List a service or product to start selling.')
                : 'Try a different filter.'}
            </div>
            {orders.length === 0 && (
              <Link href={tab === 'buying' ? '/services' : '/listings/new'}
                style={{ display: 'inline-block', background: tab === 'buying' ? '#38bdf8' : '#34d399', color: '#0f172a', borderRadius: 10, padding: '10px 24px', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none' }}>
                {tab === 'buying' ? 'Browse Services →' : 'Create a Listing →'}
              </Link>
            )}
            {orders.length > 0 && (
              <button onClick={() => setStatusFilter('all')} style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}>
                Show all orders
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map(order => (
              <OrderCard key={order.id} order={order} role={tab === 'buying' ? 'buyer' : 'seller'} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
