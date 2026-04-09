'use client'
import React, { useState } from 'react'
import Link from 'next/link'

const types = ['All', 'Social Enterprise', 'NGO / Charity', 'B Corp', 'Cooperative', 'Community Interest', 'Impact Startup']

const organisations = [
  {
    id: 1, name: 'GreenPath Labs', type: 'Impact Startup', location: 'London, UK', founded: 2021,
    members: 24, avatar: 'GP', sector: 'Clean Tech',
    desc: 'Building AI tools to help businesses measure and reduce their carbon footprint in real time.',
    tags: ['CleanTech', 'AI', 'Carbon'], verified: true, hiring: true,
    impact: '14,200 tonnes CO₂ tracked',
  },
  {
    id: 2, name: 'Akiba Cooperative', type: 'Cooperative', location: 'Nairobi, Kenya', founded: 2019,
    members: 340, avatar: 'AK', sector: 'Finance',
    desc: 'Member-owned digital savings and credit cooperative serving 340+ East African entrepreneurs.',
    tags: ['Finance', 'Cooperative', 'Africa'], verified: true, hiring: false,
    impact: '€2.1M in member loans',
  },
  {
    id: 3, name: 'Open Source Seeds', type: 'NGO / Charity', location: 'Berlin, Germany', founded: 2016,
    members: 89, avatar: 'OS', sector: 'Food & Agri',
    desc: 'Protecting biodiversity by keeping seeds freely available and preventing corporate monopolisation of food crops.',
    tags: ['Seeds', 'Biodiversity', 'Open Source'], verified: true, hiring: false,
    impact: '2,300+ seed varieties freed',
  },
  {
    id: 4, name: 'Luminary Studios', type: 'B Corp', location: 'Manchester, UK', founded: 2018,
    members: 42, avatar: 'LS', sector: 'Creative',
    desc: 'A certified B Corp creative agency specialising in social impact campaigns, documentary film and brand storytelling.',
    tags: ['Creative', 'B Corp', 'Film'], verified: true, hiring: true,
    impact: '60+ impact campaigns',
  },
  {
    id: 5, name: 'Bright Futures Foundation', type: 'NGO / Charity', location: 'Lagos, Nigeria', founded: 2015,
    members: 156, avatar: 'BF', sector: 'Education',
    desc: 'Providing STEM education and coding bootcamps to underserved youth across West Africa.',
    tags: ['Education', 'STEM', 'Youth'], verified: true, hiring: true,
    impact: '12,000+ graduates',
  },
  {
    id: 6, name: 'Solara Energy CIC', type: 'Community Interest', location: 'Bristol, UK', founded: 2020,
    members: 67, avatar: 'SE', sector: 'Energy',
    desc: 'Community-owned solar energy cooperative providing affordable clean energy to low-income households in the South West.',
    tags: ['Solar', 'Community', 'Energy'], verified: false, hiring: false,
    impact: '840 homes powered',
  },
  {
    id: 7, name: 'Fairchain Collective', type: 'Social Enterprise', location: 'Amsterdam, NL', founded: 2022,
    members: 31, avatar: 'FC', sector: 'Supply Chain',
    desc: 'Using blockchain technology to bring radical transparency to global supply chains, ensuring fair pay from farm to shelf.',
    tags: ['Blockchain', 'FairTrade', 'Supply Chain'], verified: true, hiring: true,
    impact: '1,200 farmers onboarded',
  },
  {
    id: 8, name: 'Wellbeing Works', type: 'Social Enterprise', location: 'Edinburgh, UK', founded: 2017,
    members: 28, avatar: 'WW', sector: 'Health',
    desc: 'Providing mental health and wellbeing support services to founders, freelancers and remote workers.',
    tags: ['Mental Health', 'Wellbeing', 'Remote'], verified: true, hiring: false,
    impact: '5,400+ people supported',
  },
]

const avatarGrad: Record<string, string> = {
  GP: 'linear-gradient(135deg,#34d399,#059669)',
  AK: 'linear-gradient(135deg,#fbbf24,#d97706)',
  OS: 'linear-gradient(135deg,#34d399,#38bdf8)',
  LS: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
  BF: 'linear-gradient(135deg,#f472b6,#db2777)',
  SE: 'linear-gradient(135deg,#fbbf24,#34d399)',
  FC: 'linear-gradient(135deg,#38bdf8,#7c3aed)',
  WW: 'linear-gradient(135deg,#fb923c,#f472b6)',
}

const typeColor: Record<string, string> = {
  'Social Enterprise': '#38bdf8',
  'NGO / Charity': '#34d399',
  'B Corp': '#a78bfa',
  'Cooperative': '#fbbf24',
  'Community Interest': '#fb923c',
  'Impact Startup': '#f472b6',
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  inner: { maxWidth: 1200, margin: '0 auto' },
  typeRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.25rem' },
  typeBtn: { padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', fontWeight: 500 },
  typeBtnActive: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: '1.25rem', padding: '2rem 1.5rem', maxWidth: 1200, margin: '0 auto' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem' },
  avatar: { width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', flexShrink: 0 },
  orgName: { fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 },
  orgMeta: { fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  badges: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  typeBadge: { borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 },
  verifiedBadge: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#38bdf8' },
  hiringBadge: { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#34d399' },
  desc: { fontSize: '0.83rem', color: '#64748b', lineHeight: 1.6 },
  impact: { background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: '#38bdf8' },
  tags: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  tag: { background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', color: '#94a3b8' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem', marginTop: 'auto' },
  membersText: { fontSize: '0.78rem', color: '#475569' },
  viewBtn: { background: 'transparent', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 7, padding: '0.4rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', cursor: 'pointer' },
}

export default function OrganisationsPage() {
  const [activeType, setActiveType] = useState('All')

  const filtered = activeType === 'All' ? organisations : organisations.filter(o => o.type === activeType)

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.inner}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Organisation Directory</h1>
              <p style={{ color: '#64748b' }}>Discover and connect with {organisations.length * 40}+ values-aligned organisations on FreeTrust</p>
            </div>
            <Link href="/organisations/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '0.88rem', padding: '0.6rem 1.25rem', borderRadius: 9, textDecoration: 'none', whiteSpace: 'nowrap', marginTop: '0.25rem' }}>
              + Create Organisation
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', maxWidth: 500 }}>
            <input placeholder="Search organisations…" style={{ flex: 1, background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none' }} />
            <select style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.65rem 0.75rem', fontSize: '0.82rem', color: '#94a3b8', outline: 'none' }}>
              <option>All Sectors</option>
              <option>Clean Tech</option>
              <option>Finance</option>
              <option>Education</option>
              <option>Health</option>
            </select>
          </div>
          <div style={S.typeRow}>
            {types.map(t => (
              <button key={t} onClick={() => setActiveType(t)} style={{ ...S.typeBtn, ...(activeType === t ? S.typeBtnActive : {}) }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: 'rgba(56,189,248,0.03)', borderBottom: '1px solid rgba(56,189,248,0.06)', padding: '1rem 1.5rem' }}>
        <div style={{ ...S.inner, display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
          {[['340+', 'Organisations'], ['28', 'Countries'], ['60%', 'Verified'], ['2,400+', 'Members']].map(([v, l]) => (
            <div key={l}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>{v}</span>
              <span style={{ fontSize: '0.82rem', color: '#475569', marginLeft: '0.4rem' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={S.grid}>
        {filtered.map(org => (
          <div key={org.id} style={S.card}>
            <div style={S.cardTop}>
              <div style={{ ...S.avatar, background: avatarGrad[org.avatar] }}>{org.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={S.orgName}>{org.name}</div>
                <div style={S.orgMeta}>
                  <span>📍 {org.location}</span>
                  <span>· Est. {org.founded}</span>
                  <span>· {org.sector}</span>
                </div>
              </div>
            </div>
            <div style={S.badges}>
              <span style={{ ...S.typeBadge, background: `${typeColor[org.type]}15`, color: typeColor[org.type], border: `1px solid ${typeColor[org.type]}30` }}>{org.type}</span>
              {org.verified && <span style={S.verifiedBadge}>✓ Verified</span>}
              {org.hiring && <span style={S.hiringBadge}>Hiring</span>}
            </div>
            <p style={S.desc}>{org.desc}</p>
            <div style={S.impact}>🌱 Impact: {org.impact}</div>
            <div style={S.tags}>
              {org.tags.map(t => <span key={t} style={S.tag}>{t}</span>)}
            </div>
            <div style={S.footer}>
              <span style={S.membersText}>👥 {org.members} members</span>
              <Link href={`/organisation/${org.id}`} style={{ ...S.viewBtn, textDecoration: 'none', display: 'inline-block' }}>View Profile →</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
