'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Community {
  id: string; name: string; slug: string; description: string
  avatar_initials: string; avatar_gradient: string; category: string
  tags: string[]; is_paid: boolean; price_monthly: number
  member_count: number; post_count: number; is_featured: boolean
  owner_id: string
}
interface Post {
  id: string; title: string; body: string; type: string; upvotes: number
  comment_count: number; is_pinned: boolean; created_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null }
}
interface Member {
  id: string; user_id: string; role: string; joined_at: string
  profile: { full_name: string | null; avatar_url: string | null }
}
interface CommunityEvent {
  id: string; title: string; description: string; starts_at: string; ends_at: string
  is_online: boolean; meeting_url: string | null; attendee_count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ini(name: string | null) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}
const TYPE_COLOR: Record<string, string> = {
  discussion: '#38bdf8', announcement: '#f472b6', question: '#fbbf24',
}
const TYPE_LABEL: Record<string, string> = {
  discussion: 'Discussion', announcement: '📣 Announcement', question: '❓ Question',
}
const ROLE_COLOR: Record<string, string> = {
  owner: '#f472b6', moderator: '#fbbf24', member: '#64748b',
}

function Av({ url, name, size = 36 }: { url?: string | null; name: string | null; size?: number }) {
  if (url) return <img src={url} alt={name ?? ''} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontWeight: 800, color: '#0f172a', flexShrink: 0 }}>{ini(name)}</div>
}

function Empty({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#94a3b8', marginBottom: '0.35rem' }}>{title}</div>
      {sub && <p style={{ fontSize: '0.85rem', margin: 0 }}>{sub}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CommunityDetailPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [community, setCommunity] = useState<Community | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)

  const [tab, setTab] = useState<'feed' | 'events' | 'members' | 'admin'>('feed')
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [postType, setPostType] = useState<'discussion' | 'question' | 'announcement'>('discussion')
  const [submitting, setSubmitting] = useState(false)
  const [postError, setPostError] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [votedPosts, setVotedPosts] = useState<Set<string>>(new Set())
  const [rsvpEvents, setRsvpEvents] = useState<Set<string>>(new Set())
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // Get session user
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const isOwner = !!(currentUserId && community && community.owner_id === currentUserId)

  useEffect(() => {
    if (community) { setEditName(community.name); setEditDesc(community.description) }
  }, [community]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load all real data ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [commRes, postsRes, membersRes, eventsRes] = await Promise.all([
        fetch(`/api/communities/${slug}`),
        fetch(`/api/communities/${slug}/posts`),
        fetch(`/api/communities/${slug}/members`),
        fetch(`/api/communities/${slug}/events`),
      ])
      if (commRes.ok) {
        const j = await commRes.json() as { community: Community; membership: { role: string } | null; userId: string | null }
        if (j?.community?.id) {
          setCommunity(j.community)
          // Set joined from API membership data
          if (j.membership) setJoined(true)
        }
      }
      if (postsRes.ok) {
        const j = await postsRes.json() as { posts: Post[] }
        setPosts(j.posts ?? [])
      }
      if (membersRes.ok) {
        const j = await membersRes.json() as { members: Member[] }
        setMembers(j.members ?? [])
      }
      if (eventsRes.ok) {
        const j = await eventsRes.json() as { events: CommunityEvent[] }
        setEvents(j.events ?? [])
      }
    } catch (err) { console.error('community loadAll:', err) }
    finally { setLoading(false) }
  }, [slug])

  useEffect(() => { loadAll() }, [loadAll])

  // Mark joined if user is already a member
  useEffect(() => {
    if (currentUserId && members.length > 0) {
      setJoined(members.some(m => m.user_id === currentUserId))
    }
  }, [currentUserId, members])

  const sortedPosts = [...posts].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const filteredMembers = members.filter(m =>
    !memberSearch || (m.profile.full_name ?? '').toLowerCase().includes(memberSearch.toLowerCase())
  )

  const handleJoin = async () => {
    if (!community || joinLoading) return
    setJoinLoading(true)
    try {
      const res = await fetch(`/api/communities/${slug}/join`, { method: 'POST' })
      if (res.ok) {
        setJoined(true)
        setCommunity(prev => prev ? { ...prev, member_count: prev.member_count + 1 } : prev)
      }
    } catch { /* silent */ } finally { setJoinLoading(false) }
  }

  const handleVote = (postId: string) => {
    if (votedPosts.has(postId)) return
    setVotedPosts(prev => { const n = new Set(prev); n.add(postId); return n })
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p))
  }

  const handlePost = async () => {
    if (!postTitle.trim()) return
    setSubmitting(true)
    setPostError('')
    const tempId = `temp-${Date.now()}`
    const tempPost: Post = {
      id: tempId, title: postTitle, body: postBody, type: postType,
      upvotes: 0, comment_count: 0, is_pinned: false,
      created_at: new Date().toISOString(),
      author: { id: currentUserId ?? 'me', full_name: 'You', avatar_url: null },
    }
    setPosts(prev => [tempPost, ...prev])
    const titleToPost = postTitle
    const bodyToPost = postBody
    setPostTitle('')
    setPostBody('')
    try {
      const res = await fetch(`/api/communities/${slug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleToPost, body: bodyToPost, type: postType }),
      })
      if (res.ok) {
        const j = await res.json() as { post: Post }
        if (j.post) setPosts(prev => prev.map(p => p.id === tempId ? j.post : p))
      } else {
        const j = await res.json().catch(() => ({})) as { error?: string }
        setPostError(j.error ?? 'Failed to post')
        setPosts(prev => prev.filter(p => p.id !== tempId))
      }
    } catch {
      setPosts(prev => prev.filter(p => p.id !== tempId))
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', paddingTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!community) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', paddingTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
          <h2 style={{ color: '#f1f5f9', marginBottom: '0.75rem' }}>Community not found</h2>
          <Link href="/community" style={{ color: '#38bdf8', fontSize: '0.9rem' }}>← Back to Communities</Link>
        </div>
      </div>
    )
  }

  const TABS = [
    { id: 'feed',    label: '💬 Feed'    },
    { id: 'events',  label: '📅 Events'  },
    { id: 'members', label: '👥 Members' },
    ...(isOwner ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
  ] as const

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', paddingTop: 64, background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .ct{transition:all .15s;white-space:nowrap}.ct:hover{color:#f1f5f9!important}
        .cpc{transition:border-color .15s}.cpc:hover{border-color:rgba(56,189,248,.22)!important}
        .cvb:hover{background:rgba(56,189,248,.15)!important}
        @media(max-width:768px){.chg{grid-template-columns:auto 1fr!important}.chg .cjb{grid-column:1/-1}.ctabs{overflow-x:auto}.clayout{padding:1rem!important}}
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,.1) 0%,transparent 100%)', borderBottom: '1px solid rgba(56,189,248,.1)', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Link href="/community" style={{ fontSize: '0.8rem', color: '#475569', textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>← Communities</Link>
          <div className="chg" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1.25rem', alignItems: 'start' }}>
            <div style={{ width: 72, height: 72, borderRadius: 16, background: community.avatar_gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.3rem', color: '#0f172a', flexShrink: 0 }}>
              {community.avatar_initials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{community.name}</h1>
                {community.is_featured && <span style={{ background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.3)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>✦ Featured</span>}
              </div>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 0.75rem' }}>{community.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
                <span>👥 {community.member_count.toLocaleString()} members</span>
                <span>💬 {community.post_count.toLocaleString()} posts</span>
                <span>📁 {community.category}</span>
                {community.is_paid && <span style={{ color: '#fbbf24' }}>🔒 £{community.price_monthly}/mo</span>}
                {(community.tags ?? []).map(t => (
                  <span key={t} style={{ background: 'rgba(148,163,184,.08)', border: '1px solid rgba(148,163,184,.12)', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>{t}</span>
                ))}
              </div>
            </div>
            <div className="cjb" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
              {!joined
                ? <button onClick={handleJoin} disabled={joinLoading} style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.55rem 1.25rem', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', cursor: joinLoading ? 'not-allowed' : 'pointer', opacity: joinLoading ? 0.7 : 1 }}>
                    {joinLoading ? 'Joining…' : community.is_paid ? `Join £${community.price_monthly}/mo` : 'Join Community'}
                  </button>
                : <span style={{ background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.3)', borderRadius: 8, padding: '0.55rem 1.25rem', fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8' }}>✓ Joined</span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ctabs" style={{ borderBottom: '1px solid rgba(56,189,248,.08)', background: 'rgba(15,23,42,.8)', overflowX: 'auto' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', padding: '0 1.5rem' }}>
          {TABS.map(t => (
            <button key={t.id} className="ct" onClick={() => setTab(t.id as typeof tab)}
              style={{ padding: '0.85rem 1rem', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #38bdf8' : '2px solid transparent', color: tab === t.id ? '#38bdf8' : '#64748b', fontWeight: tab === t.id ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="clayout" style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>

        {/* FEED */}
        {tab === 'feed' && (
          <div>
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,.1)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {(['discussion', 'question', 'announcement'] as const).map(t => (
                  <button key={t} onClick={() => setPostType(t)} style={{ padding: '0.3rem 0.8rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600, border: postType === t ? `1px solid ${TYPE_COLOR[t]}` : '1px solid rgba(148,163,184,.15)', background: postType === t ? `${TYPE_COLOR[t]}18` : 'transparent', color: postType === t ? TYPE_COLOR[t] : '#64748b', cursor: 'pointer' }}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              <input value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Post title…"
                style={{ width: '100%', background: 'rgba(15,23,42,.5)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 7, padding: '0.55rem 0.8rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
              <textarea value={postBody} onChange={e => setPostBody(e.target.value)} placeholder="Share something with the community…" rows={3}
                style={{ width: '100%', background: 'rgba(15,23,42,.5)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 7, padding: '0.55rem 0.8rem', fontSize: '0.85rem', color: '#f1f5f9', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'system-ui', marginBottom: '0.75rem' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {postError ? <span style={{ fontSize: '0.78rem', color: '#f87171' }}>⚠ {postError}</span> : <span />}
                <button onClick={handlePost} disabled={!postTitle.trim() || submitting}
                  style={{ background: postTitle.trim() ? '#38bdf8' : 'rgba(56,189,248,.3)', border: 'none', borderRadius: 7, padding: '0.45rem 1.1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: postTitle.trim() ? 'pointer' : 'not-allowed' }}>
                  {submitting ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>
            {sortedPosts.length === 0
              ? <Empty icon="💬" title="No posts yet" sub="Be the first to start a conversation." />
              : sortedPosts.map(post => (
                <Link key={post.id} href={`/community/${slug}/post/${post.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="cpc" style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,.08)', borderRadius: 12, padding: '1.1rem 1.25rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      {post.is_pinned && <span style={{ fontSize: '0.72rem', background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 999, padding: '0.1rem 0.5rem', color: '#fbbf24', fontWeight: 700 }}>📌 Pinned</span>}
                      <span style={{ fontSize: '0.72rem', background: `${TYPE_COLOR[post.type] ?? '#38bdf8'}18`, border: `1px solid ${TYPE_COLOR[post.type] ?? '#38bdf8'}30`, borderRadius: 999, padding: '0.1rem 0.5rem', color: TYPE_COLOR[post.type] ?? '#38bdf8', fontWeight: 600 }}>{TYPE_LABEL[post.type] ?? post.type}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9', marginBottom: '0.4rem' }}>{post.title}</div>
                    {post.body && <p style={{ fontSize: '0.83rem', color: '#64748b', margin: '0 0 0.75rem', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{post.body}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Av url={post.author.avatar_url} name={post.author.full_name} size={24} />
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{post.author.full_name ?? 'Unknown'}</span>
                      <span style={{ fontSize: '0.75rem', color: '#475569' }}>· {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button className="cvb" onClick={e => { e.preventDefault(); handleVote(post.id) }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: votedPosts.has(post.id) ? 'rgba(56,189,248,.1)' : 'transparent', border: votedPosts.has(post.id) ? '1px solid rgba(56,189,248,.3)' : '1px solid rgba(148,163,184,.15)', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.78rem', color: votedPosts.has(post.id) ? '#38bdf8' : '#64748b', cursor: 'pointer' }}>
                          ▲ {post.upvotes}
                        </button>
                        <span style={{ fontSize: '0.78rem', color: '#475569' }}>💬 {post.comment_count}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            }
          </div>
        )}

        {/* EVENTS */}
        {tab === 'events' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.25rem' }}>Upcoming Events</h2>
            {events.length === 0
              ? <Empty icon="📅" title="No events scheduled" sub="Events will appear here when created." />
              : events.map(ev => {
                const start = new Date(ev.starts_at)
                const rsvped = rsvpEvents.has(ev.id)
                return (
                  <div key={ev.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,.1)', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.15)', borderRadius: 10, padding: '0.6rem 1rem', textAlign: 'center', flexShrink: 0, minWidth: 60 }}>
                      <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>{start.toLocaleString('en', { month: 'short' })}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{start.getDate()}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f1f5f9', marginBottom: '0.3rem' }}>{ev.title}</div>
                      <p style={{ fontSize: '0.83rem', color: '#64748b', margin: '0 0 0.6rem' }}>{ev.description}</p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#475569', flexWrap: 'wrap' }}>
                        <span>🕐 {start.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
                        {ev.is_online && <span style={{ color: '#34d399' }}>🌐 Online</span>}
                        <span>👥 {ev.attendee_count} attending</span>
                        {ev.meeting_url && rsvped && <a href={ev.meeting_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>🔗 Join link</a>}
                      </div>
                    </div>
                    <button onClick={() => setRsvpEvents(prev => { const n = new Set(prev); n.has(ev.id) ? n.delete(ev.id) : n.add(ev.id); return n })}
                      style={{ alignSelf: 'center', background: rsvped ? 'rgba(56,189,248,.1)' : '#38bdf8', border: rsvped ? '1px solid rgba(56,189,248,.3)' : 'none', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: rsvped ? '#38bdf8' : '#0f172a', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {rsvped ? '✓ RSVPed' : 'RSVP'}
                    </button>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* MEMBERS */}
        {tab === 'members' && (
          <div>
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Members{members.length > 0 ? ` (${members.length})` : ''}</h2>
              <div style={{ position: 'relative', flex: '0 0 240px' }}>
                <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search members…"
                  style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(148,163,184,.15)', borderRadius: 7, padding: '0.42rem 0.75rem 0.42rem 1.8rem', fontSize: '0.83rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            {filteredMembers.length === 0
              ? <Empty icon="👥" title={members.length === 0 ? 'No members yet' : 'No results'} sub={members.length === 0 ? 'Be the first to join.' : 'Try a different name.'} />
              : filteredMembers.map(m => (
                <div key={m.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,.08)', borderRadius: 10, padding: '0.9rem 1.1rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <Av url={m.profile.avatar_url} name={m.profile.full_name} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f1f5f9' }}>{m.profile.full_name ?? 'Unknown'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>Joined {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: `${ROLE_COLOR[m.role] ?? '#64748b'}18`, border: `1px solid ${ROLE_COLOR[m.role] ?? '#64748b'}35`, borderRadius: 999, padding: '0.15rem 0.55rem', color: ROLE_COLOR[m.role] ?? '#64748b', fontWeight: 700, textTransform: 'capitalize' }}>
                    {m.role}
                  </span>
                </div>
              ))
            }
          </div>
        )}

        {/* ADMIN */}
        {tab === 'admin' && isOwner && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Community Settings</h2>
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,.1)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>General</div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>Community Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', background: 'rgba(15,23,42,.5)', border: '1px solid rgba(148,163,184,.2)', borderRadius: 7, padding: '0.55rem 0.75rem', fontSize: '0.88rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} style={{ width: '100%', background: 'rgba(15,23,42,.5)', border: '1px solid rgba(148,163,184,.2)', borderRadius: 7, padding: '0.55rem 0.75rem', fontSize: '0.85rem', color: '#f1f5f9', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'system-ui' }} />
              </div>
              <button style={{ background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Save Changes</button>
            </div>
            <div style={{ background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, padding: '1.5rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#fca5a5' }}>Danger Zone</div>
              <p style={{ fontSize: '0.83rem', color: '#64748b', marginBottom: '1rem' }}>These actions are irreversible.</p>
              <button style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 7, padding: '0.5rem 1rem', fontSize: '0.83rem', color: '#f87171', cursor: 'pointer', fontWeight: 600 }}>Archive Community</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
