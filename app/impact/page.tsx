'use client'
import React, { useState } from 'react'

const categories = ['All Projects', 'Reforestation', 'Clean Energy', 'Ocean', 'Education', 'Food Security', 'Biodiversity']

const projects = [
  {
    id: 1, name: 'Great Rift Valley Reforestation', category: 'Reforestation', location: 'Kenya & Tanzania',
    raised: 142800, goal: 200000, currency: '£', backers: 1840, avatar: 'GR',
    desc: 'Restoring 50,000 hectares of degraded land across the Great Rift Valley through community-led tree planting and agroforestry. Providing livelihoods for 2,400 families.',
    impact: '2.1M trees planted', sdgs: [13, 15, 1], status: 'Active',
    tags: ['Trees', 'Community', 'Livelihoods'],
  },
  {
    id: 2, name: 'Solar for Schools – West Africa', category: 'Clean Energy', location: 'Ghana & Senegal',
    raised: 87400, goal: 150000, currency: '£', backers: 934, avatar: 'SS',
    desc: 'Installing solar panels in 200 schools across rural Ghana and Senegal, bringing reliable electricity for the first time and enabling night-time study for 40,000 students.',
    impact: '40,000 students benefiting', sdgs: [4, 7, 10], status: 'Active',
    tags: ['Solar', 'Education', 'Africa'],
  },
  {
    id: 3, name: 'Pacific Plastic Clean-Up Initiative', category: 'Ocean', location: 'Pacific Ocean',
    raised: 203000, goal: 250000, currency: '£', backers: 3200, avatar: 'PC',
    desc: 'Deploying a fleet of autonomous vessels to collect and recycle microplastics from the North Pacific Gyre. Partnering with 12 coastal communities for sustainable fishing support.',
    impact: '84 tonnes plastic removed', sdgs: [14, 12, 17], status: 'Active',
    tags: ['Ocean', 'Plastic', 'Marine'],
  },
  {
    id: 4, name: 'Seed Libraries Network', category: 'Biodiversity', location: 'Global',
    raised: 41200, goal: 60000, currency: '£', backers: 567, avatar: 'SL',
    desc: 'Building a global network of open-source seed libraries to preserve heirloom varieties threatened by industrial agriculture and climate change.',
    impact: '2,300 varieties preserved', sdgs: [2, 15, 17], status: 'Active',
    tags: ['Seeds', 'Biodiversity', 'Food'],
  },
  {
    id: 5, name: 'Clean Cookstoves for East Africa', category: 'Food Security', location: 'Uganda & Rwanda',
    raised: 56700, goal: 80000, currency: '£', backers: 721, avatar: 'CC',
    desc: 'Distributing efficient biomass cookstoves to rural households, reducing indoor air pollution, cutting fuel costs by 60%, and reducing deforestation pressure.',
    impact: '12,000 households reached', sdgs: [3, 7, 13], status: 'Active',
    tags: ['Cookstoves', 'Health', 'Energy'],
  },
  {
    id: 6, name: 'Mangrove Restoration Bangladesh', category: 'Ocean', location: 'Cox\'s Bazar, Bangladesh',
    raised: 98000, goal: 120000, currency: '£', backers: 1100, avatar: 'MR',
    desc: 'Restoring 8,000 hectares of mangrove forest to protect coastal communities from flooding, provide fish nurseries, and sequester carbon.',
    impact: '8,000 ha under restoration', sdgs: [13, 14, 15], status: 'Active',
    tags: ['Mangroves', 'Coastal', 'Carbon'],
  },
]

const avatarGrad: Record<string, string> = {
  GR: 'linear-gradient(135deg,#34d399,#059669)',
  SS: 'linear-gradient(135deg,#fbbf24,#d97706)',
  PC: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  SL: 'linear-gradient(135deg,#34d399,#38bdf8)',
  CC: 'linear-gradient(135deg,#fb923c,#ea580c)',
  MR: 'linear-gradient(135deg,#38bdf8,#34d399)',
}

const sdgColors: Record<number, string> = {
  1: '#e5243b', 2: '#dda63a', 3: '#4c9f38', 4: '#c5192d', 7: '#fcc30b',
  10: '#dd1367', 12: '#bf8b2e', 13: '#3f7e44', 14: '#0a97d9', 15: '#56c02b', 17: '#19486a',
}

const sdgNames: Record<number, string> = {
  1: 'No Poverty', 2: 'Zero Hunger', 3: 'Good Health', 4: 'Quality Education',
  7: 'Clean Energy', 10: 'Reduced Inequalities', 12: 'Responsible Consumption',
  13: 'Climate Action', 14: 'Life Below Water', 15: 'Life on Land', 17: 'Partnerships',
}

const globalStats = [
  { value: '£1.24M', label: 'Total Funded', icon: '💰' },
  { value: '12,400', label: 'Contributors', icon: '👥' },
  { value: '28', label: 'Active Projects', icon: '🌍' },
  { value: '14', label: 'SDGs Supported', icon: '🎯' },
]

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.08) 0%,rgba(52,211,153,0.04) 60%,transparent 100%)', padding: '3rem 1.5rem 2.5rem', borderBottom: '1px solid rgba(56,189,248,0.08)', textAlign: 'center' },
  heroInner: { maxWidth: 700, margin: '0 auto' },
  badge: { display: 'inline-block', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.78rem', color: '#34d399', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '1rem' },
  h1: { fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.75rem', lineHeight: 1.15 },
  subtitle: { color: '#64748b', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.6 },
  statsRow: { display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' },
  statCard: { background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12, padding: '1rem 1.5rem', textAlign: 'center', minWidth: 130 },
  statVal: { fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', display: 'block' },
  statLabel: { fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' },
  inner: { maxWidth: 1200, margin: '0 auto' },
  catRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '1.5rem 1.5rem 0' },
  catBtn: { padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', fontWeight: 500 },
  catBtnActive: { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', fontWeight: 700 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: '1.25rem', padding: '1.5rem', maxWidth: 1200, margin: '0 auto' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  cardTop: { padding: '1.25rem', flex: 1 },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' },
  avatar: { width: 48, height: 48, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#0f172a', flexShrink: 0 },
  cardName: { fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.25 },
  cardLoc: { fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' },
  impactBadge: { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#34d399', marginBottom: '0.75rem' },
  desc: { fontSize: '0.83rem', color: '#64748b', lineHeight: 1.6, marginBottom: '0.75rem' },
  sdgRow: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  sdgBadge: { borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, color: '#fff' },
  progressSection: { background: 'rgba(15,23,42,0.5)', borderTop: '1px solid rgba(56,189,248,0.06)', padding: '1rem 1.25rem' },
  progressBar: { height: 6, background: 'rgba(56,189,248,0.1)', borderRadius: 3, overflow: 'hidden', marginTop: '0.5rem', marginBottom: '0.5rem' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg,#34d399,#38bdf8)', borderRadius: 3, transition: 'width 0.5s ease' },
  progressMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' },
  raised: { fontWeight: 700, color: '#38bdf8' },
  goal: { color: '#475569' },
  fundBtn: { background: '#34d399', border: 'none', borderRadius: 7, padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' },
  tags: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  tag: { background: 'rgba(148,163,184,0.08)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', color: '#94a3b8' },
}

export default function ImpactPage() {
  const [activeCat, setActiveCat] = useState('All Projects')
  const [funded, setFunded] = useState<Set<number>>(new Set())

  const filtered = activeCat === 'All Projects' ? projects : projects.filter(p => p.category === activeCat)

  return (
    <div style={S.page}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={S.heroInner}>
          <div style={S.badge}>🌱 SUSTAINABILITY FUND</div>
          <h1 style={S.h1}>Invest in a <span style={{ color: '#34d399' }}>Better World</span></h1>
          <p style={S.subtitle}>Every transaction on FreeTrust contributes 1% to our Impact Fund. Together, we are funding real-world sustainability projects across the globe.</p>
          <div style={S.statsRow}>
            {globalStats.map(s => (
              <div key={s.label} style={S.statCard}>
                <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
                <span style={S.statVal}>{s.value}</span>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button style={{ background: '#34d399', border: 'none', borderRadius: 8, padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Donate Directly</button>
            <button style={{ background: 'transparent', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 8, padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: 600, color: '#34d399', cursor: 'pointer' }}>How It Works</button>
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ ...S.inner }}>
        <div style={S.catRow}>
          {categories.map(c => (
            <button key={c} onClick={() => setActiveCat(c)} style={{ ...S.catBtn, ...(activeCat === c ? S.catBtnActive : {}) }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={S.grid}>
        {filtered.map(proj => {
          const pct = Math.round((proj.raised / proj.goal) * 100)
          const isFunded = funded.has(proj.id)
          return (
            <div key={proj.id} style={S.card}>
              <div style={S.cardTop}>
                <div style={S.cardHeader}>
                  <div style={{ ...S.avatar, background: avatarGrad[proj.avatar] }}>{proj.avatar}</div>
                  <div>
                    <div style={S.cardName}>{proj.name}</div>
                    <div style={S.cardLoc}>📍 {proj.location} · {proj.category}</div>
                  </div>
                </div>
                <div style={S.impactBadge}>🌱 {proj.impact}</div>
                <p style={S.desc}>{proj.desc}</p>
                <div style={S.sdgRow}>
                  {proj.sdgs.map(n => (
                    <span key={n} style={{ ...S.sdgBadge, background: sdgColors[n] }} title={sdgNames[n]}>SDG {n}</span>
                  ))}
                </div>
                <div style={S.tags}>
                  {proj.tags.map(t => <span key={t} style={S.tag}>{t}</span>)}
                </div>
              </div>
              <div style={S.progressSection}>
                <div style={S.progressMeta}>
                  <span style={S.raised}>{proj.currency}{proj.raised.toLocaleString()} raised</span>
                  <span style={S.goal}>of {proj.currency}{proj.goal.toLocaleString()} · {pct}%</span>
                </div>
                <div style={S.progressBar}>
                  <div style={{ ...S.progressFill, width: `${pct}%` }} />
                </div>
                <div style={{ ...S.progressMeta, marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#475569' }}>👥 {proj.backers.toLocaleString()} backers</span>
                  <button
                    onClick={() => setFunded(prev => { const n = new Set(prev); n.has(proj.id) ? n.delete(proj.id) : n.add(proj.id); return n })}
                    style={{
                      ...S.fundBtn,
                      background: isFunded ? 'rgba(52,211,153,0.15)' : '#34d399',
                      color: isFunded ? '#34d399' : '#0f172a',
                      border: isFunded ? '1px solid rgba(52,211,153,0.3)' : 'none',
                    }}
                  >
                    {isFunded ? '✓ Funded' : 'Fund Project'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom CTA */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.06),rgba(56,189,248,0.06))', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 16, padding: '3rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>Every purchase drives change</h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: 500, margin: '0 auto 1.5rem' }}>1% of every FreeTrust transaction is automatically allocated to impact projects you believe in.</p>
          <button style={{ background: 'linear-gradient(135deg,#34d399,#38bdf8)', border: 'none', borderRadius: 8, padding: '0.8rem 2rem', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Start Shopping with Purpose</button>
        </div>
      </div>
    </div>
  )
}
