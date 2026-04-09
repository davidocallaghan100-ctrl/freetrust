'use client'
import React, { useEffect } from 'react'

export default function ConnectRefreshPage() {
  useEffect(() => {
    // Automatically re-trigger onboarding when Stripe redirects here due to expiry
    const restart = async () => {
      try {
        const res = await fetch('/api/stripe/connect')
        const data = await res.json()
        if (data.url) window.location.href = data.url
      } catch {
        window.location.href = '/seller/connect'
      }
    }
    restart()
  }, [])

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 104, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b' }}>Refreshing your onboarding link…</div>
    </div>
  )
}
