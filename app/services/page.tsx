'use client'
import React, { useState } from 'react'
import Link from 'next/link'

const categories = [
  { label: 'All Services', icon: '✦', count: 6241 },
  { label: 'Design & Creative', icon: '🎨', count: 842 },
  { label: 'Development', icon: '💻', count: 1203 },
  { label: 'Marketing', icon: '📣', count: 674 },
  { label: 'Consulting', icon: '🧠', count: 511 },
  { label: 'Writing & Content', icon: '✍️', count: 429 },
  { label: 'Finance', icon: '💰', count: 318 },
  { label: 'Legal', icon: '⚖️', count: 214 },
  { label: 'Coaching', icon: '🎯', count: 389 },
  { label: 'Photography', icon: '📷', count: 251 },
]

const services = [
  {
    id: 1, title: 'Brand Identity Design', provider: 'Sarah Chen', avatar: 'SC', rating: 4.9, reviews: 127,
    price: 450, currency: '£', delivery: '5 days', tags: ['Logo', 'Brand', 'Figma'], category: 'Design & Creative',
    desc: 'Complete brand identity including logo, colour palette, typography and brand guidelines.',
    trust: 98, badge: 'Top Rated',
  },
  {
    id: 2, title: 'Full-Stack Web App Development', provider: 'Priya Nair', avatar: 'PN', rating: 5.0, reviews: 89,
    price: 2800, currency: '£', delivery: '21 days', tags: ['Next.js', 'Supabase', 'TypeScript'], category: 'Development',
    desc: 'End-to-end web application development using modern tech stack. From MVP to production.',
    trust: 100, badge: 'Verified',
  },
  {
    id: 3, title: 'SEO & Content Strategy', provider: 'Marcus Obi', avatar: 'MO', rating: 4.8, reviews: 64,
    price: 320, currency: '£', delivery: '7 days', tags: ['SEO', 'Content', 'Analytics'], category: 'Marketing',
    desc: 'Comprehensive SEO audit and content strategy to grow organic traffic by 40%+ in 90 days.',
    trust: 94, badge: null,
  },
  {
    id: 4, title: 'Startup Business Coaching', provider: 'Tom Walsh', avatar: 'TW', rating: 4.7, reviews: 43,
    price: 180, currency: '£', delivery: '1 day', tags: ['Startup', 'Pitch', 'Strategy'], category: 'Coaching',
    desc: '4-session coaching package covering product-market fit, fundraising, and growth strategy.',
    trust: 91, badge: null,
  },
  {
    id: 5, title: 'Impact Report & ESG Consulting', provider: 'Amara Diallo', avatar: 'AD', rating: 4.9, reviews: 38,
    price: 750, currency: '£', delivery: '10 days', tags: ['ESG', 'Sustainability', 'Reporting'], category: 'Consulting',
    desc: 'Professional ESG impact reports and sustainability strategy for SMEs and startups.',
    trust: 97, badge: 'Impact Verified',
  },
  {
    id: 6, title: 'UX Research & Usability Testing', provider: 'Lena Fischer', avatar: 'LF', rating: 4.8, reviews: 52,
    price: 600, currency: '£', delivery: '14 days', tags: ['UX', 'Research', 'Testing'], category: 'Design & Creative',
    desc: '10-participant usability study with full analysis, recordings, and actionable recommendations.',
    trust: 96, badge: null,
  },
]

const avatarGrad: Record<string, string> = {
  SC: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  PN: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
  MO: 'linear-gradient(135deg,#34d399,#059669)',
  TW: 'linear-gradient(135deg,#fb923c,#ea580c)',
  AD: 'linear-gradient(135deg,#f472b6,#db2777)',
  LF: 'linear-gradient(135deg,#fbbf24,#d97706)',
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  heroInner: { maxWidth: 1200, margin: '0 auto' },
  h1: { fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' },
  searchRow: { display: 'flex', gap: '0.75rem', marginTop: '1.25rem', maxWidth: 640 },
  searchInput: { flex: 1, background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.7rem 1rem', fontSize: '0.95rem', color: '#f1f5f9', outline: 'none' },
  searchBtn: { background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' },
  layout: { maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '2rem', alignItems: 'start' },
  sidebar: { position: 'sticky', top: 78, display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  catBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.75rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer', background: 'none', border: 'none', color: '#94a3b8', width: '100%', textAlign: 'left' },
  catBtnActive: { background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' },
  count: { fontSize: '0.75rem', color: '#475569' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', color: '#0f172a' },
  badge: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#38bdf8' },
  cardTitle: { fontSize: '1rem', fontWeight: 700, lineHeight: 1.3, color: '#f1f5f9' },
  cardDesc: { fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 },
  tags: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  tag: { background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', color: '#94a3b8' },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem', marginTop: 'auto' },
  price: { fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' },
  priceLabel: { fontSize: '0.72rem', color: '#475569', fontWeight: 400 },
  buyBtn: { background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' },
  stars: { color: '#fbbf24', fontSize: '0.82rem' },
}

export default function ServicesPage() {
  const [active, setActive] = useState(0)

  const filtered = active === 0 ? services : services.filter(s => s.category === categories[active].label)

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>Service Marketplace</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>6,241 services from verified FreeTrust members</p>
          <div style={S.searchRow}>
            <input style={S.searchInput} placeholder="Search services (e.g. logo design, web development…)" />
            <button style={S.searchBtn}>Search</button>
          </div>
        </div>
      </div>

      <div style={S.layout}>
        {/* Categories */}
        <aside style={S.sidebar}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', padding: '0.25rem 0.75rem', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>CATEGORIES</div>
          {categories.map((cat, i) => (
            <button key={cat.label} onClick={() => setActive(i)} style={{ ...S.catBtn, ...(active === i ? S.catBtnActive : {}) }}>
              <span>{cat.icon} {cat.label}</span>
              <span style={S.count}>{cat.count.toLocaleString()}</span>
            </button>
          ))}
        </aside>

        {/* Listings */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.88rem', color: '#64748b' }}>{filtered.length} services</div>
            <select style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 7, padding: '0.4rem 0.75rem', fontSize: '0.82rem', color: '#94a3b8', outline: 'none' }}>
              <option>Best Match</option>
              <option>Newest</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Top Rated</option>
            </select>
          </div>
          <div style={S.grid}>
            {filtered.map(svc => (
              <div key={svc.id} style={S.card}>
                <div style={S.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ ...S.avatar, background: avatarGrad[svc.avatar] }}>{svc.avatar}</div>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{svc.provider}</span>
                  </div>
                  {svc.badge && <span style={S.badge}>{svc.badge}</span>}
                </div>
                <div style={S.cardTitle}>{svc.title}</div>
                <p style={S.cardDesc}>{svc.desc}</p>
                <div style={S.tags}>
                  {svc.tags.map(t => <span key={t} style={S.tag}>{t}</span>)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <span style={S.stars}>★ {svc.rating}</span>
                  <span style={{ color: '#475569' }}>({svc.reviews} reviews)</span>
                  <span style={{ marginLeft: 'auto', color: '#475569' }}>⏱ {svc.delivery}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                  Trust Score: {svc.trust}%
                  <div style={{ marginTop: '0.25rem', height: 3, background: 'rgba(56,189,248,0.15)', borderRadius: 2 }}>
                    <div style={{ width: `${svc.trust}%`, height: '100%', background: '#38bdf8', borderRadius: 2 }} />
                  </div>
                </div>
                <div style={S.cardFooter}>
                  <div>
                    <span style={S.price}>{svc.currency}{svc.price.toLocaleString()}</span>
                    <span style={S.priceLabel}> / project</span>
                  </div>
                  <button style={S.buyBtn}>View Service</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
