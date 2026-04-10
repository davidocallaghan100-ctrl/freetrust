'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Listing {
  id: string
  title: string
  description: string
  category: string
  price_per_day: number | null
  price_per_week: number | null
  deposit: number | null
  location: string | null
  images: string[]
  available_from: string | null
  available_to: string | null
  status: string
  created_at: string
  owner: {
    id: string
    full_name: string | null
    avatar_url: string | null
    bio: string | null
    location: string | null
    created_at: string
  } | null
}

const CAT_META: Record<string, { emoji: string; color: string; bg: string }> = {
  Tools:       { emoji: '🔧', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  Electronics: { emoji: '📱', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  Vehicles:    { emoji: '🚗', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  Clothing:    { emoji: '👔', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  Space:       { emoji: '🏠', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  Equipment:   { emoji: '⛺', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
  Other:       { emoji: '📦', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function catMeta(cat: string) {
  return CAT_META[cat] ?? CAT_META['Other']
}

function ownerInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function memberSince(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })
}

export default function RentShareDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [activeImage, setActiveImage] = useState(0)

  // Request form
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [message, setMessage] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [requestSuccess, setRequestSuccess] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (!id) return
    fetch(`/api/rent-share/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        return r.json()
      })
      .then(data => {
        if (data?.listing) setListing(data.listing)
        setLoading(false)
      })
      .catch(() => { setLoading(false) })
  }, [id])

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId) { router.push(`/login?next=/rent-share/${id}`); return }
    if (!fromDate || !toDate) { setRequestError('Please select both dates.'); return }
    if (new Date(fromDate) > new Date(toDate)) { setRequestError('Start date must be before end date.'); return }
    setRequesting(true)
    setRequestError('')
    try {
      const res = await fetch(`/api/rent-share/${id}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_date: fromDate, to_date: toDate, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      setRequestSuccess(true)
    } catch (err: unknown) {
      setRequestError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setRequesting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 64 }}>
        <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (notFound || !listing) {
    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Listing not found</div>
          <div style={{ color: '#64748b', marginBottom: '1.5rem' }}>This item may no longer be available</div>
          <Link href="/rent-share" style={{ background: '#2dd4bf', color: '#0f172a', borderRadius: 8, padding: '0.6rem 1.3rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
            Browse listings
          </Link>
        </div>
      </div>
    )
  }

  const meta = catMeta(listing.category)
  const hasImages = listing.images?.length > 0
  const isOwner = currentUserId === listing.owner?.id
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Back */}
        <Link href="/rent-share" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          ← Back to listings
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start' }}>

          {/* LEFT: Details */}
          <div>
            {/* Image gallery */}
            <div style={{
              height: 320, borderRadius: 14, overflow: 'hidden', marginBottom: '1rem',
              background: hasImages ? '#0f172a' : `linear-gradient(135deg, ${meta.bg.replace('0.12', '0.3')}, ${meta.bg})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            }}>
              {hasImages ? (
                <img src={listing.images[activeImage]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 80 }}>{meta.emoji}</span>
              )}
              {/* Status */}
              <div style={{
                position: 'absolute', top: 12, right: 12,
                background: listing.status === 'active' ? 'rgba(52,211,153,0.9)' : 'rgba(248,113,113,0.9)',
                color: listing.status === 'active' ? '#0f172a' : '#fff',
                borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700,
              }}>
                {listing.status === 'active' ? 'Available' : listing.status === 'rented' ? 'Rented' : 'Inactive'}
              </div>
            </div>
            {hasImages && listing.images.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
                {listing.images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImage(i)} style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', border: `2px solid ${i === activeImage ? '#2dd4bf' : 'transparent'}`, padding: 0, cursor: 'pointer', background: 'none' }}>
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}

            {/* Title + meta */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30`, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                    {meta.emoji} {listing.category}
                  </span>
                </div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.4rem', lineHeight: 1.2 }}>{listing.title}</h1>
                {listing.location && (
                  <div style={{ color: '#64748b', fontSize: '0.9rem' }}>📍 {listing.location}</div>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {listing.price_per_day != null && listing.price_per_day > 0 && (
                <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, padding: '10px 16px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Per Day</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>€{listing.price_per_day}</div>
                </div>
              )}
              {listing.price_per_week != null && listing.price_per_week > 0 && (
                <div style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 10, padding: '10px 16px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Per Week</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2dd4bf' }}>€{listing.price_per_week}</div>
                </div>
              )}
              {(listing.price_per_day == null || listing.price_per_day === 0) && (listing.price_per_week == null || listing.price_per_week === 0) && (
                <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '10px 16px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>Free to borrow ♻️</div>
                </div>
              )}
              {listing.deposit != null && listing.deposit > 0 && (
                <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '10px 16px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Deposit</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24' }}>€{listing.deposit}</div>
                </div>
              )}
            </div>

            {/* Availability */}
            {(listing.available_from || listing.available_to) && (
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '12px 16px', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Availability</div>
                <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                  {listing.available_from && <span>From {formatDate(listing.available_from)}</span>}
                  {listing.available_from && listing.available_to && <span> — </span>}
                  {listing.available_to && <span>Until {formatDate(listing.available_to)}</span>}
                </div>
              </div>
            )}

            {/* Description */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>About this item</div>
              <p style={{ color: '#94a3b8', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{listing.description}</p>
            </div>

            {/* Listed date */}
            <div style={{ fontSize: '0.75rem', color: '#475569' }}>Listed {formatDate(listing.created_at)}</div>
          </div>

          {/* RIGHT: Owner + Request form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: 80 }}>

            {/* Owner card */}
            {listing.owner && (
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '1.25rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Listed by</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  {listing.owner.avatar_url ? (
                    <img src={listing.owner.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#0f172a', flexShrink: 0 }}>
                      {ownerInitials(listing.owner.full_name)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{listing.owner.full_name ?? 'Anonymous'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Member since {memberSince(listing.owner.created_at)}</div>
                  </div>
                </div>
                {listing.owner.bio && (
                  <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 0.75rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {listing.owner.bio}
                  </p>
                )}
                {listing.owner.location && (
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>📍 {listing.owner.location}</div>
                )}
              </div>
            )}

            {/* Request form */}
            {!isOwner && (
              <div style={{ background: '#1e293b', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 14, padding: '1.25rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.85rem' }}>Request to Rent</div>

                {requestSuccess ? (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Request sent!</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
                      {listing.owner?.full_name ?? 'The owner'} will review your request and get back to you.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>From *</label>
                      <input
                        type="date" value={fromDate} min={today}
                        onChange={e => setFromDate(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', fontFamily: 'inherit', colorScheme: 'dark' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>To *</label>
                      <input
                        type="date" value={toDate} min={fromDate || today}
                        onChange={e => setToDate(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', fontFamily: 'inherit', colorScheme: 'dark' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Message <span style={{ color: '#334155', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                      <textarea
                        value={message} onChange={e => setMessage(e.target.value)}
                        placeholder="Introduce yourself and explain your plans…"
                        rows={3}
                        style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#f1f5f9', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
                      />
                    </div>
                    {requestError && (
                      <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '8px 12px', color: '#f87171', fontSize: '0.8rem' }}>
                        {requestError}
                      </div>
                    )}
                    {listing.status !== 'active' && (
                      <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, padding: '8px 12px', color: '#fbbf24', fontSize: '0.8rem' }}>
                        This item is currently not available
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={requesting || listing.status !== 'active'}
                      style={{
                        background: listing.status !== 'active' || requesting ? '#1e293b' : 'linear-gradient(135deg,#2dd4bf,#0891b2)',
                        border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 700,
                        color: listing.status !== 'active' || requesting ? '#475569' : '#0f172a',
                        cursor: listing.status !== 'active' || requesting ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                      }}>
                      {requesting ? 'Sending…' : !currentUserId ? 'Log in to Request' : '♻️ Request to Rent'}
                    </button>
                    {!currentUserId && (
                      <div style={{ fontSize: '0.75rem', color: '#475569', textAlign: 'center' }}>
                        <Link href={`/login?next=/rent-share/${id}`} style={{ color: '#2dd4bf', textDecoration: 'none' }}>Log in</Link> or <Link href="/register" style={{ color: '#2dd4bf', textDecoration: 'none' }}>create an account</Link> to send a request
                      </div>
                    )}
                  </form>
                )}
              </div>
            )}

            {isOwner && (
              <div style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 14, padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#2dd4bf' }}>
                ✓ This is your listing
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
