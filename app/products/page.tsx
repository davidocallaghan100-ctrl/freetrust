'use client'
import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { loadStripe, type Stripe, type StripeElements, type StripePaymentElement } from '@stripe/stripe-js'
import { createClient } from '@/lib/supabase/client'
import { useCurrency, type CurrencyCode } from '@/context/CurrencyContext'
import LocationFilter from '@/components/location/LocationFilter'
import LocationBadge from '@/components/location/LocationBadge'
import PriceDisplay from '@/components/currency/PriceDisplay'
import { EMPTY_LOCATION, haversineKm, type StructuredLocation, type RadiusValue } from '@/lib/geo'
import { buildCountryOptions } from '@/lib/countries'
import ListingQualityBadge from '@/components/marketplace/ListingQualityBadge'
import FindOnlineTab from '@/components/marketplace/FindOnlineTab'
import { PRODUCT_CATEGORIES, PRODUCTS_INITIAL_DISPLAY, PRODUCTS_LOAD_MORE_BATCH, categoryMeta, normaliseExternalCategory } from '@/lib/externalProductCategories'
import { useBasket, type BasketItem } from '@/context/BasketContext'
import { FREETRUST_PRODUCT_FEE_LABEL, formatEuroFromCents } from '@/lib/checkoutConfig'
import { isAffiliateTrackingEnabled, stripFreetrustReferralParams, toAffiliateUrl } from '@/lib/skimlinks'

let stripePromise: Promise<Stripe | null> | null = null

function getStripePromise() {
  if (typeof window === 'undefined') return null
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key || !key.startsWith('pk_')) return null
  if (!stripePromise) stripePromise = loadStripe(key)
  return stripePromise
}

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
  quality_score?: number | null
  // ── Globalisation fields ───────────────────────────────────────────────
  country?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  location_label?: string | null
  price_eur?: number | null
  distance_km?: number | null
}

interface ExternalProduct {
  id: string
  title: string
  price: string | null
  price_eur: number | null
  currency: string | null
  retailer_name: string
  retailer_url: string
  thumbnail: string | null
  rating: number | null
  review_count: number | null
  category: string
  subcategory: string | null
  is_trending: boolean
  click_count: number
}

// ─── Category data ────────────────────────────────────────────────────────────
const ALL_CATEGORIES = [{ id: 'all', label: 'All', icon: '🌐' }, ...PRODUCT_CATEGORIES]

const SORT_OPTIONS = ['Newest', 'Top Rated', 'Popular', 'Price: Low', 'Price: High']

// ─── Category gradients ───────────────────────────────────────────────────────
const CAT_GRAD: Record<string, string> = {
  electronics:   'linear-gradient(135deg,#06b6d4,#0284c7)',
  'computer-accessories': 'linear-gradient(135deg,#0ea5e9,#2563eb)',
  laptops:       'linear-gradient(135deg,#38bdf8,#1d4ed8)',
  tablets:       'linear-gradient(135deg,#22d3ee,#4338ca)',
  headphones:    'linear-gradient(135deg,#14b8a6,#0f766e)',
  speakers:      'linear-gradient(135deg,#0ea5e9,#7c3aed)',
  'smart-home':   'linear-gradient(135deg,#0f766e,#164e63)',
  'art-printed-products': 'linear-gradient(135deg,#f472b6,#db2777)',
  music:         'linear-gradient(135deg,#a78bfa,#7c3aed)',
  fashion:       'linear-gradient(135deg,#f472b6,#7c3aed)',
  clothing:      'linear-gradient(135deg,#fb7185,#be185d)',
  'home-living': 'linear-gradient(135deg,#0f766e,#164e63)',
  furniture:     'linear-gradient(135deg,#92400e,#78350f)',
  'sports-outdoor': 'linear-gradient(135deg,#22c55e,#15803d)',
  outdoor:       'linear-gradient(135deg,#65a30d,#166534)',
  'fitness-equipment': 'linear-gradient(135deg,#ef4444,#7f1d1d)',
  books:         'linear-gradient(135deg,#fbbf24,#d97706)',
  beauty:        'linear-gradient(135deg,#f9a8d4,#ec4899)',
  'toys-kids':   'linear-gradient(135deg,#fde047,#f97316)',
  'food-grocery': 'linear-gradient(135deg,#86efac,#16a34a)',
  gardening:     'linear-gradient(135deg,#84cc16,#15803d)',
  pets:          'linear-gradient(135deg,#fb923c,#92400e)',
  'digital-products': 'linear-gradient(135deg,#818cf8,#4338ca)',
  business:      'linear-gradient(135deg,#64748b,#334155)',
  'hardware-tools': 'linear-gradient(135deg,#f97316,#92400e)',
  'construction-supplies': 'linear-gradient(135deg,#f59e0b,#854d0e)',
  'travel-luggage': 'linear-gradient(135deg,#38bdf8,#0f766e)',
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
function ProductCard({ p, wishlist, onWishlist, isOwner, onDelete, inBasket, addingToBasket, onAddToBasket }: {
  p: Product
  wishlist: Set<string>
  onWishlist: (id: string) => void
  isOwner?: boolean
  onDelete?: (id: string, title: string) => void
  inBasket?: boolean
  addingToBasket?: boolean
  onAddToBasket?: (id: string) => void
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
          {(p.location_label || p.distance_km != null) && (
            <div>
              <LocationBadge label={p.location_label ?? null} distanceKm={p.distance_km ?? null} compact />
            </div>
          )}
        </div>
      </Link>

      {/* Body (non-link) */}
      <div style={{ padding: '0.4rem 0.85rem 0.85rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {/* Rating + quality badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
          <>
            <Stars rating={p.rating} />
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{p.rating.toFixed(1)} ({p.review_count})</span>
          </>
          {p.quality_score != null && p.quality_score >= 40 && (
            <ListingQualityBadge qualityScore={p.quality_score} compact />
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
          <PriceDisplay
            amountEur={(p.price_eur && p.price_eur > 0) ? p.price_eur : p.price}
            sourceCode={(p.currency || 'EUR') as CurrencyCode}
            sourceAmount={p.price}
            size="md"
            layout="stacked"
          />
           <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
            {onAddToBasket && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); onAddToBasket(p.id) }}
                disabled={addingToBasket || inBasket}
                style={{ background: inBasket ? 'rgba(52,211,153,0.12)' : 'rgba(0,194,203,0.12)', border: `1px solid ${inBasket ? 'rgba(52,211,153,0.35)' : 'rgba(0,194,203,0.35)'}`, borderRadius: 8, padding: '0.45rem 0.7rem', fontSize: '0.75rem', color: inBasket ? '#34d399' : '#00c2cb', cursor: addingToBasket || inBasket ? 'default' : 'pointer', minHeight: 36, fontWeight: 800 }}>
                {addingToBasket ? 'Adding…' : inBasket ? '✓ In Basket' : '+ Basket'}
              </button>
            )}
            <Link
              href={`/products/${p.id}`}
              style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.75rem', fontWeight: 700, color: '#fff', cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              View Listing
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

function ExternalProductCard({ product, onClick, inBasket, addingToBasket, onSaveToBasket }: {
  product: ExternalProduct
  onClick: (product: ExternalProduct) => void
  inBasket?: boolean
  addingToBasket?: boolean
  onSaveToBasket?: (product: ExternalProduct) => void
}) {
  const category = categoryMeta(product.category)
  const rating = typeof product.rating === 'number' ? Math.max(0, Math.min(5, Math.round(product.rating))) : 0

  return (
    <div style={{
      background: '#111827',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #1e293b',
      position: 'relative',
      cursor: 'default',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 320,
    }}>
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: '#374151',
        color: '#9ca3af',
        fontSize: '11px',
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: '6px',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        zIndex: 2,
      }}>
        🏪 Retailer
      </div>

      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: '#1e293b',
        color: '#94a3b8',
        fontSize: '11px',
        padding: '3px 8px',
        borderRadius: '6px',
        zIndex: 2,
      }}>
        {category.icon} {category.label}
      </div>

      <div style={{ width: '100%', height: '160px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {product.thumbnail ? (
          <img src={product.thumbnail} alt={product.title} style={{ width: '100%', height: '160px', objectFit: 'cover', background: '#ffffff' }} />
        ) : (
          <span style={{ fontSize: '2rem' }}>{category.icon}</span>
        )}
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <p style={{
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          margin: '0 0 6px 0',
          lineHeight: '1.4',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {product.title}
        </p>

        <p style={{ color: '#00c2cb', fontWeight: 700, fontSize: '16px', margin: '0 0 4px 0' }}>
          {product.price || (product.price_eur ? `€${product.price_eur.toFixed(2)}` : 'See price')}
        </p>

        <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 10px 0' }}>
          via {product.retailer_name}
        </p>

        {product.rating ? (
          <p style={{ color: '#fbbf24', fontSize: '12px', margin: '0 0 10px 0' }}>
            {'★'.repeat(rating)} {product.rating} ({product.review_count?.toLocaleString() ?? 0} reviews)
          </p>
        ) : <div style={{ height: 24 }} />}

        <p style={{ color: '#475569', fontSize: '11px', margin: '0 0 10px 0' }}>
          ⚠ Not Trust Coin eligible
        </p>

        <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          {onSaveToBasket && (
            <button
              onClick={() => onSaveToBasket(product)}
              disabled={addingToBasket || inBasket}
              style={{
                width: '100%', padding: '10px',
                background: inBasket ? 'rgba(52,211,153,0.1)' : 'rgba(0,194,203,0.08)',
                border: `1px solid ${inBasket ? 'rgba(52,211,153,0.35)' : 'rgba(0,194,203,0.24)'}`,
                color: inBasket ? '#34d399' : '#00c2cb', borderRadius: '8px',
                fontWeight: 800, fontSize: '13px', cursor: addingToBasket || inBasket ? 'default' : 'pointer',
              }}
            >
              {addingToBasket ? 'Saving…' : inBasket ? '✓ Saved' : '🔖 Save to Basket'}
            </button>
          )}
          <button
            onClick={() => onClick(product)}
            style={{
              width: '100%',
              padding: '10px',
              background: 'transparent',
              border: '1px solid #00c2cb',
              color: '#00c2cb',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            View on {product.retailer_name} →
          </button>
        </div>
      </div>
    </div>
  )
}

function RetailerModal({ product, onCancel, onContinue, opening }: {
  product: ExternalProduct
  onCancel: () => void
  onContinue: () => void
  opening: boolean
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9200, padding: '20px',
    }}>
      <div style={{
        background: '#111827', borderRadius: '16px',
        padding: '28px', maxWidth: '380px', width: '100%',
        border: '1px solid #1e293b',
      }}>
        <div style={{ fontSize: '32px', textAlign: 'center', marginBottom: '12px' }}>🏪</div>
        <h3 style={{ color: '#ffffff', textAlign: 'center', margin: '0 0 8px 0' }}>
          Leaving FreeTrust
        </h3>
        <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: '14px', margin: '0 0 20px 0', lineHeight: 1.5 }}>
          You&apos;re viewing <strong style={{ color: '#fff' }}>{product.title}</strong> on{' '}
          <strong style={{ color: '#fff' }}>{product.retailer_name}</strong>.
          This purchase is fulfilled directly by the retailer.
        </p>
        <div style={{
          background: '#1e293b', borderRadius: '10px',
          padding: '12px', marginBottom: '20px', fontSize: '13px', color: '#64748b',
        }}>
          ⚠ Trust Coin rewards and FreeTrust buyer protection do not apply to retailer purchases.
          FreeTrust may earn a small referral commission on purchases made through this link,
          at no extra cost to you.
        </div>
        <button
          onClick={onContinue}
          disabled={opening}
          style={{
            width: '100%', padding: '12px',
            background: '#00c2cb', color: '#000',
            border: 'none', borderRadius: '10px',
            fontWeight: 700, fontSize: '15px', cursor: opening ? 'wait' : 'pointer',
            marginBottom: '10px', opacity: opening ? 0.75 : 1,
          }}
        >
          {opening ? 'Opening…' : `Continue to ${product.retailer_name} →`}
        </button>
        <button
          onClick={onCancel}
          style={{
            width: '100%', padding: '10px',
            background: 'transparent', color: '#64748b',
            border: 'none', fontSize: '14px', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function BasketRow({ item, onQuantity, onRemove, onRetailer }: {
  item: BasketItem
  onQuantity: (itemId: string, quantity: number) => void
  onRemove: (itemId: string) => void
  onRetailer?: (item: BasketItem) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 10, padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
      <div style={{ width: 54, height: 54, borderRadius: 12, overflow: 'hidden', background: '#0f172a', border: '1px solid rgba(148,163,184,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item.image ? <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{item.product_type === 'external' ? '🏪' : '📦'}</span>}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 800, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>{item.product_type === 'external' ? `via ${item.retailer_name ?? 'Retailer'}` : 'FreeTrust community listing'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
          <span style={{ color: '#00c2cb', fontSize: 13, fontWeight: 900 }}>{item.price_label}</span>
          {item.product_type === 'community' ? (
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 999, overflow: 'hidden' }}>
              <button onClick={() => onQuantity(item.id, item.quantity - 1)} style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>−</button>
              <span style={{ minWidth: 24, textAlign: 'center', color: '#f8fafc', fontSize: 12, fontWeight: 800 }}>{item.quantity}</span>
              <button onClick={() => onQuantity(item.id, item.quantity + 1)} style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>+</button>
            </div>
          ) : onRetailer ? (
            <button onClick={() => onRetailer(item)} style={{ border: '1px solid rgba(0,194,203,0.35)', background: 'transparent', color: '#00c2cb', borderRadius: 999, padding: '5px 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Complete on retailer site</button>
          ) : null}
          <button onClick={() => onRemove(item.id)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>Remove</button>
        </div>
      </div>
    </div>
  )
}

function BasketPaymentElement({ clientSecret, totalCents, onPaid }: {
  clientSecret: string
  totalCents: number
  onPaid: () => void
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const elementsRef = useRef<StripeElements | null>(null)
  const paymentElementRef = useRef<StripePaymentElement | null>(null)
  const [stripe, setStripe] = useState<Stripe | null>(null)
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setError(null)
    setSuccess(null)

    const promise = getStripePromise()
    if (!promise) {
      setError('Stripe is not configured for browser checkout.')
      return
    }

    promise.then(stripeInstance => {
      if (cancelled || !stripeInstance || !mountRef.current) return
      setStripe(stripeInstance)
      const elements = stripeInstance.elements({
        clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#00c2cb',
            colorBackground: '#111827',
            colorText: '#f8fafc',
            colorDanger: '#f87171',
            borderRadius: '12px',
          },
        },
      })
      const paymentElement = elements.create('payment', { layout: 'tabs' })
      elementsRef.current = elements
      paymentElementRef.current = paymentElement
      paymentElement.on('ready', () => setReady(true))
      paymentElement.mount(mountRef.current)
    }).catch(() => setError('Could not load Stripe checkout.'))

    return () => {
      cancelled = true
      try { paymentElementRef.current?.unmount() } catch { /* no-op */ }
      paymentElementRef.current = null
      elementsRef.current = null
    }
  }, [clientSecret])

  async function confirmPayment() {
    if (!stripe || !elementsRef.current || submitting) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    const { error: submitError } = await elementsRef.current.submit()
    if (submitError) {
      setError(submitError.message ?? 'Please check your payment details.')
      setSubmitting(false)
      return
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: `${window.location.origin}/products?checkout=success` },
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message ?? 'Payment could not be completed.')
      setSubmitting(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      setSuccess('Payment complete. FreeTrust is finalising seller payouts now.')
      onPaid()
    } else if (paymentIntent?.status === 'processing') {
      setSuccess('Payment is processing. FreeTrust will update the order automatically.')
      onPaid()
    } else {
      setSuccess(`Payment status: ${paymentIntent?.status ?? 'created'}.`)
    }
    setSubmitting(false)
  }

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: 14 }}>
      <div ref={mountRef} style={{ minHeight: ready ? undefined : 120 }} />
      {!ready && !error && <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: 12 }}>Loading secure payment fields…</p>}
      <button
        onClick={confirmPayment}
        disabled={!ready || submitting || !!success}
        style={{ width: '100%', marginTop: 12, padding: '13px 14px', borderRadius: 12, border: 'none', background: '#00c2cb', color: '#001014', fontWeight: 950, cursor: !ready || submitting || success ? 'default' : 'pointer', opacity: !ready || success ? 0.7 : 1, fontSize: 15 }}
      >
        {submitting ? 'Confirming payment…' : `Pay ${formatEuroFromCents(totalCents)} securely`}
      </button>
      {error && <p style={{ margin: '10px 0 0', color: '#f87171', fontSize: 12, lineHeight: 1.45 }}>{error}</p>}
      {success && <p style={{ margin: '10px 0 0', color: '#34d399', fontSize: 12, lineHeight: 1.45 }}>{success}</p>}
    </div>
  )
}

function BasketDrawer({ open, onClose, onRetailer }: {
  open: boolean
  onClose: () => void
  onRetailer: (item: BasketItem) => void
}) {
  const basket = useBasket()
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutIntent, setCheckoutIntent] = useState<{
    client_secret: string
    payment_intent_id: string
    order_id: string
    total_cents: number
  } | null>(null)

  async function checkoutCommunityItems() {
    setCheckingOut(true)
    setCheckoutMessage(null)
    setCheckoutError(null)
    setCheckoutIntent(null)
    try {
      const res = await fetch('/api/checkout/create-payment-intent', { method: 'POST' })
      const data = await res.json() as { error?: string; client_secret?: string; payment_intent_id?: string; order_id?: string; total_cents?: number }
      if (!res.ok || data.error) {
        setCheckoutError(data.error ?? 'Checkout could not be started.')
        return
      }
      if (!data.client_secret || !data.payment_intent_id || !data.order_id || !data.total_cents) {
        setCheckoutError('Checkout was created but payment details were incomplete.')
        return
      }
      setCheckoutIntent({
        client_secret: data.client_secret,
        payment_intent_id: data.payment_intent_id,
        order_id: data.order_id,
        total_cents: data.total_cents,
      })
      setCheckoutMessage(`Secure payment is ready for ${formatEuroFromCents(data.total_cents)}.`)
    } catch {
      setCheckoutError('Could not connect to checkout. Please try again.')
    } finally {
      setCheckingOut(false)
    }
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9300, pointerEvents: 'auto' }}>
      <button onClick={onClose} aria-label="Close basket overlay" style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(2,6,23,0.68)', cursor: 'pointer' }} />
      <aside style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 'min(440px, 100vw)', background: '#0a0f1e', borderLeft: '1px solid rgba(0,194,203,0.22)', boxShadow: '-24px 0 60px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'calc(18px + env(safe-area-inset-top)) 18px 14px', borderBottom: '1px solid rgba(148,163,184,0.12)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(0,194,203,0.12)', color: '#00c2cb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🧺</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>Your basket</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>{basket.itemCount} saved item{basket.itemCount === 1 ? '' : 's'}</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid rgba(148,163,184,0.18)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 24px' }}>
          {!basket.userId && (
            <div style={{ background: 'rgba(0,194,203,0.08)', border: '1px solid rgba(0,194,203,0.2)', borderRadius: 14, padding: 14, color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
              Sign in to persist your basket across devices and sessions.
            </div>
          )}

          <section style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 14, fontWeight: 900 }}>FreeTrust community items</h3>
              <span style={{ color: '#64748b', fontSize: 12 }}>{basket.communityItems.length}</span>
            </div>
            {basket.communityItems.length === 0 ? (
              <div style={{ border: '1px dashed rgba(148,163,184,0.2)', borderRadius: 14, padding: 18, color: '#64748b', fontSize: 13, textAlign: 'center' }}>No community products yet.</div>
            ) : basket.communityItems.map(item => (
              <BasketRow key={item.id} item={item} onQuantity={(id, qty) => void basket.updateQuantity(id, qty)} onRemove={(id) => void basket.removeItem(id)} />
            ))}
          </section>

          {basket.communityItems.length > 0 && (
            <div style={{ marginTop: 16, background: '#111827', border: '1px solid rgba(0,194,203,0.14)', borderRadius: 16, padding: 14 }}>
              {[
                ['Subtotal', formatEuroFromCents(basket.communitySubtotalCents)],
                [FREETRUST_PRODUCT_FEE_LABEL, formatEuroFromCents(basket.platformFeeCents)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 13, padding: '5px 0' }}>
                  <span>{label}</span><strong style={{ color: '#f8fafc' }}>{value}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(148,163,184,0.12)', marginTop: 8, paddingTop: 12 }}>
                <span style={{ color: '#fff', fontWeight: 900 }}>Total</span>
                <span style={{ color: '#00c2cb', fontWeight: 950, fontSize: 20 }}>{formatEuroFromCents(basket.communityTotalCents)}</span>
              </div>
              <button onClick={checkoutCommunityItems} disabled={checkingOut || basket.communityTotalCents <= 0} style={{ width: '100%', marginTop: 14, padding: '13px 14px', borderRadius: 12, border: 'none', background: '#00c2cb', color: '#001014', fontWeight: 950, cursor: checkingOut ? 'wait' : 'pointer', fontSize: 15 }}>
                {checkingOut ? 'Creating secure checkout…' : checkoutIntent ? 'Refresh secure checkout' : 'Checkout community items'}
              </button>
              {checkoutMessage && <p style={{ margin: '10px 0 0', color: '#34d399', fontSize: 12, lineHeight: 1.45 }}>{checkoutMessage}</p>}
              {checkoutError && <p style={{ margin: '10px 0 0', color: '#f87171', fontSize: 12, lineHeight: 1.45 }}>{checkoutError}</p>}
              {checkoutIntent && (
                <BasketPaymentElement
                  key={checkoutIntent.client_secret}
                  clientSecret={checkoutIntent.client_secret}
                  totalCents={checkoutIntent.total_cents}
                  onPaid={() => { void basket.refresh() }}
                />
              )}
            </div>
          )}

          <section style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 14, fontWeight: 900 }}>External retailer saves</h3>
              <span style={{ color: '#64748b', fontSize: 12 }}>{basket.externalItems.length}</span>
            </div>
            <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.45, margin: '0 0 8px' }}>Saved retailer products are not charged through FreeTrust and are completed directly on each retailer site.</p>
            {basket.externalItems.length === 0 ? (
              <div style={{ border: '1px dashed rgba(148,163,184,0.2)', borderRadius: 14, padding: 18, color: '#64748b', fontSize: 13, textAlign: 'center' }}>No retailer products saved.</div>
            ) : basket.externalItems.map(item => (
              <BasketRow key={item.id} item={item} onQuantity={(id, qty) => void basket.updateQuantity(id, qty)} onRemove={(id) => void basket.removeItem(id)} onRetailer={onRetailer} />
            ))}
          </section>
        </div>
      </aside>
    </div>
  )
}

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────
function ProductsInner() {
  const { format } = useCurrency()
  const basket = useBasket()
  const searchParams = useSearchParams()
  const initCat = normaliseExternalCategory(searchParams.get('category') ?? 'all')
  const initType = (searchParams.get('type') ?? 'all') as 'all' | 'digital' | 'physical'

  const [typeFilter, setTypeFilter] = useState<'all'|'digital'|'physical'>(initType)
  const [catFilter, setCatFilter] = useState(initCat)
  const [sortBy, setSortBy] = useState('Newest')
  const [maxPrice, setMaxPrice] = useState(500)
  const [minRating, setMinRating] = useState(0)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  // Globalisation — location filter state
  const [filterLoc, setFilterLoc] = useState<StructuredLocation>(EMPTY_LOCATION)
  const [radiusKm, setRadiusKm] = useState<RadiusValue>(0)
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [dbProducts, setDbProducts] = useState<Product[] | null>(null)
  const [externalProducts, setExternalProducts] = useState<ExternalProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<'listings' | 'find-online'>('listings')
  const [clickedProduct, setClickedProduct] = useState<ExternalProduct | null>(null)
  const [openingRetailer, setOpeningRetailer] = useState(false)
  const [basketOpen, setBasketOpen] = useState(false)
  const [basketBusyId, setBasketBusyId] = useState<string | null>(null)
  const [displayLimit, setDisplayLimit] = useState(PRODUCTS_INITIAL_DISPLAY)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    setDisplayLimit(PRODUCTS_INITIAL_DISPLAY)
    setLoadingMore(false)
  }, [activeTab, catFilter, typeFilter, sortBy, maxPrice, minRating, countryFilter, radiusKm, filterLoc.latitude, filterLoc.longitude])

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
        const [communityRes, externalRes] = await Promise.all([
          supabase
            .from('listings')
            .select('id, title, description, price, currency, product_type, tags, images, cover_image, avg_rating, review_count, quality_score, seller_id, country, city, region, latitude, longitude, location_label, currency_code, price_eur, profiles!seller_id(id, full_name, avatar_url)')
            .eq('status', 'active')
            .neq('product_type', 'service')
            .order('created_at', { ascending: false })
            .limit(200),
          (async () => {
            const rows: Record<string, unknown>[] = []
            const pageSize = 1000
            for (let from = 0; from < 3000; from += pageSize) {
              const { data, error } = await supabase
                .from('external_product_listings')
                .select('id, title, price, price_eur, currency, retailer_name, retailer_url, thumbnail, rating, review_count, category, subcategory, is_trending, click_count')
                .order('is_trending', { ascending: false })
                .order('click_count', { ascending: false })
                .order('last_refreshed_at', { ascending: false })
                .range(from, from + pageSize - 1)
              if (error) throw error
              rows.push(...(data ?? []))
              if (!data || data.length < pageSize) break
            }
            return rows
          })(),
        ])
        const data = communityRes.data
        if (data && data.length > 0) {
          setDbProducts(data.map((d: Record<string, unknown>) => {
            const profile = d.profiles as Record<string, unknown> | null
            const tags = Array.isArray(d.tags) ? (d.tags as string[]) : []
            const images = Array.isArray(d.images) ? (d.images as string[]) : []
            const coverImage = (d.cover_image as string | null) ?? null
            // Derive category from tags — look for known category keywords
            const CAT_KEYWORDS: Record<string, string> = {
              'charger': 'electronics', 'mouse': 'computer-accessories',
              'keyboard': 'computer-accessories', 'ssd': 'computer-accessories', 'router': 'computer-accessories',
              'led': 'electronics', 'gimbal': 'electronics', 'tracker': 'electronics',
              'stream deck': 'computer-accessories', 'power bank': 'electronics', 'wifi': 'computer-accessories',
              'phone': 'electronics', 'laptop': 'laptops', 'speaker': 'speakers', 'headphones': 'headphones',
              'course': 'digital-products', 'template': 'digital-products', 'software': 'digital-products',
              'music': 'music', 'photo': 'art-printed-products', 'art': 'art-printed-products', 'book': 'books',
              'merch': 'fashion', 'hoodie': 'clothing', 'handmade': 'art-printed-products', 'food': 'food-grocery',
              'compost': 'gardening', 'topsoil': 'gardening', 'bark': 'gardening', 'mulch': 'gardening',
            }
            let category = 'electronics'
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
              currency: String(d.currency_code ?? d.currency ?? 'EUR'),
              category,
              type: d.product_type === 'digital' ? 'digital' as const : 'physical' as const,
              image: coverImage ?? images[0] ?? undefined,
              seller_name: String(profile?.full_name ?? 'FreeTrust Store'),
              seller_avatar: profile?.avatar_url ? String(profile.avatar_url) : undefined,
              seller_id: profile?.id ? String(profile.id) : (d.seller_id ? String(d.seller_id) : null),
              seller_verified: true,
              review_count: Number(d.review_count ?? 0),
              rating: Number(d.review_count ?? 0) > 0 ? Number(d.avg_rating ?? 5) : 5,
              quality_score: typeof d.quality_score === 'number' ? (d.quality_score as number) : null,
              free_shipping: true,
              delivery: d.product_type === 'digital' ? 'Instant Download' : '3–7 business days',
              // Globalisation fields
              country:        (d.country as string | null | undefined) ?? null,
              city:           (d.city as string | null | undefined) ?? null,
              latitude:       typeof d.latitude  === 'number' ? (d.latitude as number)  : null,
              longitude:      typeof d.longitude === 'number' ? (d.longitude as number) : null,
              location_label: (d.location_label as string | null | undefined) ?? null,
              price_eur:      typeof d.price_eur === 'number' ? (d.price_eur as number) : null,
            }
          }))
        }
        if (externalRes) {
          setExternalProducts(externalRes.map((row: Record<string, unknown>) => ({
            id: String(row.id),
            title: String(row.title ?? ''),
            price: row.price ? String(row.price) : null,
            price_eur: row.price_eur != null && Number.isFinite(Number(row.price_eur)) ? Number(row.price_eur) : null,
            currency: row.currency ? String(row.currency) : 'EUR',
            retailer_name: String(row.retailer_name ?? 'Online Retailer'),
            retailer_url: stripFreetrustReferralParams(String(row.retailer_url ?? '')),
            thumbnail: row.thumbnail ? String(row.thumbnail) : null,
            rating: row.rating != null && Number.isFinite(Number(row.rating)) ? Number(row.rating) : null,
            review_count: typeof row.review_count === 'number' ? row.review_count : null,
            category: normaliseExternalCategory(String(row.category ?? 'electronics')),
            subcategory: row.subcategory ? String(row.subcategory) : null,
            is_trending: Boolean(row.is_trending),
            click_count: Number(row.click_count ?? 0),
          })).filter(row => row.title && row.retailer_url))
        }
      } catch { /* leave as empty */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const products = dbProducts ?? ([] as Product[])

  // Country options merged with the global ISO 3166-1 reference list:
  // countries present in the data appear first (with counts), then every
  // other country alphabetically — see lib/countries.ts buildCountryOptions.
  const countryOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      if (!p.country) continue
      counts.set(p.country, (counts.get(p.country) ?? 0) + 1)
    }
    return buildCountryOptions(counts)
  }, [products])

  // Compute distance_km per product when the filter has geocoords, then
  // filter by radius and sort so local results show first.
  let filtered = products.map(p => {
    if (
      filterLoc.latitude != null && filterLoc.longitude != null &&
      p.latitude != null && p.longitude != null
    ) {
      return {
        ...p,
        distance_km: haversineKm(
          { latitude: filterLoc.latitude, longitude: filterLoc.longitude },
          { latitude: p.latitude, longitude: p.longitude }
        ),
      }
    }
    return p
  }).filter(p => {
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    if (catFilter !== 'all' && p.category !== catFilter) return false
    if (p.price > maxPrice) return false
    if (p.rating > 0 && p.rating < minRating) return false
    if (countryFilter && p.country !== countryFilter) return false
    if (radiusKm > 0 && filterLoc.latitude != null) {
      if (p.distance_km == null || p.distance_km > radiusKm) return false
    }
    return true
  })

  let filteredExternal = externalProducts.filter(p => {
    const externalType = p.category === 'digital-products' ? 'digital' : 'physical'
    if (typeFilter !== 'all' && externalType !== typeFilter) return false
    if (catFilter !== 'all' && p.category !== catFilter) return false
    if (p.price_eur != null && p.price_eur > maxPrice) return false
    if (p.rating != null && p.rating > 0 && p.rating < minRating) return false
    if (countryFilter || radiusKm > 0 || filterLoc.latitude != null) return false
    return true
  })

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'Price: Low')  return a.price - b.price
    if (sortBy === 'Price: High') return b.price - a.price
    if (sortBy === 'Popular')     return b.review_count - a.review_count
    if (sortBy === 'Top Rated')   return (b.quality_score ?? 0) - (a.quality_score ?? 0)
    // Default: if the user set a location, sort by distance (local-first)
    if (filterLoc.latitude != null && a.distance_km != null && b.distance_km != null) {
      return a.distance_km - b.distance_km
    }
    return 0
  })

  filteredExternal = [...filteredExternal].sort((a, b) => {
    if (sortBy === 'Price: Low') return (a.price_eur ?? Number.MAX_SAFE_INTEGER) - (b.price_eur ?? Number.MAX_SAFE_INTEGER)
    if (sortBy === 'Price: High') return (b.price_eur ?? 0) - (a.price_eur ?? 0)
    if (sortBy === 'Popular') return (b.click_count ?? 0) - (a.click_count ?? 0)
    if (sortBy === 'Top Rated') return (b.rating ?? 0) - (a.rating ?? 0)
    if (b.is_trending !== a.is_trending) return b.is_trending ? 1 : -1
    return (b.click_count ?? 0) - (a.click_count ?? 0)
  })

  const mergedProducts = [
    ...filtered.map(item => ({ _type: 'community' as const, item })),
    ...filteredExternal.map(item => ({ _type: 'external' as const, item })),
  ]

  const visibleProducts = mergedProducts.slice(0, displayLimit)
  const hasMore = displayLimit < mergedProducts.length

  const communityBasketIds = useMemo(() => new Set(basket.communityItems.map(item => item.listing_id).filter(Boolean) as string[]), [basket.communityItems])
  const externalBasketIds = useMemo(() => new Set(basket.externalItems.map(item => item.external_product_id).filter(Boolean) as string[]), [basket.externalItems])

  function toggleWishlist(id: string) {
    setWishlist(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function logExternalProductClick(product: ExternalProduct, clickSource: 'grid' | 'modal' | 'basket' | 'find_online' = 'modal') {
    try {
      await fetch('/api/external-products/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          userId,
          category: product.category,
          title: product.title,
          retailerName: product.retailer_name,
          retailerUrl: product.retailer_url,
          affiliateLinkGenerated: isAffiliateTrackingEnabled(),
          clickSource,
        }),
      })
      setExternalProducts(prev => prev.map(item => item.id === product.id ? { ...item, click_count: item.click_count + 1 } : item))
    } catch {
      // Non-blocking: the user can still continue to the retailer.
    }
  }

  async function handleExternalProductClick(product: ExternalProduct) {
    setClickedProduct(product)
  }

  async function handleAddCommunityToBasket(id: string) {
    setBasketBusyId(`community-${id}`)
    try {
      const result = await basket.addCommunityItem(id)
      if (!result.ok) alert(result.error ?? 'Could not add this item to your basket.')
      else setBasketOpen(true)
    } finally {
      setBasketBusyId(null)
    }
  }

  async function handleSaveExternalToBasket(product: ExternalProduct) {
    setBasketBusyId(`external-${product.id}`)
    try {
      const result = await basket.addExternalItem(product.id)
      if (!result.ok) alert(result.error ?? 'Could not save this retailer product.')
      else setBasketOpen(true)
    } finally {
      setBasketBusyId(null)
    }
  }

  async function openRetailerFromBasket(item: BasketItem) {
    if (!item.retailer_url) return
    const product = externalProducts.find(row => row.id === item.external_product_id)
    const cleanRetailerUrl = stripFreetrustReferralParams(item.retailer_url)
    window.open(toAffiliateUrl(cleanRetailerUrl), '_blank', 'noopener,noreferrer')
    if (product) {
      await logExternalProductClick(product, 'basket')
      return
    }
    try {
      const supabase = createClient()
      await supabase.from('external_product_clicks').insert({
        user_id: userId,
        search_query: 'basket_click',
        product_title: item.title || '',
        retailer_name: item.retailer_name || 'Retailer',
        product_url: cleanRetailerUrl,
        affiliate_link_generated: isAffiliateTrackingEnabled(),
        click_source: 'basket',
      })
    } catch {
      // Non-blocking: the retailer has already opened.
    }
  }

  async function continueToRetailer() {
    if (!clickedProduct) return
    setOpeningRetailer(true)
    const outboundProduct = clickedProduct
    window.open(toAffiliateUrl(outboundProduct.retailer_url), '_blank', 'noopener,noreferrer')
    await logExternalProductClick(outboundProduct, 'modal')
    setClickedProduct(null)
    setOpeningRetailer(false)
  }

  const pillStyle = (active: boolean, color = '#38bdf8') => ({
    padding: '0.4rem 0.85rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: active ? 700 : 500,
    cursor: 'pointer', border: `1px solid ${active ? color : 'rgba(148,163,184,0.2)'}`,
    background: active ? `${color}18` : 'transparent', color: active ? color : '#94a3b8',
    whiteSpace: 'nowrap' as const, minHeight: 36, flexShrink: 0 as const,
  })

  const productGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '1.1rem',
  }

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
      {clickedProduct && (
        <RetailerModal
          product={clickedProduct}
          onCancel={() => setClickedProduct(null)}
          onContinue={continueToRetailer}
          opening={openingRetailer}
        />
      )}
      <BasketDrawer open={basketOpen} onClose={() => setBasketOpen(false)} onRetailer={openRetailerFromBasket} />
      {activeTab === 'listings' && (
        <button
          onClick={() => setBasketOpen(true)}
          style={{ position: 'fixed', right: 18, bottom: 'calc(18px + env(safe-area-inset-bottom))', zIndex: 8500, minWidth: 58, height: 58, borderRadius: 999, border: '1px solid rgba(0,194,203,0.4)', background: 'linear-gradient(135deg,#00c2cb,#0891b2)', color: '#001014', boxShadow: '0 16px 40px rgba(0,194,203,0.28)', cursor: 'pointer', fontWeight: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 16px' }}
          aria-label="Open product basket"
        >
          <span style={{ fontSize: 20 }}>🧺</span>
          <span>{basket.itemCount}</span>
        </button>
      )}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.25rem 2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.2rem)', fontWeight: 900, margin: '0 0 0.25rem', letterSpacing: '-0.5px' }}>Products</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>{activeTab === 'listings' ? mergedProducts.length : filtered.length} product{(activeTab === 'listings' ? mergedProducts.length : filtered.length) !== 1 ? 's' : ''} found</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '0.45rem 0.75rem', fontSize: '0.8rem', color: '#94a3b8', cursor: 'pointer', minHeight: 36 }}>
              {SORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Link href="/products/new" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.5rem 1.1rem', borderRadius: 9, fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none', minHeight: 36, display: 'flex', alignItems: 'center' }}>
              + List Product
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('listings')}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: activeTab === 'listings' ? '2px solid #00c2cb' : '2px solid #334155',
              background: activeTab === 'listings' ? '#00c2cb22' : 'transparent',
              color: activeTab === 'listings' ? '#00c2cb' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            FreeTrust Listings
          </button>
          <button
            onClick={() => setActiveTab('find-online')}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: activeTab === 'find-online' ? '2px solid #00c2cb' : '2px solid #334155',
              background: activeTab === 'find-online' ? '#00c2cb22' : 'transparent',
              color: activeTab === 'find-online' ? '#00c2cb' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            🔍 Find Online
          </button>
        </div>

        {activeTab === 'listings' && <>
          {/* Globalisation — location filter */}
          <div style={{ marginBottom: '0.75rem' }}>
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

          {/* Type filters */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, marginBottom: '0.75rem' }}>
            {(['all','digital','physical'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={pillStyle(typeFilter === t)}>
                {t === 'all' ? 'All Types' : t === 'digital' ? '💾 Digital' : '📦 Physical'}
              </button>
            ))}
          </div>

          {/* Category pills */}
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px',
            marginBottom: '1rem',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}>
            {ALL_CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCatFilter(c.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  border: catFilter === c.id ? '2px solid #00c2cb' : '2px solid #334155',
                  background: catFilter === c.id ? '#00c2cb22' : 'transparent',
                  color: catFilter === c.id ? '#00c2cb' : '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  fontFamily: 'inherit',
                }}
              >
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
            <div style={productGridStyle}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ background: '#1e293b', borderRadius: 14, height: 320, opacity: 0.5 }}>
                  <div style={{ height: 160, background: '#334155', borderRadius: '14px 14px 0 0' }} />
                </div>
              ))}
            </div>
          ) : mergedProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📦</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>No products found</h2>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                {catFilter !== 'all' ? `No products yet in this category — be the first to list one.` : 'No products match your filters.'}
              </p>
              <Link href="/products/new" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.75rem 1.75rem', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
                + List a Product
              </Link>
            </div>
          ) : (
            <>
              <div style={productGridStyle}>
                {visibleProducts.map(entry => (
                  entry._type === 'community' ? (
                    <ProductCard
                      key={`community-${entry.item.id}`}
                      p={entry.item}
                      wishlist={wishlist}
                      onWishlist={toggleWishlist}
                      isOwner={isAdmin || (!!userId && entry.item.seller_id === userId)}
                      onDelete={handleDelete}
                      inBasket={communityBasketIds.has(entry.item.id)}
                      addingToBasket={basketBusyId === `community-${entry.item.id}`}
                      onAddToBasket={handleAddCommunityToBasket}
                    />
                  ) : (
                    <ExternalProductCard
                      key={`external-${entry.item.id}`}
                      product={entry.item}
                      onClick={handleExternalProductClick}
                      inBasket={externalBasketIds.has(entry.item.id)}
                      addingToBasket={basketBusyId === `external-${entry.item.id}`}
                      onSaveToBasket={handleSaveExternalToBasket}
                    />
                  )
                ))}
              </div>

              {hasMore && (
                <button
                  onClick={() => {
                    setLoadingMore(true)
                    setTimeout(() => {
                      setDisplayLimit(prev => prev + PRODUCTS_LOAD_MORE_BATCH)
                      setLoadingMore(false)
                    }, 300)
                  }}
                  disabled={loadingMore}
                  style={{
                    display: 'block',
                    width: '100%',
                    margin: '24px 0',
                    padding: '14px',
                    background: 'transparent',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: loadingMore ? '#475569' : '#94a3b8',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: loadingMore ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {loadingMore
                    ? 'Loading...'
                    : `Load More (${mergedProducts.length - displayLimit} remaining)`}
                </button>
              )}

              {!hasMore && mergedProducts.length > PRODUCTS_INITIAL_DISPLAY && (
                <p style={{
                  textAlign: 'center',
                  color: '#475569',
                  fontSize: '13px',
                  padding: '24px 0',
                  margin: 0,
                }}>
                  All {mergedProducts.length} products loaded
                </p>
              )}
            </>
          )}
        </>}

        {activeTab === 'find-online' && <FindOnlineTab />}
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
