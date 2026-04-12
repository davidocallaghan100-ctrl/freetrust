'use client'
import { useState, useEffect } from 'react'
import { buildSystemBrowserUrl, type InAppBrowserInfo } from '@/lib/auth/in-app-browser'

/**
 * Shown when the user tries to use Google OAuth inside an in-app browser
 * (Facebook, Instagram, Line, etc). Google blocks those with Error 403:
 * disallowed_useragent — there's no code fix, the user has to open the
 * site in their real browser. This modal walks them through it.
 */
export default function OpenInBrowserModal({
  info,
  onClose,
  onContinueWithEmail,
}: {
  info: InAppBrowserInfo
  onClose: () => void
  /**
   * Called when the user clicks "Continue with Email". The parent page
   * is expected to scroll to its email form and close the modal. If
   * omitted, behaves like onClose.
   */
  onContinueWithEmail?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href)
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the URL so the user can copy manually
      const input = document.getElementById('ft-url-input') as HTMLInputElement | null
      input?.select()
    }
  }

  const handleOpenInSystemBrowser = () => {
    const systemUrl = buildSystemBrowserUrl(currentUrl, info.platform)
    if (systemUrl) {
      window.location.href = systemUrl
    } else {
      handleCopy()
    }
  }

  const browserLabel = info.browserName ?? 'this app'
  const targetBrowser =
    info.platform === 'ios' ? 'Safari' :
    info.platform === 'android' ? 'Chrome' :
    'your default browser'

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '20px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #0a1628 100%)',
          border: '1px solid rgba(0,180,216,0.3)',
          borderRadius: '20px 20px 12px 12px',
          padding: '28px 24px',
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 -20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,180,216,0.1)',
          color: '#f1f5f9',
        }}
      >
        <div style={{ textAlign: 'center', fontSize: 44, marginBottom: 10 }}>🌐</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', margin: '0 0 8px', color: '#f1f5f9' }}>
          Open in your default browser
        </h2>
        <p style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.55 }}>
          To sign in with Google, please open FreeTrust in your default browser.
          {info.browserName ? (
            <><br /><span style={{ fontSize: 12, color: '#64748b' }}>Detected: {browserLabel}</span></>
          ) : null}
        </p>

        {/* URL row for copy */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            id="ft-url-input"
            readOnly
            value={currentUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            style={{
              flex: 1,
              minWidth: 0,
              background: '#020617',
              border: '1px solid #1e293b',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12,
              color: '#cbd5e1',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleCopy}
            style={{
              background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(0,180,216,0.15)',
              border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'rgba(0,180,216,0.4)'}`,
              color: copied ? '#34d399' : '#00b4d8',
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>

        {/* Try to force system browser (platform-specific, may be ignored) */}
        {(info.platform === 'ios' || info.platform === 'android') && (
          <button
            type="button"
            onClick={handleOpenInSystemBrowser}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #00b4d8 0%, #0096c7 100%)',
              color: '#0a1628',
              border: 'none',
              borderRadius: 12,
              padding: '14px',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: 10,
            }}
          >
            Try to open in {targetBrowser}
          </button>
        )}

        {/* Plain instructions so the user never gets stuck */}
        <div
          style={{
            background: 'rgba(56,189,248,0.05)',
            border: '1px solid rgba(56,189,248,0.15)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 12,
            color: '#94a3b8',
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          <strong style={{ color: '#cbd5e1' }}>Or manually:</strong> tap the{' '}
          <strong style={{ color: '#cbd5e1' }}>⋯ menu</strong> in the corner and choose{' '}
          <strong style={{ color: '#cbd5e1' }}>&quot;Open in {targetBrowser}&quot;</strong>,
          then sign in with Google from there.
        </div>

        {/* or divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 16px' }}>
          <div style={{ flex: 1, height: 1, background: '#1e293b' }} />
          <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1e293b' }} />
        </div>

        <button
          type="button"
          onClick={onContinueWithEmail ?? onClose}
          style={{
            width: '100%',
            background: 'rgba(56,189,248,0.1)',
            color: '#38bdf8',
            border: '1px solid rgba(56,189,248,0.3)',
            borderRadius: 12,
            padding: '14px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ✉️ Continue with Email
        </button>
      </div>
    </div>
  )
}
