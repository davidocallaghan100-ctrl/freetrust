'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['Tools', 'Electronics', 'Vehicles', 'Clothing', 'Space', 'Equipment', 'Other']

const CAT_HINTS: Record<string, string> = {
  Tools:       'Power tools, hand tools, ladders, measuring equipment…',
  Electronics: 'Cameras, projectors, speakers, gaming gear…',
  Vehicles:    'Bikes, cargo bikes, cars, vans, trailers…',
  Clothing:    'Formal wear, costumes, outdoor gear…',
  Space:       'Storage space, parking, desk space, event venue…',
  Equipment:   'Camping gear, sports equipment, party supplies…',
  Other:       'Anything that doesn\'t fit the above categories',
}

const MAX_PHOTOS = 8

interface NewPhoto { type: 'new'; file: File; preview: string }

export default function NewRentSharePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Tools')
  const [pricePerDay, setPricePerDay] = useState('')
  const [pricePerWeek, setPricePerWeek] = useState('')
  const [deposit, setDeposit] = useState('')
  const [location, setLocation] = useState('')
  const [photos, setPhotos] = useState<NewPhoto[]>([])
  const [availableFrom, setAvailableFrom] = useState('')
  const [availableTo, setAvailableTo] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.replace('/login?next=/rent-share/new')
      } else {
        setAuthChecking(false)
      }
    })
  }, [router])

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.preview))
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
      URL.revokeObjectURL(prev[index].preview)
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

  async function uploadPhotos(): Promise<string[]> {
    if (photos.length === 0) return []
    setUploadingCount(photos.length)
    const uploaded: string[] = []
    for (const p of photos) {
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
    if (!title.trim() || title.trim().length < 3) {
      setError('Title must be at least 3 characters.')
      return
    }
    if (!description.trim() || description.trim().length < 10) {
      setError('Description must be at least 10 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const uploadedImages = await uploadPhotos()
      const res = await fetch('/api/rent-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          price_per_day:  pricePerDay  ? parseFloat(pricePerDay)  : null,
          price_per_week: pricePerWeek ? parseFloat(pricePerWeek) : null,
          deposit:        deposit      ? parseFloat(deposit)       : 0,
          location:       location.trim() || null,
          images:         uploadedImages,
          available_from: availableFrom || null,
          available_to:   availableTo   || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create listing')
      router.push(`/rent-share/${data.listing.id}`)
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

  const submitLabel = uploadingCount > 0
    ? `Uploading ${uploadingCount} photo${uploadingCount > 1 ? 's' : ''}…`
    : loading ? 'Publishing…' : '♻️ Publish Listing'

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .photo-thumb { position: relative; border-radius: 10px; overflow: hidden; aspect-ratio: 1; background: #1e293b; border: 2px solid #334155; }
        .photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .photo-thumb .rm-btn { position: absolute; top: 4px; right: 4px; background: rgba(15,23,42,0.85); border: 1px solid #334155; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #f87171; font-size: 11px; font-weight: 700; }
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
        .rs-photo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin-bottom: 0.75rem; }
        @media (max-width: 600px) { .rs-photo-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (max-width: 400px) { .rs-photo-grid { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: '1rem', fontFamily: 'inherit' }}>
            ← Back
          </button>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.4rem' }}>List an Item</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Share something useful with your community</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Category */}
          <div>
            <label style={labelStyle}>Category *</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button
                  key={c} type="button" onClick={() => setCategory(c)}
                  style={{
                    padding: '0.4rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer',
                    fontFamily: 'inherit', fontWeight: category === c ? 700 : 500,
                    background: category === c ? 'rgba(45,212,191,0.15)' : '#1e293b',
                    border: category === c ? '1px solid rgba(45,212,191,0.4)' : '1px solid #334155',
                    color: category === c ? '#2dd4bf' : '#94a3b8',
                  }}>
                  {c}
                </button>
              ))}
            </div>
            {CAT_HINTS[category] && (
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 6 }}>{CAT_HINTS[category]}</div>
            )}
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Item Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Bosch Power Drill" style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the item — condition, what's included, any restrictions…"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Pricing */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Price / Day (€)</label>
              <input type="number" min="0" step="0.5" value={pricePerDay} onChange={e => setPricePerDay(e.target.value)} placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Price / Week (€)</label>
              <input type="number" min="0" step="1" value={pricePerWeek} onChange={e => setPricePerWeek(e.target.value)} placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Deposit (€)</label>
              <input type="number" min="0" step="1" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0.00" style={inputStyle} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: -8 }}>Leave prices at 0 to list as free / community share</div>

          {/* Location */}
          <div>
            <label style={labelStyle}>Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Dublin 8, Cork City, Galway…" style={inputStyle} />
          </div>

          {/* Availability */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Available From</label>
              <input type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={labelStyle}>Available To</label>
              <input type="date" value={availableTo} onChange={e => setAvailableTo(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
          </div>

          {/* Photos */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Photos ({photos.length}/{MAX_PHOTOS})</label>
              {photos.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: '#475569' }}>First photo is the cover image · hover to reorder</span>
              )}
            </div>

            {photos.length > 0 && (
              <div className="rs-photo-grid">
                {photos.map((p, i) => (
                  <div key={i} className="photo-thumb">
                    <img src={p.preview} alt={`Photo ${i + 1}`} />
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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{ background: loading ? '#1e293b' : 'linear-gradient(135deg,#2dd4bf,#0891b2)', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 15, fontWeight: 700, color: loading ? '#475569' : '#0f172a', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {submitLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
