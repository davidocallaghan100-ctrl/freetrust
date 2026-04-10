'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['Tools', 'Electronics', 'Vehicles', 'Clothing', 'Space', 'Equipment', 'Other']
const MAX_PHOTOS = 8

interface ExistingPhoto { type: 'existing'; url: string }
interface NewPhoto     { type: 'new';      file: File; preview: string }
type Photo = ExistingPhoto | NewPhoto

export default function EditRentSharePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [authChecking, setAuthChecking] = useState(true)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [dragOver,     setDragOver]     = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)

  // Form fields
  const [title,         setTitle]         = useState('')
  const [description,   setDescription]   = useState('')
  const [category,      setCategory]      = useState('Tools')
  const [status,        setStatus]        = useState('active')
  const [pricePerDay,   setPricePerDay]   = useState('')
  const [pricePerWeek,  setPricePerWeek]  = useState('')
  const [deposit,       setDeposit]       = useState('')
  const [location,      setLocation]      = useState('')
  const [availableFrom, setAvailableFrom] = useState('')
  const [availableTo,   setAvailableTo]   = useState('')
  const [photos,        setPhotos]        = useState<Photo[]>([])

  // Auth + ownership check + prefill
  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.replace(`/login?next=/rent-share/${id}/edit`)
        return
      }
      const res = await fetch(`/api/rent-share/${id}`)
      if (!res.ok) { router.replace('/rent-share'); return }
      const { listing } = await res.json()

      if (listing.user_id !== session.user.id) {
        router.replace(`/rent-share/${id}`)
        return
      }

      // Pre-fill
      setTitle(listing.title ?? '')
      setDescription(listing.description ?? '')
      setCategory(listing.category ?? 'Tools')
      setStatus(listing.status ?? 'active')
      setPricePerDay(listing.price_per_day != null ? String(listing.price_per_day) : '')
      setPricePerWeek(listing.price_per_week != null ? String(listing.price_per_week) : '')
      setDeposit(listing.deposit != null && listing.deposit > 0 ? String(listing.deposit) : '')
      setLocation(listing.location ?? '')
      setAvailableFrom(listing.available_from ?? '')
      setAvailableTo(listing.available_to ?? '')
      setPhotos((listing.images ?? []).map((url: string) => ({ type: 'existing' as const, url })))
      setAuthChecking(false)
    })
  }, [id, router])

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach(p => { if (p.type === 'new') URL.revokeObjectURL(p.preview) })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    const remaining = MAX_PHOTOS - photos.length
    if (remaining <= 0) return
    const toAdd = arr.slice(0, remaining).filter(f => f.type.startsWith('image/'))
    const newPhotos: NewPhoto[] = toAdd.map(f => ({
      type: 'new',
      file: f,
      preview: URL.createObjectURL(f),
    }))
    setPhotos(prev => [...prev, ...newPhotos])
  }, [photos.length])

  function removePhoto(index: number) {
    setPhotos(prev => {
      const p = prev[index]
      if (p.type === 'new') URL.revokeObjectURL(p.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function movePhoto(from: number, to: number) {
    setPhotos(prev => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
  }

  async function uploadNewPhotos(): Promise<string[]> {
    const newPhotos = photos.filter((p): p is NewPhoto => p.type === 'new')
    if (newPhotos.length === 0) return []

    setUploadingCount(newPhotos.length)
    const uploaded: string[] = []

    for (const p of newPhotos) {
      const fd = new FormData()
      fd.append('file', p.file)
      const res = await fetch('/api/upload/rent-share', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Photo upload failed')
      uploaded.push(data.url)
      setUploadingCount(c => c - 1)
    }

    return uploaded
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || title.trim().length < 3) { setError('Title must be at least 3 characters.'); return }
    if (!description.trim() || description.trim().length < 10) { setError('Description must be at least 10 characters.'); return }

    setLoading(true)
    setError('')

    try {
      // Upload any new photos first
      const newUrls = await uploadNewPhotos()

      // Build final images array: existing URLs first, then new uploads, in order
      let newIdx = 0
      const finalImages = photos.map(p => {
        if (p.type === 'existing') return p.url
        return newUrls[newIdx++]
      })

      const res = await fetch(`/api/rent-share/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         title.trim(),
          description:   description.trim(),
          category,
          status,
          price_per_day:  pricePerDay  ? parseFloat(pricePerDay)  : null,
          price_per_week: pricePerWeek ? parseFloat(pricePerWeek) : null,
          deposit:        deposit      ? parseFloat(deposit)       : 0,
          location:       location.trim() || null,
          images:         finalImages,
          available_from: availableFrom || null,
          available_to:   availableTo   || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      router.push(`/rent-share/${id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
      setUploadingCount(0)
    }
  }

  if (authChecking) {
    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 64 }}>
        <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155',
    borderRadius: 10, padding: '10px 14px', fontSize: 15, color: '#f1f5f9', outline: 'none', fontFamily: 'inherit',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase',
    letterSpacing: '0.06em', display: 'block', marginBottom: 6,
  }

  const savingLabel = uploadingCount > 0
    ? `Uploading ${uploadingCount} photo${uploadingCount > 1 ? 's' : ''}…`
    : loading ? 'Saving…' : '♻️ Save Changes'

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .photo-thumb { position: relative; border-radius: 10px; overflow: hidden; aspect-ratio: 1; background: #1e293b; border: 2px solid #334155; cursor: default; }
        .photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .photo-thumb .rm-btn { position: absolute; top: 4px; right: 4px; background: rgba(15,23,42,0.85); border: 1px solid #334155; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #f87171; font-size: 11px; font-weight: 700; backdrop-filter: blur(4px); }
        .photo-thumb .rm-btn:hover { background: rgba(248,113,113,0.15); border-color: rgba(248,113,113,0.4); }
        .photo-thumb .move-btns { position: absolute; bottom: 4px; left: 4px; display: none; gap: 3px; }
        .photo-thumb:hover .move-btns { display: flex; }
        .photo-thumb .move-btn { background: rgba(15,23,42,0.85); border: 1px solid #334155; border-radius: 5px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #94a3b8; font-size: 10px; }
        .photo-thumb .move-btn:hover:not(:disabled) { color: #38bdf8; border-color: rgba(56,189,248,0.4); }
        .photo-thumb .move-btn:disabled { opacity: 0.3; cursor: default; }
        .photo-thumb .order-badge { position: absolute; top: 4px; left: 4px; background: rgba(15,23,42,0.85); border: 1px solid #334155; border-radius: 4px; padding: 1px 5px; font-size: 10px; font-weight: 700; color: #64748b; }
        .photo-thumb:first-child .order-badge { color: #38bdf8; border-color: rgba(56,189,248,0.3); }
        .drop-zone { border: 2px dashed #334155; border-radius: 12px; padding: 1.5rem; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .drop-zone:hover, .drop-zone.drag-over { border-color: rgba(45,212,191,0.5); background: rgba(45,212,191,0.04); }
        .rs-edit-wrap { max-width: 700px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
        .rs-pricing-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
        .rs-avail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .rs-photo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin-bottom: 0.75rem; }
        .rs-edit-actions { display: flex; gap: 0.75rem; padding-top: 0.5rem; }
        .rs-cover-hint { font-size: 0.72rem; color: #475569; }
        @media (max-width: 768px) {
          .rs-edit-wrap { padding: 1.25rem 1rem 5rem !important; }
          .rs-pricing-grid { grid-template-columns: 1fr 1fr !important; }
          .rs-avail-grid { grid-template-columns: 1fr !important; }
          .rs-photo-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .rs-edit-actions { flex-direction: column !important; }
          .rs-cover-hint { display: none; }
        }
        @media (max-width: 400px) {
          .rs-pricing-grid { grid-template-columns: 1fr !important; }
          .rs-photo-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div className="rs-edit-wrap">
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link href={`/rent-share/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', marginBottom: '1rem' }}>
            ← Back to listing
          </Link>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.4rem' }}>Edit Listing</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Update your item details and photos</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category *</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)} style={{
                  padding: '0.4rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: category === c ? 700 : 500,
                  background: category === c ? 'rgba(45,212,191,0.15)' : '#1e293b',
                  border: category === c ? '1px solid rgba(45,212,191,0.4)' : '1px solid #334155',
                  color: category === c ? '#2dd4bf' : '#94a3b8',
                }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Item Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Bosch Power Drill" style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe the item — condition, what's included, any restrictions…"
              rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { value: 'active',   label: '✓ Available',  color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
                { value: 'rented',   label: '⟳ Rented',     color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
                { value: 'inactive', label: '✕ Inactive',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
              ].map(s => (
                <button key={s.value} type="button" onClick={() => setStatus(s.value)} style={{
                  flex: 1, padding: '0.5rem', borderRadius: 8, fontSize: '0.82rem', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: status === s.value ? 700 : 500,
                  background: status === s.value ? s.bg : '#1e293b',
                  border: status === s.value ? `1px solid ${s.color}50` : '1px solid #334155',
                  color: status === s.value ? s.color : '#64748b',
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div>
            <label style={labelStyle}>Pricing (€)</label>
            <div className="rs-pricing-grid">
              <div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 5 }}>Per Day</div>
                <input type="number" min="0" step="0.5" value={pricePerDay} onChange={e => setPricePerDay(e.target.value)} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 5 }}>Per Week</div>
                <input type="number" min="0" step="1" value={pricePerWeek} onChange={e => setPricePerWeek(e.target.value)} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 5 }}>Deposit</div>
                <input type="number" min="0" step="1" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0.00" style={inputStyle} />
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 6 }}>Leave at 0 for free / community share</div>
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Dublin 8, Cork City, Galway…" style={inputStyle} />
          </div>

          {/* Availability */}
          <div>
            <label style={labelStyle}>Availability</label>
            <div className="rs-avail-grid">
              <div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 5 }}>Available From</div>
                <input type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 5 }}>Available To</div>
                <input type="date" value={availableTo} onChange={e => setAvailableTo(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>
          </div>

          {/* Photos */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Photos ({photos.length}/{MAX_PHOTOS})</label>
              {photos.length > 0 && (
                <span className="rs-cover-hint">First photo is the cover image · hover to reorder</span>
              )}
            </div>

            {/* Photo grid */}
            {photos.length > 0 && (
              <div className="rs-photo-grid">
                {photos.map((p, i) => (
                  <div key={i} className="photo-thumb">
                    <img src={p.type === 'existing' ? p.url : p.preview} alt={`Photo ${i + 1}`} />
                    <div className="order-badge">{i === 0 ? 'Cover' : `#${i + 1}`}</div>
                    <button type="button" className="rm-btn" onClick={() => removePhoto(i)} title="Remove photo">✕</button>
                    <div className="move-btns">
                      <button type="button" className="move-btn" onClick={() => movePhoto(i, i - 1)} disabled={i === 0} title="Move left">←</button>
                      <button type="button" className="move-btn" onClick={() => movePhoto(i, i + 1)} disabled={i === photos.length - 1} title="Move right">→</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            {photos.length < MAX_PHOTOS && (
              <div
                className={`drop-zone${dragOver ? ' drag-over' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>📷</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 3 }}>
                  Drop photos here or <span style={{ color: '#2dd4bf' }}>click to browse</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                  JPG, PNG, WEBP — up to 10MB each · {MAX_PHOTOS - photos.length} slot{MAX_PHOTOS - photos.length !== 1 ? 's' : ''} remaining
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value = '' } }}
                />
              </div>
            )}

            {photos.length >= MAX_PHOTOS && (
              <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '10px 14px', fontSize: '0.82rem', color: '#64748b', textAlign: 'center' }}>
                Maximum {MAX_PHOTOS} photos reached — remove one to add another
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 14px', color: '#f87171', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="rs-edit-actions">
            <Link href={`/rent-share/${id}`} style={{
              flex: '0 0 auto', background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
              padding: '12px 20px', fontSize: 14, fontWeight: 600, color: '#94a3b8',
              textDecoration: 'none', display: 'flex', alignItems: 'center',
            }}>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1, background: loading ? '#1e293b' : 'linear-gradient(135deg,#2dd4bf,#0891b2)',
                border: 'none', borderRadius: 12, padding: '12px 0', fontSize: 15, fontWeight: 700,
                color: loading ? '#475569' : '#0f172a', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {savingLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
