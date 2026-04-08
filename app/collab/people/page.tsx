'use client'
import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Member {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  last_seen_at: string | null
  role: string | null
  trust_balance: number
}

const GRADIENTS = [
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  'linear-gradient(135deg,#fb923c,#ea580c)',
]
function grad(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}
function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function timeAgo(ts: string | null): string {
  if (!ts) return 'Unknown'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
function trustBadge(score: number) {
  if (score >= 500) return { label: 'Top Trusted', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' }
  if (score >= 200) return { label: 'Verified', color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' }
  if (score >= 50) return { label: 'Active', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' }
  return { label: 'New', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)' }
}
function isOnline(ts: string | null) {
  if (!ts) return false
  return Date.now() - new Date(ts).getTime() < 7 * 24 * 60 * 60 * 1000
}

const MOCK_MEMBERS: Member[] = [
  { id: 'p1', full_name: 'Amara Diallo', bio: 'Founder & ESG consultant. Building sustainable businesses in West Africa and beyond.', avatar_url: null, location: 'Lagos, Nigeria', last_seen_at: new Date(Date.now() - 3600000).toISOString(), role: null, trust_balance: 710 },
  { id: 'p2', full_name: 'Tom Walsh', bio: 'SaaS entrepreneur. 3x founder. Writing about trust-based commerce and community-led growth.', avatar_url: null, location: 'Dublin, Ireland', last_seen_at: new Date(Date.now() - 7200000).toISOString(), role: null, trust_balance: 640 },
  { id: 'p3', full_name: 'Priya Nair', bio: 'Full-stack engineer & technical writer. Next.js, Supabase, TypeScript enthusiast. Open to collab.', avatar_url: null, location: 'Bangalore, India', last_seen_at: new Date(Date.now() - 1800000).toISOString(), role: null, trust_balance: 1100 },
  { id: 'p4', full_name: 'Sarah Chen', bio: 'UX designer with 8 years experience. Design systems, accessibility, and product design.', avatar_url: null, location: 'Singapore', last_seen_at: new Date(Date.now() - 86400000).toISOString(), role: null, trust_balance: 820 },
  { id: 'p5', full_name: 'James Okafor', bio: 'Impact investor. Focused on clean energy and education projects across Africa.', avatar_url: null, location: 'Abuja, Nigeria', last_seen_at: new Date(Date.now() - 172800000).toISOString(), role: null, trust_balance: 320 },
  { id: 'p6', full_name: 'Lena Fischer', bio: 'Community builder. Growing online communities that thrive and sustain themselves.', avatar_url: null, location: 'Berlin, Germany', last_seen_at: new Date(Date.now() - 3600000).toISOString(), role: null, trust_balance: 530 },
  { id: 'p7', full_name: 'Marcus Obi', bio: 'Growth marketer and SEO specialist. 10 years helping startups scale organic traffic.', avatar_url: null, location: 'London, UK', last_seen_at: new Date(Date.now() - 5400000).toISOString(), role: null, trust_balance: 420 },
  { id: 'p8', full_name: 'Yuki Tanaka', bio: 'Product manager at a fintech startup. Passionate about UX research and accessibility.', avatar_url: null, location: 'Tokyo, Japan', last_seen_at: new Date(Date.now() - 43200000).toISOString(), role: null, trust_balance: 280 },
]

function PeopleContent() {
  const searchParams = useSearchParams()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [minTrust, setMinTrust] = useState(0)
  const [location, setLocation] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [])

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        min_trust: String(minTrust),
        ...(search ? { q: search } : {}),
        ...(location ? { location } : {}),
        ...(onlineOnly ? { online: 'true' } : {}),
      })
      const res = await fetch(`/api/collab/people?${params}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      if (json.profiles && json.profiles.length > 0) {
        setMembers(json.profiles)
      } else {
        setMembers(MOCK_MEMBERS.filter(m => {
          if (search && !m.full_name?.toLowerCase().includes(search.toLowerCase()) && !m.bio?.toLowerCase().includes(search.toLowerCase())) return false
          if (minTrust > 0 && m.trust_balance < minTrust) return false
          if (location && !m.location?.toLowerCase().includes(location.toLowerCase())) return false
          if (onlineOnly && !isOnline(m.last_seen_at)) return false
          return true
        }))
      }
    } catch {
      setMembers(MOCK_MEMBERS)
    } finally {
      setLoading(false)
    }
  }, [search, minTrust, location, onlineOnly])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  async function handleFollow(memberId: string) {
    if (!currentUserId) return
    const isFollowing = followingIds.has(memberId)
    setFollowingIds(prev => {
      const next = new Set(prev)
      if (isFollowing) next.delete(memberId)
      else next.add(memberId)
      return next
    })
    try {
      await fetch('/api/connections', {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: memberId }),
      })
    } catch {
      // Revert
      setFollowingIds(prev => {
        const next = new Set(prev)
        if (isFollowing) next.add(memberId)
        else next.delete(memberId)
        return next
      })
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
      <style>{`
        .member-card{background:#1e293b;border:1px solid #334155;border-radius:14px;padding:20px;transition:transform 0.2s,box-shadow 0.2s;}
        .member-card:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(0,0,0,0.35);}
        .follow-btn{border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;}
        .follow-btn.following{background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;}
        .follow-btn.not-following{background:linear-gradient(135deg,#38bdf8,#0284c7);border:none;color:#fff;}
        .msg-btn{background:transparent;border:1px solid #334155;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;color:#94a3b8;transition:all 0.15s;text-decoration:none;display:inline-block;}
        .msg-btn:hover{border-color:#475569;color:#f1f5f9;}
        input[type=range]{width:100%;accent-color:#fbbf24;}
        .filter-toggle{display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 0;}
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Link href="/collab" style={{ color: '#64748b', fontSize: 14, textDecoration: 'none' }}>Collab</Link>
              <span style={{ color: '#475569' }}>›</span>
              <span style={{ color: '#f1f5f9', fontSize: 14 }}>People</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>🤝 Find Collaborators</h1>
            <p style={{ color: '#64748b', margin: '6px 0 0', fontSize: 14 }}>Connect with trusted members ready to work together</p>
          </div>
          <Link href="/connections" style={{
            background: 'linear-gradient(135deg,#fbbf24,#d97706)', color: '#fff',
            textDecoration: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600,
          }}>
            My Connections
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Filters */}
          <div style={{ width: 240, flexShrink: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 20 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Filters</h3>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Skills / Interests</label>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. design, Next.js..."
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', color: '#f1f5f9', fontSize: 13, boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Dublin, London..."
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', color: '#f1f5f9', fontSize: 13, boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Min Trust Score: ₮{minTrust}</label>
              <input type="range" min={0} max={1000} step={50} value={minTrust} onChange={e => setMinTrust(parseInt(e.target.value))} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginTop: 2 }}><span>₮0</span><span>₮1000</span></div>
            </div>

            <label className="filter-toggle">
              <input type="checkbox" checked={onlineOnly} onChange={e => setOnlineOnly(e.target.checked)} style={{ accentColor: '#fbbf24' }} />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Active recently</span>
            </label>

            <button onClick={() => { setSearch(''); setLocation(''); setMinTrust(0); setOnlineOnly(false) }}
              style={{ width: '100%', marginTop: 20, padding: '8px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
              Reset
            </button>
          </div>

          {/* Grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
                {[1,2,3,4,5,6].map(i => <div key={i} style={{ background: '#1e293b', borderRadius: 14, height: 200, border: '1px solid #334155', opacity: 0.5 }} />)}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{members.length} members found</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
                  {members.map(m => {
                    const badge = trustBadge(m.trust_balance)
                    const online = isOnline(m.last_seen_at)
                    const isFollowingMember = followingIds.has(m.id)
                    return (
                      <div key={m.id} className="member-card">
                        {/* Avatar */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div style={{
                              width: 48, height: 48, borderRadius: '50%',
                              background: grad(m.id),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 16, fontWeight: 700, color: '#fff',
                            }}>
                              {m.avatar_url
                                ? <img src={m.avatar_url} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                : initials(m.full_name)}
                            </div>
                            {online && (
                              <div style={{
                                position: 'absolute', bottom: 1, right: 1,
                                width: 10, height: 10, borderRadius: '50%',
                                background: '#34d399', border: '2px solid #1e293b',
                              }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.full_name ?? 'Community Member'}
                            </div>
                            {m.location && (
                              <div style={{ fontSize: 12, color: '#64748b' }}>📍 {m.location}</div>
                            )}
                          </div>
                        </div>

                        {/* Bio */}
                        {m.bio && (
                          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 14px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {m.bio}
                          </p>
                        )}

                        {/* Trust badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                          <span style={{
                            fontSize: 12, color: badge.color, background: badge.bg,
                            border: `1px solid ${badge.border}`, padding: '3px 10px', borderRadius: 100,
                          }}>
                            ₮{m.trust_balance} · {badge.label}
                          </span>
                          <span style={{ fontSize: 11, color: '#475569' }}>
                            {online ? '🟢 Active' : `${timeAgo(m.last_seen_at)}`}
                          </span>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          {currentUserId && m.id !== currentUserId && (
                            <button
                              onClick={() => handleFollow(m.id)}
                              className={`follow-btn ${isFollowingMember ? 'following' : 'not-following'}`}
                            >
                              {isFollowingMember ? '✓ Following' : '+ Connect'}
                            </button>
                          )}
                          <Link href={`/messages?new=${m.id}`} className="msg-btn">
                            💬 Message
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                  {members.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                      <div style={{ fontSize: 40, marginBottom: 16 }}>🤝</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>No members match your filters</div>
                      <div style={{ fontSize: 14 }}>Try adjusting your search or Trust score minimum.</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CollabPeoplePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading people...</div>}>
      <PeopleContent />
    </Suspense>
  )
}
