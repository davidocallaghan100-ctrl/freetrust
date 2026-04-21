'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface PendingOrder {
  id: string
  buyer_id: string
  listing_id: string
  listing_type: string
  listing_title: string
  listing_price_cents: number
  listing_currency: string
  message: string | null
  status: string
  expires_at: string
  created_at: string
  buyer?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'rgba(251,191,36,0.2)',  color: '#fbbf24', label: 'Pending' },
  declined:  { bg: 'rgba(248,113,113,0.2)', color: '#f87171', label: 'Declined' },
  cancelled: { bg: 'rgba(148,163,184,0.2)', color: '#cbd5e1', label: 'Cancelled' },
  expired:   { bg: 'rgba(148,163,184,0.2)', color: '#cbd5e1', label: 'Expired' },
  converted: { bg: 'rgba(52,211,153,0.2)',  color: '#34d399', label: 'Converted' },
}

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

function expiresIn(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (d <= 0) return 'Expired'
  return `Expires in ${d}d`
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function PendingOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null)
  const [declining, setDeclining] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pending-orders', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) { setError('Failed to load'); setLoading(false); return }
      const data = await res.json() as { asSeller: PendingOrder[] }
      setOrders(data.asSeller ?? [])

      // Check Stripe status
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('stripe_onboarded').eq('id', user.id).maybeSingle()
        setStripeConnected(!!profile?.stripe_onboarded)
      }
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDecline(id: string) {
    setDeclining(id)
    try {
      const res = await fetch(`/api/pending-orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decline' }) })
      if (res.ok) setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'declined' } : o))
    } catch { /* */ } finally { setDeclining(null) }
  }

  const pending = orders.filter(o => o.status === 'pending')

  return (
    <div style={{ minHeight: '100vh', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ padding: '1.5rem 0 1rem' }}>
          <Link href="/dashboard" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>← Dashboard</Link>
          <h1 style={{ fontSize: 'clamp(1.3rem,3vw,1.7rem)', fontWeight: 800, margin: '0.75rem 0 0.25rem' }}>Pending Orders</h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem' }}>Buyers interested in your listings</p>
        </div>

        {/* Stripe banner */}
        {stripeConnected === false && pending.length > 0 && (
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>You have {pending.length} pending order{pending.length !== 1 ? 's' : ''} waiting</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Connect Stripe to accept payments and fulfil these requests.</div>
            </div>
            <Link href="/wallet?connect=true" style={{ padding: '8px 16px', background: '#fbbf24', color: '#0f172a', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none', flexShrink: 0 }}>Connect Stripe →</Link>
          </div>
        )}
        {stripeConnected === true && pending.length > 0 && (
          <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 14, padding: '0.85rem 1.25rem', marginBottom: '1.25rem', fontSize: 13, color: '#34d399' }}>
            ✓ You&apos;re accepting orders. Buyers with pending requests have been notified.
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Loading...</div>}
        {error && <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', color: '#f87171' }}>{error} <button type="button" onClick={load} style={{ marginLeft: 12, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>Retry</button></div>}

        {!loading && !error && orders.length === 0 && (
          <div style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8' }}>No pending orders yet</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>When buyers request your listings, they&apos;ll appear here.</div>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orders.map(po => {
              const buyer = Array.isArray(po.buyer) ? po.buyer[0] : po.buyer
              const st = STATUS_STYLE[po.status] ?? STATUS_STYLE.pending
              const sym = po.listing_currency === 'GBP' ? '£' : po.listing_currency === 'USD' ? '$' : '€'
              return (
                <div key={po.id} style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {buyer?.avatar_url ? <img src={buyer.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{getInitials(buyer?.full_name ?? null)}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/profile?id=${buyer?.id ?? ''}`} style={{ color: '#f1f5f9', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>{buyer?.full_name ?? 'A buyer'}</Link>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{relTime(po.created_at)} · {expiresIn(po.expires_at)}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 999 }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{po.listing_title} — {sym}{(po.listing_price_cents / 100).toFixed(2)}</div>
                  {po.message && <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{po.message}</div>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link href={`/messages?to=${buyer?.id ?? ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#34d399', textDecoration: 'none' }}>💬 Message buyer</Link>
                    {po.status === 'pending' && (
                      <button type="button" disabled={declining === po.id} onClick={() => handleDecline(po.id)} style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#f87171', cursor: 'pointer' }}>{declining === po.id ? 'Declining…' : 'Decline'}</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
