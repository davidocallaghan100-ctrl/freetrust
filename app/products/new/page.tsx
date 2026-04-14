'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/image-compression'

const CATEGORIES = [
  { id: 'technology',     label: 'Technology',  icon: '💻' },
  { id: 'art',            label: 'Art',          icon: '🎨' },
  { id: 'music',          label: 'Music',        icon: '🎵' },
  { id: 'courses',        label: 'Courses',      icon: '🎓' },
  { id: 'templates',      label: 'Templates',    icon: '📋' },
  { id: 'handmade',       label: 'Handmade',     icon: '🤲' },
  { id: 'food-groceries', label: 'Food',         icon: '🥦' },
  { id: 'books',          label: 'Books',        icon: '📖' },
  { id: 'software',       label: 'Software',     icon: '⚙️' },
  { id: 'photography',    label: 'Photography',  icon: '📷' },
  { id: 'merch',          label: 'Merch',        icon: '👕' },
  { id: 'other',          label: 'Other',        icon: '📦' },
]

const MAX_IMAGES = 8

interface NewImage { type: 'new'; file: File; preview: string }

export default function NewProductPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [authChecking, setAuthChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // When an image upload fails, we offer the user an escape hatch:
  // "Publish without photos" — creates the listing with no images so
  // they can at least get the product live and add photos later via the
  // edit page. `imageUploadFailed` gates the visibility of that button.
  const [imageUploadFailed, setImageUploadFailed] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('technology')
  const [productType, setProductType] = useState<'physical' | 'digital'>('physical')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [stock, setStock] = useState('')
  const [tags, setTags] = useState('')
  const [images, setImages] = useState<NewImage[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.replace('/login?next=/products/new')
      } else {
        setAuthChecking(false)
      }
    })
  }, [router])

  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.preview))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) return
    // Accept anything that looks like an image. Older iOS / Android builds
    // report `file.type === ''` for HEIC photos, so we fall back on the
    // file extension before dropping the file. Without this, mobile users
    // tap their camera roll, pick an image, and see "nothing happened".
    const IMG_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i
    const toAdd = arr.slice(0, remaining).filter(f => {
      if (f.type && f.type.startsWith('image/')) return true
      if (!f.type && IMG_EXT.test(f.name)) return true
      return false
    })
    const newImages: NewImage[] = toAdd.map(f => ({
      type: 'new',
      file: f,
      preview: URL.createObjectURL(f),
    }))
    setImages(prev => [...prev, ...newImages])
  }, [images.length])

  function removeImage(index: number) {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function moveImage(from: number, to: number) {
    setImages(prev => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
  }

  async function uploadImages(): Promise<string[]> {
    if (images.length === 0) return []
    setUploadingCount(images.length)
    const uploaded: string[] = []
    for (const img of images) {
      // Client-side compression — mobile camera photos are 8–15 MB and
      // exceed Vercel's 4.5 MB body limit, causing HTTP 413. Shrinks to
      // ~2 MB before the request is even built. Falls back to the
      // original file on any failure (HEIC without decoder, etc.).
      const compressed = await compressImage(img.file, 2)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.append('type', 'listing')
      let res: Response
      try {
        res = await fetch('/api/upload/media', { method: 'POST', body: fd })
      } catch (netErr) {
        // Network-layer failure (mobile data drop, CORS, etc.)
        const msg = netErr instanceof Error ? netErr.message : String(netErr)
        console.error('[new product] upload network error:', msg, { fileName: img.file.name })
        throw new Error(`Network error uploading image: ${msg}`)
      }
      // Read raw text first so non-JSON responses (Vercel HTML error
      // pages, empty bodies, middleware-wrapped blanks) are surfaced in
      // the error message instead of silently disappearing.
      const rawText = await res.text()
      let data: { url?: string; error?: string; detail?: unknown } = {}
      if (rawText) {
        try {
          data = JSON.parse(rawText)
        } catch {
          console.error('[new product] upload response was not JSON:', rawText.slice(0, 200))
        }
      }
      if (!res.ok || !data.url) {
        // Log the full server response so the failure is diagnosable
        // from the browser console on the affected mobile device.
        console.error('[new product] upload failed:', {
          status: res.status,
          statusText: res.statusText,
          body: data,
          rawText: rawText.slice(0, 500),
          fileName: img.file.name,
          fileType: img.file.type,
          fileSize: img.file.size,
        })
        throw new Error(
          data.error ??
            `Image upload failed (HTTP ${res.status} ${res.statusText}). ` +
              `Server response: ${rawText.slice(0, 200) || '<empty body>'}`
        )
      }
      uploaded.push(data.url)
      setUploadingCount(c => c - 1)
    }
    return uploaded
  }

  // Core publish flow. `skipImages = true` is the "Publish without
  // photos" escape hatch — if image uploads keep failing on mobile,
  // the user can still get their product live without images and add
  // them from the edit page later.
  async function submitListing(skipImages: boolean) {
    if (!title.trim() || title.trim().length < 3) {
      setError('Title must be at least 3 characters.')
      return
    }
    if (!description.trim() || description.trim().length < 10) {
      setError('Description must be at least 10 characters.')
      return
    }
    const parsedPrice = parseFloat(price)
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Please enter a valid price.')
      return
    }

    setLoading(true)
    setError('')

    // Step 1: Upload images (unless we're in the escape-hatch path).
    // Upload failures are handled in their own try/catch so they can
    // set imageUploadFailed=true and surface a dedicated error that
    // unlocks the "Publish without photos" button. A failure here
    // aborts the publish — the escape hatch re-invokes submitListing
    // with skipImages=true to bypass this branch.
    let uploadedImages: string[] = []
    if (!skipImages) {
      try {
        uploadedImages = await uploadImages()
        setImageUploadFailed(false)
      } catch (uploadErr) {
        const msg = uploadErr instanceof Error ? uploadErr.message : 'Image upload failed'
        console.error('[new product] image upload aborted publish:', msg)
        setError(msg)
        setImageUploadFailed(true)
        setLoading(false)
        setUploadingCount(0)
        return
      }
    }

    // Step 2: Create the listing. This is its own try/catch so a
    // listing insert failure doesn't mask an earlier upload failure.
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)

      // Hoist the payload so we can log it BEFORE the fetch. Silent
      // failures are much easier to diagnose with the exact JSON body
      // the client shipped printed in the browser console on the
      // affected device.
      const payload = {
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        currency,
        product_type: productType,
        category,
        tags: tagList,
        images: uploadedImages,
        cover_image: uploadedImages[0] ?? null,
        // Renamed from `stock` → `stock_qty` to match the DB column. The
        // previous shape was silently dropped by the server because the
        // POST handler didn't destructure a `stock` field, leading to
        // products always showing "out of stock" on the detail page.
        ...(stock && productType === 'physical' ? { stock_qty: parseInt(stock) } : {}),
      }
      console.log('[product submit] payload:', JSON.stringify(payload))

      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      console.log('[product submit] response status:', res.status, res.statusText)

      // Read the body as TEXT first so that ANY response (empty body,
      // HTML error page, malformed JSON) is captured verbatim for logs.
      // The previous `await res.json().catch(() => ({}))` silently
      // swallowed parse failures and left the user staring at a form
      // that did nothing — this is the "blank response after images
      // are uploaded" bug the user reported.
      const rawText = await res.text()
      console.log('[product submit] response body (raw):', rawText)

      let data: { listing?: { id: string }; error?: string; detail?: unknown } = {}
      if (rawText) {
        try {
          data = JSON.parse(rawText)
        } catch (parseErr) {
          console.error('[product submit] failed to parse response JSON:', parseErr)
          throw new Error(
            `Server returned non-JSON (HTTP ${res.status}): ` +
            (rawText.slice(0, 200) || '<empty body>')
          )
        }
      }
      console.log('[product submit] response body (parsed):', data)

      if (!res.ok) {
        console.error('[new product] listings POST failed:', {
          status: res.status,
          statusText: res.statusText,
          body: data,
          rawText: rawText.slice(0, 500),
        })
        throw new Error(
          data.error ??
            `Failed to create product (HTTP ${res.status} ${res.statusText}). ` +
              `Server response: ${rawText.slice(0, 200) || '<empty body>'}`
        )
      }
      if (!data.listing?.id) {
        throw new Error(
          `Product created but server did not return a listing id. ` +
            `Raw response: ${rawText.slice(0, 200) || '<empty body>'}`
        )
      }
      console.log('[product submit] success → /products/' + data.listing.id)
      router.push(`/products/${data.listing.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      console.error('[new product] publish error:', err)
      setError(msg)
    } finally {
      setLoading(false)
      setUploadingCount(0)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitListing(false)
  }

  async function handlePublishWithoutImages() {
    // Called from the inline error banner when image uploads fail.
    // Same flow as handleSubmit, but bypasses the upload step.
    await submitListing(true)
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
    ? `Uploading ${uploadingCount} image${uploadingCount > 1 ? 's' : ''}…`
    : loading ? 'Publishing…' : '+ Publish Product'

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .img-thumb { position: relative; border-radius: 10px; overflow: hidden; aspect-ratio: 1; background: #1e293b; border: 2px solid #334155; }
        .img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .img-thumb .rm-btn { position: absolute; top: 4px; right: 4px; background: rgba(15,23,42,0.85); border: 1px solid #334155; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #f87171; font-size: 11px; font-weight: 700; }
        .img-thumb .rm-btn:hover { background: rgba(248,113,113,0.15); border-color: rgba(248,113,113,0.4); }
        .img-thumb .move-btns { position: absolute; bottom: 4px; left: 4px; display: none; gap: 3px; }
        .img-thumb:hover .move-btns { display: flex; }
        .img-thumb .move-btn { background: rgba(15,23,42,0.85); border: 1px solid #334155; border-radius: 5px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #94a3b8; font-size: 10px; }
        .img-thumb .move-btn:hover:not(:disabled) { color: #38bdf8; border-color: rgba(56,189,248,0.4); }
        .img-thumb .move-btn:disabled { opacity: 0.3; cursor: default; }
        .img-thumb .order-badge { position: absolute; top: 4px; left: 4px; background: rgba(15,23,42,0.85); border: 1px solid #334155; border-radius: 4px; padding: 1px 5px; font-size: 10px; font-weight: 700; color: #64748b; }
        .img-thumb:first-child .order-badge { color: #38bdf8; border-color: rgba(56,189,248,0.3); }
        .drop-zone { border: 2px dashed #334155; border-radius: 12px; padding: 1.5rem; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .drop-zone:hover, .drop-zone.drag-over { border-color: rgba(56,189,248,0.5); background: rgba(56,189,248,0.04); }
        .img-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 0.6rem; margin-bottom: 0.75rem; }
        @media (max-width: 600px) { .img-grid { grid-template-columns: repeat(3,1fr) !important; } }
        @media (max-width: 400px) { .img-grid { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1.5rem 5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: '1rem', fontFamily: 'inherit' }}>
            ← Back
          </button>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.4rem' }}>List a Product</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Sell your digital or physical products to the FreeTrust community</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Product Type */}
          <div>
            <label style={labelStyle}>Product Type *</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { value: 'physical', label: '📦 Physical', hint: 'Shipped or collected in person' },
                { value: 'digital',  label: '💾 Digital',  hint: 'Instant download or link' },
              ].map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setProductType(t.value as 'physical' | 'digital')}
                  style={{
                    flex: 1, padding: '0.65rem 1rem', borderRadius: 10, cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    background: productType === t.value ? 'rgba(56,189,248,0.1)' : '#1e293b',
                    border: productType === t.value ? '1px solid rgba(56,189,248,0.4)' : '1px solid #334155',
                    color: productType === t.value ? '#38bdf8' : '#94a3b8',
                  }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.label}</div>
                  <div style={{ fontSize: '0.72rem', marginTop: 2, color: productType === t.value ? '#7dd3fc' : '#475569' }}>{t.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category *</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  style={{
                    padding: '0.35rem 0.8rem', borderRadius: 999, fontSize: '0.78rem', cursor: 'pointer',
                    fontFamily: 'inherit', fontWeight: category === c.id ? 700 : 500,
                    background: category === c.id ? 'rgba(56,189,248,0.12)' : '#1e293b',
                    border: category === c.id ? '1px solid rgba(56,189,248,0.4)' : '1px solid #334155',
                    color: category === c.id ? '#38bdf8' : '#94a3b8',
                  }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Product Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Handmade Ceramic Mug"
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your product — materials, dimensions, what's included, delivery details…"
              rows={5}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Price + Currency + Stock */}
          <div style={{ display: 'grid', gridTemplateColumns: productType === 'physical' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Price *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="EUR">EUR €</option>
                <option value="GBP">GBP £</option>
                <option value="USD">USD $</option>
              </select>
            </div>
            {productType === 'physical' && (
              <div>
                <label style={labelStyle}>Stock Qty</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  placeholder="e.g. 10"
                  style={inputStyle}
                />
              </div>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: -12 }}>
            {productType === 'physical' ? 'Leave stock blank for unlimited' : 'Set price to 0 for a free download'}
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags <span style={{ color: '#334155', textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="ceramic, handmade, gift — comma separated"
              style={inputStyle}
            />
          </div>

          {/* Images */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Images ({images.length}/{MAX_IMAGES})</label>
              {images.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: '#475569' }}>First image is the cover · hover to reorder</span>
              )}
            </div>

            {images.length > 0 && (
              <div className="img-grid">
                {images.map((img, i) => (
                  <div key={i} className="img-thumb">
                    <img src={img.preview} alt={`Image ${i + 1}`} />
                    <div className="order-badge">{i === 0 ? 'Cover' : `#${i + 1}`}</div>
                    <button type="button" className="rm-btn" onClick={() => removeImage(i)} title="Remove">✕</button>
                    <div className="move-btns">
                      <button type="button" className="move-btn" onClick={() => moveImage(i, i - 1)} disabled={i === 0} title="Move left">←</button>
                      <button type="button" className="move-btn" onClick={() => moveImage(i, i + 1)} disabled={i === images.length - 1} title="Move right">→</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {images.length < MAX_IMAGES && (
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
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>🖼️</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 3 }}>
                  <span style={{ color: '#38bdf8' }}>Tap to select photos</span> — or drop them here
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                  JPG, PNG, WEBP, HEIC — up to 10MB each · {MAX_IMAGES - images.length} slot{MAX_IMAGES - images.length !== 1 ? 's' : ''} remaining
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  // Include HEIC/HEIF so iPhone camera photos are pickable
                  // (iOS 11+ saves camera shots as HEIC by default). Without
                  // these, Android Chrome filters the files out of the picker
                  // entirely and iOS Safari's auto-conversion behaviour is
                  // inconsistent across versions.
                  accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value = '' } }}
                />
              </div>
            )}

            {images.length >= MAX_IMAGES && (
              <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '10px 14px', fontSize: '0.82rem', color: '#64748b', textAlign: 'center' }}>
                Maximum {MAX_IMAGES} images reached — remove one to add another
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '12px 14px', color: '#f87171', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ lineHeight: 1.5 }}>{error}</div>
              {/* Escape hatch: if the image upload failed, let the user
                  publish the listing without photos instead of getting
                  stuck. They can add photos later from the edit page. */}
              {imageUploadFailed && (
                <button
                  type="button"
                  onClick={handlePublishWithoutImages}
                  disabled={loading}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'rgba(56,189,248,0.12)',
                    border: '1px solid rgba(56,189,248,0.4)',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#38bdf8',
                    cursor: loading ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  📦 Publish without photos →
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{ flex: '0 0 auto', background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ flex: 1, background: loading ? '#1e293b' : 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 12, padding: '12px 0', fontSize: 15, fontWeight: 700, color: loading ? '#475569' : '#0f172a', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
