'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCurrency } from '@/context/CurrencyContext'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import ListingQualityBadge from '@/components/marketplace/ListingQualityBadge'
import ReviewsSection from '@/components/ReviewsSection'

const AppleGooglePayButton = dynamic(() => import('@/components/payments/AppleGooglePayButton'), { ssr: false })

// ─── Supabase client ──────────────────────────────────────────────────────────

const supabase = createAnonClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────

type Seller = {
  id: string
  full_name: string | null
  avatar_url: string | null
  username: string | null
  avg_rating: number
  review_count: number
  trust_balance: number
}

type Review = {
  id: string
  reviewer_id: string
  rating: number
  title: string | null
  content: string | null
  created_at: string
  reviewer?: {
    full_name: string | null
    avatar_url: string | null
  }
}

type Listing = {
  id: string
  seller_id: string
  title: string
  description: string | null
  price: number
  currency: string
  status: string
  images: string[]
  cover_image: string | null
  tags: string[]
  product_type: 'physical' | 'digital' | 'service'
  condition: string | null
  stock_qty: number
  avg_rating: number
  review_count: number
  quality_score: number | null
  created_at: string
  shipping_options: string | null
  service_mode: string | null
  seller?: Seller
  reviews?: Review[]
}

// ─── Cart helpers (localStorage) ─────────────────────────────────────────────

type CartItem = { id: string; title: string; price: number; currency: string; qty: number; image: string }

function getCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem('ft_cart') || '[]') } catch { return [] }
}
function saveCart(c: CartItem[]) {
  localStorage.setItem('ft_cart', JSON.stringify(c))
  window.dispatchEvent(new Event('ft-cart-updated'))
}
function addToCart(item: CartItem) {
  const cart = getCart()
  const idx = cart.findIndex(c => c.id === item.id)
  if (idx >= 0) cart[idx].qty += item.qty
  else cart.push(item)
  saveCart(cart)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Price is already a float (e.g. 34.99) — NOT in pence
function fmt(p: number, cur: string, formatFn?: (amount: number, from: 'EUR' | 'GBP' | 'USD') => string) {
  if (formatFn && (cur === 'EUR' || cur === 'GBP' || cur === 'USD')) {
    return formatFn(p, cur as 'EUR' | 'GBP' | 'USD')
  }
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur || 'EUR', minimumFractionDigits: 2 }).format(p)
}

function Stars({ rating, size = '0.85rem' }: { rating: number; size?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= Math.round(rating) ? '#fbbf24' : '#334155', fontSize: size }}>★</span>
      ))}
    </span>
  )
}

function sellerDisplayName(seller: Seller) {
  return seller.full_name?.trim() || seller.username?.trim() || 'Anonymous'
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { format: formatCurrency } = useCurrency()
  const id = typeof params.id === 'string' ? params.id : ''

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [imgIdx, setImgIdx] = useState(0)
  const [qty, setQty] = useState(1)
  const [wishlist, setWishlist] = useState(false)
  const [tab, setTab] = useState<'description' | 'reviews'>('description')
  const [cartAdded, setCartAdded] = useState(false)
  const [buyLoading, setBuyLoading] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [payError, setPayError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
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

  // Load cart count
  useEffect(() => {
    const update = () => setCartCount(getCart().reduce((s, c) => s + c.qty, 0))
    update()
    window.addEventListener('ft-cart-updated', update)
    return () => window.removeEventListener('ft-cart-updated', update)
  }, [])

  // Get current user for edit/delete permissions
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
      if (res.ok) router.push('/products')
    } finally {
      setDeleting(false)
    }
  }

  // Fetch listing from Supabase
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)

    async function fetchListing() {
      // Fetch listing
      const { data: lst, error: lstErr } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single()

      if (lstErr || !lst) {
        setNotFound(true)
        setLoading(false)
        return
      }

      // Fetch seller profile
      const { data: seller } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username, avg_rating, review_count, trust_balance')
        .eq('id', lst.seller_id)
        .single()

      // Fetch reviews (up to 20)
      const { data: reviews } = await supabase
        .from('reviews')
        .select(`
          id, reviewer_id, rating, title, content, created_at,
          reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url)
        `)
        .eq('listing_id', id)
        .order('created_at', { ascending: false })
        .limit(20)

      setListing({
        ...lst,
        images: Array.isArray(lst.images) ? lst.images : (lst.cover_image ? [lst.cover_image] : []),
        tags: Array.isArray(lst.tags) ? lst.tags : [],
        seller: seller || undefined,
        reviews: reviews || [],
      })
      setLoading(false)
    }

    fetchListing()
  }, [id])

  // Reset image index when listing changes
  useEffect(() => { setImgIdx(0) }, [listing?.id])

  // ─── Theme ─────────────────────────────────────────────────────────────────
  const bg = '#030712'
  const card = '#111827'
  const border = 'rgba(139,92,246,0.15)'
  const accent = '#8b5cf6'
  const accentSky = '#38bdf8'
  const text = '#f1f5f9'
  const muted = '#64748b'
  const subtle = '#1f2937'

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: bg, color: text, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 104 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: muted, fontSize: '0.9rem' }}>Loading product…</p>
        </div>
      </main>
    )
  }

  // ─── Not found ──────────────────────────────────────────────────────────────
  if (notFound || !listing) {
    return (
      <main style={{ minHeight: '100vh', background: bg, color: text, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 104 }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem' }}>Product not found</h2>
          <p style={{ color: muted, marginBottom: '1.5rem' }}>This listing may have been removed or the link is incorrect.</p>
          <Link href="/products" style={{ background: accent, color: '#fff', padding: '0.75rem 1.5rem', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
            Browse products
          </Link>
        </div>
      </main>
    )
  }

  // ─── Derived values ─────────────────────────────────────────────────────────
  const images = listing.images.length > 0 ? listing.images : ['https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80']
  const safeImgIdx = Math.min(imgIdx, images.length - 1)
  const trustFee = 5 // platform fee %
  const subtotal = listing.price * qty
  const fee = Math.round(subtotal * (trustFee / 100) * 100) / 100
  const total = subtotal + fee
  const isService = listing.product_type === 'service'
  const isDigital = listing.product_type === 'digital'
  const isPhysical = listing.product_type === 'physical'
  const conditionLabel = listing.condition ? listing.condition.charAt(0).toUpperCase() + listing.condition.slice(1) : 'New'
  const stockWarning = isPhysical && listing.stock_qty > 0 && listing.stock_qty <= 5
  const outOfStock = isPhysical && listing.stock_qty === 0
  const reviews = listing.reviews || []
  const reviewCount = listing.review_count || 0
  const avgRating = reviewCount > 0 ? (listing.avg_rating || 5) : 5

  function handleAddToCart() {
    if (outOfStock) return
    addToCart({
      id: listing!.id,
      title: listing!.title,
      price: listing!.price,
      currency: listing!.currency,
      qty,
      image: images[0],
    })
    setCartAdded(true)
    setTimeout(() => setCartAdded(false), 2500)
  }

  function handleBuyNow() {
    if (outOfStock) return
    setBuyLoading(true)
    addToCart({
      id: listing!.id,
      title: listing!.title,
      price: listing!.price,
      currency: listing!.currency,
      qty,
      image: images[0],
    })
    router.push('/cart')
  }

  const isOwner = isAdmin || currentUserId === listing?.seller_id

  return (
    <main className="ft-page-content" style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, sans-serif', paddingBottom: 80 }}>
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: 14, padding: '1.5rem', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>Delete product?</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
              &ldquo;{listing?.title}&rdquo; will be permanently deleted and cannot be recovered.
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
        @media (max-width: 1024px) { .pd-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 768px) {
          .pd-ctas { flex-direction: column !important; }
          .pd-ship { grid-template-columns: 1fr !important; }
          .pd-img-wrap { aspect-ratio: 4/3 !important; max-height: 300px !important; }
          .pd-thumbs { gap: 6px !important; }
          .pd-thumb { width: 52px !important; height: 52px !important; }
          .pd-sticky { position: static !important; }
          .pd-grid { gap: 1rem !important; }
          .pd-main { padding: 0 0.75rem !important; }
          .pd-breadcrumb { padding: 0 0.75rem !important; margin-bottom: 0.6rem !important; }
          .ft-page-content { padding-top: 68px !important; }
          .pd-reviews-grid { grid-template-columns: 1fr !important; }
        }
        .pd-thumb:hover { border-color: ${accent} !important; }
        .pd-tab:hover { color: #94a3b8 !important; }
        .pd-tag:hover { background: rgba(139,92,246,0.12) !important; color: ${accent} !important; }
        .pd-btn-pri:hover { filter: brightness(1.1); }
        .pd-btn-sec:hover { background: rgba(139,92,246,0.08) !important; border-color: ${accent} !important; }
        .pd-img-nav { opacity: 0; transition: opacity 0.15s; }
        .pd-img-wrap:hover .pd-img-nav { opacity: 1; }
        @media (max-width: 768px) { .pd-img-nav { opacity: 1 !important; } }
        .pd-seller-msg:hover { background: rgba(139,92,246,0.15) !important; }
      `}</style>

      {/* ── Breadcrumb ── */}
      <div className="pd-breadcrumb" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: muted, flexWrap: 'wrap' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', padding: 0, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Back
          </button>
          <span style={{ color: subtle }}>/</span>
          <Link href="/products" style={{ color: muted, textDecoration: 'none' }}>Products</Link>
          <span style={{ color: subtle }}>/</span>
          <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{listing.title}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {isOwner && (
              <>
                <Link href={`/products/${id}/edit`} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', color: '#8b5cf6', padding: '0.3rem 0.85rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ✏️ Edit
                </Link>
                <button onClick={() => setShowDeleteModal(true)}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '0.3rem 0.85rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                  🗑 Delete
                </button>
              </>
            )}
            {cartCount > 0 && (
              <Link href="/cart" style={{ background: accent, color: '#fff', padding: '0.3rem 0.85rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                🛒 Cart ({cartCount})
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="pd-main" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem' }}>
        <div className="pd-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'start' }}>

          {/* ── Left: Gallery ── */}
          <div className="pd-sticky" style={{ position: 'sticky', top: 112 }}>
            <div className="pd-img-wrap" style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: `1px solid ${border}`, background: card, aspectRatio: '4/3' }}>
              <img
                src={images[safeImgIdx]}
                alt={listing.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {/* Type badge */}
              <span style={{ position: 'absolute', top: 14, right: 14, background: isDigital ? 'rgba(139,92,246,0.9)' : isService ? 'rgba(52,211,153,0.9)' : 'rgba(56,189,248,0.9)', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>
                {isDigital ? 'DIGITAL' : isService ? 'SERVICE' : 'PHYSICAL'}
              </span>
              {/* Out of stock overlay */}
              {outOfStock && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,7,18,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ background: '#e11d48', color: '#fff', fontWeight: 800, padding: '0.5rem 1.25rem', borderRadius: 999, fontSize: '0.85rem' }}>Out of Stock</span>
                </div>
              )}
              {/* Prev/Next arrows */}
              {images.length > 1 && (
                <>
                  <button className="pd-img-nav" onClick={() => setImgIdx(i => i === 0 ? images.length - 1 : i - 1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(3,7,18,0.75)', border: `1px solid ${border}`, borderRadius: '50%', width: 36, height: 36, color: text, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                  <button className="pd-img-nav" onClick={() => setImgIdx(i => i === images.length - 1 ? 0 : i + 1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(3,7,18,0.75)', border: `1px solid ${border}`, borderRadius: '50%', width: 36, height: 36, color: text, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                </>
              )}
              {/* Dots */}
              {images.length > 1 && (
                <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setImgIdx(i)} style={{ width: i === safeImgIdx ? 20 : 8, height: 8, borderRadius: 99, background: i === safeImgIdx ? accent : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }} />
                  ))}
                </div>
              )}
            </div>
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="pd-thumbs" style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem', overflowX: 'auto', paddingBottom: 4 }}>
                {images.map((url, i) => (
                  <button key={i} className="pd-thumb" onClick={() => setImgIdx(i)} style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: `2px solid ${i === safeImgIdx ? accent : 'rgba(139,92,246,0.15)'}`, cursor: 'pointer', padding: 0 }}>
                    <img src={url} alt={`${listing.title} image ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Info ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Badges + title */}
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                <span style={{ background: 'rgba(139,92,246,0.1)', border: `1px solid rgba(139,92,246,0.25)`, color: accent, fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
                  {listing.product_type.charAt(0).toUpperCase() + listing.product_type.slice(1)}
                </span>
                <span style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>{conditionLabel}</span>
                {stockWarning && (
                  <span style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
                    Only {listing.stock_qty} left
                  </span>
                )}
                {outOfStock && (
                  <span style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
                    Out of Stock
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 'clamp(1.3rem,3vw,1.9rem)', fontWeight: 900, lineHeight: 1.2, margin: 0, letterSpacing: '-0.5px' }}>{listing.title}</h1>
            </div>

            {/* Rating row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Stars rating={avgRating} />
              {reviewCount > 0 ? (
                <>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: text }}>{avgRating.toFixed(1)}</span>
                  <button onClick={() => setTab('reviews')} style={{ fontSize: '0.78rem', color: accentSky, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {reviewCount} review{reviewCount !== 1 ? 's' : ''}
                  </button>
                </>
              ) : (
                <span style={{ fontSize: '0.78rem', color: muted }}>No reviews yet</span>
              )}
              <ListingQualityBadge
                qualityScore={listing.quality_score}
                avgRating={avgRating}
                reviewCount={reviewCount}
                compact
              />
            </div>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-1px', color: text }}>
                {fmt(listing.price, listing.currency, formatCurrency)}
              </span>
              {isService && (
                <span style={{ fontSize: '0.85rem', color: muted, lineHeight: 2 }}>/ session</span>
              )}
            </div>

            {/* Escrow notice */}
            {!isService && (
              <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, padding: '0.85rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🛡️</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', marginBottom: 2 }}>Escrow Protected</div>
                  <div style={{ fontSize: '0.75rem', color: muted, lineHeight: 1.5 }}>
                    Payment held securely until you confirm delivery. A {trustFee}% FreeTrust platform fee applies.
                  </div>
                </div>
              </div>
            )}

            {/* Quantity (physical only) */}
            {isPhysical && !outOfStock && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8' }}>Qty</span>
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden', background: card }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1} style={{ width: 36, height: 36, background: 'none', border: 'none', color: text, cursor: qty <= 1 ? 'not-allowed' : 'pointer', opacity: qty <= 1 ? 0.4 : 1, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ width: 36, textAlign: 'center', fontWeight: 700, fontSize: '0.9rem' }}>{qty}</span>
                  <button onClick={() => setQty(q => Math.min(listing!.stock_qty, q + 1))} disabled={qty >= listing.stock_qty} style={{ width: 36, height: 36, background: 'none', border: 'none', color: text, cursor: qty >= listing.stock_qty ? 'not-allowed' : 'pointer', opacity: qty >= listing.stock_qty ? 0.4 : 1, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <span style={{ fontSize: '0.75rem', color: muted }}>{listing.stock_qty} in stock</span>
              </div>
            )}

            {/* Order summary (multi-qty) */}
            {qty > 1 && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: muted, marginBottom: 5 }}>
                  <span>Subtotal ({qty} × {fmt(listing.price, listing.currency, formatCurrency)})</span>
                  <span>{fmt(subtotal, listing.currency, formatCurrency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: muted, marginBottom: 8 }}>
                  <span>FreeTrust fee ({trustFee}%)</span>
                  <span>{fmt(fee, listing.currency, formatCurrency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: text, borderTop: `1px solid ${border}`, paddingTop: 8 }}>
                  <span>Total</span>
                  <span>{fmt(total, listing.currency, formatCurrency)}</span>
                </div>
              </div>
            )}

            {/* Apple Pay / Google Pay express checkout */}
            {!outOfStock && listing.price > 0 && (
              <>
                <AppleGooglePayButton
                  amountCents={Math.round(listing.price * 100 * qty)}
                  currency={(listing.currency ?? 'EUR').toUpperCase()}
                  label={listing.title ?? 'Product'}
                  description={listing.title ?? undefined}
                  metadata={{ type: 'product_purchase', listing_id: listing.id }}
                  onSuccess={(piId) => {
                    setPayError(null)
                    router.push(`/checkout/success?payment_intent=${piId}`)
                  }}
                  onError={(msg) => setPayError(msg)}
                />
                {payError && (
                  <div style={{ color: '#f87171', fontSize: '0.78rem', marginTop: -4 }}>{payError}</div>
                )}
              </>
            )}

            {/* CTA buttons */}
            <div className="pd-ctas" style={{ display: 'flex', gap: '0.75rem' }}>
              {outOfStock ? (
                <button disabled style={{ flex: 1, background: subtle, color: muted, border: 'none', borderRadius: 12, padding: '1rem', fontWeight: 800, fontSize: '0.95rem', cursor: 'not-allowed' }}>
                  Out of Stock
                </button>
              ) : (
                <>
                  <button className="pd-btn-pri" onClick={handleBuyNow} disabled={buyLoading} style={{ flex: 1, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', border: 'none', borderRadius: 12, padding: '1rem', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(139,92,246,0.3)', transition: 'filter 0.2s' }}>
                    ⚡ {buyLoading ? 'Loading…' : isService ? 'Book Now' : 'Buy Now'}
                  </button>
                  <button className="pd-btn-sec" onClick={handleAddToCart} style={{ flex: 1, background: card, color: cartAdded ? '#34d399' : text, border: `1.5px solid ${cartAdded ? 'rgba(52,211,153,0.4)' : border}`, borderRadius: 12, padding: '1rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                    🛒 {cartAdded ? '✓ Added!' : 'Add to Cart'}
                  </button>
                </>
              )}
            </div>

            {/* Wishlist + Share */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <button onClick={() => setWishlist(w => !w)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: wishlist ? '#f43f5e' : muted, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                {wishlist ? '❤️' : '🤍'} {wishlist ? 'Saved' : 'Save'}
              </button>
              <button onClick={() => { if (navigator.share) { navigator.share({ title: listing!.title, url: window.location.href }) } else { navigator.clipboard.writeText(window.location.href) } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                📤 Share
              </button>
            </div>

            {/* Shipping / Delivery info */}
            {!isService && (
              <div className="pd-ship" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: accentSky, marginBottom: 4 }}>
                    {isDigital ? '⚡ Delivery' : '🚚 Shipping'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: muted, lineHeight: 1.5 }}>
                    {isDigital
                      ? 'Instant digital delivery after purchase.'
                      : listing.shipping_options
                        ? listing.shipping_options
                        : 'Contact seller for shipping details.'}
                  </div>
                </div>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', marginBottom: 4 }}>↩️ Returns</div>
                  <div style={{ fontSize: '0.75rem', color: muted, lineHeight: 1.5 }}>
                    {isDigital
                      ? 'Digital products: contact seller if you have issues.'
                      : '30-day returns. Item must be in original condition.'}
                  </div>
                </div>
              </div>
            )}

            {/* Seller card */}
            {listing.seller && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={listing.seller.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sellerDisplayName(listing.seller))}&background=8b5cf6&color=fff&size=48`}
                    alt={sellerDisplayName(listing.seller)}
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', display: 'block', border: `2px solid ${border}` }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <Link href={`/profile?id=${listing.seller.id}`} style={{ fontWeight: 700, fontSize: '0.9rem', color: text, textDecoration: 'none' }}>
                        {sellerDisplayName(listing.seller)}
                      </Link>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {/* Seller rating — default 5.0 for no reviews */}
                        <>
                          <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>★ {(listing.seller.avg_rating > 0 ? listing.seller.avg_rating : 5).toFixed(1)}</span>
                          <span style={{ color: subtle, fontSize: '0.7rem' }}>·</span>
                        </>
                        {listing.seller.trust_balance > 0 && (
                          <span style={{ color: accent, fontSize: '0.72rem', fontWeight: 600 }}>₮{listing.seller.trust_balance.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="pd-seller-msg"
                      onClick={() => listing.seller && messageSeller(listing.seller.id, listing.title)}
                      disabled={msgLoading}
                      style={{ background: 'rgba(139,92,246,0.08)', border: `1px solid rgba(139,92,246,0.2)`, color: accent, padding: '0.4rem 0.85rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s', opacity: msgLoading ? 0.6 : 1, fontFamily: 'inherit' }}
                    >
                      {msgLoading ? '...' : '💬 Message'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            {listing.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {listing.tags.map(tag => (
                  <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className="pd-tag" style={{ background: 'rgba(139,92,246,0.06)', border: `1px solid rgba(139,92,246,0.12)`, color: muted, fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px', borderRadius: 999, textDecoration: 'none', transition: 'all 0.15s' }}>
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ marginTop: '3rem' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, gap: 0 }}>
            {(['description', 'reviews'] as const).map(t => (
              <button key={t} className="pd-tab" onClick={() => setTab(t)} style={{ padding: '0.85rem 1.5rem', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? accent : 'transparent'}`, color: tab === t ? accent : muted, fontWeight: tab === t ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', textTransform: 'capitalize', transition: 'color 0.15s', marginBottom: -1 }}>
                {t}{t === 'reviews' ? ` (${reviewCount})` : ''}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '1.75rem' }}>

            {/* Description */}
            {tab === 'description' && (
              <div style={{ maxWidth: 700 }}>
                {listing.description ? (
                  <div style={{ fontSize: '0.95rem', color: '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{listing.description}</div>
                ) : (
                  <p style={{ color: muted, fontSize: '0.9rem' }}>No description provided.</p>
                )}
              </div>
            )}

            {/* Reviews — powered by ReviewsSection component */}
            {tab === 'reviews' && (
              <div style={{ maxWidth: 820 }}>
                <ReviewsSection
                  listingId={id}
                  revieweeId={listing.seller_id}
                  canReview={!!currentUserId && currentUserId !== listing.seller_id}
                  onReviewSubmitted={() => {
                    // Refresh listing to update avg_rating display in the rating row
                    setListing(prev => prev ? { ...prev, review_count: (prev.review_count || 0) + 1 } : prev)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
