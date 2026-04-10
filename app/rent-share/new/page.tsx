'use client'
import React, { useState, useEffect } from 'react'
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

export default function NewRentSharePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Tools')
  const [pricePerDay, setPricePerDay] = useState('')
  const [pricePerWeek, setPricePerWeek] = useState('')
  const [deposit, setDeposit] = useState('')
  const [location, setLocation] = useState('')
  const [imageUrl, setImageUrl] = useState('')
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
          images:         imageUrl.trim() ? [imageUrl.trim()] : [],
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

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 }}>
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

          {/* Photo URL */}
          <div>
            <label style={labelStyle}>Photo URL <span style={{ color: '#334155', textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 6 }}>Paste a direct link to an image of your item</div>
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
            {loading ? 'Publishing…' : '♻️ Publish Listing'}
          </button>
        </form>
      </div>
    </div>
  )
}
