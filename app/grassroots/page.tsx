'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import LocationFilter from '@/components/location/LocationFilter'
import LocationBadge from '@/components/location/LocationBadge'
import PriceDisplay from '@/components/currency/PriceDisplay'
import SocialLinks, { type SocialUrls } from '@/components/social/SocialLinks'
import CrossPromoBanner from '@/components/marketplace/CrossPromoBanner'
import CategoryOverlapBadge from '@/components/marketplace/CategoryOverlapBadge'
import { grassrootsToServicesLink } from '@/lib/marketplace/category-overlap'
import { EMPTY_LOCATION, type StructuredLocation, type RadiusValue } from '@/lib/geo'
import { buildCountryOptions } from '@/lib/countries'
import type { CurrencyCode } from '@/context/CurrencyContext'
import {
  GRASSROOTS_CATEGORIES,
  GRASSROOTS_CATEGORIES_BY_SLUG,
  AVAILABILITY_BY_VALUE,
  RATE_TYPE_OPTIONS,
  GRASSROOTS_GREEN,
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
}

type ListingTypeFilter = 'offering' | 'seeking'
type SortKey = 'nearest' | 'recent' | 'rate_low'

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function GrassrootsBrowsePage() {
  const [listings, setListings]   = useState<Listing[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [listingType, setListingType]       = useState<ListingTypeFilter>('offering')
  const [sort, setSort]                     = useState<SortKey>('nearest')

  // Deep-link support: if the user arrives via a CategoryOverlapBadge
  // from /services with ?category=<slug>, seed the activeCategory state
  // from the URL on first mount. We read from window.location rather
  // than useSearchParams() so we don't have to wrap this page in a
  // Suspense boundary just for one-shot query-param init.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const c = q.get('category')
    if (c && GRASSROOTS_CATEGORIES_BY_SLUG[c]) setActiveCategory(c)
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
      if (activeCategory) params.set('category', activeCategory)
      if (countryFilter)  params.set('country', countryFilter)
      if (filterLoc.latitude != null && filterLoc.longitude != null) {
        params.set('lat', String(filterLoc.latitude))
        params.set('lng', String(filterLoc.longitude))
        if (radiusKm > 0) params.set('radius_km', String(radiusKm))
      }
      const res = await fetch(`/api/grassroots?${params.toString()}`, { cache: 'no-store' })
      if (res.ok) {
        const { listings: data } = await res.json() as { listings: Listing[] }
        setListings(data ?? [])
      } else {
        setListings([])
      }
    } catch {
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [activeCategory, countryFilter, filterLoc, listingType, radiusKm])

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

  // Client-side sort (server already sorted by distance when geo is set)
  const sorted = useMemo(() => {
    const copy = [...listings]
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
  }, [listings, sort])

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', paddingTop: 64, paddingBottom: 80 }}>
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
                🌱 Local Work. Real People.
              </h1>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
                Local hands-on help — post a job or find work near you
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

          {/* Cross-promo: send users looking for packaged / online work
              to the Services marketplace. */}
          <CrossPromoBanner target="services" />

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

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1.25rem 3rem' }}>
        {/* ── Category grid ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: 10 }}>
            BROWSE BY CATEGORY
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
          }}>
            {/* "All" pseudo-category */}
            <button
              onClick={() => setActiveCategory(null)}
              style={{
                padding: '14px 10px',
                borderRadius: 12,
                border: `1.5px solid ${activeCategory === null ? GRASSROOTS_GREEN.border : 'rgba(148,163,184,0.15)'}`,
                background: activeCategory === null ? GRASSROOTS_GREEN.tint : '#1e293b',
                color: activeCategory === null ? GRASSROOTS_GREEN.primary : '#94a3b8',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: activeCategory === null ? 700 : 500,
                fontSize: 12,
                textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 22 }}>✨</span>
              <span>All</span>
            </button>
            {GRASSROOTS_CATEGORIES.map(cat => {
              const active = activeCategory === cat.slug
              // Cross-link shown on categories that also exist on /services
              // (e.g. Delivery, Childcare, Elder Care, Events, Trades…).
              // Rendered as a tiny clickable pill inside the category card;
              // clicks stopPropagation so they don't also toggle this
              // category filter.
              const crossLink = grassrootsToServicesLink(cat.slug)
              return (
                <button
                  key={cat.slug}
                  onClick={() => setActiveCategory(active ? null : cat.slug)}
                  style={{
                    padding: '14px 10px',
                    borderRadius: 12,
                    border: `1.5px solid ${active ? GRASSROOTS_GREEN.border : 'rgba(148,163,184,0.15)'}`,
                    background: active ? GRASSROOTS_GREEN.tint : '#1e293b',
                    color: active ? GRASSROOTS_GREEN.primary : '#94a3b8',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: active ? 700 : 500,
                    fontSize: 12,
                    textAlign: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'all 0.15s',
                    minHeight: crossLink ? 106 : 88,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                  <span style={{ lineHeight: 1.2 }}>{cat.label.split(' & ')[0]}</span>
                  {crossLink && (
                    <CategoryOverlapBadge link={crossLink} flavor="services" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Results header with sort ──────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8, marginBottom: '1rem',
        }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {loading
              ? 'Loading…'
              : sorted.length === 0
                ? 'Nothing posted here yet'
                : `${sorted.length} ${sorted.length === 1 ? 'listing' : 'listings'}`}
            {!loading && sorted.length > 0 && activeCategory && ` in ${GRASSROOTS_CATEGORIES_BY_SLUG[activeCategory]?.label}`}
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 12,
              color: '#94a3b8',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <option value="nearest">Nearest first</option>
            <option value="recent">Most recent</option>
            <option value="rate_low">Rate: low to high</option>
          </select>
        </div>

        {/* ── Listings grid ─────────────────────────────────────────────── */}
        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))',
            gap: 14,
          }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 14,
                height: 260,
                opacity: 0.5,
              }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          // Seed-state empty card. Renders instead of a bare "0 listings"
          // line so the first visitor to a category / region sees a
          // prominent, welcoming CTA rather than an empty page.
          <div style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            background: 'linear-gradient(180deg, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.02) 100%)',
            border: `1px dashed ${GRASSROOTS_GREEN.border}`,
            borderRadius: 16,
            maxWidth: 560,
            margin: '0 auto',
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>🌱</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f1f5f9', marginBottom: '0.5rem' }}>
              Be the first to post in your area
            </h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.92rem', lineHeight: 1.55, maxWidth: 420, margin: '0 auto 1.5rem' }}>
              {activeCategory || countryFilter || filterLoc.latitude != null
                ? 'No listings match your filters yet. Clear a filter or create the first one for this category — it only takes a minute.'
                : `Grassroots is brand-new and local to you. Post a ${listingType === 'offering' ? 'listing offering your skills' : 'listing to find local help'} — the community grows one listing at a time.`}
            </p>
            <Link href="/grassroots/new" style={{
              display: 'inline-block',
              background: `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}, ${GRASSROOTS_GREEN.primaryDim})`,
              color: '#0f172a',
              padding: '0.85rem 2rem',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: '0.95rem',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
            }}>
              + Post a Grassroots listing
            </Link>
            <div style={{ marginTop: 14, fontSize: 11, color: '#475569' }}>
              It&apos;s free. Takes under a minute. Local-first.
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))',
            gap: 14,
          }}>
            {sorted.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Listing card
// ────────────────────────────────────────────────────────────────────────────

function ListingCard({ listing: l }: { listing: Listing }) {
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

  return (
    <Link
      href={`/grassroots/${l.id}`}
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
            {l.rate != null && l.rate_type !== 'negotiable' ? (
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
            View →
          </span>
        </div>
      </div>
    </Link>
  )
}
