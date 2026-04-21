'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Nav from './Nav'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import SearchBar from './SearchBar'
import TrustAssistant from './TrustAssistant'

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/reset-password', '/auth/callback', '/login', '/register', '/onboarding']

// Per-session flag — we only trigger IP-based location init once per
// browser tab to avoid hammering the ipapi.co endpoint.
// v2: bumped version so existing members without location re-trigger on next load.
const GEO_INIT_SESSION_KEY = 'freetrust_geo_init_v2'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = AUTH_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  // Globalisation: on first authenticated page load, fire the geo-init
  // endpoint so new users get their country/city/currency defaulted from
  // their IP. The server checks the profile first and no-ops if already
  // set, so this is safe to call on every mount. We gate it on sessionStorage
  // so we don't re-check within the same tab.
  // v2: session key bumped so existing members without location re-trigger.
  useEffect(() => {
    if (isAuth) return
    if (typeof window === 'undefined') return
    try {
      if (sessionStorage.getItem(GEO_INIT_SESSION_KEY)) return
      sessionStorage.setItem(GEO_INIT_SESSION_KEY, '1')
    } catch { /* session storage disabled — still fire once per mount */ }
    // Fire-and-forget — never block the UI on this
    fetch('/api/me/geo-init', { method: 'POST', cache: 'no-store' }).catch(() => {})
  }, [isAuth])

  // Register the push notification service worker (sw-push.js) once per session.
  // This is separate from the Workbox sw.js so it won't be overwritten by builds.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw-push.js', { scope: '/' }).catch(() => {
      // Silently ignore — push is progressive enhancement
    })
  }, [])

  if (isAuth) {
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
    </>
  )
}
