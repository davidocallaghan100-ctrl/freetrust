'use client'
import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Business', 'Technology', 'Sustainability', 'Creative', 'Finance', 'Health', 'Education', 'General']

const GRADIENTS = [
  { label: 'Sky', value: 'linear-gradient(135deg,#38bdf8,#0284c7)' },
  { label: 'Purple', value: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { label: 'Green', value: 'linear-gradient(135deg,#34d399,#059669)' },
  { label: 'Pink', value: 'linear-gradient(135deg,#f472b6,#db2777)' },
  { label: 'Orange', value: 'linear-gradient(135deg,#fb923c,#ea580c)' },
  { label: 'Gold', value: 'linear-gradient(135deg,#fbbf24,#d97706)' },
]

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'CO'
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', padding: '2.5rem 1.5rem 4rem' },
  inner: { maxWidth: 680, margin: '0 auto' },
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' },
  input: { width: '100%', background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', resize: 'vertical', minHeight: 100, boxSizing: 'border-box', fontFamily: 'system-ui' },
  select: { width: '100%', background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', appearance: 'none', cursor: 'pointer' },
  field: { marginBottom: '1.5rem' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '2rem', marginBottom: '1.5rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem' },
}

export default function NewCommunityPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Business')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [gradient, setGradient] = useState(GRADIENTS[0].value)
  const [isPaid, setIsPaid] = useState(false)
  const [price, setPrice] = useState('9')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const slug = slugify(name)
  const initials = getInitials(name)
  const paidNet = isPaid ? (parseFloat(price) * 0.95).toFixed(2) : '0'

  const addTag = useCallback((val: string) => {
    const cleaned = val.trim().replace(/^#/, '')
    if (cleaned && !tags.includes(cleaned) && tags.length < 8) {
      setTags(prev => [...prev, cleaned])
    }
    setTagInput('')
  }, [tags])

  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Community name is required.'); return }
    if (!description.trim()) { setError('Description is required.'); return }
    if (isPaid && (parseFloat(price) < 5 || isNaN(parseFloat(price)))) { setError('Paid communities require a minimum price of £5/month.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          description: description.trim(),
          avatar_initials: initials,
          avatar_gradient: gradient,
          category,
          tags,
          is_paid: isPaid,
          price_monthly: isPaid ? parseFloat(price) : 0,
        }),
      })
      const data = await res.json() as { community?: { slug: string }; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to create community.'); return }
      router.push(`/community/${data.community?.slug ?? slug}/admin`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <style>{`
        .nc-input:focus { border-color: rgba(56,189,248,0.4) !important; }
        .nc-grad-btn:hover { opacity: 0.85; }
        @media (max-width: 640px) {
          .nc-page { padding: 1.5rem 1rem 3rem !important; }
        }
      `}</style>
      <div className="nc-page" style={S.inner}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.4rem' }}>Create a Community</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Build your own space for members to learn, connect, and grow together.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Basic Information</div>

            <div style={S.field}>
              <label style={S.label}>Community Name *</label>
              <input className="nc-input" style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SaaS Builders Circle" maxLength={60} />
              {name && (
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                  URL: <span style={{ color: '#38bdf8' }}>freetrust.com/community/{slug}</span>
                </div>
              )}
            </div>

            <div style={S.field}>
              <label style={S.label}>Description *</label>
              <textarea className="nc-input" style={S.textarea} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this community about? Who should join?" maxLength={500} />
              <div style={{ fontSize: '0.72rem', color: '#475569', textAlign: 'right', marginTop: '0.25rem' }}>{description.length}/500</div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Category</label>
              <select className="nc-input" style={S.select} value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={S.field}>
              <label style={S.label}>Tags <span style={{ color: '#475569', fontWeight: 400 }}>(up to 8, press Enter or comma)</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.5rem 0.75rem', cursor: 'text' }}
                onClick={() => document.getElementById('tag-input')?.focus()}>
                {tags.map(t => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.15rem 0.5rem 0.15rem 0.6rem', fontSize: '0.8rem', color: '#38bdf8' }}>
                    #{t}
                    <button type="button" onClick={() => setTags(p => p.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.9rem', padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
                {tags.length < 8 && (
                  <input
                    id="tag-input"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleTagKey}
                    onBlur={() => tagInput && addTag(tagInput)}
                    placeholder={tags.length === 0 ? 'startup, saas, design...' : ''}
                    style={{ background: 'none', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: '0.88rem', minWidth: 80, flex: 1 }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Appearance</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ background: gradient, width: 72, height: 72, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', color: '#0f172a', flexShrink: 0 }}>
                {initials}
              </div>
              <div>
                <div style={{ ...S.label, marginBottom: '0.6rem' }}>Avatar Colour</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {GRADIENTS.map(g => (
                    <button
                      key={g.label}
                      type="button"
                      className="nc-grad-btn"
                      onClick={() => setGradient(g.value)}
                      title={g.label}
                      style={{
                        background: g.value,
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: gradient === g.value ? '2px solid #f1f5f9' : '2px solid transparent',
                        cursor: 'pointer',
                        outline: gradient === g.value ? '2px solid #38bdf8' : 'none',
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Membership */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Membership</div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {['Free', 'Paid'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setIsPaid(opt === 'Paid')}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: 10,
                    border: (opt === 'Paid') === isPaid ? '2px solid #38bdf8' : '2px solid rgba(148,163,184,0.2)',
                    background: (opt === 'Paid') === isPaid ? 'rgba(56,189,248,0.08)' : 'transparent',
                    color: (opt === 'Paid') === isPaid ? '#38bdf8' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  {opt === 'Free' ? '🆓 Free' : '💳 Paid'}
                </button>
              ))}
            </div>

            {isPaid && (
              <div>
                <div style={S.field}>
                  <label style={S.label}>Monthly Price (£)</label>
                  <input
                    className="nc-input"
                    style={{ ...S.input, maxWidth: 160 }}
                    type="number"
                    min="5"
                    max="999"
                    step="1"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                </div>
                <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.83rem', color: '#94a3b8' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>FreeTrust fee: 5%</span>
                  {' '}— You receive{' '}
                  <span style={{ color: '#34d399', fontWeight: 700 }}>£{paidNet}/member/month</span>
                  {' '}after the platform fee of{' '}
                  <span style={{ color: '#f472b6' }}>£{(parseFloat(price || '0') * 0.05).toFixed(2)}</span>
                </div>
              </div>
            )}

            {!isPaid && (
              <p style={{ fontSize: '0.83rem', color: '#64748b' }}>Free communities have no membership fee. All members join instantly.</p>
            )}
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#fca5a5', marginBottom: '1.25rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: loading ? 'rgba(56,189,248,0.5)' : '#38bdf8', border: 'none', borderRadius: 10, padding: '0.9rem', fontSize: '1rem', fontWeight: 800, color: '#0f172a', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Creating...' : '🚀 Create Community'}
          </button>
        </form>
      </div>
    </div>
  )
}
