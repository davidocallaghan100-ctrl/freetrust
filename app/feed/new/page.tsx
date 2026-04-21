'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

const POST_TYPES = [
  { value: 'text', label: '✏️ Text Post', desc: 'Share your thoughts' },
  { value: 'video', label: '🎬 Video', desc: 'Share a video link' },
  { value: 'article', label: '📰 Article', desc: 'Share an article' },
  { value: 'listing', label: '🛍️ Listing', desc: 'Promote a product or service' },
  { value: 'job', label: '💼 Job', desc: 'Post a job opportunity' },
  { value: 'event', label: '📅 Event', desc: 'Announce an event' },
  { value: 'milestone', label: '🏆 Milestone', desc: 'Celebrate an achievement' },
]

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  container: { maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' },
  heading: { fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' },
  sub: { color: '#64748b', fontSize: '0.88rem', marginBottom: '2rem' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 12, padding: '1.5rem' },
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  typeGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' },
  typeBtn: { padding: '0.75rem', borderRadius: 8, border: '1px solid rgba(56,189,248,0.12)', background: 'rgba(56,189,248,0.03)', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' },
  typeBtnActive: { border: '1px solid #38bdf8', background: 'rgba(56,189,248,0.1)' },
  typeBtnLabel: { fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9', display: 'block', marginBottom: '0.15rem' },
  typeBtnDesc: { fontSize: '0.75rem', color: '#64748b' },
  textarea: { width: '100%', minHeight: 140, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.75rem', color: '#f1f5f9', fontSize: '0.92rem', resize: 'vertical' as const, outline: 'none', fontFamily: 'system-ui', boxSizing: 'border-box' as const, marginBottom: '1rem' },
  input: { width: '100%', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.65rem 0.75rem', color: '#f1f5f9', fontSize: '0.92rem', outline: 'none', fontFamily: 'system-ui', boxSizing: 'border-box' as const, marginBottom: '1rem' },
  charCount: { fontSize: '0.75rem', color: '#64748b', textAlign: 'right' as const, marginTop: '-0.75rem', marginBottom: '1rem' },
  actions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
  cancelBtn: { background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.6rem 1.25rem', color: '#94a3b8', fontSize: '0.88rem', cursor: 'pointer' },
  submitBtn: { background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', color: '#0f172a', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' },
  error: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' },
}

export default function NewFeedPostPage() {
  const router = useRouter()
  const [type, setType] = useState('text')
  const [content, setContent] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!content.trim()) {
      setError('Please write something before posting.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/feed/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content: content.trim(), media_url: mediaUrl.trim() || null }),
      })
      if (res.status === 401) {
        router.push('/auth/login')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create post')
        return
      }
      router.push('/feed')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const showMediaField = ['video', 'article', 'listing', 'event'].includes(type)

  return (
    <div style={S.page}>
      <style>{`
        @media (max-width: 768px) {
          .new-post-container { padding: 1rem !important; }
          .type-grid { grid-template-columns: 1fr !important; }
        }
        textarea:focus, input[type="text"]:focus, input[type="url"]:focus { border-color: rgba(56,189,248,0.5) !important; }
      `}</style>
      <div className="new-post-container" style={S.container}>
        <h1 style={S.heading}>Create a Post</h1>
        <p style={S.sub}>Share something with the FreeTrust community</p>

        <div style={S.card}>
          {error && <div style={S.error}>{error}</div>}

          <label style={S.label}>Post Type</label>
          <div className="type-grid" style={S.typeGrid}>
            {POST_TYPES.map(pt => (
              <button
                key={pt.value}
                style={{ ...S.typeBtn, ...(type === pt.value ? S.typeBtnActive : {}) }}
                onClick={() => setType(pt.value)}
                type="button"
              >
                <span style={{ ...S.typeBtnLabel, color: type === pt.value ? '#38bdf8' : '#f1f5f9' }}>{pt.label}</span>
                <span style={S.typeBtnDesc}>{pt.desc}</span>
              </button>
            ))}
          </div>

          <label style={S.label}>What&apos;s on your mind?</label>
          <textarea
            style={S.textarea}
            placeholder={
              type === 'milestone' ? 'Share your achievement with the community…' :
              type === 'job' ? 'Describe the job opportunity…' :
              type === 'event' ? 'Tell people about your event…' :
              type === 'video' ? 'Describe your video…' :
              'Share your thoughts, ideas, or updates…'
            }
            value={content}
            onChange={e => setContent(e.target.value)}
            maxLength={2000}
          />
          <div style={S.charCount}>{content.length}/2000</div>

          {showMediaField && (
            <>
              <label style={S.label}>{type === 'video' ? 'Video URL' : 'Link / Media URL'} (optional)</label>
              <input
                type="url"
                style={S.input}
                placeholder={type === 'video' ? 'https://youtube.com/watch?v=...' : 'https://...'}
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
              />
            </>
          )}

          <div style={S.actions}>
            <button style={S.cancelBtn} onClick={() => router.back()} type="button">Cancel</button>
            <button
              style={{ ...S.submitBtn, opacity: submitting ? 0.7 : 1 }}
              onClick={handleSubmit}
              disabled={submitting}
              type="button"
            >
              {submitting ? 'Posting…' : '🚀 Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
