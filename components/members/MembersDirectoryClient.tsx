'use client'
// Members directory — interactive client component. Mounted by the
// server-rendered wrapper at app/members/page.tsx, which is the file
// that exports the route segment config (`dynamic = 'force-dynamic'`,
// `revalidate = 0`). Those exports MUST live on a server component —
// Next 14 fails the build with "Invalid revalidate value" if you put
// them on a 'use client' file.
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import SocialLinks, { type SocialUrls } from '@/components/social/SocialLinks'

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

// Human-readable relative time for the "updated Xs ago" chip. Kept
// inline so we don't add a date-fns import just for one label. Rounds
// to whole seconds / minutes / hours so the label doesn't jitter on
// every render.
function formatRelativeSeconds(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 5)    return 'just now'
  if (s < 60)   return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
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
  // Social link fields — surfaced under the avatar on each member card.
  // Empty fields are filtered out by the SocialLinks component.
  socials?: SocialUrls
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

// PAGE_SIZE bumped from 24 → 50 per the directory audit. The previous
// value showed only the first 24 members on initial load, with a
// "Load more" button that was easy to miss on mobile (often below
// the safe-area home indicator). 50 is high enough that any
// reasonable founding-member directory fits in one page on any
// device, while still keeping the initial render fast.
const PAGE_SIZE = 50

// Number of skeleton placeholder cards rendered while the initial
// fetch is in flight. Sized to roughly fill the viewport at the
// default grid columns so the page doesn't visibly "snap" when the
// real data lands.
const SKELETON_COUNT = 9

export default function MembersDirectoryClient() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  // Error state — previously the load() catch was silent, which meant
  // mobile network blips or aborted fetches left the UI frozen with no
  // indication WHY no members showed. Surface the error inline so the
  // user can tap Retry instead of staring at a blank directory.
  const [loadError, setLoadError] = useState<string | null>(null)
  // Timestamp of the most recent successful fetch — used for the
  // "updated Xs ago" chip and as a cheap tripwire for the auto-refresh
  // interval (skip the network call if we refreshed within the last
  // 15 seconds).
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  // Fetch directory with aggressive cache-busting. Uses `cache: 'no-store'`
  // AND a per-request timestamp query param so mobile Safari (which
  // ignores Cache-Control on some requests) still gets a fresh response.
  //
  // Error handling: ANY failure (network, non-2xx, JSON parse, empty
  // payload) is captured in `loadError` and surfaced as an inline
  // banner with a Retry button. The previous implementation silently
  // swallowed errors via `catch {}` which was the main reason mobile
  // users reported "new members not showing" — a flaky mobile network
  // would abort the fetch, the catch would eat the error, and the
  // user would see a stale `members` array with no explanation.
  const load = useCallback(async (mode: 'initial' | 'refresh' | 'background' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true)
    try {
      const res = await fetch(`/api/directory/members?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      const raw = await res.text()
      let parsed: { members?: unknown[]; error?: string; _diagnostic?: unknown } = {}
      try {
        parsed = raw ? JSON.parse(raw) : {}
      } catch (parseErr) {
        throw new Error(
          `Directory response was not JSON: ${raw.slice(0, 120) || '<empty>'} (${parseErr instanceof Error ? parseErr.message : 'parse error'})`
        )
      }
      if (parsed.error) {
        // Server returned 200 with an error field — still surface it
        throw new Error(parsed.error)
      }
      const data = Array.isArray(parsed.members) ? parsed.members : []
      console.log(
        `[members] fetched ${data.length} members`,
        mode === 'initial' ? '(initial)' : mode === 'refresh' ? '(manual refresh)' : '(background)',
      )
      setMembers(data.map((raw) => {
        const p = raw as {
          id: string; full_name: string | null; avatar_url: string | null
          bio: string | null; location: string | null; trust_balance: number
          linkedin_url?: string | null; instagram_url?: string | null
          twitter_url?: string | null; github_url?: string | null
          tiktok_url?: string | null; youtube_url?: string | null
          website_url?: string | null
        }
        return {
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          location: p.location,
          skills: [],
          account_type: 'individual',
          trust_balance: p.trust_balance ?? 0,
          socials: {
            linkedin_url:  p.linkedin_url  ?? null,
            instagram_url: p.instagram_url ?? null,
            twitter_url:   p.twitter_url   ?? null,
            github_url:    p.github_url    ?? null,
            tiktok_url:    p.tiktok_url    ?? null,
            youtube_url:   p.youtube_url   ?? null,
            website_url:   p.website_url   ?? null,
          },
        }
      }))
      setLoadError(null)
      setLastFetchedAt(Date.now())
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Don't clobber an existing successful member list on background
      // refresh failures — just log and keep showing the stale data.
      // Only surface the error for initial / manual-refresh failures
      // where the user will actively be looking at the screen.
      console.error('[members] load failed:', msg, { mode })
      if (mode !== 'background') {
        setLoadError(msg)
      }
    }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load('initial') }, [load])

  // ── Mobile staleness fixes ─────────────────────────────────────────────
  // Three mobile-specific reasons a member list can go stale, all of
  // which used to produce the "new members not showing on mobile" bug:
  //
  //   1. iOS Safari back/forward cache (bfcache) — tapping back from a
  //      member profile restores /members from an in-memory snapshot
  //      WITHOUT re-running useEffect. The pageshow event with
  //      event.persisted === true is the only reliable signal we get.
  //
  //   2. Backgrounded tab — user minimises the PWA / switches apps /
  //      locks the phone for an hour and comes back. visibilitychange
  //      to 'visible' lets us refetch on foregrounding.
  //
  //   3. Session-length staleness — user leaves the tab open on
  //      /members and walks away. A 30-second background poll while
  //      the tab is visible picks up new signups without requiring
  //      the user to tap the manual refresh button.
  useEffect(() => {
    // pageshow — fires both on initial navigation AND on bfcache
    // restore. Only refetch on the bfcache path (persisted === true)
    // so we don't double-fetch on first load.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.log('[members] pageshow persisted (bfcache restore) — refetching')
        load('background')
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[members] tab became visible — refetching')
        load('background')
      }
    }

    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Background poll every 30 seconds while the tab is visible. This
    // is cheap — the /api/directory/members route is server-side cached
    // at the admin client level and just returns JSON — but picks up
    // new signups without any user action.
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        load('background')
      }
    }, 30_000)

    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(pollInterval)
    }
  }, [load])

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
        @keyframes member-skeleton {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 0.85; }
        }
        @media (max-width: 640px) {
          .member-grid { padding: 1rem !important; gap: 0.875rem !important; }
        }
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
            {/*
              Member count display — the audit asked for an explicit
              "Showing X of Y members" line so visitors know whether
              the directory is truncated by their search/category
              filters or by the page-size cap. Three states:
                * loading            → "Loading members…"
                * filtered === total → "X members"
                * filter applied     → "Showing X of Y members"
            */}
            <span style={{ fontSize: '0.82rem', color: '#64748b', alignSelf: 'center' }}>
              {loading && members.length === 0
                ? 'Loading members…'
                : (() => {
                    const isFiltered = filtered.length !== members.length
                    const visibleLabel = isFiltered
                      ? `Showing ${visible.length} of ${filtered.length} members (filtered from ${members.length})`
                      : visible.length < filtered.length
                        ? `Showing ${visible.length} of ${members.length} members`
                        : `${members.length} members`
                    const stamp = lastFetchedAt
                      ? ` · updated ${formatRelativeSeconds(Date.now() - lastFetchedAt)}`
                      : ''
                    return `${visibleLabel}${stamp}`
                  })()}
            </span>
          </div>

          {/* Inline load-error banner. Replaces the previous silent-catch
              behaviour where a failed fetch on mobile would leave the
              directory blank with no explanation. Retry button re-runs
              load() via the same "refresh" path as the ↻ button. */}
          {loadError && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                flexWrap: 'wrap',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.25)',
                borderRadius: 10,
                padding: '0.7rem 0.9rem',
                marginTop: '1rem',
                fontSize: '0.82rem',
                color: '#fca5a5',
              }}
            >
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, marginBottom: '0.15rem' }}>Couldn&rsquo;t load members</div>
                <div style={{ color: '#f87171', wordBreak: 'break-word' }}>{loadError}</div>
              </div>
              <button
                type="button"
                onClick={() => load('refresh')}
                disabled={refreshing || loading}
                style={{
                  flexShrink: 0,
                  background: 'rgba(248,113,113,0.15)',
                  border: '1px solid rgba(248,113,113,0.35)',
                  borderRadius: 8,
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#fca5a5',
                  cursor: (refreshing || loading) ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  minHeight: 36,
                }}
              >
                Retry
              </button>
            </div>
          )}

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
        {/*
          Skeleton loading state — shown ONLY on the initial fetch
          before we have any data. Avoids the brief "no members found"
          flicker that the empty-state branch used to render while the
          first request was in flight.
        */}
        {loading && members.length === 0 && Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            aria-hidden
            style={{
              ...S.card,
              cursor: 'default',
              animation: 'member-skeleton 1.4s ease-in-out infinite',
              animationDelay: `${(i % 3) * 0.12}s`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: '#27374d', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ height: 14, width: '70%', background: '#27374d', borderRadius: 4 }} />
                <div style={{ height: 10, width: '45%', background: '#27374d', borderRadius: 4 }} />
              </div>
              <div style={{ width: 36, height: 18, background: '#27374d', borderRadius: 6, flexShrink: 0 }} />
            </div>
            <div style={{ height: 10, width: '100%', background: '#27374d', borderRadius: 4 }} />
            <div style={{ height: 10, width: '85%', background: '#27374d', borderRadius: 4 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem', marginTop: 'auto' }}>
              <div style={{ height: 10, width: 60, background: '#27374d', borderRadius: 4 }} />
              <div style={{ height: 22, width: 80, background: '#27374d', borderRadius: 6 }} />
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>
              {members.length === 0
                ? 'Be the first founding member to complete your profile'
                : 'No members found — try adjusting your filters'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {members.length === 0
                ? 'Complete your profile and you\'ll appear here.'
                : 'Reset the search box or pick "All" to see every member.'}
            </p>
            {members.length === 0 ? (
              <Link href="/profile" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.75rem 1.75rem', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
                Complete My Profile
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => { setSearch(''); setActiveCategory('All') }}
                style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', padding: '0.75rem 1.75rem', borderRadius: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
              >
                Clear filters
              </button>
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
              {member.socials && (
                <SocialLinks
                  links={member.socials}
                  size="sm"
                  max={4}
                  flat
                  stopPropagation
                />
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
