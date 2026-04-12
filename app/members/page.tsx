'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const CATEGORIES = ['All', 'Freelancers', 'Businesses', 'Developers', 'Designers', 'Marketers', 'Consultants']

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

interface Member {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  skills: string[] | null
  account_type: string | null
  trust_balance: number
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  inner: { maxWidth: 1200, margin: '0 auto' },
  // minmax(min(100%, 280px), 1fr) — the inner min() allows the column to
  // shrink below 280px on narrow phones (iPhone SE is 320px wide, and after
  // the 1rem mobile padding the grid only has 288px of space). Without this,
  // a flat minmax(300px, 1fr) forces a 300px column that overflows the
  // container, which on mobile Safari causes horizontal scroll and can clip
  // newly-inserted rows at the top of the grid off-screen.
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.25rem', padding: '2rem 1.5rem', maxWidth: 1200, margin: '0 auto' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'border-color 0.15s, transform 0.15s', cursor: 'default' },
}

const PAGE_SIZE = 24

export default function MemberDirectoryPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Fetch directory with aggressive cache-busting. Uses `cache: 'no-store'`
  // AND a per-request timestamp query param so mobile Safari (which
  // ignores Cache-Control on some requests) still gets a fresh response.
  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true)
    try {
      const res = await fetch(`/api/directory/members?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      })
      if (res.ok) {
        const { members: data } = await res.json()
        setMembers((data ?? []).map((p: {
          id: string; full_name: string | null; avatar_url: string | null
          bio: string | null; location: string | null; trust_balance: number
        }) => ({
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          location: p.location,
          skills: [],
          account_type: 'individual',
          trust_balance: p.trust_balance ?? 0,
        })))
      }
    } catch { /* empty */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load('initial') }, [load])

  const categoryMatch = (member: Member, cat: string): boolean => {
    if (cat === 'All') return true
    const bio = (member.bio ?? '').toLowerCase()
    if (cat === 'Freelancers') return bio.includes('freelance')
    if (cat === 'Businesses') return bio.includes('business') || bio.includes('company')
    if (cat === 'Developers') return bio.includes('developer') || bio.includes('engineer')
    if (cat === 'Designers') return bio.includes('designer') || bio.includes('design')
    if (cat === 'Marketers') return bio.includes('market')
    if (cat === 'Consultants') return bio.includes('consult')
    return true
  }

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    const nameMatch = !q || (m.full_name ?? '').toLowerCase().includes(q) || (m.bio ?? '').toLowerCase().includes(q) || (m.location ?? '').toLowerCase().includes(q)
    return categoryMatch(m, activeCategory) && nameMatch
  })

  // Reset pagination whenever the filter changes
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [search, activeCategory])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visible.length < filtered.length

  return (
    <div style={S.page}>
      <style>{`
        .member-card:hover { border-color: rgba(56,189,248,0.3) !important; transform: translateY(-2px); }
        @media (max-width: 640px) { .member-grid { padding: 1rem !important; gap: 0.875rem !important; } }
      `}</style>
      <div style={S.hero}>
        <div style={S.inner}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Member Directory</h1>
              <p style={{ color: '#64748b' }}>Connect with trusted founding members of the FreeTrust community</p>
            </div>
            <Link href="/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '0.88rem', padding: '0.6rem 1.25rem', borderRadius: 9, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              👤 Your Profile
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', maxWidth: 500, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="Search members…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none' }}
            />
            <button
              type="button"
              onClick={() => load('refresh')}
              disabled={refreshing || loading}
              aria-label="Refresh members list"
              title="Refresh members list"
              style={{
                background: 'rgba(56,189,248,0.1)',
                border: '1px solid rgba(56,189,248,0.25)',
                borderRadius: 8,
                padding: '0.65rem 0.85rem',
                fontSize: '0.9rem',
                color: '#38bdf8',
                cursor: (refreshing || loading) ? 'wait' : 'pointer',
                minHeight: 44,
                minWidth: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'inherit',
                opacity: (refreshing || loading) ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: refreshing ? 'transform 0.8s linear' : 'none' }}>
                ↻
              </span>
            </button>
            <span style={{ fontSize: '0.82rem', color: '#64748b', alignSelf: 'center' }}>
              {loading ? 'Loading…' : `${filtered.length} members`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
            {CATEGORIES.map(t => (
              <button key={t} onClick={() => setActiveCategory(t)} style={{
                padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', fontWeight: 500,
                border: activeCategory === t ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(148,163,184,0.2)',
                background: activeCategory === t ? 'rgba(56,189,248,0.1)' : 'transparent',
                color: activeCategory === t ? '#38bdf8' : '#94a3b8',
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="member-grid" style={S.grid}>
        {!loading && filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>
              {members.length === 0 ? 'Be the first founding member to complete your profile' : 'No members match your search'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {members.length === 0 ? 'Complete your profile and you\'ll appear here.' : 'Try a different search or category.'}
            </p>
            {members.length === 0 && (
              <Link href="/profile" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.75rem 1.75rem', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
                Complete My Profile
              </Link>
            )}
          </div>
        )}

        {visible.map(member => {
          const name = member.full_name ?? 'Anonymous'
          return (
            <Link key={member.id} href={`/profile?id=${member.id}`} className="member-card" style={S.card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt={name} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: hashGradient(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', flexShrink: 0 }}>
                    {initials(name)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>{name}</div>
                  {member.location && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>📍 {member.location}</div>}
                </div>
                <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.2rem 0.55rem', fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', flexShrink: 0 }}>
                  ₮{member.trust_balance}
                </div>
              </div>
              {member.bio && (
                <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.6, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                  {member.bio}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                <span style={{ fontSize: '0.75rem', color: '#475569' }}>👤 Individual</span>
                <span style={{ background: 'transparent', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 7, padding: '0.4rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>
                  View Profile →
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', padding: '0 1.5rem 2rem' }}>
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 10, padding: '0.75rem 2rem', color: '#38bdf8', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' }}
          >
            Load more ({filtered.length - visible.length} remaining)
          </button>
        </div>
      )}
      {/*
        Mobile bottom spacer — the BottomNav component is position:fixed at
        bottom:0 with height 64px + safe-area-inset-bottom, and is only
        visible below 768px (matches BottomNav.tsx). globals.css already
        reserves 72px via .ft-page-content padding-bottom, but that value
        does NOT include env(safe-area-inset-bottom), so on phones with a
        home indicator the last row of cards was being clipped by ~34px.
        Add just enough extra room to clear the home indicator on mobile.
      */}
      <div aria-hidden className="member-mobile-spacer" style={{ height: 0 }} />
      <style>{`
        @media (max-width: 767px) {
          .member-mobile-spacer { height: env(safe-area-inset-bottom, 0px) !important; }
        }
      `}</style>
    </div>
  )
}
