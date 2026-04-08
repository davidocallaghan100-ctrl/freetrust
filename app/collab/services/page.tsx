'use client'
import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

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
  if (score >= 200) return { label: 'Verified', color: '#34d399', bg: 'rgba(52,211,153,0.1)' }
  if (score >= 50) return { label: 'Active', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' }
  return { label: 'New', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
}
function getTrustBalance(tb: ServiceListing['trust_balances']): number {
  if (!tb) return 0
  if (Array.isArray(tb)) return tb[0]?.balance ?? 0
  return (tb as { balance: number }).balance ?? 0
}

const MOCK_SERVICES: ServiceListing[] = [
  { id: 's1', seller_id: 's1', title: 'Brand Identity Design', description: 'Complete brand identity including logo, colour palette, typography and brand guidelines.', price: 450, currency: '£', images: null, tags: ['Logo', 'Brand', 'Figma'], location: 'London, UK', created_at: new Date().toISOString(), profiles: { id: 's1', full_name: 'Sarah Chen', avatar_url: null, location: 'London, UK' }, trust_balances: { balance: 820 } },
  { id: 's2', seller_id: 's2', title: 'Full-Stack Web App Development', description: 'End-to-end web application development using modern tech stack. From MVP to production.', price: 2800, currency: '£', images: null, tags: ['Next.js', 'Supabase', 'TypeScript'], location: 'Bangalore, India', created_at: new Date().toISOString(), profiles: { id: 's2', full_name: 'Priya Nair', avatar_url: null, location: 'Bangalore, India' }, trust_balances: { balance: 1100 } },
  { id: 's3', seller_id: 's3', title: 'SEO & Content Strategy', description: 'Comprehensive SEO audit and content strategy to grow organic traffic by 40%+ in 90 days.', price: 320, currency: '£', images: null, tags: ['SEO', 'Content', 'Analytics'], location: 'Dublin, Ireland', created_at: new Date().toISOString(), profiles: { id: 's3', full_name: 'Tom Walsh', avatar_url: null, location: 'Dublin, Ireland' }, trust_balances: { balance: 640 } },
  { id: 's4', seller_id: 's4', title: 'Startup Business Coaching', description: '4-session coaching package covering product-market fit, fundraising, and growth strategy.', price: 180, currency: '£', images: null, tags: ['Startup', 'Pitch', 'Strategy'], location: 'Remote', created_at: new Date().toISOString(), profiles: { id: 's4', full_name: 'James Okafor', avatar_url: null, location: 'Abuja, Nigeria' }, trust_balances: { balance: 320 } },
  { id: 's5', seller_id: 's5', title: 'Impact Report & ESG Consulting', description: 'Professional ESG impact reports and sustainability strategy for SMEs and startups.', price: 750, currency: '£', images: null, tags: ['ESG', 'Sustainability', 'Reporting'], location: 'Lagos, Nigeria', created_at: new Date().toISOString(), profiles: { id: 's5', full_name: 'Amara Diallo', avatar_url: null, location: 'Lagos, Nigeria' }, trust_balances: { balance: 710 } },
  { id: 's6', seller_id: 's6', title: 'UX Research & Usability Testing', description: '10-participant usability study with full analysis, recordings, and actionable recommendations.', price: 600, currency: '£', images: null, tags: ['UX', 'Research', 'Testing'], location: 'Berlin, Germany', created_at: new Date().toISOString(), profiles: { id: 's6', full_name: 'Lena Fischer', avatar_url: null, location: 'Berlin, Germany' }, trust_balances: { balance: 530 } },
]

function ServicesContent() {
  const searchParams = useSearchParams()
  const [services, setServices] = useState<ServiceListing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [minTrust, setMinTrust] = useState(0)
  const [maxPrice, setMaxPrice] = useState(5000)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

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

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
      <style>{`
        .svc-card { background:#1e293b;border:1px solid #334155;border-radius:14px;overflow:hidden;transition:transform 0.2s,box-shadow 0.2s; }
        .svc-card:hover { transform:translateY(-3px);box-shadow:0 16px 40px rgba(0,0,0,0.35); }
        .book-btn { background:linear-gradient(135deg,#a78bfa,#7c3aed);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.15s;text-decoration:none;display:inline-block; }
        .book-btn:hover { opacity:0.85; }
        input[type=range]{width:100%;accent-color:#a78bfa;}
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Link href="/collab" style={{ color: '#64748b', fontSize: 14, textDecoration: 'none' }}>Collab</Link>
              <span style={{ color: '#475569' }}>›</span>
              <span style={{ color: '#f1f5f9', fontSize: 14 }}>Services</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>🎯 Services</h1>
            <p style={{ color: '#64748b', margin: '6px 0 0', fontSize: 14 }}>Skilled professionals from the FreeTrust community</p>
          </div>
          <Link href="/seller/gigs/create" style={{
            background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff',
            textDecoration: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600,
          }}>
            + Offer a Service
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Filters */}
          <div style={{ width: 240, flexShrink: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 20 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Filters</h3>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Search</label>
              <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="e.g. design, SEO..."
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', color: '#f1f5f9', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Min Trust Score: ₮{minTrust}</label>
              <input type="range" min={0} max={1000} step={50} value={minTrust} onChange={e => { setMinTrust(parseInt(e.target.value)); setPage(1) }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginTop: 2 }}><span>₮0</span><span>₮1000</span></div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Max Budget: £{maxPrice}</label>
              <input type="range" min={0} max={5000} step={50} value={maxPrice} onChange={e => { setMaxPrice(parseInt(e.target.value)); setPage(1) }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginTop: 2 }}><span>£0</span><span>£5k+</span></div>
            </div>
            <button onClick={() => { setSearch(''); setMinTrust(0); setMaxPrice(5000); setPage(1) }}
              style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
              Reset
            </button>
          </div>

          {/* Grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
                {[1,2,3,4,5,6].map(i => <div key={i} style={{ background: '#1e293b', borderRadius: 14, height: 220, border: '1px solid #334155', opacity: 0.5 }} />)}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Showing {services.length} of {total} services</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
                  {services.map(s => {
                    const seller = s.profiles
                    const trust = getTrustBalance(s.trust_balances)
                    const badge = trustBadge(trust)
                    return (
                      <div key={s.id} className="svc-card">
                        {/* Color header */}
                        <div style={{ height: 8, background: grad(s.id) }} />
                        <div style={{ padding: 20 }}>
                          {/* Seller row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%', background: grad(seller?.id || s.id),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                            }}>
                              {seller?.avatar_url ? <img src={seller.avatar_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="" /> : initials(seller?.full_name ?? null)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{seller?.full_name ?? 'Provider'}</div>
                              <div style={{ fontSize: 11, color: badge.color }}>{badge.label} · ₮{trust}</div>
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9', marginBottom: 8, lineHeight: 1.3 }}>{s.title}</div>
                          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 16, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.description}</div>
                          {s.tags && s.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                              {s.tags.slice(0, 3).map(t => (
                                <span key={t} style={{ fontSize: 11, background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '2px 8px', color: '#94a3b8' }}>{t}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>{s.currency || '£'}{s.price}</span>
                            <Link href={`/services/${s.id}`} className="book-btn">Book Now</Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
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
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading services...</div>}>
      <ServicesContent />
    </Suspense>
  )
}
