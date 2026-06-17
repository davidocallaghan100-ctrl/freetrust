'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function getHashParams() {
  if (typeof window === 'undefined') return new URLSearchParams()
  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  return new URLSearchParams(raw)
}

function isProfileIncomplete(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return true
  return profile.onboarding_complete !== true
}

function AuthSessionInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('Securing your FreeTrust session…')

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    const requestedNext = searchParams.get('next') || '/feed'
    const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/feed'

    async function finish() {
      try {
        const hash = getHashParams()
        const accessToken = hash.get('access_token')
        const refreshToken = hash.get('refresh_token')

        if (accessToken && refreshToken) {
          setMessage('Restoring your sign-in…')
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
          // Remove tokens from the visible URL after the browser client stores
          // them in Supabase SSR cookies/local storage.
          window.history.replaceState(null, '', `/auth/session?next=${encodeURIComponent(next)}`)
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.replace('/login?error=auth_callback_failed')
          return
        }

        setMessage('Preparing your FreeTrust welcome…')
        // Idempotent: awards/corrects the welcome Trust grant when needed and
        // no-ops for existing users. This covers implicit-fragment callbacks
        // that bypass the server /auth/callback code path.
        await fetch('/api/auth/signup-bonus', { method: 'POST', cache: 'no-store' }).catch(() => {})

        let destination = next
        try {
          const res = await fetch('/api/profile', { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json() as { profile?: Record<string, unknown> | null }
            if (isProfileIncomplete(data.profile)) destination = '/onboarding?welcome=1'
          } else if (res.status === 404) {
            destination = '/onboarding?welcome=1'
          }
        } catch {
          // Non-fatal — if the profile check fails, continue to the intended route.
        }

        if (!cancelled) router.replace(destination)
      } catch (err) {
        console.error('[auth/session] handoff failed:', err)
        if (!cancelled) router.replace('/login?error=auth_callback_failed')
      }
    }

    void finish()
    return () => { cancelled = true }
  }, [router, searchParams])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(0,194,203,0.22)', borderRadius: 22, padding: 28, textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, margin: '0 auto 18px', background: 'linear-gradient(135deg,#00c2cb,#38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0f1e', fontWeight: 900 }}>FT</div>
        <h1 style={{ margin: '0 0 8px', color: '#fff', fontSize: 22, fontWeight: 850 }}>Signing you in</h1>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: 15, lineHeight: 1.55 }}>{message}</p>
      </div>
    </div>
  )
}

export default function AuthSessionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0f1e', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        Securing your FreeTrust session…
      </div>
    }>
      <AuthSessionInner />
    </Suspense>
  )
}
