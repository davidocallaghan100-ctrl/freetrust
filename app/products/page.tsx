'use client'
import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Categories ──────────────────────────────────────────────
const DIGITAL_CATEGORIES = [
  { id: 'templates', label: 'Templates & Documents', icon: '📋' },
  { id: 'software', label: 'Software & Apps', icon: '⚙️' },
  { id: 'digital-downloads', label: 'Digital Downloads', icon: '💾' },
  { id: 'courses', label: 'Courses & Training', icon: '🎓' },
  { id: 'ebooks', label: 'eBooks & Guides', icon: '📚' },
  { id: 'design-assets', label: 'Design Assets', icon: '🎨' },
  { id: 'audio', label: 'Music & Audio', icon: '🎵' },
  { id: 'video', label: 'Video & Stock', icon: '🎬' },
  { id: 'photography', label: 'Photography', icon: '📷' },
  { id: 'fonts', label: 'Fonts & Typography', icon: '✍️' },
  { id: 'plugins', label: 'Plugins & Integrations', icon: '🔌' },
  { id: 'datasets', label: 'Data & Research', icon: '📊' },
]

const PHYSICAL_CATEGORIES = [
  { id: 'handmade', label: 'Handmade & Crafts', icon: '🤲' },
  { id: 'books-physical', label: 'Books & Publications', icon: '📖' },
  { id: 'clothing', label: 'Clothing & Apparel', icon: '👕' },
  { id: 'home-garden', label: 'Home & Garden', icon: '🏡' },
  { id: 'art-prints', label: 'Art & Prints', icon: '🖼️' },
  { id: 'tech-gadgets', label: 'Tech & Gadgets', icon: '🔧' },
  { id: 'food-drink', label: 'Food & Drink', icon: '🍵' },
  { id: 'food-groceries', label: 'Food & Groceries', icon: '🛒' },
  { id: 'health-wellness', label: 'Health & Wellness', icon: '💊' },
  { id: 'stationery', label: 'Stationery & Office', icon: '✏️' },
  { id: 'baby-kids', label: 'Baby & Kids', icon: '🧸' },
  { id: 'pets', label: 'Pet Food & Treats', icon: '🐾' },
]

const SHIPPING_OPTIONS = [
  { id: 'download', label: 'Instant Download', icon: '⚡' },
  { id: 'email', label: 'Email Delivery', icon: '📧' },
  { id: 'standard', label: 'Standard Shipping', icon: '📦' },
  { id: 'tracked', label: 'Tracked Delivery', icon: '🔍' },
  { id: 'express', label: 'Express Shipping', icon: '🚀' },
  { id: 'international', label: 'International', icon: '🌍' },
  { id: 'collection', label: 'Collection', icon: '🏪' },
]

const PRICE_RANGES = [
  { label: 'Any Price', max: null },
  { label: 'Under £10', max: 10 },
  { label: '£10–£50', min: 10, max: 50 },
  { label: '£50–£100', min: 50, max: 100 },
  { label: '£100–£500', min: 100, max: 500 },
  { label: '£500+', min: 500, max: null },
]

const SORT_OPTIONS = [
  { value: 'best', label: 'Best Match' },
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'top_rated', label: 'Top Rated' },
  { value: 'best_sellers', label: 'Best Sellers' },
]

const BADGE_COLORS: Record<string, string> = {
  Bestseller: '#fbbf24',
  'Top Rated': '#38bdf8',
  New: '#34d399',
  'Eco Verified': '#4ade80',
  Featured: '#a78bfa',
}

const MOCK_PRODUCTS = [
  { id: 'm1', title: 'Figma Component Library Pro', category_id: 'design-assets', product_type: 'digital', price: 49, currency: '£', seller_name: 'Sarah Chen', seller_avatar: 'https://i.pravatar.cc/150?img=47', rating: 4.9, reviews: 312, sales: 1840, description: '850+ production-ready Figma components with auto-layout, variants, and dark mode.', tags: ['Figma', 'UI Kit', 'Design System'], badge: 'Bestseller', shipping_options: ['download'] },
  { id: 'm2', title: 'Next.js SaaS Boilerplate', category_id: 'templates', product_type: 'digital', price: 129, currency: '£', seller_name: 'Priya Nair', seller_avatar: 'https://i.pravatar.cc/150?img=44', rating: 5.0, reviews: 89, sales: 420, description: 'Production-ready Next.js 14 starter with auth, billing, dashboard and Supabase integration.', tags: ['Next.js', 'TypeScript', 'Supabase'], badge: 'Top Rated', shipping_options: ['download'] },
  { id: 'm3', title: 'Impact Business Handbook', category_id: 'ebooks', product_type: 'digital', price: 24, currency: '£', seller_name: 'Amara Diallo', seller_avatar: 'https://i.pravatar.cc/150?img=45', rating: 4.8, reviews: 156, sales: 2300, description: 'A practical guide to building a purpose-driven business that delivers profit and positive impact.', tags: ['Business', 'Sustainability', 'Strategy'], badge: null, shipping_options: ['download', 'email'] },
  { id: 'm4', title: 'SEO Audit Spreadsheet Kit', category_id: 'templates', product_type: 'digital', price: 19, currency: '£', seller_name: 'Marcus Obi', seller_avatar: 'https://i.pravatar.cc/150?img=12', rating: 4.7, reviews: 203, sales: 3100, description: '14 interconnected spreadsheets covering technical SEO, content gaps, backlink analysis and reporting.', tags: ['SEO', 'Spreadsheet', 'Marketing'], badge: null, shipping_options: ['download'] },
  { id: 'm5', title: 'Mindful Leadership Course', category_id: 'courses', product_type: 'digital', price: 89, currency: '£', seller_name: 'Tom Walsh', seller_avatar: 'https://i.pravatar.cc/150?img=53', rating: 4.9, reviews: 67, sales: 580, description: '8-week self-paced course on conscious leadership, team culture and sustainable growth.', tags: ['Leadership', 'Course', 'Self-paced'], badge: 'New', shipping_options: ['download', 'email'] },
  { id: 'm6', title: 'Handmade Ceramic Mug Set', category_id: 'handmade', product_type: 'physical', price: 65, currency: '£', seller_name: 'Lena Fischer', seller_avatar: 'https://i.pravatar.cc/150?img=41', rating: 4.9, reviews: 44, sales: 290, description: 'Set of 4 hand-thrown ceramic mugs, each unique. Sustainably fired in a wood kiln. Ships worldwide.', tags: ['Handmade', 'Ceramic', 'Sustainable'], badge: 'Eco Verified', shipping_options: ['standard', 'tracked', 'international'] },
  { id: 'm7', title: 'Startup Financial Model', category_id: 'templates', product_type: 'digital', price: 35, currency: '£', seller_name: 'James Okafor', seller_avatar: 'https://i.pravatar.cc/150?img=13', rating: 4.8, reviews: 128, sales: 960, description: '5-year financial model for SaaS startups. Includes revenue, burn rate, runway and investor dashboards.', tags: ['Finance', 'Excel', 'Startup'], badge: null, shipping_options: ['download'] },
  { id: 'm8', title: 'Social Media Content Calendar', category_id: 'templates', product_type: 'digital', price: 15, currency: '£', seller_name: 'Yuki Tanaka', seller_avatar: 'https://i.pravatar.cc/150?img=5', rating: 4.6, reviews: 445, sales: 6200, description: '52-week content calendar with 300+ prompts, hooks, and post templates for all major platforms.', tags: ['Social Media', 'Content', 'Notion'], badge: 'Bestseller', shipping_options: ['download', 'email'] },
  { id: 'm9', title: 'Linen Art Print — Coastal Collection', category_id: 'art-prints', product_type: 'physical', price: 45, currency: '£', seller_name: 'Maja Eriksson', seller_avatar: 'https://i.pravatar.cc/150?img=25', rating: 4.8, reviews: 31, sales: 215, description: 'Giclée printed on archival linen. A3 and A2 sizes available. Ready to frame.', tags: ['Art', 'Print', 'Coastal'], badge: 'Featured', shipping_options: ['standard', 'tracked'] },
  { id: 'm10', title: 'Brand Identity Kit — Canva', category_id: 'design-assets', product_type: 'digital', price: 28, currency: '£', seller_name: 'Carlos Ruiz', seller_avatar: 'https://i.pravatar.cc/150?img=33', rating: 4.7, reviews: 91, sales: 1120, description: 'Complete brand identity pack — logos, colour palettes, typography, and 50+ social templates.', tags: ['Branding', 'Canva', 'Logo'], badge: null, shipping_options: ['download'] },
  { id: 'm11', title: 'Herbal Wellness Tea Set', category_id: 'food-drink', product_type: 'physical', price: 32, currency: '£', seller_name: 'Ayesha Patel', seller_avatar: 'https://i.pravatar.cc/150?img=9', rating: 4.9, reviews: 78, sales: 480, description: 'Curated selection of 6 organic herbal teas. Zero plastic. Sustainable packaging. UK roasted.', tags: ['Organic', 'Tea', 'Wellness'], badge: 'Eco Verified', shipping_options: ['standard', 'tracked', 'express'] },
  { id: 'm12', title: 'Podcast Editing Toolkit', category_id: 'audio', product_type: 'digital', price: 22, currency: '£', seller_name: 'Dave McCann', seller_avatar: 'https://i.pravatar.cc/150?img=52', rating: 4.6, reviews: 55, sales: 640, description: 'Royalty-free music, sound effects, and Audacity presets for podcasters. 200+ assets.', tags: ['Podcast', 'Audio', 'Royalty-Free'], badge: null, shipping_options: ['download'] },
  // ── Food & Groceries ─────────────────────────────────────────
  { id: 'fg1', title: 'Organic Sourdough Loaf — Weekly Subscription', category_id: 'food-groceries', product_type: 'physical', price: 8, currency: '£', seller_name: 'Ciara Murphy', seller_avatar: 'https://i.pravatar.cc/150?img=39', rating: 4.9, reviews: 143, sales: 980, description: 'Freshly baked organic sourdough delivered to your door weekly. Made with heritage wheat, long-fermented for flavour and gut health. Dublin only.', tags: ['Organic', 'Sourdough', 'Subscription'], badge: 'Bestseller', shipping_options: ['standard'] },
  { id: 'fg2', title: 'Irish Raw Honey — 500g Jar', category_id: 'food-groceries', product_type: 'physical', price: 14, currency: '£', seller_name: 'Tom Walsh', seller_avatar: 'https://i.pravatar.cc/150?img=53', rating: 5.0, reviews: 87, sales: 560, description: 'Single-origin raw Irish honey from wildflower meadows in County Clare. Unfiltered, unpasteurised. Every batch lab-tested for purity.', tags: ['Honey', 'Raw', 'Irish'], badge: 'Top Rated', shipping_options: ['standard', 'tracked'] },
  { id: 'fg3', title: 'Artisan Pasta Box — Mixed Selection', category_id: 'food-groceries', product_type: 'physical', price: 22, currency: '£', seller_name: 'Lucia Romano', seller_avatar: 'https://i.pravatar.cc/150?img=49', rating: 4.8, reviews: 62, sales: 340, description: '6 varieties of hand-extruded bronze-die pasta from our Dublin kitchen. Rigatoni, pappardelle, fusilli, and more. Free recipe card included.', tags: ['Pasta', 'Artisan', 'Italian'], badge: null, shipping_options: ['standard', 'tracked'] },
  { id: 'fg4', title: 'Seasonal Veg Box — Farm Direct', category_id: 'food-groceries', product_type: 'physical', price: 28, currency: '£', seller_name: 'Dave Kelly', seller_avatar: 'https://i.pravatar.cc/150?img=15', rating: 4.7, reviews: 201, sales: 1240, description: 'Weekly seasonal vegetables direct from our family farm in Wicklow. Mixed box for 2–4 people. Zero plastic packaging. Collected Monday, delivered Tuesday.', tags: ['Veg Box', 'Organic', 'Local Farm'], badge: 'Eco Verified', shipping_options: ['standard'] },
  { id: 'fg5', title: 'Cold Brew Coffee Concentrate — 4-Pack', category_id: 'food-groceries', product_type: 'physical', price: 18, currency: '£', seller_name: 'Marcus Obi', seller_avatar: 'https://i.pravatar.cc/150?img=12', rating: 4.9, reviews: 115, sales: 730, description: 'Premium cold brew concentrate made with single-origin Ethiopian and Colombian beans. Makes 16 drinks. Ready in 30 seconds — just add water or milk.', tags: ['Coffee', 'Cold Brew', 'Specialty'], badge: null, shipping_options: ['standard', 'express'] },
  { id: 'fg6', title: 'Gluten-Free Granola Gift Set', category_id: 'food-groceries', product_type: 'physical', price: 24, currency: '£', seller_name: 'Amara Diallo', seller_avatar: 'https://i.pravatar.cc/150?img=45', rating: 4.8, reviews: 49, sales: 210, description: 'Three flavours of handmade gluten-free granola in a beautifully packaged gift box. Dark chocolate & hazelnut, berry & coconut, and classic maple pecan. Makes a perfect foodie gift.', tags: ['Gluten-Free', 'Granola', 'Gift'], badge: 'New', shipping_options: ['standard', 'tracked', 'express'] },
  { id: 'fg7', title: 'Hot Sauce Bundle — 5 Bottles', category_id: 'food-groceries', product_type: 'physical', price: 32, currency: '£', seller_name: 'James Okafor', seller_avatar: 'https://i.pravatar.cc/150?img=13', rating: 4.9, reviews: 178, sales: 890, description: 'Five small-batch hot sauces ranging from mild fermented jalapeño to scorching habanero-mango. All natural ingredients. Made in Cork. Ships worldwide.', tags: ['Hot Sauce', 'Small Batch', 'Vegan'], badge: 'Bestseller', shipping_options: ['standard', 'tracked', 'international'] },
  { id: 'fg8', title: 'Specialty Cheese & Charcuterie Hamper', category_id: 'food-groceries', product_type: 'physical', price: 55, currency: '£', seller_name: 'Lena Fischer', seller_avatar: 'https://i.pravatar.cc/150?img=41', rating: 5.0, reviews: 34, sales: 120, description: 'A curated hamper of Irish and Continental artisan cheeses, cured meats, crackers, and preserves. Serves 4–6 as a sharing board. Delivered chilled in insulated packaging.', tags: ['Cheese', 'Charcuterie', 'Hamper'], badge: 'Featured', shipping_options: ['tracked', 'express'] },
]

// ─── Types ────────────────────────────────────────────────────
interface Product {
  id: string
  title: string
  category_id: string
  product_type: 'digital' | 'physical' | string
  price: number
  currency: string
  seller_name: string
  seller_avatar?: string
  rating: number
  reviews: number
  sales: number
  description: string
  tags: string[]
  badge: string | null
  shipping_options: string[]
  condition?: string
  stock_qty?: number
}

// ─── Helper ────────────────────────────────────────────────────
function getGrad(str: string): string {
  const grads = [
    'linear-gradient(135deg,#38bdf8,#0284c7)',
    'linear-gradient(135deg,#a78bfa,#7c3aed)',
    'linear-gradient(135deg,#34d399,#059669)',
    'linear-gradient(135deg,#fb923c,#ea580c)',
    'linear-gradient(135deg,#f472b6,#db2777)',
    'linear-gradient(135deg,#fbbf24,#d97706)',
  ]
  return grads[(str.charCodeAt(0) + str.charCodeAt(1)) % grads.length]
}

function getCategoryIcon(catId: string): string {
  const all = [...DIGITAL_CATEGORIES, ...PHYSICAL_CATEGORIES]
  return all.find(c => c.id === catId)?.icon ?? '📦'
}

// ─── Main Component ───────────────────────────────────────────
function ProductsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS as Product[])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(MOCK_PRODUCTS.length)

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [activeType, setActiveType] = useState<'all' | 'digital' | 'physical'>(
    (searchParams.get('type') as 'digital' | 'physical') ?? 'all'
  )
  const [activeCat, setActiveCat] = useState(searchParams.get('cat') ?? 'all')
  const [priceRange, setPriceRange] = useState(0)
  const [sort, setSort] = useState('best')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const visibleDigital = activeType === 'physical' ? [] : DIGITAL_CATEGORIES
  const visiblePhysical = activeType === 'digital' ? [] : PHYSICAL_CATEGORIES

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from('listings')
        .select('*, seller:profiles!seller_id(full_name)', { count: 'exact' })
        .eq('status', 'active')
        .limit(48)

      if (activeType !== 'all') query = query.eq('product_type', activeType)
      if (activeCat !== 'all') query = query.eq('category_id', activeCat)
      if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

      const priceFilter = PRICE_RANGES[priceRange]
      if (priceFilter.min != null) query = query.gte('price', priceFilter.min)
      if (priceFilter.max != null) query = query.lte('price', priceFilter.max)

      if (sort === 'newest') query = query.order('created_at', { ascending: false })
      else if (sort === 'price_asc') query = query.order('price', { ascending: true })
      else if (sort === 'price_desc') query = query.order('price', { ascending: false })
      else query = query.order('created_at', { ascending: false })

      const { data, count } = await query

      if (data && data.length > 0) {
        const mapped: Product[] = data.map((l: Record<string, unknown>) => {
          const sellerObj = l.seller as { full_name?: string } | null
          const sellerName = sellerObj?.full_name ?? 'Unknown'
          return {
            id: l.id as string,
            title: l.title as string,
            category_id: (l.category_id as string) ?? 'digital-downloads',
            product_type: (l.product_type as string) ?? 'digital',
            price: Number(l.price),
            currency: (l.currency as string) ?? '£',
            seller_name: sellerName,
            rating: 4.8,
            reviews: 0,
            sales: 0,
            description: (l.description as string) ?? '',
            tags: (l.tags as string[]) ?? [],
            badge: null,
            shipping_options: (l.shipping_options as string[]) ?? [],
            condition: l.condition as string,
            stock_qty: l.stock_qty as number,
          }
        })
        setProducts(mapped)
        setTotal(count ?? mapped.length)
      } else {
        // Fallback to mock filtered
        let filtered = MOCK_PRODUCTS as Product[]
        if (activeType !== 'all') filtered = filtered.filter(p => p.product_type === activeType)
        if (activeCat !== 'all') filtered = filtered.filter(p => p.category_id === activeCat)
        if (search) filtered = filtered.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()))
        setProducts(filtered)
        setTotal(filtered.length)
      }
    } catch {
      // keep mock data
    } finally {
      setLoading(false)
    }
  }, [activeType, activeCat, search, priceRange, sort])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadProducts()
  }

  const handleCatSelect = (catId: string) => {
    setActiveCat(catId)
    setSidebarOpen(false)
  }

  const filteredByMock = (() => {
    if (loading) return products
    return products
  })()

  return (
    <div style={{ minHeight: 'calc(100vh - 104px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 104 }}>
      <style>{`
        .pm-layout { display: flex; max-width: 1280px; margin: 0 auto; padding: 1.5rem 1rem; gap: 1.5rem; }
        .pm-sidebar { width: 220px; flex-shrink: 0; }
        .pm-sidebar-sticky { position: sticky; top: 116px; }
        .pm-main { flex: 1; min-width: 0; }
        .pm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
        .pm-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.15s, transform 0.15s; cursor: pointer; }
        .pm-card:hover { border-color: rgba(56,189,248,0.3); transform: translateY(-2px); }
        .pm-cat-btn { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.45rem 0.65rem; background: transparent; border: none; border-radius: 7px; cursor: pointer; font-size: 0.82rem; color: #94a3b8; text-align: left; transition: background 0.12s, color 0.12s; }
        .pm-cat-btn:hover { background: rgba(56,189,248,0.07); color: #f1f5f9; }
        .pm-cat-btn.active { background: rgba(56,189,248,0.12); color: #38bdf8; font-weight: 600; }
        .pm-type-tab { padding: 0.45rem 1rem; border-radius: 999px; font-size: 0.82rem; font-weight: 500; cursor: pointer; border: 1px solid rgba(148,163,184,0.2); background: transparent; color: #94a3b8; transition: all 0.12s; }
        .pm-type-tab.active { background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.3); color: #38bdf8; }
        .pm-sidebar-toggle { display: none; }
        @media (max-width: 768px) {
          .pm-layout { padding: 1rem; gap: 0; flex-direction: column; }
          .pm-sidebar { display: none; width: 100%; }
          .pm-sidebar.open { display: block; margin-bottom: 1rem; }
          .pm-sidebar-sticky { position: static; }
          .pm-sidebar-toggle { display: block; }
          .pm-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem; }
        }
      `}</style>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', borderBottom: '1px solid rgba(56,189,248,0.08)', padding: '2rem 1.5rem 1.5rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, marginBottom: '0.3rem' }}>Product Marketplace</h1>
              <p style={{ color: '#64748b', fontSize: '0.92rem' }}>Discover digital downloads and physical products made by FreeTrust members</p>
            </div>
            <Link href="/seller/products/create" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#0f172a', fontWeight: 700, fontSize: '0.85rem', padding: '0.6rem 1.2rem', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              + Sell a Product
            </Link>
          </div>

          {/* Search + Sort */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products…"
              style={{ flex: 1, minWidth: 200, background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none' }}
            />
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.65rem 0.75rem', fontSize: '0.82rem', color: '#94a3b8', outline: 'none' }}
            >
              {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="submit" style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.65rem 1.2rem', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
              Search
            </button>
          </form>

          {/* Type tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {(['all', 'digital', 'physical'] as const).map(t => (
              <button key={t} className={`pm-type-tab${activeType === t ? ' active' : ''}`} onClick={() => { setActiveType(t); setActiveCat('all') }}>
                {t === 'all' ? '🛍️ All Products' : t === 'digital' ? '💾 Digital' : '📦 Physical'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pm-layout">
        {/* Sidebar toggle (mobile) */}
        <button className="pm-sidebar-toggle" onClick={() => setSidebarOpen(o => !o)} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.55rem 1rem', fontSize: '0.82rem', color: '#94a3b8', cursor: 'pointer', marginBottom: '0.75rem' }}>
          ☰ Categories {sidebarOpen ? '▲' : '▼'}
        </button>

        {/* Sidebar */}
        <aside className={`pm-sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="pm-sidebar-sticky">
            {/* Price filter */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.5rem' }}>Price Range</div>
              {PRICE_RANGES.map((r, i) => (
                <button key={i} className={`pm-cat-btn${priceRange === i ? ' active' : ''}`} onClick={() => setPriceRange(i)}>
                  {r.label}
                </button>
              ))}
            </div>

            {/* All */}
            <div style={{ marginBottom: '0.5rem' }}>
              <button className={`pm-cat-btn${activeCat === 'all' ? ' active' : ''}`} onClick={() => handleCatSelect('all')}>
                <span>🛍️</span> All Categories
              </button>
            </div>

            {/* Digital */}
            {visibleDigital.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', padding: '0.5rem 0.65rem 0.35rem', marginTop: '0.5rem' }}>Digital Products</div>
                {visibleDigital.map(c => (
                  <button key={c.id} className={`pm-cat-btn${activeCat === c.id ? ' active' : ''}`} onClick={() => handleCatSelect(c.id)}>
                    <span>{c.icon}</span> {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Physical */}
            {visiblePhysical.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', padding: '0.5rem 0.65rem 0.35rem', marginTop: '0.5rem' }}>Physical Products</div>
                {visiblePhysical.map(c => (
                  <button key={c.id} className={`pm-cat-btn${activeCat === c.id ? ' active' : ''}`} onClick={() => handleCatSelect(c.id)}>
                    <span>{c.icon}</span> {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="pm-main">
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.88rem', color: '#64748b' }}>
              {loading ? 'Loading…' : `${total} product${total !== 1 ? 's' : ''}`}
              {activeCat !== 'all' && (
                <button onClick={() => setActiveCat('all')} style={{ marginLeft: '0.6rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 999, padding: '0.1rem 0.55rem', fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer' }}>
                  ✕ Clear filter
                </button>
              )}
            </span>
          </div>

          {/* Grid */}
          <div className="pm-grid">
            {filteredByMock.map(p => {
              const initials = p.seller_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
              const catIcon = getCategoryIcon(p.category_id)
              const isDigital = p.product_type === 'digital'
              const hasInstant = p.shipping_options?.includes('download')
              return (
                <Link key={p.id} href={`/products/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div className="pm-card">
                    {/* Thumbnail */}
                    <div style={{ height: 130, background: 'linear-gradient(135deg,rgba(56,189,248,0.08),rgba(148,163,184,0.04))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8rem', position: 'relative' }}>
                      <span>{catIcon}</span>
                      {/* Badges */}
                      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ background: isDigital ? 'rgba(56,189,248,0.2)' : 'rgba(251,191,36,0.2)', color: isDigital ? '#38bdf8' : '#fbbf24', border: `1px solid ${isDigital ? 'rgba(56,189,248,0.3)' : 'rgba(251,191,36,0.3)'}`, borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.68rem', fontWeight: 700 }}>
                          {isDigital ? '💾 Digital' : '📦 Physical'}
                        </span>
                        {hasInstant && (
                          <span style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.68rem', fontWeight: 700 }}>
                            ⚡ Instant
                          </span>
                        )}
                      </div>
                      {p.badge && (
                        <span style={{ position: 'absolute', top: 8, right: 8, background: BADGE_COLORS[p.badge] ?? '#38bdf8', color: '#0f172a', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.7rem', fontWeight: 700 }}>
                          {p.badge}
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div style={{ padding: '0.9rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {/* Seller */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#64748b' }}>
                        {p.seller_avatar
                          ? <img src={p.seller_avatar} alt={p.seller_name} width={18} height={18} style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color: '#0f172a', background: getGrad(p.seller_name), flexShrink: 0 }}>{initials}</div>
                        }
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.seller_name}</span>
                      </div>

                      {/* Title */}
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.35 }}>{p.title}</div>

                      {/* Description */}
                      <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>{p.description}</p>

                      {/* Tags */}
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {p.tags.slice(0, 3).map(t => <span key={t} style={{ background: 'rgba(148,163,184,0.08)', borderRadius: 4, padding: '0.1rem 0.4rem', fontSize: '0.68rem', color: '#94a3b8' }}>{t}</span>)}
                      </div>

                      {/* Rating */}
                      {p.reviews > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ★ {p.rating} ({p.reviews}) · {p.sales.toLocaleString()} sales
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(56,189,248,0.06)', padding: '0.65rem 0.9rem' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8' }}>{p.currency}{p.price}</span>
                      <span style={{ background: '#38bdf8', borderRadius: 7, padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                        {isDigital ? 'Buy Now' : 'View'}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Empty state */}
          {!loading && filteredByMock.length === 0 && (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#94a3b8' }}>No products found</div>
              <p style={{ fontSize: '0.88rem' }}>Try adjusting your filters or search terms</p>
              <button onClick={() => { setActiveCat('all'); setSearch(''); setPriceRange(0) }} style={{ marginTop: '1rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.55rem 1.2rem', fontSize: '0.85rem', color: '#38bdf8', cursor: 'pointer' }}>
                Clear all filters
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading…</div>}>
      <ProductsInner />
    </Suspense>
  )
}
