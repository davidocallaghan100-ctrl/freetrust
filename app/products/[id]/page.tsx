'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { useCurrency } from '@/context/CurrencyContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductImage = { id: string; url: string; alt: string }
type Review = {
  id: string
  author: string
  avatar: string
  rating: number
  date: string
  body: string
  verified: boolean
}
type Product = {
  id: string
  title: string
  description: string
  longDescription: string
  price: number          // pence/cents
  originalPrice?: number
  currency: string
  category: string
  type: 'physical' | 'digital'
  condition: 'New' | 'Like New' | 'Good' | 'Fair'
  stock: number
  images: ProductImage[]
  seller: {
    id: string
    name: string
    avatar: string
    verified: boolean
    rating: number
    totalSales: number
    responseTime: string
    joinedYear: number
    trust: number
  }
  specs: Record<string, string>
  tags: string[]
  reviews: Review[]
  avgRating: number
  totalReviews: number
  shippingInfo: string
  returnsPolicy: string
  escrowProtected: boolean
  trustFee: number
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

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PRODUCTS: Record<string, Product> = {
  '1': {
    id: '1',
    title: 'Premium Mechanical Keyboard — TKL RGB',
    description: 'Tenkeyless mechanical keyboard with Cherry MX Blue switches and per-key RGB lighting.',
    longDescription: `This premium TKL mechanical keyboard delivers an exceptional typing experience with genuine Cherry MX Blue switches — tactile, clicky, and built to last 100 million keystrokes.

Per-key RGB illumination with 16.8 million colours lets you customise every key individually. The aluminium top plate adds rigidity and a premium feel, while the detachable USB-C cable keeps your desk tidy.

Includes a set of PBT double-shot keycaps that resist shine and fade over years of heavy use. On-board memory stores up to 5 lighting profiles without software.`,
    price: 12900, originalPrice: 16900, currency: 'EUR', category: 'Electronics',
    type: 'physical', condition: 'New', stock: 7,
    images: [
      { id: 'i1', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80', alt: 'Keyboard front' },
      { id: 'i2', url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&q=80', alt: 'RGB lighting' },
      { id: 'i3', url: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=800&q=80', alt: 'Side profile' },
    ],
    seller: { id: 's1', name: 'TechGear Hub', avatar: 'https://i.pravatar.cc/48?img=53', verified: true, rating: 4.9, totalSales: 1243, responseTime: '< 1 hour', joinedYear: 2021, trust: 3400 },
    specs: { 'Switch': 'Cherry MX Blue', 'Layout': 'TKL (80%)', 'Connection': 'USB-C', 'Lighting': 'Per-key RGB', 'Keycaps': 'PBT Double-shot', 'Top plate': 'Aluminium', 'Polling': '1000 Hz', 'Weight': '870 g' },
    tags: ['mechanical keyboard', 'RGB', 'Cherry MX', 'gaming', 'typing'],
    reviews: [
      { id: 'r1', author: 'Alex R.', avatar: 'https://i.pravatar.cc/40?img=12', rating: 5, date: '2024-11-20', body: 'Absolutely love this keyboard. Switches feel great and build quality is top-notch.', verified: true },
      { id: 'r2', author: 'Sam K.', avatar: 'https://i.pravatar.cc/40?img=25', rating: 5, date: '2024-12-04', body: 'Best keyboard I\'ve owned. RGB is vibrant and software-free storage is a huge plus.', verified: true },
      { id: 'r3', author: 'Jordan P.', avatar: 'https://i.pravatar.cc/40?img=47', rating: 4, date: '2025-01-11', body: 'Great quality but the clicky sound might bother office neighbours. Love the aluminium top.', verified: false },
    ],
    avgRating: 4.8, totalReviews: 127,
    shippingInfo: 'Free shipping. Estimated delivery 3–5 business days.',
    returnsPolicy: '30-day hassle-free returns. Item must be in original condition.',
    escrowProtected: true, trustFee: 5,
  },
  '2': {
    id: '2',
    title: 'Ergonomic Mesh Office Chair',
    description: 'Full mesh ergonomic chair with lumbar support, adjustable armrests, and 4D headrest.',
    longDescription: `Engineered for all-day comfort, this fully adjustable chair features breathable mesh across the entire back and seat, keeping you cool during extended sessions.

The S-shaped lumbar support adapts to your spine's natural curve, reducing lower back fatigue. Four-dimensional armrests let you dial in the perfect position for your shoulders and wrists.

Height, recline tension, and headrest angle are all independently adjustable, making this chair suitable for a wide range of body types and work styles.`,
    price: 38900, originalPrice: 49900, currency: 'EUR', category: 'Furniture',
    type: 'physical', condition: 'New', stock: 3,
    images: [
      { id: 'i1', url: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=800&q=80', alt: 'Chair front' },
      { id: 'i2', url: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800&q=80', alt: 'Chair side' },
    ],
    seller: { id: 's2', name: 'ErgoHome', avatar: 'https://i.pravatar.cc/48?img=44', verified: true, rating: 4.7, totalSales: 582, responseTime: '< 2 hours', joinedYear: 2022, trust: 2100 },
    specs: { 'Material': 'Breathable mesh', 'Max load': '150 kg', 'Seat height': '42–52 cm', 'Armrests': '4D adjustable', 'Lumbar': 'S-curve adaptive', 'Headrest': '4D adjustable', 'Base': 'Aluminium 5-star', 'Casters': 'PU soft-floor safe' },
    tags: ['ergonomic', 'office chair', 'mesh', 'lumbar', 'home office'],
    reviews: [
      { id: 'r1', author: 'Morgan T.', avatar: 'https://i.pravatar.cc/40?img=41', rating: 5, date: '2024-10-30', body: 'Back pain gone after switching to this chair. Worth every cent.', verified: true },
    ],
    avgRating: 4.7, totalReviews: 64,
    shippingInfo: 'Free delivery. White-glove assembly available at checkout.',
    returnsPolicy: '14-day returns. Assembly fee non-refundable.',
    escrowProtected: true, trustFee: 5,
  },
  '3': {
    id: '3',
    title: 'Notion Business OS Template',
    description: 'All-in-one Notion workspace for freelancers and small businesses.',
    longDescription: `This Notion Business OS gives you a complete command centre for your business: CRM, project tracker, invoicing, content calendar, and habit tracker — all connected in one workspace.

Includes 12 linked databases, 30+ page templates, and a step-by-step setup guide. Used by 2,000+ freelancers and founders.

One-time purchase. Instant digital delivery. Lifetime updates included.`,
    price: 2900, currency: 'EUR', category: 'Digital Products',
    type: 'digital', condition: 'New', stock: 999,
    images: [
      { id: 'i1', url: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80', alt: 'Notion dashboard' },
      { id: 'i2', url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80', alt: 'Notion views' },
    ],
    seller: { id: 's3', name: 'Priya Nair', avatar: 'https://i.pravatar.cc/48?img=44', verified: true, rating: 5.0, totalSales: 2841, responseTime: '< 30 min', joinedYear: 2022, trust: 5800 },
    specs: { 'Format': 'Notion template', 'Delivery': 'Instant download', 'Updates': 'Lifetime', 'Databases': '12 linked', 'Templates': '30+', 'Support': 'Email + community', 'Compatible': 'Notion Free & Paid' },
    tags: ['notion', 'productivity', 'template', 'business', 'CRM', 'freelancer'],
    reviews: [
      { id: 'r1', author: 'Dave K.', avatar: 'https://i.pravatar.cc/40?img=15', rating: 5, date: '2025-02-12', body: 'Replaced 4 different tools with this one workspace. Incredible value.', verified: true },
      { id: 'r2', author: 'Ciara M.', avatar: 'https://i.pravatar.cc/40?img=39', rating: 5, date: '2025-03-01', body: 'Setup guide was perfect. Had everything running in under an hour.', verified: true },
    ],
    avgRating: 5.0, totalReviews: 284,
    shippingInfo: 'Instant digital delivery — access immediately after purchase.',
    returnsPolicy: 'Digital products: no refunds. Contact us if you have issues.',
    escrowProtected: false, trustFee: 3,
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(p: number, cur: string, formatFn?: (amount: number, from: 'EUR' | 'GBP' | 'USD') => string) {
  if (formatFn && (cur === 'EUR' || cur === 'GBP' || cur === 'USD')) {
    return formatFn(p / 100, cur)
  }
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur || 'EUR', minimumFractionDigits: 2 }).format(p / 100)
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= Math.round(rating) ? '#fbbf24' : '#334155', fontSize: '0.85rem' }}>★</span>
      ))}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { format: formatCurrency } = useCurrency()
  const id = typeof params.id === 'string' ? params.id : ''

  const product: Product = MOCK_PRODUCTS[id] ?? MOCK_PRODUCTS['1']

  const [imgIdx, setImgIdx] = useState(0)
  const [qty, setQty] = useState(1)
  const [wishlist, setWishlist] = useState(false)
  const [tab, setTab] = useState<'description' | 'specs' | 'reviews'>('description')
  const [cartAdded, setCartAdded] = useState(false)
  const [buyLoading, setBuyLoading] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    const update = () => setCartCount(getCart().reduce((s, c) => s + c.qty, 0))
    update()
    window.addEventListener('ft-cart-updated', update)
    return () => window.removeEventListener('ft-cart-updated', update)
  }, [])

  const subtotal = product.price * qty
  const fee = Math.round(subtotal * (product.trustFee / 100))
  const total = subtotal + fee
  const discPct = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : null

  function handleAddToCart() {
    addToCart({ id: product.id, title: product.title, price: product.price, currency: product.currency, qty, image: product.images[0].url })
    setCartAdded(true)
    setTimeout(() => setCartAdded(false), 2500)
  }

  async function handleBuyNow() {
    setBuyLoading(true)
    // Add to cart then go to cart
    addToCart({ id: product.id, title: product.title, price: product.price, currency: product.currency, qty, image: product.images[0].url })
    router.push('/cart')
  }

  // theme
  const bg = '#0f172a'
  const card = '#1e293b'
  const border = 'rgba(56,189,248,0.1)'
  const accent = '#38bdf8'
  const text = '#f1f5f9'
  const muted = '#64748b'
  const subtle = '#334155'

  return (
    <main style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, sans-serif', paddingTop: 104, paddingBottom: 80 }}>
      <style>{`
        @media (max-width: 1024px) { .pd-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 768px)  { .pd-ctas { flex-direction: column !important; } .pd-ship { grid-template-columns: 1fr !important; } }
        .pd-thumb:hover { border-color: ${accent} !important; }
        .pd-tab:hover { color: #94a3b8 !important; }
        .pd-tag:hover { background: rgba(56,189,248,0.12) !important; color: ${accent} !important; }
        .pd-btn-pri:hover { background: #0ea5e9 !important; }
        .pd-btn-sec:hover { background: rgba(56,189,248,0.08) !important; border-color: ${accent} !important; }
        .pd-img-nav { opacity: 0; transition: opacity 0.15s; }
        .pd-img-wrap:hover .pd-img-nav { opacity: 1; }
        .pd-seller-msg:hover { background: rgba(56,189,248,0.15) !important; }
        @media (max-width: 768px) { .pd-reviews-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* ── Breadcrumb ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: muted, flexWrap: 'wrap' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', padding: 0, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Back
          </button>
          <span style={{ color: subtle }}>/</span>
          <Link href="/products" style={{ color: muted, textDecoration: 'none' }}>Products</Link>
          <span style={{ color: subtle }}>/</span>
          <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{product.title}</span>
          {cartCount > 0 && (
            <Link href="/cart" style={{ marginLeft: 'auto', background: accent, color: '#0f172a', padding: '0.3rem 0.85rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              🛒 Cart ({cartCount})
            </Link>
          )}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem' }}>
        <div className="pd-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'start' }}>

          {/* ── Left: Gallery ── */}
          <div style={{ position: 'sticky', top: 112 }}>
            {/* Main image */}
            <div className="pd-img-wrap" style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: `1px solid ${border}`, background: card, aspectRatio: '1/1' }}>
              <img src={product.images[imgIdx].url} alt={product.images[imgIdx].alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {discPct && (
                <span style={{ position: 'absolute', top: 14, left: 14, background: '#e11d48', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999 }}>
                  -{discPct}%
                </span>
              )}
              <span style={{ position: 'absolute', top: 14, right: 14, background: product.type === 'digital' ? 'rgba(56,189,248,0.9)' : 'rgba(100,116,139,0.9)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>
                {product.type === 'digital' ? 'DIGITAL' : 'PHYSICAL'}
              </span>
              {/* Prev/Next */}
              {product.images.length > 1 && (
                <>
                  <button className="pd-img-nav" onClick={() => setImgIdx(i => i === 0 ? product.images.length - 1 : i - 1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,0.75)', border: `1px solid ${border}`, borderRadius: '50%', width: 36, height: 36, color: text, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                  <button className="pd-img-nav" onClick={() => setImgIdx(i => i === product.images.length - 1 ? 0 : i + 1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,0.75)', border: `1px solid ${border}`, borderRadius: '50%', width: 36, height: 36, color: text, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                </>
              )}
              {/* Dots */}
              {product.images.length > 1 && (
                <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                  {product.images.map((_, i) => (
                    <button key={i} onClick={() => setImgIdx(i)} style={{ width: i === imgIdx ? 20 : 8, height: 8, borderRadius: 99, background: i === imgIdx ? accent : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }} />
                  ))}
                </div>
              )}
            </div>
            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem', overflowX: 'auto', paddingBottom: 4 }}>
                {product.images.map((img, i) => (
                  <button key={img.id} className="pd-thumb" onClick={() => setImgIdx(i)} style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: `2px solid ${i === imgIdx ? accent : 'rgba(56,189,248,0.15)'}`, cursor: 'pointer', padding: 0 }}>
                    <img src={img.url} alt={img.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
                <span style={{ background: 'rgba(56,189,248,0.1)', border: `1px solid rgba(56,189,248,0.25)`, color: accent, fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>{product.category}</span>
                <span style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>{product.condition}</span>
                {product.stock <= 5 && product.type === 'physical' && (
                  <span style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>Only {product.stock} left</span>
                )}
              </div>
              <h1 style={{ fontSize: 'clamp(1.4rem,3vw,1.9rem)', fontWeight: 900, lineHeight: 1.2, margin: 0, letterSpacing: '-0.5px' }}>{product.title}</h1>
            </div>

            {/* Rating row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Stars rating={product.avgRating} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: text }}>{product.avgRating}</span>
              <button onClick={() => setTab('reviews')} style={{ fontSize: '0.78rem', color: accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {product.totalReviews} reviews
              </button>
              <span style={{ color: subtle }}>·</span>
              <span style={{ fontSize: '0.78rem', color: muted }}>{product.seller.totalSales} sold</span>
            </div>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>{fmt(product.price, product.currency, formatCurrency)}</span>
              {product.originalPrice && (
                <span style={{ fontSize: '1.2rem', color: muted, textDecoration: 'line-through', lineHeight: 1.5 }}>{fmt(product.originalPrice, product.currency, formatCurrency)}</span>
              )}
              {discPct && <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f87171', lineHeight: 2 }}>Save {discPct}%</span>}
            </div>

            {/* Escrow notice */}
            {product.escrowProtected && (
              <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, padding: '0.85rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🛡️</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', marginBottom: 2 }}>Escrow Protected</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>Payment held securely until you confirm delivery. A {product.trustFee}% FreeTrust platform fee applies.</div>
                </div>
              </div>
            )}

            {/* Quantity */}
            {product.type === 'physical' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8' }}>Qty</span>
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden', background: card }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1} style={{ width: 36, height: 36, background: 'none', border: 'none', color: text, cursor: qty <= 1 ? 'not-allowed' : 'pointer', opacity: qty <= 1 ? 0.4 : 1, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ width: 36, textAlign: 'center', fontWeight: 700, fontSize: '0.9rem' }}>{qty}</span>
                  <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} disabled={qty >= product.stock} style={{ width: 36, height: 36, background: 'none', border: 'none', color: text, cursor: qty >= product.stock ? 'not-allowed' : 'pointer', opacity: qty >= product.stock ? 0.4 : 1, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <span style={{ fontSize: '0.75rem', color: muted }}>{product.stock} in stock</span>
              </div>
            )}

            {/* Order summary */}
            {qty > 1 && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: muted, marginBottom: 5 }}>
                  <span>Subtotal ({qty} × {fmt(product.price, product.currency, formatCurrency)})</span>
                  <span>{fmt(subtotal, product.currency, formatCurrency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: muted, marginBottom: 8 }}>
                  <span>FreeTrust fee ({product.trustFee}%)</span>
                  <span>{fmt(fee, product.currency, formatCurrency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: text, borderTop: `1px solid ${border}`, paddingTop: 8 }}>
                  <span>Total</span>
                  <span>{fmt(total, product.currency, formatCurrency)}</span>
                </div>
              </div>
            )}

            {/* CTA buttons */}
            <div className="pd-ctas" style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="pd-btn-pri" onClick={handleBuyNow} disabled={buyLoading} style={{ flex: 1, background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', border: 'none', borderRadius: 12, padding: '1rem', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(56,189,248,0.3)', transition: 'background 0.2s' }}>
                ⚡ {buyLoading ? 'Loading…' : 'Buy Now'}
              </button>
              <button className="pd-btn-sec" onClick={handleAddToCart} style={{ flex: 1, background: card, color: cartAdded ? '#34d399' : text, border: `1.5px solid ${cartAdded ? 'rgba(52,211,153,0.4)' : border}`, borderRadius: 12, padding: '1rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                🛒 {cartAdded ? '✓ Added!' : 'Add to Cart'}
              </button>
            </div>

            {/* Wishlist + Share */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <button onClick={() => setWishlist(w => !w)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: wishlist ? '#f43f5e' : muted, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                {wishlist ? '❤️' : '🤍'} {wishlist ? 'Saved' : 'Save'}
              </button>
              <button onClick={() => { if (navigator.share) { navigator.share({ title: product.title, url: window.location.href }) } else { navigator.clipboard.writeText(window.location.href) } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                📤 Share
              </button>
            </div>

            {/* Shipping + Returns */}
            <div className="pd-ship" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: accent, marginBottom: 4 }}>🚚 Shipping</div>
                <div style={{ fontSize: '0.75rem', color: muted, lineHeight: 1.5 }}>{product.shippingInfo}</div>
              </div>
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', marginBottom: 4 }}>↩️ Returns</div>
                <div style={{ fontSize: '0.75rem', color: muted, lineHeight: 1.5 }}>{product.returnsPolicy}</div>
              </div>
            </div>

            {/* Seller card */}
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img src={product.seller.avatar} alt={product.seller.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', display: 'block', border: `2px solid ${border}` }} />
                {product.seller.verified && (
                  <span style={{ position: 'absolute', bottom: -2, right: -2, background: accent, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', border: '2px solid #0f172a' }}>✓</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: text }}>{product.seller.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>★ {product.seller.rating}</span>
                      <span style={{ color: subtle, fontSize: '0.7rem' }}>·</span>
                      <span style={{ color: muted, fontSize: '0.72rem' }}>{product.seller.totalSales} sales</span>
                      <span style={{ color: subtle, fontSize: '0.7rem' }}>·</span>
                      <span style={{ color: accent, fontSize: '0.72rem', fontWeight: 600 }}>₮{product.seller.trust.toLocaleString()}</span>
                    </div>
                  </div>
                  <button className="pd-seller-msg" style={{ background: 'rgba(56,189,248,0.08)', border: `1px solid rgba(56,189,248,0.2)`, color: accent, padding: '0.4rem 0.85rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s' }}>
                    💬 Message
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: muted, marginTop: 6 }}>
                  Responds {product.seller.responseTime} · Seller since {product.seller.joinedYear}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {product.tags.map(tag => (
                <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className="pd-tag" style={{ background: 'rgba(56,189,248,0.06)', border: `1px solid rgba(56,189,248,0.12)`, color: muted, fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px', borderRadius: 999, textDecoration: 'none', transition: 'all 0.15s' }}>
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ marginTop: '3rem' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, gap: 0 }}>
            {(['description', 'specs', 'reviews'] as const).map(t => (
              <button key={t} className="pd-tab" onClick={() => setTab(t)} style={{ padding: '0.85rem 1.5rem', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? accent : 'transparent'}`, color: tab === t ? accent : muted, fontWeight: tab === t ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', textTransform: 'capitalize', transition: 'color 0.15s', marginBottom: -1 }}>
                {t}{t === 'reviews' ? ` (${product.totalReviews})` : ''}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '1.75rem' }}>

            {/* Description */}
            {tab === 'description' && (
              <div style={{ maxWidth: 700 }}>
                <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: 1.7, margin: '0 0 1rem' }}>{product.description}</p>
                <div style={{ fontSize: '0.9rem', color: muted, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{product.longDescription}</div>
              </div>
            )}

            {/* Specs */}
            {tab === 'specs' && (
              <div style={{ maxWidth: 560, background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
                {Object.entries(product.specs).map(([k, v], i) => (
                  <div key={k} style={{ display: 'flex', padding: '0.75rem 1.25rem', background: i % 2 === 0 ? 'rgba(56,189,248,0.03)' : 'transparent', borderBottom: i < Object.keys(product.specs).length - 1 ? `1px solid ${border}` : 'none' }}>
                    <span style={{ width: 160, fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', flexShrink: 0 }}>{k}</span>
                    <span style={{ fontSize: '0.82rem', color: text }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Reviews */}
            {tab === 'reviews' && (
              <div className="pd-reviews-grid" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem', maxWidth: 900 }}>
                {/* Summary */}
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.5rem', textAlign: 'center', height: 'fit-content' }}>
                  <div style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, color: text }}>{product.avgRating}</div>
                  <Stars rating={product.avgRating} />
                  <div style={{ fontSize: '0.75rem', color: muted, marginTop: 6 }}>Based on {product.totalReviews} reviews</div>
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[5,4,3,2,1].map(star => {
                      const pcts: Record<number, number> = { 5: 72, 4: 18, 3: 6, 2: 2, 1: 2 }
                      const pct = pcts[star]
                      return (
                        <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem' }}>
                          <span style={{ color: muted, width: 8 }}>{star}</span>
                          <div style={{ flex: 1, height: 6, background: 'rgba(56,189,248,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#fbbf24', borderRadius: 99 }} />
                          </div>
                          <span style={{ color: muted, width: 24, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Review list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {product.reviews.map(rev => (
                    <div key={rev.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1.1rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <img src={rev.avatar} alt={rev.author} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{rev.author}</span>
                              {rev.verified && <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 600 }}>✓ Verified</span>}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: muted }}>
                              {formatDistanceToNow(new Date(rev.date), { addSuffix: true })}
                            </span>
                          </div>
                          <Stars rating={rev.rating} />
                          <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6, margin: '0.5rem 0 0' }}>{rev.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {product.totalReviews > product.reviews.length && (
                    <button style={{ background: 'none', border: `1.5px dashed ${border}`, borderRadius: 14, padding: '0.85rem', color: muted, fontSize: '0.82rem', cursor: 'pointer', width: '100%' }}>
                      Load more reviews ({product.totalReviews - product.reviews.length} remaining)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
