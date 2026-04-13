'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'

const TYPES = ['All', 'Impact Startup', 'B Corp', 'Non-profit / NGO', 'Social Enterprise', 'Co-operative', 'Community Interest Company']

function initials(name: string) {
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
  id: string
  name: string
  slug: string
  type: string | null
  description: string | null
  location: string | null
  website: string | null
  sector: string | null
  logo_url: string | null
  cover_url: string | null
  members_count: number
  trust_score: number
  is_verified: boolean
  tags: string[] | null
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  inner: { maxWidth: 1200, margin: '0 auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem', padding: '2rem 1.5rem', maxWidth: 1200, margin: '0 auto' },
  // card is the outer <Link> — padding is 0 so the cover photo can sit
  // flush against the card border radius. overflow: hidden clips the
  // cover image's top corners to the card's rounded shape.
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s, transform 0.15s' },
  // cardBody holds the padded content — the former `card` padding +
  // flex + gap properties live here now.
  cardBody: { padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 },
  // cover is a full-bleed 96px strip at the top of each card. Uses a
  // hashGradient fallback when cover_url is null so the card always
  // has a header visual, never an empty bar.
  cover: { height: 96, width: '100%', flexShrink: 0, position: 'relative' },
}

export default function OrganisationsPage() {
  const [activeType, setActiveType] = useState('All')
  const [search, setSearch] = useState('')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/organisations?limit=100')
        if (res.ok) {
          const { organisations } = await res.json()
          setOrgs(organisations ?? [])
        }
      } catch { /* empty */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = orgs.filter(o => {
    const q = search.toLowerCase()
    const nameMatch = !q || (o.name ?? '').toLowerCase().includes(q) || (o.description ?? '').toLowerCase().includes(q) || (o.location ?? '').toLowerCase().includes(q)
    const typeMatch = activeType === 'All' || o.type === activeType
    return nameMatch && typeMatch
  })

  return (
    <div style={S.page}>
      <style>{`
        .org-card:hover { border-color: rgba(56,189,248,0.35) !important; transform: translateY(-2px); }
        @media (max-width: 640px) { .org-grid { padding: 1rem !important; gap: 0.875rem !important; } }
      `}</style>

      <div style={S.hero}>
        <div style={S.inner}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Organisations</h1>
              <p style={{ color: '#64748b' }}>Discover and connect with impact-driven organisations on FreeTrust</p>
            </div>
            <Link href="/organisations/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '0.88rem', padding: '0.6rem 1.25rem', borderRadius: 9, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              🏢 Add Organisation
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
              {loading ? 'Loading…' : `${filtered.length} org${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
            {TYPES.map(t => (
              <button key={t} onClick={() => setActiveType(t)} style={{
                padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', fontWeight: 500,
                border: activeType === t ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(148,163,184,0.2)',
                background: activeType === t ? 'rgba(56,189,248,0.1)' : 'transparent',
                color: activeType === t ? '#38bdf8' : '#94a3b8',
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="org-grid" style={S.grid}>
        {!loading && filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>
              {orgs.length === 0 ? 'No organisations yet' : 'No matches found'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {orgs.length === 0 ? 'Be the first to add your organisation.' : 'Try a different search or filter.'}
            </p>
            <Link href="/organisations/new" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.75rem 1.75rem', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
              Add Organisation
            </Link>
          </div>
        )}

        {filtered.map(org => {
          const name = org.name ?? 'Unknown'
          return (
            <Link key={org.id} href={`/organisations/${org.id}`} className="org-card" style={S.card}>
              {/* Cover photo — 96px strip with hashGradient fallback.
                  Orgs created before the cover upload feature existed
                  still get a coloured header instead of an empty bar. */}
              <div style={{ ...S.cover, background: hashGradient(name) }}>
                {org.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={org.cover_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </div>

              <div style={S.cardBody}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {org.logo_url ? (
                  <img src={org.logo_url} alt={name} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: '#0f172a' }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: hashGradient(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', flexShrink: 0 }}>
                    {initials(name)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>{name}</span>
                    {org.is_verified && <span style={{ fontSize: '13px' }} title="Verified">✅</span>}
                  </div>
                  {org.type && <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.2rem', fontWeight: 600 }}>{org.type}</div>}
                  {org.location && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>📍 {org.location}</div>}
                </div>
                {org.trust_score > 0 && (
                  <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.2rem 0.55rem', fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', flexShrink: 0 }}>
                    ₮{org.trust_score}
                  </div>
                )}
              </div>

              {/* Description */}
              {org.description && (
                <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.6, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                  {org.description}
                </p>
              )}

              {/* Tags */}
              {(org.tags ?? []).length > 0 && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {(org.tags ?? []).slice(0, 4).map(tag => (
                    <span key={tag} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', color: '#94a3b8' }}>{tag}</span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                  👥 {org.members_count ?? 0} member{(org.members_count ?? 0) !== 1 ? 's' : ''}
                  {org.sector ? ` · ${org.sector}` : ''}
                </span>
                <span style={{ background: 'transparent', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 7, padding: '0.4rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>
                  View →
                </span>
              </div>
              </div>{/* /S.cardBody */}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
