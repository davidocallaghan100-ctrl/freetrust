'use client'
import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCurrency, type CurrencyCode } from '@/context/CurrencyContext'

function DeleteModal({ title, onConfirm, onCancel, deleting }: {
  title: string; onConfirm: () => void; onCancel: () => void; deleting: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: 14, padding: '1.5rem', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>Delete product?</div>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
          &ldquo;{title}&rdquo; will be permanently deleted and cannot be recovered.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={deleting}
            style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: deleting ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700 }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string
  title: string
  description: string
  price: number
  currency: string
  category: string
  type: 'digital' | 'physical'
  image?: string
  imageGradient?: string
  seller_name: string
  seller_avatar?: string
  seller_id?: string | null
  seller_verified?: boolean
  rating: number
  review_count: number
  free_shipping?: boolean
  delivery?: string
  wishlist?: boolean
}

// ─── Category data ────────────────────────────────────────────────────────────
const ALL_CATEGORIES = [
  { id: 'all', label: 'All', icon: '🌐' },
  { id: 'technology', label: 'Tech', icon: '💻' },
  { id: 'art', label: 'Art', icon: '🎨' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'courses', label: 'Courses', icon: '🎓' },
  { id: 'templates', label: 'Templates', icon: '📋' },
  { id: 'handmade', label: 'Handmade', icon: '🤲' },
  { id: 'food-groceries', label: 'Food', icon: '🥦' },
  { id: 'books', label: 'Books', icon: '📖' },
  { id: 'software', label: 'Software', icon: '⚙️' },
  { id: 'photography', label: 'Photography', icon: '📷' },
  { id: 'merch', label: 'Merch', icon: '👕' },
]

const SORT_OPTIONS = ['Newest', 'Popular', 'Price: Low', 'Price: High']

// ─── Category gradients ───────────────────────────────────────────────────────
const CAT_GRAD: Record<string, string> = {
  technology:    'linear-gradient(135deg,#06b6d4,#0284c7)',
  art:           'linear-gradient(135deg,#f472b6,#db2777)',
  music:         'linear-gradient(135deg,#a78bfa,#7c3aed)',
  courses:       'linear-gradient(135deg,#38bdf8,#0284c7)',
  templates:     'linear-gradient(135deg,#34d399,#059669)',
  handmade:      'linear-gradient(135deg,#fb923c,#ea580c)',
  'food-groceries':'linear-gradient(135deg,#86efac,#16a34a)',
  books:         'linear-gradient(135deg,#fbbf24,#d97706)',
  software:      'linear-gradient(135deg,#818cf8,#4338ca)',
  photography:   'linear-gradient(135deg,#94a3b8,#475569)',
  merch:         'linear-gradient(135deg,#f472b6,#7c3aed)',
}


// ─── Star rating ──────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <span>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= Math.round(rating) ? '#fbbf24' : '#334155', fontSize: '0.7rem' }}>★</span>
      ))}
    </span>
  )
}

// ─── Product card ─────────────────────────────────────────────────────────────
function ProductCard({ p, wishlist, onWishlist, isOwner, onDelete }: {
  p: Product
  wishlist: Set<string>
  onWishlist: (id: string) => void
  isOwner?: boolean
  onDelete?: (id: string, title: string) => void
}) {
  const { format } = useCurrency()
  const catLabel = ALL_CATEGORIES.find(c => c.id === p.category)?.label ?? p.category
  const gradient = p.image ? undefined : (CAT_GRAD[p.category] ?? 'linear-gradient(135deg,#334155,#1e293b)')

  return (
    <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 8px 32px rgba(56,189,248,0.18)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='' }}>

      {/* Clickable image + title area */}
      <Link href={`/products/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
        {/* Image / gradient */}
        <div style={{ position: 'relative', height: 160, background: p.image ? undefined : gradient, flexShrink: 0 }}>
          {p.image && <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}

          {/* Category badge — top left */}
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <span style={{ background: 'rgba(15,23,42,0.85)', color: '#94a3b8', fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999 }}>{catLabel}</span>
          </div>

          {/* Digital/Physical badge + wishlist — top right */}
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            {p.type === 'digital'
              ? <span style={{ background: 'rgba(56,189,248,0.9)', color: '#0f172a', fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>DIGITAL</span>
              : <span style={{ background: 'rgba(148,163,184,0.9)', color: '#0f172a', fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>PHYSICAL</span>
            }
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onWishlist(p.id) }}
              style={{ background: 'rgba(15,23,42,0.8)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.85rem', flexShrink: 0 }}>
              {wishlist.has(p.id) ? '❤️' : '🤍'}
            </button>
          </div>
        </div>

        {/* Title + description */}
        <div style={{ padding: '0.85rem 0.85rem 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.25 }}>{p.title}</div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.description}</p>
        </div>
      </Link>

      {/* Body (non-link) */}
      <div style={{ padding: '0.4rem 0.85rem 0.85rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {/* Rating — only show if real reviews exist */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {p.review_count > 0 ? (
            <>
              <Stars rating={p.rating} />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{p.rating.toFixed(1)} ({p.review_count} reviews)</span>
            </>
          ) : (
            <span style={{ fontSize: '0.72rem', color: '#475569' }}>No reviews yet</span>
          )}
        </div>

        {/* Seller row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingTop: '0.25rem', borderTop: '1px solid rgba(56,189,248,0.06)' }}>
          {p.seller_id
            ? <Link href={`/profile?id=${p.seller_id}`} onClick={e => e.stopPropagation()} style={{ flexShrink: 0, display: 'block' }}>
                {p.seller_avatar
                  ? <img src={p.seller_avatar} alt={p.seller_name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#334155', display: 'block' }} />
                }
              </Link>
            : p.seller_avatar
              ? <img src={p.seller_avatar} alt={p.seller_name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
          }
          {p.seller_id
            ? <Link href={`/profile?id=${p.seller_id}`} onClick={e => e.stopPropagation()} style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textDecoration: 'none' }}>{p.seller_name}</Link>
            : <span style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.seller_name}</span>
          }
          {p.seller_verified && <span style={{ fontSize: '0.62rem', color: '#38bdf8', flexShrink: 0 }}>✓</span>}
        </div>

        {/* Delivery info */}
        <div style={{ fontSize: '0.7rem', color: p.type === 'digital' ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>{p.type === 'digital' ? '⚡' : '📦'}</span>
          <span>{p.delivery ?? (p.type === 'digital' ? 'Instant Download' : 'Standard delivery')}</span>
          {p.free_shipping && <span style={{ marginLeft: 2, color: '#34d399', fontWeight: 700 }}>· Free shipping</span>}
        </div>

        {/* Price + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f1f5f9' }}>{format(p.price, (p.currency || 'EUR') as CurrencyCode)}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
            <Link
              href={`/products/${p.id}`}
              style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.75rem', fontWeight: 700, color: '#fff', cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              View
            </Link>
            <button
              onClick={e => { e.stopPropagation(); if (navigator.share) { navigator.share({ title: p.title, url: `${window.location.origin}/products/${p.id}` }) } else { navigator.clipboard.writeText(`${window.location.origin}/products/${p.id}`) } }}
              style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.45rem 0.5rem', fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer', minHeight: 36 }}
              title="Share">↗</button>
            {isOwner && onDelete && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(p.id, p.title) }}
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.45rem 0.5rem', fontSize: '0.75rem', color: '#ef4444', cursor: 'pointer', minHeight: 36 }}
                title="Delete">🗑</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────
function ProductsInner() {
  const { format } = useCurrency()
  const searchParams = useSearchParams()
  const initCat = searchParams.get('category') ?? 'all'
  const initType = (searchParams.get('type') ?? 'all') as 'all' | 'digital' | 'physical'

  const [typeFilter, setTypeFilter] = useState<'all'|'digital'|'physical'>(initType)
  const [catFilter, setCatFilter] = useState(initCat)
  const [sortBy, setSortBy] = useState('Newest')
  const [maxPrice, setMaxPrice] = useState(500)
  const [minRating, setMinRating] = useState(0)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [dbProducts, setDbProducts] = useState<Product[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') setIsAdmin(true)
    })()
  }, [])

  async function handleDelete(id: string, title: string) {
    setDeleteTarget({ id, title })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/listings/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDbProducts(prev => (prev ?? []).filter(p => p.id !== deleteTarget.id))
        setDeleteTarget(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      try {
        const { data } = await supabase
          .from('listings')
          .select('id, title, description, price, currency, product_type, tags, images, cover_image, avg_rating, review_count, seller_id, profiles!seller_id(id, full_name, avatar_url)')
          .eq('status', 'active')
          .neq('product_type', 'service')
          .order('created_at', { ascending: false })
          .limit(100)
        if (data && data.length > 0) {
          setDbProducts(data.map((d: Record<string, unknown>) => {
            const profile = d.profiles as Record<string, unknown> | null
            const tags = Array.isArray(d.tags) ? (d.tags as string[]) : []
            const images = Array.isArray(d.images) ? (d.images as string[]) : []
            const coverImage = (d.cover_image as string | null) ?? null
            // Derive category from tags — look for known category keywords
            const CAT_KEYWORDS: Record<string, string> = {
              'charger': 'technology', 'headphones': 'technology', 'mouse': 'technology',
              'keyboard': 'technology', 'ssd': 'technology', 'router': 'technology',
              'led': 'technology', 'gimbal': 'technology', 'tracker': 'technology',
              'stream deck': 'technology', 'power bank': 'technology', 'wifi': 'technology',
              'course': 'courses', 'template': 'templates', 'music': 'music',
              'photo': 'photography', 'art': 'art', 'book': 'books', 'software': 'software',
              'merch': 'merch', 'hoodie': 'merch', 'handmade': 'handmade', 'food': 'food-groceries',
            }
            let category = 'technology'
            const titleLower = String(d.title ?? '').toLowerCase()
            const tagsStr = tags.join(' ').toLowerCase()
            for (const [kw, cat] of Object.entries(CAT_KEYWORDS)) {
              if (titleLower.includes(kw) || tagsStr.includes(kw)) { category = cat; break }
            }
            return {
              id: String(d.id),
              title: String(d.title ?? ''),
              description: String(d.description ?? ''),
              price: Number(d.price ?? 0),
              currency: String(d.currency ?? 'EUR'),
              category,
              type: d.product_type === 'digital' ? 'digital' as const : 'physical' as const,
              image: coverImage ?? images[0] ?? undefined,
              seller_name: String(profile?.full_name ?? 'FreeTrust Store'),
              seller_avatar: profile?.avatar_url ? String(profile.avatar_url) : undefined,
              seller_id: profile?.id ? String(profile.id) : (d.seller_id ? String(d.seller_id) : null),
              seller_verified: true,
              // Only show real FreeTrust reviews — avg_rating/review_count are 0 until a user leaves one
              rating: Number(d.avg_rating ?? 0),
              review_count: Number(d.review_count ?? 0),
              free_shipping: true,
              delivery: d.product_type === 'digital' ? 'Instant Download' : '3–7 business days',
            }
          }))
        }
      } catch { /* leave as empty */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const products = dbProducts ?? ([] as Product[])

  let filtered = products.filter(p => {
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    if (catFilter !== 'all' && p.category !== catFilter) return false
    if (p.price > maxPrice) return false
    if (p.rating > 0 && p.rating < minRating) return false
    return true
  })

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'Price: Low') return a.price - b.price
    if (sortBy === 'Price: High') return b.price - a.price
    if (sortBy === 'Popular') return b.review_count - a.review_count
    return 0
  })

  function toggleWishlist(id: string) {
    setWishlist(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const pillStyle = (active: boolean, color = '#38bdf8') => ({
    padding: '0.4rem 0.85rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: active ? 700 : 500,
    cursor: 'pointer', border: `1px solid ${active ? color : 'rgba(148,163,184,0.2)'}`,
    background: active ? `${color}18` : 'transparent', color: active ? color : '#94a3b8',
    whiteSpace: 'nowrap' as const, minHeight: 36, flexShrink: 0 as const,
  })

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      {deleteTarget && (
        <DeleteModal
          title={deleteTarget.title}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
      <style>{`
        .prod-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1.1rem; }
        .prod-filter-row { display: flex; gap: 0.5rem; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
        .prod-filter-row::-webkit-scrollbar { display: none; }
        @media (max-width: 1280px) { .prod-grid { grid-template-columns: repeat(3,1fr) !important; } }
        @media (max-width: 900px)  { .prod-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 480px)  { .prod-grid { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.25rem 2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.2rem)', fontWeight: 900, margin: '0 0 0.25rem', letterSpacing: '-0.5px' }}>Products</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>{filtered.length} product{filtered.length !== 1 ? 's' : ''} found</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.45rem 0.75rem', fontSize: '0.8rem', color: '#94a3b8', cursor: 'pointer', minHeight: 36 }}>
              {SORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Link href="/seller/gigs/create" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.5rem 1.1rem', borderRadius: 9, fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none', minHeight: 36, display: 'flex', alignItems: 'center' }}>
              + List Product
            </Link>
          </div>
        </div>

        {/* Type filters */}
        <div className="prod-filter-row" style={{ marginBottom: '0.75rem' }}>
          {(['all','digital','physical'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={pillStyle(typeFilter === t)}>
              {t === 'all' ? 'All Types' : t === 'digital' ? '💾 Digital' : '📦 Physical'}
            </button>
          ))}
        </div>

        {/* Category pills */}
        <div className="prod-filter-row" style={{ marginBottom: '1rem' }}>
          {ALL_CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCatFilter(c.id)} style={pillStyle(catFilter === c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* Price + rating */}
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
            <span>Max price: <strong style={{ color: '#f1f5f9' }}>{format(maxPrice === 500 ? 501 : maxPrice, 'GBP')}{maxPrice === 500 ? '+' : ''}</strong></span>
            <input type="range" min={5} max={500} step={5} value={maxPrice}
              onChange={e => setMaxPrice(Number(e.target.value))}
              style={{ accentColor: '#38bdf8', width: 100 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
            <span>Min rating:</span>
            {[0,3,4,4.5].map(r => (
              <button key={r} onClick={() => setMinRating(r)}
                style={{ ...pillStyle(minRating === r), padding: '0.3rem 0.6rem', fontSize: '0.72rem', minHeight: 30 }}>
                {r === 0 ? 'Any' : `${r}★+`}
              </button>
            ))}
          </div>
        </div>

        {/* Grid or empty state */}
        {loading ? (
          <div className="prod-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: '#1e293b', borderRadius: 14, height: 320, opacity: 0.5 }}>
                <div style={{ height: 160, background: '#334155', borderRadius: '14px 14px 0 0' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📦</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>No products found</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              {catFilter !== 'all' ? `No products yet in this category — be the first to list one.` : 'No products match your filters.'}
            </p>
            <Link href="/seller/gigs/create" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.75rem 1.75rem', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
              + List a Product
            </Link>
          </div>
        ) : (
          <div className="prod-grid">
            {filtered.map(p => (
              <ProductCard
                key={p.id}
                p={p}
                wishlist={wishlist}
                onWishlist={toggleWishlist}
                isOwner={isAdmin || (!!userId && p.seller_id === userId)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div style={{ paddingTop: 64, textAlign: 'center', color: '#64748b' }}>Loading…</div>}>
      <ProductsInner />
    </Suspense>
  )
}
