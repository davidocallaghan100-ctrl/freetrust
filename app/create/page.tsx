'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type PostType = 'article' | 'photo' | 'video' | 'short' | 'link' | 'job' | 'event' | 'service' | 'product' | 'poll'
type Visibility = 'public' | 'connections' | 'community'

interface LinkPreview {
  title: string | null
  description: string | null
  image: string | null
  url: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POST_TYPES: { type: PostType; icon: string; label: string; desc: string }[] = [
  { type: 'article',  icon: '✍️',  label: 'Article',      desc: 'Long-form writing'      },
  { type: 'photo',    icon: '📷',  label: 'Photo',        desc: 'Share images'            },
  { type: 'video',    icon: '🎥',  label: 'Video',        desc: 'Upload a video'          },
  { type: 'short',    icon: '📱',  label: 'Short Video',  desc: 'TikTok-style clip'       },
  { type: 'link',     icon: '🔗',  label: 'Shared Link',  desc: 'Share a URL'             },
  { type: 'job',      icon: '💼',  label: 'Job Posting',  desc: 'Post an opportunity'     },
  { type: 'event',    icon: '📅',  label: 'Event',        desc: 'Announce an event'       },
  { type: 'service',  icon: '🛠',  label: 'Service',      desc: 'Offer a service'         },
  { type: 'product',  icon: '📦',  label: 'Product',      desc: 'List a product'          },
  { type: 'poll',     icon: '📊',  label: 'Poll',         desc: 'Get opinions'            },
]

const CATEGORIES = ['General', 'Business', 'Creative', 'Tech', 'Social', 'Education', 'Health', 'Finance', 'Events', 'Other']

const s = {
  page: { minHeight: '100vh', padding: '2rem 1.5rem', maxWidth: '820px', margin: '0 auto' },
  heading: { fontSize: '1.6rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.5rem' },
  subtext: { fontSize: '0.9rem', color: '#64748b', marginBottom: '2rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '2rem' },
  typeCard: (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(56,189,248,0.12)' : '#1e293b',
    border: `1.5px solid ${active ? '#38bdf8' : '#334155'}`,
    borderRadius: '12px',
    padding: '1rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
  }),
  typeIcon: { fontSize: '1.5rem', marginBottom: '0.4rem' },
  typeLabel: (active: boolean): React.CSSProperties => ({
    fontSize: '0.88rem',
    fontWeight: 700,
    color: active ? '#38bdf8' : '#f1f5f9',
    display: 'block',
  }),
  typeDesc: { fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', display: 'block' },
  form: { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' },
  formTitle: { fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  input: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.95rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const },
  textarea: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.95rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: '120px', fontFamily: 'inherit' },
  select: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.95rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const },
  fieldGroup: { marginBottom: '1rem' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' },
  visRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const, marginBottom: '1rem' },
  visPill: (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.9rem',
    borderRadius: '9999px',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? '#38bdf8' : '#0f172a',
    color: active ? '#0f172a' : '#94a3b8',
    border: `1px solid ${active ? '#38bdf8' : '#334155'}`,
  }),
  actions: { display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' as const },
  btnPrimary: { padding: '0.65rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', border: 'none', cursor: 'pointer' },
  btnSecondary: { padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8', background: '#0f172a', border: '1px solid #334155', cursor: 'pointer' },
  btnDanger: { padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#f87171', background: 'transparent', border: '1px solid #334155', cursor: 'pointer' },
  toast: (show: boolean): React.CSSProperties => ({
    position: 'fixed',
    bottom: '80px',
    right: '1.5rem',
    background: '#1e293b',
    border: '1px solid #38bdf8',
    borderRadius: '10px',
    padding: '0.75rem 1.25rem',
    fontSize: '0.88rem',
    color: '#38bdf8',
    fontWeight: 600,
    zIndex: 999,
    transition: 'opacity 0.3s',
    opacity: show ? 1 : 0,
    pointerEvents: 'none' as const,
  }),
  previewCard: { background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem', marginTop: '1rem' },
  linkPreviewCard: { background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', overflow: 'hidden', marginTop: '0.75rem' },
  pollOption: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' },
  draftBadge: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' },
}

// ── Shared form fields ─────────────────────────────────────────────────────────

function SharedFields({
  location, setLocation,
  taggedUsers, setTaggedUsers,
  category, setCategory,
  visibility, setVisibility,
}: {
  location: string; setLocation: (v: string) => void
  taggedUsers: string; setTaggedUsers: (v: string) => void
  category: string; setCategory: (v: string) => void
  visibility: Visibility; setVisibility: (v: Visibility) => void
}) {
  return (
    <>
      <div style={s.row}>
        <div>
          <label style={s.label}>📍 Location</label>
          <input style={s.input} placeholder="Add location…" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
        <div>
          <label style={s.label}>👥 Tag Members</label>
          <input style={s.input} placeholder="@name, @name…" value={taggedUsers} onChange={e => setTaggedUsers(e.target.value)} />
        </div>
      </div>
      <div style={s.row}>
        <div>
          <label style={s.label}>🏷 Category</label>
          <select style={s.select} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={s.label}>👁 Visibility</label>
          <div style={s.visRow}>
            {(['public', 'connections', 'community'] as Visibility[]).map(v => (
              <button key={v} style={s.visPill(visibility === v)} onClick={() => setVisibility(v)}>
                {v === 'public' ? '🌍 Public' : v === 'connections' ? '🔗 Connections' : '👥 Community'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CreatePage() {
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<PostType | null>(null)
  const [preview, setPreview] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [toast, setToast] = useState('')
  const [showToast, setShowToast] = useState(false)
  const draftTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Shared fields
  const [location, setLocation] = useState('')
  const [taggedUsers, setTaggedUsers] = useState('')
  const [category, setCategory] = useState('General')
  const [visibility, setVisibility] = useState<Visibility>('public')

  // Per-type form data
  const [formData, setFormData] = useState<Record<string, string>>({})

  // Poll-specific
  const [pollOptions, setPollOptions] = useState(['', ''])

  // Link preview
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)

  const showToastMsg = (msg: string) => {
    setToast(msg)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const getDraftKey = (type: PostType) => `ft_draft_${type}`

  // Load draft when type changes
  useEffect(() => {
    if (!selectedType) return
    try {
      const raw = localStorage.getItem(getDraftKey(selectedType))
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, string>
        setFormData(saved.formData ? JSON.parse(saved.formData) : {})
        setLocation(saved.location ?? '')
        setTaggedUsers(saved.taggedUsers ?? '')
        setCategory(saved.category ?? 'General')
        setVisibility((saved.visibility as Visibility) ?? 'public')
        if (saved.pollOptions) setPollOptions(JSON.parse(saved.pollOptions))
        showToastMsg('📝 Draft restored')
      } else {
        setFormData({})
        setLocation('')
        setTaggedUsers('')
        setCategory('General')
        setVisibility('public')
        setPollOptions(['', ''])
      }
    } catch { /* ignore */ }
  }, [selectedType])

  // Auto-save draft every 10s
  useEffect(() => {
    if (!selectedType) return
    if (draftTimer.current) clearInterval(draftTimer.current)
    draftTimer.current = setInterval(() => {
      try {
        localStorage.setItem(getDraftKey(selectedType), JSON.stringify({
          formData: JSON.stringify(formData),
          location,
          taggedUsers,
          category,
          visibility,
          pollOptions: JSON.stringify(pollOptions),
          savedAt: new Date().toISOString(),
        }))
      } catch { /* ignore */ }
    }, 10000)
    return () => { if (draftTimer.current) clearInterval(draftTimer.current) }
  }, [selectedType, formData, location, taggedUsers, category, visibility, pollOptions])

  const setField = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }))
  const f = (key: string) => formData[key] ?? ''

  const discardDraft = () => {
    if (selectedType) localStorage.removeItem(getDraftKey(selectedType))
    setSelectedType(null)
    setFormData({})
    setPreview(false)
  }

  const handleLinkBlur = async (url: string) => {
    if (!url.startsWith('http')) return
    setLinkLoading(true)
    try {
      const res = await fetch(`/api/create/link-preview?url=${encodeURIComponent(url)}`)
      const data = await res.json() as LinkPreview
      setLinkPreview(data)
      if (data.title) setField('link_title', data.title)
      if (data.description) setField('description', data.description)
    } catch { /* ignore */ }
    setLinkLoading(false)
  }

  const buildPublishPayload = () => {
    if (!selectedType) return null
    let data: Record<string, unknown> = { ...formData }
    if (selectedType === 'poll') {
      data = { ...data, options: pollOptions.filter(o => o.trim()), question: f('question') }
    }
    return { type: selectedType, data, visibility, location, taggedUsers, category }
  }

  const handlePublish = async () => {
    const payload = buildPublishPayload()
    if (!payload) return
    setPublishing(true)
    try {
      const res = await fetch('/api/create/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json() as { success?: boolean; redirectUrl?: string; error?: string }
      if (result.success) {
        if (selectedType) localStorage.removeItem(getDraftKey(selectedType))
        showToastMsg('✅ Published!')
        setTimeout(() => router.push(result.redirectUrl ?? '/feed'), 800)
      } else {
        showToastMsg(`❌ ${result.error ?? 'Failed to publish'}`)
      }
    } catch {
      showToastMsg('❌ Network error')
    }
    setPublishing(false)
  }

  // ── Render form for each type ─────────────────────────────────────────────

  const renderForm = () => {
    if (!selectedType) return null

    const typeLabel = POST_TYPES.find(t => t.type === selectedType)?.label ?? selectedType
    const typeIcon  = POST_TYPES.find(t => t.type === selectedType)?.icon ?? ''

    return (
      <div style={s.form}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={s.formTitle}>{typeIcon} {typeLabel}</h2>
          <button onClick={() => setPreview(v => !v)} style={s.btnSecondary}>
            {preview ? '✏️ Edit' : '👁 Preview'}
          </button>
        </div>

        {preview ? renderPreview() : (
          <>
            {renderTypeFields()}
            <SharedFields
              location={location} setLocation={setLocation}
              taggedUsers={taggedUsers} setTaggedUsers={setTaggedUsers}
              category={category} setCategory={setCategory}
              visibility={visibility} setVisibility={setVisibility}
            />
            <div style={s.actions}>
              <button style={s.btnPrimary} onClick={handlePublish} disabled={publishing}>
                {publishing ? 'Publishing…' : '🚀 Publish'}
              </button>
              <button style={s.btnSecondary} onClick={() => setPreview(true)}>👁 Preview</button>
              <button style={s.btnDanger} onClick={discardDraft}>🗑 Discard</button>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderTypeFields = () => {
    switch (selectedType) {
      case 'article':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Title</label>
              <input style={s.input} placeholder="Article title…" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Body</label>
              <textarea style={{ ...s.textarea, minHeight: '240px' }} placeholder="Write your article here…" value={f('body')} onChange={e => setField('body', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Cover Image URL (optional)</label>
              <input style={s.input} placeholder="https://…" value={f('cover_image_url')} onChange={e => setField('cover_image_url', e.target.value)} />
            </div>
          </>
        )

      case 'photo':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Photos</label>
              <input type="file" accept="image/*" multiple style={{ ...s.input, padding: '0.5rem' }} onChange={e => {
                const files = Array.from(e.target.files ?? [])
                setField('file_names', files.map(f => f.name).join(', '))
              }} />
              {f('file_names') && <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.4rem' }}>📎 {f('file_names')}</p>}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Caption</label>
              <textarea style={s.textarea} placeholder="Write a caption…" value={f('caption')} onChange={e => setField('caption', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Alt Text</label>
              <input style={s.input} placeholder="Describe the image for accessibility…" value={f('alt_text')} onChange={e => setField('alt_text', e.target.value)} />
            </div>
          </>
        )

      case 'video':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Video File</label>
              <input type="file" accept="video/*" style={{ ...s.input, padding: '0.5rem' }} onChange={e => {
                const file = e.target.files?.[0]
                if (file) setField('file_name', file.name)
              }} />
              {f('file_name') && <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.4rem' }}>🎬 {f('file_name')}</p>}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Title</label>
              <input style={s.input} placeholder="Video title…" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="What's this video about?" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
          </>
        )

      case 'short':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Short Video (vertical)</label>
              <input type="file" accept="video/*" style={{ ...s.input, padding: '0.5rem' }} onChange={e => {
                const file = e.target.files?.[0]
                if (file) setField('file_name', file.name)
              }} />
              {f('file_name') && <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.4rem' }}>📱 {f('file_name')}</p>}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Caption <span style={{ fontWeight: 400, color: '#64748b' }}>({(f('caption') ?? '').length}/100)</span></label>
              <input style={s.input} placeholder="Add a caption…" maxLength={100} value={f('caption')} onChange={e => setField('caption', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Audio Description</label>
              <input style={s.input} placeholder="Describe the audio for accessibility…" value={f('audio_desc')} onChange={e => setField('audio_desc', e.target.value)} />
            </div>
          </>
        )

      case 'link':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>URL</label>
              <input
                style={s.input}
                placeholder="https://…"
                value={f('url')}
                onChange={e => { setField('url', e.target.value); setLinkPreview(null) }}
                onBlur={e => handleLinkBlur(e.target.value)}
              />
              {linkLoading && <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.4rem' }}>Loading preview…</p>}
            </div>
            {linkPreview && (
              <div style={s.linkPreviewCard}>
                {linkPreview.image && <img src={linkPreview.image} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover' }} />}
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>{linkPreview.title ?? f('url')}</div>
                  {linkPreview.description && <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' }}>{linkPreview.description}</div>}
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.4rem' }}>{linkPreview.url}</div>
                </div>
              </div>
            )}
            <div style={s.fieldGroup}>
              <label style={s.label}>Your thoughts (optional)</label>
              <textarea style={s.textarea} placeholder="What do you think about this?" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
          </>
        )

      case 'job':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Job Title</label>
              <input style={s.input} placeholder="e.g. Senior Designer" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Company</label>
                <input style={s.input} placeholder="Company name" value={f('company')} onChange={e => setField('company', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Job Type</label>
                <select style={s.select} value={f('job_type') || 'Full-time'} onChange={e => setField('job_type', e.target.value)}>
                  {['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Salary Min (₮)</label>
                <input type="number" style={s.input} placeholder="0" value={f('salary_min')} onChange={e => setField('salary_min', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Salary Max (₮)</label>
                <input type="number" style={s.input} placeholder="0" value={f('salary_max')} onChange={e => setField('salary_max', e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="Describe the role…" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Requirements</label>
              <textarea style={s.textarea} placeholder="Required skills and experience…" value={f('requirements')} onChange={e => setField('requirements', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Apply URL</label>
              <input style={s.input} placeholder="https://apply…" value={f('apply_url')} onChange={e => setField('apply_url', e.target.value)} />
            </div>
          </>
        )

      case 'event':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Event Title</label>
              <input style={s.input} placeholder="Event name…" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Start Date &amp; Time</label>
                <input type="datetime-local" style={s.input} value={f('start_date')} onChange={e => setField('start_date', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>End Date &amp; Time</label>
                <input type="datetime-local" style={s.input} value={f('end_date')} onChange={e => setField('end_date', e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="What's happening?" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Ticket Price (₮, 0 = free)</label>
                <input type="number" style={s.input} placeholder="0" value={f('price')} onChange={e => setField('price', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Max Attendees</label>
                <input type="number" style={s.input} placeholder="Unlimited" value={f('max_attendees')} onChange={e => setField('max_attendees', e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Cover Image URL</label>
              <input style={s.input} placeholder="https://…" value={f('cover_image_url')} onChange={e => setField('cover_image_url', e.target.value)} />
            </div>
          </>
        )

      case 'service':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Service Title</label>
              <input style={s.input} placeholder="e.g. Logo Design" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="Describe your service…" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Price (₮)</label>
                <input type="number" style={s.input} placeholder="0" value={f('price')} onChange={e => setField('price', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Delivery Time</label>
                <input style={s.input} placeholder="e.g. 3 days" value={f('delivery_time')} onChange={e => setField('delivery_time', e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>What&apos;s Included</label>
              <textarea style={s.textarea} placeholder="List everything included…" value={f('whats_included')} onChange={e => setField('whats_included', e.target.value)} />
            </div>
          </>
        )

      case 'product':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Product Title</label>
              <input style={s.input} placeholder="Product name…" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="Describe your product…" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Price (₮)</label>
                <input type="number" style={s.input} placeholder="0" value={f('price')} onChange={e => setField('price', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Condition</label>
                <select style={s.select} value={f('condition') || 'New'} onChange={e => setField('condition', e.target.value)}>
                  {['New', 'Like New', 'Good', 'Fair'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Image URLs (one per line)</label>
              <textarea style={{ ...s.textarea, minHeight: '80px' }} placeholder="https://image1.com&#10;https://image2.com" value={f('images')} onChange={e => setField('images', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Shipping Info</label>
              <input style={s.input} placeholder="e.g. Ships worldwide, 3-5 days" value={f('shipping')} onChange={e => setField('shipping', e.target.value)} />
            </div>
          </>
        )

      case 'poll':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Question</label>
              <input style={s.input} placeholder="What do you want to know?" value={f('question')} onChange={e => setField('question', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Options (2–4)</label>
              {pollOptions.map((opt, i) => (
                <div key={i} style={s.pollOption}>
                  <input
                    style={{ ...s.input, flex: 1 }}
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={e => {
                      const next = [...pollOptions]
                      next[i] = e.target.value
                      setPollOptions(next)
                    }}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.1rem' }}
                      onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                    >×</button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button style={s.btnSecondary} onClick={() => setPollOptions([...pollOptions, ''])}>+ Add option</button>
              )}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Duration</label>
              <select style={s.select} value={f('duration') || '7d'} onChange={e => setField('duration', e.target.value)}>
                {['1d', '3d', '7d', '14d'].map(d => <option key={d} value={d}>{d === '1d' ? '1 day' : d === '3d' ? '3 days' : d === '7d' ? '7 days' : '14 days'}</option>)}
              </select>
            </div>
          </>
        )

      default:
        return null
    }
  }

  const renderPreview = () => {
    switch (selectedType) {
      case 'article':
        return (
          <div style={s.previewCard}>
            {f('cover_image_url') && <img src={f('cover_image_url')} alt="" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }} />}
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.75rem' }}>{f('title') || 'Untitled Article'}</h1>
            <div style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{f('body') || 'No content yet.'}</div>
          </div>
        )

      case 'poll':
        return (
          <div style={s.previewCard}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f1f5f9', marginBottom: '1rem' }}>{f('question') || 'Your question here'}</div>
            {pollOptions.filter(o => o.trim()).map((opt, i) => (
              <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.65rem 1rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
                {opt}
              </div>
            ))}
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>⏱ Ends in {f('duration') || '7d'}</div>
          </div>
        )

      case 'job':
        return (
          <div style={s.previewCard}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>{f('title') || 'Job Title'}</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>{f('company')} · {f('job_type') || 'Full-time'}</div>
            {(f('salary_min') || f('salary_max')) && <div style={{ color: '#38bdf8', fontSize: '0.85rem', marginTop: '0.25rem' }}>₮{f('salary_min')} – ₮{f('salary_max')}</div>}
            <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>{f('description')}</div>
          </div>
        )

      case 'event':
        return (
          <div style={s.previewCard}>
            {f('cover_image_url') && <img src={f('cover_image_url')} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} />}
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>{f('title') || 'Event Title'}</div>
            {f('start_date') && <div style={{ color: '#38bdf8', fontSize: '0.85rem', marginTop: '0.25rem' }}>📅 {new Date(f('start_date')).toLocaleString()}</div>}
            {location && <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.2rem' }}>📍 {location}</div>}
            <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '0.75rem' }}>{f('description')}</div>
          </div>
        )

      case 'service':
      case 'product':
        return (
          <div style={s.previewCard}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>{f('title') || (selectedType === 'service' ? 'Service Title' : 'Product Title')}</div>
            <div style={{ color: '#38bdf8', fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem' }}>₮{f('price') || '0'}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '0.75rem' }}>{f('description')}</div>
          </div>
        )

      case 'link':
        return (
          <div style={s.previewCard}>
            {linkPreview ? (
              <>
                {linkPreview.image && <img src={linkPreview.image} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} />}
                <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{linkPreview.title}</div>
                {linkPreview.description && <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>{linkPreview.description}</div>}
                <div style={{ color: '#38bdf8', fontSize: '0.8rem', marginTop: '0.4rem' }}>{f('url')}</div>
              </>
            ) : (
              <div style={{ color: '#64748b' }}>Enter a URL to see preview</div>
            )}
          </div>
        )

      default:
        return (
          <div style={s.previewCard}>
            <div style={{ color: '#64748b' }}>Preview will appear here</div>
          </div>
        )
    }
  }

  // ── Page render ──────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Toast */}
      <div style={s.toast(showToast)}>{toast}</div>

      <h1 style={s.heading}>Create</h1>
      <p style={s.subtext}>Choose a format to get started</p>

      {/* Type grid */}
      <div style={s.grid}>
        {POST_TYPES.map(({ type, icon, label, desc }) => (
          <button
            key={type}
            style={s.typeCard(selectedType === type)}
            onClick={() => {
              setSelectedType(type)
              setPreview(false)
            }}
          >
            <span style={s.typeIcon}>{icon}</span>
            <span style={s.typeLabel(selectedType === type)}>{label}</span>
            <span style={s.typeDesc}>{desc}</span>
          </button>
        ))}
      </div>

      {/* Form */}
      {selectedType && renderForm()}
    </div>
  )
}
