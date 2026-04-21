'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewerProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  username?: string | null
}

interface Review {
  id: string
  reviewer_id: string
  reviewee_id: string
  listing_id: string | null
  rating: number
  /** alias: rating_overall for backwards compatibility */
  rating_overall?: number
  comment: string | null
  /** alias: content for backwards compat */
  content?: string | null
  created_at: string
  reviewer?: ReviewerProfile | ReviewerProfile[] | null
}

interface Props {
  /** Profile whose received reviews to show */
  profileId?: string
  /** Listing whose reviews to show */
  listingId?: string
  /** The person being reviewed — required for submitting */
  revieweeId?: string
  /** Whether the current user is allowed to leave a review */
  canReview?: boolean
  /** Called after a review is submitted */
  onReviewSubmitted?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stars({ rating, size = 14, color = '#00d4aa' }: { rating: number; size?: number; color?: string }) {
  const filled = Math.round(Math.max(0, Math.min(5, rating)))
  return (
    <span style={{ color, fontSize: size, lineHeight: 1, letterSpacing: '0.05em' }}>
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
    </span>
  )
}

function StarPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
      <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{label}</span>
      <div style={{ display: 'flex', gap: '0.1rem' }}>
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            type="button"
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(s)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.4rem', lineHeight: 1,
              color: s <= (hover || value) ? '#00d4aa' : '#2a2a3a',
              padding: '0 2px',
              transition: 'color 0.1s',
            }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

function ReviewerAvatar({ reviewer }: { reviewer: ReviewerProfile }) {
  const name = reviewer.full_name || reviewer.username || 'Member'
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  if (reviewer.avatar_url) {
    return (
      <img
        src={reviewer.avatar_url}
        alt={name}
        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  const gradients = [
    'linear-gradient(135deg,#00d4aa,#38bdf8)',
    'linear-gradient(135deg,#38bdf8,#818cf8)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#34d399,#06b6d4)',
  ]
  const grad = gradients[(name.charCodeAt(0) ?? 0) % gradients.length]
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: grad,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.65rem', fontWeight: 800, color: '#0a0a0f',
    }}>
      {initials}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReviewsSection({
  profileId, listingId, revieweeId, canReview, onReviewSubmitted,
}: Props) {
  const [reviews, setReviews]           = useState<Review[]>([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showForm, setShowForm]         = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const [hasReviewed, setHasReviewed]   = useState(false)

  // Form state
  const [rating, setRating]   = useState(5)
  const [comment, setComment] = useState('')

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (profileId) params.set('profileId', profileId)
      if (listingId)  params.set('listingId', listingId)
      const res = await fetch(`/api/reviews?${params}`)
      if (!res.ok) throw new Error('Failed to fetch reviews')
      const json = await res.json()
      const data: Review[] = json.reviews ?? []
      setReviews(data)
      setTotal(json.total ?? data.length)
    } catch {
      setReviews([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [profileId, listingId])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null)
    })
    fetchReviews()
  }, [fetchReviews])

  // Check if current user already left a review
  useEffect(() => {
    if (!currentUserId || !reviews.length) return
    setHasReviewed(reviews.some(r => r.reviewer_id === currentUserId))
  }, [currentUserId, reviews])

  const submitReview = async () => {
    if (!revieweeId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewee_id: revieweeId,
          listing_id: listingId ?? null,
          rating,
          comment: comment.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Failed to submit review')
        return
      }
      const newReview = json.review as Review
      setReviews(prev => [newReview, ...prev])
      setTotal(t => t + 1)
      setHasReviewed(true)
      setShowForm(false)
      setComment('')
      setRating(5)
      onReviewSubmitted?.()
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Derived
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + (r.rating ?? r.rating_overall ?? 0), 0) / reviews.length
    : 0

  const distribution = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(r => Math.round(r.rating ?? r.rating_overall ?? 0) === star).length
    return { star, count, pct: reviews.length ? (count / reviews.length) * 100 : 0 }
  })

  const canShowForm = canReview && currentUserId && !hasReviewed

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Summary bar */}
      {reviews.length > 0 && (
        <div style={{
          display: 'flex', gap: '1.5rem', padding: '1.25rem',
          background: '#13131a', border: '1px solid #2a2a3a',
          borderRadius: 12, marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1 }}>
              {avgRating.toFixed(1)}
            </div>
            <Stars rating={avgRating} size={16} />
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 3 }}>
              {total} review{total !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            {distribution.map(d => (
              <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', width: 10, textAlign: 'right' }}>{d.star}</span>
                <span style={{ color: '#00d4aa', fontSize: '0.72rem' }}>★</span>
                <div style={{
                  flex: 1, height: 5, background: 'rgba(42,42,58,0.9)',
                  borderRadius: 999, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${d.pct}%`, height: '100%',
                    background: 'linear-gradient(90deg,#00d4aa,#38bdf8)',
                    borderRadius: 999, transition: 'width 0.4s',
                  }} />
                </div>
                <span style={{ fontSize: '0.7rem', color: '#475569', width: 18 }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write a Review CTA */}
      {canShowForm && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: '1.25rem',
            background: 'linear-gradient(135deg,#00d4aa,#1abfa0)',
            border: 'none', borderRadius: 10,
            padding: '0.65rem 1.4rem', fontSize: '0.88rem', fontWeight: 700,
            color: '#0a0a0f', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,212,170,0.3)',
          }}
        >
          ★ Write a Review
        </button>
      )}

      {/* Guest prompt */}
      {!currentUserId && canReview !== false && (
        <div style={{
          marginBottom: '1.25rem', padding: '0.85rem 1rem',
          background: '#13131a', border: '1px solid #2a2a3a',
          borderRadius: 10, fontSize: '0.85rem', color: '#94a3b8',
        }}>
          <Link href="/login" style={{ color: '#00d4aa', fontWeight: 700, textDecoration: 'none' }}>
            Sign in
          </Link>{' '}to leave a review.
        </div>
      )}

      {/* Review form */}
      {showForm && (
        <div style={{
          background: '#13131a', border: '1px solid rgba(0,212,170,0.2)',
          borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem',
          boxShadow: '0 4px 20px rgba(0,212,170,0.08)',
        }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>
            Leave a Review
          </h3>

          <StarPicker value={rating} onChange={setRating} label="Overall Rating" />

          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Share your experience… (optional)"
            maxLength={1000}
            rows={4}
            style={{
              width: '100%', background: '#0a0a0f',
              border: '1px solid #2a2a3a', borderRadius: 8,
              padding: '0.65rem', fontSize: '0.85rem', color: '#f1f5f9',
              outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              boxSizing: 'border-box', marginTop: '0.75rem',
              lineHeight: 1.6,
            }}
          />
          <div style={{ fontSize: '0.7rem', color: '#475569', textAlign: 'right', marginBottom: '0.75rem' }}>
            {comment.length}/1000
          </div>

          {submitError && (
            <div style={{
              marginBottom: '0.75rem', padding: '0.5rem 0.75rem',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, fontSize: '0.82rem', color: '#fca5a5',
            }}>
              {submitError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={submitReview}
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg,#00d4aa,#1abfa0)',
                border: 'none', borderRadius: 8,
                padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700,
                color: '#0a0a0f', cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
            <button
              onClick={() => { setShowForm(false); setSubmitError(null) }}
              style={{
                background: 'transparent', border: '1px solid #2a2a3a',
                borderRadius: 8, padding: '0.6rem 1rem',
                fontSize: '0.82rem', color: '#64748b', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.88rem' }}>
          Loading reviews…
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⭐</div>
          <p style={{ margin: 0, fontSize: '0.88rem' }}>No reviews yet</p>
          {canShowForm && !showForm && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#475569' }}>
              Be the first to leave a review.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reviews.map(rev => {
            const reviewerRaw = rev.reviewer
            const reviewer: ReviewerProfile | null = reviewerRaw
              ? (Array.isArray(reviewerRaw) ? reviewerRaw[0] : reviewerRaw)
              : null
            const revRating = rev.rating ?? rev.rating_overall ?? 0
            const revComment = rev.comment ?? rev.content ?? null
            const revDate = new Date(rev.created_at).toLocaleDateString('en-IE', {
              day: 'numeric', month: 'short', year: 'numeric',
            })

            return (
              <div
                key={rev.id}
                style={{
                  background: '#13131a', border: '1px solid #2a2a3a',
                  borderRadius: 12, padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  {reviewer && <ReviewerAvatar reviewer={reviewer} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem',
                    }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9' }}>
                        {reviewer?.full_name || reviewer?.username || 'FreeTrust Member'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Stars rating={revRating} size={12} />
                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>{revDate}</span>
                      </div>
                    </div>
                    {revComment && (
                      <p style={{
                        color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.6,
                        margin: '0.45rem 0 0', whiteSpace: 'pre-wrap',
                      }}>
                        {revComment}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
