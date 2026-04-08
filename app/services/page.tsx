'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
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

const MOCK_SERVICES = [
  { id: 1, title: 'Brand Identity Design', provider: 'Sarah Chen', avatar: 'SC', rating: 4.9, reviews: 127, price: 450, currency: '£', delivery: '5 days', tags: ['Logo', 'Brand', 'Figma'], category: 'Design & Creative', desc: 'Complete brand identity including logo, colour palette, typography and brand guidelines.', trust: 98, badge: 'Top Rated' },
  { id: 2, title: 'Full-Stack Web App Development', provider: 'Priya Nair', avatar: 'PN', rating: 5.0, reviews: 89, price: 2800, currency: '£', delivery: '21 days', tags: ['Next.js', 'Supabase', 'TypeScript'], category: 'Development', desc: 'End-to-end web application development using modern tech stack. From MVP to production.', trust: 100, badge: 'Verified' },
  { id: 3, title: 'SEO & Content Strategy', provider: 'Marcus Obi', avatar: 'MO', rating: 4.8, reviews: 64, price: 320, currency: '£', delivery: '7 days', tags: ['SEO', 'Content', 'Analytics'], category: 'Marketing', desc: 'Comprehensive SEO audit and content strategy to grow organic traffic by 40%+ in 90 days.', trust: 94, badge: null },
  { id: 4, title: 'Startup Business Coaching', provider: 'Tom Walsh', avatar: 'TW', rating: 4.7, reviews: 43, price: 180, currency: '£', delivery: '1 day', tags: ['Startup', 'Pitch', 'Strategy'], category: 'Coaching', desc: '4-session coaching package covering product-market fit, fundraising, and growth strategy.', trust: 91, badge: null },
  { id: 5, title: 'Impact Report & ESG Consulting', provider: 'Amara Diallo', avatar: 'AD', rating: 4.9, reviews: 38, price: 750, currency: '£', delivery: '10 days', tags: ['ESG', 'Sustainability', 'Reporting'], category: 'Consulting', desc: 'Professional ESG impact reports and sustainability strategy for SMEs and startups.', trust: 97, badge: 'Impact Verified' },
  { id: 6, title: 'UX Research & Usability Testing', provider: 'Lena Fischer', avatar: 'LF', rating: 4.8, reviews: 52, price: 600, currency: '£', delivery: '14 days', tags: ['UX', 'Research', 'Testing'], category: 'Design & Creative', desc: '10-participant usability study with full analysis, recordings, and actionable recommendations.', trust: 96, badge: null },
]

const avatarGrad: Record<string, string> = {
  SC: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  PN: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
  MO: 'linear-gradient(135deg,#34d399,#059669)',
  TW: 'linear-gradient(135deg,#fb923c,#ea580c)',
  AD: 'linear-gradient(135deg,#f472b6,#db2777)',
  LF: 'linear-gradient(135deg,#fbbf24,#d97706)',
}

function getGrad(str: string): string {
  const grads = [
    'linear-gradient(135deg,#38bdf8,#0284c7)',
    'linear-gradient(135deg,#a78bfa,#7c3aed)',
    'linear-gradient(135deg,#34d399,#059669)',
    'linear-gradient(135deg,#fb923c,#ea580c)',
    'linear-gradient(135deg,#f472b6,#db2777)',
  ]
  return grads[str.charCodeAt(0) % grads.length]
}

interface Service {
  id: number | string
  title: string
  provider: string
  avatar: string
  rating: number
  reviews: number
  price: number
  currency: string
  delivery: string
  tags: string[]
  category: string
  desc: string
  trust: number
  badge: string | null
}

export default function ServicesPage() {
  const [active, setActive] = useState(0)
  const [services, setServices] = useState<Service[]>(MOCK_SERVICES)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from('listings')
          .select('*, seller:profiles(full_name, avatar_url)')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(24)
        if (data && data.length > 0) {
          const mapped: Service[] = data.map((l: Record<string, unknown>) => {
            const seller = l.seller as { full_name?: string } | null
            const name = seller?.full_name ?? 'Unknown'
            const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
            return {
              id: l.id as string,
              title: l.title as string,
              provider: name,
              avatar: initials,
              rating: 4.8,
              reviews: 0,
              price: Number(l.price),
              currency: (l.currency as string) ?? '£',
              delivery: '7 days',
              tags: (l.tags as string[]) ?? [],
              category: 'Design & Creative',
              desc: (l.description as string) ?? '',
              trust: 90,
              badge: null,
            }
          })
          setServices(mapped)
        }
      } catch {
        /* keep mock */
      }
    })()
  }, [])

  const searchFiltered = search
    ? services.filter(s => s.title.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase()))
    : services

  const filtered = active === 0 ? searchFiltered : searchFiltered.filter(s => s.category === CATEGORIES[active].label)

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .svc-hero { background: linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%); padding: 2.5rem 1.5rem 2rem; border-bottom: 1px solid rgba(56,189,248,0.08); }
        .svc-hero-inner { max-width: 1200px; margin: 0 auto; }
        .svc-search-row { display: flex; gap: 0.75rem; margin-top: 1.25rem; max-width: 640px; }
        .svc-search-input { flex: 1; background: #1e293b; border: 1px solid rgba(56,189,248,0.2); border-radius: 8px; padding: 0.7rem 1rem; font-size: 0.95rem; color: #f1f5f9; outline: none; }
        .svc-layout { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; display: grid; grid-template-columns: 220px 1fr; gap: 2rem; align-items: start; }
        .svc-sidebar { position: sticky; top: 78px; display: flex; flex-direction: column; gap: 0.25rem; }
        .svc-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(300px,1fr)); gap: 1.25rem; }

        @media (max-width: 768px) {
          .svc-hero { padding: 1.5rem 1rem 1.25rem; }
          .svc-search-row { flex-direction: column; }
          .svc-layout { grid-template-columns: 1fr; padding: 1rem; gap: 1rem; }
          .svc-sidebar { position: static; display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.4rem; }
          .svc-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="svc-hero">
        <div className="svc-hero-inner">
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Service Marketplace</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{services.length.toLocaleString()}+ services from verified FreeTrust members</p>
          <div className="svc-search-row">
            <input className="svc-search-input" placeholder="Search services (e.g. logo design, web development…)" value={search} onChange={e => setSearch(e.target.value)} />
            <button style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Search</button>
          </div>
        </div>
      </div>

      <div className="svc-layout">
        {/* Categories */}
        <aside className="svc-sidebar">
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', padding: '0.25rem 0.75rem', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>CATEGORIES</div>
          {CATEGORIES.map((cat, i) => (
            <button key={cat.label} onClick={() => setActive(i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.75rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer', background: active === i ? 'rgba(56,189,248,0.1)' : 'none', border: active === i ? '1px solid rgba(56,189,248,0.2)' : '1px solid transparent', color: active === i ? '#38bdf8' : '#94a3b8', width: '100%', textAlign: 'left' }}>
              <span>{cat.icon} {cat.label}</span>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>{cat.count.toLocaleString()}</span>
            </button>
          ))}
        </aside>

        {/* Listings */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.88rem', color: '#64748b' }}>{filtered.length} services</div>
            <select style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 7, padding: '0.4rem 0.75rem', fontSize: '0.82rem', color: '#94a3b8', outline: 'none' }}>
              <option>Best Match</option>
              <option>Newest</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Top Rated</option>
            </select>
          </div>
          <div className="svc-grid">
            {filtered.map(svc => (
              <div key={svc.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', color: '#0f172a', background: avatarGrad[svc.avatar] ?? getGrad(svc.avatar) }}>{svc.avatar}</div>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{svc.provider}</span>
                  </div>
                  {svc.badge && <span style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#38bdf8' }}>{svc.badge}</span>}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.3, color: '#f1f5f9' }}>{svc.title}</div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>{svc.desc}</p>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {svc.tags.map(t => <span key={t} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', color: '#94a3b8' }}>{t}</span>)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <span style={{ color: '#fbbf24' }}>★ {svc.rating}</span>
                  <span style={{ color: '#475569' }}>({svc.reviews} reviews)</span>
                  <span style={{ marginLeft: 'auto', color: '#475569' }}>⏱ {svc.delivery}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                  Trust Score: {svc.trust}%
                  <div style={{ marginTop: '0.25rem', height: 3, background: 'rgba(56,189,248,0.15)', borderRadius: 2 }}>
                    <div style={{ width: `${svc.trust}%`, height: '100%', background: '#38bdf8', borderRadius: 2 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                  <div>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>{svc.currency}{svc.price.toLocaleString()}</span>
                    <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 400 }}> / project</span>
                  </div>
                  <Link href={`/services/${svc.id}`} style={{ background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>View Service</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
