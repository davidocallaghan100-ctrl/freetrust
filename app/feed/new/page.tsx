'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const POST_TYPES = [
  { value: 'text', label: '✏️ Text Post', desc: 'Share your thoughts' },
  { value: 'link', label: '🔗 Link / Spotify', desc: 'Preview a page or song' },
  { value: 'video', label: '🎬 Video', desc: 'Share a video link' },
  { value: 'article', label: '📰 Article', desc: 'Share an article' },
  { value: 'listing', label: '🛍️ Listing', desc: 'Promote a product or service' },
  { value: 'job', label: '💼 Job', desc: 'Post a job opportunity' },
  { value: 'event', label: '📅 Event', desc: 'Announce an event' },
  { value: 'milestone', label: '🏆 Milestone', desc: 'Celebrate an achievement' },
]

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'var(--ft-bg)', color: 'var(--ft-text)', fontFamily: 'system-ui' },
  container: { maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' },
  heading: { fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' },
  sub: { color: 'var(--ft-text-tertiary)', fontSize: '0.88rem', marginBottom: '2rem' },
  card: { background: 'var(--ft-surface)', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 12, padding: '1.5rem' },
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--ft-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  typeGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' },
  typeBtn: { padding: '0.75rem', borderRadius: 8, border: '1px solid rgba(56,189,248,0.12)', background: 'rgba(56,189,248,0.03)', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' },
  typeBtnActive: { border: '1px solid var(--ft-accent)', background: 'rgba(56,189,248,0.1)' },
  typeBtnLabel: { fontSize: '0.88rem', fontWeight: 600, color: 'var(--ft-text)', display: 'block', marginBottom: '0.15rem' },
  typeBtnDesc: { fontSize: '0.75rem', color: 'var(--ft-text-tertiary)' },
  textarea: { width: '100%', minHeight: 140, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.75rem', color: 'var(--ft-text)', fontSize: '0.92rem', resize: 'vertical' as const, outline: 'none', fontFamily: 'system-ui', boxSizing: 'border-box' as const, marginBottom: '1rem' },
  input: { width: '100%', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.65rem 0.75rem', color: 'var(--ft-text)', fontSize: '0.92rem', outline: 'none', fontFamily: 'system-ui', boxSizing: 'border-box' as const, marginBottom: '1rem' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(139,92,246,0.16)', border: '1px solid rgba(139,92,246,0.35)', color: '#ddd6fe', borderRadius: 999, padding: '0.25rem 0.6rem', fontSize: '0.78rem', fontWeight: 700, marginRight: 6, marginBottom: 8 },
  charCount: { fontSize: '0.75rem', color: 'var(--ft-text-tertiary)', textAlign: 'right' as const, marginTop: '-0.75rem', marginBottom: '1rem' },
  actions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
  cancelBtn: { background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.6rem 1.25rem', color: 'var(--ft-text-secondary)', fontSize: '0.88rem', cursor: 'pointer' },
  submitBtn: { background: 'var(--ft-accent)', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', color: 'var(--ft-bg)', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' },
  error: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: 'var(--ft-danger)', fontSize: '0.85rem', marginBottom: '1rem' },
}

type OrganisationOption = { id: string; name: string; slug: string | null; logo_url?: string | null }

function extractFirstUrl(text: string) {
  return text.match(/https?:\/\/[^\s<]+/i)?.[0]?.replace(/[),.;!?]+$/, '') ?? ''
}

function isSpotifyUrl(raw: string) {
  try { return new URL(raw).hostname.endsWith('spotify.com') }
  catch { return false }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function NewFeedPostPage() {
  const router = useRouter()
  const [type, setType] = useState('text')
  const [content, setContent] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [orgQuery, setOrgQuery] = useState('')
  const [orgResults, setOrgResults] = useState<OrganisationOption[]>([])
  const [taggedOrgs, setTaggedOrgs] = useState<OrganisationOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = orgQuery.trim()
    if (q.length < 2) { setOrgResults([]); return }
    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`/api/organisations?search=${encodeURIComponent(q)}&limit=8`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error('search failed')))
        .then((data: { organisations?: OrganisationOption[] }) => { if (!cancelled) setOrgResults(data.organisations ?? []) })
        .catch(() => { if (!cancelled) setOrgResults([]) })
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [orgQuery])

  const tagOrganisation = (org: OrganisationOption) => {
    const slug = org.slug || slugify(org.name)
    const mention = `@${slug}`
    if (!content.includes(mention)) setContent(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${mention} `)
    setTaggedOrgs(prev => prev.some(o => o.id === org.id) ? prev : [...prev, org])
    setOrgQuery('')
    setOrgResults([])
  }

  const handleSubmit = async () => {
    setError('')
    if (!content.trim()) {
      setError('Please write something before posting.')
      return
    }
    const attachedUrl = mediaUrl.trim() || extractFirstUrl(content)
    const spotify = isSpotifyUrl(attachedUrl)
    const payloadType = attachedUrl && (type === 'text' || type === 'link' || spotify) ? 'link' : type
    setSubmitting(true)
    try {
      const res = await fetch('/api/feed/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: payloadType,
          content: content.trim(),
          media_url: type === 'video' && attachedUrl && !spotify ? attachedUrl : null,
          media_type: spotify ? 'spotify' : null,
          link_url: attachedUrl || null,
        }),
      })
      if (res.status === 401) {
        router.push('/login')
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

  const showMediaField = true

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
                <span style={{ ...S.typeBtnLabel, color: type === pt.value ? 'var(--ft-accent)' : 'var(--ft-text)' }}>{pt.label}</span>
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
              <label style={S.label}>{type === 'video' ? 'Video URL' : 'Spotify / Link URL'} (optional)</label>
              <input
                type="url"
                style={S.input}
                placeholder={type === 'video' ? 'https://youtube.com/watch?v=...' : 'https://open.spotify.com/track/... or https://...'}
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
              />
            </>
          )}

          <label style={S.label}>Tag organisations (optional)</label>
          <input
            type="text"
            style={{ ...S.input, marginBottom: orgResults.length > 0 ? 0 : '0.5rem' }}
            placeholder="Search organisations to tag with @slug"
            value={orgQuery}
            onChange={e => setOrgQuery(e.target.value)}
          />
          {orgResults.length > 0 && (
            <div style={{ background: 'var(--ft-bg)', border: '1px solid var(--ft-border-strong)', borderRadius: 8, overflow: 'hidden', marginBottom: '0.75rem' }}>
              {orgResults.map(org => (
                <button key={org.id} type="button" onClick={() => tagOrganisation(org)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--ft-surface)', padding: '0.65rem 0.75rem', color: 'var(--ft-text)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 999, background: 'rgba(139,92,246,0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#c4b5fd', fontWeight: 800 }}>{org.logo_url ? '🏢' : org.name.slice(0, 1).toUpperCase()}</span>
                  <span><strong>{org.name}</strong><br /><span style={{ color: 'var(--ft-text-tertiary)', fontSize: '0.75rem' }}>@{org.slug || slugify(org.name)}</span></span>
                </button>
              ))}
            </div>
          )}
          {taggedOrgs.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {taggedOrgs.map(org => <span key={org.id} style={S.chip}>@{org.slug || slugify(org.name)} · {org.name}</span>)}
            </div>
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
