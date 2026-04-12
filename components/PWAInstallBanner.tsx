'use client'

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

// Minimal TypeScript shim for the beforeinstallprompt event, which isn't
// in the standard DOM lib yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

// The early-capture script (in app/layout.tsx <head>) stores the event here
// before React hydrates. This prevents a race where beforeinstallprompt fires
// on first HTML parse, long before React mounts.
declare global {
  interface Window {
    __ftPwaPrompt?: BeforeInstallPromptEvent | null
  }
}

const DISMISS_KEY = 'ft_pwa_dismissed_at'
const DISMISS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
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
  // The live event is stored in a ref — refs never go stale across re-renders,
  // and the event's .prompt() method stays bound to its source object. We
  // mirror presence in `hasPrompt` state so React re-renders the button when
  // the event arrives or is consumed.
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [hasPrompt, setHasPrompt] = useState(false)
  const [visible, setVisible] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone() || wasRecentlyDismissed()) {
      console.log('[PWAInstallBanner] suppressed — already installed or dismissed')
      return
    }

    // Check if the early-capture script (in <head>) already got the event
    if (window.__ftPwaPrompt) {
      console.log('[PWAInstallBanner] picked up early-captured event')
      promptRef.current = window.__ftPwaPrompt
      setHasPrompt(true)
      setVisible(true)
    }

    // Listen for the event in case it fires after hydration (late capture)
    const handleBeforeInstall = (e: Event) => {
      console.log('[PWAInstallBanner] beforeinstallprompt received (post-hydration)')
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
      setHasPrompt(true)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // The early-capture script also re-dispatches as ft-pwa-ready so this
    // component learns about it even if React mounts after the native event
    const handleReady = () => {
      console.log('[PWAInstallBanner] ft-pwa-ready custom event received')
      if (window.__ftPwaPrompt) {
        promptRef.current = window.__ftPwaPrompt
        setHasPrompt(true)
        setVisible(true)
      }
    }
    window.addEventListener('ft-pwa-ready', handleReady as EventListener)

    // Listen for successful install — hide the banner immediately
    const handleInstalled = () => {
      console.log('[PWAInstallBanner] appinstalled fired')
      promptRef.current = null
      setHasPrompt(false)
      setVisible(false)
    }
    window.addEventListener('appinstalled', handleInstalled)

    // iOS Safari never fires beforeinstallprompt — show a hint instead.
    let iosTimer: ReturnType<typeof setTimeout> | undefined
    if (isIos()) {
      iosTimer = setTimeout(() => {
        console.log('[PWAInstallBanner] showing iOS hint')
        setShowIosHint(true)
        setVisible(true)
      }, 2000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('ft-pwa-ready', handleReady as EventListener)
      window.removeEventListener('appinstalled', handleInstalled)
      if (iosTimer) clearTimeout(iosTimer)
    }
  }, [])

  const handleInstall = async (e: ReactMouseEvent) => {
    // Defensive — prevent any ancestor click listener from interfering,
    // and don't let any accidental form submission happen
    e.preventDefault()
    e.stopPropagation()

    const evt = promptRef.current
    console.log('[PWAInstallBanner] Install clicked, promptRef=', !!evt)
    if (!evt) {
      console.warn('[PWAInstallBanner] no deferred prompt to show')
      return
    }

    try {
      // IMPORTANT: prompt() must be called synchronously inside the click
      // handler — no `await` before it — otherwise the user gesture
      // context is lost and Chrome silently refuses the prompt.
      const promptPromise = evt.prompt()
      console.log('[PWAInstallBanner] prompt() invoked, awaiting user choice…')
      await promptPromise

      const choice = await evt.userChoice
      console.log('[PWAInstallBanner] user choice:', choice.outcome)

      if (choice.outcome === 'accepted') {
        setVisible(false)
      }
    } catch (err) {
      console.error('[PWAInstallBanner] prompt error:', err)
    } finally {
      // The event can only be consumed once — clear both the ref and the state
      promptRef.current = null
      setHasPrompt(false)
      // Also clear the global in case we fall back to the early-capture script
      if (typeof window !== 'undefined') window.__ftPwaPrompt = null
    }
  }

  const handleDismiss = (e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[PWAInstallBanner] dismissed')
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString())
    } catch { /* silent */ }
  }

  if (!visible) return null

  const showInstallButton = !showIosHint && hasPrompt

  return (
    <>
      <style>{`
        @keyframes ft-pwa-slide-up-mobile {
          from { transform: translate(-50%, 120%); opacity: 0; }
          to   { transform: translate(-50%, 0);    opacity: 1; }
        }
        @keyframes ft-pwa-slide-up-desktop {
          from { transform: translateY(120%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .ft-pwa-banner {
          position: fixed;
          left: 50%;
          bottom: 88px;
          transform: translateX(-50%);
          z-index: 9999;
          width: min(420px, calc(100vw - 24px));
          background: linear-gradient(135deg, #0a1628 0%, #0f172a 100%);
          border: 1px solid rgba(0,180,216,0.35);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 40px rgba(0,180,216,0.15);
          animation: ft-pwa-slide-up-mobile 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: system-ui, -apple-system, sans-serif;
          pointer-events: auto;
        }
        @media (min-width: 800px) {
          .ft-pwa-banner {
            left: auto;
            right: 24px;
            bottom: 24px;
            transform: none;
            animation-name: ft-pwa-slide-up-desktop;
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
          gap: 4px;
          flex-shrink: 0;
          align-items: center;
        }
        .ft-pwa-install {
          background: #00b4d8;
          color: #0a1628;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          min-height: 44px;
          pointer-events: auto;
          touch-action: manipulation;
          -webkit-tap-highlight-color: rgba(0,0,0,0);
          -webkit-appearance: none;
          appearance: none;
        }
        .ft-pwa-install:active { transform: scale(0.96); }
        .ft-pwa-dismiss {
          background: transparent;
          border: none;
          color: #64748b;
          /* 44x44 tap target to meet Apple HIG minimum */
          width: 44px;
          height: 44px;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          font-family: inherit;
          pointer-events: auto;
          touch-action: manipulation;
          -webkit-tap-highlight-color: rgba(0,0,0,0);
          -webkit-appearance: none;
          appearance: none;
        }
        .ft-pwa-dismiss:hover { background: rgba(148,163,184,0.1); color: #94a3b8; }
        .ft-pwa-dismiss:active { transform: scale(0.92); }
      `}</style>

      <div className="ft-pwa-banner" role="dialog" aria-label="Install FreeTrust app">
        <div className="ft-pwa-icon" aria-hidden="true">₮</div>
        <div className="ft-pwa-text">
          <p className="ft-pwa-title">Install FreeTrust</p>
          <p className="ft-pwa-sub">
            {showIosHint
              ? 'Tap Share → Add to Home Screen'
              : 'Add to your home screen for quick access'}
          </p>
        </div>
        <div className="ft-pwa-actions">
          {showInstallButton && (
            <button
              type="button"
              className="ft-pwa-install"
              onClick={handleInstall}
              onTouchEnd={(e) => {
                // Some mobile browsers (older Android Chrome) fire touchend
                // reliably but swallow the follow-up click. Handle both.
                if (promptRef.current) {
                  e.preventDefault()
                  handleInstall(e as unknown as ReactMouseEvent)
                }
              }}
            >
              Install
            </button>
          )}
          <button
            type="button"
            className="ft-pwa-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
          >
            ✕
          </button>
        </div>
      </div>
    </>
  )
}
