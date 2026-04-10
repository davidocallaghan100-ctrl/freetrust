'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Category = 'All' | 'Tools' | 'Electronics' | 'Vehicles' | 'Clothing' | 'Space' | 'Equipment' | 'Other'

interface Listing {
  id: string
  title: string
  description: string
  category: string
  price_per_day: number | null
  price_per_week: number | null
  deposit: number | null
  location: string | null
  images: string[]
  available_from: string | null
  available_to: string | null
  status: string
  created_at: string
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null
}

const CATEGORIES: Category[] = ['All', 'Tools', 'Electronics', 'Vehicles', 'Clothing', 'Space', 'Equipment', 'Other']

const CAT_META: Record<string, { emoji: string; color: string; bg: string }> = {
  Tools:       { emoji: '🔧', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  Electronics: { emoji: '📱', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  Vehicles:    { emoji: '🚗', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  Clothing:    { emoji: '👔', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  Space:       { emoji: '🏠', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  Equipment:   { emoji: '⛺', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
  Other:       { emoji: '📦', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function catMeta(cat: string) {
  return CAT_META[cat] ?? CAT_META['Other']
}

function daysAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff}d ago`
}

function formatPrice(day: number | null, week: number | null) {
  if (day && week) return `€${day}/day · €${week}/wk`
  if (day) return `€${day}/day`
  if (week) return `€${week}/wk`
  return 'Free to borrow'
}

function ownerInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function ListingCard({ listing, onClick, isOwner }: { listing: Listing; onClick: () => void; isOwner: boolean }) {
  const meta = catMeta(listing.category)
  const hasImage = listing.images?.length > 0

  return (
    <div className="rs-card" onClick={onClick}>
      {/* Image / placeholder */}
      <div style={{
        height: 160, borderRadius: '10px 10px 0 0', overflow: 'hidden', flexShrink: 0,
        background: hasImage ? '#0f172a' : `linear-gradient(135deg, ${meta.bg.replace('0.12', '0.25')}, ${meta.bg})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}>
        {hasImage ? (
          <img src={listing.images[0]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 52 }}>{meta.emoji}</span>
        )}
        {/* Status badge */}
        {listing.status === 'rented' && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(248,113,113,0.9)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            Rented
          </div>
        )}
        {listing.status === 'active' && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(52,211,153,0.9)', color: '#0f172a', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            Available
          </div>
        )}
        {/* Category badge */}
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(15,23,42,0.8)', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: meta.color, backdropFilter: 'blur(4px)' }}>
          {meta.emoji} {listing.category}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.3 }}>{listing.title}</h3>

        {/* Owner + location */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {listing.owner?.avatar_url ? (
              <img src={listing.owner.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#0f172a', flexShrink: 0 }}>
                {ownerInitials(listing.owner?.full_name ?? null)}
              </div>
            )}
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{listing.owner?.full_name ?? 'Anonymous'}</span>
          </div>
          {listing.location && (
            <span style={{ fontSize: '0.72rem', color: '#475569' }}>📍 {listing.location}</span>
          )}
        </div>

        {/* Description snippet */}
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {listing.description}
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(56,189,248,0.06)' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
            {formatPrice(listing.price_per_day, listing.price_per_week)}
          </span>
          {isOwner ? (
            <Link
              href={`/rent-share/${listing.id}/edit`}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2dd4bf', background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.25)', borderRadius: 6, padding: '2px 8px', textDecoration: 'none' }}>
              ✏️ Edit
            </Link>
          ) : (
            <span style={{ fontSize: '0.7rem', color: '#475569' }}>{daysAgo(listing.created_at)}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RentSharePage() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setupRequired, setSetupRequired] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState<Category>('All')
  const [userId, setUserId] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchListings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '60' })
      if (category !== 'All') params.set('category', category)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/rent-share?${params}`)
      if (!res.ok) throw new Error('Failed to load listings')
      const data = await res.json() as { listings: Listing[]; _setup_required?: boolean }
      setSetupRequired(!!data._setup_required)
      setListings(data.listings ?? [])
    } catch {
      setError('Unable to load listings right now.')
    } finally {
      setLoading(false)
    }
  }, [category, debouncedSearch])

  useEffect(() => { void fetchListings() }, [fetchListings])

  const btnBase: React.CSSProperties = {
    padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.8rem', cursor: 'pointer',
    border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8',
    fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.15s',
  }
  const btnActive: React.CSSProperties = {
    background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)',
    color: '#38bdf8', fontWeight: 700,
  }

  function handleListClick(id: string) {
    router.push(`/rent-share/${id}`)
  }

  function handleListItem() {
    if (!userId) { router.push('/login'); return }
    router.push('/rent-share/new')
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64 }}>
      <style>{`
        .rs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
        .rs-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 12px; display: flex; flex-direction: column; cursor: pointer; transition: border-color 0.15s, transform 0.15s; overflow: hidden; }
        .rs-card:hover { border-color: rgba(56,189,248,0.3); transform: translateY(-2px); }
        .rs-card:active { transform: scale(0.99); }
        .rs-cats { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
        .spinner { display: inline-block; width: 28px; height: 28px; border: 3px solid rgba(56,189,248,0.2); border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) {
          .rs-grid { grid-template-columns: 1fr; }
          .rs-hero-row { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,rgba(45,212,191,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(45,212,191,0.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="rs-hero-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem' }}>♻️ Rent &amp; Share</h1>
              <p style={{ color: '#64748b', margin: 0 }}>Borrow, lend, and share with your community. Less waste, more trust.</p>
            </div>
            <button
              onClick={handleListItem}
              style={{ background: '#2dd4bf', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.6rem 1.3rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + List an Item
            </button>
          </div>

          {/* Search */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items or location..."
                style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 8, padding: '0.65rem 1rem 0.65rem 2.25rem', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <span style={{ fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
              {loading ? 'Loading…' : `${listings.length} items`}
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1.5rem 3rem' }}>
        {/* Setup required banner */}
        {setupRequired && (
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>Database table not set up yet</div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6 }}>
                Run the one-time setup to create the Rent &amp; Share tables and seed listings:
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <code style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '4px 10px', fontSize: '0.8rem', color: '#38bdf8' }}>
                  npm run setup:rent-share
                </code>
                <span style={{ fontSize: '0.8rem', color: '#64748b', alignSelf: 'center' }}>or paste <strong style={{ color: '#94a3b8' }}>supabase/setup-rent-share.sql</strong> into the Supabase SQL Editor</span>
              </div>
            </div>
          </div>
        )}

        {/* Category tabs */}
        <div className="rs-cats" style={{ marginBottom: '1.5rem' }}>
          {CATEGORIES.map(c => {
            const m = c !== 'All' ? catMeta(c) : null
            const isActive = category === c
            return (
              <button key={c} onClick={() => setCategory(c)} style={{
                ...btnBase,
                ...(isActive ? { background: m ? m.bg : 'rgba(56,189,248,0.1)', border: `1px solid ${m ? m.color + '50' : 'rgba(56,189,248,0.3)'}`, color: m ? m.color : '#38bdf8', fontWeight: 700 } : {}),
              }}>
                {m ? `${m.emoji} ` : ''}{c}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem 1rem', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
            <div style={{ fontSize: '0.9rem' }}>Loading listings…</div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</div>
            <button onClick={fetchListings} style={{ background: '#2dd4bf', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Try again
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>♻️</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#94a3b8' }}>No items found</div>
            <div style={{ marginBottom: '1.5rem' }}>Be the first to list something in your community</div>
            <button onClick={handleListItem} style={{ background: '#2dd4bf', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.65rem 1.5rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              + List an Item
            </button>
          </div>
        ) : (
          <div className="rs-grid">
            {listings.map(l => (
              <ListingCard key={l.id} listing={l} onClick={() => handleListClick(l.id)} isOwner={l.owner?.id === userId} />
            ))}
          </div>
        )}

        {/* Info banner */}
        {!loading && listings.length > 0 && (
          <div style={{ marginTop: '2.5rem', background: '#1e293b', border: '1px solid rgba(45,212,191,0.15)', borderRadius: 12, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1.5rem' }}>♻️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>Share what you have. Borrow what you need.</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Every rental replaces a purchase. Every share builds community trust.</div>
            </div>
            <button onClick={handleListItem} style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)', color: '#2dd4bf', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              List an Item →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
