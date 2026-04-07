'use client'

import Link from 'next/link'

const benefits = [
  { icon: '₮', title: '₮25 Trust welcome bonus', desc: 'Free Trust tokens credited to your account the moment you join.' },
  { icon: '🏅', title: 'Founding Member badge', desc: 'A permanent badge on your profile — forever marking you as someone who was here first.' },
  { icon: '⚡', title: 'First access to new features', desc: 'You get early access to every feature we ship before anyone else.' },
  { icon: '🗣️', title: 'Direct input into the platform', desc: 'Your feedback shapes what we build next. Founding members have a real voice here.' },
  { icon: '🔒', title: 'Lower fees locked in for life', desc: 'Platform fees for founding members are lower than our standard rate — and stay that way permanently.' },
]

export default function HomePage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #f8fafc; overflow-x: hidden; }

        /* ── Nav ── */
        .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 16px 40px; background: rgba(15,23,42,0.85); border-bottom: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(16px); }
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
        .hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 140px 24px 80px; position: relative; overflow: hidden; background-image: linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px); background-size: 48px 48px; }
        .blob { position: absolute; border-radius: 50%; filter: blur(110px); pointer-events: none; }
        .blob-1 { width: 600px; height: 600px; background: radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 65%); top: -120px; left: -180px; }
        .blob-2 { width: 500px; height: 500px; background: radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%); bottom: -60px; right: -120px; }

        .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: #6ee7b7; margin-bottom: 28px; letter-spacing: 0.3px; }
        .badge-dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        h1 { font-size: clamp(36px, 7vw, 68px); font-weight: 900; letter-spacing: -2px; line-height: 1.05; text-align: center; margin-bottom: 24px; }
        h1 span.green { color: #10b981; }

        .hero-sub { font-size: clamp(15px, 2vw, 17px); color: #64748b; text-align: center; max-width: 540px; line-height: 1.75; margin-bottom: 40px; }

        .hero-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: center; }
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 15px 30px; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 12px; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; transition: opacity 0.2s, transform 0.15s; box-shadow: 0 4px 20px rgba(16,185,129,0.3); }
        .btn-primary:hover { opacity: 0.92; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(16,185,129,0.4); }
        .btn-secondary { display: inline-flex; align-items: center; gap: 8px; padding: 14px 24px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 12px; color: #cbd5e1; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; transition: border-color 0.2s, background 0.2s, transform 0.15s; }
        .btn-secondary:hover { border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.06); transform: translateY(-2px); }

        /* ── Building in public section ── */
        .public-section { padding: 80px 24px; max-width: 760px; margin: 0 auto; text-align: center; }
        .public-box { background: rgba(15,23,42,0.7); border: 1px solid rgba(16,185,129,0.15); border-radius: 24px; padding: 56px 48px; position: relative; overflow: hidden; }
        .public-box::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(16,185,129,0.4), transparent); }
        .public-label { font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #10b981; margin-bottom: 20px; }
        .public-box h2 { font-size: clamp(22px, 4vw, 32px); font-weight: 800; letter-spacing: -0.6px; margin-bottom: 20px; line-height: 1.2; }
        .public-box p { font-size: 16px; color: #94a3b8; line-height: 1.8; }
        @media (max-width: 640px) { .public-box { padding: 36px 24px; } }

        /* ── Benefits ── */
        .benefits-section { padding: 20px 24px 80px; max-width: 1100px; margin: 0 auto; }
        .section-label { font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #10b981; margin-bottom: 12px; text-align: center; }
        .section-title { font-size: clamp(24px, 4vw, 38px); font-weight: 800; letter-spacing: -0.8px; text-align: center; margin-bottom: 12px; }
        .section-sub { font-size: 15px; color: #64748b; text-align: center; max-width: 440px; margin: 0 auto 48px; line-height: 1.6; }
        .benefits-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
        .benefit-card { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 28px; display: flex; gap: 18px; align-items: flex-start; transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
        .benefit-card:hover { border-color: rgba(16,185,129,0.25); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(16,185,129,0.06); }
        .benefit-icon { width: 44px; height: 44px; min-width: 44px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #10b981; }
        .benefit-title { font-size: 15px; font-weight: 700; color: #f1f5f9; margin-bottom: 6px; }
        .benefit-desc { font-size: 13px; color: #64748b; line-height: 1.6; }

        /* ── Final CTA ── */
        .cta-section { padding: 20px 24px 100px; }
        .cta-box { max-width: 680px; margin: 0 auto; background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.07)); border: 1px solid rgba(16,185,129,0.25); border-radius: 24px; padding: 64px 48px; text-align: center; position: relative; overflow: hidden; }
        .cta-box::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(16,185,129,0.5), transparent); }
        .cta-box h2 { font-size: clamp(24px, 4vw, 36px); font-weight: 800; letter-spacing: -0.8px; margin-bottom: 14px; }
        .cta-box p { font-size: 15px; color: #64748b; line-height: 1.7; margin-bottom: 36px; max-width: 440px; margin-left: auto; margin-right: auto; }
        .trust-bonus { display: inline-flex; align-items: center; gap: 8px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 10px; padding: 10px 18px; font-size: 13px; color: #6ee7b7; font-weight: 500; margin-bottom: 32px; }
        @media (max-width: 640px) { .cta-box { padding: 40px 24px; } }

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
        <Link href="/register" className="nav-cta">Join for free</Link>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="badge">
          <span className="badge-dot" />
          Now in Beta — Be an Early Member
        </div>
        <h1>
          A Marketplace Built<br />
          on <span className="green">Real Trust</span>
        </h1>
        <p className="hero-sub">
          FreeTrust is a marketplace for verified security tools, compliance frameworks, and identity primitives — built in public, with the people who use it.
        </p>
        <div className="hero-actions">
          <Link href="/register" className="btn-primary">🏅 Join as a Founding Member</Link>
          <Link href="/browse" className="btn-secondary">🔍 Browse the marketplace</Link>
        </div>
      </section>

      {/* Building in public */}
      <div className="public-section">
        <div className="public-box">
          <div className="public-label">Honest by default</div>
          <h2>We&apos;re building this in public,<br />with our first members.</h2>
          <p>
            FreeTrust is just getting started. We&apos;re not pretending to be bigger than we are —
            we&apos;re building openly, and our early members are shaping what this platform becomes.
            Early members get ₮25 Trust free on signup and lifetime recognition as a founding member.
          </p>
        </div>
      </div>

      {/* Benefits */}
      <div className="benefits-section">
        <div className="section-label">Founding member benefits</div>
        <h2 className="section-title">What you get for joining early</h2>
        <p className="section-sub">These aren&apos;t marketing claims. They&apos;re real commitments to the people who believe in this from day one.</p>
        <div className="benefits-grid">
          {benefits.map((b) => (
            <div key={b.title} className="benefit-card">
              <div className="benefit-icon">{b.icon}</div>
              <div>
                <div className="benefit-title">{b.title}</div>
                <p className="benefit-desc">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="cta-section">
        <div className="cta-box">
          <h2>Ready to be a founding member?</h2>
          <p>Join now while we&apos;re still early. Your spot, your badge, and your benefits are locked in from the moment you sign up.</p>
          <div className="trust-bonus">🎁 ₮25 Trust credited instantly on signup</div>
          <br />
          <div className="hero-actions">
            <Link href="/register" className="btn-primary">🏅 Join as a Founding Member</Link>
            <Link href="/browse" className="btn-secondary">🔍 Explore first</Link>
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
