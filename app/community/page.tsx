'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/context/CurrencyContext'
import { createClient } from '@/lib/supabase/client'

const categories = ['All', 'Business', 'Technology', 'Sustainability', 'Creative', 'Finance', 'Health', 'Education', 'General']



interface Community {
  id: string; name: string; slug: string; category: string
  member_count: number; post_count: number; avatar_initials: string
  avatar_gradient: string; description: string; tags: string[]
  is_featured: boolean; is_paid: boolean; price_monthly: number
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 },
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

interface LeaderboardEntry {
  user_id: string
  balance: number
  full_name: string | null
  avatar_url: string | null
}

export default function CommunityPage() {
  const { format } = useCurrency()
  const router = useRouter()
  const [activeCat, setActiveCat] = useState('All')
  const [search, setSearch] = useState('')
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [joined, setJoined] = useState<Set<string>>(new Set())
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/communities')
        if (!res.ok) return
        const json = await res.json()
        if (Array.isArray(json.communities)) {
          setCommunities(json.communities)
        }
      } catch {
        // leave as empty array
      } finally {
        setLoading(false)
      }
    }
    load()

    // Fetch trust leaderboard
    async function loadLeaderboard() {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('trust_balances')
          .select('user_id, balance, profiles!user_id(full_name, avatar_url)')
          .order('balance', { ascending: false })
          .limit(10)
        if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setLeaderboard((data as any[]).map((entry: any) => {
            const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles
            return {
              user_id: entry.user_id,
              balance: entry.balance,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
            }
          }))
        }
      } catch { /* ignore */ }
    }
    loadLeaderboard()
  }, [])

  const filtered = communities.filter(c => {
    const catMatch = activeCat === 'All' || c.category === activeCat
    const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase())
    return catMatch && searchMatch
  })

  const featured = communities.filter(c => c.is_featured).slice(0, 3)

  const handleJoin = (e: React.MouseEvent, communityId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setJoined(prev => { const n = new Set(prev); n.has(communityId) ? n.delete(communityId) : n.add(communityId); return n })
  }

  const handleCardClick = (slug: string) => {
    router.push(`/community/${slug}`)
  }

  return (
    <div style={S.page}>
      <style>{`
        .comm-card:hover { border-color: rgba(56,189,248,0.25) !important; transform: translateY(-1px); transition: all 0.15s; cursor: pointer; }
        .comm-card { transition: all 0.15s; }
        @media (max-width: 640px) {
          .comm-hero { padding: 1.5rem 1rem 1.25rem !important; }
          .comm-toolbar { flex-wrap: wrap !important; gap: 0.5rem !important; }
          .comm-featured-list { display: none !important; }
          .comm-grid { padding: 1rem !important; gap: 0.875rem !important; }
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
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 360 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search communities..."
              style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.42rem 0.75rem 0.42rem 2rem', fontSize: '0.85rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {loading ? 'Loading...' : `${filtered.length} communities`}
          </span>
          <div className="comm-featured-list" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.72rem', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 999, padding: '0.2rem 0.7rem', color: '#38bdf8', fontWeight: 600 }}>✦ Featured</span>
            {featured.map(c => (
              <span key={c.id} style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{c.name} · {c.member_count.toLocaleString()} members</span>
            ))}
          </div>
        </div>
      </div>

      {/* Trust Leaderboard */}
      {leaderboard.length > 0 && (
        <div style={{ maxWidth: 1200, margin: '1.5rem auto 0', padding: '0 1.5rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.25rem 1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💎 Trust Leaderboard
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '0.75rem' }}>
              {leaderboard.map((entry, i) => (
                <div key={entry.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', background: i < 3 ? 'rgba(56,189,248,0.06)' : 'transparent', borderRadius: 10, border: i < 3 ? '1px solid rgba(56,189,248,0.15)' : '1px solid transparent' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#fb923c' : '#64748b', minWidth: 18, textAlign: 'center' }}>
                    {i + 1}
                  </span>
                  <a href={`/profile?id=${entry.user_id}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt={entry.full_name ?? ''} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#0f172a', flexShrink: 0 }}>
                      {(entry.full_name ?? '?')[0].toUpperCase()}
                    </div>
                  )}
                  </a>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.full_name ?? 'Member'}</div>
                    <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>₮{entry.balance.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="comm-grid" style={S.grid}>
        {!loading && filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>
              {communities.length === 0 ? 'No communities yet — be the first to create one!' : 'No communities match your search'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {communities.length === 0
                ? 'Create a community around your passion, profession, or purpose.'
                : 'Try a different search term or category.'}
            </p>
            {communities.length === 0 && (
              <Link href="/community/new" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.75rem 1.75rem', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
                + Create Community
              </Link>
            )}
          </div>
        )}
        {filtered.map(c => (
          <div
            key={c.id}
            className="comm-card"
            style={S.card}
            onClick={() => handleCardClick(c.slug)}
            role="link"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && handleCardClick(c.slug)}
          >
            {c.is_featured && <span style={S.featuredBanner}>✦ Featured</span>}
            <div style={S.cardTop}>
              <div style={{ ...S.avatar, background: c.avatar_gradient }}>{c.avatar_initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.cardName}>{c.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                  <span style={S.cardCat}>{c.category}</span>
                  {c.is_paid && c.price_monthly > 0 && (
                    <span style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700 }}>
                      🔒 {format(c.price_monthly, 'EUR')}/mo
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p style={S.desc}>{c.description}</p>
            <div style={S.tags}>
              {(c.tags ?? []).map(t => <span key={t} style={S.tag}>{t}</span>)}
            </div>
            <div style={S.stats}>
              <span><span style={S.statNum}>{c.member_count.toLocaleString()}</span> members</span>
              <span><span style={S.statNum}>{c.post_count.toLocaleString()}</span> posts</span>
            </div>
            <div style={S.footer}>
              <span style={S.price}>{c.is_paid && c.price_monthly > 0 ? `${format(c.price_monthly, 'EUR')}/month` : 'Free to join'}</span>
              <button
                onClick={e => handleJoin(e, c.id)}
                style={{
                  ...S.joinBtn,
                  background: joined.has(c.id) ? 'rgba(56,189,248,0.1)' : '#38bdf8',
                  color: joined.has(c.id) ? '#38bdf8' : '#0f172a',
                  border: joined.has(c.id) ? '1px solid rgba(56,189,248,0.3)' : 'none',
                }}
              >
                {joined.has(c.id) ? '✓ Joined' : c.is_paid && c.price_monthly > 0 ? `Join ${format(c.price_monthly, 'EUR')}/mo` : 'Join Community'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
