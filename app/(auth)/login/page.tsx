'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { detectInAppBrowser, type InAppBrowserInfo } from '@/lib/auth/in-app-browser'
import OpenInBrowserModal from '@/components/OpenInBrowserModal'

// useSearchParams() requires a Suspense boundary — inner component reads it,
// outer default export wraps it so static prerendering doesn't fail.
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  // Where to send the user after login — middleware sets ?redirect=<path>
  const redirectTo = searchParams.get('redirect') || '/feed'

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [inAppInfo, setInAppInfo] = useState<InAppBrowserInfo | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      // Use server-side login endpoint (has rate limiting + lockout)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      })
      if (res.status === 429) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Too many attempts. Please wait 15 minutes before trying again.')
        return
      }
      if (res.status === 401) {
        setError('Incorrect email or password. Please try again.')
        return
      }
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        if ((data.error ?? '').includes('Email not confirmed')) {
          setError('Please confirm your email address before signing in.')
        } else {
          setError(data.error ?? 'Unable to sign in. Please try again.')
        }
        return
      }
      router.push(redirectTo)
      router.refresh()
    } catch {
      setError('Unable to sign in. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    // Google returns Error 403: disallowed_useragent inside WebViews
    // (Facebook, Instagram, TikTok, Line, etc). Detect the in-app browser
    // BEFORE starting OAuth and show an instructional modal instead.
    const info = detectInAppBrowser()
    if (info.isInApp) {
      console.warn('[login] blocked Google OAuth — in-app browser detected:', info.browserName)
      setInAppInfo(info)
      return
    }

    setGoogleLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          queryParams: { prompt: 'select_account', access_type: 'offline' },
          skipBrowserRedirect: false,
        },
      })
      if (error) {
        console.error('[login] Google OAuth error:', error)
        setError(error.message || 'Google sign-in failed. Please try again.')
        setGoogleLoading(false)
      }
      // If no error, Supabase has already navigated away — nothing more to do
    } catch (err) {
      console.error('[login] Google OAuth threw:', err)
      const msg = err instanceof Error ? err.message : 'Google sign-in failed'
      setError(msg)
      setGoogleLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) return
    setResetLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setResetSent(true)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .auth-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: #0f172a;
          position: relative;
          overflow: hidden;
        }
        .auth-page::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }
        .blob { position: absolute; border-radius: 50%; filter: blur(70px); pointer-events: none; }
        .blob-1 { width: 300px; height: 300px; background: radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%); top: -80px; right: -60px; }
        .blob-2 { width: 260px; height: 260px; background: radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%); bottom: -60px; left: -40px; }
        .auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
          background: rgba(30,41,59,0.65);
          border: 1px solid rgba(56,189,248,0.18);
          border-radius: 20px;
          padding: 32px 28px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 0 0 1px rgba(56,189,248,0.05), 0 24px 48px rgba(0,0,0,0.45);
        }
        .auth-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; margin-bottom: 26px; }
        .auth-logo-mark {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, #38bdf8, #0284c7);
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; flex-shrink: 0;
        }
        .auth-logo-text { font-size: 18px; font-weight: 800; color: #f1f5f9; letter-spacing: -0.3px; }
        .auth-logo-text span { color: #38bdf8; }
        .auth-heading { font-size: 22px; font-weight: 800; color: #f1f5f9; letter-spacing: -0.4px; margin-bottom: 4px; }
        .auth-sub { font-size: 14px; color: #64748b; margin-bottom: 22px; }
        .auth-sub a { color: #38bdf8; text-decoration: none; font-weight: 600; }
        .auth-sub a:hover { text-decoration: underline; }

        /* Google button */
        .btn-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 13px 16px;
          background: #fff;
          border: none;
          border-radius: 12px;
          color: #1e293b;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
          min-height: 48px;
        }
        .btn-google:hover:not(:disabled) { background: #f8fafc; transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.3); }
        .btn-google:disabled { opacity: 0.6; cursor: not-allowed; }

        .auth-divider { display: flex; align-items: center; gap: 10px; margin: 18px 0; }
        .auth-divider-line { flex: 1; height: 1px; background: rgba(148,163,184,0.15); }
        .auth-divider-text { font-size: 12px; color: #475569; white-space: nowrap; }

        .auth-field { margin-bottom: 14px; }
        .auth-field-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .auth-label { font-size: 13px; font-weight: 500; color: #94a3b8; display: block; margin-bottom: 6px; }
        .auth-input-wrap { position: relative; }
        .auth-input {
          width: 100%;
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(148,163,184,0.18);
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 16px;
          color: #f1f5f9;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: inherit;
          -webkit-appearance: none;
          min-height: 48px;
        }
        .auth-input::placeholder { color: #334155; }
        .auth-input:focus { border-color: rgba(56,189,248,0.45); box-shadow: 0 0 0 3px rgba(56,189,248,0.1); }
        .auth-input.has-toggle { padding-right: 48px; }

        .pw-toggle {
          position: absolute;
          right: 4px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: #475569;
          cursor: pointer;
          padding: 0;
          display: flex; align-items: center; justify-content: center;
          width: 44px; height: 44px;
          font-size: 14px;
        }
        .pw-toggle:hover { color: #94a3b8; }

        .forgot-btn {
          background: none; border: none;
          color: #38bdf8; font-size: 12px; font-weight: 500;
          cursor: pointer; padding: 0; font-family: inherit;
          min-height: 28px;
        }
        .forgot-btn:hover { text-decoration: underline; }

        .auth-error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          padding: 11px 13px;
          font-size: 13px;
          color: #fca5a5;
          margin-bottom: 16px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.45;
        }

        .btn-primary {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #38bdf8, #0284c7);
          border: none;
          border-radius: 12px;
          color: #0f172a;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.15s;
          font-family: inherit;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .spinner {
          display: inline-block;
          width: 15px; height: 15px;
          border: 2px solid rgba(15,23,42,0.25);
          border-top-color: #0f172a;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .auth-trust {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid rgba(148,163,184,0.1);
          flex-wrap: wrap;
        }
        .trust-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #475569; }

        .reset-back {
          display: inline-flex; align-items: center; gap: 5px;
          background: none; border: none;
          color: #64748b; font-size: 13px; cursor: pointer;
          padding: 0; font-family: inherit; margin-bottom: 18px;
          min-height: 36px;
        }
        .reset-back:hover { color: #94a3b8; }
        .reset-heading { font-size: 20px; font-weight: 800; color: #f1f5f9; margin-bottom: 6px; }
        .reset-sub { font-size: 13px; color: #64748b; margin-bottom: 20px; line-height: 1.55; }
        .reset-success {
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 10px;
          padding: 16px;
          font-size: 14px;
          color: #6ee7b7;
          line-height: 1.6;
          text-align: center;
        }

        @media (max-width: 420px) {
          .auth-card { padding: 24px 18px; border-radius: 16px; }
          .auth-heading { font-size: 20px; }
          .btn-google { font-size: 14px; }
        }
      `}</style>

      {inAppInfo && (
        <OpenInBrowserModal
          info={inAppInfo}
          onClose={() => setInAppInfo(null)}
          onContinueWithEmail={() => {
            setInAppInfo(null)
            setTimeout(() => {
              document.getElementById('email-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              const firstInput = document.querySelector<HTMLInputElement>('#email-form input[type="email"], #email-form input:not([type="hidden"])')
              firstInput?.focus()
            }, 50)
          }}
        />
      )}

      <div className="auth-page">
        <div className="blob blob-1" />
        <div className="blob blob-2" />

        <div className="auth-card">
          <Link href="/" className="auth-logo">
            <div className="auth-logo-mark">FT</div>
            <span className="auth-logo-text">Free<span>Trust</span></span>
          </Link>

          {showReset ? (
            <>
              <button className="reset-back" onClick={() => { setShowReset(false); setResetSent(false) }}>
                ← Back to sign in
              </button>
              <div className="reset-heading">Reset password</div>
              {resetSent ? (
                <div className="reset-success">
                  ✅ Check <strong>{resetEmail}</strong><br /><br />
                  We sent a password reset link. Check your spam folder if you don&apos;t see it.
                </div>
              ) : (
                <>
                  <p className="reset-sub">Enter your email and we&apos;ll send a reset link right away.</p>
                  <form onSubmit={handleReset} noValidate>
                    <div className="auth-field">
                      <label className="auth-label">Email address</label>
                      <input
                        className="auth-input"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        placeholder="you@example.com"
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={resetLoading}>
                      {resetLoading && <span className="spinner" />}
                      {resetLoading ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>
                </>
              )}
            </>
          ) : (
            <>
              <div className="auth-heading">Welcome back</div>
              <p className="auth-sub">
                No account? <Link href="/register">Sign up free →</Link>
              </p>

              {/* Google — primary CTA */}
              <button className="btn-google" type="button" onClick={handleGoogleLogin} disabled={googleLoading}>
                {googleLoading ? (
                  <span className="spinner" style={{ borderColor: 'rgba(30,41,59,0.2)', borderTopColor: '#1e293b' }} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {googleLoading ? 'Redirecting…' : 'Continue with Google'}
              </button>

              <div className="auth-divider">
                <div className="auth-divider-line" />
                <span className="auth-divider-text">or email</span>
                <div className="auth-divider-line" />
              </div>

              <form id="email-form" onSubmit={handleSubmit} noValidate>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="login-email">Email address</label>
                  <input
                    id="login-email"
                    className="auth-input"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="auth-field">
                  <div className="auth-field-top">
                    <label className="auth-label" htmlFor="login-password" style={{ margin: 0 }}>Password</label>
                    <button type="button" className="forgot-btn" onClick={() => setShowReset(true)}>Forgot?</button>
                  </div>
                  <div className="auth-input-wrap">
                    <input
                      id="login-password"
                      className="auth-input has-toggle"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={form.password}
                      onChange={handleChange}
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide' : 'Show'}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="auth-error">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading && <span className="spinner" />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div className="auth-trust">
                <div className="trust-item">🔒 Encrypted</div>
                <div className="trust-item">🛡️ SOC 2 Ready</div>
                <div className="trust-item">✅ No spam</div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
