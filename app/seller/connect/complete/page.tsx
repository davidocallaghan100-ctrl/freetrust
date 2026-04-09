'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ConnectCompletePage() {
  const [checking, setChecking] = useState(true)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch('/api/stripe/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        })
        const data = await res.json()
        setSuccess(data.onboarded === true)
      } catch {
        setSuccess(false)
      } finally {
        setChecking(false)
      }
    }
    verify()
  }, [])

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 104, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 440, width: '100%', padding: '2rem', textAlign: 'center' }}>
        {checking ? (
          <div style={{ color: '#64748b' }}>Verifying your account…</div>
        ) : success ? (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', color: '#34d399' }}>You're ready to sell!</h1>
            <p style={{ color: '#64748b', lineHeight: 1.7, marginBottom: '2rem' }}>Your Stripe account is connected. Buyers can now pay you directly — funds are released to your bank after delivery confirmation.</p>
            <Link href="/seller/gigs/create" style={{ display: 'block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', borderRadius: 10, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, color: '#0f172a', textDecoration: 'none', marginBottom: '0.75rem' }}>
              Create Your First Listing →
            </Link>
            <Link href="/profile" style={{ display: 'block', color: '#64748b', textDecoration: 'none', fontSize: '0.88rem' }}>
              Back to Profile
            </Link>
          </>
        ) : (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: '#fbbf24' }}>Setup not complete</h1>
            <p style={{ color: '#64748b', lineHeight: 1.7, marginBottom: '2rem' }}>Your Stripe account isn't fully verified yet. Please complete all required steps.</p>
            <Link href="/seller/connect" style={{ display: 'block', background: '#fbbf24', borderRadius: 10, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, color: '#0f172a', textDecoration: 'none' }}>
              Continue Setup →
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
