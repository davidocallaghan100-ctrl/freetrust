'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useCurrency } from '@/context/CurrencyContext'

const categories = ['All', 'Business', 'Technology', 'Sustainability', 'Creative', 'Finance', 'Health']

const communities = [
  {
    id: 1, name: 'African Founders Network', slug: 'african-founders-network', category: 'Business', members: 512, posts: 1840,
    avatar: 'AF', desc: 'A community for founders of African heritage building global businesses. Monthly meetups, mentorship, and deal flow.',
    tags: ['Founders', 'Africa', 'Startup'], joined: false, featured: true, price: 0,
  },
  {
    id: 2, name: 'SaaS Builders Circle', slug: 'saas-builders-circle', category: 'Technology', members: 1240, posts: 5600,
    avatar: 'SB', desc: 'Share learnings, get feedback, and grow your SaaS business with 1,200+ founders who have been there.',
    tags: ['SaaS', 'Startups', 'Dev'], joined: true, featured: true, price: 0,
  },
  {
    id: 3, name: 'Sustainable Business Hub', slug: 'sustainable-business-hub', category: 'Sustainability', members: 889, posts: 2900,
    avatar: 'SH', desc: 'For entrepreneurs embedding sustainability into their business model. ESG strategy, impact measurement, and green finance.',
    tags: ['ESG', 'Impact', 'Green'], joined: false, featured: false, price: 0,
  },
  {
    id: 4, name: 'Design & Brand Collective', slug: 'design-brand-collective', category: 'Creative', members: 678, posts: 3400,
    avatar: 'DC', desc: 'A safe space for designers to share work, get critique, and find collaborators. Weekly design challenges.',
    tags: ['Design', 'Branding', 'Creative'], joined: false, featured: false, price: 0,
  },
  {
    id: 5, name: 'Impact Investors Forum', slug: 'impact-investors-forum', category: 'Finance', members: 343, posts: 1200,
    avatar: 'II', desc: 'Private community for impact investors and fund managers. Deal sharing, due diligence support, and co-investment opportunities.',
    tags: ['Investing', 'Impact', 'Finance'], joined: false, featured: true, price: 29,
  },
  {
    id: 6, name: 'Freelancer Freedom', slug: 'freelancer-freedom', category: 'Business', members: 2100, posts: 8900,
    avatar: 'FF', desc: 'The largest freelancer community on FreeTrust. Rates, contracts, client management, and work-life balance.',
    tags: ['Freelance', 'Remote', 'Business'], joined: true, featured: false, price: 0,
  },
  {
    id: 7, name: 'Women in Tech', slug: 'women-in-tech', category: 'Technology', members: 920, posts: 4200,
    avatar: 'WT', desc: 'Empowering women in technology through mentorship, networking and amplifying underrepresented voices in the industry.',
    tags: ['Women', 'Tech', 'Mentorship'], joined: false, featured: false, price: 0,
  },
  {
    id: 8, name: 'Mindful Founders', slug: 'mindful-founders', category: 'Health', members: 445, posts: 1800,
    avatar: 'MF', desc: 'Building sustainable businesses without burning out. Mental health, routines, and founder wellbeing support.',
    tags: ['Wellness', 'Founders', 'Mindfulness'], joined: false, featured: false, price: 0,
  },
]

const avatarGrad: Record<string, string> = {
  AF: 'linear-gradient(135deg,#f472b6,#db2777)',
  SB: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  SH: 'linear-gradient(135deg,#34d399,#059669)',
  DC: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
  II: 'linear-gradient(135deg,#fbbf24,#d97706)',
  FF: 'linear-gradient(135deg,#fb923c,#ea580c)',
  WT: 'linear-gradient(135deg,#f472b6,#a78bfa)',
  MF: 'linear-gradient(135deg,#34d399,#38bdf8)',
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  inner: { maxWidth: 1200, margin: '0 auto' },
  catRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.25rem' },
  catBtn: { padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', fontWeight: 500 },
  catBtnActive: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: '1.25rem', padding: '2rem 1.5rem', maxWidth: 1200, margin: '0 auto' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', overflow: 'hidden', textDecoration: 'none', color: 'inherit' },
  featuredBanner: { position: 'absolute', top: 12, right: 12, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem' },
  avatar: { width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', flexShrink: 0 },
  cardName: { fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 },
  cardCat: { fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' },
  desc: { fontSize: '0.83rem', color: '#64748b', lineHeight: 1.6 },
  tags: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  tag: { background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', color: '#94a3b8' },
  stats: { display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#475569' },
  statNum: { fontWeight: 700, color: '#94a3b8' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem' },
  price: { fontSize: '0.82rem', color: '#64748b' },
  joinBtn: { border: 'none', borderRadius: 7, padding: '0.45rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' },
}

export default function CommunityPage() {
  const { format } = useCurrency()
  const [activeCat, setActiveCat] = useState('All')
  const [search, setSearch] = useState('')
  const [joined, setJoined] = useState<Set<number>>(new Set(communities.filter(c => c.joined).map(c => c.id)))

  const filtered = communities.filter(c => {
    const catMatch = activeCat === 'All' || c.category === activeCat
    const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.desc.toLowerCase().includes(search.toLowerCase())
    return catMatch && searchMatch
  })

  return (
    <div style={S.page}>
      <style>{`
        .comm-card:hover { border-color: rgba(56,189,248,0.25) !important; transform: translateY(-1px); transition: all 0.15s; }
        .comm-card { transition: all 0.15s; }
        @media (max-width: 640px) {
          .comm-hero { padding: 1.5rem 1rem 1.25rem !important; }
          .comm-toolbar { flex-direction: column !important; align-items: flex-start !important; gap: 0.75rem !important; }
          .comm-featured-list { display: none !important; }
        }
      `}</style>
      <div className="comm-hero" style={S.hero}>
        <div style={S.inner}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Communities</h1>
              <p style={{ color: '#64748b' }}>Find your people. Join purpose-driven groups and grow with others who share your goals.</p>
            </div>
            <Link
              href="/community/new"
              style={{ background: '#38bdf8', color: '#0f172a', borderRadius: 8, padding: '0.6rem 1.25rem', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              + Create Community
            </Link>
          </div>
          <div style={S.catRow}>
            {categories.map(c => (
              <button key={c} onClick={() => setActiveCat(c)} style={{ ...S.catBtn, ...(activeCat === c ? S.catBtnActive : {}) }}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar: search + featured */}
      <div style={{ background: 'rgba(56,189,248,0.03)', borderBottom: '1px solid rgba(56,189,248,0.08)', padding: '0.85rem 1.5rem' }}>
        <div className="comm-toolbar" style={{ ...S.inner, display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '0 0 280px' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search communities..."
              style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.42rem 0.75rem 0.42rem 2rem', fontSize: '0.85rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{filtered.length} communities</span>
          <div className="comm-featured-list" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.72rem', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 999, padding: '0.2rem 0.7rem', color: '#38bdf8', fontWeight: 600 }}>✦ Featured</span>
            {communities.filter(c => c.featured).slice(0, 3).map(c => (
              <span key={c.id} style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{c.name} · {c.members.toLocaleString()} members</span>
            ))}
          </div>
        </div>
      </div>

      <div style={S.grid}>
        {filtered.map(c => (
          <Link key={c.id} href={`/community/${c.slug}`} className="comm-card" style={S.card}>
            {c.featured && <span style={S.featuredBanner}>✦ Featured</span>}
            <div style={S.cardTop}>
              <div style={{ ...S.avatar, background: avatarGrad[c.avatar] }}>{c.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.cardName}>{c.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                  <span style={S.cardCat}>{c.category}</span>
                  {c.price > 0 && (
                    <span style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700 }}>
                      🔒 {format(c.price, 'GBP')}/mo
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p style={S.desc}>{c.desc}</p>
            <div style={S.tags}>
              {c.tags.map(t => <span key={t} style={S.tag}>{t}</span>)}
            </div>
            <div style={S.stats}>
              <span><span style={S.statNum}>{c.members.toLocaleString()}</span> members</span>
              <span><span style={S.statNum}>{c.posts.toLocaleString()}</span> posts</span>
            </div>
            <div style={S.footer}>
              <span style={S.price}>{c.price > 0 ? `${format(c.price, 'GBP')}/month` : 'Free to join'}</span>
              <button
                onClick={e => { e.preventDefault(); setJoined(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n }) }}
                style={{
                  ...S.joinBtn,
                  background: joined.has(c.id) ? 'rgba(56,189,248,0.1)' : '#38bdf8',
                  color: joined.has(c.id) ? '#38bdf8' : '#0f172a',
                  border: joined.has(c.id) ? '1px solid rgba(56,189,248,0.3)' : 'none',
                }}
              >
                {joined.has(c.id) ? '✓ Joined' : c.price > 0 ? `Join ${format(c.price, 'GBP')}/mo` : 'Join Community'}
              </button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
