'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['All', 'Business', 'Technology', 'Sustainability', 'Design', 'Finance', 'Community']

const MOCK_FEATURED = {
  id: '0', slug: 'trust-economy-reputation',
  title: 'The Trust Economy: Why Reputation Will Replace Resumes by 2030',
  author: { full_name: 'Amara Diallo' }, published_at: '2025-04-07T00:00:00Z',
  read_time_minutes: 8, category: 'Business',
  excerpt: 'We are entering an era where your digital reputation — built through verified actions, peer reviews, and consistent delivery — carries more weight than any piece of paper. Here is what that means for the future of work and commerce.',
  clap_count: 1240, comment_count: 87,
}

const MOCK_ARTICLES = [
  { id: '1', slug: 'consultancy-freetrust', title: 'How I Built a €20k/mo Consultancy Using Only FreeTrust', author: { full_name: 'Tom Walsh' }, published_at: '2025-04-05T00:00:00Z', read_time_minutes: 6, category: 'Business', excerpt: 'Twelve months ago I had zero clients and a LinkedIn profile. Here is the exact playbook I used to go from nothing to a thriving consultancy using community, trust, and consistency.', clap_count: 543, comment_count: 42 },
  { id: '2', slug: 'esg-reporting-sme', title: 'The Complete Guide to ESG Reporting for Small Businesses', author: { full_name: 'Amara Diallo' }, published_at: '2025-04-03T00:00:00Z', read_time_minutes: 11, category: 'Sustainability', excerpt: 'ESG reporting is no longer just for corporates. Here is how SMEs can measure, communicate and improve their environmental and social impact in a way that is simple, honest, and powerful.', clap_count: 334, comment_count: 28 },
  { id: '3', slug: 'nextjs-vs-remix-2025', title: 'Next.js 15 vs Remix: Which Should You Choose in 2025?', author: { full_name: 'Priya Nair' }, published_at: '2025-04-01T00:00:00Z', read_time_minutes: 9, category: 'Technology', excerpt: 'A deep technical comparison of the two leading React frameworks. Performance benchmarks, DX comparisons, and real-world use case recommendations.', clap_count: 891, comment_count: 134 },
  { id: '4', slug: 'design-principles', title: '10 Design Principles I Wish I Knew When I Started', author: { full_name: 'Sarah Chen' }, published_at: '2025-03-28T00:00:00Z', read_time_minutes: 7, category: 'Design', excerpt: 'After 8 years in UX and 300+ projects, these are the design principles that consistently separate good design from great design. Simple, timeless, and applicable today.', clap_count: 712, comment_count: 65 },
  { id: '5', slug: 'impact-investing-101', title: "Impact Investing 101: A Beginner's Guide to Money with Purpose", author: { full_name: 'James Okafor' }, published_at: '2025-03-25T00:00:00Z', read_time_minutes: 10, category: 'Finance', excerpt: 'You do not need to be a billionaire to invest with impact. This guide breaks down what impact investing is, how it works, and how to start with as little as €50.', clap_count: 445, comment_count: 52 },
  { id: '6', slug: 'online-communities', title: 'Building Online Communities That Actually Thrive', author: { full_name: 'Lena Fischer' }, published_at: '2025-03-22T00:00:00Z', read_time_minutes: 8, category: 'Community', excerpt: 'Most online communities die within 6 months. Here are the four psychological principles that keep members engaged, contributing, and inviting others in.', clap_count: 623, comment_count: 74 },
]

const AVATAR_GRAD: Record<string, string> = {
  AD: 'linear-gradient(135deg,#f472b6,#db2777)', TW: 'linear-gradient(135deg,#fb923c,#ea580c)',
  PN: 'linear-gradient(135deg,#a78bfa,#7c3aed)', SC: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  JO: 'linear-gradient(135deg,#34d399,#059669)', LF: 'linear-gradient(135deg,#fbbf24,#d97706)',
}

// Pravatar seeds for mock authors
const AUTHOR_AVATAR: Record<string, string> = {
  'Amara Diallo':  'https://i.pravatar.cc/150?img=45',
  'Tom Walsh':     'https://i.pravatar.cc/150?img=53',
  'Priya Nair':    'https://i.pravatar.cc/150?img=44',
  'Sarah Chen':    'https://i.pravatar.cc/150?img=47',
  'James Okafor':  'https://i.pravatar.cc/150?img=13',
  'Lena Fischer':  'https://i.pravatar.cc/150?img=41',
  'Marcus Obi':    'https://i.pravatar.cc/150?img=12',
  'Ciara Murphy':  'https://i.pravatar.cc/150?img=39',
  'Maja Eriksson': 'https://i.pravatar.cc/150?img=25',
}

const CAT_COLOR: Record<string, string> = {
  Business: '#38bdf8', Technology: '#a78bfa', Sustainability: '#34d399',
  Design: '#f472b6', Finance: '#fbbf24', Community: '#fb923c',
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '??'
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function getAvatarGrad(initials: string): string {
  return AVATAR_GRAD[initials] ?? 'linear-gradient(135deg,#38bdf8,#0284c7)'
}

function formatDate(iso: string) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return '' }
}

type DBArticle = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  tags: string[]
  clap_count: number
  comment_count: number
  read_time_minutes: number
  published_at: string | null
  author: { full_name: string | null } | null
}

export default function ArticlesPage() {
  const [activeCat, setActiveCat] = useState('All')
  const [dbArticles, setDbArticles] = useState<DBArticle[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('id, slug, title, excerpt, category, tags, clap_count, comment_count, read_time_minutes, published_at, profiles!author_id(full_name)')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(50)
        if (!error && data && data.length > 0) {
          setDbArticles(data.map((a: Record<string, unknown>) => ({ ...a, author: a['profiles'] as { full_name: string | null } | null })) as DBArticle[])
        }
      } catch { /* use mock */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const allArticles: DBArticle[] = dbArticles ?? (MOCK_ARTICLES as unknown as DBArticle[])
  const featured: DBArticle = allArticles[0] ?? (MOCK_FEATURED as unknown as DBArticle)
  const rest: DBArticle[] = allArticles.length > 1 ? allArticles.slice(1) : (MOCK_ARTICLES as unknown as DBArticle[])
  const filtered = activeCat === 'All' ? rest : rest.filter(a => a.category === activeCat)

  const featInitials = getInitials(featured.author?.full_name)

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .art-featcard { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; }
        .art-layout { display: grid; grid-template-columns: 1fr 280px; gap: 2rem; max-width: 1200px; margin: 0 auto; padding: 0 1.5rem 3rem; align-items: start; }
        .art-sidebar { display: flex; flex-direction: column; gap: 1.25rem; position: sticky; top: 78px; }
        .art-card-link { text-decoration: none; color: inherit; display: block; }
        .art-card-inner { background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; transition: border-color 0.2s, transform 0.15s; }
        .art-card-link:hover .art-card-inner { border-color: rgba(56,189,248,0.28); transform: translateY(-1px); }
        .art-feat-wrap { padding: 2rem 1.5rem 0; max-width: 1200px; margin: 0 auto; }
        .art-feat-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.15); border-radius: 16px; padding: 2rem; transition: border-color 0.2s; }
        .art-feat-link { text-decoration: none; color: inherit; display: block; }
        .art-feat-link:hover .art-feat-card { border-color: rgba(56,189,248,0.35); }
        @media (max-width: 768px) {
          .art-featcard { grid-template-columns: 1fr !important; }
          .art-featcard > .art-feat-img { display: none !important; }
          .art-layout { grid-template-columns: 1fr !important; padding: 0 1rem 2rem !important; }
          .art-sidebar { display: none !important; }
          .art-feat-wrap { padding: 1rem 1rem 0 !important; }
        }
      `}</style>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Articles</h1>
          <p style={{ color: '#64748b' }}>Insights, guides and stories from the FreeTrust community</p>
        </div>
      </div>

      {/* Featured Article */}
      {!loading && (
        <div className="art-feat-wrap">
          <Link href={`/articles/${featured.slug}`} className="art-feat-link">
            <div className="art-feat-card art-featcard">
              <div>
                <span style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.75rem' }}>EDITOR&apos;S PICK</span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.25, marginBottom: '0.75rem', color: '#f1f5f9' }}>{featured.title}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1rem' }}>
                  {AUTHOR_AVATAR[featured.author?.full_name ?? '']
                    ? <img src={AUTHOR_AVATAR[featured.author?.full_name ?? '']} alt={featured.author?.full_name ?? ''} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', color: '#0f172a', background: getAvatarGrad(featInitials), flexShrink: 0 }}>{featInitials}</div>
                  }
                  <span>{featured.author?.full_name ?? 'FreeTrust Editor'}</span>
                  <span>·</span>
                  <span>{formatDate(featured.published_at ?? '')}</span>
                  <span>·</span>
                  <span>{featured.read_time_minutes} min read</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.7, marginBottom: '1.25rem' }}>{featured.excerpt}</p>
                <span style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.65rem 1.5rem', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', display: 'inline-block' }}>Read Article →</span>
              </div>
              <div className="art-feat-img" style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.1),rgba(148,163,184,0.05))', borderRadius: 12, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>📝</div>
            </div>
          </Link>
        </div>
      )}

      {/* Main layout */}
      <div className="art-layout" style={{ marginTop: '2rem' }}>
        <div>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setActiveCat(c)} style={{ padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', border: activeCat === c ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(148,163,184,0.2)', background: activeCat === c ? 'rgba(56,189,248,0.1)' : 'transparent', color: activeCat === c ? '#38bdf8' : '#94a3b8', fontWeight: activeCat === c ? 700 : 400 }}>{c}</button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.88rem', color: '#64748b' }}>{loading ? '…' : `${filtered.length} articles`}</span>
            <Link href="/articles/new" style={{ background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>+ Write Article</Link>
          </div>

          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: '#1e293b', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem', opacity: 0.5 }}>
                <div style={{ height: 12, background: '#334155', borderRadius: 6, marginBottom: '0.75rem', width: '40%' }} />
                <div style={{ height: 20, background: '#334155', borderRadius: 6, marginBottom: '0.5rem' }} />
                <div style={{ height: 14, background: '#334155', borderRadius: 6, width: '75%' }} />
              </div>
            ))
            : filtered.map(a => {
              const initials = getInitials(a.author?.full_name)
              const cat = a.category ?? 'General'
              const catCol = CAT_COLOR[cat] ?? '#38bdf8'
              return (
                <Link key={a.id} href={`/articles/${a.slug}`} className="art-card-link">
                  <div className="art-card-inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      <span style={{ borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 600, background: `${catCol}15`, color: catCol, border: `1px solid ${catCol}30` }}>{cat}</span>
                      <span style={{ fontSize: '0.75rem', color: '#475569' }}>{formatDate(a.published_at ?? '')}</span>
                      <span style={{ fontSize: '0.75rem', color: '#475569' }}>· {a.read_time_minutes} min read</span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3, marginBottom: '0.5rem' }}>{a.title}</div>
                    <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.6, marginBottom: '0.75rem' }}>{a.excerpt}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: '#475569' }}>
                      {AUTHOR_AVATAR[a.author?.full_name ?? '']
                        ? <img src={AUTHOR_AVATAR[a.author?.full_name ?? '']} alt={a.author?.full_name ?? ''} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.65rem', color: '#0f172a', background: getAvatarGrad(initials), flexShrink: 0 }}>{initials}</div>
                      }
                      <span>{a.author?.full_name ?? 'Author'}</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span>👏 {a.clap_count.toLocaleString()}</span>
                        <span>· 💬 {a.comment_count}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })
          }
        </div>

        {/* Sidebar */}
        <aside className="art-sidebar">
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f1f5f9' }}>Top Writers</div>
            {[{ name: 'Amara Diallo', count: 24, initials: 'AD' }, { name: 'Priya Nair', count: 18, initials: 'PN' }, { name: 'Tom Walsh', count: 15, initials: 'TW' }].map(w => (
              <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {AUTHOR_AVATAR[w.name]
                  ? <img src={AUTHOR_AVATAR[w.name]} alt={w.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', color: '#0f172a', background: getAvatarGrad(w.initials), flexShrink: 0 }}>{w.initials}</div>
                }
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>{w.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{w.count} articles</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f1f5f9' }}>Popular Tags</div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {['#startup', '#design', '#sustainability', '#SaaS', '#freelance', '#impact', '#AI', '#community'].map(t => (
                <span key={t} style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer' }}>{t}</span>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f1f5f9' }}>Write for FreeTrust</div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>Share your expertise with 24,000+ readers. Build your reputation and earn ₮20 Trust per article published.</p>
            <Link href="/articles/new" style={{ display: 'block', textAlign: 'center', background: '#38bdf8', borderRadius: 8, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>Start Writing</Link>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f1f5f9' }}>My Drafts</div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>Continue working on your saved drafts.</p>
            <Link href="/articles/drafts" style={{ display: 'block', textAlign: 'center', padding: '0.5rem', borderRadius: 7, border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>View Drafts</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
