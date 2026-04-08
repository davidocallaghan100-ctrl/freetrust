'use client'
import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

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
  if (score >= 200) return { label: 'Verified', color: '#34d399', bg: 'rgba(52,211,153,0.1)' }
  if (score >= 50) return { label: 'Active', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' }
  return { label: 'New', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
}
function getTrustBalance(tb: Listing['trust_balances']): number {
  if (!tb) return 0
  if (Array.isArray(tb)) return tb[0]?.balance ?? 0
  return (tb as { balance: number }).balance ?? 0
}

const MOCK_LISTINGS: Listing[] = [
  { id: 'm1', seller_id: 'm1', title: 'Handcrafted Leather Wallet', description: 'Genuine full-grain leather bifold wallet. Made to order, ships worldwide.', price: 65, currency: '£', images: null, tags: ['Leather', 'Handmade'], location: 'Dublin, Ireland', created_at: new Date().toISOString(), profiles: { id: 'm1', full_name: 'Tom Walsh', avatar_url: null, location: 'Dublin, Ireland' }, trust_balances: { balance: 640 } },
  { id: 'm2', seller_id: 'm2', title: 'Illustrated Nature Prints (Set of 3)', description: 'A3 archival prints of original botanical illustrations. Printed on 300gsm paper.', price: 48, currency: '£', images: null, tags: ['Art', 'Print', 'Decor'], location: 'London, UK', created_at: new Date().toISOString(), profiles: { id: 'm2', full_name: 'Sarah Chen', avatar_url: null, location: 'London, UK' }, trust_balances: { balance: 820 } },
  { id: 'm3', seller_id: 'm3', title: 'Notion Productivity System Template', description: 'Complete life & work OS built in Notion. Includes 40+ linked databases and views.', price: 29, currency: '£', images: null, tags: ['Notion', 'Productivity', 'Digital'], location: 'Berlin, Germany', created_at: new Date().toISOString(), profiles: { id: 'm3', full_name: 'Lena Fischer', avatar_url: null, location: 'Berlin, Germany' }, trust_balances: { balance: 530 } },
  { id: 'm4', seller_id: 'm4', title: 'Next.js Starter Boilerplate', description: 'Production-ready Next.js 14 + Supabase + Stripe boilerplate with auth, billing, and dark mode.', price: 79, currency: '£', images: null, tags: ['Next.js', 'Code', 'Template'], location: 'Bangalore, India', created_at: new Date().toISOString(), profiles: { id: 'm4', full_name: 'Priya Nair', avatar_url: null, location: 'Bangalore, India' }, trust_balances: { balance: 1100 } },
  { id: 'm5', seller_id: 'm5', title: 'ESG Reporting Excel Toolkit', description: 'Complete Excel/Google Sheets toolkit for SME ESG reporting. Includes GRI & CSRD templates.', price: 120, currency: '£', images: null, tags: ['ESG', 'Excel', 'Business'], location: 'Lagos, Nigeria', created_at: new Date().toISOString(), profiles: { id: 'm5', full_name: 'Amara Diallo', avatar_url: null, location: 'Lagos, Nigeria' }, trust_balances: { balance: 710 } },
  { id: 'm6', seller_id: 'm6', title: 'Ceramic Pour-Over Coffee Set', description: 'Handthrown ceramic pour-over dripper + mug set. Each piece is unique.', price: 95, currency: '£', images: null, tags: ['Ceramic', 'Coffee', 'Handmade'], location: 'Glasgow, UK', created_at: new Date().toISOString(), profiles: { id: 'm6', full_name: 'James Reid', avatar_url: null, location: 'Glasgow, UK' }, trust_balances: { balance: 320 } },
]

function MarketplaceContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [minTrust, setMinTrust] = useState(0)
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(5000)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

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
      const json = await res.json()
      if (json.listings && json.listings.length > 0) {
        setListings(json.listings)
        setTotal(json.total)
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

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
      <style>{`
        .listing-card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 14px;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          cursor: pointer;
        }
        .listing-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.35);
        }
        .filter-label { font-size: 12px; color: #64748b; font-weight: 500; margin-bottom: 6px; display: block; }
        input[type=range] { width: 100%; accent-color: #38bdf8; }
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Link href="/collab" style={{ color: '#64748b', fontSize: 14, textDecoration: 'none' }}>Collab</Link>
              <span style={{ color: '#475569' }}>›</span>
              <span style={{ color: '#f1f5f9', fontSize: 14 }}>Marketplace</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>🛒 Marketplace</h1>
            <p style={{ color: '#64748b', margin: '6px 0 0', fontSize: 14 }}>Products from trusted community members</p>
          </div>
          <Link href="/seller/gigs/create" style={{
            background: 'linear-gradient(135deg,#38bdf8,#0284c7)',
            color: '#fff', textDecoration: 'none',
            borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600,
          }}>
            + List a Product
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Filters sidebar */}
          <div style={{
            width: 240, flexShrink: 0, background: '#1e293b',
            border: '1px solid #334155', borderRadius: 14, padding: 20,
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Filters</h3>

            <div style={{ marginBottom: 20 }}>
              <label className="filter-label">Search</label>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Keywords..."
                style={{
                  width: '100%', background: '#0f172a', border: '1px solid #334155',
                  borderRadius: 8, padding: '8px 10px', color: '#f1f5f9', fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="filter-label">Min Trust Score: ₮{minTrust}</label>
              <input type="range" min={0} max={1000} step={50} value={minTrust}
                onChange={e => { setMinTrust(parseInt(e.target.value)); setPage(1) }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginTop: 2 }}>
                <span>₮0</span><span>₮1000</span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="filter-label">Price Range</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" value={minPrice} onChange={e => { setMinPrice(parseInt(e.target.value) || 0); setPage(1) }}
                  placeholder="Min" style={{ width: '50%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '7px 8px', color: '#f1f5f9', fontSize: 12 }} />
                <input type="number" value={maxPrice} onChange={e => { setMaxPrice(parseInt(e.target.value) || 9999); setPage(1) }}
                  placeholder="Max" style={{ width: '50%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '7px 8px', color: '#f1f5f9', fontSize: 12 }} />
              </div>
            </div>

            <button onClick={() => { setSearch(''); setMinTrust(0); setMinPrice(0); setMaxPrice(5000); setPage(1) }}
              style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
              Reset Filters
            </button>
          </div>

          {/* Grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} style={{ background: '#1e293b', borderRadius: 14, height: 280, border: '1px solid #334155', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                  Showing {listings.length} of {total} products
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
                  {listings.map(l => {
                    const seller = l.profiles
                    const trust = getTrustBalance(l.trust_balances)
                    const badge = trustBadge(trust)
                    return (
                      <div key={l.id} className="listing-card">
                        {/* Image / placeholder */}
                        <div style={{
                          height: 160,
                          background: grad(l.id),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 36,
                        }}>
                          {l.images?.[0]
                            ? <img src={l.images[0]} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : '📦'}
                        </div>
                        <div style={{ padding: 16 }}>
                          <div style={{ fontWeight: 600, fontSize: 15, color: '#f1f5f9', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{l.description}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{l.currency || '£'}{l.price}</span>
                            <span style={{ fontSize: 11, color: badge.color, background: badge.bg, padding: '2px 8px', borderRadius: 100 }}>₮{trust} · {badge.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: grad(seller?.id || l.id),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                            }}>
                              {seller?.avatar_url ? <img src={seller.avatar_url} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} alt="" /> : initials(seller?.full_name ?? null)}
                            </div>
                            <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seller?.full_name ?? 'Community Member'}</span>
                          </div>
                          {l.location && (
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>📍 {l.location}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Pagination */}
                {total > 20 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                      style={{ padding: '8px 16px', background: page === 1 ? '#1e293b' : '#334155', border: 'none', borderRadius: 8, color: '#f1f5f9', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
                      ← Prev
                    </button>
                    <span style={{ padding: '8px 16px', color: '#94a3b8', fontSize: 14 }}>Page {page}</span>
                    <button onClick={() => setPage(p => p + 1)}
                      style={{ padding: '8px 16px', background: '#334155', border: 'none', borderRadius: 8, color: '#f1f5f9', cursor: 'pointer' }}>
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

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading marketplace...</div>}>
      <MarketplaceContent />
    </Suspense>
  )
}
