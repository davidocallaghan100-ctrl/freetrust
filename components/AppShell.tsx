'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Nav from './Nav'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import SearchBar from './SearchBar'
import TrustAssistant from './TrustAssistant'
import { canReceivePush, getPushCapabilities } from '@/lib/push/capabilities'
import { usePushSubscription } from '@/lib/push/usePushSubscription'
import { createClient } from '@/lib/supabase/client'
import { isCommunityVisibleProfile } from '@/lib/profile/completion'

const AUTH_PATHS = ['/login', '/register', '/auth/reset-password', '/auth/callback', '/auth/session', '/login', '/register', '/onboarding']

// Per-session flag — we only trigger IP-based location init once per
// browser tab to avoid hammering the ipapi.co endpoint.
// v2: bumped version so existing members without location re-trigger on next load.
const GEO_INIT_SESSION_KEY = 'freetrust_geo_init_v2'
const PUSH_PROMPTED_KEY = 'push_prompted'

function profileNeedsSetup(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return false
  return !isCommunityVisibleProfile(profile)
}

// ── Push Prompt Banner ────────────────────────────────────────────────────────

function PushPromptBanner({ onDismiss }: { onDismiss: () => void }) {
  const { subscribe, loading } = usePushSubscription()
  const caps = getPushCapabilities()
  const isIOSNotInstalled = caps.isIOS && !caps.isStandalone

  const handleDismiss = () => {
    localStorage.setItem(PUSH_PROMPTED_KEY, '1')
    onDismiss()
  }

  const handleEnable = async () => {
    const permission = await Notification.requestPermission()
    localStorage.setItem(PUSH_PROMPTED_KEY, '1')
    if (permission === 'granted') {
      await subscribe()
    }
    onDismiss()
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '72px',
      left: '16px',
      right: '16px',
      zIndex: 500,
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <span style={{ fontSize: '22px', flexShrink: 0 }}>🔔</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {isIOSNotInstalled ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.4 }}>
            Add FreeTrust to your Home Screen to enable push notifications
            <span style={{ marginLeft: '4px' }}>⬆️</span>
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.4 }}>
            Get notified when members post, comment or react
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
        {!isIOSNotInstalled && (
          <button
            onClick={handleEnable}
            disabled={loading}
            style={{
              background: '#38bdf8',
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? '…' : 'Enable'}
          </button>
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: 'rgba(148,163,184,0.12)',
            color: '#94a3b8',
            border: 'none',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '16px',
            fontFamily: 'inherit',
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}

function ProfileSetupPrompt() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1200,
      background: 'rgba(2,6,23,0.84)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      color: '#fff',
    }}>
      <div style={{ width: 'min(440px, 100%)', background: 'linear-gradient(160deg, rgba(10,15,30,0.98), rgba(15,23,42,0.98))', border: '1px solid rgba(0,194,203,0.32)', borderRadius: 22, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.56), 0 0 28px rgba(0,194,203,0.12)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'rgba(0,194,203,0.12)', border: '1px solid rgba(0,194,203,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 23 }}>🛡️</div>
          <div>
            <h2 style={{ margin: '0 0 6px', color: '#fff', fontSize: 19, fontWeight: 880 }}>Complete your account setup</h2>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, lineHeight: 1.5 }}>
              FreeTrust requires a real first and last name, face photo, bio, location, and at least one hobby before an account appears in the member community or profile pages.
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 16, color: '#cbd5e1', fontSize: 13 }}>
          <div>✓ Real first and last name</div>
          <div>✓ Real profile picture</div>
          <div>✓ Bio, location, and hobbies</div>
        </div>
        <button
          type="button"
          onClick={() => { window.location.href = '/onboarding?welcome=1' }}
          style={{ width: '100%', marginTop: 18, border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#00c2cb,#38bdf8)', color: '#0a0f1e', fontWeight: 880, fontSize: 15, padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
        >Finish setup now</button>
      </div>
    </div>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = AUTH_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isImmersive = pathname === '/agents'
  const [showPushBanner, setShowPushBanner] = useState(false)
  const [showProfilePrompt, setShowProfilePrompt] = useState(false)

  // Globalisation: on first authenticated page load, fire the geo-init
  // endpoint so new users get their country/city/currency defaulted from
  // their IP. The server checks the profile first and no-ops if already
  // set, so this is safe to call on every mount. We gate it on sessionStorage
  // so we don't re-check within the same tab.
  // v2: session key bumped so existing members without location re-trigger.
  useEffect(() => {
    if (isAuth || isImmersive) return
    if (typeof window === 'undefined') return
    try {
      if (sessionStorage.getItem(GEO_INIT_SESSION_KEY)) return
      sessionStorage.setItem(GEO_INIT_SESSION_KEY, '1')
    } catch { /* session storage disabled — still fire once per mount */ }
    // Fire-and-forget — never block the UI on this
    fetch('/api/me/geo-init', { method: 'POST', cache: 'no-store' }).catch(() => {})
  }, [isAuth, isImmersive])

  // New Google/Apple/email members should all receive the same nudge to fill
  // out profile basics and hobbies. This also catches older users who skipped
  // onboarding and landed directly in the feed.
  useEffect(() => {
    if (isAuth || isImmersive) return
    if (typeof window === 'undefined') return
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as { profile?: Record<string, unknown> | null }
        if (profileNeedsSetup(data.profile)) setShowProfilePrompt(true)
      } catch { /* non-critical */ }
    }, 1200)

    return () => clearTimeout(timer)
  }, [isAuth, isImmersive])

  // Register the push notification service worker (sw-push.js) once per session.
  // This is separate from the Workbox sw.js so it won't be overwritten by builds.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw-push.js', { scope: '/' }).catch(() => {
      // Silently ignore — push is progressive enhancement
    })
  }, [])

  // Show push prompt banner after 5 seconds if:
  // - Not on auth page
  // - User is logged in
  // - Device supports push (or is iOS-not-installed — show "add to home screen" tip)
  // - User hasn't been prompted yet
  useEffect(() => {
    if (isAuth || isImmersive) return
    if (typeof window === 'undefined') return
    if (localStorage.getItem(PUSH_PROMPTED_KEY)) return

    // Check if already granted — no need to show banner
    if ('Notification' in window && Notification.permission === 'granted') {
      localStorage.setItem(PUSH_PROMPTED_KEY, '1')
      return
    }

    const caps = getPushCapabilities()
    const shouldShow = canReceivePush() || (caps.isIOS && !caps.isStandalone)
    if (!shouldShow) return

    // Verify user is logged in before showing
    const supabase = createClient()
    const timer = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setShowPushBanner(true)
      } catch { /* silent */ }
    }, 5000)

    return () => clearTimeout(timer)
  }, [isAuth, isImmersive])

  if (isAuth || isImmersive) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a' }}>
        {children}
      </div>
    )
  }

  return (
    <>
      <Nav />
      <SearchBar />
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main className="ft-page-content">
          {children}
          <footer style={{
            borderTop: '1px solid #1e293b',
            padding: '1.25rem 1.5rem',
            textAlign: 'center',
            fontSize: '0.78rem',
            color: '#475569',
            marginTop: '2rem',
          }}>
            &copy; 2026 FreeTrust. All rights reserved.
          </footer>
        </main>
      </div>
      <BottomNav />
      <TrustAssistant />
      {showProfilePrompt && (
        <ProfileSetupPrompt />
      )}
      {showPushBanner && (
        <PushPromptBanner onDismiss={() => setShowPushBanner(false)} />
      )}
    </>
  )
}
