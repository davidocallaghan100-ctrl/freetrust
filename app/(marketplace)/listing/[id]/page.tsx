'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const LISTINGS: Record<string, {
  name: string; tagline: string; category: string; pricing: string; logo: string;
  description: string; stars: string; installs: string; verified: boolean; tags: string[];
  author: string; version: string; license: string; github: string; docs: string;
  longDesc: string;
}> = {
  '1': { name: 'AuthShield', tagline: 'Drop-in MFA for any stack', category: 'Identity', pricing: 'Open Source', logo: '🔐', description: 'Zero-dependency multi-factor authentication library. Supports TOTP, WebAuthn, and SMS with a single API.', stars: '4.2k', installs: '12.4k', verified: true, tags: ['MFA', 'TOTP', 'WebAuthn'], author: 'auth-shield', version: '2.4.1', license: 'MIT', github: 'https://github.com', docs: 'https://docs.freetrust.co', longDesc: 'AuthShield is a lightweight, zero-dependency multi-factor authentication library that works with any Node.js stack. It provides a unified API for TOTP, WebAuthn, and SMS-based authentication without vendor lock-in. Drop it in in minutes — no heavy SDK, no cloud dependency.' },
  '2': { name: 'SOC2 Toolkit', tagline: 'Automated SOC2 evidence collection', category: 'Compliance', pricing: 'Freemium', logo: '📋', description: 'Continuously collect and organise SOC2 Type II evidence. Integrates with GitHub, AWS, and Jira.', stars: '2.8k', installs: '8.1k', verified: true, tags: ['SOC2', 'Evidence', 'Audit Ready'], author: 'soc2-labs', version: '1.9.0', license: 'Apache 2.0', github: 'https://github.com', docs: 'https://docs.freetrust.co', longDesc: 'SOC2 Toolkit automates the tedious evidence collection process for SOC2 Type II audits. Connect your GitHub, AWS, Jira, and Slack — the toolkit continuously monitors and packages evidence into audit-ready reports, saving hundreds of hours per audit cycle.' },
  '3': { name: 'VaultKey', tagline: 'Secrets management without the overhead', category: 'Encryption', pricing: 'Open Source', logo: '🗝️', description: 'Lightweight secrets manager with envelope encryption, auto-rotation, and audit trails baked in.', stars: '6.1k', installs: '31.2k', verified: true, tags: ['Secrets', 'KMS', 'Zero Trust'], author: 'vaultkey-oss', version: '3.1.2', license: 'MIT', github: 'https://github.com', docs: 'https://docs.freetrust.co', longDesc: 'VaultKey is the lightest secrets manager that doesn\'t sacrifice features. Envelope encryption, KMS integration, automatic rotation policies, and a full audit trail — all without running a heavy sidecar. Works on any infrastructure: K8s, Lambda, bare metal.' },
}

interface Props {
  params: { id: string }
}

export default function ListingDetailPage({ params }: Props) {
  const listing = LISTINGS[params.id]
  const router = useRouter()
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgSent, setMsgSent] = useState(false)

  const contactAuthor = async () => {
    setMsgLoading(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `Hi, I'm interested in your listing: ${listing?.name}`,
        }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (res.ok) {
        setMsgSent(true)
        setTimeout(() => router.push('/messages'), 800)
      }
    } catch {
      // silent fail
    } finally {
      setMsgLoading(false)
    }
  }

  if (!listing) {
    return (
      <>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0f172a; font-family: 'Segoe UI', system-ui, sans-serif; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 24px; }
          h1 { font-size: 28px; font-weight: 800; margin-bottom: 12px; }
          p { color: #64748b; margin-bottom: 24px; }
          a { display: inline-flex; padding: 10px 20px; background: linear-gradient(135deg,#10b981,#059669); color: #fff; border-radius: 10px; text-decoration: none; font-weight: 600; }
        `}</style>
        <div>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h1>Listing not found</h1>
          <p>This tool may have been removed or the link is incorrect.</p>
          <Link href="/browse">Browse marketplace</Link>
        </div>
      </>
    )
  }

  const pricingColor = listing.pricing === 'Free' || listing.pricing === 'Open Source' ? '#10b981' : listing.pricing === 'Freemium' ? '#f59e0b' : '#8b5cf6'

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #f8fafc; }
        .nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 16px 28px; background: rgba(15,23,42,0.92); border-bottom: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(12px); }
        .nav-logo { display: flex; align-items: center; gap: 9px; text-decoration: none; }
        .nav-logo-icon { width: 30px; height: 30px; background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .nav-logo-text { font-size: 17px; font-weight: 700; color: #f8fafc; }
        .nav-logo-text span { color: #10b981; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; text-decoration: none; transition: color 0.2s; padding: 6px 0; }
        .back-link:hover { color: #94a3b8; }

        .page { max-width: 1080px; margin: 0 auto; padding: 32px 24px; }
        .layout { display: grid; grid-template-columns: 1fr 320px; gap: 28px; align-items: start; }
        @media (max-width: 768px) { .layout { grid-template-columns: 1fr; } }

        /* Main content */
        .listing-hero { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 32px; margin-bottom: 20px; }
        .listing-top { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; }
        .listing-logo { width: 72px; height: 72px; background: rgba(30,41,59,0.9); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 36px; flex-shrink: 0; }
        .listing-meta { flex: 1; min-width: 0; }
        .listing-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
        .listing-name { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
        .verified { font-size: 18px; }
        .listing-tagline { font-size: 16px; color: #94a3b8; margin-bottom: 12px; }
        .listing-tags { display: flex; flex-wrap: wrap; gap: 8px; }
        .tag { font-size: 12px; font-weight: 500; padding: 4px 12px; background: rgba(30,41,59,0.9); border: 1px solid rgba(100,116,139,0.2); border-radius: 20px; color: #64748b; }
        .category-tag { color: #10b981; border-color: rgba(16,185,129,0.2); background: rgba(16,185,129,0.06); }
        .pricing-badge { font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; border: 1px solid currentColor; }

        .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 20px 0; }

        .stats-row { display: flex; gap: 32px; flex-wrap: wrap; }
        .stat { }
        .stat-val { font-size: 22px; font-weight: 800; color: #f8fafc; }
        .stat-label { font-size: 12px; color: #64748b; margin-top: 2px; }

        .section-title { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 12px; }
        .long-desc { font-size: 15px; color: #94a3b8; line-height: 1.75; }

        .detail-card { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 20px; margin-bottom: 14px; }
        .detail-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .detail-row:last-child { border-bottom: none; }
        .detail-key { font-size: 13px; color: #64748b; }
        .detail-val { font-size: 13px; color: #f8fafc; font-weight: 500; }

        /* Sidebar */
        .sidebar-card { background: rgba(15,23,42,0.8); border: 1px solid rgba(16,185,129,0.2); border-radius: 20px; padding: 28px; position: sticky; top: 80px; }
        .price-row { margin-bottom: 20px; }
        .price-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .price-value { font-size: 32px; font-weight: 900; color: #10b981; letter-spacing: -1px; }
        .price-sub { font-size: 12px; color: #475569; margin-top: 4px; }
        .btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 13px; border: none; border-radius: 11px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 0.2s, transform 0.15s; text-decoration: none; margin-bottom: 10px; }
        .btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-green { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }
        .btn-blue { background: linear-gradient(135deg, #38bdf8, #818cf8); color: #fff; }
        .btn-outline { background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); color: #cbd5e1; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .trust-row { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); }
        .trust-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b; }
      `}</style>

      <nav className="nav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">🛡</div>
          <span className="nav-logo-text">Free<span>Trust</span></span>
        </Link>
        <Link href="/browse" style={{ fontSize: 14, color: '#94a3b8', textDecoration: 'none' }}>← Browse</Link>
      </nav>

      <div className="page">
        <Link href="/browse" className="back-link">← Back to marketplace</Link>

        <div className="layout" style={{ marginTop: 20 }}>
          {/* Main */}
          <div>
            <div className="listing-hero">
              <div className="listing-top">
                <div className="listing-logo">{listing.logo}</div>
                <div className="listing-meta">
                  <div className="listing-title-row">
                    <span className="listing-name">{listing.name}</span>
                    {listing.verified && <span className="verified" title="Verified by FreeTrust">✅</span>}
                    <span className="pricing-badge" style={{ color: pricingColor }}>{listing.pricing}</span>
                  </div>
                  <p className="listing-tagline">{listing.tagline}</p>
                  <div className="listing-tags">
                    <span className="tag category-tag">{listing.category}</span>
                    {listing.tags.map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                </div>
              </div>

              <div className="divider" />

              <div className="stats-row">
                <div className="stat">
                  <div className="stat-val">⭐ {listing.stars}</div>
                  <div className="stat-label">GitHub stars</div>
                </div>
                <div className="stat">
                  <div className="stat-val">⬇️ {listing.installs}</div>
                  <div className="stat-label">Installs</div>
                </div>
                <div className="stat">
                  <div className="stat-val">v{listing.version}</div>
                  <div className="stat-label">Latest version</div>
                </div>
                <div className="stat">
                  <div className="stat-val">{listing.license}</div>
                  <div className="stat-label">License</div>
                </div>
              </div>
            </div>

            <div className="detail-card">
              <div className="section-title">About</div>
              <p className="long-desc">{listing.longDesc}</p>
            </div>

            <div className="detail-card">
              <div className="section-title">Details</div>
              {[
                { key: 'Author', val: `@${listing.author}` },
                { key: 'Category', val: listing.category },
                { key: 'License', val: listing.license },
                { key: 'Version', val: `v${listing.version}` },
                { key: 'Pricing model', val: listing.pricing },
              ].map(r => (
                <div key={r.key} className="detail-row">
                  <span className="detail-key">{r.key}</span>
                  <span className="detail-val">{r.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="sidebar-card">
            <div className="price-row">
              <div className="price-label">Price</div>
              <div className="price-value">{listing.pricing === 'Free' || listing.pricing === 'Open Source' ? 'Free' : listing.pricing === 'Freemium' ? 'Free +' : 'Paid'}</div>
              <div className="price-sub">{listing.pricing === 'Open Source' ? 'MIT licensed, self-host' : 'No credit card required'}</div>
            </div>

            <Link href={listing.github} target="_blank" className="btn btn-green">
              🚀 Get started free
            </Link>
            <Link href={listing.docs} target="_blank" className="btn btn-outline">
              📄 View documentation
            </Link>
            <button
              className="btn btn-blue"
              onClick={contactAuthor}
              disabled={msgLoading || msgSent}
              style={{ marginTop: 2 }}
            >
              {msgSent ? '✅ Message sent!' : msgLoading ? '...' : '💬 Message author'}
            </button>

            <div className="trust-row">
              <div className="trust-item">✅ Verified by FreeTrust</div>
              <div className="trust-item">🔒 Security reviewed</div>
              <div className="trust-item">📜 {listing.license} license</div>
              <div className="trust-item">🌐 Open source</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
