'use client'
import React, { useState } from 'react'
import Link from 'next/link'

const posts = [
  {
    id: 1, author: 'Sarah Chen', handle: '@sarahchen', avatar: 'SC', role: 'Product Designer', time: '2h',
    content: 'Just launched my new UI kit on FreeTrust! 47 components, fully accessible, built with love. Check it out in the marketplace 🎨',
    likes: 84, comments: 12, shares: 6, tags: ['design', 'ui', 'figma'],
    image: false,
  },
  {
    id: 2, author: 'Marcus Obi', handle: '@marcobi', avatar: 'MO', role: 'Sustainability Consultant', time: '4h',
    content: 'Our community planted 2,000 trees last quarter through the FreeTrust Impact Fund. Small actions compound into massive change. Who wants to join our next project? 🌱',
    likes: 231, comments: 34, shares: 51, tags: ['impact', 'sustainability', 'community'],
    image: false,
  },
  {
    id: 3, author: 'Priya Nair', handle: '@priyanair', avatar: 'PN', role: 'Full-Stack Developer', time: '6h',
    content: 'Hot take: The future of work is trust-based networks, not CVs. When your reputation travels with you across platforms, credentials become secondary. FreeTrust is proving this model works.',
    likes: 512, comments: 87, shares: 143, tags: ['future-of-work', 'trust', 'career'],
    image: false,
  },
  {
    id: 4, author: 'Tom Walsh', handle: '@tomwalsh', avatar: 'TW', role: 'Freelance Photographer', time: '8h',
    content: 'Closed my first £5k project through FreeTrust this week. The client found me via my community posts, not a cold pitch. This platform changes everything for creatives.',
    likes: 167, comments: 29, shares: 18, tags: ['freelance', 'photography', 'win'],
    image: false,
  },
  {
    id: 5, author: 'Amara Diallo', handle: '@amaradiallo', avatar: 'AD', role: 'Community Builder', time: '12h',
    content: 'Just hit 500 members in the "African Founders Network" community 🎉 We are running a live Q&A with 3 successful founders next Tuesday. Link in bio!',
    likes: 389, comments: 56, shares: 92, tags: ['founders', 'africa', 'community'],
    image: false,
  },
]

const trending = ['#TrustEconomy', '#FreelanceLife', '#ImpactInvesting', '#BuildInPublic', '#SustainableBusiness', '#CreatorEconomy']

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  layout: { maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', alignItems: 'start' },
  main: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  composeBox: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 12, padding: '1.25rem', marginBottom: '0.5rem' },
  composeInner: { display: 'flex', gap: '0.75rem', alignItems: 'flex-start' },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', flexShrink: 0 },
  composePlaceholder: { flex: 1, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.75rem 1rem', color: '#475569', fontSize: '0.9rem', cursor: 'text' },
  postCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' },
  postHeader: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' },
  postMeta: { flex: 1 },
  authorName: { fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9' },
  authorRole: { fontSize: '0.78rem', color: '#64748b' },
  postTime: { fontSize: '0.78rem', color: '#475569' },
  postContent: { fontSize: '0.92rem', lineHeight: 1.65, color: '#cbd5e1', marginBottom: '0.75rem' },
  tags: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  tag: { background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.75rem', color: '#38bdf8' },
  actions: { display: 'flex', gap: '1.5rem', borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: '0.75rem' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#64748b', cursor: 'pointer', background: 'none', border: 'none', padding: 0, transition: 'color 0.15s' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: 78 },
  sideCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' },
  sideTitle: { fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f1f5f9' },
  trendTag: { display: 'block', padding: '0.4rem 0', fontSize: '0.85rem', color: '#38bdf8', textDecoration: 'none', borderBottom: '1px solid rgba(56,189,248,0.06)' },
  whoItem: { display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.75rem' },
  followBtn: { marginLeft: 'auto', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer' },
}

function avatarColors(initials: string) {
  const colors = [
    'linear-gradient(135deg,#38bdf8,#0284c7)',
    'linear-gradient(135deg,#a78bfa,#7c3aed)',
    'linear-gradient(135deg,#34d399,#059669)',
    'linear-gradient(135deg,#f472b6,#db2777)',
    'linear-gradient(135deg,#fb923c,#ea580c)',
  ]
  return colors[initials.charCodeAt(0) % colors.length]
}

export default function FeedPage() {
  const [liked, setLiked] = useState<Set<number>>(new Set())

  const toggle = (id: number) => {
    setLiked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div style={S.page}>
      {/* Page header */}
      <div style={{ borderBottom: '1px solid rgba(56,189,248,0.08)', padding: '1.5rem 1.5rem 1rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Community Feed</h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '0.25rem' }}>What&apos;s happening in the FreeTrust community</p>
        </div>
      </div>

      <div style={S.layout}>
        <div style={S.main}>
          {/* Compose */}
          <div style={S.composeBox}>
            <div style={S.composeInner}>
              <div style={{ ...S.avatar, background: 'linear-gradient(135deg,#38bdf8,#0284c7)' }}>YO</div>
              <div style={S.composePlaceholder}>Share something with the community…</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', paddingLeft: '3.25rem' }}>
              {['📷 Photo', '🔗 Link', '📅 Event', '📊 Poll'].map(a => (
                <button key={a} style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 6, padding: '0.3rem 0.7rem', fontSize: '0.78rem', color: '#64748b', cursor: 'pointer' }}>{a}</button>
              ))}
              <button style={{ marginLeft: 'auto', background: '#38bdf8', border: 'none', borderRadius: 6, padding: '0.3rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Post</button>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {['All', 'Following', 'Trending', 'Impact'].map((tab, i) => (
              <button key={tab} style={{ padding: '0.35rem 0.9rem', borderRadius: 6, fontSize: '0.82rem', fontWeight: i === 0 ? 700 : 500, background: i === 0 ? 'rgba(56,189,248,0.1)' : 'transparent', border: `1px solid ${i === 0 ? 'rgba(56,189,248,0.3)' : 'rgba(148,163,184,0.15)'}`, color: i === 0 ? '#38bdf8' : '#64748b', cursor: 'pointer' }}>{tab}</button>
            ))}
          </div>

          {/* Posts */}
          {posts.map(post => (
            <div key={post.id} style={S.postCard}>
              <div style={S.postHeader}>
                <div style={{ ...S.avatar, background: avatarColors(post.avatar) }}>{post.avatar}</div>
                <div style={S.postMeta}>
                  <div style={S.authorName}>{post.author}</div>
                  <div style={S.authorRole}>{post.role} · {post.handle}</div>
                </div>
                <span style={S.postTime}>{post.time}</span>
              </div>
              <p style={S.postContent}>{post.content}</p>
              <div style={S.tags}>
                {post.tags.map(t => <span key={t} style={S.tag}>#{t}</span>)}
              </div>
              <div style={S.actions}>
                <button style={{ ...S.actionBtn, color: liked.has(post.id) ? '#38bdf8' : '#64748b' }} onClick={() => toggle(post.id)}>
                  {liked.has(post.id) ? '❤️' : '🤍'} {post.likes + (liked.has(post.id) ? 1 : 0)}
                </button>
                <button style={S.actionBtn}>💬 {post.comments}</button>
                <button style={S.actionBtn}>🔁 {post.shares}</button>
                <button style={S.actionBtn}>🔖 Save</button>
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <aside style={S.sidebar}>
          {/* Trending */}
          <div style={S.sideCard}>
            <div style={S.sideTitle}>Trending Topics</div>
            {trending.map(tag => (
              <Link key={tag} href="#" style={S.trendTag}>{tag}</Link>
            ))}
          </div>

          {/* Who to follow */}
          <div style={S.sideCard}>
            <div style={S.sideTitle}>Who to Follow</div>
            {[
              { name: 'Lena Fischer', role: 'UX Researcher', initials: 'LF' },
              { name: 'James Okafor', role: 'Impact Investor', initials: 'JO' },
              { name: 'Yuki Tanaka', role: 'Tech Founder', initials: 'YT' },
            ].map(u => (
              <div key={u.name} style={S.whoItem}>
                <div style={{ ...S.avatar, width: 34, height: 34, fontSize: '0.75rem', background: avatarColors(u.initials) }}>{u.initials}</div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.role}</div>
                </div>
                <button style={S.followBtn}>Follow</button>
              </div>
            ))}
          </div>

          {/* Impact snapshot */}
          <div style={{ ...S.sideCard, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)' }}>
            <div style={S.sideTitle}>🌱 Today&apos;s Impact</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>£4,280</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>contributed to Impact Fund today</div>
            <Link href="/impact" style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none' }}>See projects →</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
