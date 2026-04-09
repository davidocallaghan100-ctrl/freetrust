'use client'
import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCurrency } from '@/context/CurrencyContext'

interface Listing {
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
function getTrustBalance(tb: Listing['trust_balances']): number {
  if (!tb) return 0
  if (Array.isArray(tb)) return tb[0]?.balance ?? 0
  return (tb as { balance: number }).balance ?? 0
}

const MOCK_LISTINGS: Listing[] = [
  { id: 'm1', seller_id: 'm1', title: 'Handcrafted Leather Wallet', description: 'Genuine full-grain leather bifold wallet. Made to order, ships worldwide.', price: 65, currency: '£', images: null, tags: ['Leather', 'Handmade'], location: 'Dublin, Ireland', created_at: new Date().toISOString(), profiles: { id: 'm1', full_name: 'Tom Walsh', avatar_url: 'https://i.pravatar.cc/150?img=53', location: 'Dublin, Ireland' }, trust_balances: { balance: 640 } },
  { id: 'm2', seller_id: 'm2', title: 'Illustrated Nature Prints (Set of 3)', description: 'A3 archival prints of original botanical illustrations. Printed on 300gsm paper.', price: 48, currency: '£', images: null, tags: ['Art', 'Print', 'Decor'], location: 'London, UK', created_at: new Date().toISOString(), profiles: { id: 'm2', full_name: 'Sarah Chen', avatar_url: 'https://i.pravatar.cc/150?img=47', location: 'London, UK' }, trust_balances: { balance: 820 } },
  { id: 'm3', seller_id: 'm3', title: 'Notion Productivity System Template', description: 'Complete life & work OS built in Notion. Includes 40+ linked databases and views.', price: 29, currency: '£', images: null, tags: ['Notion', 'Productivity', 'Digital'], location: 'Berlin, Germany', created_at: new Date().toISOString(), profiles: { id: 'm3', full_name: 'Lena Fischer', avatar_url: 'https://i.pravatar.cc/150?img=41', location: 'Berlin, Germany' }, trust_balances: { balance: 530 } },
  { id: 'm4', seller_id: 'm4', title: 'Next.js Starter Boilerplate', description: 'Production-ready Next.js 14 + Supabase + Stripe boilerplate with auth, billing, and dark mode.', price: 79, currency: '£', images: null, tags: ['Next.js', 'Code', 'Template'], location: 'Bangalore, India', created_at: new Date().toISOString(), profiles: { id: 'm4', full_name: 'Priya Nair', avatar_url: 'https://i.pravatar.cc/150?img=44', location: 'Bangalore, India' }, trust_balances: { balance: 1100 } },
  { id: 'm5', seller_id: 'm5', title: 'ESG Reporting Excel Toolkit', description: 'Complete Excel/Google Sheets toolkit for SME ESG reporting. Includes GRI & CSRD templates.', price: 120, currency: '£', images: null, tags: ['ESG', 'Excel', 'Business'], location: 'Lagos, Nigeria', created_at: new Date().toISOString(), profiles: { id: 'm5', full_name: 'Amara Diallo', avatar_url: 'https://i.pravatar.cc/150?img=45', location: 'Lagos, Nigeria' }, trust_balances: { balance: 710 } },
  { id: 'm6', seller_id: 'm6', title: 'Ceramic Pour-Over Coffee Set', description: 'Handthrown ceramic pour-over dripper + mug set. Each piece is unique.', price: 95, currency: '£', images: null, tags: ['Ceramic', 'Coffee', 'Handmade'], location: 'Glasgow, UK', created_at: new Date().toISOString(), profiles: { id: 'm6', full_name: 'James Reid', avatar_url: 'https://i.pravatar.cc/150?img=22', location: 'Glasgow, UK' }, trust_balances: { balance: 320 } },
  { id: 'm7', seller_id: 'm7', title: 'Watercolour Greeting Card Set (8pk)', description: 'Eight hand-painted watercolour greeting cards, blank inside. Perfect for any occasion.', price: 18, currency: '£', images: null, tags: ['Cards', 'Art', 'Stationery'], location: 'Cork, Ireland', created_at: new Date().toISOString(), profiles: { id: 'm7', full_name: 'Ciara Murphy', avatar_url: 'https://i.pravatar.cc/150?img=39', location: 'Cork, Ireland' }, trust_balances: { balance: 410 } },
  { id: 'm8', seller_id: 'm8', title: 'Organic Beeswax Candle Set', description: 'Set of 4 hand-poured beeswax candles with organic cotton wicks. Honey & vanilla scent.', price: 36, currency: '£', images: null, tags: ['Candles', 'Organic', 'Handmade'], location: 'Edinburgh, UK', created_at: new Date().toISOString(), profiles: { id: 'm8', full_name: 'Maja Eriksson', avatar_url: 'https://i.pravatar.cc/150?img=25', location: 'Edinburgh, UK' }, trust_balances: { balance: 290 } },
]

function MarketplaceContent() {
  const searchParams = useSearchParams()
  const { format } = useCurrency()

  const [listings, setListings]   = useState<Listing[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState(searchParams.get('q') || '')
  const [minTrust, setMinTrust]   = useState(0)
  const [minPrice, setMinPrice]   = useState(0)
  const [maxPrice, setMaxPrice]   = useState(5000)
  const [page, setPage]           = useState(1)
  const [total, setTotal]         = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'product',
        min_trust: String(minTrust),
        min_price: String(minPrice),
        max_price: String(maxPrice),
        page: String(page),
        ...(search ? { q: search } : {}),
      })
      const res = await fetch(`/api/collab/listings?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json() as { listings?: Listing[]; total?: number }
      if (json.listings && json.listings.length > 0) {
        setListings(json.listings)
        setTotal(json.total ?? json.listings.length)
      } else {
        setListings(MOCK_LISTINGS)
        setTotal(MOCK_LISTINGS.length)
      }
    } catch {
      setListings(MOCK_LISTINGS)
      setTotal(MOCK_LISTINGS.length)
    } finally {
      setLoading(false)
    }
  }, [minTrust, minPrice, maxPrice, page, search])

  useEffect(() => { fetchListings() }, [fetchListings])

  const resetFilters = () => { setSearch(''); setMinTrust(0); setMinPrice(0); setMaxPrice(5000); setPage(1) }

  return (
    <div style={{ minHeight: 'calc(100vh - 104px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', paddingTop: 104 }}>
      <style>{`
        /* ── Hero ── */
        .mk-hero { background: linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%); padding: 24px 20px 18px; border-bottom: 1px solid rgba(56,189,248,0.08); }
        .mk-hero-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

        /* ── Layout ── */
        .mk-wrap { max-width: 1280px; margin: 0 auto; padding: 20px 20px 100px; display: flex; gap: 24px; align-items: flex-start; }
        .mk-sidebar { width: 220px; flex-shrink: 0; }
        .mk-sidebar-sticky { position: sticky; top: 116px; }
        .mk-main { flex: 1; min-width: 0; }

        /* ── Grid ── */
        .mk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }

        /* ── Card ── */
        .mk-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; text-decoration: none; transition: border-color 0.15s, transform 0.15s; }
        .mk-card:hover { border-color: rgba(56,189,248,0.28); transform: translateY(-2px); }
        .mk-card:active { transform: scale(0.99); }
        .mk-card-img { height: 130px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; position: relative; overflow: hidden; }
        .mk-card-body { padding: 12px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .mk-card-title { font-size: 14px; font-weight: 700; color: #f1f5f9; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .mk-card-desc { font-size: 12px; color: #64748b; line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin: 0; flex: 1; }
        .mk-card-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-top: 1px solid rgba(56,189,248,0.06); gap: 8px; }
        .mk-card-price { font-size: 18px; font-weight: 800; color: #38bdf8; }
        .mk-card-cta { background: #38bdf8; color: #0f172a; border-radius: 7px; padding: 5px 13px; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .mk-card-seller { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b; padding: 0 12px 10px; }
        .mk-card-avatar { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .mk-card-avatar-fallback { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; color: #0f172a; flex-shrink: 0; }

        /* ── Skeleton ── */
        .mk-skeleton { background: #1e293b; border-radius: 14px; border: 1px solid #334155; }
        @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:0.3} }

        /* ── Sidebar ── */
        .mk-filter-box { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; padding: 16px; }
        .mk-filter-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; display: block; }
        .mk-filter-input { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px 10px; color: #f1f5f9; font-size: 13px; outline: none; box-sizing: border-box; font-family: inherit; }
        .mk-filter-input:focus { border-color: rgba(56,189,248,0.4); }
        input[type=range] { width: 100%; accent-color: #38bdf8; }

        /* ── Mobile filters toggle ── */
        .mk-filters-toggle { display: none; }

        /* ── List a product btn ── */
        .mk-list-btn { display: inline-flex; align-items: center; gap: 6px; background: #38bdf8; color: #0f172a; border-radius: 10px; padding: 10px 18px; font-weight: 700; font-size: 14px; text-decoration: none; white-space: nowrap; min-height: 44px; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .mk-hero { padding: 16px 14px 14px; }
          .mk-wrap { padding: 14px 12px 100px; flex-direction: column; gap: 0; }
          .mk-sidebar { display: none; width: 100%; margin-bottom: 14px; }
          .mk-sidebar.open { display: block; }
          .mk-sidebar-sticky { position: static; }
          .mk-filters-toggle { display: flex; align-items: center; gap: 8px; background: #1e293b; border: 1px solid rgba(56,189,248,0.2); border-radius: 9px; padding: 9px 14px; font-size: 13px; color: #94a3b8; cursor: pointer; font-family: inherit; margin-bottom: 14px; min-height: 44px; width: 100%; }
          .mk-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .mk-card-img { height: 110px; }
          .mk-card-body { padding: 10px; }
          .mk-card-title { font-size: 13px; }
          .mk-card-footer { padding: 8px 10px; }
          .mk-card-price { font-size: 16px; }
          .mk-card-seller { padding: 0 10px 9px; }
          .mk-list-btn { width: 100%; justify-content: center; }
          .mk-hero-inner h1 { font-size: 22px !important; }
        }

        @media (max-width: 380px) {
          .mk-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Hero ── */}
      <div className="mk-hero">
        <div className="mk-hero-inner">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12, color: '#64748b' }}>
              <Link href="/collab" style={{ color: '#64748b', textDecoration: 'none' }}>Collab</Link>
              <span>›</span>
              <span style={{ color: '#94a3b8' }}>Marketplace</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🛒 Marketplace</h1>
            <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 13 }}>Products from trusted community members</p>
          </div>
          <Link href="/seller/gigs/create" className="mk-list-btn">+ List a Product</Link>
        </div>
      </div>

      <div className="mk-wrap">
        {/* Mobile filters toggle */}
        <button className="mk-filters-toggle" onClick={() => setFiltersOpen(o => !o)}>
          <span>⚙️</span>
          <span>Filters</span>
          {(search || minTrust > 0 || minPrice > 0 || maxPrice < 5000) && (
            <span style={{ marginLeft: 'auto', background: '#38bdf8', color: '#0f172a', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>Active</span>
          )}
          <span style={{ marginLeft: filtersOpen ? 0 : 'auto', fontSize: 11 }}>{filtersOpen ? '▲' : '▼'}</span>
        </button>

        {/* ── Sidebar / Filters ── */}
        <aside className={`mk-sidebar${filtersOpen ? ' open' : ''}`}>
          <div className="mk-sidebar-sticky">
            <div className="mk-filter-box">
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Filters</h3>

              {/* Search */}
              <div style={{ marginBottom: 16 }}>
                <label className="mk-filter-label">Search</label>
                <input className="mk-filter-input" type="text" value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Keywords…" />
              </div>

              {/* Min Trust */}
              <div style={{ marginBottom: 16 }}>
                <label className="mk-filter-label">Min Trust Score: ₮{minTrust}</label>
                <input type="range" min={0} max={1000} step={50} value={minTrust}
                  onChange={e => { setMinTrust(parseInt(e.target.value)); setPage(1) }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 2 }}>
                  <span>₮0</span><span>₮1000</span>
                </div>
              </div>

              {/* Price Range */}
              <div style={{ marginBottom: 16 }}>
                <label className="mk-filter-label">Price Range</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="mk-filter-input" type="number" value={minPrice || ''}
                    onChange={e => { setMinPrice(parseInt(e.target.value) || 0); setPage(1) }}
                    placeholder="Min" style={{ width: '50%' }} />
                  <input className="mk-filter-input" type="number" value={maxPrice < 5000 ? maxPrice : ''}
                    onChange={e => { setMaxPrice(parseInt(e.target.value) || 5000); setPage(1) }}
                    placeholder="Max" style={{ width: '50%' }} />
                </div>
              </div>

              <button onClick={resetFilters}
                style={{ width: '100%', padding: '9px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', minHeight: 44 }}>
                Reset Filters
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="mk-main">
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
            {loading ? 'Loading…' : <><strong style={{ color: '#f1f5f9' }}>{total}</strong> products</>}
          </div>

          {loading ? (
            <div className="mk-grid">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="mk-skeleton" style={{ height: 260, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : (
            <>
              <div className="mk-grid">
                {listings.map(l => {
                  const seller = l.profiles
                  const trust  = getTrustBalance(l.trust_balances)
                  const badge  = trustBadge(trust)
                  const tags   = l.tags?.slice(0, 2) ?? []

                  return (
                    <Link key={l.id} href={`/collab/listing/${l.id}`} className="mk-card">
                      {/* Image */}
                      <div className="mk-card-img" style={{ background: grad(l.id) }}>
                        {l.images?.[0]
                          ? <img src={l.images[0]} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span>📦</span>
                        }
                        {/* Trust badge */}
                        <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg, padding: '2px 7px', borderRadius: 999, border: `1px solid ${badge.color}30` }}>
                          ₮{trust}
                        </span>
                      </div>

                      {/* Body */}
                      <div className="mk-card-body">
                        <div className="mk-card-title">{l.title}</div>
                        <p className="mk-card-desc">{l.description}</p>
                        {tags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {tags.map(t => (
                              <span key={t} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '1px 7px', fontSize: 10, color: '#94a3b8' }}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Seller row */}
                      <div className="mk-card-seller">
                        {seller?.avatar_url
                          ? <img src={seller.avatar_url} alt={seller.full_name ?? ''} className="mk-card-avatar" />
                          : <div className="mk-card-avatar-fallback" style={{ background: grad(seller?.id ?? l.id) }}>{initials(seller?.full_name ?? null)}</div>
                        }
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seller?.full_name ?? 'Community Member'}</span>
                        {l.location && <span style={{ marginLeft: 'auto', color: '#475569', flexShrink: 0 }}>📍 {l.location.split(',')[0]}</span>}
                      </div>

                      {/* Footer */}
                      <div className="mk-card-footer">
                        <span className="mk-card-price">{format(l.price, l.currency === 'GBP' ? 'GBP' : l.currency === 'USD' ? 'USD' : 'EUR')}</span>
                        <span className="mk-card-cta">View</span>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Pagination */}
              {total > 20 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 28 }}>
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    style={{ padding: '9px 18px', background: page === 1 ? '#1e293b' : '#334155', border: 'none', borderRadius: 8, color: '#f1f5f9', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13, minHeight: 44 }}>
                    ← Prev
                  </button>
                  <span style={{ padding: '9px 14px', color: '#94a3b8', fontSize: 13, alignSelf: 'center' }}>Page {page}</span>
                  <button onClick={() => setPage(p => p + 1)}
                    style={{ padding: '9px 18px', background: '#334155', border: 'none', borderRadius: 8, color: '#f1f5f9', cursor: 'pointer', fontSize: 13, minHeight: 44 }}>
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Loading marketplace…
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  )
}
