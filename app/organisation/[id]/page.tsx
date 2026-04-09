'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Org {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  logo_url: string | null
  cover_url: string | null
  location: string | null
  website: string | null
  sector: string | null
  type: string | null
  size: string | null
  founded_year: number | null
  is_verified: boolean
  members_count: number
  trust_score: number
  status: string
  tags: string[]
  sdgs: number[]
  impact_statement: string | null
  created_at: string
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function hashGradient(str: string) {
  const gradients = [
    'linear-gradient(135deg,#0ea5e9,#0369a1)',
    'linear-gradient(135deg,#7c3aed,#4c1d95)',
    'linear-gradient(135deg,#059669,#047857)',
    'linear-gradient(135deg,#db2777,#9d174d)',
    'linear-gradient(135deg,#d97706,#92400e)',
    'linear-gradient(135deg,#0284c7,#1e40af)',
  ]
  const idx = str.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % gradients.length
  return gradients[idx]
}

export default function OrganisationPage() {
  const params = useParams()
  const router = useRouter()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')

  const [org, setOrg] = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/organisations/${id}`)
      if (!res.ok) { setNotFound(true); return }
      const raw = await res.json() as Record<string, unknown>
      if (!raw?.id) { setNotFound(true); return }
      setOrg(raw as unknown as Org)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 64 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b', fontSize: 14 }}>Loading organisation…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (notFound || !org) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, gap: 16, color: '#f1f5f9' }}>
        <div style={{ fontSize: '3rem' }}>🏢</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Organisation not found</h1>
        <p style={{ color: '#64748b', margin: 0 }}>This organisation may have been removed or the link is invalid.</p>
        <button onClick={() => router.back()} style={{ color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>← Go back</button>
        <Link href="/organisations" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.85rem' }}>Browse Organisations</Link>
      </div>
    )
  }

  const gradient = hashGradient(org.name)
  const ini = initials(org.name)

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 58, paddingBottom: 80 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Cover */}
      <div style={{ position: 'relative', height: 200, background: org.cover_url ? undefined : gradient, overflow: 'hidden' }}>
        {org.cover_url && <img src={org.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: 10, padding: '6px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          ← Back
        </button>
        {/* Verified badge */}
        {org.is_verified && (
          <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(56,189,248,0.9)', color: '#0f172a', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4 }}>
            ✓ Verified
          </div>
        )}
      </div>

      {/* Header */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 1.25rem' }}>
        {/* Logo + name row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginTop: -36, marginBottom: '1rem', position: 'relative' }}>
          <div style={{ width: 72, height: 72, borderRadius: 16, flexShrink: 0, border: '3px solid #0f172a', overflow: 'hidden', background: org.logo_url ? '#1e293b' : gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
            {org.logo_url ? <img src={org.logo_url} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ini}
          </div>
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 'clamp(1.15rem,4vw,1.5rem)', fontWeight: 900, margin: 0, lineHeight: 1.2 }}>{org.name}</h1>
            </div>
            {org.tagline && <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0', lineHeight: 1.4 }}>{org.tagline}</p>}
          </div>
        </div>

        {/* Trust score + key meta */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: '1.25rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12, padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#a78bfa' }}>₮{org.trust_score}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Trust Score</div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#38bdf8' }}>{org.members_count}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Members</div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: org.status === 'active' ? '#34d399' : '#64748b' }}>
              {org.status === 'active' ? '● Active' : org.status}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Status</div>
          </div>
        </div>

        {/* Meta info */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: 14, color: '#94a3b8' }}>
            {org.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📍</span>
                <span>{org.location}</span>
              </div>
            )}
            {org.website && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔗</span>
                <a href={org.website.startsWith('http') ? org.website : `https://${org.website}`} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                  {org.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {org.sector && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🏭</span>
                <span>{org.sector}</span>
              </div>
            )}
            {org.type && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🏢</span>
                <span>{org.type}</span>
              </div>
            )}
            {org.size && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>👥</span>
                <span>{org.size}</span>
              </div>
            )}
            {org.founded_year && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📅</span>
                <span>Founded {org.founded_year}</span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {org.description && (
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', marginBottom: 8 }}>ABOUT</div>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>{org.description}</p>
          </div>
        )}

        {/* Impact statement */}
        {org.impact_statement && (
          <div style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🌍</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>IMPACT STATEMENT</div>
              <p style={{ fontSize: 14, color: '#c4b5fd', lineHeight: 1.6, margin: 0 }}>{org.impact_statement}</p>
            </div>
          </div>
        )}

        {/* Tags */}
        {org.tags && org.tags.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', marginBottom: 8 }}>TAGS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {org.tags.map(tag => (
                <span key={tag} style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 999, padding: '3px 12px', fontSize: 12, color: '#38bdf8' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SDGs */}
        {org.sdgs && org.sdgs.length > 0 && (
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', marginBottom: 8 }}>UN SUSTAINABLE DEVELOPMENT GOALS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {org.sdgs.map(n => (
                <span key={n} style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>
                  SDG {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem' }}>
          <button
            onClick={copyLink}
            style={{ flex: 1, background: '#1e293b', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 12, padding: '0.75rem', fontSize: 14, fontWeight: 600, color: copied ? '#34d399' : '#38bdf8', cursor: 'pointer' }}
          >
            {copied ? '✓ Link copied!' : '↗ Share'}
          </button>
          {org.website && (
            <a
              href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 12, padding: '0.75rem', fontSize: 14, fontWeight: 700, color: '#0f172a', cursor: 'pointer', textDecoration: 'none', textAlign: 'center', display: 'block' }}
            >
              Visit Website →
            </a>
          )}
        </div>

        {/* Back to orgs */}
        <Link href="/organisations" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
          ← All Organisations
        </Link>
      </div>
    </div>
  )
}
