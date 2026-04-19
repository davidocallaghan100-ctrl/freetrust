'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ALL_CATEGORIES } from '@/lib/service-categories'
import ListingQualityBadge from '@/components/marketplace/ListingQualityBadge'
import { useCurrency, type CurrencyCode } from '@/context/CurrencyContext'
import { formatDistanceToNow } from 'date-fns'

// ─── Message Seller Hook ──────────────────────────────────────────────────────

function useMessageSeller() {
  const router = useRouter()
  const [msgLoading, setMsgLoading] = useState(false)

  const messageSeller = async (sellerId: string, listingTitle: string) => {
    setMsgLoading(true)
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/login'); return }
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: sellerId, content: `Hi, I'm interested in your listing: ${listingTitle}` }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(data.conversation_id ? `/messages/${data.conversation_id}` : '/messages')
      }
    } catch {
      alert('Could not send message. Please try again.')
    } finally {
      setMsgLoading(false)
    }
  }

  return { messageSeller, msgLoading }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceListing = {
  id: string
  title: string
  description: string
  price: number
  currency: string
  service_mode: 'online' | 'offline' | 'both' | null
  tags: string[] | null
  location: string | null
  images: string[] | null
  category_id: string | null
  delivery_types: string[] | null
  quality_score: number | null
  avg_rating: number | null
  review_count: number | null
  seller: {
    id: string
    full_name: string | null
    avatar_url: string | null
    bio: string | null
    location: string | null
  }
}

type VerifiedReview = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  verified_buyer: boolean
  reviewer: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ color: n <= Math.round(rating) ? '#fbbf24' : '#334155', fontSize: size + 'px' }}>★</span>
      ))}
    </span>
  )
}

function Avatar({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.33) + 'px', color: '#0f172a', flexShrink: 0 }}>{initials}</div>
}

// ─── Book CTA Card (desktop sidebar + mobile) ─────────────────────────────────

function BookCard({ svc, mobile = false }: { svc: ServiceListing; mobile?: boolean }) {
  const { format } = useCurrency()
  const currency = (svc.currency || 'GBP') as CurrencyCode

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '20px' }}>
        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontSize: '36px', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-1px' }}>
            {format(svc.price, currency)}
          </span>
          <span style={{ fontSize: '13px', color: '#64748b' }}>/ project</span>
        </div>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 18px', lineHeight: 1.5 }}>
          One clear price. No surprises.
        </p>

        {/* CTA */}
        <Link
          href={`/checkout?service=${svc.id}`}
          style={{ display: 'block', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', borderRadius: '12px', padding: '15px', textAlign: 'center', fontWeight: 800, fontSize: '16px', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.25)', marginBottom: '10px' }}
        >
          Book Now — {format(svc.price, currency)}
        </Link>

        {/* AI Agent link */}
        <Link
          href="/ai"
          style={{ display: 'block', padding: '12px', textAlign: 'center', border: '1px solid #334155', borderRadius: '12px', fontSize: '13px', fontWeight: 600, color: '#94a3b8', textDecoration: 'none' }}
        >
          🤖 Ask AI Agent
        </Link>
      </div>
    </div>
  )
}

// ─── Mobile sticky bottom bar ─────────────────────────────────────────────────

function MobileStickyBar({ svc }: { svc: ServiceListing }) {
  const { format } = useCurrency()
  const currency = (svc.currency || 'GBP') as CurrencyCode

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 48, background: '#0f172a', borderTop: '1px solid #1e293b', padding: '10px 16px 20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
      {/* Price pill */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '8px 12px', minWidth: 90 }}>
        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Price</span>
        <span style={{ fontSize: '16px', fontWeight: 900, color: '#f1f5f9' }}>{format(svc.price, currency)}</span>
      </div>

      {/* CTA */}
      <Link
        href={`/checkout?service=${svc.id}`}
        style={{ flex: 1, display: 'block', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', borderRadius: '12px', padding: '14px', textAlign: 'center', fontWeight: 800, fontSize: '15px', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.25)' }}
      >
        Book Now — {format(svc.price, currency)}
      </Link>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  const pulse: React.CSSProperties = { background: 'linear-gradient(90deg,#1e293b 25%,#273548 50%,#1e293b 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', borderRadius: '8px' }
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', paddingTop: 64 }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px' }}>
        <div style={{ ...pulse, height: 12, width: 200, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...pulse, height: 28, width: '80%' }} />
            <div style={{ ...pulse, height: 16, width: '40%' }} />
            <div style={{ ...pulse, height: 280, borderRadius: 14 }} />
            <div style={{ ...pulse, height: 120, borderRadius: 14 }} />
          </div>
          <div style={{ ...pulse, height: 300, borderRadius: 16 }} />
        </div>
      </div>
    </div>
  )
}

// ─── Not Found ────────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', paddingTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '104px 24px 0' }}>
      <div style={{ fontSize: 64 }}>🔍</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Service Not Found</h1>
      <p style={{ color: '#64748b', margin: 0 }}>This listing doesn't exist or has been removed.</p>
      <Link href="/services" style={{ background: '#38bdf8', color: '#0f172a', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>
        ← Browse Services
      </Link>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const { messageSeller, msgLoading } = useMessageSeller()

  const [svc, setSvc] = useState<ServiceListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [reviews, setReviews] = useState<VerifiedReview[]>([])
  const [reviewsAvg, setReviewsAvg] = useState(0)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const sb = createClient();
    (async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') setIsAdmin(true)
    })()
  }, [])

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/listings/${id}`, { method: 'DELETE' })
      if (res.ok) router.push('/services')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }

    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('listings')
          .select(`
            id, title, description, price, currency,
            service_mode, tags, location,
            images, category_id, delivery_types,
            quality_score, avg_rating, review_count,
            seller:profiles!seller_id (
              id, full_name, avatar_url, bio, location
            )
          `)
          .eq('id', id)
          .eq('product_type', 'service')
          .eq('status', 'active')
          .single()

        if (error || !data) {
          setNotFound(true)
        } else {
          const raw = data as Record<string, unknown>
          const sellerRaw = raw.seller as Record<string, unknown> | null
          setSvc({
            id: raw.id as string,
            title: raw.title as string,
            description: raw.description as string,
            price: raw.price as number,
            currency: (raw.currency as string) || 'GBP',
            service_mode: raw.service_mode as ServiceListing['service_mode'],
            tags: raw.tags as string[] | null,
            location: raw.location as string | null,
            images: raw.images as string[] | null,
            category_id: raw.category_id as string | null,
            delivery_types: raw.delivery_types as string[] | null,
            quality_score: (raw.quality_score as number | null) ?? null,
            avg_rating: (raw.avg_rating as number | null) ?? null,
            review_count: (raw.review_count as number | null) ?? null,
            seller: {
              id: (sellerRaw?.id as string) || '',
              full_name: (sellerRaw?.full_name as string | null) || 'FreeTrust Member',
              avatar_url: (sellerRaw?.avatar_url as string | null) || null,
              bio: (sellerRaw?.bio as string | null) || null,
              location: (sellerRaw?.location as string | null) || null,
            },
          })
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    const loadReviews = async () => {
      try {
        const res = await fetch(`/api/listings/${id}/reviews`)
        if (res.ok) {
          const json = await res.json()
          setReviews(json.reviews ?? [])
          setReviewsAvg(json.avgRating ?? 0)
        }
      } catch { /* ignore */ } finally {
        setReviewsLoading(false)
      }
    }

    load()
    loadReviews()
  }, [id])

  if (loading) return <LoadingSkeleton />
  if (notFound || !svc) return <NotFound />

  const catInfo = ALL_CATEGORIES.find(c => c.id === svc.category_id)
  const rating = reviewsAvg
  const reviewCount = reviews.length
  const images = svc.images ?? []
  const tags = svc.tags ?? []
  const mode = svc.service_mode

  const card: React.CSSProperties = { background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }

  const isOwner = svc ? (isAdmin || currentUserId === svc.seller.id) : false

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', paddingTop: 64 }}>
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: 14, padding: '1.5rem', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>Delete service?</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
              &ldquo;{svc?.title}&rdquo; will be permanently deleted and cannot be recovered.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting}
                style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: deleting ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700 }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .sd-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }
        .sd-right { position: sticky; top: 112px; }
        @media (max-width: 768px) {
          .sd-grid { grid-template-columns: 1fr; }
          .sd-right { position: static; display: none !important; }
          .sd-mobile-pkg { display: block !important; }
          .sd-mobile-bar { display: flex !important; }
          .sd-main { padding-bottom: 100px !important; }
        }
        @media (min-width: 769px) {
          .sd-mobile-pkg { display: none !important; }
          .sd-mobile-bar { display: none !important; }
        }
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
      `}</style>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px 16px 80px' }} className="sd-main">

        {/* Breadcrumb */}
        <nav style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, fontSize: '12px', fontFamily: 'inherit' }}>← Back</button>
          <span>·</span>
          <Link href="/services" style={{ color: '#64748b', textDecoration: 'none' }}>Services</Link>
          {catInfo && <><span>›</span><span style={{ color: '#94a3b8' }}>{catInfo.icon} {catInfo.label}</span></>}
          {isOwner && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              <Link href={`/products/${id}/edit`} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', color: '#8b5cf6', padding: '4px 12px', borderRadius: 999, fontSize: '12px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                ✏️ Edit
              </Link>
              <button onClick={() => setShowDeleteModal(true)}
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '4px 12px', borderRadius: 999, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                🗑 Delete
              </button>
            </div>
          )}
        </nav>

        {/* Mobile: book card at top */}
        <div className="sd-mobile-pkg" style={{ marginBottom: '20px' }}>
          <BookCard svc={svc} mobile />
        </div>

        <div className="sd-grid">

          {/* ── Left / main column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Title + rating */}
            <div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {catInfo && (
                  <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '3px 10px', borderRadius: '20px' }}>
                    {catInfo.icon} {catInfo.label}
                  </span>
                )}
                {mode && (
                  <span style={{ fontSize: '11px', fontWeight: 700, background: mode === 'online' ? 'rgba(56,189,248,0.08)' : 'rgba(52,211,153,0.08)', color: mode === 'online' ? '#38bdf8' : '#34d399', padding: '3px 10px', borderRadius: '20px' }}>
                    {mode === 'online' ? '💻 Online' : mode === 'offline' ? '📍 Local' : '🌐 Online & Local'}
                  </span>
                )}
                {svc.location && (
                  <span style={{ fontSize: '11px', color: '#64748b', padding: '3px 10px', borderRadius: '20px', background: '#1e293b' }}>
                    📍 {svc.location}
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 'clamp(17px,4vw,22px)', fontWeight: 800, lineHeight: 1.3, margin: '0 0 10px' }}>{svc.title}</h1>
              {!reviewsLoading && rating > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13px', color: '#94a3b8' }}>
                  <Stars rating={rating} />
                  <strong style={{ color: '#fbbf24' }}>{rating.toFixed(1)}</strong>
                  <span>({reviewCount} verified review{reviewCount !== 1 ? 's' : ''})</span>
                  <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700, background: 'rgba(56,189,248,0.08)', padding: '2px 6px', borderRadius: 999 }}>✓ Buyer Reviews Only</span>
                  <ListingQualityBadge
                    qualityScore={svc.quality_score}
                    avgRating={svc.avg_rating}
                    reviewCount={svc.review_count}
                    compact
                  />
                </div>
              ) : !reviewsLoading ? (
                <div style={{ fontSize: '13px', color: '#475569' }}>No verified reviews yet — be the first!</div>
              ) : null}
            </div>

            {/* Seller mini row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px' }}>
              <Avatar url={svc.seller.avatar_url} name={svc.seller.full_name || 'Seller'} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <Link href={`/profile?id=${svc.seller.id}`} style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none' }}>
                    {svc.seller.full_name || 'FreeTrust Member'}
                  </Link>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 7px', borderRadius: 999 }}>Verified Seller</span>
                </div>
                {svc.seller.location && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    📍 {svc.seller.location}
                  </div>
                )}
              </div>
              <Link href="/ai" style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', padding: '7px 12px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                🤖 AI Agent
              </Link>
            </div>

            {/* Cover image */}
            {images[0] ? (
              <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid #334155', background: '#1e293b' }}>
                <img src={images[0]} alt={svc.title} style={{ width: '100%', maxHeight: '340px', objectFit: 'cover', display: 'block' }} />
              </div>
            ) : (
              <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid #334155', background: 'linear-gradient(135deg,#1e293b,#0f172a)', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '48px', opacity: 0.4 }}>🎯</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>No preview image yet</div>
              </div>
            )}

            {/* Description */}
            <div style={card}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '10px' }}>About This Service</div>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.75, whiteSpace: 'pre-wrap', margin: 0 }}>{svc.description}</p>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {tags.map(t => (
                  <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid #334155', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>
                    #{t}
                  </Link>
                ))}
              </div>
            )}

            {/* Seller full card */}
            <div style={card}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '14px' }}>About the Seller</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                <Avatar url={svc.seller.avatar_url} name={svc.seller.full_name || 'Seller'} size={52} />
                <div>
                  <Link href={`/profile?id=${svc.seller.id}`} style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none', display: 'block' }}>
                    {svc.seller.full_name || 'FreeTrust Member'}
                  </Link>
                  <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>Verified Seller</div>
                  {svc.seller.location && <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {svc.seller.location}</div>}
                </div>
              </div>
              {svc.seller.bio && (
                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.65, margin: '0 0 14px' }}>{svc.seller.bio}</p>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link href={`/profile?id=${svc.seller.id}`} style={{ flex: 1, display: 'block', padding: '9px', textAlign: 'center', border: '1px solid #334155', borderRadius: '10px', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textDecoration: 'none' }}>
                  View Profile
                </Link>
                {currentUserId !== svc.seller.id && (
                  <button
                    onClick={() => messageSeller(svc.seller.id, svc.title)}
                    disabled={msgLoading}
                    style={{ flex: 1, padding: '9px', textAlign: 'center', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,0.07)', cursor: 'pointer', fontFamily: 'inherit', opacity: msgLoading ? 0.6 : 1 }}
                  >
                    {msgLoading ? '...' : '💬 Message'}
                  </button>
                )}
              </div>
            </div>

            {/* Verified Reviews Section */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                  Reviews {reviewCount > 0 ? `(${reviewCount})` : ''}
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', padding: '2px 8px', borderRadius: 999 }}>
                  ✓ Verified Buyers Only
                </span>
              </div>

              {reviewsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: '#0f172a', borderRadius: '10px', padding: '12px', display: 'flex', gap: '10px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(90deg,#1e293b 25%,#273548 50%,#1e293b 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 12, width: '40%', background: 'linear-gradient(90deg,#1e293b 25%,#273548 50%,#1e293b 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', borderRadius: 4, marginBottom: 8 }} />
                        <div style={{ height: 10, background: 'linear-gradient(90deg,#1e293b 25%,#273548 50%,#1e293b 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#475569', fontSize: '13px' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>💬</div>
                  <div style={{ fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>No reviews yet</div>
                  <div>Reviews appear here after verified buyers complete their purchase.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {reviews.map(rev => (
                    <div key={rev.id} style={{ background: '#0f172a', borderRadius: '10px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <a href={`/profile?id=${rev.reviewer.id}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                      {rev.reviewer.avatar_url
                        ? <img src={rev.reviewer.avatar_url} alt={rev.reviewer.full_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: '#0f172a', flexShrink: 0 }}>
                            {rev.reviewer.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                          </div>
                      }
                      </a>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#f1f5f9' }}>{rev.reviewer.full_name}</span>
                            <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 600 }}>✓ Verified Buyer</span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#475569' }}>
                            {formatDistanceToNow(new Date(rev.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <Stars rating={rev.rating} size={12} />
                        {rev.comment && (
                          <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6, margin: '6px 0 0' }}>{rev.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trust guarantee */}
            <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '14px', fontSize: '12px', color: '#64748b', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>🛡️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '3px', fontSize: '13px' }}>FreeTrust Guarantee</div>
                Your payment is held securely in escrow and only released when you confirm delivery. If something goes wrong, we step in and make it right.
              </div>
            </div>

          </div>

          {/* ── Right column (desktop only) ── */}
          <div className="sd-right" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <BookCard svc={svc} />

            {/* Trust badge desktop */}
            <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '14px', fontSize: '12px', color: '#64748b', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>🛡️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '2px' }}>FreeTrust Guarantee</div>
                Payment held securely. Released only on confirmed delivery.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="sd-mobile-bar" style={{ display: 'none' }}>
        <MobileStickyBar svc={svc} />
      </div>
    </div>
  )
}
