'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { detectInAppBrowser, type InAppBrowserInfo } from '@/lib/auth/in-app-browser'
import OpenInBrowserModal from '@/components/OpenInBrowserModal'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirm: '', website_url: '' })
  const [agreeHuman, setAgreeHuman] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  // True when signUp returned without a session — user must click the link in
  // their confirmation email to activate the account. We show a distinct UI
  // for this case and DON'T auto-redirect to /onboarding (which is gated by
  // middleware and would bounce the user back to /login).
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [trustToast, setTrustToast] = useState(false)
  const [inAppInfo, setInAppInfo] = useState<InAppBrowserInfo | null>(null)

  // Auto-redirect to onboarding after success — ONLY when we have a session.
  // With email confirmation enabled, signUp returns session=null and we show
  // the confirmation UI instead.
  useEffect(() => {
    if (!success || needsConfirmation) return
    const t = setTimeout(() => router.push('/onboarding'), 1500)
    return () => clearTimeout(t)
  }, [success, needsConfirmation, router])

  // Password strength
  const pwStrength = (() => {
    const pw = form.password
    if (!pw) return 0
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    return score
  })()

  const pwLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][Math.min(pwStrength, 5)]
  const pwColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'][Math.min(pwStrength, 5)]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const issueSignupBonus = async () => {
    try {
      const res = await fetch('/api/auth/signup-bonus', { method: 'POST' })
      const data = await res.json() as { issued?: boolean }
      if (data.issued) {
        setTrustToast(true)
        setTimeout(() => setTrustToast(false), 4000)
      }
    } catch {
      // Silently fail — trust bonus is non-critical
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.first_name.trim()) { setError('Please enter your first name.'); return }
    if (!form.last_name.trim())  { setError('Please enter your last name.');  return }
    if (!form.email) { setError('Please enter your email address.'); return }
    if (!form.password) { setError('Please choose a password.'); return }
    // Strong password enforcement
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(form.password)) { setError('Password must contain at least one uppercase letter.'); return }
    if (!/[0-9]/.test(form.password)) { setError('Password must contain at least one number.'); return }
    if (!/[^A-Za-z0-9]/.test(form.password)) { setError('Password must contain at least one special character (e.g. ! @ # $).'); return }
    if (form.password !== form.confirm) { setError('Passwords don\'t match.'); return }

    // Honeypot: bots fill the hidden field, humans don't
    if (form.website_url) {
      // Silently fake success so bots don't learn to bypass this
      setSuccess(true)
      return
    }
    if (!agreeHuman) { setError('Please confirm you are a real person to continue.'); return }

    setLoading(true)
    try {
      const firstName = form.first_name.trim()
      const lastName  = form.last_name.trim()
      const fullName  = `${firstName} ${lastName}`.trim()
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          // handle_new_user() reads all three from raw_user_meta_data
          data: { first_name: firstName, last_name: lastName, full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/feed`,
        },
      })
      if (error) {
        // Surface the full Supabase error object in DevTools so the next
        // debug cycle shows exactly what Postgres/trigger said. The friendly
        // messages below are for the user — the console.error is for us.
        console.error('[register] supabase.signUp error:', {
          message: error.message,
          status: (error as unknown as { status?: number }).status,
          code: (error as unknown as { code?: string }).code,
          name: error.name,
          raw: error,
        })

        const msg = error.message || ''
        if (msg.includes('already registered') || msg.includes('User already registered') || msg.includes('already been registered')) {
          throw new Error('An account with this email already exists. Try signing in instead.')
        }
        if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
          throw new Error('Too many attempts. Please wait a minute and try again.')
        }
        if (msg.includes('Database error') || msg.includes('unexpected_failure')) {
          // A trigger is failing during profile creation. Show the friendly
          // message but also print the actual cause to the console for
          // the developer to see. The defensive triggers in
          // supabase/migrations/20260412_signup_defensive.sql should prevent
          // this from ever happening — if you're seeing this, run that
          // migration in the Supabase SQL editor.
          console.error('[register] Database error during signup — likely a trigger failure. Run supabase/migrations/20260412_signup_defensive.sql to install the self-healing trigger.')
          throw new Error('We\'re setting things up — please try again in a moment.')
        }
        throw new Error(msg || 'Something went wrong. Please try again.')
      }

      // Supabase anti-enumeration: for an already-registered email, signUp
      // can silently return success with an empty identities array instead
      // of an error. Detect that here so the user isn't left thinking they
      // created a new account.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const identities = (signUpData.user as any)?.identities
      if (signUpData.user && Array.isArray(identities) && identities.length === 0) {
        throw new Error('An account with this email already exists. Try signing in instead.')
      }

      // Branch on whether signUp returned a live session:
      //   - session present  → email confirmation disabled; auto-sign-in.
      //     Award the ₮25 bonus now and redirect to /onboarding (handled by
      //     the useEffect via setSuccess(true)).
      //   - session missing  → email confirmation required. Show the
      //     "check your email" UI and DON'T call the bonus route (it would
      //     401 since there's no session); the auth/callback route awards
      //     the bonus after the user clicks the confirmation link.
      if (signUpData.session) {
        void issueSignupBonus()
        setSuccess(true)
      } else {
        setConfirmationEmail(form.email)
        setNeedsConfirmation(true)
        setSuccess(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    // Google returns Error 403: disallowed_useragent inside WebViews.
    // Detect the in-app browser BEFORE starting OAuth and show an
    // instructional modal instead — no code change makes OAuth work
    // inside Facebook/Instagram/TikTok/etc. in-app browsers.
    const info = detectInAppBrowser()
    if (info.isInApp) {
      console.warn('[register] blocked Google OAuth — in-app browser detected:', info.browserName)
      setInAppInfo(info)
      return
    }

    setGoogleLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
          queryParams: { prompt: 'select_account', access_type: 'offline' },
          // Explicit default — Supabase performs the window.location.href
          // navigation internally. We could set this to true to get the
          // URL back and navigate ourselves, but the default works fine
          // for normal browsers.
          skipBrowserRedirect: false,
        },
      })
      if (error) {
        console.error('[register] Google OAuth error:', error)
        setError(error.message || 'Google sign-in failed. Please try again.')
        setGoogleLoading(false)
      }
      // If no error, Supabase has already navigated away — nothing more to do
    } catch (err) {
      console.error('[register] Google OAuth threw:', err)
      const msg = err instanceof Error ? err.message : 'Google sign-in failed'
      setError(msg)
      setGoogleLoading(false)
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
        .blob-1 { width: 320px; height: 320px; background: radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%); top: -100px; left: -80px; }
        .blob-2 { width: 280px; height: 280px; background: radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%); bottom: -80px; right: -60px; }
        .auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: rgba(30,41,59,0.65);
          border: 1px solid rgba(16,185,129,0.18);
          border-radius: 20px;
          padding: 32px 28px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 0 0 1px rgba(16,185,129,0.05), 0 24px 48px rgba(0,0,0,0.45);
        }
        .auth-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; margin-bottom: 24px; }
        .auth-logo-mark {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, #38bdf8, #0284c7);
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; flex-shrink: 0;
        }
        .auth-logo-text { font-size: 18px; font-weight: 800; color: #f1f5f9; letter-spacing: -0.3px; }
        .auth-logo-text span { color: #38bdf8; }

        .trust-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: linear-gradient(135deg, rgba(56,189,248,0.15), rgba(52,211,153,0.1));
          border: 1px solid rgba(56,189,248,0.3);
          border-radius: 12px;
          padding: 12px 18px;
          font-size: 14px;
          font-weight: 600;
          color: #38bdf8;
          z-index: 9999;
          animation: slideIn 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .perks-strip {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(16,185,129,0.07);
          border: 1px solid rgba(16,185,129,0.15);
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }
        .perk { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #6ee7b7; font-weight: 500; }

        .auth-heading { font-size: 22px; font-weight: 800; color: #f1f5f9; letter-spacing: -0.4px; margin-bottom: 4px; }
        .auth-sub { font-size: 14px; color: #64748b; margin-bottom: 20px; }
        .auth-sub a { color: #38bdf8; text-decoration: none; font-weight: 600; }
        .auth-sub a:hover { text-decoration: underline; }

        .btn-google {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 13px 16px;
          background: #fff;
          border: none; border-radius: 12px;
          color: #1e293b; font-size: 15px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
          font-family: inherit;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
          min-height: 48px;
        }
        .btn-google:hover:not(:disabled) { background: #f8fafc; transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.3); }
        .btn-google:disabled { opacity: 0.6; cursor: not-allowed; }

        .auth-divider { display: flex; align-items: center; gap: 10px; margin: 16px 0; }
        .auth-divider-line { flex: 1; height: 1px; background: rgba(148,163,184,0.15); }
        .auth-divider-text { font-size: 12px; color: #475569; white-space: nowrap; }

        .auth-field { margin-bottom: 12px; }
        .auth-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 420px) { .auth-row { grid-template-columns: 1fr; gap: 0; } }
        .auth-label { font-size: 13px; font-weight: 500; color: #94a3b8; display: block; margin-bottom: 5px; }
        .auth-input-wrap { position: relative; }
        .auth-input {
          width: 100%;
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(148,163,184,0.18);
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 16px;
          color: #f1f5f9;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: inherit;
          -webkit-appearance: none;
          min-height: 46px;
        }
        .auth-input::placeholder { color: #334155; }
        .auth-input:focus { border-color: rgba(16,185,129,0.45); box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
        .auth-input.has-toggle { padding-right: 48px; }

        .pw-toggle {
          position: absolute; right: 4px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: #475569; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; font-size: 14px;
        }
        .pw-toggle:hover { color: #94a3b8; }

        .pw-strength { margin-top: 6px; }
        .pw-strength-bar {
          height: 3px;
          background: rgba(148,163,184,0.15);
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 4px;
        }
        .pw-strength-fill { height: 100%; border-radius: 99px; transition: width 0.3s, background 0.3s; }
        .pw-strength-label { font-size: 11px; }

        .auth-error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          padding: 11px 13px;
          font-size: 13px; color: #fca5a5;
          margin-bottom: 14px;
          display: flex; align-items: flex-start; gap: 8px; line-height: 1.45;
        }

        .btn-primary {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #10b981, #059669);
          border: none; border-radius: 12px;
          color: #fff; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: opacity 0.15s, transform 0.15s;
          font-family: inherit;
          min-height: 48px;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .spinner {
          display: inline-block;
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .auth-terms {
          font-size: 11px;
          color: #475569;
          text-align: center;
          margin-top: 14px;
          line-height: 1.6;
        }
        .auth-terms a { color: #38bdf8; text-decoration: none; }
        .auth-terms a:hover { text-decoration: underline; }

        .real-person-banner {
          display: flex; align-items: center; gap: 8px;
          background: rgba(52,211,153,0.07);
          border: 1px solid rgba(52,211,153,0.2);
          border-radius: 10px;
          padding: 9px 12px;
          margin-bottom: 18px;
          font-size: 12px; color: #6ee7b7; font-weight: 600;
        }
        .human-checkbox-row {
          display: flex; align-items: flex-start; gap: 10px;
          margin-bottom: 14px;
          background: rgba(56,189,248,0.04);
          border: 1px solid rgba(56,189,248,0.15);
          border-radius: 10px;
          padding: 11px 13px;
          cursor: pointer;
        }
        .human-checkbox-row input[type="checkbox"] { margin-top: 2px; flex-shrink: 0; accent-color: #38bdf8; width: 15px; height: 15px; cursor: pointer; }
        .human-checkbox-label { font-size: 12px; color: #94a3b8; line-height: 1.5; user-select: none; }

        .success-box { text-align: center; padding: 8px 0; }
        .success-icon {
          width: 64px; height: 64px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.25);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 28px;
          margin: 0 auto 18px;
        }
        .success-heading { font-size: 22px; font-weight: 800; color: #f1f5f9; margin-bottom: 8px; }
        .success-sub { font-size: 14px; color: #64748b; line-height: 1.65; margin-bottom: 20px; }

        @media (max-width: 420px) {
          .auth-card { padding: 22px 16px; border-radius: 16px; }
          .auth-heading { font-size: 20px; }
          .perks-strip { gap: 8px; padding: 8px 10px; }
          .perk { font-size: 11px; }
          .btn-google { font-size: 14px; }
          .trust-toast { bottom: 16px; right: 16px; left: 16px; }
        }
      `}</style>

      {trustToast && (
        <div className="trust-toast">
          <span>₮</span>
          <span>₮25 Trust awarded! Welcome to FreeTrust 🎉</span>
        </div>
      )}

      {inAppInfo && (
        <OpenInBrowserModal info={inAppInfo} onClose={() => setInAppInfo(null)} />
      )}

      <div className="auth-page">
        <div className="blob blob-1" />
        <div className="blob blob-2" />

        <div className="auth-card">
          <Link href="/" className="auth-logo">
            <div className="auth-logo-mark">FT</div>
            <span className="auth-logo-text">Free<span>Trust</span></span>
          </Link>

          {success && needsConfirmation ? (
            <div className="success-box">
              <div className="success-icon">📬</div>
              <div className="success-heading">Check your email</div>
              <p className="success-sub">
                We&rsquo;ve sent a confirmation link to
                <br />
                <strong style={{ color: '#f1f5f9' }}>{confirmationEmail}</strong>
              </p>
              <div style={{
                background: 'rgba(56,189,248,0.06)',
                border: '1px solid rgba(56,189,248,0.18)',
                borderRadius: 10,
                padding: '14px 16px',
                margin: '20px 0 16px',
                fontSize: 13,
                color: '#cbd5e1',
                lineHeight: 1.6,
                textAlign: 'left',
              }}>
                <strong style={{ color: '#38bdf8' }}>Next step:</strong> click the link in that email
                to activate your account. You&rsquo;ll then get <strong style={{ color: '#38bdf8' }}>₮25 Trust</strong>
                {' '}as a founding member bonus and be redirected to onboarding.
              </div>
              <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', margin: 0 }}>
                Can&rsquo;t find it? Check your spam folder or{' '}
                <Link href="/login" style={{ color: '#38bdf8' }}>sign in</Link>
                {' '}if you already have an account.
              </p>
            </div>
          ) : success ? (
            <div className="success-box">
              <div className="success-icon">🎉</div>
              <div className="success-heading">You&apos;re in!</div>
              <p className="success-sub">
                Account created. Taking you to set up your profile…
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <span className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }} />
              </div>
            </div>
          ) : (
            <>
              <div className="auth-heading">Join FreeTrust</div>
              <p className="auth-sub">Already have an account? <Link href="/login">Sign in →</Link></p>

              <div className="perks-strip">
                <div className="perk">✅ Free forever</div>
                <div className="perk">🙋 Real people only</div>
                <div className="perk">₮ Earn ₮25 on signup</div>
              </div>

              <div className="real-person-banner">
                <span style={{ fontSize: '16px' }}>🛡️</span>
                <span>No bots. No fake profiles. <strong>Real trust.</strong> FreeTrust is a human-only platform.</span>
              </div>

              <button className="btn-google" type="button" onClick={handleGoogleSignup} disabled={googleLoading}>
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
                <span className="auth-divider-text">or register with email</span>
                <div className="auth-divider-line" />
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="auth-row">
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="reg-first-name">First name</label>
                    <input
                      id="reg-first-name"
                      className="auth-input"
                      name="first_name"
                      type="text"
                      autoComplete="given-name"
                      autoCapitalize="words"
                      placeholder="David"
                      value={form.first_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="reg-last-name">Last name</label>
                    <input
                      id="reg-last-name"
                      className="auth-input"
                      name="last_name"
                      type="text"
                      autoComplete="family-name"
                      autoCapitalize="words"
                      placeholder="O&rsquo;Callaghan"
                      value={form.last_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg-email">Email address</label>
                  <input
                    id="reg-email"
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
                  <label className="auth-label" htmlFor="reg-password">Password</label>
                  <div className="auth-input-wrap">
                    <input
                      id="reg-password"
                      className="auth-input has-toggle"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={handleChange}
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide' : 'Show'}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {form.password && (
                    <div className="pw-strength">
                      <div className="pw-strength-bar">
                        <div
                          className="pw-strength-fill"
                          style={{ width: `${(pwStrength / 5) * 100}%`, background: pwColor }}
                        />
                      </div>
                      <span className="pw-strength-label" style={{ color: pwColor }}>{pwLabel}</span>
                    </div>
                  )}
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg-confirm">Confirm password</label>
                  <div className="auth-input-wrap">
                    <input
                      id="reg-confirm"
                      className="auth-input has-toggle"
                      name="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      value={form.confirm}
                      onChange={handleChange}
                      style={{
                        borderColor: form.confirm && form.password !== form.confirm
                          ? 'rgba(239,68,68,0.4)'
                          : form.confirm && form.password === form.confirm
                            ? 'rgba(16,185,129,0.4)'
                            : undefined
                      }}
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? 'Hide' : 'Show'}>
                      {showConfirm ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {form.confirm && form.password === form.confirm && (
                    <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>✓ Passwords match</div>
                  )}
                </div>

                {/* Honeypot — hidden from humans, filled by bots */}
                <div style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none', tabIndex: -1 } as React.CSSProperties} aria-hidden="true">
                  <input
                    name="website_url"
                    type="text"
                    autoComplete="off"
                    tabIndex={-1}
                    value={form.website_url}
                    onChange={handleChange}
                  />
                </div>

                {/* Real-person acknowledgement */}
                <label className="human-checkbox-row">
                  <input
                    type="checkbox"
                    checked={agreeHuman}
                    onChange={e => setAgreeHuman(e.target.checked)}
                  />
                  <span className="human-checkbox-label">
                    I confirm I am a real person and will not use automated tools or fake identities on this platform.
                  </span>
                </label>

                {error && (
                  <div className="auth-error">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={loading || !agreeHuman}>
                  {loading && <span className="spinner" />}
                  {loading ? 'Creating account…' : 'Create free account'}
                </button>

                <p className="auth-terms">
                  By signing up you agree to our{' '}
                  <Link href="#">Terms of Service</Link> and{' '}
                  <Link href="#">Privacy Policy</Link>.
                  You&apos;ll receive ₮25 Trust tokens to start.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
