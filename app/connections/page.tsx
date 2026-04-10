'use client'
export const revalidate = 0
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

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'connections' | 'followers' | 'following' | 'suggestions' | 'requests'

export default function ConnectionsPage() {
  const [tab, setTab] = useState<Tab>('suggestions')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [connections, setConnections] = useState<MemberProfile[]>([])
  const [followers, setFollowers] = useState<MemberProfile[]>([])
  const [following, setFollowing] = useState<MemberProfile[]>([])
  const [suggestions, setSuggestions] = useState<MemberProfile[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [trustBalances, setTrustBalances] = useState<Record<string, number>>({})

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      // Load real members from profiles for suggestions (exclude self)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, bio, avatar_url, location, follower_count, following_count, last_seen_at')
        .neq('id', user.id)
        .order('follower_count', { ascending: false })
        .limit(24)

      const members: MemberProfile[] = (profilesData ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        full_name: p.full_name as string | null,
        bio: p.bio as string | null,
        avatar_url: p.avatar_url as string | null,
        location: p.location as string | null,
        follower_count: (p.follower_count as number) || 0,
        following_count: (p.following_count as number) || 0,
        last_seen_at: p.last_seen_at as string | null,
      }))

      // Fetch trust balances for suggestions
      if (members.length > 0) {
        const ids = members.map(m => m.id)
        const { data: balances } = await supabase
          .from('trust_balances')
          .select('user_id, balance')
          .in('user_id', ids)
        const balMap: Record<string, number> = {}
        for (const b of balances ?? []) {
          balMap[(b as Record<string, unknown>).user_id as string] = (b as Record<string, unknown>).balance as number
        }
        setTrustBalances(balMap)
      }

      setSuggestions(members)

      // Load follow data from API
      try {
        const connRes = await fetch('/api/connections', { cache: 'no-store' })
        if (connRes.ok) {
          const connData = await connRes.json() as { following?: MemberProfile[]; followers?: MemberProfile[]; followingIds?: string[] }
          setFollowing(connData.following ?? [])
          setFollowers(connData.followers ?? [])
          setFollowingIds(new Set(connData.followingIds ?? []))
        }
      } catch { /* silent */ }
      setConnections([])

    } catch (err) {
      console.error('[connections page]', err)
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
      setFollowingIds(prev => { const n = new Set(prev); n.add(targetId); return n })
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
    { key: 'suggestions', label: 'Discover Members' },
    { key: 'connections', label: 'My Connections', count: connections.length },
    { key: 'followers', label: 'Followers', count: followers.length },
    { key: 'following', label: 'Following', count: following.length },
    { key: 'requests', label: 'Requests' },
  ]

  const filterMembers = (list: MemberProfile[]) =>
    search ? list.filter(m => m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.bio?.toLowerCase().includes(search.toLowerCase())) : list

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 }}>
      <style>{`
        .conn-tabs { display: flex; gap: 0.25rem; overflow-x: auto; padding-bottom: 0.25rem; scrollbar-width: none; }
        .conn-tabs::-webkit-scrollbar { display: none; }
        .conn-tab { padding: 0.45rem 1rem; border-radius: 999px; font-size: 0.82rem; font-weight: 500; cursor: pointer; border: 1px solid rgba(148,163,184,0.2); background: transparent; color: #94a3b8; white-space: nowrap; transition: all 0.15s; }
        .conn-tab.active { background: rgba(56,189,248,0.12); border-color: rgba(56,189,248,0.4); color: #38bdf8; font-weight: 700; }
        .conn-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
        .conn-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; transition: border-color 0.15s; }
        .conn-card:hover { border-color: rgba(56,189,248,0.25); }
        .conn-avatar { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; color: #0f172a; flex-shrink: 0; overflow: hidden; }
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
                {t.label}{t.count !== undefined && t.count > 0 ? ` (${t.count})` : ''}
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

        {/* Discover / Suggestions Tab */}
        {tab === 'suggestions' && (
          <>
            {loading ? (
              <SkeletonGrid />
            ) : filterMembers(suggestions).length === 0 ? (
              <EmptyState icon="🌍" message="No members to discover yet." subtext="Be one of the first to join FreeTrust." />
            ) : (
              <div className="conn-grid">
                {filterMembers(suggestions).filter(m => m.id !== userId).map(m => (
                  <MemberCard
                    key={m.id}
                    member={{ ...m, trust_balance: trustBalances[m.id] }}
                    isFollowing={followingIds.has(m.id)}
                    isMutual={false}
                    onFollow={() => handleFollow(m.id)}
                    onUnfollow={() => handleUnfollow(m.id)}
                    isSuggestion
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* My Connections Tab */}
        {tab === 'connections' && (
          <>
            {loading ? (
              <SkeletonGrid />
            ) : filterMembers(connections).length === 0 ? (
              <EmptyState icon="🤝" message="You haven't connected with anyone yet." subtext="Discover members and start building your network." cta="Discover Members" onCta={() => setTab('suggestions')} />
            ) : (
              <div className="conn-grid">
                {filterMembers(connections).map(m => (
                  <MemberCard key={m.id} member={{ ...m, trust_balance: trustBalances[m.id] }} isFollowing={true} isMutual={followers.some(f => f.id === m.id)}
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
              <EmptyState icon="👥" message="No one is following you yet." subtext="Share your profile to grow your audience." />
            ) : (
              <div className="conn-grid">
                {filterMembers(followers).map(m => (
                  <MemberCard key={m.id} member={{ ...m, trust_balance: trustBalances[m.id] }} isFollowing={followingIds.has(m.id)} isMutual={followingIds.has(m.id)}
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
              <EmptyState icon="🔭" message="You're not following anyone yet." subtext="Discover members and follow the ones you trust." cta="Discover Members" onCta={() => setTab('suggestions')} />
            ) : (
              <div className="conn-grid">
                {filterMembers(following).map(m => (
                  <MemberCard key={m.id} member={{ ...m, trust_balance: trustBalances[m.id] }} isFollowing={true} isMutual={followers.some(f => f.id === m.id)}
                    onFollow={() => handleFollow(m.id)} onUnfollow={() => handleUnfollow(m.id)} showLastSeen />
                ))}
              </div>
            )}
          </>
        )}

        {/* Requests Tab */}
        {tab === 'requests' && (
          <EmptyState icon="📬" message="No pending connection requests." subtext="Connection requests will appear here." cta="Discover Members" onCta={() => setTab('suggestions')} />
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
        <Link href={`/profile?id=${member.id}`}>
          <div className="conn-avatar" style={{ background: member.avatar_url ? undefined : avatarGrad(member.id) }}>
            {member.avatar_url
              ? <img src={member.avatar_url} alt={member.full_name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials(member.full_name)
            }
          </div>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/profile?id=${member.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9', marginBottom: '0.15rem' }}>{member.full_name ?? 'FreeTrust Member'}</div>
          </Link>
          {member.location && <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.3rem' }}>📍 {member.location}</div>}
          {member.trust_balance !== undefined && member.trust_balance > 0 && (
            <span className="trust-badge">₮{member.trust_balance.toLocaleString()}</span>
          )}
        </div>
        {isMutual && <span className="mutual-badge">✓ Mutual</span>}
      </div>

      {member.bio && (
        <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
          {member.bio}
        </p>
      )}

      <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', gap: '1rem' }}>
        {member.follower_count > 0 && <span><strong style={{ color: '#94a3b8' }}>{member.follower_count.toLocaleString()}</strong> followers</span>}
        {member.following_count > 0 && <span><strong style={{ color: '#94a3b8' }}>{member.following_count.toLocaleString()}</strong> following</span>}
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

function EmptyState({ icon, message, subtext, cta, onCta }: {
  icon: string
  message: string
  subtext: string
  cta?: string
  onCta?: () => void
}) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem' }}>{message}</div>
      <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: cta ? '1rem' : 0 }}>{subtext}</div>
      {cta && onCta && (
        <button onClick={onCta} style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
          {cta} →
        </button>
      )}
    </div>
  )
}
