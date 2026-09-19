'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'

export default function SellerConnectPage() {
  const [status, setStatus] = useState<'loading' | 'not_started' | 'pending' | 'complete'>('loading')
  const [info, setInfo] = useState<{ charges_enabled?: boolean; payouts_enabled?: boolean; account_id?: string } | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paypalEmail, setPaypalEmail] = useState('')
  const [paypalSaving, setPaypalSaving] = useState(false)
  const [paypalMessage, setPaypalMessage] = useState<string | null>(null)

  useEffect(() => {
    checkStatus()
    fetch('/api/paypal/seller', { cache: 'no-store' })
      .then(res => res.ok ? res.json() as Promise<{ paypal_email?: string }> : null)
      .then(data => { if (data) setPaypalEmail(data.paypal_email ?? '') })
      .catch(() => {})
  }, [])

  const savePayPalEmail = async () => {
    setPaypalSaving(true)
    setPaypalMessage(null)
    try {
      const res = await fetch('/api/paypal/seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paypal_email: paypalEmail }),
      })
      const data = await res.json() as { paypal_email?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not save PayPal email')
      setPaypalEmail(data.paypal_email ?? paypalEmail)
      setPaypalMessage('PayPal payout email saved.')
    } catch (err) {
      setPaypalMessage(err instanceof Error ? err.message : 'Could not save PayPal email')
    } finally {
      setPaypalSaving(false)
    }
  }

  const checkStatus = async () => {
    try {
      setError(null)
      const res = await fetch('/api/stripe/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status' }) })
      if (res.status === 404) { setStatus('not_started'); return }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Could not check Stripe status (HTTP ${res.status})`)
        setStatus('pending')
        return
      }
      setInfo(data)
      setStatus(data.onboarded ? 'complete' : 'pending')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check Stripe status')
      setStatus('pending')
    }
  }

  const startOnboarding = async () => {
    setRedirecting(true)
    try {
      setError(null)
      const res = await fetch('/api/stripe/connect')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Could not start Stripe onboarding (HTTP ${res.status})`)
        return
      }
      if (data.url) window.location.href = data.url
      else if (data.onboarded) { setStatus('complete'); setInfo(data); setRedirecting(false) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Stripe onboarding')
    } finally {
      setRedirecting(false)
    }
  }

  const openDashboard = async () => {
    setRedirecting(true)
    try {
      setError(null)
      const res = await fetch('/api/stripe/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dashboard' }) })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Could not open Stripe dashboard (HTTP ${res.status})`)
        return
      }
      if (data.url) window.open(data.url, '_blank')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Stripe dashboard')
    } finally {
      setRedirecting(false)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: 'var(--ft-bg)', color: 'var(--ft-text)', fontFamily: 'system-ui', paddingTop: 64, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520, padding: '2rem 1.5rem' }}>

        {/* Header */}
        <Link href="/profile" style={{ color: 'var(--ft-text-tertiary)', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1.5rem' }}>
          ← Back to Profile
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,var(--ft-accent),#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💳</div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.2 }}>Seller Payments</h1>
            <p style={{ color: 'var(--ft-text-tertiary)', fontSize: '0.85rem', margin: 0 }}>Powered by Stripe Connect</p>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(96,165,250,0.22)', borderRadius: 16, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>🅿️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.98rem' }}>PayPal payout details</div>
              <div style={{ color: 'var(--ft-text-tertiary)', fontSize: '0.78rem' }}>Optional until PayPal checkout is enabled for FreeTrust.</div>
            </div>
          </div>
          <p style={{ color: 'var(--ft-text-secondary)', fontSize: '0.82rem', lineHeight: 1.55, margin: '0.75rem 0 0.9rem' }}>
            Add the email address of your PayPal account so PayPal orders can be released to you after the buyer confirms delivery.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <input
              type="email"
              value={paypalEmail}
              onChange={event => setPaypalEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={{ flex: 1, minWidth: 0, border: '1px solid rgba(96,165,250,0.28)', background: 'var(--ft-bg)', color: 'var(--ft-text)', borderRadius: 10, padding: '0.75rem 0.8rem', fontSize: 16 }}
            />
            <button onClick={savePayPalEmail} disabled={paypalSaving || !paypalEmail.trim()} style={{ border: 'none', borderRadius: 10, padding: '0 1rem', background: '#2563eb', color: '#fff', fontWeight: 800, cursor: paypalSaving ? 'wait' : 'pointer', opacity: paypalSaving || !paypalEmail.trim() ? 0.55 : 1 }}>
              {paypalSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {paypalMessage && <div style={{ marginTop: 8, color: paypalMessage.includes('saved') ? '#34d399' : '#fca5a5', fontSize: '0.78rem' }}>{paypalMessage}</div>}
        </div>

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--ft-text-tertiary)' }}>Checking your account…</div>
        )}

        {error && status !== 'loading' && (
          <div style={{ marginTop: '1.25rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.28)', borderRadius: 14, padding: '1rem', color: '#fecaca', fontSize: '0.86rem', lineHeight: 1.55 }}>
            <strong style={{ color: '#fca5a5' }}>Stripe status needs attention.</strong><br />
            {error}
          </div>
        )}

        {status === 'not_started' && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ background: 'var(--ft-surface)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, padding: '1.75rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Start accepting payments</h2>
              <p style={{ color: 'var(--ft-text-tertiary)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                Connect your bank account through Stripe to receive payments for your services and products. FreeTrust takes a small platform fee — you keep the rest, paid out directly to your bank.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
                {[
                  { icon: '🔒', text: 'Bank-grade security via Stripe' },
                  { icon: '⚡', text: 'Fast payouts — 2 business days' },
                  { icon: '🌍', text: 'Supports global accounts' },
                  { icon: '📱', text: 'Apple Pay & Google Pay for buyers' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.88rem', color: 'var(--ft-text-secondary)' }}>
                    <span>{icon}</span><span>{text}</span>
                  </div>
                ))}
              </div>
              <button onClick={startOnboarding} disabled={redirecting} style={{ width: '100%', background: 'linear-gradient(135deg,var(--ft-accent),#0284c7)', border: 'none', borderRadius: 10, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, color: 'var(--ft-bg)', cursor: redirecting ? 'not-allowed' : 'pointer', opacity: redirecting ? 0.7 : 1 }}>
                {redirecting ? 'Redirecting to Stripe…' : 'Connect Bank Account →'}
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--ft-text-faint)' }}>
              You'll be redirected to Stripe to complete identity verification. This takes about 5 minutes.
            </p>
          </div>
        )}

        {status === 'pending' && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 16, padding: '1.75rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fbbf24' }}>Onboarding incomplete</h2>
              <p style={{ color: 'var(--ft-text-tertiary)', fontSize: '0.88rem', lineHeight: 1.7 }}>Your Stripe account has been created but needs more information before you can accept payments.</p>
            </div>
            <button onClick={startOnboarding} disabled={redirecting} style={{ width: '100%', background: '#fbbf24', border: 'none', borderRadius: 10, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, color: 'var(--ft-bg)', cursor: redirecting ? 'not-allowed' : 'pointer', opacity: redirecting ? 0.7 : 1 }}>
              {redirecting ? 'Redirecting…' : 'Complete Setup →'}
            </button>
          </div>
        )}

        {status === 'complete' && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 16, padding: '1.75rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✅</div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#34d399' }}>Payments active</h2>
              <p style={{ color: 'var(--ft-text-tertiary)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1rem' }}>Your account is fully set up. Buyers can now pay you — funds go straight to your bank after delivery.</p>
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
                <span style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 999, padding: '0.2rem 0.7rem', color: '#34d399' }}>
                  {info?.charges_enabled ? '✓ Charges enabled' : '✗ Charges disabled'}
                </span>
                <span style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 999, padding: '0.2rem 0.7rem', color: '#34d399' }}>
                  {info?.payouts_enabled ? '✓ Payouts enabled' : '✗ Payouts disabled'}
                </span>
              </div>
            </div>
            <button onClick={openDashboard} disabled={redirecting} style={{ width: '100%', background: 'var(--ft-surface)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, padding: '0.85rem', fontSize: '1rem', fontWeight: 700, color: 'var(--ft-accent)', cursor: redirecting ? 'not-allowed' : 'pointer' }}>
              {redirecting ? 'Opening…' : 'View Stripe Dashboard →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
