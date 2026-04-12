'use client'

import { useEffect, useState } from 'react'

// Minimal TypeScript shim for the beforeinstallprompt event, which isn't
// in the standard DOM lib yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'ft_pwa_dismissed_at'
const DISMISS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // PWA running in standalone mode
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari sets navigator.standalone when added to home screen
  type NavWithStandalone = Navigator & { standalone?: boolean }
  if ((window.navigator as NavWithStandalone).standalone === true) return true
  return false
}

function isIos(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua) && !/crios|fxios|opios/.test(ua)
}

function wasRecentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = localStorage.getItem(DISMISS_KEY)
    if (!v) return false
    const t = parseInt(v, 10)
    if (isNaN(t)) return false
    return Date.now() - t < DISMISS_WINDOW_MS
  } catch {
    return false
  }
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    // Short-circuit if already installed or recently dismissed
    if (isStandalone() || wasRecentlyDismissed()) return

    // Chrome / Edge / Android Chrome: beforeinstallprompt fires when the
    // PWA is installable. We capture the event and show our own banner.
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari never fires beforeinstallprompt — we need to show
    // "Tap Share → Add to Home Screen" instructions instead.
    if (isIos()) {
      // Delay 2s so the banner doesn't block the first paint
      const t = setTimeout(() => {
        setShowIosHint(true)
        setVisible(true)
      }, 2000)
      return () => {
        clearTimeout(t)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setVisible(false)
    }
    // Clear either way — the event can only be used once
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString())
    } catch { /* silent */ }
  }

  if (!visible) return null

  return (
    <>
      <style>{`
        @keyframes ft-pwa-slide-up {
          from { transform: translate(-50%, 120%); opacity: 0; }
          to   { transform: translate(-50%, 0);    opacity: 1; }
        }
        .ft-pwa-banner {
          position: fixed;
          left: 50%;
          bottom: 88px; /* sit above the mobile nav bar */
          transform: translateX(-50%);
          z-index: 9000;
          width: min(420px, calc(100vw - 24px));
          background: linear-gradient(135deg, #0a1628 0%, #0f172a 100%);
          border: 1px solid rgba(0,180,216,0.35);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 40px rgba(0,180,216,0.15);
          animation: ft-pwa-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: system-ui, -apple-system, sans-serif;
        }
        @media (min-width: 800px) {
          /* On desktop, the mobile nav isn't there — pin to the corner instead */
          .ft-pwa-banner {
            left: auto;
            right: 24px;
            bottom: 24px;
            transform: none;
          }
          @keyframes ft-pwa-slide-up {
            from { transform: translateY(120%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        }
        .ft-pwa-icon {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 11px;
          background: #0a1628;
          border: 1.5px solid rgba(0,180,216,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 900;
          color: #00b4d8;
        }
        .ft-pwa-text {
          flex: 1;
          min-width: 0;
        }
        .ft-pwa-title {
          font-size: 14px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 2px;
          line-height: 1.2;
        }
        .ft-pwa-sub {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.4;
        }
        .ft-pwa-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
          align-items: center;
        }
        .ft-pwa-install {
          background: #00b4d8;
          color: #0a1628;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .ft-pwa-dismiss {
          background: transparent;
          border: none;
          color: #64748b;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          font-family: inherit;
        }
        .ft-pwa-dismiss:hover { background: rgba(148,163,184,0.1); color: #94a3b8; }
      `}</style>

      <div className="ft-pwa-banner" role="dialog" aria-label="Install FreeTrust app">
        <div className="ft-pwa-icon">₮</div>
        <div className="ft-pwa-text">
          <p className="ft-pwa-title">Install FreeTrust</p>
          <p className="ft-pwa-sub">
            {showIosHint
              ? 'Tap Share → Add to Home Screen'
              : 'Add to your home screen for quick access'}
          </p>
        </div>
        <div className="ft-pwa-actions">
          {!showIosHint && deferredPrompt && (
            <button className="ft-pwa-install" onClick={handleInstall}>
              Install
            </button>
          )}
          <button className="ft-pwa-dismiss" onClick={handleDismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>
      </div>
    </>
  )
}
