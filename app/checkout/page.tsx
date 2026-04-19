'use client'

import { Suspense, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Apple Pay / Google Pay button — client-only (uses browser Payment Request API)
const AppleGooglePayButton = dynamic(
  () => import('@/components/payments/AppleGooglePayButton'),
  { ssr: false }
)

interface ServiceListing {
  id: string
  title: string
  description: string | null
  price: number
  currency: string | null
  seller_id: string | null
  avg_rating: number | null
  review_count: number | null
  seller: { full_name: string | null; avatar_url: string | null } | null
}

function fmt(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount)
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const serviceId = searchParams.get('service')

  const [status, setStatus] = useState<'loading' | 'ready' | 'paying' | 'error'>('loading')
  const [error, setError] = useState('')
  const [service, setService] = useState<ServiceListing | null>(null)

  useEffect(() => {
    if (!serviceId) {
      router.replace('/services')
      return
    }

    const supabase = createClient()

    const init = async () => {
      // ── 1. Auth check ──────────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Preserve the full return URL so the user lands back here after login
        const returnUrl = encodeURIComponent(`/checkout?service=${serviceId}`)
        router.replace(`/login?redirect=${returnUrl}`)
        return
      }

      // ── 2. Profile completeness check ─────────────────────────────────────
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, bio')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.full_name) {
        // No name on file — send to onboarding with context
        router.replace(
          `/onboarding?message=${encodeURIComponent(
            'Please complete your profile before booking a service.'
          )}&return=${encodeURIComponent(`/checkout?service=${serviceId}`)}`
        )
        return
      }

      // ── 3. Fetch service details ───────────────────────────────────────────
      const { data: svc, error: svcErr } = await supabase
        .from('listings')
        .select('id, title, description, price, currency, seller_id, avg_rating, review_count, seller:profiles!seller_id(full_name, avatar_url)')
        .eq('id', serviceId)
        .eq('status', 'active')
        .maybeSingle()

      if (svcErr || !svc) {
        setError('This service could not be found or is no longer available.')
        setStatus('error')
        return
      }

      setService(svc as unknown as ServiceListing)
      setStatus('ready')
    }

    init().catch(err => {
      console.error('[checkout] init error:', err)
      setError('Something went wrong. Please try again.')
      setStatus('error')
    })
  }, [serviceId, router])

  const handlePay = async () => {
    if (!service) return
    setStatus('paying')
    try {
      const res = await fetch('/api/checkout/service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: service.id, package_tier: 'Basic' }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Payment could not be initiated. Please try again.')
        setStatus('ready')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Could not connect to payment provider. Please check your connection.')
      setStatus('ready')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (status === 'error' || !service) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#f1f5f9', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Service unavailable</h2>
        <p style={{ color: '#64748b', margin: 0, maxWidth: 400 }}>{error || 'This service could not be loaded.'}</p>
        <Link href="/services" style={{ marginTop: '0.5rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 10, padding: '0.6rem 1.5rem', color: '#38bdf8', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Browse Services
        </Link>
      </div>
    )
  }

  // ── Checkout summary ─────────────────────────────────────────────────────────
  const currency = (service.currency ?? 'EUR') as string
  const price = service.price
  const fee = Math.round(price * 0.08 * 100) / 100
  const sellerReceives = Math.round((price - fee) * 100) / 100
  const sellerName = service.seller?.full_name ?? 'FreeTrust Member'

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 1rem' }}>
            🛠
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 0.4rem', letterSpacing: '-0.5px' }}>Confirm Booking</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>Review your order before proceeding to payment</p>
        </div>

        {/* Order card */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 16, padding: '1.5rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Service</div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#f1f5f9', marginBottom: '0.35rem' }}>{service.title}</div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
            {service.description ?? 'Professional service delivered with care.'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>by <strong style={{ color: '#f1f5f9' }}>{sellerName}</strong>
            {(service.avg_rating ?? 0) > 0 && (
              <span style={{ marginLeft: '0.5rem', color: '#fbbf24' }}>★ {Number(service.avg_rating).toFixed(1)} ({service.review_count})</span>
            )}
          </div>
        </div>

        {/* Price breakdown */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Price Breakdown</div>
          {[
            { label: 'Service price', value: fmt(price, currency) },
            { label: 'Platform fee (8%)', value: fmt(fee, currency), muted: true },
            { label: 'Seller receives', value: fmt(sellerReceives, currency), muted: true },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
              <span style={{ fontSize: '0.88rem', color: row.muted ? '#64748b' : '#f1f5f9' }}>{row.label}</span>
              <span style={{ fontSize: '0.88rem', fontWeight: row.muted ? 400 : 700, color: row.muted ? '#64748b' : '#38bdf8' }}>{row.value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f1f5f9' }}>Total due today</span>
            <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#38bdf8' }}>{fmt(price, currency)}</span>
          </div>
        </div>

        {/* Escrow note */}
        <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔒</span>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
            Payment is held in <strong style={{ color: '#34d399' }}>secure escrow</strong> until you confirm the work is complete. Your money is protected.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#f87171' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Apple Pay / Google Pay express checkout — only shown on supported devices */}
        <AppleGooglePayButton
          amountCents={Math.round(price * 100)}
          currency={currency.toUpperCase()}
          label={service.title ?? 'FreeTrust Service'}
          description={service.title ?? undefined}
          metadata={{ type: 'service_purchase', service_id: service.id }}
          onSuccess={(piId) => {
            router.push(`/checkout/success?payment_intent=${piId}`)
          }}
          onError={(msg) => setError(msg)}
          style={{ marginBottom: 12 }}
        />

        {/* CTA */}
        <button
          onClick={handlePay}
          disabled={status === 'paying'}
          style={{ width: '100%', padding: '1rem', background: status === 'paying' ? 'rgba(56,189,248,0.4)' : 'linear-gradient(135deg,#38bdf8,#818cf8)', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 800, color: '#0f172a', cursor: status === 'paying' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'opacity 0.15s', marginBottom: '0.75rem' }}
        >
          {status === 'paying'
            ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Redirecting to payment…</>
            : <>💳 Pay {fmt(price, currency)} by card</>
          }
        </button>

        <Link href={`/services/${service.id}`} style={{ display: 'block', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', textDecoration: 'none', padding: '0.5rem' }}>
          ← Back to service
        </Link>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
