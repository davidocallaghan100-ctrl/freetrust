'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const AVATAR_GRAD: Record<string, string> = {
  AD: 'linear-gradient(135deg,#f472b6,#db2777)', TW: 'linear-gradient(135deg,#fb923c,#ea580c)',
  PN: 'linear-gradient(135deg,#a78bfa,#7c3aed)', SC: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  JO: 'linear-gradient(135deg,#34d399,#059669)', LF: 'linear-gradient(135deg,#fbbf24,#d97706)',
}

const CAT_COLOR: Record<string, string> = {
  Business: '#38bdf8', Technology: '#a78bfa', Sustainability: '#34d399',
  Design: '#f472b6', Finance: '#fbbf24', Community: '#fb923c',
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '??'
  return name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)
}

function getAvatarGrad(initials: string): string {
  return AVATAR_GRAD[initials] ?? 'linear-gradient(135deg,#38bdf8,#0284c7)'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return '' }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type Author = { id: string; full_name: string | null; avatar_url: string | null; bio: string | null }
type Article = {
  id: string; slug: string; title: string; excerpt: string | null; body: string;
  featured_image_url: string | null; status: string; category: string | null;
  tags: string[]; clap_count: number; comment_count: number; read_time_minutes: number;
  published_at: string | null; author_id: string;
  author: Author | null
}
type Comment = { id: string; author_id: string; body: string; created_at: string; author: Author | null }
type RelatedArticle = { id: string; slug: string; title: string; clap_count: number; read_time_minutes: number; author: Author | null }

export default function ArticlePage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [article, setArticle] = useState<Article | null>(null)
  const [related, setRelated] = useState<RelatedArticle[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [clapCount, setClapCount] = useState(0)
  const [userClapCount, setUserClapCount] = useState(0)
  const [clapAnimating, setClapAnimating] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [authorArticleCount, setAuthorArticleCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const articleContentRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Reading progress bar
  useEffect(() => {
    const handleScroll = () => {
      const el = articleContentRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const totalHeight = el.offsetHeight
      const scrolled = Math.max(0, -rect.top)
      const progress = Math.min(100, (scrolled / totalHeight) * 100)
      setScrollProgress(progress)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    // Fetch article
    const { data: art, error: artErr } = await supabase
      .from('articles')
      .select('*, profiles!author_id(id, full_name, avatar_url, bio)')
      .eq('slug', slug)
      .single()

    if (artErr || !art) { setNotFound(true); setLoading(false); return }

    const mappedArt: Article = { ...art, author: art.profiles as Author | null }
    setArticle(mappedArt)
    setClapCount(art.clap_count ?? 0)

    // Fetch user clap count
    if (user) {
      const { count } = await supabase.from('article_claps').select('*', { count: 'exact', head: true }).eq('article_id', art.id).eq('user_id', user.id)
      setUserClapCount(count ?? 0)
    }

    // Fetch comments
    const { data: cmts } = await supabase
      .from('article_comments')
      .select('*, profiles!author_id(id, full_name, avatar_url, bio)')
      .eq('article_id', art.id)
      .order('created_at', { ascending: true })
    setComments((cmts ?? []).map((c: Record<string, unknown>) => ({ ...c, author: c.profiles as Author | null })) as Comment[])

    // Fetch related articles (same category, excluding current)
    if (art.category) {
      const { data: rel } = await supabase
        .from('articles')
        .select('id, slug, title, clap_count, read_time_minutes, profiles!author_id(id, full_name, avatar_url, bio)')
        .eq('status', 'published')
        .eq('category', art.category)
        .neq('id', art.id)
        .order('clap_count', { ascending: false })
        .limit(3)
      setRelated((rel ?? []).map((r: Record<string, unknown>) => ({ ...r, author: r.profiles as Author | null })) as RelatedArticle[])
    }

    // Author article count
    if (art.author_id) {
      const { count: ac } = await supabase.from('articles').select('*', { count: 'exact', head: true }).eq('author_id', art.author_id).eq('status', 'published')
      setAuthorArticleCount(ac ?? 0)
    }

    setLoading(false)
  }, [slug])

  useEffect(() => { loadAll() }, [loadAll])

  const handleClap = async () => {
    if (!userId) { router.push('/auth/login'); return }
    if (!article || userClapCount >= 50) return
    setClapAnimating(true)
    setTimeout(() => setClapAnimating(false), 400)
    const newUserCount = Math.min(userClapCount + 1, 50)
    setUserClapCount(newUserCount)
    setClapCount(prev => prev + 1)
    await supabase.from('article_claps').insert({ article_id: article.id, user_id: userId })
    await supabase.from('articles').update({ clap_count: clapCount + 1 }).eq('id', article.id)
  }

  const handleComment = async () => {
    if (!userId) { router.push('/auth/login'); return }
    if (!commentText.trim() || !article) return
    setSubmittingComment(true)
    const { data: newComment, error } = await supabase
      .from('article_comments')
      .insert({ article_id: article.id, author_id: userId, body: commentText.trim() })
      .select('*, profiles!author_id(id, full_name, avatar_url, bio)')
      .single()
    if (!error && newComment) {
      setComments(prev => [...prev, { ...newComment, author: newComment.profiles as Author | null }])
      // Sync the cached articles.comment_count to the real total. The previous
      // formula (article.comment_count + comments.length + 1) compounded any
      // existing error in the cached column.
      await supabase.from('articles').update({ comment_count: comments.length + 1 }).eq('id', article.id)
      setCommentText('')
    }
    setSubmittingComment(false)
  }

  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading article…</div>
    </div>
  )

  if (notFound || !article) return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <div style={{ fontSize: '3rem' }}>📄</div>
      <h1 style={{ color: '#f1f5f9', fontWeight: 800 }}>Article not found</h1>
      <Link href="/articles" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to Articles</Link>
    </div>
  )

  const authorInitials = getInitials(article.author?.full_name)
  const isAuthor = userId === article.author_id
  const catColor = CAT_COLOR[article.category ?? ''] ?? '#38bdf8'

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .art-read-layout { display: grid; grid-template-columns: 1fr 300px; gap: 2.5rem; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 4rem; align-items: start; }
        .art-read-sidebar { position: sticky; top: 78px; display: flex; flex-direction: column; gap: 1.25rem; }
        .art-body { font-size: 1.05rem; line-height: 1.85; color: #cbd5e1; }
        .art-body h2 { font-size: 1.5rem; font-weight: 700; margin: 1.75rem 0 0.75rem; color: #f1f5f9; }
        .art-body h3 { font-size: 1.2rem; font-weight: 600; margin: 1.5rem 0 0.5rem; color: #f1f5f9; }
        .art-body blockquote { border-left: 3px solid #38bdf8; padding: 0.5rem 1rem; margin: 1.25rem 0; color: #94a3b8; font-style: italic; background: rgba(56,189,248,0.04); border-radius: 0 8px 8px 0; }
        .art-body ul, .art-body ol { padding-left: 1.5rem; margin: 0.75rem 0; }
        .art-body li { margin-bottom: 0.4rem; }
        .art-body pre, .art-body code { background: #0c1628; border: 1px solid rgba(56,189,248,0.15); border-radius: 8px; padding: 0.9rem 1.1rem; font-family: monospace; font-size: 0.88rem; color: #7dd3fc; display: block; margin: 1rem 0; white-space: pre-wrap; overflow-x: auto; }
        .art-body a { color: #38bdf8; }
        .art-body p { margin: 0.75rem 0; }
        .clap-btn { background: #1e293b; border: 2px solid rgba(56,189,248,0.2); border-radius: 50%; width: 56px; height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; font-size: 1.4rem; position: relative; }
        .clap-btn:hover { border-color: rgba(56,189,248,0.5); background: rgba(56,189,248,0.08); transform: scale(1.05); }
        .clap-btn.animating { animation: clapPulse 0.4s ease; }
        .clap-btn.maxed { border-color: rgba(56,189,248,0.5); background: rgba(56,189,248,0.1); }
        @keyframes clapPulse { 0% { transform: scale(1); } 30% { transform: scale(1.35); } 60% { transform: scale(0.95); } 100% { transform: scale(1); } }
        .related-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 10px; padding: 0.9rem; text-decoration: none; color: inherit; display: block; transition: border-color 0.15s, transform 0.15s; }
        .related-card:hover { border-color: rgba(56,189,248,0.25); transform: translateY(-1px); }
        .comment-card { background: rgba(30,41,59,0.6); border: 1px solid rgba(56,189,248,0.06); border-radius: 10px; padding: 1rem; margin-bottom: 0.75rem; }
        @media (max-width: 768px) {
          .art-read-layout { grid-template-columns: 1fr !important; padding: 1rem 1rem 3rem !important; }
          .art-read-sidebar { position: static !important; }
        }
      `}</style>

      {/* Reading progress bar */}
      <div style={{ position: 'fixed', top: 58, left: 0, right: 0, height: 3, background: 'rgba(56,189,248,0.12)', zIndex: 999 }}>
        <div style={{ height: '100%', background: '#38bdf8', width: `${scrollProgress}%`, transition: 'width 0.1s linear' }} />
      </div>

      {/* Featured image */}
      {article.featured_image_url && (
        <div style={{ width: '100%', maxHeight: 400, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.featured_image_url} alt={article.title} style={{ width: '100%', height: 400, objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>
      )}

      <div className="art-read-layout">
        {/* Main content */}
        <div ref={articleContentRef}>
          {/* Category + meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {article.category && (
              <span style={{ borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}30` }}>{article.category}</span>
            )}
            {article.tags.slice(0, 4).map(t => (
              <span key={t} style={{ borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', color: '#38bdf8' }}>#{t}</span>
            ))}
            {isAuthor && (
              <span style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8' }}>₮20 earned for publishing</span>
            )}
          </div>

          {/* Title */}
          <h1 style={{ fontSize: '2.1rem', fontWeight: 900, lineHeight: 1.2, marginBottom: '1rem', color: '#f1f5f9' }}>{article.title}</h1>

          {/* Author row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', background: getAvatarGrad(authorInitials), flexShrink: 0 }}>{authorInitials}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f1f5f9' }}>{article.author?.full_name ?? 'Author'}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{formatDate(article.published_at)} · {article.read_time_minutes} min read</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
              <span>👏 {clapCount.toLocaleString()}</span>
              <span>· 💬 {comments.length}</span>
            </div>
          </div>

          {/* Excerpt */}
          {article.excerpt && (
            <p style={{ fontSize: '1.1rem', color: '#94a3b8', lineHeight: 1.7, marginBottom: '1.5rem', fontStyle: 'italic', borderLeft: '3px solid rgba(56,189,248,0.3)', paddingLeft: '1rem' }}>{article.excerpt}</p>
          )}

          {/* Article body */}
          <div className="art-body" dangerouslySetInnerHTML={{ __html: article.body }} />

          {/* Clap section */}
          <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(56,189,248,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
              {userClapCount >= 50 ? "You've given max claps! 🙌" : 'Did you enjoy this article? Give it a clap!'}
            </div>
            <button
              className={`clap-btn${clapAnimating ? ' animating' : ''}${userClapCount >= 50 ? ' maxed' : ''}`}
              onClick={handleClap}
              disabled={userClapCount >= 50}
              title={userClapCount >= 50 ? 'Max claps reached' : 'Clap for this article'}
            >
              👏
            </button>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>{clapCount.toLocaleString()} claps</div>
            {userClapCount > 0 && <div style={{ fontSize: '0.78rem', color: '#38bdf8' }}>You gave {userClapCount} / 50 claps</div>}
          </div>

          {/* Author profile card */}
          <div style={{ marginTop: '3rem', background: '#1e293b', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 14, padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', color: '#0f172a', background: getAvatarGrad(authorInitials), flexShrink: 0 }}>{authorInitials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f1f5f9', marginBottom: '0.25rem' }}>{article.author?.full_name ?? 'Author'}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.6rem' }}>{authorArticleCount} published articles on FreeTrust</div>
              {article.author?.bio && <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '0.75rem' }}>{article.author.bio}</p>}
              <button style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 7, padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8', cursor: 'pointer' }}>+ Follow</button>
            </div>
          </div>

          {/* Comments */}
          <div style={{ marginTop: '3rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: '#f1f5f9' }}>Comments ({comments.length})</h3>

            {/* Add comment */}
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 10, padding: '1rem', marginBottom: '1.5rem' }}>
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={userId ? 'Write a comment…' : 'Sign in to leave a comment'}
                disabled={!userId}
                rows={3}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: '0.9rem', lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  onClick={handleComment}
                  disabled={!commentText.trim() || submittingComment || !userId}
                  style={{ background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.45rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', opacity: (!commentText.trim() || submittingComment || !userId) ? 0.5 : 1 }}
                >
                  {submittingComment ? 'Posting…' : 'Post Comment'}
                </button>
              </div>
            </div>

            {/* Comment list */}
            {comments.length === 0
              ? <div style={{ textAlign: 'center', color: '#475569', padding: '2rem', fontSize: '0.9rem' }}>No comments yet — be the first to comment</div>
              : comments.map(c => {
                const cInitials = getInitials(c.author?.full_name)
                return (
                  <div key={c.id} className="comment-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.7rem', color: '#0f172a', background: getAvatarGrad(cInitials), flexShrink: 0 }}>{cInitials}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f1f5f9' }}>{c.author?.full_name ?? 'Member'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#475569' }}>{timeAgo(c.created_at)}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.65, margin: 0 }}>{c.body}</p>
                  </div>
                )
              })}
          </div>

          {/* Mobile: Related articles below */}
          {related.length > 0 && (
            <div style={{ marginTop: '3rem', display: 'none' }} className="art-mobile-related">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>Related Articles</h3>
              {related.map(r => {
                const rInit = getInitials(r.author?.full_name)
                return (
                  <Link key={r.id} href={`/articles/${r.slug}`} className="related-card" style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.35, marginBottom: '0.5rem' }}>{r.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: getAvatarGrad(rInit), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#0f172a' }}>{rInit}</div>
                      <span>{r.author?.full_name ?? 'Author'}</span>
                      <span>· {r.read_time_minutes} min</span>
                      <span>· 👏 {r.clap_count}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="art-read-sidebar">
          {/* Clap widget */}
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>Enjoying this article?</div>
            <button
              className={`clap-btn${clapAnimating ? ' animating' : ''}${userClapCount >= 50 ? ' maxed' : ''}`}
              onClick={handleClap}
              disabled={userClapCount >= 50}
              style={{ margin: '0 auto' }}
            >👏</button>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9', marginTop: '0.6rem' }}>{clapCount.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>claps</div>
            {userClapCount > 0 && <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '0.3rem' }}>{userClapCount}/50 given</div>}
          </div>

          {/* Related articles */}
          {related.length > 0 && (
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1rem' }}>Related Articles</div>
              {related.map(r => {
                const rInit = getInitials(r.author?.full_name)
                return (
                  <Link key={r.id} href={`/articles/${r.slug}`} className="related-card" style={{ marginBottom: '0.75rem', display: 'block' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.35, marginBottom: '0.5rem' }}>{r.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#64748b' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: getAvatarGrad(rInit), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{rInit}</div>
                      <span>{r.author?.full_name ?? 'Author'}</span>
                      <span>·</span>
                      <span>👏 {r.clap_count}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Back to articles */}
          <Link href="/articles" style={{ display: 'block', textAlign: 'center', padding: '0.6rem', borderRadius: 8, border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 500 }}>← All Articles</Link>

          {/* Write your own */}
          <div style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12, padding: '1.1rem', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#38bdf8', marginBottom: '0.4rem' }}>Write for FreeTrust</div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>Earn ₮20 Trust for every article you publish.</p>
            <Link href="/articles/new" style={{ display: 'block', background: '#38bdf8', borderRadius: 7, padding: '0.5rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>Start Writing</Link>
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 768px) { .art-mobile-related { display: block !important; } }
      `}</style>
    </div>
  )
}
