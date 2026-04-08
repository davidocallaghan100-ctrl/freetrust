'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['All', 'Digital Downloads', 'Physical Goods', 'Templates', 'Courses', 'Software', 'Books']

const MOCK_PRODUCTS = [
  { id: 1, title: 'Figma Component Library Pro', category: 'Digital Downloads', price: 49, currency: '£', seller: 'Sarah Chen', avatar: 'SC', rating: 4.9, reviews: 312, sales: 1840, desc: '850+ production-ready Figma components with auto-layout, variants, and dark mode.', tags: ['Figma', 'UI Kit', 'Design System'], badge: 'Bestseller' },
  { id: 2, title: 'Next.js SaaS Boilerplate', category: 'Templates', price: 129, currency: '£', seller: 'Priya Nair', avatar: 'PN', rating: 5.0, reviews: 89, sales: 420, desc: 'Production-ready Next.js 14 starter with auth, billing, dashboard and Supabase integration.', tags: ['Next.js', 'TypeScript', 'Supabase'], badge: 'Top Rated' },
  { id: 3, title: 'Impact Business Handbook', category: 'Books', price: 24, currency: '£', seller: 'Amara Diallo', avatar: 'AD', rating: 4.8, reviews: 156, sales: 2300, desc: 'A practical guide to building a purpose-driven business that delivers profit and positive impact.', tags: ['Business', 'Sustainability', 'Strategy'], badge: null },
  { id: 4, title: 'SEO Audit Spreadsheet Kit', category: 'Templates', price: 19, currency: '£', seller: 'Marcus Obi', avatar: 'MO', rating: 4.7, reviews: 203, sales: 3100, desc: '14 interconnected spreadsheets covering technical SEO, content gaps, backlink analysis and reporting.', tags: ['SEO', 'Spreadsheet', 'Marketing'], badge: null },
  { id: 5, title: 'Mindful Leadership Course', category: 'Courses', price: 89, currency: '£', seller: 'Tom Walsh', avatar: 'TW', rating: 4.9, reviews: 67, sales: 580, desc: '8-week self-paced course on conscious leadership, team culture and sustainable growth.', tags: ['Leadership', 'Course', 'Self-paced'], badge: 'New' },
  { id: 6, title: 'Handmade Ceramic Mug Set', category: 'Physical Goods', price: 65, currency: '£', seller: 'Lena Fischer', avatar: 'LF', rating: 4.9, reviews: 44, sales: 290, desc: 'Set of 4 hand-thrown ceramic mugs, each unique. Sustainably fired in a wood kiln. Ships worldwide.', tags: ['Handmade', 'Ceramic', 'Sustainable'], badge: 'Eco Verified' },
  { id: 7, title: 'Startup Financial Model', category: 'Templates', price: 35, currency: '£', seller: 'James Okafor', avatar: 'JO', rating: 4.8, reviews: 128, sales: 960, desc: '5-year financial model for SaaS startups. Includes revenue, burn rate, runway and investor dashboards.', tags: ['Finance', 'Excel', 'Startup'], badge: null },
  { id: 8, title: 'Social Media Content Calendar', category: 'Templates', price: 15, currency: '£', seller: 'Yuki Tanaka', avatar: 'YT', rating: 4.6, reviews: 445, sales: 6200, desc: '52-week content calendar with 300+ prompts, hooks, and post templates for all major platforms.', tags: ['Social Media', 'Content', 'Notion'], badge: 'Bestseller' },
]

const avatarGrad: Record<string, string> = {
  SC: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  PN: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
  MO: 'linear-gradient(135deg,#34d399,#059669)',
  TW: 'linear-gradient(135deg,#fb923c,#ea580c)',
  AD: 'linear-gradient(135deg,#f472b6,#db2777)',
  LF: 'linear-gradient(135deg,#fbbf24,#d97706)',
  JO: 'linear-gradient(135deg,#38bdf8,#7c3aed)',
  YT: 'linear-gradient(135deg,#34d399,#38bdf8)',
}

function getGrad(str: string): string {
  const grads = ['linear-gradient(135deg,#38bdf8,#0284c7)','linear-gradient(135deg,#a78bfa,#7c3aed)','linear-gradient(135deg,#34d399,#059669)','linear-gradient(135deg,#fb923c,#ea580c)']
  return grads[str.charCodeAt(0) % grads.length]
}

const badgeColor: Record<string, string> = { Bestseller: '#fbbf24', 'Top Rated': '#38bdf8', New: '#34d399', 'Eco Verified': '#4ade80' }

const icons: Record<string, string> = { 'Digital Downloads': '💾', 'Physical Goods': '📦', Templates: '📋', Courses: '🎓', Software: '⚙️', Books: '📚' }

interface Product {
  id: number | string
  title: string
  category: string
  price: number
  currency: string
  seller: string
  avatar: string
  rating: number
  reviews: number
  sales: number
  desc: string
  tags: string[]
  badge: string | null
}

export default function ProductsPage() {
  const [active, setActive] = useState('All')
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('listings')
      .select('*, seller:profiles(full_name)')
      .eq('status', 'active')
      .in('category_id', []) // will be empty unless categories seeded
      .order('created_at', { ascending: false })
      .limit(24)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const mapped: Product[] = data.map((l: Record<string, unknown>) => {
            const seller = l.seller as { full_name?: string } | null
            const name = seller?.full_name ?? 'Unknown'
            const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
            return {
              id: l.id as string,
              title: l.title as string,
              category: 'Digital Downloads',
              price: Number(l.price),
              currency: (l.currency as string) ?? '£',
              seller: name,
              avatar: initials,
              rating: 4.8,
              reviews: 0,
              sales: 0,
              desc: (l.description as string) ?? '',
              tags: (l.tags as string[]) ?? [],
              badge: null,
            }
          })
          setProducts(mapped)
        }
      })
      .catch(() => { /* keep mock */ })
  }, [])

  const filtered = active === 'All' ? products : products.filter(p => p.category === active)

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .products-hero { background: linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%); padding: 2.5rem 1.5rem 2rem; border-bottom: 1px solid rgba(56,189,248,0.08); }
        .products-inner { max-width: 1200px; margin: 0 auto; }
        .products-search-row { display: flex; gap: 0.75rem; max-width: 600px; }
        .products-catrow { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
        .products-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(270px,1fr)); gap: 1.25rem; }
        .products-content { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }

        @media (max-width: 768px) {
          .products-hero { padding: 1.5rem 1rem 1.25rem; }
          .products-search-row { flex-direction: column; }
          .products-content { padding: 1rem 1rem; }
          .products-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
          .products-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="products-hero">
        <div className="products-inner">
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Product Marketplace</h1>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Discover digital and physical products made by FreeTrust members</p>
          <div className="products-search-row">
            <input placeholder="Search products…" style={{ flex: 1, background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none' }} />
            <select style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.65rem 0.75rem', fontSize: '0.82rem', color: '#94a3b8', outline: 'none' }}>
              <option>Sort: Best Sellers</option>
              <option>Sort: Newest</option>
              <option>Sort: Price Low–High</option>
              <option>Sort: Top Rated</option>
            </select>
          </div>
        </div>
      </div>

      <div className="products-content">
        <div className="products-catrow">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActive(c)} style={{ padding: '0.4rem 1rem', borderRadius: 999, fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', border: active === c ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(148,163,184,0.2)', background: active === c ? 'rgba(56,189,248,0.1)' : 'transparent', color: active === c ? '#38bdf8' : '#94a3b8' }}>
              {icons[c] ? `${icons[c]} ` : ''}{c}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.88rem', color: '#64748b' }}>{filtered.length} products</span>
        </div>

        <div className="products-grid">
          {filtered.map(p => (
            <div key={p.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 140, background: 'linear-gradient(135deg,rgba(56,189,248,0.1),rgba(148,163,184,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', position: 'relative' }}>
                <span>{icons[p.category] || '📦'}</span>
                {p.badge && (
                  <span style={{ position: 'absolute', top: 10, right: 10, background: badgeColor[p.badge] || '#38bdf8', color: '#0f172a', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>
                    {p.badge}
                  </span>
                )}
              </div>
              <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#64748b' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#0f172a', background: avatarGrad[p.avatar] ?? getGrad(p.avatar) }}>{p.avatar}</div>
                  {p.seller}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.35 }}>{p.title}</div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>{p.desc}</p>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {p.tags.map(t => <span key={t} style={{ background: 'rgba(148,163,184,0.08)', borderRadius: 4, padding: '0.1rem 0.45rem', fontSize: '0.7rem', color: '#94a3b8' }}>{t}</span>)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  ★ {p.rating} ({p.reviews}) · {p.sales.toLocaleString()} sales
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(56,189,248,0.06)', padding: '0.75rem 1rem', marginTop: 'auto' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>{p.currency}{p.price}</span>
                <button style={{ background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Buy Now</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
