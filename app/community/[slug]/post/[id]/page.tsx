'use client'
import React, { useState, use } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

interface Comment {
  id: string
  author: { full_name: string | null }
  body: string
  created_at: string
  upvotes: number
}

const MOCK_POST = {
  id: '1',
  title: 'How I went from $0 to $10k MRR in 8 months',
  body: `Eight months ago I had a side project making exactly $0. Today it does $10,200 MRR. Here's the full breakdown of what worked.

**Month 1-2: Finding the problem**
I spent the first two months talking to potential customers instead of building. I had 47 conversations before writing a single line of code. The problem I found? Small SaaS founders were spending 10+ hours per week manually writing and scheduling content.

**Month 3-4: Building the MVP**
I built the simplest version that solved the core problem. No bells and whistles. Just one core workflow that worked reliably. First version took 6 weeks to build.

**Month 5-6: First paying customers**
I posted in this community, on Indie Hackers, and Twitter. My first 10 customers came from here. The conversion from trial to paid was 40% — much higher than I expected.

**Month 7-8: Scaling what worked**
Once I had paying customers I doubled down on the channels that were working. Content, communities, and word of mouth. I resisted the urge to add more features.

Happy to answer any questions below.`,
  type: 'discussion',
  upvotes: 112,
  comment_count: 3,
  is_pinned: false,
  created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  author: { id: 'a1', full_name: 'James Okafor', avatar_url: null },
}

const MOCK_COMMENTS: Comment[] = [
  { id: 'c1', author: { full_name: 'Tom Walsh' }, body: 'This is gold. The part about talking to customers first before building resonates so much. I made the mistake of building for 4 months before validating. Never again.', created_at: new Date(Date.now() - 36 * 3600000).toISOString(), upvotes: 14 },
  { id: 'c2', author: { full_name: 'Priya Nair' }, body: 'What was your pricing when you launched? Did you change it along the way?', created_at: new Date(Date.now() - 24 * 3600000).toISOString(), upvotes: 7 },
  { id: 'c3', author: { full_name: 'Sarah Chen' }, body: 'The 40% trial-to-paid conversion rate is incredibly high. What does your onboarding look like? That must be doing a lot of the heavy lifting.', created_at: new Date(Date.now() - 12 * 3600000).toISOString(), upvotes: 11 },
]

function initials(name: string | null) {
  if (!name) return 'AN'
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function formatBody(body: string) {
  return body.split('\n').map((line, i) => {
    const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    return <p key={i} style={{ margin: '0 0 0.85rem', lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: boldLine || '&nbsp;' }} />
  })
}

export default function PostPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id: _id } = use(params)
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [upvotes, setUpvotes] = useState(MOCK_POST.upvotes)
  const [voted, setVoted] = useState(false)
  const [commentVotes, setCommentVotes] = useState<Set<string>>(new Set())

  const handleVote = () => {
    if (voted) return
    setVoted(true)
    setUpvotes(p => p + 1)
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    setSubmitting(true)
    const c: Comment = {
      id: String(Date.now()),
      author: { full_name: 'You' },
      body: newComment.trim(),
      created_at: new Date().toISOString(),
      upvotes: 0,
    }
    setComments(prev => [...prev, c])
    setNewComment('')
    setSubmitting(false)
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', padding: '2rem 1.5rem 4rem' }}>
      <style>{`
        @media (max-width: 768px) {
          .post-layout { max-width: 100% !important; padding: 1rem !important; }
        }
      `}</style>
      <div className="post-layout" style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
          <Link href="/community" style={{ color: '#64748b', textDecoration: 'none' }}>Communities</Link>
          <span>›</span>
          <Link href={`/community/${slug}`} style={{ color: '#64748b', textDecoration: 'none' }}>SaaS Builders Circle</Link>
          <span>›</span>
          <span style={{ color: '#94a3b8' }}>Post</span>
        </div>

        {/* Post */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '2rem', marginBottom: '1.5rem' }}>
          {/* Author */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
              {initials(MOCK_POST.author.full_name)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>{MOCK_POST.author.full_name}</div>
              <div style={{ fontSize: '0.75rem', color: '#475569' }}>{formatDistanceToNow(new Date(MOCK_POST.created_at), { addSuffix: true })}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.15rem 0.55rem', color: '#38bdf8', fontWeight: 600 }}>
              {MOCK_POST.type}
            </span>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3, marginBottom: '1.25rem' }}>{MOCK_POST.title}</h1>

          {/* Body */}
          <div style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.75 }}>
            {formatBody(MOCK_POST.body)}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(56,189,248,0.08)' }}>
            <button
              onClick={handleVote}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: voted ? 'rgba(56,189,248,0.1)' : 'rgba(148,163,184,0.08)', border: voted ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(148,163,184,0.15)', borderRadius: 999, padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 700, color: voted ? '#38bdf8' : '#94a3b8', cursor: voted ? 'default' : 'pointer', transition: 'all 0.15s' }}
            >
              ▲ {upvotes} {upvotes === 1 ? 'upvote' : 'upvotes'}
            </button>
            <span style={{ fontSize: '0.82rem', color: '#475569' }}>💬 {comments.length} comments</span>
          </div>
        </div>

        {/* Comments */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Comments ({comments.length})</h2>

          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                {initials(c.author.full_name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f1f5f9' }}>{c.author.full_name}</span>
                  <span style={{ fontSize: '0.73rem', color: '#475569' }}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 0.5rem' }}>{c.body}</p>
                <button
                  onClick={() => setCommentVotes(prev => { const n = new Set(prev); if (!n.has(c.id)) n.add(c.id); return n })}
                  style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: commentVotes.has(c.id) ? '#38bdf8' : '#475569', cursor: 'pointer', padding: 0 }}
                >
                  ▲ {c.upvotes + (commentVotes.has(c.id) ? 1 : 0)}
                </button>
              </div>
            </div>
          ))}

          {/* Add Comment */}
          <form onSubmit={handleComment} style={{ marginTop: '0.5rem' }}>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              style={{ width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.88rem', color: '#f1f5f9', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'system-ui', marginBottom: '0.75rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                style={{ background: newComment.trim() ? '#38bdf8' : 'rgba(56,189,248,0.3)', border: 'none', borderRadius: 7, padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: newComment.trim() ? 'pointer' : 'not-allowed' }}
              >
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
