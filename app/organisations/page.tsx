'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const TYPES = ['All', 'Social Enterprise', 'NGO / Charity', 'B Corp', 'Cooperative', 'Community Interest', 'Impact Startup']

const typeColor: Record<string, string> = {
  'Social Enterprise': '#38bdf8',
  'NGO / Charity': '#34d399',
  'B Corp': '#a78bfa',
  'Cooperative': '#fbbf24',
  'Community Interest': '#fb923c',
  'Impact Startup': '#f472b6',
}

function orgInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function hashGradient(name: string) {
  const gradients = [
    'linear-gradient(135deg,#34d399,#059669)',
    'linear-gradient(135deg,#38bdf8,#0284c7)',
    'linear-gradient(135deg,#a78bfa,#7c3aed)',
    'linear-gradient(135deg,#fbbf24,#d97706)',
    'linear-gradient(135deg,#f472b6,#db2777)',
    'linear-gradient(135deg,#fb923c,#ea580c)',
  ]
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % gradients.length
  return gradients[idx]
}

interface Org {
  id: string; name: string; type: string; location: string | null
  members_count: number; logo_url: string | null; sector: string | null
  description: string; tags: string[]; is_verified: boolean
  impact_statement: string | null; slug: string | null
}

const MOCK_ORGS: Org[] = [
  { id: '1', name: 'GreenPath Labs', type: 'Impact Startup', location: 'London, UK', members_count: 24, logo_url: null, sector: 'Clean Tech', description: 'Building AI tools to help businesses measure and reduce their carbon footprint in real time.', tags: ['CleanTech', 'AI', 'Carbon'], is_verified: true, impact_statement: '14,200 tonnes CO₂ tracked', slug: null },
  { id: '2', name: 'Akiba Cooperative', type: 'Cooperative', location: 'Nairobi, Kenya', members_count: 340, logo_url: null, sector: 'Finance', description: 'Member-owned digital savings and credit cooperative serving 340+ East African entrepreneurs.', tags: ['Finance', 'Cooperative', 'Africa'], is_verified: true, impact_statement: '€2.1M in member loans', slug: null },
  { id: '3', name: 'Open Source Seeds', type: 'NGO / Charity', location: 'Berlin, Germany', members_count: 89, logo_url: null, sector: 'Food & Agri', description: 'Protecting biodiversity by keeping seeds freely available and preventing corporate monopolisation of food crops.', tags: ['Seeds', 'Biodiversity', 'Open Source'], is_verified: true, impact_statement: '2,300+ seed varieties freed', slug: null },
  { id: '4', name: 'Luminary Studios', type: 'B Corp', location: 'Manchester, UK', members_count: 42, logo_url: null, sector: 'Creative', description: 'A certified B Corp creative agency specialising in social impact campaigns, documentary film and brand storytelling.', tags: ['Creative', 'B Corp', 'Film'], is_verified: true, impact_statement: '60+ impact campaigns', slug: null },
  { id: '5', name: 'Bright Futures Foundation', type: 'NGO / Charity', location: 'Lagos, Nigeria', members_count: 156, logo_url: null, sector: 'Education', description: 'Providing STEM education and coding bootcamps to underserved youth across West Africa.', tags: ['Education', 'STEM', 'Youth'], is_verified: true, impact_statement: '12,000+ graduates', slug: null },
  { id: '6', name: 'Solara Energy CIC', type: 'Community Interest', location: 'Bristol, UK', members_count: 67, logo_url: null, sector: 'Energy', description: 'Community-owned solar energy cooperative providing affordable clean energy to low-income households in the South West.', tags: ['Solar', 'Community', 'Energy'], is_verified: false, impact_statement: '840 homes powered', slug: null },
]

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 104 },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  inner: { maxWidth: 1200, margin: '0 auto' },
  typeRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.25rem' },
  typeBtn: { padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', fontWeight: 500 },
  typeBtnActive: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: '1.25rem', padding: '2rem 1.5rem', maxWidth: 1200, margin: '0 auto' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'border-color 0.15s, transform 0.15s', cursor: 'pointer' },
}

export default function OrganisationsPage() {
  const router = useRouter()
  const [activeType, setActiveType] = useState('All')
  const [search, setSearch] = useState('')
  const [orgs, setOrgs] = useState<Org[]>(MOCK_ORGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/organisations')
        if (!res.ok) return
        const json = await res.json()
        if (Array.isArray(json.organisations) && json.organisations.length > 0) {
          setOrgs(json.organisations)
        }
      } catch { /* keep mock */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = orgs.filter(o => {
    const typeMatch = activeType === 'All' || o.type === activeType
    const searchMatch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || (o.description ?? '').toLowerCase().includes(search.toLowerCase())
    return typeMatch && searchMatch
  })

  return (
    <div style={S.page}>
      <style>{`
        .org-card:hover { border-color: rgba(56,189,248,0.3) !important; transform: translateY(-2px); }
        @media (max-width: 640px) { .org-grid { padding: 1rem !important; gap: 0.875rem !important; } }
      `}</style>
      <div style={S.hero}>
        <div style={S.inner}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Organisation Directory</h1>
              <p style={{ color: '#64748b' }}>Discover and connect with values-aligned organisations on FreeTrust</p>
            </div>
            <Link href="/organisations/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '0.88rem', padding: '0.6rem 1.25rem', borderRadius: 9, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              + Add Organisation
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', maxWidth: 500, flexWrap: 'wrap' }}>
            <input
              placeholder="Search organisations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none' }}
            />
            <span style={{ fontSize: '0.82rem', color: '#64748b', alignSelf: 'center' }}>
              {loading ? 'Loading…' : `${filtered.length} found`}
            </span>
          </div>
          <div style={S.typeRow}>
            {TYPES.map(t => (
              <button key={t} onClick={() => setActiveType(t)} style={{ ...S.typeBtn, ...(activeType === t ? S.typeBtnActive : {}) }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="org-grid" style={S.grid}>
        {filtered.map(org => {
          const color = typeColor[org.type] ?? '#38bdf8'
          const href = `/organisation/${org.slug ?? org.id}`
          return (
            <div
              key={org.id}
              className="org-card"
              style={S.card}
              onClick={() => router.push(href)}
              role="link"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && router.push(href)}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {org.logo_url ? (
                  <img src={org.logo_url} alt={org.name} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: hashGradient(org.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', flexShrink: 0 }}>
                    {orgInitials(org.name)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>{org.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {org.location && <span>📍 {org.location}</span>}
                    {org.sector && <span>· {org.sector}</span>}
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ background: `${color}18`, color, border: `1px solid ${color}30`, borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>{org.type}</span>
                {org.is_verified && <span style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#38bdf8' }}>✓ Verified</span>}
              </div>

              <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>{org.description}</p>

              {org.impact_statement && (
                <div style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: '#38bdf8' }}>
                  🌱 {org.impact_statement}
                </div>
              )}

              {(org.tags ?? []).length > 0 && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {(org.tags ?? []).slice(0, 4).map(t => (
                    <span key={t} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', color: '#94a3b8' }}>{t}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                <span style={{ fontSize: '0.78rem', color: '#475569' }}>👥 {org.members_count ?? 0} members</span>
                <span style={{ background: 'transparent', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 7, padding: '0.4rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>View Profile →</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
