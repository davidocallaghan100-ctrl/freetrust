'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/Avatar'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [trustToast, setTrustToast] = useState(false)
  const [photoStep, setPhotoStep] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

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
    if (!form.name.trim()) { setError('Please enter your full name.'); return }
    if (!form.email) { setError('Please enter your email address.'); return }
    if (!form.password) { setError('Please choose a password.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.password !== form.confirm) { setError('Passwords don\'t match.'); return }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.name.trim() } },
      })
      if (error) {
        const msg = error.message || ''
        if (msg.includes('already registered') || msg.includes('User already registered')) {
          throw new Error('An account with this email already exists. Try signing in instead.')
        }
        if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
          throw new Error('Too many attempts. Please wait a minute and try again.')
        }
        if (msg.includes('Database error') || msg.includes('unexpected_failure')) {
          throw new Error('We\'re setting things up — please try again in a moment.')
        }
        throw new Error(msg || 'Something went wrong. Please try again.')
      }
      setSuccess(true)
      setPhotoStep(true)
      // Issue ₮25 signup bonus
      void issueSignupBonus()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setGoogleLoading(true)
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/feed`,
          queryParams: { prompt: 'select_account', access_type: 'offline' },
        },
      })
    } finally {
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

        /* Trust toast */
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

        /* Perks strip */
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

        /* Password strength */
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

        /* Success */
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
        .success-email { color: #10b981; font-weight: 600; }
        .success-next {
          background: rgba(56,189,248,0.08);
          border: 1px solid rgba(56,189,248,0.2);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.55;
        }

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

      <div className="auth-page">
        <div className="blob blob-1" />
        <div className="blob blob-2" />

        <div className="auth-card">
          <Link href="/" className="auth-logo">
            <div className="auth-logo-mark">FT</div>
            <span className="auth-logo-text">Free<span>Trust</span></span>
          </Link>

          {success ? (
            <div className="success-box">
              {photoStep ? (
                <>
                  <div className="success-icon">🎉</div>
                  <div className="success-heading">Account created!</div>
                  <p className="success-sub" style={{ marginBottom: '1.5rem' }}>
                    Add a profile photo so your community can recognise you.
                  </p>

                  {/* Avatar preview */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div
                      style={{ cursor: 'pointer', position: 'relative' }}
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <Avatar url={avatarUrl} name={form.name} email={form.email} size={80} />
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'rgba(15,23,42,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.4rem',
                        opacity: photoUploading ? 1 : undefined,
                      }}>
                        {photoUploading ? '⏳' : '📷'}
                      </div>
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setPhotoUploading(true)
                        try {
                          const fd = new FormData()
                          fd.append('file', file)
                          const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
                          if (res.ok) {
                            const data = await res.json() as { url: string }
                            setAvatarUrl(data.url)
                          }
                        } catch { /* silent */ }
                        setPhotoUploading(false)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#38bdf8', cursor: 'pointer' }}
                    >
                      {avatarUrl ? 'Change photo' : 'Upload photo'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push('/feed')}
                    style={{ width: '100%', background: '#38bdf8', border: 'none', borderRadius: 10, padding: '0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', marginBottom: '0.75rem' }}
                  >
                    {avatarUrl ? 'Continue to FreeTrust →' : 'Skip for now →'}
                  </button>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center' }}>
                    📬 Check your inbox to verify your email address.
                  </div>
                </>
              ) : (
                <>
                  <div className="success-icon">📬</div>
                  <div className="success-heading">Check your inbox</div>
                  <p className="success-sub">
                    We sent a confirmation link to{' '}
                    <span className="success-email">{form.email}</span>.<br />
                    Click it to activate your account and claim your ₮25 Trust tokens.
                  </p>
                  <div className="success-next">
                    💡 Can&apos;t find it? Check your spam or junk folder — it sometimes lands there.
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="auth-heading">Join FreeTrust</div>
              <p className="auth-sub">Already have an account? <Link href="/login">Sign in →</Link></p>

              {/* Perks */}
              <div className="perks-strip">
                <div className="perk">✅ Free forever</div>
                <div className="perk">🔒 No spam</div>
                <div className="perk">₮ Earn ₮25 on signup</div>
              </div>

              {/* Google — primary */}
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
                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg-name">Full name</label>
                  <input
                    id="reg-name"
                    className="auth-input"
                    name="name"
                    type="text"
                    autoComplete="name"
                    autoCapitalize="words"
                    placeholder="David O'Callaghan"
                    value={form.name}
                    onChange={handleChange}
                  />
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

                {error && (
                  <div className="auth-error">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={loading}>
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
