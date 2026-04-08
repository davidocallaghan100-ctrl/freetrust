'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

interface Order {
  id: string
  item_type: string
  item_title: string
  amount_pence: number
  platform_fee_pence: number
  seller_payout_pence: number
  status: string
  buyer_id: string
  seller_id: string
  buyer_name?: string
  seller_name?: string
  created_at: string
  updated_at: string
  escrow_released_at?: string
  delivery_notes?: string
  dispute_reason?: string
}

const STATUS_STEPS = [
  { key: 'pending_escrow', label: 'Payment Pending', icon: '⏳' },
  { key: 'in_progress',    label: 'In Progress', icon: '🔧' },
  { key: 'delivered',      label: 'Delivered', icon: '📦' },
  { key: 'completed',      label: 'Completed', icon: '✅' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_escrow: { label: 'Pending', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  in_progress:    { label: 'In Progress', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  delivered:      { label: 'Delivered', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  completed:      { label: 'Completed', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  disputed:       { label: 'Disputed', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  refunded:       { label: 'Refunded', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function poundFormat(pence: number) {
  return `£${(pence / 100).toFixed(2)}`
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [showDispute, setShowDispute] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      fetchOrder()
    })
  }, [orderId])

  async function fetchOrder() {
    try {
      const res = await fetch(`/api/orders/${orderId}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      } else {
        router.push('/orders')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function doAction(action: string, extra?: Record<string, string>) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(
          action === 'mark_delivered' ? 'Order marked as delivered!' :
          action === 'release_payment' ? 'Payment released! ₮10 trust issued to seller.' :
          action === 'raise_dispute' ? 'Dispute raised. Our team will review.' : 'Updated!',
          'success'
        )
        await fetchOrder()
        setShowDispute(false)
        setDeliveryNotes('')
        setDisputeReason('')
      } else {
        showToast(data.error || 'Action failed', 'error')
      }
    } catch (e) {
      showToast('Something went wrong', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
          Loading order...
        </div>
      </div>
    )
  }

  if (!order) return null

  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending_escrow
  const isBuyer = userId === order.buyer_id
  const isSeller = userId === order.seller_id
  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === order.status)
  const isDisputed = order.status === 'disputed'
  const isRefunded = order.status === 'refunded'

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', padding: '2rem 1rem', paddingTop: '5rem' }}>
      <style>{`
        @media (max-width: 768px) {
          .order-grid { grid-template-columns: 1fr !important; }
          .order-actions { flex-direction: column !important; }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '5rem', right: '1rem', zIndex: 9999,
          background: toast.type === 'success' ? '#0f2d1a' : '#2d0f0f',
          border: `1px solid ${toast.type === 'success' ? '#34d399' : '#f87171'}`,
          color: toast.type === 'success' ? '#34d399' : '#f87171',
          padding: '0.875rem 1.25rem', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem',
          maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Back nav */}
        <Link href="/orders" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem' }}>
          ← Back to Orders
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{order.item_type === 'service' ? '🛠' : '📦'}</span>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#f1f5f9' }}>{order.item_title}</h1>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Order #{order.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <span style={{
            fontSize: '0.85rem', fontWeight: 700, padding: '0.4rem 1rem',
            borderRadius: 20, color: status.color, background: status.bg,
          }}>
            {status.label}
          </span>
        </div>

        <div className="order-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>
          {/* Main column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Timeline */}
            {!isDisputed && !isRefunded && (
              <div style={{ background: '#1e293b', borderRadius: 14, padding: '1.5rem', border: '1px solid rgba(148,163,184,0.1)' }}>
                <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Progress</h3>
                <div style={{ display: 'flex', gap: 0 }}>
                  {STATUS_STEPS.map((step, idx) => {
                    const done = idx < currentStepIdx
                    const current = idx === currentStepIdx
                    return (
                      <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                        {idx < STATUS_STEPS.length - 1 && (
                          <div style={{ position: 'absolute', top: 18, left: '50%', width: '100%', height: 2, background: done ? '#34d399' : 'rgba(148,163,184,0.15)' }} />
                        )}
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: done ? '#34d399' : current ? '#38bdf8' : '#0f172a',
                          border: `2px solid ${done ? '#34d399' : current ? '#38bdf8' : 'rgba(148,163,184,0.2)'}`,
                          fontSize: '1rem', zIndex: 1, position: 'relative',
                        }}>
                          {done ? '✓' : step.icon}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: current ? '#38bdf8' : done ? '#34d399' : '#64748b', marginTop: '0.4rem', textAlign: 'center', fontWeight: current ? 700 : 400 }}>
                          {step.label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Dispute / Refund banner */}
            {isDisputed && (
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, padding: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '0.4rem' }}>⚠️ Dispute Raised</div>
                <div style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>{order.dispute_reason}</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>Our team will review and resolve within 3 business days.</div>
              </div>
            )}

            {isRefunded && (
              <div style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, padding: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: '#94a3b8' }}>💸 Order Refunded</div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>Payment was not processed. Your funds have been returned.</div>
              </div>
            )}

            {/* Delivery notes (if any) */}
            {order.delivery_notes && (
              <div style={{ background: '#1e293b', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(167,139,250,0.2)' }}>
                <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: '0.5rem' }}>📦 Delivery Notes</div>
                <div style={{ fontSize: '0.875rem', color: '#f1f5f9', lineHeight: 1.6 }}>{order.delivery_notes}</div>
              </div>
            )}

            {/* Trust reward info */}
            {(order.status === 'in_progress' || order.status === 'delivered' || order.status === 'completed') && isBuyer && (
              <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>₮</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.9rem' }}>+₮5 Trust Earned</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Awarded for completing this purchase</div>
                </div>
              </div>
            )}

            {/* Actions */}
            {!isRefunded && !isDisputed && (
              <div style={{ background: '#1e293b', borderRadius: 14, padding: '1.5rem', border: '1px solid rgba(148,163,184,0.1)' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</h3>

                {/* SELLER: Mark as delivered */}
                {isSeller && order.status === 'in_progress' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                      Delivery notes (optional)
                    </label>
                    <textarea
                      value={deliveryNotes}
                      onChange={e => setDeliveryNotes(e.target.value)}
                      placeholder="Describe what you've delivered, include any links or files..."
                      style={{
                        width: '100%', minHeight: 100, background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)',
                        borderRadius: 8, color: '#f1f5f9', padding: '0.75rem', fontSize: '0.875rem', resize: 'vertical',
                        outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => doAction('mark_delivered', { delivery_notes: deliveryNotes })}
                      disabled={actionLoading}
                      style={{
                        marginTop: '0.75rem', padding: '0.75rem 1.5rem', background: '#a78bfa',
                        color: '#0f172a', border: 'none', borderRadius: 8, fontWeight: 700,
                        cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1,
                        fontSize: '0.9rem',
                      }}
                    >
                      {actionLoading ? 'Updating...' : '📦 Mark as Delivered'}
                    </button>
                  </div>
                )}

                {/* BUYER: Release payment or raise dispute */}
                {isBuyer && order.status === 'delivered' && (
                  <div>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: 0 }}>
                      The seller has delivered your order. Once you release payment, funds are transferred and the order is complete.
                    </p>
                    <div className="order-actions" style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        onClick={() => doAction('release_payment')}
                        disabled={actionLoading}
                        style={{
                          flex: 1, padding: '0.75rem 1.5rem', background: '#34d399',
                          color: '#0f172a', border: 'none', borderRadius: 8, fontWeight: 700,
                          cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1, fontSize: '0.9rem',
                        }}
                      >
                        {actionLoading ? 'Processing...' : '✅ Release Payment'}
                      </button>
                      <button
                        onClick={() => setShowDispute(true)}
                        disabled={actionLoading}
                        style={{
                          padding: '0.75rem 1.2rem', background: 'rgba(248,113,113,0.1)',
                          color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, fontWeight: 600,
                          cursor: 'pointer', fontSize: '0.9rem',
                        }}
                      >
                        ⚠️ Dispute
                      </button>
                    </div>

                    {showDispute && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10 }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: '#f87171', marginBottom: '0.5rem', fontWeight: 600 }}>
                          Describe the issue *
                        </label>
                        <textarea
                          value={disputeReason}
                          onChange={e => setDisputeReason(e.target.value)}
                          placeholder="Explain what's wrong with the delivery..."
                          style={{
                            width: '100%', minHeight: 80, background: '#0f172a', border: '1px solid rgba(248,113,113,0.2)',
                            borderRadius: 8, color: '#f1f5f9', padding: '0.75rem', fontSize: '0.875rem', resize: 'vertical',
                            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button
                            onClick={() => doAction('raise_dispute', { dispute_reason: disputeReason })}
                            disabled={actionLoading || !disputeReason.trim()}
                            style={{
                              padding: '0.6rem 1.2rem', background: '#f87171', color: '#0f172a',
                              border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
                            }}
                          >
                            Submit Dispute
                          </button>
                          <button onClick={() => setShowDispute(false)} style={{ padding: '0.6rem 1rem', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {order.status === 'completed' && (
                  <div style={{ color: '#34d399', fontWeight: 600 }}>✅ Order complete. Payment has been released to the seller.</div>
                )}

                {order.status === 'pending_escrow' && (
                  <div style={{ color: '#fbbf24', fontSize: '0.875rem' }}>⏳ Waiting for payment confirmation from Stripe.</div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Financial summary */}
            <div style={{ background: '#1e293b', borderRadius: 14, padding: '1.25rem', border: '1px solid rgba(148,163,184,0.1)' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summary</h3>
              {[
                { label: 'Order Total', value: poundFormat(order.amount_pence), highlight: true },
                { label: `Platform Fee (${order.item_type === 'service' ? '8' : '5'}%)`, value: `−${poundFormat(order.platform_fee_pence)}`, color: '#f87171' },
                { label: 'Seller Receives', value: poundFormat(order.seller_payout_pence), color: '#34d399' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.875rem' }}>
                  <span style={{ color: '#94a3b8' }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: row.color || (row.highlight ? '#38bdf8' : '#f1f5f9') }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Order details */}
            <div style={{ background: '#1e293b', borderRadius: 14, padding: '1.25rem', border: '1px solid rgba(148,163,184,0.1)' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Details</h3>
              {[
                { label: 'Type', value: order.item_type.charAt(0).toUpperCase() + order.item_type.slice(1) },
                { label: 'Buyer', value: order.buyer_name || 'Unknown' },
                { label: 'Seller', value: order.seller_name || 'Unknown' },
                { label: 'Placed', value: formatDate(order.created_at) },
                ...(order.escrow_released_at ? [{ label: 'Released', value: formatDate(order.escrow_released_at) }] : []),
              ].map(row => (
                <div key={row.label} style={{ marginBottom: '0.6rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.15rem' }}>{row.label}</div>
                  <div style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>{row.value}</div>
                </div>
              ))}
            </div>

            {/* Trust reward */}
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Trust Rewards</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.875rem', color: '#38bdf8' }}>🛒 +₮5 for buyer on purchase</div>
                <div style={{ fontSize: '0.875rem', color: '#34d399' }}>🏷 +₮10 for seller on completion</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
