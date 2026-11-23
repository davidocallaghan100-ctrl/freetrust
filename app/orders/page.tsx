'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'

type Role = 'buyer' | 'seller'
type OrderStatus = 'pending' | 'pending_escrow' | 'paid' | 'in_progress' | 'delivered' | 'completed' | 'disputed' | 'refunded' | 'cancelled'
type FulfillmentStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'disputed' | null

interface Profile {
  id?: string
  full_name: string | null
  avatar_url: string | null
}

interface BasketItem {
  id: string
  order_id: string
  buyer_id: string
  seller_id: string
  listing_id: string | null
  title: string
  quantity: number
  unit_amount_cents: number
  subtotal_cents: number
  seller_payout_cents: number
  payout_ready: boolean
  payout_state: 'confirmed' | 'pending' | 'failed' | 'reconciliation_required'
  payout_status_checkable: boolean
  delivery_status: FulfillmentStatus
  tracking_carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  delivery_notes: string | null
  shipped_at: string | null
  delivered_at: string | null
  completed_at: string | null
  buyer_profile: Profile | null
  seller_profile: Profile | null
  listing: { id: string; product_type: string | null } | null
}

interface BasketOrder {
  id: string
  buyer_id: string
  status: OrderStatus
  amount: number
  amount_pence: number | null
  currency: string
  payment_gateway: string | null
  created_at: string
  buyer_profile: Profile | null
  items: BasketItem[]
}

interface Order {
  id: string
  listing_id: string | null
  buyer_id: string
  seller_id: string
  type: string
  title: string
  status: OrderStatus
  amount: number
  amount_pence: number | null
  currency: string
  notes: string | null
  created_at: string
  buyer_profile: Profile | null
  seller_profile: Profile | null
  listing?: { title?: string | null; product_type?: string | null } | null
}

type Filter = 'all' | 'active' | 'completed' | 'attention'

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  pending_escrow: { label: 'Payment pending', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  paid: { label: 'Paid', color: '#38bdf8', bg: 'rgba(56,189,248,.12)' },
  in_progress: { label: 'In progress', color: '#a78bfa', bg: 'rgba(167,139,250,.12)' },
  delivered: { label: 'Delivered', color: '#818cf8', bg: 'rgba(129,140,248,.12)' },
  completed: { label: 'Completed', color: '#34d399', bg: 'rgba(52,211,153,.12)' },
  disputed: { label: 'Disputed', color: '#f87171', bg: 'rgba(248,113,113,.12)' },
  refunded: { label: 'Refunded', color: '#94a3b8', bg: 'rgba(148,163,184,.12)' },
  cancelled: { label: 'Cancelled', color: '#94a3b8', bg: 'rgba(148,163,184,.1)' },
  processing: { label: 'Processing', color: '#38bdf8', bg: 'rgba(56,189,248,.12)' },
  shipped: { label: 'Shipped', color: '#818cf8', bg: 'rgba(129,140,248,.12)' },
}

function statusFor(value: string | null | undefined) {
  return STATUS[value ?? 'paid'] ?? { label: value ?? 'Awaiting fulfillment', color: '#94a3b8', bg: 'rgba(148,163,184,.12)' }
}

function money(cents: number | null | undefined, currency = 'EUR') {
  if (cents == null || !Number.isFinite(Number(cents))) return '—'
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency || 'EUR' }).format(Number(cents) / 100)
  } catch {
    return `€${(Number(cents) / 100).toFixed(2)}`
  }
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Avatar({ person, size = 38 }: { person: Profile | null | undefined; size?: number }) {
  const name = person?.full_name?.trim() || 'Member'
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  if (person?.avatar_url) {
    return <img src={person.avatar_url} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }} />
  }
  return <div aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', color: '#06251f', fontWeight: 800, background: 'linear-gradient(135deg,#54e4bb,#54b9e8)' }}>{initials || 'M'}</div>
}

function Badge({ value }: { value: string | null | undefined }) {
  const config = statusFor(value)
  return <span style={{ borderRadius: 999, padding: '5px 10px', color: config.color, background: config.bg, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{config.label}</span>
}

function reviewHref(type: string, listingId: string | null) {
  if (!listingId) return null
  return type === 'service' || type === 'gig' ? `/services/${listingId}` : `/products/${listingId}`
}

function OrdinaryOrderCard({ order, role, onError, onUpdated }: {
  order: Order
  role: Role
  onError: (message: string) => void
  onUpdated: () => void
}) {
  const [working, setWorking] = useState(false)
  const isBuyer = role === 'buyer'
  const person = isBuyer ? order.seller_profile : order.buyer_profile
  const title = order.listing?.title || order.title || (isBuyer ? 'Purchase' : 'Sale')
  const escrow = order.type !== 'product_basket' && ['pending_escrow', 'paid', 'in_progress', 'delivered'].includes(order.status)
  const canRelease = isBuyer && order.status === 'delivered'
  const canReview = isBuyer && order.status === 'completed' && !!order.listing_id
  const href = reviewHref(order.type, order.listing_id)

  const release = async () => {
    if (!confirm('Confirm the completed delivery and release the payment from escrow?')) return
    setWorking(true)
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release_payment' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not release payment')
      onUpdated()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not release payment')
    } finally {
      setWorking(false)
    }
  }

  return (
    <article style={cardStyle}>
      <div style={topLine} />
      <div style={{ padding: '16px 17px 17px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          <Avatar person={person} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 750, color: 'var(--ft-text)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{title}</div>
            <div style={{ color: 'var(--ft-text-tertiary)', fontSize: 12, marginTop: 4 }}>{isBuyer ? 'Seller' : 'Buyer'} · {person?.full_name || 'FreeTrust member'}</div>
          </div>
          <Badge value={order.status} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
          <strong style={{ fontSize: 20, letterSpacing: '-.03em' }}>{money(order.amount_pence, order.currency)}</strong>
          <span style={mutedText}>{order.type === 'service' || order.type === 'gig' ? 'Service order' : 'Product order'}</span>
          <span style={{ ...mutedText, marginLeft: 'auto' }}>{dateLabel(order.created_at)}</span>
        </div>
        {escrow && (
          <div style={noticeStyle}>
            <span aria-hidden="true">🔒</span>
            <span>{order.status === 'pending_escrow' ? 'Payment is being confirmed.' : 'Payment is held in secure escrow until you confirm delivery.'}</span>
          </div>
        )}
        {order.notes && <p style={{ ...mutedText, margin: '12px 0 0', overflowWrap: 'anywhere' }}>{order.notes}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {canRelease && <button type="button" onClick={release} disabled={working} style={primaryButton}>{working ? 'Releasing…' : 'Confirm delivery & release'}</button>}
          {canReview && href && <Link href={href} style={secondaryButton}>★ Review this order</Link>}
          <Link href={`/orders/${order.id}`} style={{ ...secondaryButton, marginLeft: canRelease || canReview ? 0 : 'auto' }}>Order details</Link>
        </div>
      </div>
    </article>
  )
}

function hasRecordedPayout(item: BasketItem) {
  // The API strips processor IDs/statuses before returning an item, but exposes
  // this server-computed boolean so the UI can still gate fulfillment safely.
  return item.payout_ready === true
}

function BasketItemCard({ item, order, role, onError, onUpdated }: {
  item: BasketItem
  order: BasketOrder
  role: Role
  onError: (message: string) => void
  onUpdated: () => void
}) {
  const [working, setWorking] = useState(false)
  const [trackingCarrier, setTrackingCarrier] = useState(item.tracking_carrier ?? '')
  const [trackingNumber, setTrackingNumber] = useState(item.tracking_number ?? '')
  const [trackingUrl, setTrackingUrl] = useState(item.tracking_url ?? '')
  const [checkingPayout, setCheckingPayout] = useState(false)
  const [payoutCheckMessage, setPayoutCheckMessage] = useState<string | null>(null)
  const isBuyer = role === 'buyer'
  const other = isBuyer ? item.seller_profile : item.buyer_profile
  const payoutRecorded = hasRecordedPayout(item)
  const current = item.delivery_status ?? (order.status === 'paid' ? 'paid' : 'pending')
  const isPhysical = item.listing?.product_type === 'physical'
  const completed = item.delivery_status === 'completed'
  const reviewLink = isBuyer && completed ? reviewHref('product', item.listing_id) : null

  const update = async (action: 'update_fulfillment' | 'confirm_received', fulfillmentStatus?: 'processing' | 'shipped' | 'delivered') => {
    setWorking(true)
    try {
      const response = await fetch(`/api/order-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(fulfillmentStatus ? { delivery_status: fulfillmentStatus } : {}),
          ...(action === 'update_fulfillment' ? {
            tracking_carrier: trackingCarrier,
            tracking_number: trackingNumber,
            tracking_url: trackingUrl,
          } : {}),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not update product order')
      onUpdated()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not update product order')
    } finally {
      setWorking(false)
    }
  }

  const checkPayoutStatus = async () => {
    setCheckingPayout(true)
    setPayoutCheckMessage(null)
    try {
      const response = await fetch(`/api/order-items/${item.id}/payout-status`, { method: 'POST' })
      const data = await response.json().catch(() => ({})) as {
        error?: string
        payout_ready?: boolean
        payout_state?: BasketItem['payout_state']
      }
      if (!response.ok) throw new Error(data.error || 'Could not check PayPal payout status')
      setPayoutCheckMessage(data.payout_ready
        ? 'PayPal confirmed this payout. Refreshing order status…'
        : data.payout_state === 'failed'
          ? 'PayPal reports a failed payout. Fulfillment remains locked pending support reconciliation.'
          : 'PayPal has not confirmed payout success yet. Fulfillment remains locked.')
      onUpdated()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not check PayPal payout status')
    } finally {
      setCheckingPayout(false)
    }
  }

  const sellerAction = (next: 'processing' | 'shipped' | 'delivered', label: string) => (
    <button type="button" disabled={working || !payoutRecorded || order.status !== 'paid'} onClick={() => update('update_fulfillment', next)} style={primaryButton}>
      {working ? 'Saving…' : label}
    </button>
  )

  return (
    <div style={{ border: '1px solid var(--ft-border-strong)', borderRadius: 12, padding: 13, background: 'color-mix(in srgb, var(--ft-bg) 60%, transparent)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div aria-hidden="true" style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 10, background: 'rgba(56,189,248,.1)', fontSize: 20, flexShrink: 0 }}>📦</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 750, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{item.title}</div>
          <div style={{ ...mutedText, marginTop: 4 }}>{item.quantity} × {money(item.unit_amount_cents, order.currency)} · {isBuyer ? 'Seller' : 'Buyer'}: {other?.full_name || 'FreeTrust member'}</div>
        </div>
        <Badge value={item.delivery_status ?? (order.status === 'paid' ? 'paid' : 'pending')} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12, fontSize: 13 }}>
        <span style={{ color: 'var(--ft-text-tertiary)' }}>{isBuyer ? 'Item total' : 'Seller proceeds'}</span>
        <strong style={{ marginLeft: 'auto' }}>{money(isBuyer ? item.subtotal_cents : item.seller_payout_cents, order.currency)}</strong>
      </div>

      {order.status !== 'paid' && (
        <div style={noticeStyle}><span>⏳</span><span>Payment has not finished. Fulfillment actions are locked.</span></div>
      )}
      {order.status === 'paid' && !payoutRecorded && (
        <div style={{ ...noticeStyle, borderColor: 'rgba(248,113,113,.25)', background: 'rgba(248,113,113,.07)' }}>
          <span>⚠️</span>
          <span>
            {item.payout_state === 'failed'
              ? 'PayPal reports a failed payout. This item is paused pending support reconciliation.'
              : 'PayPal has not confirmed payout success. This item stays paused until it does.'}
          </span>
        </div>
      )}
      {order.status === 'paid' && item.payout_status_checkable && (
        <div style={{ marginTop: 10 }}>
          <button type="button" disabled={checkingPayout || working} onClick={checkPayoutStatus} style={secondaryButton}>
            {checkingPayout ? 'Checking PayPal…' : 'Check PayPal payout status'}
          </button>
          {payoutCheckMessage && <div role="status" style={{ ...mutedText, marginTop: 7 }}>{payoutCheckMessage}</div>}
        </div>
      )}
      {item.tracking_number && <div style={{ ...mutedText, marginTop: 10 }}>Tracking{item.tracking_carrier ? ` · ${item.tracking_carrier}` : ''}: {item.tracking_url ? <a href={item.tracking_url} target="_blank" rel="noreferrer" style={{ color: 'var(--ft-accent)' }}>{item.tracking_number || 'View tracking'}</a> : item.tracking_number}</div>}
      {item.delivery_notes && <div style={{ ...mutedText, marginTop: 8 }}>{item.delivery_notes}</div>}

      {!isBuyer && !completed && order.status === 'paid' && payoutRecorded && (
        <div style={{ marginTop: 12 }}>
          {isPhysical && current !== 'delivered' && current !== 'shipped' && (
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: 9 }}>
              <input aria-label="Carrier" placeholder="Carrier (optional)" value={trackingCarrier} onChange={event => setTrackingCarrier(event.target.value)} style={inputStyle} />
              <input aria-label="Tracking number" placeholder="Tracking number" value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} style={inputStyle} />
              <input aria-label="Tracking URL" placeholder="Tracking link" inputMode="url" value={trackingUrl} onChange={event => setTrackingUrl(event.target.value)} style={inputStyle} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(current === 'paid' || current === 'pending') && sellerAction('processing', 'Start processing')}
            {isPhysical && current !== 'shipped' && current !== 'delivered' && sellerAction('shipped', 'Mark as shipped')}
            {current !== 'delivered' && sellerAction('delivered', isPhysical ? 'Mark as delivered' : 'Deliver item')}
          </div>
        </div>
      )}
      {isBuyer && item.delivery_status === 'delivered' && (
        <div style={{ marginTop: 12 }}>
          <button type="button" disabled={working || !payoutRecorded} onClick={() => update('confirm_received')} style={primaryButton}>
            {working ? 'Confirming…' : 'Confirm I received this'}
          </button>
        </div>
      )}
      {isBuyer && completed && (
        <div style={{ marginTop: 12, color: '#34d399', fontSize: 13, fontWeight: 700 }}>✓ Receipt confirmed · seller payout was already sent</div>
      )}
      {reviewLink && <Link href={reviewLink} style={{ ...secondaryButton, display: 'inline-flex', marginTop: 11 }}>★ Review this product</Link>}
    </div>
  )
}

function BasketOrderCard({ order, role, onError, onUpdated }: {
  order: BasketOrder
  role: Role
  onError: (message: string) => void
  onUpdated: () => void
}) {
  const itemsTotal = order.items.reduce((sum, item) => sum + (role === 'buyer' ? item.subtotal_cents : item.seller_payout_cents), 0)
  const headlineTotal = role === 'buyer' ? order.amount : itemsTotal
  const fullyCompleted = order.items.length > 0 && order.items.every(item => item.delivery_status === 'completed')
  return (
    <article style={cardStyle}>
      <div style={{ ...topLine, background: 'linear-gradient(90deg,#39d9ac,#38bdf8)' }} />
      <div style={{ padding: '16px 17px 17px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--ft-text-tertiary)', fontSize: 11, fontWeight: 750, letterSpacing: '.08em', textTransform: 'uppercase' }}>Product basket · {order.items.length} {order.items.length === 1 ? 'item' : 'items'}</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 4 }}>{money(headlineTotal, order.currency)}</div>
          </div>
          <Badge value={fullyCompleted ? 'completed' : order.status} />
        </div>
        <div style={{ ...mutedText, margin: '6px 0 13px' }}>
          {role === 'buyer'
            ? <>Items {money(itemsTotal, order.currency)} · buyer fee {money(Math.max(0, order.amount - itemsTotal), order.currency)} · placed {dateLabel(order.created_at)} · no escrow</>
            : <>{order.status === 'paid' ? 'Payouts are tracked per item; PayPal fulfillment unlocks after provider-confirmed success. No escrow.' : 'Payouts are submitted per seller item after payment; fulfillment waits for provider confirmation. No escrow.'} · placed {dateLabel(order.created_at)}</>}
        </div>
        <div style={{ display: 'grid', gap: 9 }}>
          {order.items.map(item => <BasketItemCard key={item.id} item={item} order={order} role={role} onError={onError} onUpdated={onUpdated} />)}
        </div>
      </div>
    </article>
  )
}

const cardStyle: CSSProperties = {
  background: 'var(--ft-surface)',
  border: '1px solid var(--ft-border-strong)',
  borderRadius: 15,
  overflow: 'hidden',
  boxShadow: '0 8px 28px rgba(0,0,0,.12)',
}
const topLine: CSSProperties = { height: 3, background: 'linear-gradient(90deg,#38bdf8,#39d9ac)' }
const mutedText: CSSProperties = { color: 'var(--ft-text-tertiary)', fontSize: 12 }
const noticeStyle: CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '9px 11px', borderRadius: 9, color: 'var(--ft-text-secondary)', fontSize: 12, lineHeight: 1.45, background: 'rgba(56,189,248,.06)', border: '1px solid rgba(56,189,248,.13)' }
const primaryButton: CSSProperties = { minHeight: 44, padding: '10px 14px', border: 0, borderRadius: 10, background: 'linear-gradient(135deg,#44d5ad,#31bfe8)', color: '#06251f', font: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }
const secondaryButton: CSSProperties = { minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', padding: '9px 13px', border: '1px solid var(--ft-border-strong)', borderRadius: 10, background: 'transparent', color: 'var(--ft-text)', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const inputStyle: CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: 44, borderRadius: 9, padding: '9px 10px', color: 'var(--ft-text)', background: 'var(--ft-bg)', border: '1px solid var(--ft-border-strong)', font: 'inherit', fontSize: 16 }

export default function OrdersPage() {
  const [tab, setTab] = useState<Role>('buyer')
  const [filter, setFilter] = useState<Filter>('all')
  const [buyingOrders, setBuyingOrders] = useState<Order[]>([])
  const [sellingOrders, setSellingOrders] = useState<Order[]>([])
  const [buyingBaskets, setBuyingBaskets] = useState<BasketOrder[]>([])
  const [sellingBaskets, setSellingBaskets] = useState<BasketOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [buyerResponse, sellerResponse] = await Promise.all([
        fetch('/api/orders?role=buyer', { cache: 'no-store' }),
        fetch('/api/orders?role=seller', { cache: 'no-store' }),
      ])
      if (!buyerResponse.ok || !sellerResponse.ok) throw new Error('Orders could not be loaded. Please retry.')
      const [buyerData, sellerData] = await Promise.all([buyerResponse.json(), sellerResponse.json()])
      setBuyingOrders(buyerData.orders ?? [])
      setSellingOrders(sellerData.orders ?? [])
      setBuyingBaskets(buyerData.basketOrders ?? [])
      setSellingBaskets(sellerData.basketOrders ?? [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Orders could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const orders = tab === 'buyer' ? buyingOrders : sellingOrders
  const baskets = tab === 'buyer' ? buyingBaskets : sellingBaskets
  const filteredOrders = useMemo(() => orders.filter(order => {
    if (filter === 'all') return true
    if (filter === 'active') return ['pending', 'pending_escrow', 'paid', 'in_progress', 'delivered'].includes(order.status)
    if (filter === 'completed') return order.status === 'completed'
    return ['disputed', 'refunded'].includes(order.status)
  }), [filter, orders])
  const filteredBaskets = useMemo(() => baskets.filter(order => {
    if (filter === 'all') return true
    if (filter === 'active') return !order.items.every(item => ['completed', 'disputed'].includes(item.delivery_status ?? ''))
    if (filter === 'completed') return order.items.some(item => item.delivery_status === 'completed')
    return order.status === 'disputed' || order.items.some(item => item.delivery_status === 'disputed')
  }), [baskets, filter])

  const activeCount = orders.filter(order => ['pending', 'pending_escrow', 'paid', 'in_progress', 'delivered'].includes(order.status)).length
    + baskets.reduce((count, order) => count + order.items.filter(item => !['completed', 'disputed'].includes(item.delivery_status ?? '')).length, 0)
  const completedCount = orders.filter(order => order.status === 'completed').length
    + baskets.reduce((count, order) => count + order.items.filter(item => item.delivery_status === 'completed').length, 0)
  const heldInEscrow = orders.filter(order => ['pending_escrow', 'paid', 'in_progress', 'delivered'].includes(order.status)).reduce((sum, order) => sum + (order.amount_pence ?? 0), 0)
  const totalCount = orders.length + baskets.reduce((sum, order) => sum + order.items.length, 0)

  const showError = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 4500)
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--ft-bg)', color: 'var(--ft-text)', padding: '72px 16px 100px', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {toast && <div role="alert" style={{ position: 'sticky', top: 10, zIndex: 10, maxWidth: 700, margin: '0 auto 12px', padding: '11px 14px', borderRadius: 10, background: 'rgba(127,29,29,.94)', color: '#fee2e2', border: '1px solid rgba(248,113,113,.4)', fontSize: 13 }}>{toast}</div>}
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <header style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ft-accent)', fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}><span aria-hidden="true">◈</span> Marketplace activity</div>
          <h1 style={{ fontSize: 'clamp(27px,6vw,34px)', letterSpacing: '-.04em', margin: '7px 0 5px', fontWeight: 850 }}>My orders</h1>
          <p style={{ margin: 0, color: 'var(--ft-text-tertiary)', fontSize: 14, lineHeight: 1.5 }}>Purchases, sales, delivery updates and secure escrow — together.</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 18 }}>
          {(['buyer', 'seller'] as const).map(role => {
            const selected = tab === role
            const count = role === 'buyer' ? buyingOrders.length + buyingBaskets.reduce((sum, order) => sum + order.items.length, 0) : sellingOrders.length + sellingBaskets.reduce((sum, order) => sum + order.items.length, 0)
            return <button key={role} type="button" onClick={() => { setTab(role); setFilter('all') }} aria-pressed={selected} style={{ textAlign: 'left', minHeight: 83, padding: '13px 14px', borderRadius: 13, border: `1px solid ${selected ? 'var(--ft-accent)' : 'var(--ft-border-strong)'}`, background: selected ? 'rgba(56,189,248,.09)' : 'var(--ft-surface)', color: 'var(--ft-text)', cursor: 'pointer', font: 'inherit' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15 }}><span aria-hidden="true">{role === 'buyer' ? '↓' : '↑'}</span>{role === 'buyer' ? 'Buying' : 'Selling'}<span style={{ marginLeft: 'auto', borderRadius: 999, minWidth: 22, padding: '2px 7px', textAlign: 'center', background: selected ? 'var(--ft-accent)' : 'rgba(56,189,248,.12)', color: selected ? 'var(--ft-bg)' : 'var(--ft-accent)', fontSize: 11 }}>{count}</span></span>
              <span style={{ display: 'block', marginTop: 7, color: 'var(--ft-text-tertiary)', fontSize: 11 }}>{role === 'buyer' ? 'Your purchases & delivery' : 'Your sales & fulfillment'}</span>
            </button>
          })}
        </div>

        {(orders.length + baskets.length > 0) && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Active items', value: activeCount, accent: 'var(--ft-accent)' },
            { label: 'Completed', value: completedCount, accent: '#34d399' },
            { label: 'In escrow', value: money(heldInEscrow, orders[0]?.currency ?? 'EUR'), accent: '#a78bfa' },
          ].map(stat => <div key={stat.label} style={{ minWidth: 0, padding: '11px 6px', textAlign: 'center', borderRadius: 11, background: 'var(--ft-surface)', border: '1px solid var(--ft-border-strong)' }}>
            <div style={{ color: 'var(--ft-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.07em', fontSize: 9, fontWeight: 800 }}>{stat.label}</div>
            <div style={{ color: stat.accent, marginTop: 4, fontSize: typeof stat.value === 'string' ? 13 : 20, fontWeight: 850, overflowWrap: 'anywhere' }}>{stat.value}</div>
          </div>)}
        </div>}

        {totalCount > 0 && <div role="group" aria-label="Filter orders" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 3, marginBottom: 13 }}>
          {([
            ['all', 'All'], ['active', 'Active'], ['completed', 'Completed'], ['attention', 'Needs attention'],
          ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} style={{ minHeight: 44, padding: '8px 13px', borderRadius: 999, border: `1px solid ${filter === value ? 'var(--ft-accent)' : 'var(--ft-border-strong)'}`, background: filter === value ? 'rgba(56,189,248,.12)' : 'transparent', color: filter === value ? 'var(--ft-accent)' : 'var(--ft-text-secondary)', whiteSpace: 'nowrap', font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>)}
        </div>}

        {loading ? <div style={{ display: 'grid', gap: 10 }} aria-label="Loading orders">{[1, 2, 3].map(number => <div key={number} style={{ height: 112, borderRadius: 14, background: 'var(--ft-surface)', border: '1px solid var(--ft-border-strong)', opacity: .7 }} />)}</div>
          : loadError ? <div role="alert" style={{ textAlign: 'center', padding: '36px 16px', borderRadius: 14, background: 'var(--ft-surface)', border: '1px solid var(--ft-border-strong)' }}><div style={{ fontWeight: 750 }}>{loadError}</div><button type="button" onClick={() => void load()} style={{ ...primaryButton, marginTop: 14 }}>Try again</button></div>
          : filteredOrders.length + filteredBaskets.length === 0 ? <div style={{ textAlign: 'center', padding: '44px 18px', borderRadius: 15, background: 'var(--ft-surface)', border: '1px solid var(--ft-border-strong)' }}>
            <div aria-hidden="true" style={{ fontSize: 32, marginBottom: 9 }}>{filter === 'all' ? (tab === 'buyer' ? '🛍️' : '📦') : '✓'}</div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{filter === 'all' ? (tab === 'buyer' ? 'No purchases yet' : 'No sales yet') : 'Nothing in this filter'}</div>
            <p style={{ color: 'var(--ft-text-tertiary)', fontSize: 13, lineHeight: 1.5, margin: '7px auto 16px', maxWidth: 340 }}>{filter === 'all' ? (tab === 'buyer' ? 'When you buy a service or product, order progress will appear here.' : 'Your product and service sales will be collected here.') : 'Try another filter to see more of your activity.'}</p>
            {filter === 'all' ? <Link href={tab === 'buyer' ? '/services' : '/listings/new'} style={primaryButton}>{tab === 'buyer' ? 'Explore services & products' : 'Create a listing'}</Link> : <button type="button" onClick={() => setFilter('all')} style={secondaryButton}>Show all activity</button>}
          </div> : <div style={{ display: 'grid', gap: 11 }}>
            {filteredOrders.map(order => <OrdinaryOrderCard key={order.id} order={order} role={tab} onError={showError} onUpdated={() => void load()} />)}
            {filteredBaskets.map(order => <BasketOrderCard key={order.id} order={order} role={tab} onError={showError} onUpdated={() => void load()} />)}
          </div>}
      </div>
    </main>
  )
}
