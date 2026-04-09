'use client'
import React, { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { useCurrency } from '@/context/CurrencyContext'

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

interface Course {
  id: string; title: string; description: string; lesson_count: number; is_published: boolean
}

interface CommunityEvent {
  id: string; title: string; description: string; starts_at: string; ends_at: string
  is_online: boolean; meeting_url: string | null; attendee_count: number
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_COMMUNITY: Community = {
  id: '1', name: 'SaaS Builders Circle', slug: 'saas-builders-circle',
  description: 'Share learnings, get feedback, and grow your SaaS business with 1,200+ founders who have been there.',
  avatar_initials: 'SB', avatar_gradient: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  category: 'Technology', tags: ['SaaS', 'Startups', 'Dev'],
  is_paid: false, price_monthly: 0, member_count: 1240, post_count: 5600,
  is_featured: true, owner_id: 'mock-owner',
}

const MOCK_POSTS: Post[] = [
  { id: '1', title: '🚀 What MRR milestone are you working toward this quarter?', body: 'Let\'s share our goals and hold each other accountable. Post your target and current MRR below!', type: 'discussion', upvotes: 47, comment_count: 23, is_pinned: true, created_at: new Date(Date.now() - 2 * 3600000).toISOString(), author: { id: 'a1', full_name: 'Tom Walsh', avatar_url: null } },
  { id: '2', title: 'Best tools for SaaS onboarding flows in 2025?', body: 'We\'re rebuilding our onboarding from scratch. What are people using? Intercom, Appcues, custom-built?', type: 'question', upvotes: 31, comment_count: 18, is_pinned: false, created_at: new Date(Date.now() - 5 * 3600000).toISOString(), author: { id: 'a2', full_name: 'Priya Nair', avatar_url: null } },
  { id: '3', title: '📣 Weekly office hours — Thursday 5pm GMT', body: 'Join us this Thursday for our weekly founder office hours. Bring your problems, leave with clarity.', type: 'announcement', upvotes: 64, comment_count: 8, is_pinned: false, created_at: new Date(Date.now() - 1 * 86400000).toISOString(), author: { id: 'a3', full_name: 'Sarah Chen', avatar_url: null } },
  { id: '4', title: 'How I went from $0 to $10k MRR in 8 months', body: 'Sharing my full breakdown — acquisition channels, pricing decisions, what I\'d do differently.', type: 'discussion', upvotes: 112, comment_count: 41, is_pinned: false, created_at: new Date(Date.now() - 2 * 86400000).toISOString(), author: { id: 'a4', full_name: 'James Okafor', avatar_url: null } },
]

const MOCK_MEMBERS: Member[] = [
  { id: 'm1', user_id: 'u1', role: 'owner', joined_at: new Date(Date.now() - 90 * 86400000).toISOString(), profile: { full_name: 'Tom Walsh', avatar_url: null } },
  { id: 'm2', user_id: 'u2', role: 'moderator', joined_at: new Date(Date.now() - 60 * 86400000).toISOString(), profile: { full_name: 'Priya Nair', avatar_url: null } },
  { id: 'm3', user_id: 'u3', role: 'member', joined_at: new Date(Date.now() - 30 * 86400000).toISOString(), profile: { full_name: 'Sarah Chen', avatar_url: null } },
  { id: 'm4', user_id: 'u4', role: 'member', joined_at: new Date(Date.now() - 20 * 86400000).toISOString(), profile: { full_name: 'James Okafor', avatar_url: null } },
  { id: 'm5', user_id: 'u5', role: 'member', joined_at: new Date(Date.now() - 10 * 86400000).toISOString(), profile: { full_name: 'Lena Fischer', avatar_url: null } },
]

const MOCK_COURSES: Course[] = [
  { id: 'c1', title: 'SaaS Pricing Masterclass', description: 'Learn how to price your SaaS product for maximum growth.', lesson_count: 8, is_published: true },
  { id: 'c2', title: 'Zero to First 100 Customers', description: 'The complete playbook for your first 100 paying customers.', lesson_count: 12, is_published: true },
  { id: 'c3', title: 'Fundraising for Founders', description: 'How to raise your seed round.', lesson_count: 5, is_published: false },
]

const MOCK_EVENTS: CommunityEvent[] = [
  { id: 'e1', title: 'Weekly Founder Office Hours', description: 'Open Q&A with the community leadership team.', starts_at: new Date(Date.now() + 2 * 86400000).toISOString(), ends_at: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString(), is_online: true, meeting_url: 'https://meet.google.com/example', attendee_count: 34 },
  { id: 'e2', title: 'SaaS Pricing Workshop', description: 'Interactive workshop on value-based pricing strategies.', starts_at: new Date(Date.now() + 7 * 86400000).toISOString(), ends_at: new Date(Date.now() + 7 * 86400000 + 5400000).toISOString(), is_online: true, meeting_url: null, attendee_count: 67 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name: string | null) {
  if (!name) return 'ME'
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

// ─── Component ────────────────────────────────────────────────────────────────
export default function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { format } = useCurrency()
  const [tab, setTab] = useState<'feed' | 'classroom' | 'events' | 'members' | 'leaderboard' | 'admin'>('feed')
  const [community] = useState<Community>(MOCK_COMMUNITY)
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS)
  const [members] = useState<Member[]>(MOCK_MEMBERS)
  const [courses] = useState<Course[]>(MOCK_COURSES)
  const [events] = useState<CommunityEvent[]>(MOCK_EVENTS)
  const [joined, setJoined] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [postType, setPostType] = useState<'discussion' | 'question' | 'announcement'>('discussion')
  const [submitting, setSubmitting] = useState(false)
  const [postError, setPostError] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [votedPosts, setVotedPosts] = useState<Set<string>>(new Set())
  const [rsvpEvents, setRsvpEvents] = useState<Set<string>>(new Set())
  const [editName, setEditName] = useState(community.name)
  const [editDesc, setEditDesc] = useState(community.description)

  const isOwner = true // mock: replace with auth check

  // Load real posts from API (falls back gracefully to mock if API fails / table not ready)
  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/communities/${slug}/posts`)
      if (!res.ok) return
      const json = await res.json()
      if (Array.isArray(json.posts) && json.posts.length > 0) {
        setPosts(json.posts)
      }
    } catch {
      // silently keep mock data
    }
  }, [slug])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  // Sort: pinned first, then by date
  const sortedPosts = [...posts].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const filteredMembers = members.filter(m =>
    !memberSearch || (m.profile.full_name ?? '').toLowerCase().includes(memberSearch.toLowerCase())
  )

  const leaderboard = [...members].map((m, i) => ({
    ...m,
    score: Math.max(0, 200 - i * 30 + Math.floor(Math.random() * 20)),
    streak: i < 3,
  })).sort((a, b) => b.score - a.score).slice(0, 10)

  const handleVote = (postId: string) => {
    if (votedPosts.has(postId)) return
    setVotedPosts(prev => { const next = new Set(prev); next.add(postId); return next })
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p))
  }

  const handlePost = async () => {
    if (!postTitle.trim()) return
    setSubmitting(true)
    setPostError('')
    // Optimistic UI update
    const tempPost: Post = {
      id: `temp-${Date.now()}`,
      title: postTitle,
      body: postBody,
      type: postType,
      upvotes: 0,
      comment_count: 0,
      is_pinned: false,
      created_at: new Date().toISOString(),
      author: { id: 'me', full_name: 'You', avatar_url: null },
    }
    setPosts(prev => [tempPost, ...prev])
    setPostTitle('')
    setPostBody('')
    try {
      const res = await fetch(`/api/communities/${slug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: postTitle, body: postBody, type: postType }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.post) {
          // Replace temp post with real one
          setPosts(prev => prev.map(p => p.id === tempPost.id ? json.post : p))
        }
      } else {
        const json = await res.json().catch(() => ({}))
        if (json.error) setPostError(json.error)
      }
    } catch {
      // Keep optimistic post even if API fails
    }
    setSubmitting(false)
  }

  const TABS = [
    { id: 'feed', label: '💬 Feed' },
    { id: 'classroom', label: '🎓 Classroom' },
    { id: 'events', label: '📅 Events' },
    { id: 'members', label: '👥 Members' },
    { id: 'leaderboard', label: '🏆 Leaderboard' },
    ...(isOwner ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
  ] as const

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .comm-tab { transition: all 0.15s; white-space: nowrap; }
        .comm-tab:hover { color: #f1f5f9 !important; }
        .comm-post-card:hover { border-color: rgba(56,189,248,0.2) !important; }
        .comm-post-card { transition: border-color 0.15s; }
        .comm-vote-btn { transition: all 0.15s; }
        .comm-vote-btn:hover { background: rgba(56,189,248,0.15) !important; }
        @media (max-width: 768px) {
          .comm-header-grid { grid-template-columns: 1fr !important; }
          .comm-tabs { overflow-x: auto; }
          .comm-layout { padding: 1rem !important; }
        }
      `}</style>

      {/* ── Community Header ─────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(180deg, rgba(56,189,248,0.1) 0%, transparent 100%)`, borderBottom: '1px solid rgba(56,189,248,0.1)', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="comm-header-grid" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1.25rem', alignItems: 'start' }}>
            <div style={{ width: 72, height: 72, borderRadius: 16, background: community.avatar_gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.3rem', color: '#0f172a', flexShrink: 0 }}>
              {community.avatar_initials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{community.name}</h1>
                {community.is_featured && <span style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>✦ Featured</span>}
              </div>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0.35rem 0 0.75rem' }}>{community.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
                <span>👥 {community.member_count.toLocaleString()} members</span>
                <span>💬 {community.post_count.toLocaleString()} posts</span>
                <span>📁 {community.category}</span>
                {community.is_paid && <span style={{ color: '#fbbf24' }}>🔒 {format(community.price_monthly, 'GBP')}/mo</span>}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {community.tags.map(t => <span key={t} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>{t}</span>)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
              <button
                onClick={() => setJoined(p => !p)}
                style={{ background: joined ? 'rgba(56,189,248,0.1)' : '#38bdf8', border: joined ? '1px solid rgba(56,189,248,0.3)' : 'none', borderRadius: 8, padding: '0.55rem 1.25rem', fontSize: '0.88rem', fontWeight: 700, color: joined ? '#38bdf8' : '#0f172a', cursor: 'pointer' }}
              >
                {joined ? '✓ Joined' : community.is_paid ? `Join ${format(community.price_monthly, 'GBP')}/mo` : 'Join Community'}
              </button>
              {isOwner && (
                <Link href={`/community/${slug}/admin`} style={{ fontSize: '0.78rem', color: '#64748b', textDecoration: 'none' }}>
                  ⚙️ Manage
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Nav ───────────────────────────────────────────────── */}
      <div className="comm-tabs" style={{ borderBottom: '1px solid rgba(56,189,248,0.08)', background: 'rgba(15,23,42,0.8)', overflowX: 'auto' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', padding: '0 1.5rem' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              className="comm-tab"
              onClick={() => setTab(t.id as typeof tab)}
              style={{ padding: '0.85rem 1rem', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #38bdf8' : '2px solid transparent', color: tab === t.id ? '#38bdf8' : '#64748b', fontWeight: tab === t.id ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────── */}
      <div className="comm-layout" style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>

        {/* FEED */}
        {tab === 'feed' && (
          <div>
            {/* Post Composer */}
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {(['discussion', 'question', 'announcement'] as const).map(t => (
                  <button key={t} onClick={() => setPostType(t)} style={{ padding: '0.3rem 0.8rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600, border: postType === t ? `1px solid ${TYPE_COLOR[t]}` : '1px solid rgba(148,163,184,0.15)', background: postType === t ? `${TYPE_COLOR[t]}18` : 'transparent', color: postType === t ? TYPE_COLOR[t] : '#64748b', cursor: 'pointer' }}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              <input
                value={postTitle}
                onChange={e => setPostTitle(e.target.value)}
                placeholder="Post title..."
                style={{ width: '100%', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 7, padding: '0.55rem 0.8rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem' }}
              />
              <textarea
                value={postBody}
                onChange={e => setPostBody(e.target.value)}
                placeholder="Share something with the community..."
                rows={3}
                style={{ width: '100%', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 7, padding: '0.55rem 0.8rem', fontSize: '0.85rem', color: '#f1f5f9', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'system-ui', marginBottom: '0.75rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {postError
                  ? <span style={{ fontSize: '0.78rem', color: '#f87171' }}>{postError}</span>
                  : <span />
                }
                <button onClick={handlePost} disabled={!postTitle.trim() || submitting} style={{ background: postTitle.trim() ? '#38bdf8' : 'rgba(56,189,248,0.3)', border: 'none', borderRadius: 7, padding: '0.45rem 1.1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: postTitle.trim() ? 'pointer' : 'not-allowed' }}>
                  {submitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>

            {/* Post List */}
            {sortedPosts.map(post => (
              <Link key={post.id} href={`/community/${slug}/post/${post.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div className="comm-post-card" style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1.1rem 1.25rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    {post.is_pinned && <span style={{ fontSize: '0.72rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 999, padding: '0.1rem 0.5rem', color: '#fbbf24', fontWeight: 700 }}>📌 Pinned</span>}
                    <span style={{ fontSize: '0.72rem', background: `${TYPE_COLOR[post.type]}18`, border: `1px solid ${TYPE_COLOR[post.type]}30`, borderRadius: 999, padding: '0.1rem 0.5rem', color: TYPE_COLOR[post.type], fontWeight: 600 }}>{TYPE_LABEL[post.type]}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9', marginBottom: '0.4rem' }}>{post.title}</div>
                  {post.body && <p style={{ fontSize: '0.83rem', color: '#64748b', margin: '0 0 0.75rem', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{post.body}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#0f172a' }}>{initials(post.author.full_name)}</div>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{post.author.full_name}</span>
                    <span style={{ fontSize: '0.75rem', color: '#475569' }}>· {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        className="comm-vote-btn"
                        onClick={e => { e.preventDefault(); handleVote(post.id) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: votedPosts.has(post.id) ? 'rgba(56,189,248,0.1)' : 'transparent', border: votedPosts.has(post.id) ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(148,163,184,0.15)', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.78rem', color: votedPosts.has(post.id) ? '#38bdf8' : '#64748b', cursor: 'pointer' }}
                      >
                        ▲ {post.upvotes}
                      </button>
                      <span style={{ fontSize: '0.78rem', color: '#475569' }}>💬 {post.comment_count}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CLASSROOM */}
        {tab === 'classroom' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Courses</h2>
              {isOwner && (
                <Link href={`/community/${slug}/courses/new`} style={{ background: '#38bdf8', color: '#0f172a', borderRadius: 7, padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
                  + New Course
                </Link>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {courses.map(course => (
                <Link key={course.id} href={`/community/${slug}/courses/${course.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                      <div style={{ fontSize: '2rem' }}>🎓</div>
                      <span style={{ fontSize: '0.7rem', background: course.is_published ? 'rgba(52,211,153,0.1)' : 'rgba(148,163,184,0.1)', border: `1px solid ${course.is_published ? 'rgba(52,211,153,0.3)' : 'rgba(148,163,184,0.2)'}`, borderRadius: 999, padding: '0.15rem 0.5rem', color: course.is_published ? '#34d399' : '#64748b', fontWeight: 600 }}>
                        {course.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9', marginBottom: '0.4rem' }}>{course.title}</div>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 0.75rem', lineHeight: 1.5 }}>{course.description}</p>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>📖 {course.lesson_count} lessons</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* EVENTS */}
        {tab === 'events' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Upcoming Events</h2>
              {isOwner && (
                <button style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 7, padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                  + Create Event
                </button>
              )}
            </div>
            {events.map(ev => {
              const start = new Date(ev.starts_at)
              const rsvped = rsvpEvents.has(ev.id)
              return (
                <div key={ev.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '0.6rem 1rem', textAlign: 'center', flexShrink: 0, minWidth: 60 }}>
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
                    </div>
                  </div>
                  <button
                    onClick={() => setRsvpEvents(prev => { const n = new Set(prev); n.has(ev.id) ? n.delete(ev.id) : n.add(ev.id); return n })}
                    style={{ alignSelf: 'center', background: rsvped ? 'rgba(56,189,248,0.1)' : '#38bdf8', border: rsvped ? '1px solid rgba(56,189,248,0.3)' : 'none', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: rsvped ? '#38bdf8' : '#0f172a', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {rsvped ? '✓ RSVPed' : 'RSVP'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* MEMBERS */}
        {tab === 'members' && (
          <div>
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Members ({members.length})</h2>
              <div style={{ position: 'relative', flex: '0 0 240px' }}>
                <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search members..." style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 7, padding: '0.42rem 0.75rem 0.42rem 1.8rem', fontSize: '0.83rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            {filteredMembers.map(m => (
              <div key={m.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 10, padding: '0.9rem 1.1rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                  {initials(m.profile.full_name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f1f5f9' }}>{m.profile.full_name ?? 'Unknown'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>Joined {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}</div>
                </div>
                <span style={{ fontSize: '0.72rem', background: `${ROLE_COLOR[m.role]}18`, border: `1px solid ${ROLE_COLOR[m.role]}35`, borderRadius: 999, padding: '0.15rem 0.55rem', color: ROLE_COLOR[m.role], fontWeight: 700, textTransform: 'capitalize' }}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* LEADERBOARD */}
        {tab === 'leaderboard' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Top Contributors</h2>
            {leaderboard.map((m, i) => (
              <div key={m.id} style={{ background: '#1e293b', border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : i === 1 ? 'rgba(148,163,184,0.2)' : i === 2 ? 'rgba(251,146,60,0.2)' : 'rgba(56,189,248,0.08)'}`, borderRadius: 10, padding: '0.9rem 1.1rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: i === 0 ? 'rgba(251,191,36,0.15)' : i === 1 ? 'rgba(148,163,184,0.1)' : i === 2 ? 'rgba(251,146,60,0.1)' : 'rgba(56,189,248,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: i < 3 ? '1.1rem' : '0.9rem', color: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#fb923c' : '#475569', flexShrink: 0 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </div>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                  {initials(m.profile.full_name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {m.profile.full_name ?? 'Unknown'}
                    {m.streak && <span style={{ fontSize: '0.75rem' }}>🔥 streak</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>Score: {m.score} pts</div>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: i === 0 ? '#fbbf24' : '#64748b' }}>{m.score}</div>
              </div>
            ))}
          </div>
        )}

        {/* ADMIN */}
        {tab === 'admin' && isOwner && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Community Settings</h2>

            {/* Settings */}
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>General</div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>Community Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 7, padding: '0.55rem 0.75rem', fontSize: '0.88rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} style={{ width: '100%', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 7, padding: '0.55rem 0.75rem', fontSize: '0.85rem', color: '#f1f5f9', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'system-ui' }} />
              </div>
              <button style={{ background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Save Changes</button>
            </div>

            {/* Member Management */}
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>Member Management</div>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid rgba(56,189,248,0.05)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{initials(m.profile.full_name)}</div>
                  <span style={{ flex: 1, fontSize: '0.88rem', color: '#f1f5f9' }}>{m.profile.full_name}</span>
                  <select defaultValue={m.role} style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, padding: '0.3rem 0.5rem', fontSize: '0.78rem', color: '#94a3b8', outline: 'none' }}>
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                    <option value="owner">Owner</option>
                  </select>
                  {m.role !== 'owner' && (
                    <button style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#fca5a5', cursor: 'pointer' }}>Remove</button>
                  )}
                </div>
              ))}
            </div>

            {/* Danger Zone */}
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '1.5rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#fca5a5' }}>Danger Zone</div>
              <p style={{ fontSize: '0.83rem', color: '#64748b', marginBottom: '1rem' }}>These actions are irreversible. Please proceed with caution.</p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 7, padding: '0.5rem 1rem', fontSize: '0.83rem', color: '#fbbf24', cursor: 'pointer', fontWeight: 600 }}>Archive Community</button>
                <button style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, padding: '0.5rem 1rem', fontSize: '0.83rem', color: '#f87171', cursor: 'pointer', fontWeight: 600 }}>Delete Community</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
