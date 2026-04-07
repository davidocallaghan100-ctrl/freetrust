'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const messages = [
  'Connecting Trust',
  'Building Tomorrow',
  'Open Source Values',
  'Secure by Design',
  'Community First',
  'Transparency Always',
]

const stats = [
  { value: '12k+', label: 'Tools Listed' },
  { value: '48k+', label: 'Developers' },
  { value: '99.9%', label: 'Uptime' },
  { value: '100%', label: 'Open Source' },
]

const features = [
  { icon: '🔐', title: 'Zero Trust Auth', desc: 'Identity-first security with WebAuthn, TOTP, and SSO out of the box.' },
  { icon: '📋', title: 'SOC2 Automation', desc: 'Continuously collect evidence and ship compliance without the spreadsheets.' },
  { icon: '🗝️', title: 'Secrets Management', desc: 'Envelope encryption, auto-rotation, and audit trails baked in.' },
  { icon: '⚙️', title: 'Policy Engine', desc: 'RBAC & ABAC in minutes. Write policies in plain YAML, powered by OPA.' },
  { icon: '📜', title: 'Tamper-proof Audit', desc: 'Cryptographically chained append-only logs. Export to any SIEM.' },
  { icon: '🌐', title: 'Zero Trust Network', desc: 'WireGuard-based access gateway with mTLS and device posture checks.' },
]

export default function HomePage() {
  const [msgIndex, setMsgIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % messages.length)
        setFade(true)
      }, 400)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #f8fafc; overflow-x: hidden; }

        /* ── Nav ── */
        .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 16px 40px; background: rgba(15,23,42,0.8); border-bottom: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(16px); }
        .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .nav-logo-icon { width: 32px; height: 32px; background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
        .nav-logo-text { font-size: 18px; font-weight: 700; color: #f8fafc; }
        .nav-logo-text span { color: #10b981; }
        .nav-links { display: flex; align-items: center; gap: 6px; }
        .nav-link { font-size: 14px; color: #94a3b8; text-decoration: none; padding: 7px 14px; border-radius: 8px; transition: color 0.2s, background 0.2s; }
        .nav-link:hover { color: #f8fafc; background: rgba(255,255,255,0.06); }
        .nav-cta { font-size: 13px; font-weight: 600; color: #0f172a; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 9px; padding: 9px 18px; cursor: pointer; text-decoration: none; transition: opacity 0.2s, transform 0.15s; }
        .nav-cta:hover { opacity: 0.9; transform: translateY(-1px); }
        @media (max-width: 640px) { .nav { padding: 14px 20px; } .nav-links { display: none; } }

        /* ── Hero ── */
        .hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 140px 24px 80px; position: relative; overflow: hidden; background-image: linear-gradient(rgba(16,185,129,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.06) 1px, transparent 1px); background-size: 48px 48px; }
        .blob { position: absolute; border-radius: 50%; filter: blur(100px); pointer-events: none; }
        .blob-1 { width: 600px; height: 600px; background: radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 65%); top: -100px; left: -150px; }
        .blob-2 { width: 500px; height: 500px; background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%); bottom: -50px; right: -100px; }
        .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 500; color: #6ee7b7; margin-bottom: 28px; }
        .badge-dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        h1 { font-size: clamp(36px, 7vw, 72px); font-weight: 900; letter-spacing: -2px; line-height: 1.05; text-align: center; margin-bottom: 16px; }
        h1 span.green { color: #10b981; }
        .rotating-msg { font-size: clamp(20px, 4vw, 32px); font-weight: 700; color: #10b981; height: 44px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; transition: opacity 0.4s ease; }
        .rotating-msg.fade-out { opacity: 0; }
        .rotating-msg.fade-in { opacity: 1; }
        .hero-sub { font-size: clamp(15px, 2vw, 18px); color: #64748b; text-align: center; max-width: 560px; line-height: 1.7; margin-bottom: 40px; }
        .hero-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: center; margin-bottom: 64px; }
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 12px; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; transition: opacity 0.2s, transform 0.15s; }
        .btn-primary:hover { opacity: 0.92; transform: translateY(-2px); }
        .btn-secondary { display: inline-flex; align-items: center; gap: 8px; padding: 13px 24px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 12px; color: #cbd5e1; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; transition: border-color 0.2s, background 0.2s, transform 0.15s; }
        .btn-secondary:hover { border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.06); transform: translateY(-2px); }

        /* ── Stats bar ── */
        .stats-bar { display: flex; align-items: center; justify-content: center; gap: 48px; flex-wrap: wrap; padding: 32px 24px; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; max-width: 700px; }
        .stat { text-align: center; }
        .stat-value { font-size: 28px; font-weight: 800; color: #10b981; letter-spacing: -0.5px; }
        .stat-label { font-size: 12px; color: #64748b; margin-top: 2px; }

        /* ── Features ── */
        .section { padding: 80px 24px; max-width: 1200px; margin: 0 auto; }
        .section-label { font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #10b981; margin-bottom: 12px; text-align: center; }
        .section-title { font-size: clamp(24px, 4vw, 40px); font-weight: 800; letter-spacing: -0.8px; text-align: center; margin-bottom: 12px; }
        .section-sub { font-size: 16px; color: #64748b; text-align: center; max-width: 480px; margin: 0 auto 48px; line-height: 1.6; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
        .feature-card { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 28px; transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
        .feature-card:hover { border-color: rgba(16,185,129,0.25); transform: translateY(-3px); box-shadow: 0 12px 40px rgba(16,185,129,0.07); }
        .feature-icon { width: 48px; height: 48px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 16px; }
        .feature-title { font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 8px; }
        .feature-desc { font-size: 14px; color: #64748b; line-height: 1.6; }

        /* ── CTA section ── */
        .cta-section { padding: 80px 24px; }
        .cta-box { max-width: 720px; margin: 0 auto; background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.06)); border: 1px solid rgba(16,185,129,0.2); border-radius: 24px; padding: 60px 48px; text-align: center; }
        .cta-box h2 { font-size: clamp(24px, 4vw, 36px); font-weight: 800; letter-spacing: -0.8px; margin-bottom: 14px; }
        .cta-box p { font-size: 16px; color: #64748b; line-height: 1.6; margin-bottom: 32px; }
        @media (max-width: 640px) { .cta-box { padding: 40px 24px; } .stats-bar { gap: 28px; } }

        /* ── Footer ── */
        .footer { padding: 32px 40px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .footer-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
        .footer-logo-icon { width: 24px; height: 24px; background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
        .footer-logo-text { font-size: 14px; font-weight: 700; color: #64748b; }
        .footer-logo-text span { color: #10b981; }
        .footer-copy { font-size: 12px; color: #334155; }
        .footer-links { display: flex; gap: 20px; }
        .footer-links a { font-size: 12px; color: #475569; text-decoration: none; transition: color 0.2s; }
        .footer-links a:hover { color: #94a3b8; }
      `}</style>

      {/* Nav */}
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">🛡</div>
          <span className="nav-logo-text">Free<span>Trust</span></span>
        </Link>
        <div className="nav-links">
          <Link href="/browse" className="nav-link">Marketplace</Link>
          <Link href="/login" className="nav-link">Sign in</Link>
        </div>
        <Link href="/register" className="nav-cta">Get started free</Link>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="badge">
          <span className="badge-dot" />
          Open-source trust infrastructure
        </div>
        <h1>
          The Open Layer for<br />
          <span className="green">Modern Trust</span>
        </h1>
        <div className={`rotating-msg ${fade ? 'fade-in' : 'fade-out'}`}>
          {messages[msgIndex]}
        </div>
        <p className="hero-sub">
          Discover, deploy and contribute to verified security tools, compliance frameworks, and identity primitives — all in one place.
        </p>
        <div className="hero-actions">
          <Link href="/browse" className="btn-primary">🛒 Browse marketplace</Link>
          <Link href="/register" className="btn-secondary">🚀 List your tool</Link>
        </div>
        <div className="stats-bar">
          {stats.map((s) => (
            <div key={s.label} className="stat">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <div className="section">
        <div className="section-label">What's on the platform</div>
        <h2 className="section-title">Everything you need to build trusted software</h2>
        <p className="section-sub">From identity to compliance, find production-ready open-source tools vetted by the community.</p>
        <div className="features-grid">
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="cta-section">
        <div className="cta-box">
          <h2>Built something worth trusting?</h2>
          <p>Submit your open-source tool to the FreeTrust marketplace and reach 48,000+ security-conscious developers.</p>
          <div className="hero-actions">
            <Link href="/register" className="btn-primary">🚀 Submit a tool</Link>
            <Link href="/browse" className="btn-secondary">🔍 Explore marketplace</Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <Link href="/" className="footer-logo">
          <div className="footer-logo-icon">🛡</div>
          <span className="footer-logo-text">Free<span>Trust</span></span>
        </Link>
        <div className="footer-links">
          <a href="#">Terms</a>
          <a href="#">Privacy</a>
          <a href="#">Docs</a>
          <a href="https://github.com/davidocallaghan100-ctrl/freetrust" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <span className="footer-copy">© 2026 FreeTrust. Open source.</span>
      </footer>
    </>
  )
}
