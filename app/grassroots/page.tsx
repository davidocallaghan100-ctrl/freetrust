'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LocationFilter from '@/components/location/LocationFilter'
import LocationBadge from '@/components/location/LocationBadge'
import PriceDisplay from '@/components/currency/PriceDisplay'
import SocialLinks, { type SocialUrls } from '@/components/social/SocialLinks'
import { EMPTY_LOCATION, haversineKm, type StructuredLocation, type RadiusValue } from '@/lib/geo'
import { buildCountryOptions } from '@/lib/countries'
import type { CurrencyCode } from '@/context/CurrencyContext'
import {
  GRASSROOTS_VISIBLE_CATEGORIES,
  GRASSROOTS_CATEGORIES_BY_SLUG,
  GRASSROOTS_SERVICE_SOURCE_CATEGORY_IDS,
  AVAILABILITY_BY_VALUE,
  RATE_TYPE_OPTIONS,
  GRASSROOTS_GREEN,
  grassrootsCategoriesForServiceSource,
  normalizeGrassrootsCategorySlug,
} from '@/lib/grassroots/categories'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface Poster {
  id?: string
  full_name?: string | null
  avatar_url?: string | null
  linkedin_url?:  string | null
  instagram_url?: string | null
  twitter_url?:   string | null
  github_url?:    string | null
  tiktok_url?:    string | null
  youtube_url?:   string | null
  website_url?:   string | null
}

interface Listing {
  id: string
  created_at: string
  title: string
  description: string | null
  category: string
  listing_type: 'offering' | 'seeking'
  rate: number | null
  rate_type: 'hourly' | 'daily' | 'fixed' | 'negotiable' | null
  currency_code: string
  rate_eur: number | null
  availability: 'immediate' | 'this_week' | 'this_month' | 'flexible'
  photos: string[]
  country: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  location_label: string | null
  trust_tokens_accepted: boolean
  status: string
  distance_km?: number | null
  poster?: Poster | null
  source?: 'grassroots' | 'service' | 'external_service'
  href?: string
  external_service_id?: string | null
  price_display?: string | null
  rating?: number | null
  review_count?: number | null
}

type ListingTypeFilter = 'offering' | 'seeking'
type SortKey = 'nearest' | 'recent' | 'rate_low'

const GRASSROOTS_INITIAL_DISPLAY = 12
const GRASSROOTS_LOAD_MORE_BATCH = 12
const GRASSROOTS_SERVICE_SOURCE_CATEGORY_SET = new Set<string>(GRASSROOTS_SERVICE_SOURCE_CATEGORY_IDS)

function normaliseServiceSourceCategoryId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return GRASSROOTS_SERVICE_SOURCE_CATEGORY_SET.has(value) ? value : null
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function mapServiceRowToGrassroots(row: Record<string, unknown>): Listing[] {
  const sourceCategory = normaliseServiceSourceCategoryId(row.category_id)
  if (!sourceCategory) return []
  const categories = grassrootsCategoriesForServiceSource(sourceCategory, [
    row.title,
    row.description,
    row.category,
    row.category_id,
    (row.seller as Poster | null | undefined)?.full_name,
  ].filter(Boolean).join(' '))
  if (categories.length === 0) return []
  const seller = row.seller as Poster | null | undefined
  const id = String(row.id ?? '')
  const title = String(row.title ?? '').trim()
  if (!id || !title) return []
  const cover = typeof row.cover_image === 'string' && row.cover_image ? row.cover_image : null
  const price = toNumberOrNull(row.price)
  const currency = String(row.currency_code ?? row.currency ?? 'EUR').toUpperCase()
  return categories.map(category => ({
    id: `service-${category}-${id}`,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    title,
    description: typeof row.description === 'string' ? row.description : null,
    category,
    listing_type: 'offering',
    rate: price,
    rate_type: price != null ? 'fixed' : 'negotiable',
    currency_code: currency,
    rate_eur: toNumberOrNull(row.price_eur) ?? (currency === 'EUR' ? price : null),
    availability: 'flexible',
    photos: cover ? [cover] : [],
    country: typeof row.country === 'string' ? row.country.toUpperCase() : null,
    city: typeof row.city === 'string' ? row.city : null,
    latitude: toNumberOrNull(row.latitude),
    longitude: toNumberOrNull(row.longitude),
    location_label: typeof row.location_label === 'string' ? row.location_label : (typeof row.location === 'string' ? row.location : null),
    trust_tokens_accepted: false,
    status: 'active',
    poster: seller ?? null,
    source: 'service',
    href: `/services/${encodeURIComponent(id)}`,
    rating: toNumberOrNull(row.avg_rating),
    review_count: toNumberOrNull(row.review_count),
  }))
}

function mapExternalServiceRowToGrassroots(row: Record<string, unknown>): Listing[] {
  const sourceCategory = normaliseServiceSourceCategoryId(row.freetrust_category_id ?? row.category)
  if (!sourceCategory) return []
  const categories = grassrootsCategoriesForServiceSource(sourceCategory, [
    row.title,
    row.provider_name,
    row.description,
    row.category,
    row.freetrust_category_id,
  ].filter(Boolean).join(' '))
  if (categories.length === 0) return []
  const id = String(row.id ?? '')
  const title = String(row.title ?? '').trim()
  const providerName = String(row.provider_name ?? 'External Provider').trim()
  const providerUrl = String(row.provider_url ?? '').trim()
  const awinDeeplink = typeof row.awin_deeplink === 'string' && row.awin_deeplink ? row.awin_deeplink : null
  if (!id || !title || !providerUrl) return []
  const thumbnail = typeof row.thumbnail === 'string' && row.thumbnail ? row.thumbnail : null
  return categories.map(category => ({
    id: `external-service-${category}-${id}`,
    created_at: new Date(0).toISOString(),
    title,
    description: typeof row.description === 'string' ? row.description : null,
    category,
    listing_type: 'offering',
    rate: null,
    rate_type: 'negotiable',
    currency_code: 'EUR',
    rate_eur: null,
    availability: 'flexible',
    photos: thumbnail ? [thumbnail] : [],
    country: typeof row.country === 'string' ? row.country.toUpperCase() : null,
    city: typeof row.city === 'string' ? row.city : null,
    latitude: toNumberOrNull(row.latitude),
    longitude: toNumberOrNull(row.longitude),
    location_label: typeof row.location_label === 'string' ? row.location_label : (typeof row.location === 'string' ? row.location : null),
    trust_tokens_accepted: false,
    status: 'active',
    poster: { full_name: providerName, website_url: providerUrl },
    source: 'external_service',
    href: awinDeeplink ?? providerUrl,
    external_service_id: id,
    price_display: typeof row.price_display === 'string' ? row.price_display : null,
    rating: toNumberOrNull(row.rating),
    review_count: toNumberOrNull(row.review_count),
  }))
}

function applyGrassrootsBrowseFilters(
  rows: Listing[],
  countryFilter: string | null,
  filterLoc: StructuredLocation,
  radiusKm: RadiusValue
): Listing[] {
  const country = countryFilter?.toUpperCase() ?? null
  return rows
    .map(row => {
      if (
        filterLoc.latitude != null && filterLoc.longitude != null &&
        row.latitude != null && row.longitude != null
      ) {
        return {
          ...row,
          distance_km: haversineKm(
            { latitude: filterLoc.latitude, longitude: filterLoc.longitude },
            { latitude: row.latitude, longitude: row.longitude }
          ),
        }
      }
      return row
    })
    .filter(row => {
      if (country && row.country !== country) return false
      if (radiusKm > 0 && filterLoc.latitude != null && filterLoc.longitude != null) {
        if (row.distance_km == null || row.distance_km > radiusKm) return false
      }
      return true
    })
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function GrassrootsBrowsePage() {
  const [listings, setListings]   = useState<Listing[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [listingType, setListingType]       = useState<ListingTypeFilter>('offering')
  const [sort, setSort]                     = useState<SortKey>('nearest')
  const [search, setSearch]                 = useState('')
  const [displayLimit, setDisplayLimit]     = useState(GRASSROOTS_INITIAL_DISPLAY)

  // Generic deep-link support for direct /grassroots?category=<slug> and
  // /grassroots?listing_type=<offering|seeking> URLs. We read from
  // window.location rather than useSearchParams() so we don't need a
  // Suspense boundary just for one-shot query-param init.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const c = q.get('category')
    if (c && GRASSROOTS_CATEGORIES_BY_SLUG[c]) setActiveCategory(normalizeGrassrootsCategorySlug(c))
    const lt = q.get('listing_type')
    if (lt === 'offering' || lt === 'seeking') setListingType(lt)
  }, [])
  // Location filter state
  const [filterLoc, setFilterLoc]           = useState<StructuredLocation>(EMPTY_LOCATION)
  const [radiusKm, setRadiusKm]             = useState<RadiusValue>(25)
  const [countryFilter, setCountryFilter]   = useState<string | null>(null)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('listing_type', listingType)
      if (countryFilter)  params.set('country', countryFilter)
      if (filterLoc.latitude != null && filterLoc.longitude != null) {
        params.set('lat', String(filterLoc.latitude))
        params.set('lng', String(filterLoc.longitude))
        if (radiusKm > 0) params.set('radius_km', String(radiusKm))
      }
      const realGrassrootsPromise = fetch(`/api/grassroots?${params.toString()}`, { cache: 'no-store' })
        .then(async res => {
          if (!res.ok) return [] as Listing[]
          const { listings: data } = await res.json() as { listings: Listing[] }
          return (data ?? []).map(row => ({
            ...row,
            category: normalizeGrassrootsCategorySlug(row.category) ?? row.category,
            source: 'grassroots' as const,
            href: `/grassroots/${row.id}`,
          }))
        })

      if (listingType === 'seeking') {
        setListings(await realGrassrootsPromise)
        return
      }

      const supabase = createClient()
      const servicesPromise = fetch('/api/services/marketplace', { cache: 'no-store' })
        .then(async res => {
          if (!res.ok) return [] as Listing[]
          const payload = await res.json().catch(() => null) as { services?: Record<string, unknown>[] } | null
          return (payload?.services ?? []).flatMap(mapServiceRowToGrassroots)
        })

      const externalPromise = (async () => {
        const rows: Record<string, unknown>[] = []
        const pageSize = 1000
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from('external_service_listings')
            .select('id, title, provider_name, provider_url, description, category, freetrust_category_id, service_type, price_display, rating, review_count, location, country, city, latitude, longitude, location_label, thumbnail, source, awin_merchant_id, awin_deeplink, is_awin, click_count, lead_count')
            .in('freetrust_category_id', [...GRASSROOTS_SERVICE_SOURCE_CATEGORY_IDS])
            .order('is_awin', { ascending: false })
            .order('click_count', { ascending: false })
            .order('last_refreshed_at', { ascending: false })
            .range(from, from + pageSize - 1)

          if (error) throw error
          rows.push(...((data ?? []) as Record<string, unknown>[]))
          if (!data || data.length < pageSize) break
        }
        return rows.flatMap(mapExternalServiceRowToGrassroots)
      })()

      const [realGrassroots, communityServices, externalServices] = await Promise.all([
        realGrassrootsPromise,
        servicesPromise,
        externalPromise,
      ])

      const serviceRows = applyGrassrootsBrowseFilters(
        [...communityServices, ...externalServices],
        countryFilter,
        filterLoc,
        radiusKm
      )
      setListings([...realGrassroots, ...serviceRows])
    } catch {
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [countryFilter, filterLoc, listingType, radiusKm])

  useEffect(() => { void fetchListings() }, [fetchListings])

  // Country options merged with the global ISO list
  const countryOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of listings) {
      if (!l.country) continue
      counts.set(l.country, (counts.get(l.country) ?? 0) + 1)
    }
    return buildCountryOptions(counts)
  }, [listings])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of listings) {
      if (!l.category) continue
      counts.set(l.category, (counts.get(l.category) ?? 0) + 1)
    }
    return counts
  }, [listings])

  const visibleCategories = useMemo(() => {
    // Always keep the full Grassroots catalogue visible so users can browse
    // or post into the trade/property categories even when a category has no
    // currently matching rows under the active filters.
    return GRASSROOTS_VISIBLE_CATEGORIES
  }, [])

  const sortedVisibleCategories = useMemo(
    () => [...visibleCategories].sort((a, b) => a.label.localeCompare(b.label)),
    [visibleCategories]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return listings.filter(l => {
      if (activeCategory && l.category !== activeCategory) return false
      if (!q) return true
      const cat = GRASSROOTS_CATEGORIES_BY_SLUG[l.category]
      return [
        l.title,
        l.description,
        l.city,
        l.country,
        l.location_label,
        cat?.label,
        l.poster?.full_name,
      ].some(v => (v ?? '').toLowerCase().includes(q))
    })
  }, [activeCategory, listings, search])

  // Client-side sort (server already sorted by distance when geo is set)
  const sorted = useMemo(() => {
    const copy = [...filtered]
    if (sort === 'recent') {
      return copy.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    }
    if (sort === 'rate_low') {
      return copy.sort((a, b) => {
        const ar = a.rate_eur ?? a.rate ?? Number.MAX_VALUE
        const br = b.rate_eur ?? b.rate ?? Number.MAX_VALUE
        return ar - br
      })
    }
    // 'nearest' is the server default
    return copy
  }, [filtered, sort])

  useEffect(() => {
    setDisplayLimit(GRASSROOTS_INITIAL_DISPLAY)
  }, [activeCategory, countryFilter, filterLoc.latitude, filterLoc.longitude, listingType, radiusKm, search, sort])

  useEffect(() => {
    const onScroll = () => {
      const remaining = document.documentElement.scrollHeight - window.innerHeight - window.scrollY
      if (remaining <= 900) {
        setDisplayLimit(prev => Math.min(sorted.length, prev + GRASSROOTS_LOAD_MORE_BATCH))
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sorted.length])

  const visibleListings = useMemo(() => sorted.slice(0, displayLimit), [displayLimit, sorted])
  const hasMoreListings = displayLimit < sorted.length

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', paddingTop: 64, paddingBottom: 80 }}>
      <style>{`
        .grassroots-layout { max-width: 1200px; margin: 0 auto; padding: 20px 16px 80px; display: grid; grid-template-columns: 240px 1fr; gap: 24px; align-items: start; }
        .grassroots-sidebar { position: sticky; top: 110px; }
        .grassroots-category-scroll { max-height: calc(100vh - 180px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(34,197,94,0.45) rgba(15,23,42,0.35); }
        .grassroots-mobile-categories { display: none; }
        .grassroots-results { min-width: 0; }
        .grassroots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
        .grassroots-cat-btn:hover { background: rgba(34,197,94,0.06) !important; }
        @media (max-width: 768px) {
          .grassroots-layout { grid-template-columns: 1fr; padding: 12px 10px 80px; gap: 12px; }
          .grassroots-sidebar { display: none; }
          .grassroots-mobile-categories { display: flex; gap: 8px; width: 100%; max-width: 100%; min-width: 0; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 2px 0 10px; margin: 2px 0 8px; border-bottom: 1px solid rgba(51,65,85,0.7); box-sizing: border-box; }
          .grassroots-mobile-categories::-webkit-scrollbar { display: none; }
          .grassroots-grid { grid-template-columns: 1fr; gap: 10px; }
        }
      `}</style>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.02) 100%)',
        borderBottom: '1px solid rgba(34,197,94,0.18)',
        padding: '2.2rem 1.25rem 1.8rem',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', fontWeight: 900, margin: '0 0 0.3rem', letterSpacing: '-0.5px' }}>
                🌱 Grassroots
              </h1>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
                Local hands-on work, casual help, and everyday community services
              </p>
            </div>
            <Link href="/grassroots/new" style={{
              background: `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}, ${GRASSROOTS_GREEN.primaryDim})`,
              color: '#0f172a',
              padding: '0.7rem 1.4rem',
              borderRadius: 10,
              fontSize: '0.9rem',
              fontWeight: 800,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
            }}>
              + Post Work
            </Link>
          </div>

          {/* Offering / Seeking toggle */}
          <div style={{
            display: 'inline-flex',
            background: '#1e293b',
            border: `1px solid ${GRASSROOTS_GREEN.borderSoft}`,
            borderRadius: 12,
            padding: 4,
            marginBottom: '1rem',
          }}>
            {(['offering', 'seeking'] as ListingTypeFilter[]).map(t => {
              const active = listingType === t
              return (
                <button
                  key={t}
                  onClick={() => setListingType(t)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    background: active ? GRASSROOTS_GREEN.primary : 'transparent',
                    color: active ? '#0f172a' : '#94a3b8',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t === 'offering' ? '💪 Offering work' : '🔍 Seeking work'}
                </button>
              )
            })}
          </div>

          {/* Location filter */}
          <div>
            <LocationFilter
              location={filterLoc}
              onLocationChange={setFilterLoc}
              radiusKm={radiusKm}
              onRadiusChange={setRadiusKm}
              country={countryFilter}
              onCountryChange={setCountryFilter}
              countryOptions={countryOptions}
            />
          </div>
        </div>
      </div>

      <div className="grassroots-layout">
        {/* Sidebar — mirrors /services category navigation so Grassroots can
            scale beyond a flat card grid. The list itself scrolls, and once
            real listings exist it only shows categories available under the
            current type/location filters. */}
        <aside className="grassroots-sidebar">
          <div className="grassroots-category-scroll" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, overflowX: 'hidden' }}>
            <button
              className="grassroots-cat-btn"
              onClick={() => setActiveCategory(null)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                padding: '10px 14px', background: activeCategory === null ? GRASSROOTS_GREEN.tint : 'transparent',
                border: 'none', borderLeft: activeCategory === null ? `3px solid ${GRASSROOTS_GREEN.primary}` : '3px solid transparent',
                color: activeCategory === null ? GRASSROOTS_GREEN.primary : '#94a3b8', fontSize: 13,
                fontWeight: activeCategory === null ? 800 : 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span>✦ All Grassroots</span>
              <span style={{ fontSize: 11, color: '#475569' }}>{listings.length}</span>
            </button>
            <button
              type="button"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                padding: '9px 14px', background: '#0f172a', border: 'none', borderTop: '1px solid #334155',
                fontFamily: 'inherit', cursor: 'default',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>🌱 Available Categories A–Z</span>
              <span style={{ fontSize: 10, color: '#475569', fontWeight: 800 }}>{sortedVisibleCategories.length}</span>
            </button>
            {sortedVisibleCategories.map(cat => {
              const active = activeCategory === cat.slug
              const count = categoryCounts.get(cat.slug) ?? 0
              return (
                <button
                  key={cat.slug}
                  className="grassroots-cat-btn"
                  onClick={() => setActiveCategory(active ? null : cat.slug)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                    padding: '8px 14px 8px 18px', background: active ? GRASSROOTS_GREEN.tint : 'transparent',
                    border: 'none', borderLeft: active ? `3px solid ${GRASSROOTS_GREEN.primary}` : '3px solid transparent',
                    color: active ? GRASSROOTS_GREEN.primary : '#94a3b8', fontSize: 12,
                    fontWeight: active ? 800 : 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </span>
                  {count > 0 && <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>{count}</span>}
                </button>
              )
            })}
          </div>

          <Link href="/grassroots/new" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: 12, background: `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}, ${GRASSROOTS_GREEN.primaryDim})`, borderRadius: 12, color: '#0f172a', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
            ➕ Post Grassroots Work
          </Link>
        </aside>

        {/* Results */}
        <div className="grassroots-results">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ flex: '1 1 280px', minWidth: 220, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Grassroots listings…"
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px 10px 36px', fontSize: 16, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            <select
              aria-label="All Grassroots categories"
              value={activeCategory ?? ''}
              onChange={e => setActiveCategory(e.target.value || null)}
              style={{
                flex: '1 1 220px', minWidth: 210, background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
                padding: '9px 12px', fontSize: 16, color: activeCategory ? GRASSROOTS_GREEN.primary : '#94a3b8',
                fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700,
              }}
            >
              <option value="">🌱 All Grassroots categories</option>
              {sortedVisibleCategories.map(cat => {
                const count = categoryCounts.get(cat.slug) ?? 0
                return (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.emoji} {cat.label}{count > 0 ? ` (${count})` : ''}
                  </option>
                )
              })}
            </select>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              style={{
                background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
                padding: '9px 12px', fontSize: 16, color: '#94a3b8', fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              <option value="nearest">Nearest first</option>
              <option value="recent">Most recent</option>
              <option value="rate_low">Rate: low to high</option>
            </select>
          </div>

          <div className="grassroots-mobile-categories" aria-label="Grassroots categories A to Z">
            <button
              onClick={() => setActiveCategory(null)}
              style={{
                padding: '9px 16px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                border: activeCategory === null ? `2px solid ${GRASSROOTS_GREEN.primary}` : '2px solid #334155',
                background: activeCategory === null ? GRASSROOTS_GREEN.tint : '#111827',
                color: activeCategory === null ? GRASSROOTS_GREEN.primary : '#94a3b8',
                cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', minHeight: 44,
              }}
            >
              ✦ All Grassroots <span style={{ color: '#64748b', marginLeft: 4 }}>{listings.length}</span>
            </button>
            {sortedVisibleCategories.map(cat => {
              const active = activeCategory === cat.slug
              const count = categoryCounts.get(cat.slug) ?? 0
              return (
                <button
                  key={cat.slug}
                  onClick={() => setActiveCategory(active ? null : cat.slug)}
                  style={{
                    padding: '9px 16px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                    border: active ? `2px solid ${GRASSROOTS_GREEN.primary}` : '2px solid #334155',
                    background: active ? GRASSROOTS_GREEN.tint : '#111827',
                    color: active ? GRASSROOTS_GREEN.primary : '#94a3b8',
                    cursor: 'pointer', fontWeight: active ? 800 : 700, fontSize: 13, fontFamily: 'inherit', minHeight: 44,
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                  }}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  {count > 0 && <span style={{ color: '#64748b', fontSize: 11 }}>{count}</span>}
                </button>
              )
            })}
          </div>

          {/* ── Results header with active filters ─────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: '1rem' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {loading
                ? 'Loading…'
                : sorted.length === 0
                  ? 'Nothing posted here yet'
                  : `${sorted.length} ${sorted.length === 1 ? 'listing' : 'listings'}`}
              {!loading && sorted.length > 0 && activeCategory && ` in ${GRASSROOTS_CATEGORIES_BY_SLUG[activeCategory]?.label}`}
              {!loading && sorted.length > 0 && filterLoc.location_label && ` · near ${filterLoc.location_label}`}
              {!loading && sorted.length > 0 && countryFilter && ` · ${countryFilter}`}
            </div>
            {(activeCategory || countryFilter || filterLoc.latitude != null || search) && (
              <button
                onClick={() => {
                  setActiveCategory(null)
                  setCountryFilter(null)
                  setFilterLoc(EMPTY_LOCATION)
                  setRadiusKm(25)
                  setSearch('')
                }}
                style={{ background: 'none', border: '1px solid #334155', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ✕ Clear filters
              </button>
            )}
          </div>

          {/* ── Listings grid ───────────────────────────────────────────── */}
          {loading ? (
            <div className="grassroots-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, height: 260, opacity: 0.5 }} />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '3rem 1.5rem',
              background: 'linear-gradient(180deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.025) 100%)',
              border: `1px dashed ${GRASSROOTS_GREEN.border}`, borderRadius: 18, maxWidth: 620, margin: '0 auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 74, height: 74, borderRadius: '50%', background: GRASSROOTS_GREEN.tint, border: `1px solid ${GRASSROOTS_GREEN.border}`, fontSize: '2.6rem', marginBottom: '0.9rem' }}>🌱</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: '#0f172a', border: '1px solid #334155', color: '#64748b', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                No matches yet
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#f1f5f9', margin: '0 0 0.55rem' }}>
                {activeCategory || countryFilter || filterLoc.latitude != null || search
                  ? 'No Grassroots listings match these filters yet'
                  : listingType === 'seeking' ? 'No requests posted yet' : 'No matches loaded yet'}
              </h2>
              <p style={{ color: '#94a3b8', marginBottom: '1.4rem', fontSize: '0.93rem', lineHeight: 1.6, maxWidth: 470, margin: '0 auto 1.4rem' }}>
                {activeCategory || countryFilter || filterLoc.latitude != null || search
                  ? 'Clear a filter or post the first Grassroots listing for this category.'
                  : listingType === 'seeking'
                    ? 'Switch to Offering work to browse available local services, or post the first request for help.'
                    : 'Try refreshing or changing the filters to load available local services.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/grassroots/new" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, background: `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}, ${GRASSROOTS_GREEN.primaryDim})`,
                  color: '#0f172a', padding: '0.8rem 1.35rem', borderRadius: 10, fontWeight: 900, fontSize: '0.95rem', textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
                }}>
                  + Post Grassroots work
                </Link>
                {(activeCategory || countryFilter || filterLoc.latitude != null || search) && (
                  <button
                    onClick={() => {
                      setActiveCategory(null)
                      setCountryFilter(null)
                      setFilterLoc(EMPTY_LOCATION)
                      setRadiusKm(25)
                      setSearch('')
                    }}
                    style={{ minHeight: 44, padding: '0.8rem 1.2rem', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#94a3b8', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: '#475569' }}>
                Showing real FreeTrust listings and providers only.
              </div>
            </div>
          ) : (
            <>
              <div className="grassroots-grid">
                {visibleListings.map(l => <ListingCard key={l.id} listing={l} />)}
              </div>
              {hasMoreListings && (
                <div style={{ textAlign: 'center', marginTop: 24, color: '#64748b', fontSize: 13, padding: '12px 0' }}>
                  Loading more Grassroots listings…
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Listing card
// ────────────────────────────────────────────────────────────────────────────

function ListingCard({ listing: l }: { listing: Listing }) {
  const router = useRouter()
  const cat = GRASSROOTS_CATEGORIES_BY_SLUG[l.category]
  const avail = AVAILABILITY_BY_VALUE[l.availability]
  const rateLabel = RATE_TYPE_OPTIONS.find(r => r.value === l.rate_type)?.suffix ?? ''
  const cover = l.photos?.[0] ?? null
  const posterSocial: SocialUrls | undefined = l.poster ? {
    linkedin_url:  l.poster.linkedin_url  ?? null,
    instagram_url: l.poster.instagram_url ?? null,
    twitter_url:   l.poster.twitter_url   ?? null,
    github_url:    l.poster.github_url    ?? null,
    tiktok_url:    l.poster.tiktok_url    ?? null,
    youtube_url:   l.poster.youtube_url   ?? null,
    website_url:   l.poster.website_url   ?? null,
  } : undefined
  const name = l.poster?.full_name ?? 'FreeTrust member'
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const href = l.href ?? `/grassroots/${l.id}`
  const isExternalHref = href.startsWith('http://') || href.startsWith('https://')
  const sourceLabel = l.source === 'service' ? 'FreeTrust Service' : l.source === 'external_service' ? 'Provider' : null

  async function handleCardClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (l.source === 'grassroots' || !l.source) return
    event.preventDefault()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const redirectPath = l.source === 'external_service' ? '/services' : href
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`)
      return
    }
    if (l.source === 'external_service') {
      window.open(href, '_blank', 'noopener,noreferrer')
      void recordExternalClick()
      return
    }
    router.push(href)
  }

  async function recordExternalClick() {
    if (!l.external_service_id) return
    try {
      await fetch('/api/external-services/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: l.external_service_id }),
      })
    } catch {
      // Non-blocking: the provider link should still open.
    }
  }

  return (
    <Link
      href={href}
      target={isExternalHref ? '_blank' : undefined}
      rel={isExternalHref ? 'noopener noreferrer' : undefined}
      onClick={handleCardClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#1e293b',
        border: `1px solid ${l.trust_tokens_accepted ? 'rgba(56,189,248,0.22)' : 'rgba(148,163,184,0.12)'}`,
        borderRadius: 14,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = GRASSROOTS_GREEN.border
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = l.trust_tokens_accepted ? 'rgba(56,189,248,0.22)' : 'rgba(148,163,184,0.12)'
        e.currentTarget.style.transform = ''
      }}
    >
      {/* Photo / gradient header */}
      <div style={{
        position: 'relative',
        height: 140,
        background: cover ? '#0b1120' : `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}33, ${GRASSROOTS_GREEN.primaryDim}66)`,
        flexShrink: 0,
      }}>
        {cover && (
          <img
            src={cover}
            alt={l.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {sourceLabel && (
          <span style={{
            position: 'absolute', bottom: 10, right: 10,
            background: 'rgba(15,23,42,0.88)',
            border: '1px solid rgba(148,163,184,0.24)',
            color: '#cbd5e1',
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: 10,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {sourceLabel}
          </span>
        )}
        {/* Category badge top-left */}
        {cat && (
          <span style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(15,23,42,0.88)',
            border: `1px solid ${GRASSROOTS_GREEN.border}`,
            color: GRASSROOTS_GREEN.primary,
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 700,
          }}>
            {cat.emoji} {cat.label.split(' & ')[0]}
          </span>
        )}
        {/* Availability badge top-right */}
        {avail && (
          <span style={{
            position: 'absolute', top: 10, right: 10,
            background: avail.bg,
            border: `1px solid ${avail.border}`,
            color: avail.color,
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 700,
          }}>
            {avail.label}
          </span>
        )}
        {/* Trust token badge bottom-left */}
        {l.trust_tokens_accepted && (
          <span style={{
            position: 'absolute', bottom: 10, left: 10,
            background: 'rgba(15,23,42,0.88)',
            border: '1px solid rgba(56,189,248,0.35)',
            color: '#38bdf8',
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 800,
          }} title="Accepts FreeTrust Trust tokens">
            ₮ Accepted
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3 }}>
          {l.title}
        </div>
        {l.description && (
          <p style={{
            fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {l.description}
          </p>
        )}

        {/* Location badge */}
        {(l.location_label || l.distance_km != null) && (
          <div>
            <LocationBadge
              label={l.location_label ?? l.city ?? null}
              distanceKm={l.distance_km ?? null}
              compact
            />
          </div>
        )}

        {/* Poster row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingTop: 8,
          borderTop: '1px solid rgba(148,163,184,0.1)',
        }}>
          {l.poster?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={l.poster.avatar_url}
              alt={name}
              style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}, ${GRASSROOTS_GREEN.primaryDim})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: '#0f172a',
              flexShrink: 0,
            }}>
              {initials || '?'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
          {posterSocial && (
            <SocialLinks links={posterSocial} size="sm" max={2} flat stopPropagation />
          )}
        </div>

        {/* Rate footer
            When the listing accepts ₮ Trust tokens, we promote the "Pay
            with ₮" affordance directly under the numeric rate so it
            reads as a primary payment method rather than an afterthought
            tucked in the card corner. The old ₮ chip on the photo
            stays too — it's still useful as a scannability signal when
            the cards are dense. */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 'auto', paddingTop: 8,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            {l.price_display ? (
              <span style={{ fontSize: 13, fontWeight: 800, color: GRASSROOTS_GREEN.primary }}>
                {l.price_display}
              </span>
            ) : l.rate != null && l.rate_type !== 'negotiable' ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <PriceDisplay
                  amountEur={l.rate_eur ?? l.rate}
                  sourceCode={(l.currency_code || 'EUR') as CurrencyCode}
                  sourceAmount={l.rate}
                  size="md"
                  layout="stacked"
                />
                {rateLabel && (
                  <span style={{ fontSize: 11, color: '#475569' }}>{rateLabel}</span>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: GRASSROOTS_GREEN.primary }}>
                {l.rate_type === 'negotiable' ? '💬 Negotiable' : 'Ask for rate'}
              </span>
            )}
            {l.trust_tokens_accepted && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#38bdf8',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}>
                <span style={{ fontSize: 12 }}>₮</span> Pay with Trust
              </span>
            )}
          </div>
          <span style={{
            background: 'transparent',
            border: `1px solid ${GRASSROOTS_GREEN.border}`,
            borderRadius: 7,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: GRASSROOTS_GREEN.primary,
          }}>
            {l.source === 'external_service' ? 'Visit →' : 'View →'}
          </span>
        </div>
      </div>
    </Link>
  )
}
