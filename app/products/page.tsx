'use client'
import React, { useState } from 'react'

const categories = ['All', 'Digital Downloads', 'Physical Goods', 'Templates', 'Courses', 'Software', 'Books']

const products = [
  {
    id: 1, title: 'Figma Component Library Pro', category: 'Digital Downloads', price: 49, currency: '£',
    seller: 'Sarah Chen', avatar: 'SC', rating: 4.9, reviews: 312, sales: 1840,
    desc: '850+ production-ready Figma components with auto-layout, variants, and dark mode.',
    tags: ['Figma', 'UI Kit', 'Design System'], badge: 'Bestseller',
  },
  {
    id: 2, title: 'Next.js SaaS Boilerplate', category: 'Templates', price: 129, currency: '£',
    seller: 'Priya Nair', avatar: 'PN', rating: 5.0, reviews: 89, sales: 420,
    desc: 'Production-ready Next.js 14 starter with auth, billing, dashboard and Supabase integration.',
    tags: ['Next.js', 'TypeScript', 'Supabase'], badge: 'Top Rated',
  },
  {
    id: 3, title: 'Impact Business Handbook', category: 'Books', price: 24, currency: '£',
    seller: 'Amara Diallo', avatar: 'AD', rating: 4.8, reviews: 156, sales: 2300,
    desc: 'A practical guide to building a purpose-driven business that delivers profit and positive impact.',
    tags: ['Business', 'Sustainability', 'Strategy'], badge: null,
  },
  {
    id: 4, title: 'SEO Audit Spreadsheet Kit', category: 'Templates', price: 19, currency: '£',
    seller: 'Marcus Obi', avatar: 'MO', rating: 4.7, reviews: 203, sales: 3100,
    desc: '14 interconnected spreadsheets covering technical SEO, content gaps, backlink analysis and reporting.',
    tags: ['SEO', 'Spreadsheet', 'Marketing'], badge: null,
  },
  {
    id: 5, title: 'Mindful Leadership Course', category: 'Courses', price: 89, currency: '£',
    seller: 'Tom Walsh', avatar: 'TW', rating: 4.9, reviews: 67, sales: 580,
    desc: '8-week self-paced course on conscious leadership, team culture and sustainable growth.',
    tags: ['Leadership', 'Course', 'Self-paced'], badge: 'New',
  },
  {
    id: 6, title: 'Handmade Ceramic Mug Set', category: 'Physical Goods', price: 65, currency: '£',
    seller: 'Lena Fischer', avatar: 'LF', rating: 4.9, reviews: 44, sales: 290,
    desc: 'Set of 4 hand-thrown ceramic mugs, each unique. Sustainably fired in a wood kiln. Ships worldwide.',
    tags: ['Handmade', 'Ceramic', 'Sustainable'], badge: 'Eco Verified',
  },
  {
    id: 7, title: 'Startup Financial Model', category: 'Templates', price: 35, currency: '£',
    seller: 'James Okafor', avatar: 'JO', rating: 4.8, reviews: 128, sales: 960,
    desc: '5-year financial model for SaaS startups. Includes revenue, burn rate, runway and investor dashboards.',
    tags: ['Finance', 'Excel', 'Startup'], badge: null,
  },
  {
    id: 8, title: 'Social Media Content Calendar', category: 'Templates', price: 15, currency: '£',
    seller: 'Yuki Tanaka', avatar: 'YT', rating: 4.6, reviews: 445, sales: 6200,
    desc: '52-week content calendar with 300+ prompts, hooks, and post templates for all major platforms.',
    tags: ['Social Media', 'Content', 'Notion'], badge: 'Bestseller',
  },
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

const badgeColor: Record<string, string> = {
  Bestseller: '#fbbf24',
  'Top Rated': '#38bdf8',
  New: '#34d399',
  'Eco Verified': '#4ade80',
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  inner: { maxWidth: 1200, margin: '0 auto' },
  catRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' },
  catBtn: { padding: '0.4rem 1rem', borderRadius: 999, fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8' },
  catBtnActive: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: '1.25rem' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  cardImg: { height: 160, background: 'linear-gradient(135deg,rgba(56,189,248,0.1),rgba(148,163,184,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', position: 'relative' },
  cardBody: { padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.35 },
  cardDesc: { fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 },
  seller: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#64748b' },
  sellerAvatar: { width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#0f172a' },
  tags: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap' },
  tag: { background: 'rgba(148,163,184,0.08)', borderRadius: 4, padding: '0.1rem 0.45rem', fontSize: '0.7rem', color: '#94a3b8' },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(56,189,248,0.06)', padding: '0.75rem 1rem', marginTop: 'auto' },
  price: { fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' },
  addBtn: { background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' },
}

export default function ProductsPage() {
  const [active, setActive] = useState('All')

  const filtered = active === 'All' ? products : products.filter(p => p.category === active)

  const icons: Record<string, string> = {
    'Digital Downloads': '💾', 'Physical Goods': '📦', Templates: '📋', Courses: '🎓', Software: '⚙️', Books: '📚',
  }

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.inner}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Product Marketplace</h1>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Discover digital and physical products made by FreeTrust members</p>
          <div style={{ display: 'flex', gap: '0.75rem', maxWidth: 600, marginBottom: '0' }}>
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

      <div style={{ ...S.inner, padding: '2rem 1.5rem' }}>
        <div style={S.catRow}>
          {categories.map(c => (
            <button key={c} onClick={() => setActive(c)} style={{ ...S.catBtn, ...(active === c ? S.catBtnActive : {}) }}>
              {icons[c] ? `${icons[c]} ` : ''}{c}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.88rem', color: '#64748b' }}>{filtered.length} products</span>
        </div>

        <div style={S.grid}>
          {filtered.map(p => (
            <div key={p.id} style={S.card}>
              <div style={S.cardImg}>
                <span>{icons[p.category] || '📦'}</span>
                {p.badge && (
                  <span style={{ position: 'absolute', top: 10, right: 10, background: badgeColor[p.badge] || '#38bdf8', color: '#0f172a', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>
                    {p.badge}
                  </span>
                )}
              </div>
              <div style={S.cardBody}>
                <div style={S.seller}>
                  <div style={{ ...S.sellerAvatar, background: avatarGrad[p.avatar] }}>{p.avatar}</div>
                  {p.seller}
                </div>
                <div style={S.cardTitle}>{p.title}</div>
                <p style={S.cardDesc}>{p.desc}</p>
                <div style={S.tags}>
                  {p.tags.map(t => <span key={t} style={S.tag}>{t}</span>)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  ★ {p.rating} ({p.reviews}) · {p.sales.toLocaleString()} sales
                </div>
              </div>
              <div style={S.cardFooter}>
                <span style={S.price}>{p.currency}{p.price}</span>
                <button style={S.addBtn}>Buy Now</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
