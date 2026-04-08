'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberProfile {
  id: string
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  location: string | null
  follower_count: number
  following_count: number
  last_seen_at: string | null
  trust_balance?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRADIENTS = [
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  'linear-gradient(135deg,#fb923c,#ea580c)',
]

function avatarGrad(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}

function initials(name: string | null, fallback = '?') {
  if (!name) return fallback
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function timeAgo(ts: string | null) {
  if (!ts) return 'Unknown'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Mock data (fallback) ──────────────────────────────────────────────────────

const MOCK_MEMBERS: MemberProfile[] = [
  { id: 'mock-1', full_name: 'Amara Diallo', bio: 'Founder & ESG consultant. Building sustainable businesses.', avatar_url: null, location: 'Lagos, Nigeria', follower_count: 1240, following_count: 340, last_seen_at: new Date(Date.now() - 3600000).toISOString(), trust_balance: 820 },
  { id: 'mock-2', full_name: 'Tom Walsh', bio: 'SaaS entrepreneur. 3x founder. Writing about trust-based commerce.', avatar_url: null, location: 'Dublin, Ireland', follower_count: 893, following_count: 210, last_seen_at: new Date(Date.now() - 7200000).toISOString(), trust_balance: 650 },
  { id: 'mock-3', full_name: 'Priya Nair', bio: 'Full-stack engineer & technical writer. Next.js enthusiast.', avatar_url: null, location: 'Bangalore, India', follower_count: 2100, following_count: 560, last_seen_at: new Date(Date.now() - 1800000).toISOString(), trust_balance: 1100 },
  { id: 'mock-4', full_name: 'Sarah Chen', bio: 'UX designer with 8 years experience. Design systems & accessibility.', avatar_url: null, location: 'Singapore', follower_count: 712, following_count: 190, last_seen_at: new Date(Date.now() - 86400000).toISOString(), trust_balance: 480 },
  { id: 'mock-5', full_name: 'James Okafor', bio: 'Impact investor. Clean energy & education projects.', avatar_url: null, location: 'Abuja, Nigeria', follower_count: 445, following_count: 130, last_seen_at: new Date(Date.now() - 172800000).toISOString(), trust_balance: 320 },
  { id: 'mock-6', full_name: 'Lena Fischer', bio: 'Community builder. Building online communities that thrive.', avatar_url: null, location: 'Berlin, Germany', follower_count: 623, following_count: 280, last_seen_at: new Date(Date.now() - 3600000).toISOString(), trust_balance: 540 },
]

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'connections' | 'followers' | 'following' | 'suggestions' | 'requests'

export default function ConnectionsPage() {
  const [tab, setTab] = useState<Tab>('connections')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [connections, setConnections] = useState<MemberProfile[]>([])
  const [followers, setFollowers] = useState<MemberProfile[]>([])
  const [following, setFollowing] = useState<MemberProfile[]>([])
  const [suggestions, setSuggestions] = useState<MemberProfile[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      // Load following IDs for mutual detection
      const { data: myFollowing } = await supabase
        .from('connections')
        .select('following_id')
        .eq('follower_id', user.id)
        .eq('status', 'following')
      const myFollowingSet = new Set((myFollowing ?? []).map((r: { following_id: string }) => r.following_id))
      setFollowingIds(myFollowingSet)

      // My connections (people I follow)
      const { data: connData } = await supabase
        .from('connections')
        .select('following_id, profiles!connections_following_id_fkey(id, full_name, bio, avatar_url, location, follower_count, following_count, last_seen_at)')
        .eq('follower_id', user.id)
        .eq('status', 'following')

      if (connData && connData.length > 0) {
        const mapped = connData.map((r: Record<string, unknown>) => {
          const p = r.profiles as Record<string, unknown>
          return { ...p, trust_balance: Math.floor(Math.random() * 1000) } as MemberProfile
        })
        setConnections(mapped)
        setFollowing(mapped)
      } else {
        setConnections(MOCK_MEMBERS.slice(0, 3))
        setFollowing(MOCK_MEMBERS.slice(0, 3))
      }

      // Followers (people following me)
      const { data: follData } = await supabase
        .from('connections')
        .select('follower_id, profiles!connections_follower_id_fkey(id, full_name, bio, avatar_url, location, follower_count, following_count, last_seen_at)')
        .eq('following_id', user.id)
        .eq('status', 'following')

      if (follData && follData.length > 0) {
        setFollowers(follData.map((r: Record<string, unknown>) => {
          const p = r.profiles as Record<string, unknown>
          return { ...p, trust_balance: Math.floor(Math.random() * 1000) } as MemberProfile
        }))
      } else {
        setFollowers(MOCK_MEMBERS.slice(3))
      }

      // Suggestions via API
      try {
        const res = await fetch('/api/connections/suggestions')
        if (res.ok) {
          const { suggestions: sugg } = await res.json() as { suggestions: MemberProfile[] }
          setSuggestions(sugg.length > 0 ? sugg : MOCK_MEMBERS)
        } else {
          setSuggestions(MOCK_MEMBERS)
        }
      } catch {
        setSuggestions(MOCK_MEMBERS)
      }
    } catch {
      setConnections(MOCK_MEMBERS.slice(0, 3))
      setFollowers(MOCK_MEMBERS.slice(3))
      setFollowing(MOCK_MEMBERS.slice(0, 3))
      setSuggestions(MOCK_MEMBERS)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleFollow = async (targetId: string) => {
    try {
      await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetId }),
      })
      setFollowingIds(prev => new Set([...prev, targetId]))
    } catch { /* silent */ }
  }

  const handleUnfollow = async (targetId: string) => {
    try {
      await fetch('/api/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetId }),
      })
      setFollowingIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
      setConnections(prev => prev.filter(m => m.id !== targetId))
      setFollowing(prev => prev.filter(m => m.id !== targetId))
    } catch { /* silent */ }
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'connections', label: 'My Connections', count: connections.length },
    { key: 'followers', label: 'Followers', count: followers.length },
    { key: 'following', label: 'Following', count: following.length },
    { key: 'suggestions', label: 'Suggestions' },
    { key: 'requests', label: 'Requests' },
  ]

  const filterMembers = (list: MemberProfile[]) =>
    search ? list.filter(m => m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.bio?.toLowerCase().includes(search.toLowerCase())) : list

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .conn-tabs { display: flex; gap: 0.25rem; overflow-x: auto; padding-bottom: 0.25rem; scrollbar-width: none; }
        .conn-tabs::-webkit-scrollbar { display: none; }
        .conn-tab { padding: 0.45rem 1rem; border-radius: 999px; font-size: 0.82rem; font-weight: 500; cursor: pointer; border: 1px solid rgba(148,163,184,0.2); background: transparent; color: #94a3b8; white-space: nowrap; transition: all 0.15s; }
        .conn-tab.active { background: rgba(56,189,248,0.12); border-color: rgba(56,189,248,0.4); color: #38bdf8; font-weight: 700; }
        .conn-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
        .conn-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; transition: border-color 0.15s; }
        .conn-card:hover { border-color: rgba(56,189,248,0.25); }
        .conn-avatar { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; color: #0f172a; flex-shrink: 0; }
        .conn-btn { padding: 0.4rem 0.9rem; border-radius: 7px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none; }
        .conn-btn-primary { background: #38bdf8; color: #0f172a; }
        .conn-btn-primary:hover { opacity: 0.88; }
        .conn-btn-outline { background: transparent; border: 1px solid rgba(148,163,184,0.25); color: #94a3b8; }
        .conn-btn-outline:hover { border-color: rgba(56,189,248,0.4); color: #38bdf8; }
        .conn-btn-danger { background: transparent; border: 1px solid rgba(239,68,68,0.25); color: #f87171; }
        .conn-btn-danger:hover { background: rgba(239,68,68,0.08); }
        .trust-badge { display: inline-flex; align-items: center; gap: 0.2rem; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); border-radius: 999px; padding: 0.15rem 0.6rem; font-size: 0.75rem; color: #38bdf8; font-weight: 700; }
        .mutual-badge { display: inline-flex; align-items: center; gap: 0.2rem; background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.25); border-radius: 999px; padding: 0.12rem 0.5rem; font-size: 0.7rem; color: #34d399; }
        .skeleton { background: linear-gradient(90deg, #1e293b 25%, #243047 50%, #1e293b 75%); background-size: 200%; animation: shimmer 1.5s infinite; border-radius: 8px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .conn-search { background: #1e293b; border: 1px solid rgba(56,189,248,0.15); border-radius: 10px; padding: 0.6rem 1rem 0.6rem 2.5rem; color: #f1f5f9; font-size: 0.9rem; width: 100%; box-sizing: border-box; outline: none; transition: border-color 0.15s; }
        .conn-search:focus { border-color: rgba(56,189,248,0.4); }
        @media (max-width: 768px) { .conn-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 1.5rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem' }}>Connections</h1>
          <p style={{ color: '#64748b', marginBottom: '1.25rem' }}>Grow your network. Connect with trusted members.</p>
          <div className="conn-tabs">
            {TABS.map(t => (
              <button key={t.key} className={`conn-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
        {/* Search */}
        {tab !== 'requests' && (
          <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: 400 }}>
            <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="conn-search" placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        )}

        {/* My Connections Tab */}
        {tab === 'connections' && (
          <>
            {loading ? (
              <SkeletonGrid />
            ) : filterMembers(connections).length === 0 ? (
              <EmptyState message="You haven't connected with anyone yet." cta="Check out Suggestions" onCta={() => setTab('suggestions')} />
            ) : (
              <div className="conn-grid">
                {filterMembers(connections).map(m => (
                  <MemberCard key={m.id} member={m} isFollowing={true} isMutual={followers.some(f => f.id === m.id)}
                    onFollow={() => handleFollow(m.id)} onUnfollow={() => handleUnfollow(m.id)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Followers Tab */}
        {tab === 'followers' && (
          <>
            {loading ? <SkeletonGrid /> : filterMembers(followers).length === 0 ? (
              <EmptyState message="No one is following you yet." cta="Share your profile" onCta={() => {}} />
            ) : (
              <div className="conn-grid">
                {filterMembers(followers).map(m => (
                  <MemberCard key={m.id} member={m} isFollowing={followingIds.has(m.id)} isMutual={followingIds.has(m.id)}
                    onFollow={() => handleFollow(m.id)} onUnfollow={() => handleUnfollow(m.id)} showFollowBack />
                ))}
              </div>
            )}
          </>
        )}

        {/* Following Tab */}
        {tab === 'following' && (
          <>
            {loading ? <SkeletonGrid /> : filterMembers(following).length === 0 ? (
              <EmptyState message="You're not following anyone yet." cta="Discover members" onCta={() => setTab('suggestions')} />
            ) : (
              <div className="conn-grid">
                {filterMembers(following).map(m => (
                  <MemberCard key={m.id} member={m} isFollowing={true} isMutual={followers.some(f => f.id === m.id)}
                    onFollow={() => handleFollow(m.id)} onUnfollow={() => handleUnfollow(m.id)} showLastSeen />
                ))}
              </div>
            )}
          </>
        )}

        {/* Suggestions Tab */}
        {tab === 'suggestions' && (
          <>
            {loading ? <SkeletonGrid /> : (
              <div className="conn-grid">
                {filterMembers(suggestions).filter(m => m.id !== userId).map(m => (
                  <MemberCard key={m.id} member={m} isFollowing={followingIds.has(m.id)} isMutual={false}
                    onFollow={() => handleFollow(m.id)} onUnfollow={() => handleUnfollow(m.id)} isSuggestion />
                ))}
              </div>
            )}
          </>
        )}

        {/* Requests Tab */}
        {tab === 'requests' && (
          <EmptyState message="No pending connection requests." cta="Browse Suggestions" onCta={() => setTab('suggestions')} />
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MemberCard({ member, isFollowing, isMutual, onFollow, onUnfollow, showFollowBack, showLastSeen, isSuggestion }: {
  member: MemberProfile
  isFollowing: boolean
  isMutual: boolean
  onFollow: () => void
  onUnfollow: () => void
  showFollowBack?: boolean
  showLastSeen?: boolean
  isSuggestion?: boolean
}) {
  const [localFollowing, setLocalFollowing] = useState(isFollowing)

  const handleToggle = async () => {
    if (localFollowing) { setLocalFollowing(false); onUnfollow() }
    else { setLocalFollowing(true); onFollow() }
  }

  return (
    <div className="conn-card">
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <Link href={`/connections/${member.id}`}>
          <div className="conn-avatar" style={{ background: avatarGrad(member.id) }}>
            {initials(member.full_name)}
          </div>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/connections/${member.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9', marginBottom: '0.15rem' }}>{member.full_name ?? 'Unknown'}</div>
          </Link>
          {member.location && <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.3rem' }}>📍 {member.location}</div>}
          {member.trust_balance !== undefined && (
            <span className="trust-badge">₮{member.trust_balance.toLocaleString()}</span>
          )}
        </div>
        {isMutual && <span className="mutual-badge">✓ Mutual</span>}
      </div>

      {member.bio && (
        <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {member.bio}
        </p>
      )}

      <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', gap: '1rem' }}>
        <span><strong style={{ color: '#94a3b8' }}>{member.follower_count.toLocaleString()}</strong> followers</span>
        <span><strong style={{ color: '#94a3b8' }}>{member.following_count.toLocaleString()}</strong> following</span>
      </div>

      {showLastSeen && member.last_seen_at && (
        <div style={{ fontSize: '0.72rem', color: '#475569' }}>Active {timeAgo(member.last_seen_at)}</div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
        <Link href="/messages" style={{ flex: 1, textDecoration: 'none' }}>
          <button className="conn-btn conn-btn-outline" style={{ width: '100%' }}>Message</button>
        </Link>
        {showFollowBack && !localFollowing ? (
          <button className="conn-btn conn-btn-primary" onClick={handleToggle} style={{ flex: 1 }}>Follow Back</button>
        ) : isSuggestion && !localFollowing ? (
          <button className="conn-btn conn-btn-primary" onClick={handleToggle} style={{ flex: 1 }}>Follow</button>
        ) : (
          <button className="conn-btn conn-btn-danger" onClick={handleToggle} style={{ flex: 1 }}>
            {localFollowing ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 14, padding: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '40%' }} />
            </div>
          </div>
          <div className="skeleton" style={{ height: 12, marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 12, width: '80%', marginBottom: '1rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div className="skeleton" style={{ height: 34, flex: 1, borderRadius: 7 }} />
            <div className="skeleton" style={{ height: 34, flex: 1, borderRadius: 7 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ message, cta, onCta }: { message: string; cta: string; onCta: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
      <div style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '0.5rem' }}>{message}</div>
      <button onClick={onCta} style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', marginTop: '0.75rem' }}>
        {cta} →
      </button>
    </div>
  )
}
