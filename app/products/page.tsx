'use client'
import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/context/CurrencyContext'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string
  title: string
  description: string
  price: number
  category: string
  type: 'digital' | 'physical'
  image?: string
  imageGradient?: string
  seller_name: string
  seller_avatar?: string
  seller_trust: number
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

const SORT_OPTIONS = ['Newest', 'Popular', 'Price: Low', 'Price: High', 'Trust Score']

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

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_PRODUCTS: Product[] = [
  { id:'p1', title:'Notion Business OS', description:'Complete business management system built in Notion. Includes CRM, project tracker, finance dashboard and more.', price:29, category:'templates', type:'digital', imageGradient:'linear-gradient(135deg,#34d399,#059669)', seller_name:'Priya Nair', seller_avatar:'https://i.pravatar.cc/40?img=44', seller_trust:1580, seller_verified:true, rating:4.9, review_count:284, delivery:'Instant Download' },
  { id:'p2', title:'FreeTrust Merch Hoodie', description:'Premium heavyweight hoodie with embroidered FreeTrust logo. Ethically made, super soft, available in 6 colours.', price:65, category:'merch', type:'physical', imageGradient:'linear-gradient(135deg,#38bdf8,#0284c7)', seller_name:'Maja Eriksson', seller_avatar:'https://i.pravatar.cc/40?img=25', seller_trust:740, seller_verified:true, rating:4.8, review_count:91, free_shipping:true, delivery:'3–5 business days' },
  { id:'p3', title:'Sustainable Biz Starter Kit', description:'A 90-page guide + templates for launching a carbon-neutral business. Includes ESG reporting spreadsheet.', price:19, category:'courses', type:'digital', imageGradient:'linear-gradient(135deg,#86efac,#16a34a)', seller_name:'Amara Diallo', seller_avatar:'https://i.pravatar.cc/40?img=45', seller_trust:890, seller_verified:true, rating:4.7, review_count:147, delivery:'Instant Download' },
  { id:'p4', title:'UI Component Library — Figma', description:'500+ production-ready Figma components. Dark and light modes, auto-layout, variables system included.', price:79, category:'art', type:'digital', imageGradient:'linear-gradient(135deg,#f472b6,#db2777)', seller_name:'Sarah Chen', seller_avatar:'https://i.pravatar.cc/40?img=47', seller_trust:2100, seller_verified:true, rating:5.0, review_count:512, delivery:'Instant Download' },
  { id:'p5', title:'Irish Sourdough Starter Culture', description:'Live active sourdough starter — 20-year-old culture, fed and ready to ship in an insulated pouch.', price:14, category:'food-groceries', type:'physical', imageGradient:'linear-gradient(135deg,#fbbf24,#d97706)', seller_name:'Dave Kelly', seller_avatar:'https://i.pravatar.cc/40?img=15', seller_trust:420, rating:4.6, review_count:63, free_shipping:false, delivery:'1–2 days (refrigerated)' },
  { id:'p6', title:'Ambient Lo-Fi Music Pack', description:'80 royalty-free lo-fi tracks — perfect for videos, podcasts and study sessions. All stems included.', price:24, category:'music', type:'digital', imageGradient:'linear-gradient(135deg,#a78bfa,#7c3aed)', seller_name:'Lena Fischer', seller_avatar:'https://i.pravatar.cc/40?img=41', seller_trust:780, rating:4.8, review_count:203, delivery:'Instant Download' },
  { id:'p7', title:'Next.js SaaS Boilerplate', description:'Production-ready Next.js 14 starter with Supabase auth, Stripe billing, Resend email and Tailwind UI.', price:129, category:'software', type:'digital', imageGradient:'linear-gradient(135deg,#818cf8,#4338ca)', seller_name:'Marcus Obi', seller_avatar:'https://i.pravatar.cc/40?img=12', seller_trust:2100, seller_verified:true, rating:4.9, review_count:378, delivery:'Instant Download' },
  { id:'p8', title:'Handwoven Linen Tote Bag', description:'Beautiful handwoven linen tote in natural dye colours. Each bag is unique — handmade in small batches.', price:38, category:'handmade', type:'physical', imageGradient:'linear-gradient(135deg,#fb923c,#ea580c)', seller_name:'Ciara Murphy', seller_avatar:'https://i.pravatar.cc/40?img=39', seller_trust:580, rating:4.9, review_count:45, free_shipping:true, delivery:'4–7 business days' },
  { id:'p9', title:'SEO Content Strategy Course', description:'12-module course on building organic traffic from zero. Includes keyword research, content frameworks and case studies.', price:97, category:'courses', type:'digital', imageGradient:'linear-gradient(135deg,#38bdf8,#0284c7)', seller_name:'Tom Walsh', seller_avatar:'https://i.pravatar.cc/40?img=53', seller_trust:1240, seller_verified:true, rating:4.8, review_count:267, delivery:'Instant Download' },
  { id:'p10', title:'Dublin Street Photography Prints', description:'Limited edition A3 prints of Dublin city life. Shot on film, printed on Hahnemühle Fine Art paper.', price:55, category:'photography', type:'physical', imageGradient:'linear-gradient(135deg,#94a3b8,#475569)', seller_name:'James Okafor', seller_avatar:'https://i.pravatar.cc/40?img=13', seller_trust:680, rating:5.0, review_count:28, free_shipping:false, delivery:'5–7 business days' },
  { id:'p11', title:'Organic Seed Collection (30 varieties)', description:'Heirloom vegetable seeds — 30 varieties, non-GMO, sustainably grown. Includes planting guide.', price:22, category:'food-groceries', type:'physical', imageGradient:'linear-gradient(135deg,#86efac,#16a34a)', seller_name:'Yuki Tanaka', seller_avatar:'https://i.pravatar.cc/40?img=5', seller_trust:390, rating:4.7, review_count:81, free_shipping:true, delivery:'2–4 business days' },
  { id:'p12', title:'Brand Identity Design Book', description:'The definitive guide to building brand identities — from strategy to visual systems. 380 pages, hardcover.', price:42, category:'books', type:'physical', imageGradient:'linear-gradient(135deg,#fbbf24,#d97706)', seller_name:'Priya Nair', seller_avatar:'https://i.pravatar.cc/40?img=44', seller_trust:1580, seller_verified:true, rating:4.8, review_count:193, free_shipping:true, delivery:'3–5 business days' },
]

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
function ProductCard({ p, wishlist, onWishlist }: {
  p: Product
  wishlist: Set<string>
  onWishlist: (id: string) => void
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
        {/* Rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Stars rating={p.rating} />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{p.rating > 0 ? `${p.rating.toFixed(1)} (${p.review_count})` : 'No reviews yet'}</span>
        </div>

        {/* Seller row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingTop: '0.25rem', borderTop: '1px solid rgba(56,189,248,0.06)' }}>
          {p.seller_avatar
            ? <img src={p.seller_avatar} alt={p.seller_name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
          }
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.seller_name}</span>
          {p.seller_verified && <span style={{ fontSize: '0.62rem', color: '#38bdf8', flexShrink: 0 }}>✓</span>}
          {p.seller_trust > 0 && <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700, background: 'rgba(56,189,248,0.08)', padding: '1px 5px', borderRadius: 5, flexShrink: 0 }}>₮{p.seller_trust.toLocaleString()}</span>}
        </div>

        {/* Delivery info */}
        <div style={{ fontSize: '0.7rem', color: p.type === 'digital' ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>{p.type === 'digital' ? '⚡' : '📦'}</span>
          <span>{p.delivery ?? (p.type === 'digital' ? 'Instant Download' : 'Standard delivery')}</span>
          {p.free_shipping && <span style={{ marginLeft: 2, color: '#34d399', fontWeight: 700 }}>· Free shipping</span>}
        </div>

        {/* Price + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f1f5f9' }}>{format(p.price, 'GBP')}</span>
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

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      try {
        const { data } = await supabase
          .from('listings')
          .select('id, title, description, price, product_type, tags, images, avg_rating, review_count, seller_id, profiles!seller_id(full_name, avatar_url, trust_balance)')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100)
        if (data && data.length > 0) {
          setDbProducts(data.map((d: Record<string, unknown>) => {
            const profile = d.profiles as Record<string, unknown> | null
            const tags = Array.isArray(d.tags) ? (d.tags as string[]) : []
            const images = Array.isArray(d.images) ? (d.images as string[]) : []
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
              category,
              type: d.product_type === 'digital' ? 'digital' as const : 'physical' as const,
              image: images[0] ?? undefined,
              seller_name: String(profile?.full_name ?? 'FreeTrust Store'),
              seller_avatar: profile?.avatar_url ? String(profile.avatar_url) : undefined,
              seller_trust: Number(profile?.trust_balance ?? 0),
              seller_verified: true,
              rating: Number(d.avg_rating ?? 0),
              review_count: Number(d.review_count ?? 0),
              free_shipping: true,
              delivery: d.product_type === 'digital' ? 'Instant Download' : '3–7 business days',
            }
          }))
        }
      } catch { /* use mock */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const products = dbProducts ?? []

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
    if (sortBy === 'Trust Score') return b.seller_trust - a.seller_trust
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
              <ProductCard key={p.id} p={p} wishlist={wishlist} onWishlist={toggleWishlist} />
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
