'use client'
import React, { useState } from 'react'

const categories = ['All', 'Business', 'Technology', 'Sustainability', 'Design', 'Finance', 'Community']

const featured = {
  id: 0, title: 'The Trust Economy: Why Reputation Will Replace Resumes by 2030',
  author: 'Amara Diallo', avatar: 'AD', date: '7 Apr 2025', readTime: '8 min read', category: 'Business',
  excerpt: 'We are entering an era where your digital reputation — built through verified actions, peer reviews, and consistent delivery — carries more weight than any piece of paper. Here is what that means for the future of work and commerce.',
  claps: 1240, comments: 87,
}

const articles = [
  {
    id: 1, title: 'How I Built a £20k/mo Consultancy Using Only FreeTrust', author: 'Tom Walsh', avatar: 'TW',
    date: '5 Apr 2025', readTime: '6 min read', category: 'Business',
    excerpt: 'Twelve months ago I had zero clients and a LinkedIn profile. Here is the exact playbook I used to go from nothing to a thriving consultancy using community, trust, and consistency.',
    claps: 543, comments: 42,
  },
  {
    id: 2, title: 'The Complete Guide to ESG Reporting for Small Businesses', author: 'Amara Diallo', avatar: 'AD',
    date: '3 Apr 2025', readTime: '11 min read', category: 'Sustainability',
    excerpt: 'ESG reporting is no longer just for corporates. Here is how SMEs can measure, communicate and improve their environmental and social impact in a way that is simple, honest, and powerful.',
    claps: 334, comments: 28,
  },
  {
    id: 3, title: 'Next.js 15 vs Remix: Which Should You Choose in 2025?', author: 'Priya Nair', avatar: 'PN',
    date: '1 Apr 2025', readTime: '9 min read', category: 'Technology',
    excerpt: 'A deep technical comparison of the two leading React frameworks. Performance benchmarks, DX comparisons, and real-world use case recommendations.',
    claps: 891, comments: 134,
  },
  {
    id: 4, title: '10 Design Principles I Wish I Knew When I Started', author: 'Sarah Chen', avatar: 'SC',
    date: '28 Mar 2025', readTime: '7 min read', category: 'Design',
    excerpt: 'After 8 years in UX and 300+ projects, these are the design principles that consistently separate good design from great design. Simple, timeless, and applicable today.',
    claps: 712, comments: 65,
  },
  {
    id: 5, title: 'Impact Investing 101: A Beginner\'s Guide to Money with Purpose', author: 'James Okafor', avatar: 'JO',
    date: '25 Mar 2025', readTime: '10 min read', category: 'Finance',
    excerpt: 'You do not need to be a billionaire to invest with impact. This guide breaks down what impact investing is, how it works, and how to start with as little as £50.',
    claps: 445, comments: 52,
  },
  {
    id: 6, title: 'Building Online Communities That Actually Thrive', author: 'Lena Fischer', avatar: 'LF',
    date: '22 Mar 2025', readTime: '8 min read', category: 'Community',
    excerpt: 'Most online communities die within 6 months. Here are the four psychological principles that keep members engaged, contributing, and inviting others in.',
    claps: 623, comments: 74,
  },
]

const avatarGrad: Record<string, string> = {
  AD: 'linear-gradient(135deg,#f472b6,#db2777)',
  TW: 'linear-gradient(135deg,#fb923c,#ea580c)',
  PN: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
  SC: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  JO: 'linear-gradient(135deg,#34d399,#059669)',
  LF: 'linear-gradient(135deg,#fbbf24,#d97706)',
}

const catColor: Record<string, string> = {
  Business: '#38bdf8', Technology: '#a78bfa', Sustainability: '#34d399',
  Design: '#f472b6', Finance: '#fbbf24', Community: '#fb923c',
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  inner: { maxWidth: 1200, margin: '0 auto' },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  featCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 16, padding: '2rem', margin: '2rem 1.5rem', maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center' },
  featLabel: { display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.75rem' },
  featTitle: { fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.25, marginBottom: '0.75rem', color: '#f1f5f9' },
  featExcerpt: { fontSize: '0.88rem', color: '#64748b', lineHeight: 1.7, marginBottom: '1.25rem' },
  avatar: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', color: '#0f172a' },
  authorRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1rem' },
  readBtn: { background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.65rem 1.5rem', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', display: 'inline-block' },
  layout: { maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem 3rem', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '2rem', alignItems: 'start' },
  catRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' },
  catBtn: { padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8' },
  catBtnActive: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700 },
  articleCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' },
  articleMeta: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' },
  catBadge: { borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 },
  articleTitle: { fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3, marginBottom: '0.5rem' },
  articleExcerpt: { fontSize: '0.83rem', color: '#64748b', lineHeight: 1.6, marginBottom: '0.75rem' },
  articleFooter: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: '#475569' },
  claps: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' },
  sidebar: { position: 'sticky', top: 78 },
  sideCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' },
  sideTitle: { fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f1f5f9' },
}

export default function ArticlesPage() {
  const [activeCat, setActiveCat] = useState('All')

  const filtered = activeCat === 'All' ? articles : articles.filter(a => a.category === activeCat)

  return (
    <div style={S.page}>
      <style>{`
        .articles-featcard { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; }
        .articles-layout { display: grid; grid-template-columns: 1fr 280px; gap: 2rem; max-width: 1200px; margin: 0 auto; padding: 0 1.5rem 3rem; align-items: start; }
        .articles-sidebar { display: flex; flex-direction: column; gap: 1.25rem; position: sticky; top: 78px; }
        @media (max-width: 768px) {
          .articles-featcard { grid-template-columns: 1fr !important; }
          .articles-featcard > div:last-child { display: none !important; }
          .articles-layout { grid-template-columns: 1fr !important; padding: 0 1rem 2rem !important; }
          .articles-sidebar { display: none !important; }
          .articles-hero { padding: 1.5rem 1rem 1.25rem !important; }
          .articles-featured-wrap { padding: 1rem 1rem 0 !important; }
        }
      `}</style>
      <div className="articles-hero" style={S.hero}>
        <div style={S.inner}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Articles</h1>
          <p style={{ color: '#64748b' }}>Insights, guides and stories from the FreeTrust community</p>
        </div>
      </div>

      {/* Featured Article */}
      <div className="articles-featured-wrap" style={{ padding: '2rem 1.5rem 0', maxWidth: 1200, margin: '0 auto' }}>
        <div className="articles-featcard" style={S.featCard}>
          <div>
            <span style={S.featLabel}>EDITOR&apos;S PICK</span>
            <h2 style={S.featTitle}>{featured.title}</h2>
            <div style={S.authorRow}>
              <div style={{ ...S.avatar, background: avatarGrad[featured.avatar] }}>{featured.avatar}</div>
              <span>{featured.author}</span>
              <span>·</span>
              <span>{featured.date}</span>
              <span>·</span>
              <span>{featured.readTime}</span>
            </div>
            <p style={S.featExcerpt}>{featured.excerpt}</p>
            <button style={S.readBtn}>Read Article →</button>
          </div>
          <div style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.1),rgba(148,163,184,0.05))', borderRadius: 12, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>
            📝
          </div>
        </div>
      </div>

      <div className="articles-layout" style={S.layout}>
        <div>
          <div style={S.catRow}>
            {categories.map(c => (
              <button key={c} onClick={() => setActiveCat(c)} style={{ ...S.catBtn, ...(activeCat === c ? S.catBtnActive : {}) }}>{c}</button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.88rem', color: '#64748b' }}>{filtered.length} articles</span>
            <button style={{ background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>+ Write Article</button>
          </div>

          {filtered.map(a => (
            <div key={a.id} style={S.articleCard}>
              <div style={S.articleMeta}>
                <span style={{ ...S.catBadge, background: `${catColor[a.category]}15`, color: catColor[a.category], border: `1px solid ${catColor[a.category]}30` }}>{a.category}</span>
                <span style={{ fontSize: '0.75rem', color: '#475569' }}>{a.date}</span>
                <span style={{ fontSize: '0.75rem', color: '#475569' }}>· {a.readTime}</span>
              </div>
              <div style={S.articleTitle}>{a.title}</div>
              <p style={S.articleExcerpt}>{a.excerpt}</p>
              <div style={S.articleFooter}>
                <div style={{ ...S.avatar, width: 24, height: 24, fontSize: '0.65rem', background: avatarGrad[a.avatar] }}>{a.avatar}</div>
                <span>{a.author}</span>
                <div style={S.claps}>
                  <span>👏 {a.claps.toLocaleString()}</span>
                  <span>· 💬 {a.comments}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="articles-sidebar" style={S.sidebar}>
          <div style={S.sideCard}>
            <div style={S.sideTitle}>Top Writers</div>
            {[
              { name: 'Amara Diallo', articles: 24, avatar: 'AD' },
              { name: 'Priya Nair', articles: 18, avatar: 'PN' },
              { name: 'Tom Walsh', articles: 15, avatar: 'TW' },
            ].map(w => (
              <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ ...S.avatar, width: 32, height: 32, background: avatarGrad[w.avatar] }}>{w.avatar}</div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{w.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{w.articles} articles</div>
                </div>
              </div>
            ))}
          </div>

          <div style={S.sideCard}>
            <div style={S.sideTitle}>Popular Tags</div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {['#startup', '#design', '#sustainability', '#SaaS', '#freelance', '#impact', '#AI', '#community'].map(t => (
                <span key={t} style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer' }}>{t}</span>
              ))}
            </div>
          </div>

          <div style={{ ...S.sideCard, background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.15)' }}>
            <div style={S.sideTitle}>Write for FreeTrust</div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>Share your expertise with 24,000+ readers. Build your reputation and grow your audience.</p>
            <button style={{ width: '100%', background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Start Writing</button>
          </div>
        </aside>
      </div>
    </div>
  )
}
