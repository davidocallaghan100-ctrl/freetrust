'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Category = 'All' | 'Identity' | 'Compliance' | 'Audit' | 'Access Control' | 'Encryption'
type PricingModel = 'Free' | 'Open Source' | 'Freemium' | 'Paid'

interface Listing {
  id: number
  name: string
  tagline: string
  category: Category
  pricing: PricingModel
  stars: string
  verified: boolean
  logo: string
  tags: string[]
  description: string
  installs: string
}

const LISTINGS: Listing[] = [
  { id: 1, name: 'AuthShield', tagline: 'Drop-in MFA for any stack', category: 'Identity', pricing: 'Open Source', stars: '4.2k', verified: true, logo: '🔐', tags: ['MFA', 'TOTP', 'WebAuthn'], description: 'Zero-dependency multi-factor authentication library. Supports TOTP, WebAuthn, and SMS with a single API.', installs: '12.4k' },
  { id: 2, name: 'SOC2 Toolkit', tagline: 'Automated SOC2 evidence collection', category: 'Compliance', pricing: 'Freemium', stars: '2.8k', verified: true, logo: '📋', tags: ['SOC2', 'Evidence', 'Audit Ready'], description: 'Continuously collect and organise SOC2 Type II evidence. Integrates with GitHub, AWS, and Jira.', installs: '8.1k' },
  { id: 3, name: 'VaultKey', tagline: 'Secrets management without the overhead', category: 'Encryption', pricing: 'Open Source', stars: '6.1k', verified: true, logo: '🗝️', tags: ['Secrets', 'KMS', 'Zero Trust'], description: 'Lightweight secrets manager with envelope encryption, auto-rotation, and audit trails baked in.', installs: '31.2k' },
  { id: 4, name: 'AuditTrail', tagline: 'Tamper-proof event logging', category: 'Audit', pricing: 'Free', stars: '1.4k', verified: false, logo: '📜', tags: ['Logs', 'SIEM', 'Compliance'], description: 'Append-only audit log with cryptographic chaining. Export to your SIEM in one click.', installs: '5.7k' },
  { id: 5, name: 'PolicyEngine', tagline: 'RBAC & ABAC in minutes', category: 'Access Control', pricing: 'Open Source', stars: '3.5k', verified: true, logo: '⚙️', tags: ['RBAC', 'ABAC', 'OPA'], description: 'Declarative access control engine built on Open Policy Agent. Write policies in plain YAML.', installs: '18.9k' },
  { id: 6, name: 'TrustScore', tagline: 'Real-time vendor risk scoring', category: 'Compliance', pricing: 'Paid', stars: '980', verified: true, logo: '📊', tags: ['Vendor Risk', 'Scoring', 'API'], description: 'Automatically score your vendors across 200+ risk signals. Connect via API or Slack.', installs: '2.3k' },
  { id: 7, name: 'IdentityGraph', tagline: 'Unified identity across services', category: 'Identity', pricing: 'Freemium', stars: '2.1k', verified: false, logo: '🕸️', tags: ['SSO', 'SCIM', 'Identity'], description: 'Link identities across SaaS tools, normalise user profiles, and enforce consistent access policies.', installs: '9.4k' },
  { id: 8, name: 'ZeroTrust Gateway', tagline: 'Network access without VPN', category: 'Access Control', pricing: 'Open Source', stars: '5.3k', verified: true, logo: '🌐', tags: ['Zero Trust', 'Network', 'mTLS'], description: 'WireGuard-based zero trust access gateway with built-in device posture checks and mTLS.', installs: '24.6k' },
  { id: 9, name: 'CryptBox', tagline: 'E2E encryption for any data store', category: 'Encryption', pricing: 'Free', stars: '1.7k', verified: false, logo: '🔒', tags: ['E2E', 'Encryption', 'SDK'], description: 'Client-side encryption SDK. Encrypt before you write; decrypt after you read. Postgres and S3 adapters included.', installs: '7.2k' },
]

const CATEGORIES: Category[] = ['All', 'Identity', 'Compliance', 'Audit', 'Access Control', 'Encryption']
const PRICING_FILTERS: PricingModel[] = ['Free', 'Open Source', 'Freemium', 'Paid']
const PRICING_COLORS: Record<PricingModel, string> = { 'Free': '#10b981', 'Open Source': '#3b82f6', 'Freemium': '#f59e0b', 'Paid': '#8b5cf6' }

export default function BrowsePage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [activePricing, setActivePricing] = useState<PricingModel | null>(null)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const filtered = useMemo(() => {
    return LISTINGS.filter((l) => {
      if (activeCategory !== 'All' && l.category !== activeCategory) return false
      if (activePricing && l.pricing !== activePricing) return false
      if (verifiedOnly && !l.verified) return false
      if (search) {
        const q = search.toLowerCase()
        return l.name.toLowerCase().includes(q) || l.tagline.toLowerCase().includes(q) || l.tags.some(t => t.toLowerCase().includes(q))
      }
      return true
    })
  }, [search, activeCategory, activePricing, verifiedOnly])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; min-height: 100vh; color: #f8fafc; }
        .nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 16px 28px; background: rgba(15,23,42,0.92); border-bottom: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(12px); }
        .nav-logo { display: flex; align-items: center; gap: 9px; text-decoration: none; }
        .nav-logo-icon { width: 30px; height: 30px; background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .nav-logo-text { font-size: 17px; font-weight: 700; color: #f8fafc; }
        .nav-logo-text span { color: #10b981; }
        .nav-actions { display: flex; align-items: center; gap: 12px; }
        .nav-link { font-size: 14px; color: #94a3b8; text-decoration: none; padding: 6px 12px; border-radius: 8px; transition: color 0.2s, background 0.2s; }
        .nav-link:hover { color: #f8fafc; background: rgba(255,255,255,0.05); }
        .nav-cta { font-size: 13px; font-weight: 600; color: #0f172a; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; text-decoration: none; transition: opacity 0.2s; }
        .nav-cta:hover { opacity: 0.88; }
        .hero-bar { background: linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(59,130,246,0.06) 100%); border-bottom: 1px solid rgba(255,255,255,0.05); padding: 40px 28px 32px; text-align: center; }
        .hero-bar h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.8px; margin-bottom: 10px; }
        .hero-bar h1 span { color: #10b981; }
        .hero-bar p { font-size: 16px; color: #64748b; margin-bottom: 24px; }
        .search-wrap { max-width: 560px; margin: 0 auto; position: relative; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #475569; font-size: 16px; pointer-events: none; }
        .search-input { width: 100%; background: rgba(30,41,59,0.9); border: 1px solid rgba(100,116,139,0.3); border-radius: 12px; padding: 13px 16px 13px 40px; font-size: 15px; color: #f8fafc; outline: none; transition: border-color 0.2s, box-shadow 0.2s; font-family: inherit; }
        .search-input::placeholder { color: #475569; }
        .search-input:focus { border-color: rgba(16,185,129,0.4); box-shadow: 0 0 0 3px rgba(16,185,129,0.08); }
        .layout { display: flex; max-width: 1280px; margin: 0 auto; padding: 32px 24px; gap: 28px; }
        .sidebar { width: 220px; flex-shrink: 0; }
        @media (max-width: 768px) { .sidebar { display: none; } .sidebar.open { display: block; width: 100%; } .layout { flex-direction: column; padding: 16px; } .hero-bar h1 { font-size: 24px; } .nav { padding: 12px 16px; } }
        .filter-section { margin-bottom: 28px; }
        .filter-title { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #475569; margin-bottom: 10px; }
        .cat-btn { display: block; width: 100%; text-align: left; padding: 8px 12px; border-radius: 8px; border: none; background: transparent; color: #94a3b8; font-size: 14px; cursor: pointer; transition: background 0.15s, color 0.15s; font-family: inherit; margin-bottom: 2px; }
        .cat-btn:hover { background: rgba(255,255,255,0.05); color: #f8fafc; }
        .cat-btn.active { background: rgba(16,185,129,0.12); color: #10b981; font-weight: 600; }
        .pricing-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 20px; border: 1px solid rgba(100,116,139,0.25); background: transparent; color: #94a3b8; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; margin: 0 4px 6px 0; font-family: inherit; }
        .pricing-chip:hover { border-color: rgba(255,255,255,0.2); color: #f8fafc; }
        .pricing-chip.active { border-color: currentColor; font-weight: 600; }
        .toggle-row { display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 6px; }
        .toggle { width: 36px; height: 20px; background: rgba(100,116,139,0.3); border-radius: 10px; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .toggle.on { background: #10b981; }
        .toggle::after { content: ''; position: absolute; width: 14px; height: 14px; background: #fff; border-radius: 50%; top: 3px; left: 3px; transition: transform 0.2s; }
        .toggle.on::after { transform: translateX(16px); }
        .toggle-label { font-size: 13px; color: #94a3b8; }
        .mobile-filter-btn { display: none; align-items: center; gap: 8px; padding: 9px 16px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 10px; color: #94a3b8; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; margin-bottom: 16px; }
        @media (max-width: 768px) { .mobile-filter-btn { display: flex; } }
        .grid-area { flex: 1; min-width: 0; }
        .grid-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .grid-count { font-size: 14px; color: #64748b; }
        .grid-count strong { color: #f8fafc; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
        .listing-card { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 20px; cursor: pointer; transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s; display: flex; flex-direction: column; gap: 12px; }
        .listing-card:hover { border-color: rgba(16,185,129,0.3); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(16,185,129,0.08); }
        .card-top { display: flex; align-items: flex-start; gap: 14px; }
        .card-logo { width: 44px; height: 44px; background: rgba(30,41,59,0.9); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .card-meta { flex: 1; min-width: 0; }
        .card-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
        .card-name { font-size: 16px; font-weight: 700; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .card-tagline { font-size: 13px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .card-desc { font-size: 13px; color: #94a3b8; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .card-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .tag { font-size: 11px; font-weight: 500; padding: 3px 9px; background: rgba(30,41,59,0.9); border: 1px solid rgba(100,116,139,0.2); border-radius: 20px; color: #64748b; }
        .card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); }
        .card-stats { display: flex; align-items: center; gap: 14px; font-size: 12px; color: #475569; }
        .stat { display: flex; align-items: center; gap: 4px; }
        .pricing-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; border: 1px solid currentColor; }
        .empty { text-align: center; padding: 60px 20px; color: #475569; }
        .empty-icon { font-size: 40px; margin-bottom: 14px; }
        .empty h3 { font-size: 18px; color: #64748b; margin-bottom: 6px; }
        .empty p { font-size: 14px; }
        .submit-banner { margin-top: 40px; background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.06)); border: 1px solid rgba(16,185,129,0.2); border-radius: 16px; padding: 28px 24px; text-align: center; }
        .submit-banner h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
        .submit-banner p { font-size: 14px; color: #64748b; margin-bottom: 18px; }
        .submit-btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 22px; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 10px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; text-decoration: none; transition: opacity 0.2s, transform 0.15s; }
        .submit-btn:hover { opacity: 0.9; transform: translateY(-1px); }
      `}</style>

      <nav className="nav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">🛡</div>
          <span className="nav-logo-text">Free<span>Trust</span></span>
        </Link>
        <div className="nav-actions">
          <Link href="/login" className="nav-link">Sign in</Link>
          <Link href="/register" className="nav-cta">Get started</Link>
        </div>
      </nav>

      <div className="hero-bar">
        <h1>The <span>Open Trust</span> Marketplace</h1>
        <p>Discover verified security tools, compliance frameworks, and identity primitives</p>
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input className="search-input" type="text" placeholder="Search tools, tags, categories…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="layout">
        <button className="mobile-filter-btn" onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}>
          ⚙️ Filters {(activePricing || verifiedOnly || activeCategory !== 'All') ? '(active)' : ''}
        </button>
        <aside className={`sidebar${mobileFiltersOpen ? ' open' : ''}`}>
          <div className="filter-section">
            <div className="filter-title">Category</div>
            {CATEGORIES.map(cat => (
              <button key={cat} className={`cat-btn${activeCategory === cat ? ' active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</button>
            ))}
          </div>
          <div className="filter-section">
            <div className="filter-title">Pricing</div>
            <div>
              {PRICING_FILTERS.map(p => (
                <button key={p} className={`pricing-chip${activePricing === p ? ' active' : ''}`} style={{ color: activePricing === p ? PRICING_COLORS[p] : undefined }} onClick={() => setActivePricing(activePricing === p ? null : p)}>{p}</button>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-title">Trust</div>
            <div className="toggle-row" onClick={() => setVerifiedOnly(!verifiedOnly)}>
              <div className={`toggle${verifiedOnly ? ' on' : ''}`} />
              <span className="toggle-label">Verified only ✅</span>
            </div>
          </div>
        </aside>

        <div className="grid-area">
          <div className="grid-header">
            <p className="grid-count"><strong>{filtered.length}</strong> {filtered.length === 1 ? 'tool' : 'tools'} found</p>
          </div>
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🔍</div>
              <h3>No results</h3>
              <p>Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid">
              {filtered.map(listing => (
                <div key={listing.id} className="listing-card">
                  <div className="card-top">
                    <div className="card-logo">{listing.logo}</div>
                    <div className="card-meta">
                      <div className="card-name-row">
                        <span className="card-name">{listing.name}</span>
                        {listing.verified && <span title="Verified">✅</span>}
                      </div>
                      <div className="card-tagline">{listing.tagline}</div>
                    </div>
                  </div>
                  <p className="card-desc">{listing.description}</p>
                  <div className="card-tags">
                    {listing.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                  </div>
                  <div className="card-footer">
                    <div className="card-stats">
                      <span className="stat">⭐ {listing.stars}</span>
                      <span className="stat">⬇️ {listing.installs}</span>
                    </div>
                    <span className="pricing-badge" style={{ color: PRICING_COLORS[listing.pricing] }}>{listing.pricing}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="submit-banner">
            <h3>Built something worth trusting?</h3>
            <p>Submit your open-source tool to the FreeTrust marketplace and reach thousands of developers.</p>
            <Link href="/register" className="submit-btn">🚀 Submit a tool</Link>
          </div>
        </div>
      </div>
    </>
  )
}
