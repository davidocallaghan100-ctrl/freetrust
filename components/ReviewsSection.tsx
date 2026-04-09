'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Review {
  id: string
  rating_overall: number
  rating_quality?: number
  rating_communication?: number
  rating_delivery?: number
  content?: string
  reply?: string
  reply_at?: string
  created_at: string
  reviewer_role: string
  reviewer: { id: string; full_name: string; avatar_url?: string }
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span style={{ color: '#fbbf24', fontSize: size }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  )
}

function getGrad(str: string) {
  const grads = ['linear-gradient(135deg,#38bdf8,#0284c7)', 'linear-gradient(135deg,#a78bfa,#7c3aed)', 'linear-gradient(135deg,#34d399,#059669)', 'linear-gradient(135deg,#fb923c,#ea580c)']
  return grads[(str.charCodeAt(0) ?? 0) % grads.length]
}

interface Props {
  profileId?: string
  listingId?: string
  orderId?: string
  canReview?: boolean
  revieweeId?: string
  reviewerRole?: 'buyer' | 'seller'
  onReviewSubmitted?: () => void
}

export default function ReviewsSection({ profileId, listingId, orderId, canReview, revieweeId, reviewerRole, onReviewSubmitted }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')

  // Form state
  const [ratingOverall, setRatingOverall] = useState(5)
  const [ratingQuality, setRatingQuality] = useState(5)
  const [ratingComm, setRatingComm] = useState(5)
  const [ratingDelivery, setRatingDelivery] = useState(5)
  const [content, setContent] = useState('')

  const isSeller = reviewerRole === 'buyer' // buyer rates seller
  const isBuyer = reviewerRole === 'seller' // seller rates buyer

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      try {
        const params = new URLSearchParams()
        if (profileId) params.set('profileId', profileId)
        if (listingId) params.set('listingId', listingId)
        const res = await fetch(`/api/reviews?${params}`)
        const json = await res.json()
        setReviews(json.reviews ?? [])
        setTotal(json.total ?? 0)
      } catch {}
      setLoading(false)
    }
    load()
  }, [profileId, listingId])

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating_overall, 0) / reviews.length) : 0
  const distribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating_overall === star).length,
    pct: reviews.length ? (reviews.filter(r => r.rating_overall === star).length / reviews.length) * 100 : 0,
  }))

  const submitReview = async () => {
    if (!revieweeId || !reviewerRole) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId ?? null,
          reviewee_id: revieweeId,
          listing_id: listingId ?? null,
          reviewer_role: reviewerRole,
          rating_overall: ratingOverall,
          ...(isSeller ? { rating_quality: ratingQuality, rating_communication: ratingComm, rating_delivery: ratingDelivery } : {}),
          ...(isBuyer ? { rating_clarity: ratingQuality, rating_payment: ratingComm, rating_professionalism: ratingDelivery } : {}),
          content: content.trim(),
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setReviews(prev => [json.review, ...prev])
        setTotal(t => t + 1)
        setShowForm(false)
        onReviewSubmitted?.()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submitReply = async (reviewId: string) => {
    if (!replyText.trim()) return
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reply', reply: replyText }),
    })
    if (res.ok) {
      const json = await res.json()
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reply: json.review.reply, reply_at: json.review.reply_at } : r))
      setReplyingTo(null)
      setReplyText('')
    }
  }

  const submitReport = async (reviewId: string) => {
    if (!reportReason.trim()) return
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'report', report_reason: reportReason }),
    })
    if (res.ok) {
      setReportingId(null)
      setReportReason('')
    }
  }

  function StarPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <span style={{ fontSize: '0.82rem', color: '#94a3b8', width: 140 }}>{label}</span>
        <div style={{ display: 'flex', gap: '0.15rem' }}>
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} onClick={() => onChange(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: s <= value ? '#fbbf24' : '#334155', padding: '0 2px', lineHeight: 1 }}>
              ★
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Summary bar */}
      {reviews.length > 0 && (
        <div style={{ display: 'flex', gap: '2rem', padding: '1.25rem', background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f1f5f9' }}>{avgRating.toFixed(1)}</div>
            <Stars rating={avgRating} size={16} />
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{total} review{total !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            {distribution.map(d => (
              <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', width: 16 }}>{d.star}</span>
                <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>★</span>
                <div style={{ flex: 1, height: 6, background: 'rgba(148,163,184,0.12)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${d.pct}%`, height: '100%', background: '#fbbf24', borderRadius: 999, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#475569', width: 20 }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write review button */}
      {canReview && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 10, padding: '0.65rem 1.4rem', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}
        >
          ★ Write a Review
        </button>
      )}

      {/* Review form */}
      {showForm && (
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>Leave a Review</h3>
          <StarPicker value={ratingOverall} onChange={setRatingOverall} label="Overall Rating" />
          {isSeller && (
            <>
              <StarPicker value={ratingQuality} onChange={setRatingQuality} label="Quality of Work" />
              <StarPicker value={ratingComm} onChange={setRatingComm} label="Communication" />
              <StarPicker value={ratingDelivery} onChange={setRatingDelivery} label="Delivery Time" />
            </>
          )}
          {isBuyer && (
            <>
              <StarPicker value={ratingQuality} onChange={setRatingQuality} label="Clarity of Brief" />
              <StarPicker value={ratingComm} onChange={setRatingComm} label="Payment" />
              <StarPicker value={ratingDelivery} onChange={setRatingDelivery} label="Professionalism" />
            </>
          )}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Share your experience… (optional, max 1000 characters)"
            maxLength={1000}
            rows={4}
            style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.65rem', fontSize: '0.85rem', color: '#f1f5f9', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: '0.75rem' }}
          />
          <div style={{ fontSize: '0.72rem', color: '#475569', textAlign: 'right', marginBottom: '0.75rem' }}>{content.length}/1000</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={submitReview} disabled={submitting} style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 8, padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.82rem', color: '#64748b', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0.5rem 0 0' }}>You'll earn ₮10 Trust for leaving a review</p>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.88rem' }}>Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⭐</div>
          <p style={{ margin: 0, fontSize: '0.88rem' }}>No reviews yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reviews.map(r => (
            <div key={r.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.07)', borderRadius: 12, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.6rem' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: r.reviewer.avatar_url ? `url(${r.reviewer.avatar_url}) center/cover` : getGrad(r.reviewer.full_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                  {!r.reviewer.avatar_url && r.reviewer.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9' }}>{r.reviewer.full_name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Stars rating={r.rating_overall} />
                      <span style={{ fontSize: '0.72rem', color: '#475569' }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  {/* Sub-ratings */}
                  {(r.rating_quality || r.rating_communication || r.rating_delivery) && (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                      {r.rating_quality && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Quality: {r.rating_quality}★</span>}
                      {r.rating_communication && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Comms: {r.rating_communication}★</span>}
                      {r.rating_delivery && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Delivery: {r.rating_delivery}★</span>}
                    </div>
                  )}
                </div>
              </div>

              {r.content && <p style={{ color: '#cbd5e1', fontSize: '0.87rem', lineHeight: 1.6, margin: '0 0 0.6rem' }}>{r.content}</p>}

              {/* Reply */}
              {r.reply && (
                <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 8, padding: '0.65rem 0.85rem', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, marginBottom: '0.25rem' }}>Response from seller</div>
                  <p style={{ color: '#94a3b8', fontSize: '0.83rem', margin: 0, lineHeight: 1.6 }}>{r.reply}</p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                {/* Reply (only reviewee can reply) */}
                {!r.reply && currentUserId === profileId && replyingTo !== r.id && (
                  <button onClick={() => setReplyingTo(r.id)} style={{ background: 'transparent', border: 'none', fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer', padding: 0 }}>
                    Reply
                  </button>
                )}
                {/* Report */}
                {currentUserId && currentUserId !== r.reviewer.id && reportingId !== r.id && (
                  <button onClick={() => setReportingId(r.id)} style={{ background: 'transparent', border: 'none', fontSize: '0.72rem', color: '#64748b', cursor: 'pointer', padding: 0 }}>
                    Report
                  </button>
                )}
              </div>

              {/* Reply input */}
              {replyingTo === r.id && (
                <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem' }}>
                  <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Write a reply…"
                    maxLength={500}
                    style={{ flex: 1, background: '#0f172a', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 7, padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: '#f1f5f9', outline: 'none' }}
                  />
                  <button onClick={() => submitReply(r.id)} style={{ background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.5rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Send</button>
                  <button onClick={() => setReplyingTo(null)} style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 7, padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#64748b', cursor: 'pointer' }}>Cancel</button>
                </div>
              )}

              {/* Report input */}
              {reportingId === r.id && (
                <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem' }}>
                  <input
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    placeholder="Reason for report…"
                    style={{ flex: 1, background: '#0f172a', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: '#f1f5f9', outline: 'none' }}
                  />
                  <button onClick={() => submitReport(r.id)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: '0.5rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, color: '#fca5a5', cursor: 'pointer' }}>Report</button>
                  <button onClick={() => setReportingId(null)} style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 7, padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#64748b', cursor: 'pointer' }}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
