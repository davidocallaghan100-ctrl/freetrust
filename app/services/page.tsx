'use client'
import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ONLINE_CATEGORIES, OFFLINE_CATEGORIES, ALL_CATEGORIES as ALL_SERVICE_CATEGORIES, findServiceCategoryByLabel } from '@/lib/service-categories'
import LocationFilter from '@/components/location/LocationFilter'
import LocationBadge from '@/components/location/LocationBadge'
import PriceDisplay from '@/components/currency/PriceDisplay'
import SocialLinks from '@/components/social/SocialLinks'
import { EMPTY_LOCATION, haversineKm, type StructuredLocation, type RadiusValue } from '@/lib/geo'
import { buildCountryOptions } from '@/lib/countries'
import type { CurrencyCode } from '@/context/CurrencyContext'
import {
  SERVICE_CATEGORIES as EXTERNAL_REFRESH_CATEGORIES,
  SERVICES_INITIAL_DISPLAY,
  SERVICES_LOAD_MORE_BATCH,
} from '@/lib/externalServiceCategories'

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteModal({ title, onConfirm, onCancel, deleting }: {
  title: string; onConfirm: () => void; onCancel: () => void; deleting: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: 14, padding: '1.5rem', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>Delete service?</div>
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

interface Service {
  id: number | string
  title: string
  provider: string
  providerId?: string | null
  avatar: string
  avatarImg?: string
  coverImage?: string | null
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
  // Globalisation fields
  country?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  location_label?: string | null
  is_remote?: boolean
  price_eur?: number | null
  distance_km?: number | null
  // Seller social links — passed straight through to <SocialLinks>
  sellerSocial?: {
    linkedin_url?:  string | null
    instagram_url?: string | null
    twitter_url?:   string | null
    github_url?:    string | null
    tiktok_url?:    string | null
    youtube_url?:   string | null
    website_url?:   string | null
  }
}

interface ExternalService {
  id: string
  title: string
  provider_name: string
  provider_url: string
  description: string | null
  category: string
  source_category: string | null
  service_type: 'local' | 'remote' | 'both'
  price_display: string | null
  rating: number | null
  review_count: number | null
  location: string | null
  thumbnail: string | null
  country?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  location_label?: string | null
  source: 'serpapi' | 'awin'
  awin_merchant_id: string | null
  awin_deeplink: string | null
  is_awin: boolean
  click_count: number
  lead_count: number
}

type ServiceListEntry =
  | { _type: 'community'; item: Service }
  | { _type: 'external'; item: ExternalService }

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'best',     label: 'Best Match' },
  { value: 'newest',   label: 'Newest' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating',   label: 'Top Rated' },
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

function modeFromExternalServiceType(type: ExternalService['service_type']): Service['mode'] {
  if (type === 'remote') return 'online'
  if (type === 'local') return 'offline'
  return 'both'
}

function categoryMetaForExternalService(categoryId: string) {
  return ALL_SERVICE_CATEGORIES.find(c => c.id === categoryId)
    ?? EXTERNAL_REFRESH_CATEGORIES.find(c => c.id === categoryId)
}

function faviconForProviderUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    if (!hostname) return null
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`
  } catch {
    return null
  }
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({
  svc,
  isOwner,
  onDelete,
  onOpen,
  onOpenProfile,
}: {
  svc: Service
  isOwner?: boolean
  onDelete?: (id: string | number, title: string) => void
  onOpen: (id: string | number) => void
  onOpenProfile: (providerId: string) => void
}) {
  return (
    <div style={{ position: 'relative' }}>
    <Link
      href={`/services/${svc.id}`}
      onClick={e => { e.preventDefault(); onOpen(svc.id) }}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0', transition: 'border-color 0.15s', height: '100%', boxSizing: 'border-box' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#38bdf8')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#334155')}
      >
        {/* Cover image */}
        {svc.coverImage && (
          <div style={{ height: 120, overflow: 'hidden', flexShrink: 0 }}>
            <img src={svc.coverImage} alt={svc.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {/* Provider row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {svc.providerId
            ? <Link href={`/profile?id=${svc.providerId}`} onClick={e => { e.preventDefault(); e.stopPropagation(); if (svc.providerId) onOpenProfile(svc.providerId) }} style={{ flexShrink: 0, display: 'block' }}>
                {svc.avatarImg
                  ? <img src={svc.avatarImg} alt={svc.provider} width={32} height={32} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', color: '#0f172a', background: getGrad(svc.avatar) }}>{svc.avatar}</div>
                }
              </Link>
            : svc.avatarImg
              ? <img src={svc.avatarImg} alt={svc.provider} width={32} height={32} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', color: '#0f172a', background: getGrad(svc.avatar), flexShrink: 0 }}>{svc.avatar}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            {svc.providerId
              ? <Link href={`/profile?id=${svc.providerId}`} onClick={e => { e.preventDefault(); e.stopPropagation(); if (svc.providerId) onOpenProfile(svc.providerId) }} style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none' }}>{svc.provider}</Link>
              : <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.provider}</div>
            }
            {(svc.is_remote || svc.location_label || svc.location) && (
              <div style={{ marginTop: 2 }}>
                <LocationBadge
                  label={svc.location_label ?? svc.location ?? null}
                  remote={Boolean(svc.is_remote)}
                  distanceKm={svc.distance_km ?? null}
                  compact
                />
              </div>
            )}
            {svc.sellerSocial && (
              <div style={{ marginTop: 4 }}>
                <SocialLinks
                  links={svc.sellerSocial}
                  size="sm"
                  max={3}
                  flat
                  stopPropagation
                />
              </div>
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
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <PriceDisplay
              amountEur={(svc.price_eur && svc.price_eur > 0) ? svc.price_eur : svc.price}
              sourceCode={(svc.currency || 'EUR') as CurrencyCode}
              sourceAmount={svc.price}
              size="md"
              layout="stacked"
            />
            <span style={{ fontSize: '11px', color: '#475569' }}>/ project</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ background: '#38bdf8', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', flexShrink: 0 }}>View</span>
            {isOwner && onDelete && (
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(svc.id, svc.title) }}
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '7px 10px', fontSize: '12px', color: '#ef4444', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
                🗑
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </Link>
    </div>
  )
}

function ExternalServiceCard({
  item,
  onVisit,
  onEnquire,
}: {
  item: ExternalService
  onVisit: (item: ExternalService) => void
  onEnquire: (item: ExternalService) => void
}) {
  const category = categoryMetaForExternalService(item.category)
  const categoryLabel = category?.label ?? item.category.replace(/-/g, ' ')
  const serviceTypeLabel = item.service_type === 'remote'
    ? '💻 Remote'
      : item.service_type === 'local'
        ? '🏠 Local'
        : '💻 Remote & Local'
  const imageUrl = item.thumbnail || faviconForProviderUrl(item.provider_url)

  return (
    <div style={{
      background: '#111827',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #1e293b',
      position: 'relative',
      minHeight: 330,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', height: 132, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
        {imageUrl ? (
          <img src={imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: item.is_awin || !item.thumbnail ? 'contain' : 'cover', background: '#ffffff', display: 'block', padding: item.is_awin || !item.thumbnail ? 22 : 0, boxSizing: 'border-box' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#0f172a,#1e293b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00c2cb', fontSize: '2rem', fontWeight: 900 }}>
            {category?.icon ?? '🛠️'}
          </div>
        )}
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{
        position: 'absolute', top: '12px', left: '12px',
        background: item.is_awin ? 'rgba(30,58,95,0.92)' : 'rgba(30,41,59,0.92)',
        color: item.is_awin ? '#60a5fa' : '#9ca3af',
        fontSize: '10px', fontWeight: 700,
        padding: '3px 8px', borderRadius: '6px',
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {item.is_awin ? '⭐ Awin Partner' : '🌐 External Provider'}
      </div>

      <div style={{
        position: 'absolute', top: '12px', right: '12px',
        background: 'rgba(17,24,39,0.92)', color: '#cbd5e1',
        fontSize: '10px', padding: '3px 8px', borderRadius: '6px',
        border: '1px solid #1e293b', textTransform: 'capitalize',
        maxWidth: '42%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={categoryLabel}>
        {category?.icon} {categoryLabel}
      </div>

      <p style={{
        color: '#00c2cb', fontSize: '12px',
        fontWeight: 600, margin: '0 0 6px 0',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={item.provider_name}>
        {item.provider_name}
      </p>

      <p style={{
        color: '#ffffff', fontSize: '15px',
        fontWeight: 700, margin: '0 0 8px 0', lineHeight: '1.4',
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      } as React.CSSProperties}>
        {item.title}
      </p>

      {item.description && (
        <p style={{
          color: '#94a3b8', fontSize: '13px',
          margin: '0 0 10px 0', lineHeight: '1.5',
          display: '-webkit-box', WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        } as React.CSSProperties}>
          {item.description}
        </p>
      )}

      <p style={{ color: '#475569', fontSize: '12px', margin: '0 0 6px 0' }}>
        📍 {item.location || 'Worldwide'} · {serviceTypeLabel}
      </p>

      {item.price_display && (
        <p style={{ color: '#cbd5e1', fontSize: '12px', margin: '0 0 6px 0', fontWeight: 700 }}>
          {item.price_display}
        </p>
      )}

      {item.rating && (
        <p style={{ color: '#fbbf24', fontSize: '12px', margin: '0 0 12px 0' }}>
          {'★'.repeat(Math.max(1, Math.min(5, Math.round(item.rating))))} {item.rating}
          {item.review_count ? ` (${item.review_count.toLocaleString()})` : ''}
        </p>
      )}

      <p style={{ color: '#374151', fontSize: '11px', margin: 'auto 0 12px 0' }}>
        ⚠ Not Trust Coin eligible
      </p>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onVisit(item)}
          style={{
            flex: 1, padding: '10px', minHeight: 40,
            background: item.is_awin ? '#1e3a5f' : 'transparent',
            border: `1px solid ${item.is_awin ? '#3b82f6' : '#00c2cb'}`,
            color: item.is_awin ? '#60a5fa' : '#00c2cb',
            borderRadius: '8px', fontWeight: 600,
            fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {item.is_awin ? 'Visit Partner →' : 'View Provider →'}
        </button>
        <button
          onClick={() => onEnquire(item)}
          style={{
            flex: 1, padding: '10px', minHeight: 40,
            background: '#00c2cb', color: '#000',
            border: 'none', borderRadius: '8px',
            fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Enquire
        </button>
      </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [search, setSearch]       = useState('')
  const [sort, setSort]           = useState('best')
  const [modeFilter, setModeFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [priceMin, setPriceMin]   = useState('')
  const [priceMax, setPriceMax]   = useState('')
  // Globalisation — structured location filter state
  const [filterLoc, setFilterLoc]       = useState<StructuredLocation>(EMPTY_LOCATION)
  const [searchRadiusKm, setSearchRadiusKm] = useState<RadiusValue>(0)
  const [countryFilter, setCountryFilter]   = useState<string | null>(null)
  const [filterRemote, setFilterRemote]     = useState(false)
  const [userId, setUserId]       = useState<string | null>(null)
  const [isAdmin, setIsAdmin]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string | number; title: string } | null>(null)
  const [deleting, setDeleting]   = useState(false)
  const [loadingServices, setLoadingServices] = useState(true)
  const [servicesError, setServicesError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'freetrust' | 'external'>('freetrust')
  const [externalServices, setExternalServices] = useState<ExternalService[]>([])
  const [loadingExternalServices, setLoadingExternalServices] = useState(true)
  const [externalServicesError, setExternalServicesError] = useState<string | null>(null)
  const [externalCategory, setExternalCategory] = useState('all')
  const [externalSearch, setExternalSearch] = useState('')
  const [externalDisplayLimit, setExternalDisplayLimit] = useState(SERVICES_INITIAL_DISPLAY)
  const [serviceDisplayLimit, setServiceDisplayLimit] = useState(SERVICES_INITIAL_DISPLAY)
  const [selectedService, setSelectedService] = useState<ExternalService | null>(null)
  const [showEnquiryModal, setShowEnquiryModal] = useState(false)
  const [enquiryMessage, setEnquiryMessage] = useState('')
  const [enquiryLoading, setEnquiryLoading] = useState(false)

  // Collapsible sidebar sections — persisted to localStorage
  const [onlineOpen, setOnlineOpen] = useState(true)
  const [offlineOpen, setOfflineOpen] = useState(true)

  useEffect(() => {
    setExternalDisplayLimit(SERVICES_INITIAL_DISPLAY)
  }, [activeTab, externalCategory, externalSearch])

  useEffect(() => {
    setServiceDisplayLimit(SERVICES_INITIAL_DISPLAY)
  }, [modeFilter, activeCatId, search, priceMin, priceMax, sort, countryFilter, filterRemote, searchRadiusKm, filterLoc.latitude, filterLoc.longitude])

  // ── Success toast ──────────────────────────────────────────────────
  // Fires when the user arrives from /seller/gigs/create?published=true.
  // Uses the same inline toast pattern as app/articles/new/page.tsx and
  // components/profile/ProfilePage.tsx — no external library.
  const [toast, setToast] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    if (q.get('published') !== 'true') return
    // Fire the toast and clear the query param so a refresh doesn't
    // re-trigger it. router.replace preserves scroll + history state
    // better than window.history.replaceState in a Next.js app.
    setToast('🎉 Gig published! It\u2019s now live on Services.')
    router.replace('/services', { scroll: false })
    const timer = setTimeout(() => setToast(''), 4500)
    return () => clearTimeout(timer)
  }, [router])

  // Generic deep-link support for direct /services?category=<id> URLs.
  // Read via window.location to avoid needing a new Suspense boundary for
  // useSearchParams().
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const c = q.get('category')
    if (!c) return
    const found = [...ONLINE_CATEGORIES, ...OFFLINE_CATEGORIES].some(cat => cat.id === c)
    if (found) setActiveCatId(c)
  }, [])

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

  // Load current user
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

  async function handleDelete(id: string | number, title: string) {
    setDeleteTarget({ id, title })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/listings/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setServices(prev => prev.filter(s => String(s.id) !== String(deleteTarget.id)))
        setDeleteTarget(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  // Load real marketplace data from a same-origin no-store API route.
  // This avoids iOS/PWA stale client-side Supabase states and makes the
  // Services Marketplace rehydrate from production data on every visit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingServices(true)
        setServicesError(null)
        const res = await fetch('/api/services/marketplace', { cache: 'no-store' })
        const payload = await res.json().catch(() => null) as { services?: Record<string, unknown>[]; error?: string } | null
        if (!res.ok) throw new Error(payload?.error ?? `Services request failed (${res.status})`)
        const data = payload?.services ?? []
        if (!cancelled) {
          const mapped: Service[] = data.map((s: Record<string, unknown>) => {
            const seller = s.seller as {
              id?: string
              full_name?: string
              avatar_url?: string
              linkedin_url?: string | null
              instagram_url?: string | null
              twitter_url?: string | null
              github_url?: string | null
              tiktok_url?: string | null
              youtube_url?: string | null
              website_url?: string | null
            } | null
            const name = seller?.full_name ?? 'Unknown'
            const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
            const mode = (s.service_mode as string) ?? 'online'
            const categoryLabel = typeof s.category === 'string' ? s.category : ''
            const categoryInfo = (typeof s.category_id === 'string' && s.category_id)
              ? [...ONLINE_CATEGORIES, ...OFFLINE_CATEGORIES].find(cat => cat.id === s.category_id)
              : findServiceCategoryByLabel(categoryLabel)
            return {
              id: s.id as string,
              title: s.title as string,
              provider: name,
              providerId: seller?.id ?? null,
              avatar: initials,
              avatarImg: seller?.avatar_url ?? undefined,
              coverImage: (s.cover_image as string | null) ?? null,
              reviews: Number(s.review_count ?? 0),
              rating: Number(s.review_count ?? 0) > 0 ? Number(s.avg_rating ?? 5) : 5,
              price: Number(s.price ?? 0),
              currency: String(s.currency_code ?? s.currency ?? 'EUR'),
              delivery: mode === 'online' ? 'Online' : 'In-person',
              tags: Array.isArray(s.tags) ? (s.tags as string[]) : [],
              category: categoryInfo?.label ?? categoryLabel,
              categoryId: categoryInfo?.id,
              desc: (s.description as string) ?? '',
              trust: 90,
              badge: Number(s.review_count ?? 0) > 50 ? 'Top Rated' : null,
              mode: mode as 'online' | 'offline' | 'both',
              location: (s.location as string) ?? (s.location_label as string) ?? null,
              distance: null,
              // Globalisation fields
              country:        (s.country as string | null | undefined) ?? null,
              city:           (s.city as string | null | undefined) ?? null,
              latitude:       typeof s.latitude  === 'number' ? (s.latitude as number)  : null,
              longitude:      typeof s.longitude === 'number' ? (s.longitude as number) : null,
              location_label: (s.location_label as string | null | undefined) ?? null,
              is_remote:      Boolean(s.is_remote),
              price_eur:      typeof s.price_eur === 'number' ? (s.price_eur as number) : null,
              sellerSocial: seller ? {
                linkedin_url:  seller.linkedin_url  ?? null,
                instagram_url: seller.instagram_url ?? null,
                twitter_url:   seller.twitter_url   ?? null,
                github_url:    seller.github_url    ?? null,
                tiktok_url:    seller.tiktok_url    ?? null,
                youtube_url:   seller.youtube_url   ?? null,
                website_url:   seller.website_url   ?? null,
              } : undefined,
            }
          })
          setServices(mapped)
        }
      } catch (err) {
        console.error('[services page]', err)
        if (!cancelled) setServicesError(err instanceof Error ? err.message : 'Could not load services')
      } finally {
        if (!cancelled) setLoadingServices(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      try {
        setLoadingExternalServices(true)
        setExternalServicesError(null)
        const { data, error } = await supabase
          .from('external_service_listings')
          .select('id, title, provider_name, provider_url, description, category, freetrust_category_id, service_type, price_display, rating, review_count, location, country, city, latitude, longitude, location_label, thumbnail, source, awin_merchant_id, awin_deeplink, is_awin, click_count, lead_count')
          .order('is_awin', { ascending: false })
          .order('click_count', { ascending: false })
          .order('last_refreshed_at', { ascending: false })
          .limit(2500)

        if (error) throw error

        if (!cancelled) {
          setExternalServices((data ?? []).map((row: Record<string, unknown>) => ({
            id: String(row.id),
            title: String(row.title ?? ''),
            provider_name: String(row.provider_name ?? 'External Provider'),
            provider_url: String(row.provider_url ?? ''),
            description: row.description ? String(row.description) : null,
            category: String(row.freetrust_category_id ?? row.category ?? 'business-consulting'),
            source_category: row.category ? String(row.category) : null,
            service_type: (['local', 'remote', 'both'].includes(String(row.service_type)) ? String(row.service_type) : 'both') as 'local' | 'remote' | 'both',
            price_display: row.price_display ? String(row.price_display) : null,
            rating: row.rating != null && Number.isFinite(Number(row.rating)) ? Number(row.rating) : null,
            review_count: row.review_count != null && Number.isFinite(Number(row.review_count)) ? Number(row.review_count) : null,
            location: row.location ? String(row.location) : null,
            thumbnail: row.thumbnail ? String(row.thumbnail) : null,
            country: row.country ? String(row.country) : null,
            city: row.city ? String(row.city) : null,
            latitude: row.latitude != null && Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
            longitude: row.longitude != null && Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
            location_label: row.location_label ? String(row.location_label) : null,
            source: (row.source === 'awin' ? 'awin' : 'serpapi') as 'awin' | 'serpapi',
            awin_merchant_id: row.awin_merchant_id ? String(row.awin_merchant_id) : null,
            awin_deeplink: row.awin_deeplink ? String(row.awin_deeplink) : null,
            is_awin: Boolean(row.is_awin),
            click_count: Number(row.click_count ?? 0),
            lead_count: Number(row.lead_count ?? 0),
          })).filter(item => item.title && item.provider_url))
        }
      } catch (err) {
        console.error('[external services page]', err)
        if (!cancelled) setExternalServicesError(err instanceof Error ? err.message : 'Could not load external services')
      } finally {
        if (!cancelled) setLoadingExternalServices(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Filter & sort
  const allOnlineCats = ONLINE_CATEGORIES
  const allOfflineCats = OFFLINE_CATEGORIES
  const sortedOnlineCats = useMemo(() => [...allOnlineCats].sort((a, b) => a.label.localeCompare(b.label)), [allOnlineCats])
  const sortedOfflineCats = useMemo(() => [...allOfflineCats].sort((a, b) => a.label.localeCompare(b.label)), [allOfflineCats])
  const mobileCategoryCats = useMemo(() => {
    const online = sortedOnlineCats.map(cat => ({ ...cat, serviceKind: 'online' as const }))
    const local = sortedOfflineCats.map(cat => ({ ...cat, serviceKind: 'local' as const }))
    if (modeFilter === 'online') return online
    if (modeFilter === 'offline') return local
    return [...online, ...local].sort((a, b) => a.label.localeCompare(b.label))
  }, [modeFilter, sortedOfflineCats, sortedOnlineCats])
  const visibleCats = modeFilter === 'online' ? sortedOnlineCats : modeFilter === 'offline' ? sortedOfflineCats : [...sortedOnlineCats, ...sortedOfflineCats]

  // Country options merged with the global ISO 3166-1 list — most-used
  // first, then the rest of the world. Same pattern as products page.
  const countryOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of services) {
      if (!s.country) continue
      counts.set(s.country, (counts.get(s.country) ?? 0) + 1)
    }
    for (const s of externalServices) {
      if (!s.country) continue
      counts.set(s.country, (counts.get(s.country) ?? 0) + 1)
    }
    return buildCountryOptions(counts)
  }, [services, externalServices])

  const filtered = services
    .map(s => {
      // Compute distance_km when both the user filter and the listing
      // have coordinates. Used for radius filtering + proximity sorting.
      if (
        filterLoc.latitude != null && filterLoc.longitude != null &&
        s.latitude != null && s.longitude != null
      ) {
        return {
          ...s,
          distance_km: haversineKm(
            { latitude: filterLoc.latitude, longitude: filterLoc.longitude },
            { latitude: s.latitude, longitude: s.longitude }
          ),
        }
      }
      return s
    })
    .filter(s => {
      if (modeFilter !== 'all' && s.mode !== modeFilter && s.mode !== 'both') return false
      if (activeCatId && s.categoryId !== activeCatId) return false
      if (search && !s.title.toLowerCase().includes(search.toLowerCase()) && !s.desc.toLowerCase().includes(search.toLowerCase()) && !s.category.toLowerCase().includes(search.toLowerCase())) return false
      if (priceMin && s.price < Number(priceMin)) return false
      if (priceMax && s.price > Number(priceMax)) return false
      // ── Globalisation filters ───────────────────────────────────────
      if (filterRemote && !s.is_remote) return false
      if (countryFilter && s.country !== countryFilter) return false
      if (searchRadiusKm > 0 && filterLoc.latitude != null) {
        // Remote services bypass distance filtering — they're available worldwide
        if (!s.is_remote && (s.distance_km == null || s.distance_km > searchRadiusKm)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sort === 'price_asc') return a.price - b.price
      if (sort === 'price_desc') return b.price - a.price
      if (sort === 'rating') return b.rating - a.rating
      // Default: when a location filter is active, sort local-first by distance.
      if (filterLoc.latitude != null) {
        const da = typeof a.distance_km === 'number' ? a.distance_km : Number.MAX_VALUE
        const db = typeof b.distance_km === 'number' ? b.distance_km : Number.MAX_VALUE
        return da - db
      }
      return 0
    })

  const filteredExternalForListings = externalServices.filter(item => {
    const externalMode = modeFromExternalServiceType(item.service_type)
    if (modeFilter !== 'all' && externalMode !== modeFilter && externalMode !== 'both') return false
    if (activeCatId && item.category !== activeCatId) return false
    if (search.trim()) {
      const haystack = `${item.title} ${item.provider_name} ${item.description ?? ''} ${item.category}`.toLowerCase()
      if (!haystack.includes(search.trim().toLowerCase())) return false
    }
    // External provider rows usually do not publish comparable fixed prices.
    // If a user sets price bounds, keep FreeTrust-priced services precise and
    // do not invent provider pricing from snippets.
    if (priceMin || priceMax) return false
    if (filterRemote && item.service_type !== 'remote' && item.service_type !== 'both') return false
    if (countryFilter && item.country !== countryFilter && item.service_type === 'local') return false
    if (searchRadiusKm > 0 || filterLoc.latitude != null) {
      if (item.service_type === 'local') {
        if (filterLoc.latitude != null && filterLoc.longitude != null && item.latitude != null && item.longitude != null) {
          if (searchRadiusKm > 0) {
            const distance = haversineKm(
              { latitude: filterLoc.latitude, longitude: filterLoc.longitude },
              { latitude: item.latitude, longitude: item.longitude }
            )
            if (distance > searchRadiusKm) return false
          }
        } else {
          const sameCountry = !!filterLoc.country && !!item.country && item.country === filterLoc.country
          const sameCity = !!filterLoc.city && !!item.city && item.city.toLowerCase() === filterLoc.city.toLowerCase()
          const labelMatchesCity = !!filterLoc.city && !!item.location_label && item.location_label.toLowerCase().includes(filterLoc.city.toLowerCase())
          if (!sameCountry && !sameCity && !labelMatchesCity) return false
        }
      }
    }
    return true
  }).sort((a, b) => {
    if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    return (b.lead_count + b.click_count) - (a.lead_count + a.click_count)
  })

  const mixedServices: ServiceListEntry[] = [
    ...filtered.map(item => ({ _type: 'community' as const, item })),
    ...filteredExternalForListings.map(item => ({ _type: 'external' as const, item })),
  ]

  const visibleMixedServices = mixedServices.slice(0, serviceDisplayLimit)
  const servicesHasMore = serviceDisplayLimit < mixedServices.length

  function categoryCount(categoryId: string) {
    return services.filter(s => s.categoryId === categoryId).length
      + externalServices.filter(item => item.category === categoryId).length
  }

  const filteredExternalServices = externalServices.filter(item => {
    if (externalCategory !== 'all' && item.source_category !== externalCategory) return false
    if (externalSearch.trim()) {
      const haystack = `${item.title} ${item.provider_name} ${item.description ?? ''} ${item.category} ${item.source_category ?? ''}`.toLowerCase()
      if (!haystack.includes(externalSearch.trim().toLowerCase())) return false
    }
    return true
  })

  const visibleExternalServices = filteredExternalServices.slice(0, externalDisplayLimit)
  const externalHasMore = externalDisplayLimit < filteredExternalServices.length

  const onlineServiceCount = ONLINE_CATEGORIES.reduce((sum, cat) => sum + categoryCount(cat.id), 0)
  const localServiceCount = OFFLINE_CATEGORIES.reduce((sum, cat) => sum + categoryCount(cat.id), 0)

  async function requireAuth(redirectPath: string) {
    if (userId) return true
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      return true
    }
    router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`)
    return false
  }

  async function openServiceDetail(id: string | number) {
    const path = `/services/${id}`
    if (!(await requireAuth(path))) return
    router.push(path)
  }

  async function openProviderProfile(providerId: string) {
    const path = `/profile?id=${providerId}`
    if (!(await requireAuth(path))) return
    router.push(path)
  }

  async function openCreateService() {
    const path = '/seller/gigs/create'
    if (!(await requireAuth(path))) return
    router.push(path)
  }

  async function openFindProviderTab() {
    if (!(await requireAuth('/services'))) return
    setActiveTab('external')
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        ticking = false
        const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight)
        if (remaining > 900) return

        if (activeTab === 'freetrust') {
          setServiceDisplayLimit(prev => Math.min(prev + SERVICES_LOAD_MORE_BATCH, mixedServices.length))
        } else {
          setExternalDisplayLimit(prev => Math.min(prev + SERVICES_LOAD_MORE_BATCH, filteredExternalServices.length))
        }
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [activeTab, mixedServices.length, filteredExternalServices.length])

  async function handleExternalServiceClick(item: ExternalService) {
    if (!(await requireAuth('/services'))) return
    const outboundUrl = item.is_awin && item.awin_deeplink ? item.awin_deeplink : item.provider_url
    window.open(outboundUrl, '_blank', 'noopener,noreferrer')

    try {
      await fetch('/api/external-services/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: item.id }),
      })
      setExternalServices(prev => prev.map(row => row.id === item.id ? { ...row, click_count: row.click_count + 1 } : row))
    } catch {
      // Non-blocking: outbound provider has already opened.
    }
  }

  async function handleExternalEnquiry(item: ExternalService) {
    if (!(await requireAuth('/services'))) return
    setSelectedService(item)
    setShowEnquiryModal(true)
  }

  async function submitEnquiry() {
    if (!selectedService || !enquiryMessage.trim()) return
    setEnquiryLoading(true)
    try {
      const res = await fetch('/api/external-services/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceListingId: selectedService.id,
          providerName: selectedService.provider_name,
          providerUrl: selectedService.provider_url,
          category: selectedService.category,
          enquiryMessage,
          source: selectedService.is_awin ? 'awin' : 'external',
        }),
      })
      const payload = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) throw new Error(payload?.error ?? 'Could not submit enquiry')

      setExternalServices(prev => prev.map(row => row.id === selectedService.id ? { ...row, lead_count: row.lead_count + 1 } : row))
      setShowEnquiryModal(false)
      setSelectedService(null)
      setEnquiryMessage('')
      alert('Enquiry submitted! The provider will be in touch.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not submit enquiry')
    } finally {
      setEnquiryLoading(false)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      {/* Success toast — fires when ?published=true is in the URL.
          Fixed to the top of the viewport so it's visible regardless
          of scroll position on the services browse page. Dismisses
          itself after 4.5s via the useEffect timeout above. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 'calc(58px + 12px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1px solid rgba(34,197,94,0.45)',
            borderLeft: '4px solid #22c55e',
            borderRadius: 12,
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 700,
            color: '#f1f5f9',
            boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(34,197,94,0.1)',
            zIndex: 9999,
            maxWidth: 'min(92vw, 460px)',
            textAlign: 'center',
            // Slide-down animation so the toast doesn't just pop in.
            animation: 'ft-toast-in 0.3s ease-out',
          }}
        >
          <style>{`
            @keyframes ft-toast-in {
              from { opacity: 0; transform: translate(-50%, -16px); }
              to   { opacity: 1; transform: translate(-50%, 0); }
            }
          `}</style>
          {toast}
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          title={deleteTarget.title}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {showEnquiryModal && selectedService && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: '#111827', borderRadius: '16px',
            padding: '28px', maxWidth: '400px', width: '100%',
            border: '1px solid #1e293b', boxSizing: 'border-box',
          }}>
            <h3 style={{ color: '#fff', margin: '0 0 6px 0' }}>
              Enquire about this service
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 20px 0', lineHeight: 1.45 }}>
              {selectedService.title} — {selectedService.provider_name}
            </p>

            <textarea
              placeholder="Describe what you need..."
              value={enquiryMessage}
              onChange={e => setEnquiryMessage(e.target.value)}
              rows={4}
              style={{
                width: '100%', padding: '12px',
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: '8px', color: '#fff',
                fontSize: '16px', resize: 'vertical',
                boxSizing: 'border-box', marginBottom: '16px', fontFamily: 'inherit',
              }}
            />

            <button
              onClick={submitEnquiry}
              disabled={!enquiryMessage.trim() || enquiryLoading}
              style={{
                width: '100%', padding: '12px', minHeight: 44,
                background: enquiryLoading ? '#334155' : '#00c2cb',
                color: enquiryLoading ? '#64748b' : '#000',
                border: 'none', borderRadius: '10px',
                fontWeight: 700, fontSize: '15px',
                cursor: enquiryLoading ? 'default' : 'pointer',
                marginBottom: '10px', fontFamily: 'inherit',
              }}
            >
              {enquiryLoading ? 'Submitting...' : 'Submit Enquiry'}
            </button>

            <button
              onClick={() => { setShowEnquiryModal(false); setSelectedService(null) }}
              style={{
                width: '100%', padding: '10px', minHeight: 44,
                background: 'transparent', border: 'none',
                color: '#64748b', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <style>{`
        .svc-layout { max-width: 1200px; margin: 0 auto; padding: 20px 16px 80px; display: grid; grid-template-columns: 240px 1fr; gap: 24px; align-items: start; }
        .svc-sidebar { position: sticky; top: 110px; }
        .svc-mobile-categories { display: none; }
        .svc-results { min-width: 0; }
        .svc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
        .svc-controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .svc-controls-row2 { display: none; }
        @media (max-width: 768px) {
          .svc-layout { grid-template-columns: 1fr; padding: 12px 10px 80px; gap: 12px; }
          .svc-sidebar { display: none; }
          .svc-mobile-categories { display: flex; gap: 8px; width: 100%; max-width: 100%; min-width: 0; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 2px 0 10px; margin: 2px 0 12px; border-bottom: 1px solid rgba(51,65,85,0.7); box-sizing: border-box; }
          .svc-mobile-categories::-webkit-scrollbar { display: none; }
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
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 4px' }}>🎯 Services Marketplace</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>Skilled & professional work — online or in-person</p>

          <div style={{
            background: 'rgba(56,189,248,0.06)',
            border: '1px solid rgba(56,189,248,0.18)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 16,
            color: '#94a3b8',
            fontSize: 13,
            lineHeight: 1.55,
          }}>
            <strong style={{ color: '#e0f2fe' }}>Services Marketplace</strong> is for packaged professional work, freelancers, agencies, and external providers. Grassroots is now a separate menu section for local hands-on work.
          </div>

          <div style={{ display: 'flex', gap: 12, margin: '16px 0', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setActiveTab('freetrust')}
              style={{
                padding: '10px 20px', minHeight: 44,
                borderRadius: 8,
                border: activeTab === 'freetrust' ? '2px solid #00c2cb' : '2px solid #334155',
                background: activeTab === 'freetrust' ? '#00c2cb22' : 'transparent',
                color: activeTab === 'freetrust' ? '#00c2cb' : '#94a3b8',
                cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              All Services
            </button>
            <button
              onClick={openFindProviderTab}
              style={{
                padding: '10px 20px', minHeight: 44,
                borderRadius: 8,
                border: activeTab === 'external' ? '2px solid #00c2cb' : '2px solid #334155',
                background: activeTab === 'external' ? '#00c2cb22' : 'transparent',
                color: activeTab === 'external' ? '#00c2cb' : '#94a3b8',
                cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              🔍 Find a Provider
            </button>
          </div>

          {activeTab === 'freetrust' && (
            <>
              {/* Globalisation — location filter */}
              <div style={{ marginBottom: '12px' }}>
                <LocationFilter
                  location={filterLoc}
                  onLocationChange={setFilterLoc}
                  radiusKm={searchRadiusKm}
                  onRadiusChange={setSearchRadiusKm}
                  country={countryFilter}
                  onCountryChange={setCountryFilter}
                  countryOptions={countryOptions}
                  remote={filterRemote}
                  onRemoteChange={setFilterRemote}
                  showRemote
                />
              </div>

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
            </>
          )}
        </div>
      </div>

      {activeTab === 'freetrust' ? (
      <div className="svc-layout">
        {/* Sidebar */}
        <aside className="svc-sidebar">
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', overflow: 'hidden' }}>
            <button className="cat-btn" onClick={() => setActiveCatId(null)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', background: activeCatId === null ? 'rgba(56,189,248,0.1)' : 'transparent', border: 'none', borderLeft: activeCatId === null ? '3px solid #38bdf8' : '3px solid transparent', color: activeCatId === null ? '#38bdf8' : '#94a3b8', fontSize: '13px', fontWeight: activeCatId === null ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
              <span>✦ All Services</span>
              <span style={{ fontSize: '11px', color: '#475569' }}>{mixedServices.length}</span>
            </button>
            {/* Online section */}
            {(modeFilter === 'all' || modeFilter === 'online') && (
              <>
                <button
                  onClick={toggleOnline}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 14px', background: '#0f172a', border: 'none', borderTop: '1px solid #334155', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>💻 Online Services</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '10px', color: '#475569', fontWeight: 800 }}>{onlineServiceCount.toLocaleString()}</span>
                    <span style={{ fontSize: '13px', color: '#475569', transition: 'transform 0.2s', display: 'inline-block', transform: onlineOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
                  </span>
                </button>
                {onlineOpen && sortedOnlineCats.map(cat => {
                  const count = categoryCount(cat.id)
                  return (
                    <button key={cat.id} className="cat-btn" onClick={() => setActiveCatId(activeCatId === cat.id ? null : cat.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 14px 8px 18px', background: activeCatId === cat.id ? 'rgba(56,189,248,0.1)' : 'transparent', border: 'none', borderLeft: activeCatId === cat.id ? '3px solid #38bdf8' : '3px solid transparent', color: activeCatId === cat.id ? '#38bdf8' : '#94a3b8', fontSize: '12px', fontWeight: activeCatId === cat.id ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                      {count > 0 && <span style={{ fontSize: '10px', color: '#475569', flexShrink: 0 }}>{count}</span>}
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '10px', color: '#475569', fontWeight: 800 }}>{localServiceCount.toLocaleString()}</span>
                    <span style={{ fontSize: '13px', color: '#475569', transition: 'transform 0.2s', display: 'inline-block', transform: offlineOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
                  </span>
                </button>
                {offlineOpen && sortedOfflineCats.map(cat => {
                  const count = categoryCount(cat.id)
                  return (
                    <button key={cat.id} className="cat-btn" onClick={() => setActiveCatId(activeCatId === cat.id ? null : cat.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 14px 8px 18px', background: activeCatId === cat.id ? 'rgba(52,211,153,0.1)' : 'transparent', border: 'none', borderLeft: activeCatId === cat.id ? '3px solid #34d399' : '3px solid transparent', color: activeCatId === cat.id ? '#34d399' : '#94a3b8', fontSize: '12px', fontWeight: activeCatId === cat.id ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                      {count > 0 && <span style={{ fontSize: '10px', color: '#475569', flexShrink: 0 }}>{count}</span>}
                    </button>
                  )
                })}
              </>
            )}
          </div>

          {/* Post a service CTA */}
          <Link href="/seller/gigs/create" onClick={e => { e.preventDefault(); void openCreateService() }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px', padding: '12px', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>
            ➕ List Your Service
          </Link>
        </aside>

        {/* Results */}
        <div className="svc-results">
          <div className="svc-mobile-categories" aria-label="Service categories A to Z">
            <button
              onClick={() => setActiveCatId(null)}
              style={{
                padding: '9px 16px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                border: activeCatId === null ? '2px solid #00c2cb' : '2px solid #334155',
                background: activeCatId === null ? '#00c2cb22' : '#111827',
                color: activeCatId === null ? '#00c2cb' : '#94a3b8',
                cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', minHeight: 44,
              }}
            >
              ✦ All Services <span style={{ color: '#64748b', marginLeft: 4 }}>{mixedServices.length}</span>
            </button>
            {mobileCategoryCats.map(cat => {
              const active = activeCatId === cat.id
              const isOnline = cat.serviceKind === 'online'
              const accent = isOnline ? '#38bdf8' : '#34d399'
              const tint = isOnline ? 'rgba(56,189,248,0.12)' : 'rgba(52,211,153,0.12)'
              const count = categoryCount(cat.id)
              return (
                <button
                  key={`${cat.serviceKind}-${cat.id}`}
                  onClick={() => setActiveCatId(active ? null : cat.id)}
                  style={{
                    padding: '8px 14px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                    border: active ? `2px solid ${accent}` : '2px solid #334155',
                    background: active ? tint : '#111827',
                    color: active ? accent : '#94a3b8',
                    cursor: 'pointer', fontWeight: active ? 800 : 700, fontSize: 13, fontFamily: 'inherit', minHeight: 44,
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                  }}
                  title={`${cat.label} · ${isOnline ? 'Online service' : 'Local service'}`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: accent, border: `1px solid ${isOnline ? 'rgba(56,189,248,0.28)' : 'rgba(52,211,153,0.28)'}`,
                    background: isOnline ? 'rgba(56,189,248,0.08)' : 'rgba(52,211,153,0.08)',
                    borderRadius: 999, padding: '2px 6px',
                  }}>
                    {isOnline ? 'Online' : 'Local'}
                  </span>
                  {count > 0 && <span style={{ color: '#64748b', fontSize: 11 }}>{count}</span>}
                </button>
              )
            })}
          </div>

          {/* Active filter summary */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {mixedServices.length} service{mixedServices.length !== 1 ? 's' : ''}
              {filteredExternalForListings.length > 0 && ` · ${filteredExternalForListings.length} external provider${filteredExternalForListings.length !== 1 ? 's' : ''}`}
              {activeCatId && ` in ${visibleCats.find(c => c.id === activeCatId)?.label}`}
              {filterLoc.location_label && ` · near ${filterLoc.location_label}`}
              {countryFilter && ` · ${countryFilter}`}
              {filterRemote && ' · Remote'}
            </div>
            {(activeCatId || filterLoc.latitude != null || countryFilter || filterRemote || priceMin || priceMax || search) && (
              <button
                onClick={() => {
                  setActiveCatId(null)
                  setFilterLoc(EMPTY_LOCATION)
                  setSearchRadiusKm(0)
                  setCountryFilter(null)
                  setFilterRemote(false)
                  setPriceMin('')
                  setPriceMax('')
                  setSearch('')
                }}
                style={{ background: 'none', border: '1px solid #334155', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ✕ Clear filters
              </button>
            )}
          </div>

          {loadingServices || loadingExternalServices ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '34px', marginBottom: '12px' }}>🛠️</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8' }}>Loading services and providers…</div>
            </div>
          ) : servicesError || externalServicesError ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '34px', marginBottom: '12px' }}>⚠️</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Services could not load</div>
              <div style={{ fontSize: '13px', marginBottom: 20 }}>{servicesError ?? externalServicesError ?? 'Pull to refresh or try again in a moment.'}</div>
              <button onClick={() => window.location.reload()} style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '10px 24px', borderRadius: 10, fontWeight: 700, border: 'none', fontSize: '14px' }}>
                Reload services
              </button>
            </div>
          ) : mixedServices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🛠️</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                {services.length === 0 && externalServices.length === 0 ? 'No services loaded yet' : 'No services match your filters'}
              </div>
              <div style={{ fontSize: '13px', marginBottom: '20px' }}>
                {services.length === 0 && externalServices.length === 0
                  ? 'Be the first founding member to list your service!'
                  : 'Try adjusting your filters or search term'}
              </div>
              {services.length === 0 && externalServices.length === 0 && (
                <a href="/seller/gigs/create" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '10px 24px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>
                  + List Your Service
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="svc-grid">
                {visibleMixedServices.map(entry => (
                  entry._type === 'community' ? (
                    <ServiceCard
                      key={`community-${entry.item.id}`}
                      svc={entry.item}
                      isOwner={isAdmin || (!!userId && entry.item.providerId === userId)}
                      onDelete={handleDelete}
                      onOpen={openServiceDetail}
                      onOpenProfile={openProviderProfile}
                    />
                  ) : (
                    <ExternalServiceCard
                      key={`external-${entry.item.id}`}
                      item={entry.item}
                      onVisit={handleExternalServiceClick}
                      onEnquire={handleExternalEnquiry}
                    />
                  )
                ))}
              </div>

              {servicesHasMore && (
                <div style={{ textAlign: 'center', marginTop: '24px', color: '#64748b', fontSize: '13px', padding: '12px 0' }}>
                  Loading more services…
                </div>
              )}
            </>
          )}
        </div>
      </div>
      ) : (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 16px 80px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ flex: '1 1 280px', minWidth: '220px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
                <input
                  value={externalSearch}
                  onChange={e => setExternalSearch(e.target.value)}
                  placeholder="Search external providers…"
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '10px 14px 10px 36px', fontSize: '16px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.45 }}>
                {filteredExternalServices.length} provider{filteredExternalServices.length !== 1 ? 's' : ''}
                {externalCategory !== 'all' && ` in ${EXTERNAL_REFRESH_CATEGORIES.find(c => c.id === externalCategory)?.label ?? externalCategory}`}
              </div>
            </div>

            <div style={{
              display: 'flex', gap: '8px',
              overflowX: 'auto', paddingBottom: '8px',
              scrollbarWidth: 'none',
            }}>
              <button
                onClick={() => setExternalCategory('all')}
                style={{
                  padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0,
                  border: externalCategory === 'all' ? '2px solid #00c2cb' : '2px solid #334155',
                  background: externalCategory === 'all' ? '#00c2cb22' : 'transparent',
                  color: externalCategory === 'all' ? '#00c2cb' : '#94a3b8',
                  cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit',
                }}
              >
                🌐 All Services
              </button>
              {EXTERNAL_REFRESH_CATEGORIES.filter(cat => externalServices.some(item => item.source_category === cat.id)).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setExternalCategory(cat.id)}
                  style={{
                    padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0,
                    border: externalCategory === cat.id ? '2px solid #00c2cb' : '2px solid #334155',
                    background: externalCategory === cat.id ? '#00c2cb22' : 'transparent',
                    color: externalCategory === cat.id ? '#00c2cb' : '#94a3b8',
                    cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit',
                  }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {loadingExternalServices ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '34px', marginBottom: '12px' }}>🔎</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8' }}>Loading external providers…</div>
            </div>
          ) : externalServicesError ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '34px', marginBottom: '12px' }}>⚠️</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>External providers could not load</div>
              <div style={{ fontSize: '13px', marginBottom: 20 }}>{externalServicesError}</div>
              <button onClick={() => window.location.reload()} style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '10px 24px', borderRadius: 10, fontWeight: 700, border: 'none', fontSize: '14px', fontFamily: 'inherit' }}>
                Reload providers
              </button>
            </div>
          ) : filteredExternalServices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌐</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                {externalServices.length === 0 ? 'No external providers loaded yet' : 'No providers match your filters'}
              </div>
              <div style={{ fontSize: '13px', marginBottom: '20px' }}>
                {externalServices.length === 0
                  ? 'The nightly provider refresh will populate this tab from real SerpApi and Awin data.'
                  : 'Try another category or search term.'}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {visibleExternalServices.map(item => (
                  <ExternalServiceCard
                    key={item.id}
                    item={item}
                    onVisit={handleExternalServiceClick}
                    onEnquire={handleExternalEnquiry}
                  />
                ))}
              </div>

              {externalHasMore && (
                <div style={{ textAlign: 'center', marginTop: '24px', color: '#64748b', fontSize: '13px', padding: '12px 0' }}>
                  Loading more providers…
                </div>
              )}

              {!externalHasMore && filteredExternalServices.length > SERVICES_INITIAL_DISPLAY && (
                <p style={{ textAlign: 'center', color: '#475569', fontSize: '13px', padding: '24px 0', margin: 0 }}>
                  All {filteredExternalServices.length} providers loaded
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
