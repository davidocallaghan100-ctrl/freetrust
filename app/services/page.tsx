'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ONLINE_CATEGORIES, OFFLINE_CATEGORIES, LOCATION_RADII, LOCATION_SCOPE } from '@/lib/service-categories'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  id: number | string
  title: string
  provider: string
  avatar: string
  avatarImg?: string
  rating: number
  reviews: number
  price: number
  currency: string
  delivery: string
  tags: string[]
  category: string
  categoryId?: string
  desc: string
  trust: number
  badge: string | null
  mode: 'online' | 'offline' | 'both'
  location?: string | null
  distance?: number | null
  deliveryTypes?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'best',     label: 'Best Match' },
  { value: 'newest',   label: 'Newest' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating',   label: 'Top Rated' },
]

const MOCK_SERVICES: Service[] = [
  { id: 'm1', title: 'Brand Identity Design', provider: 'Sarah Chen', avatar: 'SC', avatarImg: 'https://i.pravatar.cc/150?img=47', rating: 4.9, reviews: 127, price: 450, currency: '€', delivery: '5 days', tags: ['Logo', 'Brand', 'Figma'], category: 'Design & Creative', categoryId: 'design-creative', desc: 'Complete brand identity including logo, colour palette, typography and brand guidelines.', trust: 98, badge: 'Top Rated', mode: 'online' },
  { id: 'm2', title: 'Full-Stack Web App Development', provider: 'Priya Nair', avatar: 'PN', avatarImg: 'https://i.pravatar.cc/150?img=44', rating: 5.0, reviews: 89, price: 2800, currency: '€', delivery: '21 days', tags: ['Next.js', 'Supabase', 'TypeScript'], category: 'Development & Tech', categoryId: 'development-tech', desc: 'End-to-end web application development using modern tech stack.', trust: 100, badge: 'Verified', mode: 'online' },
  { id: 'm3', title: 'SEO & Content Strategy', provider: 'Marcus Obi', avatar: 'MO', avatarImg: 'https://i.pravatar.cc/150?img=12', rating: 4.8, reviews: 64, price: 320, currency: '€', delivery: '7 days', tags: ['SEO', 'Content', 'Analytics'], category: 'SEO & Digital Marketing', categoryId: 'seo-digital', desc: 'Comprehensive SEO audit and content strategy to grow organic traffic 40%+ in 90 days.', trust: 94, badge: null, mode: 'online' },
  { id: 'm4', title: 'AI Automation Setup', provider: 'Tom Walsh', avatar: 'TW', avatarImg: 'https://i.pravatar.cc/150?img=53', rating: 4.7, reviews: 43, price: 380, currency: '€', delivery: '5 days', tags: ['Make', 'Zapier', 'GPT'], category: 'AI & Automation', categoryId: 'ai-automation', desc: 'Build automated workflows using Make, Zapier, and OpenAI integrations.', trust: 91, badge: null, mode: 'online' },
  { id: 'm5', title: 'Business Coaching — 4 Sessions', provider: 'Amara Diallo', avatar: 'AD', avatarImg: 'https://i.pravatar.cc/150?img=45', rating: 4.9, reviews: 38, price: 480, currency: '€', delivery: '1 day', tags: ['Startup', 'Strategy', 'Growth'], category: 'Coaching & Mentoring', categoryId: 'coaching-mentoring', desc: '4-session coaching package covering product-market fit, fundraising, and growth.', trust: 97, badge: 'Verified', mode: 'online' },
  { id: 'm6', title: 'Plumbing — Leaks & Repairs', provider: 'Dave Kelly', avatar: 'DK', avatarImg: 'https://i.pravatar.cc/150?img=15', rating: 4.8, reviews: 212, price: 85, currency: '€', delivery: 'Same day', tags: ['Emergency', 'Plumbing', 'Repairs'], category: 'Trades & Construction', categoryId: 'trades-construction', desc: 'Fast, reliable plumbing repairs. Leaks, blockages, boiler issues. Fully insured.', trust: 95, badge: 'Local Pro', mode: 'offline', location: 'Dublin 2', distance: 3 },
  { id: 'm7', title: 'Dog Walking — Daily Walks', provider: 'Ciara Murphy', avatar: 'CM', avatarImg: 'https://i.pravatar.cc/150?img=39', rating: 5.0, reviews: 87, price: 15, currency: '€', delivery: 'Daily', tags: ['Dogs', 'Walking', 'Local'], category: 'Pet Services', categoryId: 'pet-services', desc: 'Professional daily dog walks. GPS tracked, photo updates, local to D4.', trust: 99, badge: null, mode: 'offline', location: 'Dublin 4', distance: 5 },
  { id: 'm8', title: 'Private Chef — Dinner Parties', provider: 'Lucia Romano', avatar: 'LR', avatarImg: 'https://i.pravatar.cc/150?img=49', rating: 4.9, reviews: 56, price: 250, currency: '€', delivery: 'Same day', tags: ['Chef', 'Dining', 'Events'], category: 'Food & Catering', categoryId: 'food-catering', desc: 'Bespoke dinner party menus prepared in your home. Up to 12 guests.', trust: 96, badge: 'Top Rated', mode: 'offline', location: 'Dublin', distance: 8 },
]

function getGrad(str: string): string {
  const grads = [
    'linear-gradient(135deg,#38bdf8,#0284c7)',
    'linear-gradient(135deg,#a78bfa,#7c3aed)',
    'linear-gradient(135deg,#34d399,#059669)',
    'linear-gradient(135deg,#fb923c,#ea580c)',
    'linear-gradient(135deg,#f472b6,#db2777)',
    'linear-gradient(135deg,#fbbf24,#d97706)',
  ]
  return grads[(str.charCodeAt(0) + str.charCodeAt(1 > str.length - 1 ? 0 : 1)) % grads.length]
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ svc }: { svc: Service }) {
  return (
    <Link href={`/services/${svc.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'border-color 0.15s', height: '100%', boxSizing: 'border-box' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#38bdf8')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#334155')}
      >
        {/* Provider row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {svc.avatarImg
            ? <img src={svc.avatarImg} alt={svc.provider} width={32} height={32} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', color: '#0f172a', background: getGrad(svc.avatar), flexShrink: 0 }}>{svc.avatar}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.provider}</div>
            {svc.mode === 'offline' && svc.location && (
              <div style={{ fontSize: '10px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {svc.location}{svc.distance != null ? ` · ${svc.distance}km` : ''}</div>
            )}
          </div>
          {/* Mode + badge — right-aligned, shrinkable */}
          <div className="svc-card-badges">
            <span style={{ background: svc.mode === 'online' ? 'rgba(56,189,248,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${svc.mode === 'online' ? 'rgba(56,189,248,0.2)' : 'rgba(52,211,153,0.2)'}`, borderRadius: 999, padding: '2px 6px', fontSize: '9px', color: svc.mode === 'online' ? '#38bdf8' : '#34d399', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {svc.mode === 'online' ? '💻 Online' : '📍 Local'}
            </span>
            {svc.badge && <span style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '2px 6px', fontSize: '9px', color: '#38bdf8', fontWeight: 700, whiteSpace: 'nowrap' }}>{svc.badge}</span>}
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.35, wordBreak: 'break-word' }}>{svc.title}</div>

        {/* Description */}
        <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{svc.desc}</p>

        {/* Tags */}
        {svc.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {svc.tags.slice(0, 3).map(t => (
              <span key={t} style={{ background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '2px 7px', fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{t}</span>
            ))}
          </div>
        )}

        {/* Rating + delivery */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <span style={{ color: '#fbbf24' }}>★ {svc.rating.toFixed(1)}</span>
          <span style={{ color: '#475569' }}>({svc.reviews})</span>
          <span style={{ color: '#475569', marginLeft: 'auto', whiteSpace: 'nowrap' }}>⏱ {svc.delivery}</span>
        </div>

        {/* Trust bar */}
        <div style={{ fontSize: '11px', color: '#38bdf8' }}>
          Trust {svc.trust}%
          <div style={{ marginTop: '3px', height: 3, background: 'rgba(56,189,248,0.12)', borderRadius: 2 }}>
            <div style={{ width: `${svc.trust}%`, height: '100%', background: '#38bdf8', borderRadius: 2 }} />
          </div>
        </div>

        {/* Price + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '10px', marginTop: 'auto', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#38bdf8' }}>{svc.currency}{svc.price.toLocaleString()}</span>
            <span style={{ fontSize: '11px', color: '#475569' }}> / project</span>
          </div>
          <span style={{ background: '#38bdf8', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', flexShrink: 0 }}>View</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>(MOCK_SERVICES)
  const [search, setSearch]       = useState('')
  const [sort, setSort]           = useState('best')
  const [modeFilter, setModeFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [locationScope, setLocationScope] = useState<string>('')
  const [radiusKm, setRadiusKm]   = useState<number>(25)
  const [locationInput, setLocationInput] = useState('')
  const [showLocationPanel, setShowLocationPanel] = useState(false)
  const [priceMin, setPriceMin]   = useState('')
  const [priceMax, setPriceMax]   = useState('')
  const locationPanelRef = useRef<HTMLDivElement>(null)

  // Collapsible sidebar sections — persisted to localStorage
  const [onlineOpen, setOnlineOpen] = useState(true)
  const [offlineOpen, setOfflineOpen] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ft_sidebar_state')
      if (saved) {
        const { onlineOpen: o, offlineOpen: f } = JSON.parse(saved)
        if (typeof o === 'boolean') setOnlineOpen(o)
        if (typeof f === 'boolean') setOfflineOpen(f)
      }
    } catch { /* ignore */ }
  }, [])

  function toggleOnline() {
    const next = !onlineOpen
    setOnlineOpen(next)
    try { localStorage.setItem('ft_sidebar_state', JSON.stringify({ onlineOpen: next, offlineOpen })) } catch { /* ignore */ }
  }
  function toggleOffline() {
    const next = !offlineOpen
    setOfflineOpen(next)
    try { localStorage.setItem('ft_sidebar_state', JSON.stringify({ onlineOpen, offlineOpen: next })) } catch { /* ignore */ }
  }

  // Load real Supabase data
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from('services')
          .select('*, seller:profiles!seller_id(full_name, avatar_url)')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(50)
        if (data && data.length > 0) {
          const mapped: Service[] = data.map((s: Record<string, unknown>) => {
            const seller = s.seller as { full_name?: string } | null
            const name = seller?.full_name ?? 'Unknown'
            const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
            return {
              id: s.id as string,
              title: s.title as string,
              provider: name,
              avatar: initials,
              rating: 4.8,
              reviews: 0,
              price: Number(s.price ?? 0),
              currency: '€',
              delivery: (s.delivery_time as string) ?? '7 days',
              tags: (s.tags as string[]) ?? [],
              category: (s.category as string) ?? '',
              categoryId: (s.category_id as string) ?? undefined,
              desc: (s.description as string) ?? '',
              trust: 90,
              badge: null,
              mode: ((s.service_mode as string) ?? 'online') as 'online' | 'offline' | 'both',
              location: (s.location as string) ?? null,
              distance: null,
            }
          })
          setServices(mapped)
        }
      } catch { /* keep mock */ }
    })()
  }, [])

  // Close location panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationPanelRef.current && !locationPanelRef.current.contains(e.target as Node)) {
        setShowLocationPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filter & sort
  const allOnlineCats = ONLINE_CATEGORIES
  const allOfflineCats = OFFLINE_CATEGORIES
  const visibleCats = modeFilter === 'online' ? allOnlineCats : modeFilter === 'offline' ? allOfflineCats : [...allOnlineCats, ...allOfflineCats]

  const filtered = services
    .filter(s => {
      if (modeFilter !== 'all' && s.mode !== modeFilter && s.mode !== 'both') return false
      if (activeCatId && s.categoryId !== activeCatId) return false
      if (search && !s.title.toLowerCase().includes(search.toLowerCase()) && !s.desc.toLowerCase().includes(search.toLowerCase()) && !s.category.toLowerCase().includes(search.toLowerCase())) return false
      if (priceMin && s.price < Number(priceMin)) return false
      if (priceMax && s.price > Number(priceMax)) return false
      if (locationScope === 'local' && s.mode !== 'offline') return false
      if (locationScope === 'remote' && s.mode !== 'online') return false
      return true
    })
    .sort((a, b) => {
      if (sort === 'price_asc') return a.price - b.price
      if (sort === 'price_desc') return b.price - a.price
      if (sort === 'rating') return b.rating - a.rating
      return 0
    })

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        .svc-layout { max-width: 1200px; margin: 0 auto; padding: 20px 16px 80px; display: grid; grid-template-columns: 240px 1fr; gap: 24px; align-items: start; }
        .svc-sidebar { position: sticky; top: 110px; }
        .svc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
        .svc-controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .svc-controls-row2 { display: none; }
        @media (max-width: 768px) {
          .svc-layout { grid-template-columns: 1fr; padding: 12px 10px 80px; gap: 12px; }
          .svc-sidebar { position: static; }
          .svc-grid { grid-template-columns: 1fr; gap: 10px; }
          .svc-controls { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
          .svc-controls::-webkit-scrollbar { display: none; }
          .svc-controls > * { flex-shrink: 0; }
          .svc-price-inputs { display: none !important; }
          .svc-sort { display: none !important; }
          .svc-controls-row2 { display: flex; gap: 6px; margin-top: 8px; }
        }
        .svc-card-badges { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; max-width: 120px; }
        @media (max-width: 480px) {
          .svc-card-badges { max-width: 90px; }
        }
        .cat-btn:hover { background: rgba(56,189,248,0.06) !important; }
        .svc-sidebar-mobile-toggle { display: none; }
        @media (max-width: 768px) { .svc-sidebar-mobile-toggle { display: flex; } }
      `}</style>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.06) 0%,transparent 100%)', padding: '28px 16px 20px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 4px' }}>Services Marketplace</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>Online, local & global services from trusted FreeTrust members</p>

          {/* Search + controls row */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ flex: '1 1 280px', minWidth: '220px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search services…"
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '10px 14px 10px 36px', fontSize: '14px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = '#38bdf8')}
                onBlur={e => (e.target.style.borderColor = '#334155')}
              />
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '4px', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '3px' }}>
              {([['all','🌐 All'], ['online','💻 Online'], ['offline','📍 Local']] as [string, string][]).map(([val, lbl]) => (
                <button key={val} onClick={() => { setModeFilter(val as 'all'|'online'|'offline'); setActiveCatId(null) }}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: modeFilter === val ? 700 : 400, fontFamily: 'inherit', background: modeFilter === val ? '#38bdf8' : 'transparent', color: modeFilter === val ? '#0f172a' : '#64748b', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* Location filter */}
            <div ref={locationPanelRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowLocationPanel(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: locationScope ? '#38bdf8' : '#1e293b', border: `1px solid ${locationScope ? '#38bdf8' : '#334155'}`, borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: locationScope ? '#0f172a' : '#94a3b8', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                📍 {locationScope ? LOCATION_SCOPE.find(l => l.value === locationScope)?.label : 'Location'} ▾
              </button>
              {showLocationPanel && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px', width: '260px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Scope</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {LOCATION_SCOPE.map(s => (
                      <button key={s.value} onClick={() => setLocationScope(locationScope === s.value ? '' : s.value)}
                        style={{ padding: '5px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', fontWeight: locationScope === s.value ? 700 : 400, background: locationScope === s.value ? '#38bdf8' : 'rgba(56,189,248,0.07)', color: locationScope === s.value ? '#0f172a' : '#94a3b8', transition: 'all 0.15s' }}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                  {locationScope === 'local' && (
                    <>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Radius</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {LOCATION_RADII.map(r => (
                          <button key={r.value} onClick={() => setRadiusKm(r.value)}
                            style={{ padding: '5px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', fontWeight: radiusKm === r.value ? 700 : 400, background: radiusKm === r.value ? '#38bdf8' : 'rgba(56,189,248,0.07)', color: radiusKm === r.value ? '#0f172a' : '#94a3b8', transition: 'all 0.15s' }}>
                            {r.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Your Location</div>
                      <input value={locationInput} onChange={e => setLocationInput(e.target.value)} placeholder="City, postcode…"
                        style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Price filter */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="€ min" type="number" min="0"
                style={{ width: '70px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '9px 8px', fontSize: '12px', color: '#f1f5f9', outline: 'none', textAlign: 'center' }} />
              <span style={{ color: '#475569', fontSize: '12px' }}>–</span>
              <input value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="€ max" type="number" min="0"
                style={{ width: '70px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '9px 8px', fontSize: '12px', color: '#f1f5f9', outline: 'none', textAlign: 'center' }} />
            </div>

            {/* Sort */}
            <select value={sort} onChange={e => setSort(e.target.value)}
              style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '9px 12px', fontSize: '12px', color: '#94a3b8', outline: 'none', cursor: 'pointer' }}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="svc-layout">
        {/* Sidebar */}
        <aside className="svc-sidebar">
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', overflow: 'hidden' }}>
            <button className="cat-btn" onClick={() => setActiveCatId(null)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', background: activeCatId === null ? 'rgba(56,189,248,0.1)' : 'transparent', border: 'none', borderLeft: activeCatId === null ? '3px solid #38bdf8' : '3px solid transparent', color: activeCatId === null ? '#38bdf8' : '#94a3b8', fontSize: '13px', fontWeight: activeCatId === null ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
              <span>✦ All Services</span>
              <span style={{ fontSize: '11px', color: '#475569' }}>{filtered.length}</span>
            </button>

            {/* Online section */}
            {(modeFilter === 'all' || modeFilter === 'online') && (
              <>
                <button
                  onClick={toggleOnline}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 14px', background: '#0f172a', border: 'none', borderTop: '1px solid #334155', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>💻 Online Services</span>
                  <span style={{ fontSize: '13px', color: '#475569', transition: 'transform 0.2s', display: 'inline-block', transform: onlineOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
                </button>
                {onlineOpen && ONLINE_CATEGORIES.map(cat => {
                  const count = services.filter(s => s.categoryId === cat.id).length
                  return (
                    <button key={cat.id} className="cat-btn" onClick={() => setActiveCatId(activeCatId === cat.id ? null : cat.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 14px 8px 18px', background: activeCatId === cat.id ? 'rgba(56,189,248,0.1)' : 'transparent', border: 'none', borderLeft: activeCatId === cat.id ? '3px solid #38bdf8' : '3px solid transparent', color: activeCatId === cat.id ? '#38bdf8' : '#94a3b8', fontSize: '12px', fontWeight: activeCatId === cat.id ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>{cat.icon}</span>{cat.label}</span>
                      {count > 0 && <span style={{ fontSize: '10px', color: '#475569' }}>{count}</span>}
                    </button>
                  )
                })}
              </>
            )}

            {/* Offline section */}
            {(modeFilter === 'all' || modeFilter === 'offline') && (
              <>
                <button
                  onClick={toggleOffline}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 14px', background: '#0f172a', border: 'none', borderTop: '1px solid #334155', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>📍 Local Services</span>
                  <span style={{ fontSize: '13px', color: '#475569', transition: 'transform 0.2s', display: 'inline-block', transform: offlineOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
                </button>
                {offlineOpen && OFFLINE_CATEGORIES.map(cat => {
                  const count = services.filter(s => s.categoryId === cat.id).length
                  return (
                    <button key={cat.id} className="cat-btn" onClick={() => setActiveCatId(activeCatId === cat.id ? null : cat.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 14px 8px 18px', background: activeCatId === cat.id ? 'rgba(52,211,153,0.1)' : 'transparent', border: 'none', borderLeft: activeCatId === cat.id ? '3px solid #34d399' : '3px solid transparent', color: activeCatId === cat.id ? '#34d399' : '#94a3b8', fontSize: '12px', fontWeight: activeCatId === cat.id ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>{cat.icon}</span>{cat.label}</span>
                      {count > 0 && <span style={{ fontSize: '10px', color: '#475569' }}>{count}</span>}
                    </button>
                  )
                })}
              </>
            )}
          </div>

          {/* Post a service CTA */}
          <Link href="/seller/gigs/create" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px', padding: '12px', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>
            ➕ List Your Service
          </Link>
        </aside>

        {/* Results */}
        <div>
          {/* Active filter summary */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {filtered.length} service{filtered.length !== 1 ? 's' : ''}
              {activeCatId && ` in ${visibleCats.find(c => c.id === activeCatId)?.label}`}
              {locationScope && ` · ${LOCATION_SCOPE.find(l => l.value === locationScope)?.label}`}
              {locationScope === 'local' && locationInput && ` near ${locationInput}`}
            </div>
            {(activeCatId || locationScope || priceMin || priceMax || search) && (
              <button onClick={() => { setActiveCatId(null); setLocationScope(''); setPriceMin(''); setPriceMax(''); setSearch('') }}
                style={{ background: 'none', border: '1px solid #334155', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕ Clear filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>😕</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>No services found</div>
              <div style={{ fontSize: '13px' }}>Try adjusting your filters or search term</div>
            </div>
          ) : (
            <div className="svc-grid">
              {filtered.map(svc => <ServiceCard key={svc.id} svc={svc} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
