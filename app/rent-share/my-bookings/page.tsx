'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface BookingRow {
  id: string
  listing_id: string
  from_date: string
  to_date: string
  message: string | null
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed'
  amount: number | null
  currency: string
  order_status?: string | null
  checked_in_at: string | null
  created_at: string
  rent_share_listings?: { id: string; title: string; images: string[] } | { id: string; title: string; images: string[] }[] | null
}

const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Pending' },
  approved:  { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Approved' },
  declined:  { bg: 'rgba(239,68,68,0.15)',  color: 'var(--ft-danger)', label: 'Declined' },
  cancelled: { bg: 'rgba(100,116,139,0.15)', color: 'var(--ft-text-tertiary)', label: 'Cancelled' },
  completed: { bg: 'rgba(56,189,248,0.15)', color: 'var(--ft-accent)', label: 'Checked-in · Completed' },
}

function listingOf(row: BookingRow) {
  return Array.isArray(row.rent_share_listings) ? row.rent_share_listings[0] : row.rent_share_listings
}

function fmt(amount: number, cur = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: cur || 'EUR' }).format(amount)
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

export default function MyBookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data }) => {
      if (!data.session?.user) { router.push('/login?next=/rent-share/my-bookings'); return }
      setAuthChecked(true)
    })
  }, [router])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/rent-share/requests?role=buyer', { cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setBookings((d.requests ?? []) as BookingRow[])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (authChecked) load() }, [authChecked, load])

  const act = async (id: string, action: 'cancel' | 'check_in') => {
    setActingOn(id)
    setErrors(prev => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch(`/api/rent-share/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json()
      if (!res.ok) {
        setErrors(prev => ({ ...prev, [id]: d.error ?? 'Something went wrong' }))
      } else {
        await load()
      }
    } catch {
      setErrors(prev => ({ ...prev, [id]: 'Network error' }))
    } finally {
      setActingOn(null)
    }
  }

  if (!authChecked || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ft-bg)', padding: '1.5rem 1.25rem' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 90, borderRadius: 14, background: 'var(--ft-surface)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ft-bg)', color: 'var(--ft-text)', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(135deg,rgba(45,212,191,0.08),rgba(8,145,178,0.05))', borderBottom: '1px solid rgba(45,212,191,0.1)', padding: '1.5rem 1.25rem' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'clamp(1.3rem,4vw,1.7rem)', fontWeight: 900, margin: 0 }}>🏠 My Bookings</h1>
          <p style={{ color: 'var(--ft-text-tertiary)', margin: '0.3rem 0 0', fontSize: '0.85rem' }}>Track your Rent &amp; Share requests, approvals and check-ins</p>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {bookings.length === 0 ? (
          <div style={{ background: 'var(--ft-surface)', border: '1px solid rgba(45,212,191,0.15)', borderRadius: 14, padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔎</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>No bookings yet</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--ft-text-tertiary)', marginBottom: '1rem' }}>Browse Rent &amp; Share to find something to rent.</div>
            <Link href="/rent-share" style={{ color: '#2dd4bf', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700, border: '1px solid rgba(45,212,191,0.3)', borderRadius: 8, padding: '0.5rem 1rem', display: 'inline-block' }}>
              Browse Rent &amp; Share
            </Link>
          </div>
        ) : (
          bookings.map(b => {
            const listing = listingOf(b)
            const colors = STATUS_COLOR[b.status] ?? STATUS_COLOR.pending
            const paymentStatus = b.status === 'completed'
              ? 'Payment released'
              : b.order_status === 'pending_escrow'
                ? 'Payment held until check-in'
                : null
            return (
              <div key={b.id} style={{ background: 'var(--ft-surface)', border: '1px solid rgba(45,212,191,0.15)', borderRadius: 14, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/rent-share/${b.listing_id}`} style={{ color: 'var(--ft-text)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                      {listing?.title ?? 'Listing'}
                    </Link>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ft-text-tertiary)', marginTop: 2 }}>{b.from_date} → {b.to_date}</div>
                    {paymentStatus && <div style={{ fontSize: '0.72rem', color: b.status === 'completed' ? '#34d399' : '#fbbf24', marginTop: 4 }}>{paymentStatus}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: 999, background: colors.bg, color: colors.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {colors.label}
                    </span>
                    {b.amount != null && <div style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: 6 }}>{fmt(b.amount, b.currency)}</div>}
                  </div>
                </div>

                {b.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => act(b.id, 'cancel')}
                      disabled={actingOn === b.id}
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.5rem 1rem', color: '#ef4444', fontWeight: 700, fontSize: '0.78rem', cursor: actingOn === b.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    >
                      Cancel request
                    </button>
                  </div>
                )}

                {b.status === 'approved' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.78rem', color: '#fbbf24' }}>
                      Approved! Confirm check-in when you arrive to release {b.amount != null ? fmt(b.amount, b.currency) : 'payment'} from your wallet to the owner.
                    </div>
                    {todayDateOnly() < b.from_date ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--ft-text-tertiary)' }}>Check-in opens on {b.from_date}.</div>
                    ) : todayDateOnly() >= b.to_date ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--ft-danger)' }}>The check-in window has passed.</div>
                    ) : (
                      <button
                        onClick={() => act(b.id, 'check_in')}
                        disabled={actingOn === b.id}
                        style={{ background: 'linear-gradient(135deg,#2dd4bf,#0891b2)', border: 'none', borderRadius: 8, padding: '0.6rem 0', color: 'var(--ft-bg)', fontWeight: 700, fontSize: '0.82rem', cursor: actingOn === b.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                      >
                        {actingOn === b.id ? 'Confirming…' : '🔑 Confirm Check-in & Pay'}
                      </button>
                    )}
                    <button
                      onClick={() => act(b.id, 'cancel')}
                      disabled={actingOn === b.id}
                      style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.5rem 0', color: '#ef4444', fontWeight: 700, fontSize: '0.78rem', cursor: actingOn === b.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    >
                      Cancel booking
                    </button>
                  </div>
                )}

                {b.status === 'completed' && b.checked_in_at && (
                  <div style={{ fontSize: '0.78rem', color: '#34d399' }}>✅ Checked in on {new Date(b.checked_in_at).toLocaleDateString('en-IE')} — payment released.</div>
                )}

                {errors[b.id] && (
                  <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '8px 12px', color: 'var(--ft-danger)', fontSize: '0.78rem' }}>
                    {errors[b.id]}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
