'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (error) throw error
      router.push('/browse')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/browse` },
    })
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
        body { background: #0f172a; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; min-height: 100vh; }
        .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; position: relative; overflow: hidden; background-image: linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px); background-size: 48px 48px; }
        .blob { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; z-index: 0; }
        .blob-1 { width: 380px; height: 380px; background: radial-gradient(circle, rgba(59,130,246,0.16) 0%, transparent 70%); top: -80px; right: -80px; }
        .blob-2 { width: 340px; height: 340px; background: radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%); bottom: -60px; left: -60px; }
        .card { position: relative; z-index: 1; width: 100%; max-width: 420px; background: rgba(15,23,42,0.85); border: 1px solid rgba(59,130,246,0.2); border-radius: 20px; padding: 40px 36px; backdrop-filter: blur(12px); box-shadow: 0 0 60px rgba(59,130,246,0.08), 0 20px 60px rgba(0,0,0,0.4); }
        .logo-row { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; text-decoration: none; }
        .logo-icon { width: 32px; height: 32px; background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
        .logo-text { font-size: 18px; font-weight: 700; color: #f8fafc; }
        .logo-text span { color: #10b981; }
        h1 { font-size: 26px; font-weight: 700; color: #f8fafc; letter-spacing: -0.5px; margin-bottom: 6px; }
        .subtitle { font-size: 14px; color: #64748b; margin-bottom: 28px; }
        .subtitle a { color: #10b981; text-decoration: none; font-weight: 500; }
        .subtitle a:hover { text-decoration: underline; }
        .field { margin-bottom: 16px; }
        label { display: block; font-size: 13px; font-weight: 500; color: #94a3b8; margin-bottom: 6px; }
        .label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .forgot-link { font-size: 12px; color: #3b82f6; text-decoration: none; font-weight: 500; cursor: pointer; background: none; border: none; padding: 0; font-family: inherit; }
        .forgot-link:hover { text-decoration: underline; }
        input { width: 100%; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 10px; padding: 12px 14px; font-size: 15px; color: #f8fafc; outline: none; transition: border-color 0.2s, box-shadow 0.2s; font-family: inherit; }
        input::placeholder { color: #475569; }
        input:focus { border-color: rgba(59,130,246,0.5); box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .error-box { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #fca5a5; margin-bottom: 18px; }
        .btn { width: 100%; padding: 13px; background: linear-gradient(135deg, #3b82f6, #2563eb); border: none; border-radius: 10px; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity 0.2s, transform 0.15s; font-family: inherit; margin-top: 4px; }
        .btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-green { background: linear-gradient(135deg, #10b981, #059669); }
        .divider { display: flex; align-items: center; gap: 12px; margin: 22px 0; }
        .divider-line { flex: 1; height: 1px; background: rgba(100,116,139,0.25); }
        .divider-text { font-size: 12px; color: #475569; }
        .social-btn { width: 100%; padding: 12px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 10px; color: #cbd5e1; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: border-color 0.2s, background 0.2s; font-family: inherit; }
        .social-btn:hover { border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.06); }
        .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; cursor: pointer; background: none; border: none; padding: 0; font-family: inherit; margin-bottom: 20px; }
        .back-link:hover { color: #94a3b8; }
        .reset-panel h2 { font-size: 20px; font-weight: 700; color: #f8fafc; margin-bottom: 8px; }
        .reset-panel p { font-size: 14px; color: #64748b; margin-bottom: 20px; line-height: 1.6; }
        .success-note { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 10px; padding: 14px; font-size: 14px; color: #6ee7b7; line-height: 1.6; }
      `}</style>
      <div className="page">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="card">
          <Link href="/" className="logo-row">
            <div className="logo-icon">🛡</div>
            <span className="logo-text">Free<span>Trust</span></span>
          </Link>
          {showReset ? (
            <div className="reset-panel">
              <button className="back-link" onClick={() => { setShowReset(false); setResetSent(false) }}>← Back to sign in</button>
              <h2>Reset your password</h2>
              {resetSent ? (
                <div className="success-note">✅ Check <strong>{resetEmail}</strong> for a reset link.</div>
              ) : (
                <>
                  <p>Enter your account email and we&apos;ll send a reset link.</p>
                  <form onSubmit={handleReset} noValidate>
                    <div className="field">
                      <label>Email address</label>
                      <input type="email" placeholder="you@company.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-green" disabled={resetLoading}>
                      {resetLoading && <span className="spinner" />}
                      {resetLoading ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <>
              <h1>Welcome back</h1>
              <p className="subtitle">No account? <Link href="/register">Sign up free</Link></p>
              <form onSubmit={handleSubmit} noValidate>
                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={handleChange} />
                </div>
                <div className="field">
                  <div className="label-row">
                    <label htmlFor="password">Password</label>
                    <button type="button" className="forgot-link" onClick={() => setShowReset(true)}>Forgot password?</button>
                  </div>
                  <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Your password" value={form.password} onChange={handleChange} />
                </div>
                {error && <div className="error-box">⚠️ {error}</div>}
                <button type="submit" className="btn" disabled={loading}>
                  {loading && <span className="spinner" />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              <div className="divider"><div className="divider-line" /><span className="divider-text">or</span><div className="divider-line" /></div>
              <button className="social-btn" type="button" onClick={handleGoogleLogin}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
