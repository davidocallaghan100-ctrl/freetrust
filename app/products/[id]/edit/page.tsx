'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type ListingForm = {
  title: string
  description: string
  price: string
  currency: string
  stock_qty: string
  condition: string
  tags: string
  shipping_options: string
  cover_image: string
  images: string[]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EditListingPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notAllowed, setNotAllowed] = useState(false)
  const [saved, setSaved] = useState(false)
  const [productType, setProductType] = useState<'physical' | 'digital' | 'service'>('physical')
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<ListingForm>({
    title: '',
    description: '',
    price: '',
    currency: 'EUR',
    stock_qty: '',
    condition: 'new',
    tags: '',
    shipping_options: '',
    cover_image: '',
    images: [],
  })

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setNotAllowed(true); setLoading(false); return }

      const { data: listing, error: lstErr } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single()

      if (lstErr || !listing) { setNotAllowed(true); setLoading(false); return }
      if (listing.seller_id !== user.id) { setNotAllowed(true); setLoading(false); return }

      setProductType(listing.product_type || 'physical')
      setForm({
        title: listing.title || '',
        description: listing.description || '',
        price: listing.price?.toString() || '',
        currency: listing.currency || 'EUR',
        stock_qty: listing.stock_qty?.toString() || '',
        condition: listing.condition || 'new',
        tags: (listing.tags || []).join(', '),
        shipping_options: listing.shipping_options || '',
        cover_image: listing.cover_image || '',
        images: Array.isArray(listing.images) ? listing.images : [],
      })
      setLoading(false)
    }
    load()
  }, [id])

  function set(field: keyof ListingForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()
      const path = `listings/${id}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('media').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
      const url = urlData.publicUrl
      setForm(f => ({
        ...f,
        cover_image: f.cover_image || url,
        images: f.images.includes(url) ? f.images : [...f.images, url],
      }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeImage(url: string) {
    setForm(f => ({
      ...f,
      images: f.images.filter(i => i !== url),
      cover_image: f.cover_image === url ? (f.images.find(i => i !== url) || '') : f.cover_image,
    }))
  }

  function setCover(url: string) {
    setForm(f => ({ ...f, cover_image: url }))
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return }
    const price = parseFloat(form.price)
    if (isNaN(price) || price < 0) { setError('Enter a valid price'); return }

    setSaving(true)
    setError(null)

    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const updates: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      price,
      currency: form.currency,
      tags,
      cover_image: form.cover_image || null,
      images: form.images,
    }
    if (productType === 'physical') {
      updates.stock_qty = parseInt(form.stock_qty) || 0
      updates.condition = form.condition
      updates.shipping_options = form.shipping_options.trim() || null
    }

    // Route through the PATCH endpoint so:
    //   * text[] columns are pre-encoded server-side (avoids the
    //     "expected pattern" PostgREST bug — see lib/supabase/text-array.ts)
    //   * Supabase errors are logged in full to Vercel instead of being
    //     swallowed by the client
    //   * any column that isn't in the server allowlist is dropped
    //     safely rather than causing a schema-cache miss
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json().catch(() => ({}))
      setSaving(false)
      if (!res.ok) {
        // Log the full error for diagnosis — the server returns `error`
        // plus a `detail` object with code/details/hint from PostgREST.
        console.error('[edit] PATCH failed:', res.status, data)
        const detail = data?.detail
        const extra = detail
          ? ` (${[detail.code, detail.hint, detail.details].filter(Boolean).join(' · ')})`
          : ''
        setError(`${data?.error ?? 'Save failed'}${extra}`)
        return
      }
      setSaved(true)
      setTimeout(() => { setSaved(false); router.back() }, 1200)
    } catch (err: unknown) {
      setSaving(false)
      const msg = err instanceof Error ? err.message : 'Network error while saving'
      console.error('[edit] PATCH threw:', err)
      setError(msg)
    }
  }

  // ─── Theme ─────────────────────────────────────────────────────────────────
  const bg = '#030712'
  const card = '#111827'
  const border = 'rgba(139,92,246,0.2)'
  const accent = '#8b5cf6'
  const text = '#f1f5f9'
  const muted = '#64748b'
  const inputStyle = {
    width: '100%', background: '#1f2937', border: '1px solid rgba(139,92,246,0.2)',
    borderRadius: 10, padding: '0.75rem 1rem', color: text, fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box' as const,
  }
  const labelStyle = { fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: 6, display: 'block' as const }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: muted, fontSize: '0.85rem' }}>Loading…</p>
        </div>
      </main>
    )
  }

  if (notAllowed) {
    return (
      <main style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ fontWeight: 800, margin: '0 0 0.5rem' }}>Not authorised</h2>
          <p style={{ color: muted, marginBottom: '1.5rem' }}>Only the listing owner can edit this.</p>
          <button onClick={() => router.back()} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 10, padding: '0.65rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>Go back</button>
        </div>
      </main>
    )
  }

  return (
    <main className="ft-page-content" style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, sans-serif', paddingBottom: 100 }}>
      <style>{`
        input:focus, textarea:focus, select:focus { border-color: ${accent} !important; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
        .img-thumb:hover .img-remove { opacity: 1 !important; }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1.25rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => router.back()} style={{ background: '#1f2937', border: `1px solid ${border}`, borderRadius: 10, padding: '0.5rem 1rem', color: text, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Edit listing</h1>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '0.75rem 1rem', color: '#f87171', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        {/* Images */}
        <section style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: '0 0 1rem', color: text }}>📸 Photos</h3>

          {/* Image grid */}
          {form.images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, marginBottom: '1rem' }}>
              {form.images.map((url, i) => (
                <div key={i} className="img-thumb" style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1/1', border: `2px solid ${form.cover_image === url ? accent : border}`, cursor: 'pointer' }}
                  onClick={() => setCover(url)}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {form.cover_image === url && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: accent, color: '#fff', fontSize: '0.6rem', fontWeight: 700, textAlign: 'center', padding: '2px 0' }}>COVER</div>
                  )}
                  <button className="img-remove" onClick={(e) => { e.stopPropagation(); removeImage(url) }}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: '0.75rem', color: muted, marginBottom: '0.75rem' }}>Tap a photo to set it as the cover image.</p>

          {/* Upload button */}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            style={{ background: 'rgba(139,92,246,0.1)', border: `1.5px dashed ${border}`, borderRadius: 10, padding: '0.75rem 1.25rem', color: uploading ? muted : accent, fontSize: '0.85rem', fontWeight: 600, cursor: uploading ? 'wait' : 'pointer', width: '100%' }}>
            {uploading ? '⏳ Uploading…' : '+ Add photo'}
          </button>
        </section>

        {/* Core details */}
        <section style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: text }}>📝 Details</h3>

          <div>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Listing title" maxLength={120} />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what you're offering…" maxLength={2000} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Price *</label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select style={inputStyle} value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option value="EUR">EUR €</option>
                <option value="GBP">GBP £</option>
                <option value="USD">USD $</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Tags <span style={{ fontWeight: 400, color: muted }}>(comma-separated)</span></label>
            <input style={inputStyle} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="e.g. web design, React, freelance" />
          </div>
        </section>

        {/* Physical-only fields */}
        {productType === 'physical' && (
          <section style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: text }}>📦 Stock & Shipping</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Stock quantity</label>
                <input style={inputStyle} type="number" min="0" value={form.stock_qty} onChange={e => set('stock_qty', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Condition</label>
                <select style={inputStyle} value={form.condition} onChange={e => set('condition', e.target.value)}>
                  <option value="new">New</option>
                  <option value="like_new">Like New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Shipping info</label>
              <input style={inputStyle} value={form.shipping_options} onChange={e => set('shipping_options', e.target.value)} placeholder="e.g. Free tracked delivery 3–5 days" maxLength={200} />
            </div>
          </section>
        )}

        {/* Save button */}
        <button onClick={handleSave} disabled={saving || saved}
          style={{ width: '100%', background: saved ? 'rgba(52,211,153,0.2)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: saved ? '#34d399' : '#fff', border: saved ? '1.5px solid rgba(52,211,153,0.4)' : 'none', borderRadius: 12, padding: '1rem', fontWeight: 800, fontSize: '1rem', cursor: saving || saved ? 'default' : 'pointer', boxShadow: saved ? 'none' : '0 4px 20px rgba(139,92,246,0.3)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? '💾 Saving…' : saved ? '✓ Saved!' : 'Save changes'}
        </button>
      </div>
    </main>
  )
}
