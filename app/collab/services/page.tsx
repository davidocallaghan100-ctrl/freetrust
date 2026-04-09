'use client'
import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCurrency } from '@/context/CurrencyContext'

interface ServiceListing {
  id: string
  seller_id: string
  title: string
  description: string
  price: number
  currency: string
  images: string[] | null
  tags: string[] | null
  location: string | null
  created_at: string
  profiles: { id: string; full_name: string | null; avatar_url: string | null; location: string | null } | null
  trust_balances: { balance: number } | Array<{ balance: number }> | null
}

const GRADIENTS = [
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  'linear-gradient(135deg,#fb923c,#ea580c)',
]
function grad(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}
function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function trustBadge(score: number) {
  if (score >= 500) return { label: 'Top Trusted', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' }
  if (score >= 200) return { label: 'Verified',    color: '#34d399', bg: 'rgba(52,211,153,0.1)'  }
  if (score >= 50)  return { label: 'Active',      color: '#38bdf8', bg: 'rgba(56,189,248,0.1)'  }
  return              { label: 'New',          color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
}
function getTrustBalance(tb: ServiceListing['trust_balances']): number {
  if (!tb) return 0
  if (Array.isArray(tb)) return tb[0]?.balance ?? 0
  return (tb as { balance: number }).balance ?? 0
}

const MOCK_SERVICES: ServiceListing[] = [
  { id: 's1', seller_id: 's1', title: 'Brand Identity Design', description: 'Complete brand identity including logo, colour palette, typography and brand guidelines.', price: 450, currency: '£', images: null, tags: ['Logo', 'Brand', 'Figma'], location: 'London, UK', created_at: new Date().toISOString(), profiles: { id: 's1', full_name: 'Sarah Chen', avatar_url: 'https://i.pravatar.cc/150?img=47', location: 'London, UK' }, trust_balances: { balance: 820 } },
  { id: 's2', seller_id: 's2', title: 'Full-Stack Web App Development', description: 'End-to-end web application development using modern tech stack. From MVP to production.', price: 2800, currency: '£', images: null, tags: ['Next.js', 'Supabase', 'TypeScript'], location: 'Bangalore, India', created_at: new Date().toISOString(), profiles: { id: 's2', full_name: 'Priya Nair', avatar_url: 'https://i.pravatar.cc/150?img=44', location: 'Bangalore, India' }, trust_balances: { balance: 1100 } },
  { id: 's3', seller_id: 's3', title: 'SEO & Content Strategy', description: 'Comprehensive SEO audit and content strategy to grow organic traffic by 40%+ in 90 days.', price: 320, currency: '£', images: null, tags: ['SEO', 'Content', 'Analytics'], location: 'Dublin, Ireland', created_at: new Date().toISOString(), profiles: { id: 's3', full_name: 'Tom Walsh', avatar_url: 'https://i.pravatar.cc/150?img=53', location: 'Dublin, Ireland' }, trust_balances: { balance: 640 } },
  { id: 's4', seller_id: 's4', title: 'Startup Business Coaching', description: '4-session coaching package covering product-market fit, fundraising, and growth strategy.', price: 180, currency: '£', images: null, tags: ['Startup', 'Pitch', 'Strategy'], location: 'Remote', created_at: new Date().toISOString(), profiles: { id: 's4', full_name: 'James Okafor', avatar_url: 'https://i.pravatar.cc/150?img=13', location: 'Abuja, Nigeria' }, trust_balances: { balance: 320 } },
  { id: 's5', seller_id: 's5', title: 'Impact Report & ESG Consulting', description: 'Professional ESG impact reports and sustainability strategy for SMEs and startups.', price: 750, currency: '£', images: null, tags: ['ESG', 'Sustainability', 'Reporting'], location: 'Lagos, Nigeria', created_at: new Date().toISOString(), profiles: { id: 's5', full_name: 'Amara Diallo', avatar_url: 'https://i.pravatar.cc/150?img=45', location: 'Lagos, Nigeria' }, trust_balances: { balance: 710 } },
  { id: 's6', seller_id: 's6', title: 'UX Research & Usability Testing', description: '10-participant usability study with full analysis, recordings, and actionable recommendations.', price: 600, currency: '£', images: null, tags: ['UX', 'Research', 'Testing'], location: 'Berlin, Germany', created_at: new Date().toISOString(), profiles: { id: 's6', full_name: 'Lena Fischer', avatar_url: 'https://i.pravatar.cc/150?img=41', location: 'Berlin, Germany' }, trust_balances: { balance: 530 } },
]

function ServicesContent() {
  const searchParams = useSearchParams()
  const { format, currency } = useCurrency()
  const [services, setServices]   = useState<ServiceListing[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState(searchParams.get('q') || '')
  const [minTrust, setMinTrust]   = useState(0)
  const [maxPrice, setMaxPrice]   = useState(5000)
  const [page, setPage]           = useState(1)
  const [total, setTotal]         = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'service',
        min_trust: String(minTrust),
        max_price: String(maxPrice),
        page: String(page),
        ...(search ? { q: search } : {}),
      })
      const res = await fetch(`/api/collab/listings?${params}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      if (json.listings && json.listings.length > 0) {
        setServices(json.listings)
        setTotal(json.total)
      } else {
        setServices(MOCK_SERVICES)
        setTotal(MOCK_SERVICES.length)
      }
    } catch {
      setServices(MOCK_SERVICES)
      setTotal(MOCK_SERVICES.length)
    } finally {
      setLoading(false)
    }
  }, [minTrust, maxPrice, page, search])

  useEffect(() => { fetchServices() }, [fetchServices])

  const reset = () => { setSearch(''); setMinTrust(0); setMaxPrice(5000); setPage(1) }
  const hasFilters = search || minTrust > 0 || maxPrice < 5000

  const FilterPanel = () => (
    <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Filters</h3>
        {hasFilters && (
          <button onClick={reset} style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Search</label>
        <input
          type="text" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="e.g. design, SEO..."
          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {/* Min Trust */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
          Min Trust Score: <span style={{ color: '#38bdf8' }}>₮{minTrust}</span>
        </label>
        <input type="range" min={0} max={1000} step={50} value={minTrust}
          onChange={e => { setMinTrust(parseInt(e.target.value)); setPage(1) }}
          style={{ width: '100%', accentColor: '#38bdf8' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 2 }}>
          <span>₮0</span><span>₮1000</span>
        </div>
      </div>

      {/* Max budget */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
          Max Budget: <span style={{ color: '#a78bfa' }}>{currency.symbol}{maxPrice >= 5000 ? '5k+' : maxPrice}</span>
        </label>
        <input type="range" min={0} max={5000} step={50} value={maxPrice}
          onChange={e => { setMaxPrice(parseInt(e.target.value)); setPage(1) }}
          style={{ width: '100%', accentColor: '#a78bfa' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 2 }}>
          <span>{currency.symbol}0</span><span>{currency.symbol}5k+</span>
        </div>
      </div>

      <button onClick={reset}
        style={{ width: '100%', padding: '11px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', minHeight: 44 }}>
        Reset Filters
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', paddingTop: 64 }}>
      <style>{`
        /* Card */
        .cs-card { background:#1e293b; border:1px solid #334155; border-radius:14px; overflow:hidden; text-decoration:none; display:flex; flex-direction:column; transition:border-color 0.15s, transform 0.15s; }
        .cs-card:hover { border-color:rgba(167,139,250,0.4); transform:translateY(-2px); }
        .cs-card:active { transform:scale(0.99); }
        .cs-book { background:linear-gradient(135deg,#a78bfa,#7c3aed); color:#fff; border-radius:8px; padding:8px 16px; font-size:13px; font-weight:700; text-decoration:none; display:inline-block; white-space:nowrap; flex-shrink:0; }

        /* Layout */
        .cs-layout { max-width:1280px; margin:0 auto; padding:20px 16px 100px; display:grid; grid-template-columns:240px 1fr; gap:22px; align-items:start; }
        .cs-sidebar-sticky { position:sticky; top:116px; }

        /* Mobile filter toggle */
        .cs-filter-toggle { display:none; }

        /* Mobile */
        @media (max-width:768px) {
          .cs-layout { grid-template-columns:1fr; padding:14px 14px 100px; gap:12px; }
          .cs-sidebar { display:none; }
          .cs-sidebar.open { display:block; }
          .cs-sidebar-sticky { position:static; }
          .cs-filter-toggle { display:flex; width:100%; align-items:center; gap:8px; background:#1e293b; border:1px solid rgba(167,139,250,0.2); border-radius:10px; padding:11px 14px; font-size:14px; color:#94a3b8; cursor:pointer; font-family:inherit; min-height:44px; box-sizing:border-box; }
          .cs-grid { grid-template-columns:1fr !important; }
          .cs-hero-row { flex-direction:column !important; align-items:flex-start !important; gap:12px !important; }
          .cs-offer-btn { width:100% !important; justify-content:center !important; }
        }

        /* Grid */
        .cs-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }

        /* Skeleton */
        @keyframes cs-pulse { 0%,100%{opacity:0.5} 50%{opacity:0.25} }
        .cs-skel { background:#1e293b; border-radius:14px; border:1px solid #334155; animation:cs-pulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ background: 'linear-gradient(180deg,rgba(167,139,250,0.07) 0%,transparent 100%)', padding: '20px 16px 16px', borderBottom: '1px solid rgba(167,139,250,0.08)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, color: '#64748b' }}>
            <Link href="/collab" style={{ color: '#64748b', textDecoration: 'none' }}>Collab</Link>
            <span>›</span>
            <span style={{ color: '#94a3b8' }}>Services</span>
          </div>

          <div className="cs-hero-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 'clamp(20px,5vw,26px)', fontWeight: 800, margin: '0 0 4px' }}>🎯 Services</h1>
              <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>Skilled professionals from the FreeTrust community</p>
            </div>
            <Link href="/seller/gigs/create" className="cs-offer-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff',
              textDecoration: 'none', borderRadius: 10, padding: '11px 20px',
              fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', minHeight: 44,
            }}>
              + Offer a Service
            </Link>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px' }}>

        {/* Mobile filter toggle */}
        <button className="cs-filter-toggle" onClick={() => setFiltersOpen(o => !o)} style={{ margin: '14px 0 0' }}>
          <span>⚙️</span>
          <span>Filters</span>
          {hasFilters && (
            <span style={{ background: '#a78bfa', color: '#fff', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>Active</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12 }}>{filtersOpen ? '▲' : '▼'}</span>
        </button>

        <div className="cs-layout">
          {/* Sidebar */}
          <aside className={`cs-sidebar${filtersOpen ? ' open' : ''}`}>
            <div className="cs-sidebar-sticky">
              <FilterPanel />
            </div>
          </aside>

          {/* Main content */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                {loading ? 'Loading…' : <><strong style={{ color: '#f1f5f9' }}>{total}</strong> services</>}
              </span>
              {hasFilters && (
                <button onClick={reset} style={{ background: 'none', border: '1px solid #334155', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✕ Clear filters
                </button>
              )}
            </div>

            {loading ? (
              <div className="cs-grid">
                {[1,2,3,4,5,6].map(i => <div key={i} className="cs-skel" style={{ height: 220 }} />)}
              </div>
            ) : services.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>No services found</div>
                <div style={{ fontSize: 13 }}>Try adjusting your filters</div>
              </div>
            ) : (
              <>
                <div className="cs-grid">
                  {services.map(s => {
                    const seller = s.profiles
                    const trust  = getTrustBalance(s.trust_balances)
                    const badge  = trustBadge(trust)
                    return (
                      <Link key={s.id} href={`/services/${s.id}`} className="cs-card">
                        {/* Colour accent bar */}
                        <div style={{ height: 6, background: grad(s.id), flexShrink: 0 }} />

                        <div style={{ padding: '14px 14px 0' }}>
                          {/* Seller row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: '50%', background: grad(seller?.id || s.id),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden',
                            }}>
                              {seller?.avatar_url
                                ? <img src={seller.avatar_url} style={{ width: 38, height: 38, objectFit: 'cover' }} alt="" />
                                : initials(seller?.full_name ?? null)
                              }
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {seller?.full_name ?? 'Provider'}
                              </div>
                              <div style={{ fontSize: 11, color: badge.color }}>
                                {badge.label} · ₮{trust}
                              </div>
                            </div>
                            {s.location && (
                              <span style={{ fontSize: 10, color: '#475569', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                                📍 {s.location.split(',')[0]}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9', marginBottom: 6, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                            {s.title}
                          </div>

                          {/* Description */}
                          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                            {s.description}
                          </div>

                          {/* Tags */}
                          {s.tags && s.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                              {s.tags.slice(0, 3).map(t => (
                                <span key={t} style={{ fontSize: 10, background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '2px 8px', color: '#94a3b8' }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 14px', marginTop: 'auto', borderTop: '1px solid rgba(167,139,250,0.08)', gap: 8 }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{format(s.price, s.currency === 'GBP' ? 'GBP' : s.currency === 'USD' ? 'USD' : 'EUR')}</span>
                          <span className="cs-book">Book Now</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>

                {/* Pagination */}
                {total > 20 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 28 }}>
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                      style={{ padding: '10px 20px', background: page === 1 ? '#1e293b' : '#334155', border: 'none', borderRadius: 8, color: '#f1f5f9', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13, minHeight: 44, fontFamily: 'inherit' }}>
                      ← Prev
                    </button>
                    <span style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 13, alignSelf: 'center' }}>Page {page}</span>
                    <button onClick={() => setPage(p => p + 1)}
                      style={{ padding: '10px 20px', background: '#334155', border: 'none', borderRadius: 8, color: '#f1f5f9', cursor: 'pointer', fontSize: 13, minHeight: 44, fontFamily: 'inherit' }}>
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CollabServicesPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Loading services…
      </div>
    }>
      <ServicesContent />
    </Suspense>
  )
}
