'use client'
import React, { useState } from 'react'

const categories = ['All', 'Business', 'Technology', 'Sustainability', 'Creative', 'Finance', 'Health']

const communities = [
  {
    id: 1, name: 'African Founders Network', category: 'Business', members: 512, posts: 1840,
    avatar: 'AF', desc: 'A community for founders of African heritage building global businesses. Monthly meetups, mentorship, and deal flow.',
    tags: ['Founders', 'Africa', 'Startup'], joined: false, featured: true, price: 0,
  },
  {
    id: 2, name: 'SaaS Builders Circle', category: 'Technology', members: 1240, posts: 5600,
    avatar: 'SB', desc: 'Share learnings, get feedback, and grow your SaaS business with 1,200+ founders who have been there.',
    tags: ['SaaS', 'Startups', 'Dev'], joined: true, featured: true, price: 0,
  },
  {
    id: 3, name: 'Sustainable Business Hub', category: 'Sustainability', members: 889, posts: 2900,
    avatar: 'SH', desc: 'For entrepreneurs embedding sustainability into their business model. ESG strategy, impact measurement, and green finance.',
    tags: ['ESG', 'Impact', 'Green'], joined: false, featured: false, price: 0,
  },
  {
    id: 4, name: 'Design & Brand Collective', category: 'Creative', members: 678, posts: 3400,
    avatar: 'DC', desc: 'A safe space for designers to share work, get critique, and find collaborators. Weekly design challenges.',
    tags: ['Design', 'Branding', 'Creative'], joined: false, featured: false, price: 0,
  },
  {
    id: 5, name: 'Impact Investors Forum', category: 'Finance', members: 343, posts: 1200,
    avatar: 'II', desc: 'Private community for impact investors and fund managers. Deal sharing, due diligence support, and co-investment opportunities.',
    tags: ['Investing', 'Impact', 'Finance'], joined: false, featured: true, price: 29,
  },
  {
    id: 6, name: 'Freelancer Freedom', category: 'Business', members: 2100, posts: 8900,
    avatar: 'FF', desc: 'The largest freelancer community on FreeTrust. Rates, contracts, client management, and work-life balance.',
    tags: ['Freelance', 'Remote', 'Business'], joined: true, featured: false, price: 0,
  },
  {
    id: 7, name: 'Women in Tech', category: 'Technology', members: 920, posts: 4200,
    avatar: 'WT', desc: 'Empowering women in technology through mentorship, networking and amplifying underrepresented voices in the industry.',
    tags: ['Women', 'Tech', 'Mentorship'], joined: false, featured: false, price: 0,
  },
  {
    id: 8, name: 'Mindful Founders', category: 'Health', members: 445, posts: 1800,
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
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', overflow: 'hidden' },
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
  const [activeCat, setActiveCat] = useState('All')
  const [joined, setJoined] = useState<Set<number>>(new Set(communities.filter(c => c.joined).map(c => c.id)))

  const filtered = activeCat === 'All' ? communities : communities.filter(c => c.category === activeCat)

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.inner}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Communities</h1>
          <p style={{ color: '#64748b' }}>Find your people. Join purpose-driven groups and grow with others who share your goals.</p>
          <div style={S.catRow}>
            {categories.map(c => (
              <button key={c} onClick={() => setActiveCat(c)} style={{ ...S.catBtn, ...(activeCat === c ? S.catBtnActive : {}) }}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Featured banner */}
      <div style={{ background: 'rgba(56,189,248,0.04)', borderBottom: '1px solid rgba(56,189,248,0.08)', padding: '1rem 1.5rem' }}>
        <div style={{ ...S.inner, display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>✦ Featured Communities</span>
          {communities.filter(c => c.featured).map(c => (
            <span key={c.id} style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{c.name} · {c.members.toLocaleString()} members</span>
          ))}
        </div>
      </div>

      <div style={S.grid}>
        {filtered.map(c => (
          <div key={c.id} style={S.card}>
            {c.featured && <span style={S.featuredBanner}>✦ Featured</span>}
            <div style={S.cardTop}>
              <div style={{ ...S.avatar, background: avatarGrad[c.avatar] }}>{c.avatar}</div>
              <div>
                <div style={S.cardName}>{c.name}</div>
                <div style={S.cardCat}>{c.category} {c.price > 0 ? `· £${c.price}/mo` : '· Free'}</div>
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
              <span style={S.price}>{c.price > 0 ? `£${c.price}/month` : 'Free to join'}</span>
              <button
                onClick={() => setJoined(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })}
                style={{
                  ...S.joinBtn,
                  background: joined.has(c.id) ? 'rgba(56,189,248,0.1)' : '#38bdf8',
                  color: joined.has(c.id) ? '#38bdf8' : '#0f172a',
                  border: joined.has(c.id) ? '1px solid rgba(56,189,248,0.3)' : 'none',
                }}
              >
                {joined.has(c.id) ? '✓ Joined' : 'Join Community'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
