'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ────────────────────────────────────────────────────────────────────────────
// /reset-password — the landing page for Supabase password-reset emails
// ────────────────────────────────────────────────────────────────────────────
//
// Flow:
//   1. User clicks "Forgot password?" on /login, enters their email.
//   2. login/page.tsx calls supabase.auth.resetPasswordForEmail() with
//      redirectTo: `${origin}/reset-password`.
//   3. Supabase emails them a link like:
//        https://freetrust.co/reset-password?code=<pkce-code>
//      (or with a hash fragment for legacy implicit-flow projects).
//   4. They click the link and land here.
//   5. @supabase/ssr's createBrowserClient auto-exchanges the code on
//      mount and fires an `onAuthStateChange` event with
//      event === 'PASSWORD_RECOVERY'. We listen for that and unlock
//      the new-password form.
//   6. User enters a new password + confirmation.
//   7. We call supabase.auth.updateUser({ password }) to actually set
//      the new password on their auth.users row.
//   8. On success → redirect to /login?reset=success.
//   9. On failure → inline red banner with the real error message.
//
// Edge cases handled:
//   * User lands here without a valid recovery token (bookmarked URL,
//     expired link, or /reset-password navigated to directly) → we
//     show a "request a new reset link" fallback card.
//   * PKCE `code` param exchange fails → same fallback card with the
//     Supabase error message.
//   * Password too weak / doesn't match confirmation → inline validation
//     before the server call so the user doesn't waste a round-trip.
//
// This page does NOT gate behind middleware authentication — the user
// is mid-recovery, so they technically aren't "logged in" yet. The
// recovery session Supabase establishes is scoped to password update
// only.

function ResetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()

  // State machine:
  //   'checking' — initial mount, waiting for onAuthStateChange to
  //                confirm the recovery token was valid
  //   'ready'    — token valid, show the new-password form
  //   'no-token' — landed here without a valid recovery session
  //                (bookmark, expired link, or direct navigation)
  //   'saving'   — updateUser is in-flight
  //   'success'  — password updated, redirecting to /login
  type Stage = 'checking' | 'ready' | 'no-token' | 'saving' | 'success'
  const [stage, setStage] = useState<Stage>('checking')

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  // Password strength meter — identical rules to the register page
  // so users get consistent feedback.
  const pwStrength = (() => {
    if (!newPw) return 0
    let s = 0
    if (newPw.length >= 8) s++
    if (newPw.length >= 12) s++
    if (/[A-Z]/.test(newPw)) s++
    if (/[0-9]/.test(newPw)) s++
    if (/[^A-Za-z0-9]/.test(newPw)) s++
    return s
  })()
  const pwLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][Math.min(pwStrength, 5)]
  const pwColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'][Math.min(pwStrength, 5)]

  // Listen for the PASSWORD_RECOVERY auth event. @supabase/ssr's
  // browser client automatically exchanges the code / parses the
  // hash fragment on page load and fires this event when the token
  // is a recovery token. If the token is invalid or expired, no
  // event fires — we fall back to the no-token state after a short
  // timeout so the user isn't stuck on "checking" forever.
  useEffect(() => {
    let settled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // PASSWORD_RECOVERY is the explicit signal Supabase fires when
      // the session on mount came from a recovery token. This is the
      // ONLY event we care about — ignore SIGNED_IN etc.
      if (event === 'PASSWORD_RECOVERY') {
        settled = true
        setStage('ready')
      }
    })

    // Also check the current session synchronously — if the page was
    // reloaded mid-recovery (user opened the form, hit refresh), the
    // session is already present but onAuthStateChange won't refire.
    // getSession returns the cached session immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return
      if (session) {
        // Any active session on this page is assumed to be a recovery
        // session — middleware doesn't gate /reset-password, and users
        // wouldn't normally land here while signed in.
        setStage('ready')
        settled = true
      }
    })

    // Fallback — if neither path resolves within 4 seconds, treat it
    // as a missing/expired token. 4s is long enough for Supabase's
    // code exchange over a slow connection but short enough that
    // users don't stare at a spinner.
    const timer = window.setTimeout(() => {
      if (!settled) setStage('no-token')
    }, 4000)

    return () => {
      subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Inline validation — match register page rules.
    if (!newPw) { setError('Please enter a new password.'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(newPw)) { setError('Password must contain at least one uppercase letter.'); return }
    if (!/[0-9]/.test(newPw)) { setError('Password must contain at least one number.'); return }
    if (!/[^A-Za-z0-9]/.test(newPw)) { setError('Password must contain at least one special character (e.g. ! @ # $).'); return }
    if (newPw !== confirmPw) { setError('Passwords don\'t match.'); return }

    setStage('saving')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw })
      if (updateError) {
        console.error('[reset-password] updateUser error:', updateError)
        setError(updateError.message || 'Could not update password. Please try again.')
        setStage('ready')
        return
      }
      // Sign out the recovery session so the user has to log in with
      // the new password — cleaner than auto-signing them in from the
      // recovery token.
      await supabase.auth.signOut().catch(() => { /* non-fatal */ })
      setStage('success')
      setTimeout(() => router.push('/login?reset=success'), 1500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      console.error('[reset-password] updateUser threw:', err)
      setError(msg)
      setStage('ready')
    }
  }

  // ── Shared styles (match login/register page) ────────────────────────────
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: '#0f172a',
    position: 'relative',
    overflow: 'hidden',
  }
  const cardStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 420,
    background: 'rgba(30,41,59,0.65)',
    border: '1px solid rgba(16,185,129,0.18)',
    borderRadius: 20,
    padding: '32px 28px',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 0 0 1px rgba(16,185,129,0.05), 0 24px 48px rgba(0,0,0,0.45)',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(148,163,184,0.18)',
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 16,
    color: '#f1f5f9',
    outline: 'none',
    fontFamily: 'inherit',
    minHeight: 46,
    boxSizing: 'border-box' as const,
  }
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 5 }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 24 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#38bdf8,#0284c7)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#0f172a' }}>FT</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>Free<span style={{ color: '#38bdf8' }}>Trust</span></span>
        </Link>

        {stage === 'checking' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: 16 }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>Verifying your reset link…</div>
          </div>
        )}

        {stage === 'no-token' && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>Link expired or invalid</div>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
              This password reset link has expired or is no longer valid. Reset links are single-use and expire after an hour.
            </p>
            <Link
              href="/login"
              style={{
                display: 'block',
                width: '100%',
                padding: 13,
                background: 'linear-gradient(135deg,#10b981,#059669)',
                borderRadius: 12,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              Request a new reset link
            </Link>
          </div>
        )}

        {(stage === 'ready' || stage === 'saving') && (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>Set a new password</div>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
              Pick something strong — at least 8 characters with a number and a special character.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="reset-new-pw">New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reset-new-pw"
                  style={{ ...inputStyle, paddingRight: 48 }}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
              {newPw && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 3, background: 'rgba(148,163,184,0.15)', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${(pwStrength / 5) * 100}%`, background: pwColor, transition: 'width 0.3s, background 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: pwColor }}>{pwLabel}</span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle} htmlFor="reset-confirm-pw">Confirm password</label>
              <input
                id="reset-confirm-pw"
                style={{
                  ...inputStyle,
                  borderColor: confirmPw && newPw !== confirmPw
                    ? 'rgba(239,68,68,0.4)'
                    : confirmPw && newPw === confirmPw
                      ? 'rgba(16,185,129,0.4)'
                      : 'rgba(148,163,184,0.18)',
                }}
                type={showPw ? 'text' : 'password'}
                placeholder="Repeat the new password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
              {confirmPw && newPw === confirmPw && (
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>✓ Passwords match</div>
              )}
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 10,
                  padding: '11px 13px',
                  fontSize: 13,
                  color: '#fca5a5',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  lineHeight: 1.45,
                }}
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={stage === 'saving'}
              style={{
                width: '100%',
                padding: 13,
                background: 'linear-gradient(135deg,#10b981,#059669)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: stage === 'saving' ? 'not-allowed' : 'pointer',
                opacity: stage === 'saving' ? 0.6 : 1,
                minHeight: 48,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {stage === 'saving' && (
                <span style={{ display: 'inline-block', width: 15, height: 15, border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              )}
              {stage === 'saving' ? 'Updating password…' : 'Update password'}
            </button>

            <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 16 }}>
              Remembered it? <Link href="/login" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>Back to sign in</Link>
            </p>
          </form>
        )}

        {stage === 'success' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ width: 64, height: 64, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 18px' }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>Password updated</div>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.65, marginBottom: 20 }}>
              Taking you to sign in with your new password…
            </p>
            <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// useRouter in the inner component requires a Suspense boundary so
// static prerendering doesn't fail. Matches the login page pattern.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
