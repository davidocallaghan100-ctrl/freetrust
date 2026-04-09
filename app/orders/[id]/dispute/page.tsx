'use client'
import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const REASONS = [
  'Item not received',
  'Item not as described',
  'Service not delivered',
  'Poor quality of work',
  'Seller unresponsive',
  'Wrong item sent',
  'Damaged in transit',
  'Partial delivery only',
  'Other',
]

interface Order {
  id: string
  title: string
  amount: number
  currency: string
  status: string
  dispute_window_ends: string | null
  buyer_id: string
  seller_id: string
  created_at: string
}

export default function RaiseDisputePage() {
  const params = useParams()
  const orderId = params?.id as string
  const router = useRouter()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('id, title, amount, currency, status, dispute_window_ends, buyer_id, seller_id, created_at')
        .eq('id', orderId)
        .single()
      setOrder(data)
      setLoading(false)
    }
    if (orderId) load()
  }, [orderId])

  const daysLeft = order?.dispute_window_ends
    ? Math.max(0, Math.ceil((new Date(order.dispute_window_ends).getTime() - Date.now()) / 86400000))
    : null

  const submit = async () => {
    if (!reason) return setError('Please select a reason')
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, reason, details }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to raise dispute')
      setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 104px)', paddingTop: 104, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      Loading…
    </div>
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 104px)', paddingTop: 104, background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>

        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>Raise a Dispute</h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Our team will review your case within 48 hours</p>
        </div>

        {success ? (
          <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 16, padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ fontWeight: 800, color: '#34d399', marginBottom: '0.5rem' }}>Dispute Raised</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Your dispute has been submitted. The FreeTrust team will review it within 48 hours and you'll receive an email update at each stage.
            </p>
            <button onClick={() => router.push('/orders')} style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 10, padding: '0.75rem 1.75rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', fontSize: '0.9rem' }}>
              Back to Orders
            </button>
          </div>
        ) : (
          <>
            {/* Order info */}
            {order && (
              <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>ORDER</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.25rem' }}>{order.title ?? `Order #${order.id.slice(0, 8)}`}</div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#64748b' }}>
                  <span>£{order.amount?.toFixed(2)}</span>
                  <span style={{ textTransform: 'capitalize' }}>Status: {order.status}</span>
                  {daysLeft !== null && <span style={{ color: daysLeft > 3 ? '#34d399' : '#fbbf24' }}>⏱ {daysLeft} day{daysLeft !== 1 ? 's' : ''} left to dispute</span>}
                </div>
              </div>
            )}

            {/* Info box */}
            <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#92400e' }}>
              <strong style={{ color: '#fbbf24' }}>Dispute windows:</strong> Services: 72 hours · Physical goods: 7 days after delivery
            </div>

            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Reason */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.5rem' }}>
                  Reason *
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {REASONS.map(r => (
                    <button key={r} onClick={() => setReason(r)} style={{ padding: '0.45rem 0.85rem', borderRadius: 999, fontSize: '0.8rem', cursor: 'pointer', border: reason === r ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(148,163,184,0.2)', background: reason === r ? 'rgba(56,189,248,0.1)' : 'transparent', color: reason === r ? '#38bdf8' : '#94a3b8', fontWeight: reason === r ? 600 : 400, transition: 'all 0.12s' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>
                  Details
                </label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Describe the issue in detail — what happened, when, and what resolution you expect…"
                  rows={5}
                  maxLength={2000}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.88rem', color: '#f1f5f9', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '0.72rem', color: '#475569', textAlign: 'right' }}>{details.length}/2000</div>
              </div>

              {/* Evidence upload placeholder */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>
                  Evidence (optional)
                </label>
                <input type="file" multiple accept="image/*,.pdf" style={{ background: '#0f172a', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: '#94a3b8', width: '100%', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem' }}>Upload screenshots, photos, or documents</div>
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.85rem', color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              <button onClick={submit} disabled={submitting || !reason} style={{ background: submitting || !reason ? 'rgba(56,189,248,0.3)' : 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 10, padding: '0.85rem', fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', cursor: submitting || !reason ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Submitting…' : '🚨 Submit Dispute'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
