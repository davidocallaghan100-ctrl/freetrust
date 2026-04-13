'use client'
import React, { useState, useEffect, use, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LocationBadge from '@/components/location/LocationBadge'
import PriceDisplay from '@/components/currency/PriceDisplay'
import SocialLinks, { type SocialUrls } from '@/components/social/SocialLinks'
import { haversineKm } from '@/lib/geo'
import type { CurrencyCode } from '@/context/CurrencyContext'
import {
  GRASSROOTS_CATEGORIES_BY_SLUG,
  AVAILABILITY_BY_VALUE,
  RATE_TYPE_OPTIONS,
  CONTACT_PREFERENCE_OPTIONS,
  buildContactHref,
  GRASSROOTS_GREEN,
  type ContactPreference,
  type GrassrootsAvailability,
  type GrassrootsRateType,
} from '@/lib/grassroots/categories'

// ────────────────────────────────────────────────────────────────────────────
// Types — mirror the /api/grassroots/[id] response shape
// ────────────────────────────────────────────────────────────────────────────

interface Poster {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string | null
  location: string | null
  country: string | null
  city: string | null
  linkedin_url:  string | null
  instagram_url: string | null
  twitter_url:   string | null
  github_url:    string | null
  tiktok_url:    string | null
  youtube_url:   string | null
  website_url:   string | null
}

interface Listing {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  title: string
  description: string | null
  category: string
  listing_type: 'offering' | 'seeking'
  rate: number | null
  rate_type: GrassrootsRateType | null
  currency_code: string
  rate_eur: number | null
  availability: GrassrootsAvailability
  photos: string[]
  country: string | null
  region: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  location_label: string | null
  is_active: boolean
  contact_preference: ContactPreference
  contact_value: string | null
  trust_tokens_accepted: boolean
  status: string
  poster: Poster | null
}

interface SimilarListing {
  id: string
  title: string
  category: string
  rate: number | null
  rate_eur: number | null
  rate_type: GrassrootsRateType | null
  currency_code: string
  availability: GrassrootsAvailability
  city: string | null
  latitude: number | null
  longitude: number | null
  location_label: string | null
  photos: string[]
  trust_tokens_accepted: boolean
  distance_km?: number | null
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function GrassrootsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [listing, setListing] = useState<Listing | null>(null)
  const [trustBalance, setTrustBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState(0)
  const [similar, setSimilar] = useState<SimilarListing[]>([])

  // Load the listing + poster
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/grassroots/${id}`, { cache: 'no-store' })
        const d = await res.json() as {
          listing?: Listing
          trust_balance?: number
          error?: string
        }
        if (!res.ok || !d.listing) {
          if (!cancelled) setError(d.error ?? 'Listing not found')
          return
        }
        if (!cancelled) {
          setListing(d.listing)
          setTrustBalance(d.trust_balance ?? 0)
        }
      } catch {
        if (!cancelled) setError('Could not load listing. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  // Load similar listings nearby once we know the category + location
  useEffect(() => {
    if (!listing) return
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams({ category: listing.category, listing_type: listing.listing_type })
        if (listing.latitude != null && listing.longitude != null) {
          params.set('lat', String(listing.latitude))
          params.set('lng', String(listing.longitude))
          params.set('radius_km', '100')
        } else if (listing.country) {
          params.set('country', listing.country)
        }
        const res = await fetch(`/api/grassroots?${params.toString()}`, { cache: 'no-store' })
        if (!res.ok) return
        const d = await res.json() as { listings?: SimilarListing[] }
        if (cancelled) return
        // Filter out the current listing and cap to 4
        const filtered = (d.listings ?? [])
          .filter(s => s.id !== listing.id)
          .slice(0, 4)
        setSimilar(filtered)
      } catch { /* ignore — non-critical */ }
    })()
    return () => { cancelled = true }
  }, [listing])

  const category = listing ? GRASSROOTS_CATEGORIES_BY_SLUG[listing.category] : null
  const availability = listing ? AVAILABILITY_BY_VALUE[listing.availability] : null
  const rateSuffix = listing
    ? RATE_TYPE_OPTIONS.find(r => r.value === listing.rate_type)?.suffix ?? ''
    : ''
  const contactOption = listing
    ? CONTACT_PREFERENCE_OPTIONS.find(c => c.value === listing.contact_preference)
    : null
  const contactHref = listing
    ? buildContactHref(listing.contact_preference, listing.contact_value)
    : null

  // Member since
  const memberSince = useMemo(() => {
    if (!listing?.poster?.created_at) return null
    return new Date(listing.poster.created_at).toLocaleDateString('en-IE', {
      month: 'long', year: 'numeric',
    })
  }, [listing])

  // ── Contact button click handler ───────────────────────────────────────
  // For platform preference, we open the /messages route with the
  // poster's user id so the thread is pre-populated. For the other
  // preferences, we use the pre-built href (wa.me / tel: / mailto:).
  const handleContact = () => {
    if (!listing) return
    if (listing.contact_preference === 'platform') {
      router.push(`/messages?to=${listing.user_id}`)
      return
    }
    if (contactHref) {
      window.open(contactHref, listing.contact_preference === 'email' ? '_self' : '_blank', 'noopener,noreferrer')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={pageBg}>
        <div style={{ padding: '5rem 1rem', textAlign: 'center', color: '#64748b' }}>
          <div style={{
            display: 'inline-block',
            width: 32, height: 32,
            border: `3px solid ${GRASSROOTS_GREEN.borderSoft}`,
            borderTopColor: GRASSROOTS_GREEN.primary,
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div style={pageBg}>
        <div style={{ padding: '5rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌱</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>Listing not found</h1>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{error ?? 'This listing may have been removed.'}</p>
          <Link href="/grassroots" style={backLinkStyle}>← Back to Grassroots</Link>
        </div>
      </div>
    )
  }

  const photos = listing.photos ?? []
  const posterName = listing.poster?.full_name ?? 'FreeTrust member'
  const posterInitials = posterName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const posterSocial: SocialUrls | undefined = listing.poster ? {
    linkedin_url:  listing.poster.linkedin_url,
    instagram_url: listing.poster.instagram_url,
    twitter_url:   listing.poster.twitter_url,
    github_url:    listing.poster.github_url,
    tiktok_url:    listing.poster.tiktok_url,
    youtube_url:   listing.poster.youtube_url,
    website_url:   listing.poster.website_url,
  } : undefined

  return (
    <div style={pageBg}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.25rem 1.25rem 3rem' }}>
        {/* Back link */}
        <Link href="/grassroots" style={{ ...backLinkStyle, marginBottom: '1rem', display: 'inline-block' }}>
          ← Back to Grassroots
        </Link>

        {/* ── Two-column layout: main + sidebar ─────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 20,
        }} className="gr-detail-grid">
          <style>{`
            @media (max-width: 900px) {
              .gr-detail-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>

          {/* ── Main column ─────────────────────────────────────────────── */}
          <div>
            {/* Hero photo / gradient */}
            <div style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: 16,
              overflow: 'hidden',
              background: photos[activePhoto]
                ? '#0b1120'
                : `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}33, ${GRASSROOTS_GREEN.primaryDim}66)`,
              marginBottom: photos.length > 1 ? 12 : 20,
              border: `1px solid ${GRASSROOTS_GREEN.borderSoft}`,
            }}>
              {photos[activePhoto] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photos[activePhoto]}
                  alt={listing.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
              {!photos[activePhoto] && category && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 80, opacity: 0.6,
                }}>
                  {category.emoji}
                </div>
              )}

              {/* Badges overlay */}
              <div style={{
                position: 'absolute', top: 12, left: 12, right: 12,
                display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
              }}>
                {category && (
                  <span style={{
                    background: 'rgba(15,23,42,0.88)',
                    border: `1px solid ${GRASSROOTS_GREEN.border}`,
                    color: GRASSROOTS_GREEN.primary,
                    borderRadius: 999,
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {category.emoji} {category.label}
                  </span>
                )}
                {availability && (
                  <span style={{
                    background: availability.bg,
                    border: `1px solid ${availability.border}`,
                    color: availability.color,
                    borderRadius: 999,
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {availability.label}
                  </span>
                )}
              </div>
            </div>

            {/* Photo thumbnails */}
            {photos.length > 1 && (
              <div style={{
                display: 'flex', gap: 8, marginBottom: 20,
                overflowX: 'auto', paddingBottom: 4,
              }}>
                {photos.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActivePhoto(i)}
                    style={{
                      flexShrink: 0,
                      width: 72,
                      height: 56,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: `2px solid ${i === activePhoto ? GRASSROOTS_GREEN.primary : 'transparent'}`,
                      padding: 0,
                      background: '#0f172a',
                      cursor: 'pointer',
                    }}
                    aria-label={`Photo ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}

            {/* Title + meta */}
            <h1 style={{
              fontSize: 'clamp(1.5rem, 4vw, 2rem)',
              fontWeight: 900,
              margin: '0 0 10px',
              lineHeight: 1.2,
            }}>
              {listing.title}
            </h1>

            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
              marginBottom: 16,
            }}>
              {/* Listing type badge */}
              <span style={{
                background: listing.listing_type === 'offering' ? GRASSROOTS_GREEN.tint : 'rgba(251,146,60,0.1)',
                border: `1px solid ${listing.listing_type === 'offering' ? GRASSROOTS_GREEN.border : 'rgba(251,146,60,0.3)'}`,
                color:  listing.listing_type === 'offering' ? GRASSROOTS_GREEN.primary : '#fb923c',
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
              }}>
                {listing.listing_type === 'offering' ? '💪 Offering work' : '🔍 Seeking work'}
              </span>
              {/* Location */}
              {(listing.location_label || listing.city) && (
                <LocationBadge
                  label={listing.location_label ?? listing.city ?? null}
                  compact
                />
              )}
              {/* Trust tokens */}
              {listing.trust_tokens_accepted && (
                <span style={{
                  background: 'rgba(56,189,248,0.1)',
                  border: '1px solid rgba(56,189,248,0.35)',
                  color: '#38bdf8',
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                }}>
                  ₮ Trust tokens accepted
                </span>
              )}
            </div>

            {/* Rate card */}
            <div style={{
              background: '#1e293b',
              border: `1px solid ${GRASSROOTS_GREEN.borderSoft}`,
              borderRadius: 14,
              padding: 18,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>
                  RATE
                </div>
                {listing.rate != null && listing.rate_type !== 'negotiable' ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <PriceDisplay
                      amountEur={listing.rate_eur ?? listing.rate}
                      sourceCode={(listing.currency_code || 'EUR') as CurrencyCode}
                      sourceAmount={listing.rate}
                      size="lg"
                      layout="inline"
                    />
                    {rateSuffix && (
                      <span style={{ fontSize: 13, color: '#64748b' }}>{rateSuffix}</span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 800, color: GRASSROOTS_GREEN.primary }}>
                    💬 Negotiable
                  </div>
                )}
              </div>
              <button
                onClick={handleContact}
                style={{
                  background: `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}, ${GRASSROOTS_GREEN.primaryDim})`,
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
                }}
              >
                {contactOption?.emoji ?? '💬'} Contact {listing.listing_type === 'offering' ? 'worker' : 'client'}
              </button>
            </div>

            {/* Description */}
            {listing.description && (
              <div style={{
                background: '#1e293b',
                border: '1px solid rgba(148,163,184,0.12)',
                borderRadius: 14,
                padding: 18,
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>
                  DESCRIPTION
                </div>
                <p style={{
                  color: '#cbd5e1',
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {listing.description}
                </p>
              </div>
            )}

            {/* Trust token explainer */}
            {listing.trust_tokens_accepted && (
              <div style={{
                background: 'rgba(56,189,248,0.06)',
                border: '1px solid rgba(56,189,248,0.25)',
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                fontSize: 13,
                color: '#94a3b8',
              }}>
                <span style={{ fontSize: 20, color: '#38bdf8', flexShrink: 0 }}>₮</span>
                <span>
                  <strong style={{ color: '#f1f5f9' }}>This worker accepts FreeTrust Trust tokens</strong>
                  {' '}as full or partial payment. Pay from your Trust wallet to build mutual trust on the platform.
                </span>
              </div>
            )}
          </div>

          {/* ── Sidebar: poster card ──────────────────────────────────────── */}
          <aside>
            <div style={{
              background: '#1e293b',
              border: '1px solid rgba(148,163,184,0.12)',
              borderRadius: 14,
              padding: 18,
              position: 'sticky',
              top: 120,
            }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 12 }}>
                POSTED BY
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                {listing.poster?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.poster.avatar_url}
                    alt={posterName}
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}, ${GRASSROOTS_GREEN.primaryDim})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 16, color: '#0f172a',
                    flexShrink: 0,
                  }}>
                    {posterInitials || '?'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={`/profile?id=${listing.user_id}`}
                    style={{
                      display: 'block',
                      fontWeight: 700,
                      color: '#f1f5f9',
                      textDecoration: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {posterName}
                  </Link>
                  {memberSince && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Member since {memberSince}
                    </div>
                  )}
                </div>
              </div>

              {/* Trust score */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(56,189,248,0.08)',
                border: '1px solid rgba(56,189,248,0.2)',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 14,
              }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em' }}>
                  TRUST SCORE
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8' }}>
                  ₮{trustBalance.toLocaleString()}
                </span>
              </div>

              {/* Bio */}
              {listing.poster?.bio && (
                <p style={{
                  fontSize: 12,
                  color: '#94a3b8',
                  lineHeight: 1.55,
                  margin: '0 0 14px',
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {listing.poster.bio}
                </p>
              )}

              {/* Poster location (separate from listing location) */}
              {listing.poster?.location && (
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                  📍 {listing.poster.location}
                </div>
              )}

              {/* Social links */}
              {posterSocial && (
                <div style={{ marginBottom: 14 }}>
                  <SocialLinks links={posterSocial} size="sm" max={7} />
                </div>
              )}

              <Link
                href={`/profile?id=${listing.user_id}`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: 'transparent',
                  border: `1px solid ${GRASSROOTS_GREEN.border}`,
                  borderRadius: 8,
                  padding: '8px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: GRASSROOTS_GREEN.primary,
                  textDecoration: 'none',
                }}
              >
                View full profile →
              </Link>
            </div>
          </aside>
        </div>

        {/* ── Similar listings nearby ────────────────────────────────────── */}
        {similar.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>
              SIMILAR LISTINGS NEARBY
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
              gap: 12,
            }}>
              {similar.map(s => {
                const simCat = GRASSROOTS_CATEGORIES_BY_SLUG[s.category]
                // Recompute distance relative to THIS listing so "nearby"
                // is from the user's viewing perspective, not the API's.
                let distKm: number | null = null
                if (
                  listing.latitude != null && listing.longitude != null &&
                  s.latitude != null && s.longitude != null
                ) {
                  distKm = haversineKm(
                    { latitude: listing.latitude,  longitude: listing.longitude },
                    { latitude: s.latitude,        longitude: s.longitude },
                  )
                }
                return (
                  <Link
                    key={s.id}
                    href={`/grassroots/${s.id}`}
                    style={{
                      display: 'block',
                      background: '#1e293b',
                      border: '1px solid rgba(148,163,184,0.12)',
                      borderRadius: 12,
                      padding: 12,
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = GRASSROOTS_GREEN.border)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)')}
                  >
                    {simCat && (
                      <div style={{ fontSize: 18, marginBottom: 6 }}>{simCat.emoji}</div>
                    )}
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: '#f1f5f9',
                      marginBottom: 6, lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {s.title}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <LocationBadge
                        label={s.location_label ?? s.city ?? null}
                        distanceKm={distKm}
                        compact
                      />
                    </div>
                    {s.rate != null && s.rate_type !== 'negotiable' ? (
                      <PriceDisplay
                        amountEur={s.rate_eur ?? s.rate}
                        sourceCode={(s.currency_code || 'EUR') as CurrencyCode}
                        sourceAmount={s.rate}
                        size="sm"
                        layout="inline"
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: GRASSROOTS_GREEN.primary, fontWeight: 700 }}>
                        💬 Negotiable
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Shared styles
// ────────────────────────────────────────────────────────────────────────────
const pageBg: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0f172a',
  color: '#f1f5f9',
  fontFamily: 'system-ui, sans-serif',
  paddingTop: 64,
  paddingBottom: 80,
}

const backLinkStyle: React.CSSProperties = {
  color: GRASSROOTS_GREEN.primary,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 600,
}
