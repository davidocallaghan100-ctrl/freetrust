'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Draft = {
  id: string
  title: string
  excerpt: string | null
  category: string | null
  updated_at: string
  read_time_minutes: number
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

export default function DraftsPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data, error } = await supabase
        .from('articles')
        .select('id, title, excerpt, category, updated_at, read_time_minutes')
        .eq('author_id', user.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })

      if (!error) setDrafts(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const publishDraft = async (draftId: string, title: string) => {
    if (!confirm(`Publish "${title}"? You'll earn ₮20 Trust.`)) return
    setPublishing(draftId)
    const { error } = await supabase
      .from('articles')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', draftId)
      .eq('author_id', userId!)

    if (!error) {
      // Issue trust
      await supabase.rpc('issue_trust', {
        p_user_id: userId,
        p_amount: 20,
        p_type: 'article_published',
        p_ref: draftId,
        p_desc: `Published article: ${title.slice(0, 100)}`,
      })
      setDrafts(prev => prev.filter(d => d.id !== draftId))
    }
    setPublishing(null)
  }

  const deleteDraft = async (draftId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(draftId)
    const { error } = await supabase.from('articles').delete().eq('id', draftId).eq('author_id', userId!)
    if (!error) setDrafts(prev => prev.filter(d => d.id !== draftId))
    setDeleting(null)
  }

  const CAT_COLOR: Record<string, string> = {
    Business: '#38bdf8', Technology: '#a78bfa', Sustainability: '#34d399',
    Design: '#f472b6', Finance: '#fbbf24', Community: '#fb923c',
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .draft-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; transition: border-color 0.15s; }
        .draft-card:hover { border-color: rgba(56,189,248,0.2); }
        .pub-btn { background: #38bdf8; border: none; border-radius: 7px; padding: 0.4rem 0.9rem; font-size: 0.8rem; font-weight: 700; color: #0f172a; cursor: pointer; transition: opacity 0.15s; }
        .pub-btn:hover { opacity: 0.88; }
        .pub-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .del-btn { background: transparent; border: 1px solid rgba(239,68,68,0.2); border-radius: 7px; padding: 0.4rem 0.9rem; font-size: 0.8rem; font-weight: 600; color: #f87171; cursor: pointer; transition: all 0.15s; }
        .del-btn:hover { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.4); }
        .del-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .edit-link { background: transparent; border: 1px solid rgba(148,163,184,0.15); border-radius: 7px; padding: 0.4rem 0.9rem; font-size: 0.8rem; font-weight: 600; color: #94a3b8; text-decoration: none; display: inline-block; transition: all 0.15s; }
        .edit-link:hover { border-color: rgba(56,189,248,0.3); color: #38bdf8; }
      `}</style>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.3rem' }}>My Drafts</h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Continue working on your saved articles</p>
          </div>
          <Link href="/articles/new" style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.6rem 1.25rem', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none', display: 'inline-block' }}>+ New Article</Link>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ background: '#1e293b', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem', opacity: 0.5 }}>
              <div style={{ height: 16, background: '#334155', borderRadius: 6, marginBottom: '0.75rem', width: '55%' }} />
              <div style={{ height: 12, background: '#334155', borderRadius: 6, width: '80%' }} />
            </div>
          ))
        ) : drafts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✏️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f1f5f9' }}>No drafts yet</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Start writing your first article and save it as a draft to continue later.</p>
            <Link href="/articles/new" style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none', display: 'inline-block' }}>Start Writing</Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              {drafts.length} draft{drafts.length !== 1 ? 's' : ''} saved
            </div>
            {drafts.map(d => {
              const catCol = CAT_COLOR[d.category ?? ''] ?? '#38bdf8'
              return (
                <div key={d.id} className="draft-card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        {d.category && <span style={{ borderRadius: 999, padding: '0.12rem 0.55rem', fontSize: '0.7rem', fontWeight: 600, background: `${catCol}15`, color: catCol, border: `1px solid ${catCol}30` }}>{d.category}</span>}
                        <span style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 999, padding: '0.12rem 0.55rem', fontSize: '0.7rem', color: '#64748b' }}>DRAFT</span>
                        <span style={{ fontSize: '0.72rem', color: '#475569' }}>{d.read_time_minutes} min read</span>
                      </div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3, marginBottom: '0.4rem' }}>{d.title || 'Untitled'}</h3>
                      {d.excerpt && <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.3rem' }}>{d.excerpt}</p>}
                      <div style={{ fontSize: '0.75rem', color: '#475569' }}>Last edited: {formatDate(d.updated_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Link href={`/articles/new?draft=${d.id}`} className="edit-link">Continue editing</Link>
                      <button
                        className="pub-btn"
                        disabled={publishing === d.id}
                        onClick={() => publishDraft(d.id, d.title)}
                      >
                        {publishing === d.id ? 'Publishing…' : 'Publish — ₮20'}
                      </button>
                      <button
                        className="del-btn"
                        disabled={deleting === d.id}
                        onClick={() => deleteDraft(d.id, d.title)}
                      >
                        {deleting === d.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Trust reminder */}
            <div style={{ marginTop: '1.5rem', background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.2rem' }}>₮</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#38bdf8' }}>Publish to earn ₮20 Trust</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Each article published rewards you with 20 Trust tokens.</div>
              </div>
            </div>
          </>
        )}

        {/* Back link */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link href="/articles" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>← Back to Articles</Link>
        </div>
      </div>
    </div>
  )
}
