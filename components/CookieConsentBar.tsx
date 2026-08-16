'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const COOKIE_CONSENT_KEY = 'ft_cookie_consent'

export default function CookieConsentBar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(COOKIE_CONSENT_KEY) === 'true') return
    } catch {
      // localStorage unavailable — don't show a banner we can't persist
      return
    }
    setVisible(true)
  }, [])

  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    } catch {
      // ignore — best effort persistence
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .ft-cookie-bar { bottom: 60px !important; }
        }
      `}</style>
      <div
        className="ft-cookie-bar"
        role="region"
        aria-label="Cookie consent"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          background: 'var(--ft-surface)',
          borderTop: '1px solid var(--ft-border-strong)',
          padding: '12px 16px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
        }}
      >
        <p style={{ margin: 0, flex: '1 1 260px', fontSize: '12.5px', lineHeight: 1.4, color: 'var(--ft-text-secondary)' }}>
          We use cookies to improve your experience. By using FreeTrust, you agree to our{' '}
          <Link href="/terms" style={{ color: 'var(--ft-accent)', textDecoration: 'underline' }}>
            Terms &amp; Conditions
          </Link>.
        </p>
        <button
          onClick={handleAccept}
          style={{
            background: 'var(--ft-accent)',
            color: 'var(--ft-bg)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Accept
        </button>
      </div>
    </>
  )
}
