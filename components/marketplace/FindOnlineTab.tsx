'use client'

import React, { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isAffiliateTrackingEnabled, toAffiliateUrl } from '@/lib/skimlinks'

type SearchIntent = {
  keywords: string
  maxPrice: number | null
  category: string | null
}

type InternalResult = {
  id: string
  title: string
  description: string
  price: number
  currency: string
  image: string | null
  sellerName: string
  sellerAvatar: string | null
  sellerTrust: number | null
  sellerVerified: boolean
  qualityScore: number | null
}

type ExternalResult = {
  title: string
  price: string
  source: string
  link: string
  thumbnail: string
  rating: number | null
  reviews: number | null
}

type SelectedExternal = ExternalResult & { searchQuery: string }

const shellStyle: React.CSSProperties = {
  background: '#0a0f1e',
  border: '1px solid rgba(0,194,203,0.18)',
  borderRadius: 18,
  padding: 'clamp(1rem, 3vw, 1.5rem)',
  boxShadow: '0 22px 60px rgba(0,0,0,0.28)',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 220,
  background: '#111827',
  border: '1px solid rgba(148,163,184,0.24)',
  borderRadius: 12,
  color: '#ffffff',
  padding: '0.85rem 1rem',
  fontSize: 16,
  outline: 'none',
}

const tealButtonStyle: React.CSSProperties = {
  background: '#00c2cb',
  color: '#ffffff',
  border: 'none',
  borderRadius: 8,
  padding: '0.85rem 1.15rem',
  fontWeight: 800,
  cursor: 'pointer',
  minHeight: 46,
}

function formatPrice(amount: number, currency: string) {
  const code = currency || 'EUR'
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `€${amount.toFixed(2)}`
  }
}

function firstImage(row: Record<string, unknown>) {
  const cover = typeof row.cover_image === 'string' ? row.cover_image : null
  const images = Array.isArray(row.images) ? row.images : []
  const first = typeof images[0] === 'string' ? images[0] : null
  return cover || first
}

function keywordTerms(input: string) {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map(term => term.replace(/[^a-z0-9-]/g, ''))
    .filter(term => term.length >= 3)
    .slice(0, 6)
}

function SkeletonCard() {
  return (
    <div style={{ background: '#111827', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 12, padding: 14, minHeight: 170 }}>
      <div style={{ height: 88, borderRadius: 10, background: '#1f2937', opacity: 0.8, marginBottom: 12 }} />
      <div style={{ height: 14, borderRadius: 999, background: '#243244', width: '80%', marginBottom: 8 }} />
      <div style={{ height: 12, borderRadius: 999, background: '#243244', width: '52%' }} />
    </div>
  )
}

function FreeTrustCard({ item, onOpen }: { item: InternalResult; onOpen: (id: string) => void }) {
  return (
    <Link href={`/products/${item.id}`} onClick={e => { e.preventDefault(); onOpen(item.id) }} style={{ textDecoration: 'none' }}>
      <div style={{ background: '#111827', border: '1px solid rgba(0,194,203,0.16)', borderRadius: 12, overflow: 'hidden', minHeight: 260 }}>
        <div style={{ height: 134, background: item.image ? 'var(--ft-bg)' : 'linear-gradient(135deg,#00c2cb,#164e63)', position: 'relative' }}>
          {item.image ? <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          <div style={{ position: 'absolute', top: 10, left: 10, background: '#00c2cb', color: '#ffffff', borderRadius: 999, padding: '4px 9px', fontSize: '0.7rem', fontWeight: 900 }}>
            ₮ {item.sellerTrust ?? item.qualityScore ?? 0} Trust
          </div>
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', lineHeight: 1.25, marginBottom: 7 }}>{item.title}</div>
          <p style={{ margin: 0, color: 'var(--ft-text-secondary)', fontSize: '0.8rem', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            {item.sellerAvatar ? <img src={item.sellerAvatar} alt={item.sellerName} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--ft-border-strong)' }} />}
            <span style={{ color: 'var(--ft-text-secondary)', fontSize: '0.78rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sellerName}{item.sellerVerified ? ' ✓' : ''}</span>
            <strong style={{ color: '#ffffff', fontSize: '0.92rem' }}>{formatPrice(item.price, item.currency)}</strong>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ExternalCard({ item, onBuy }: { item: ExternalResult; onBuy: () => void }) {
  return (
    <div style={{ background: '#111827', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 12, overflow: 'hidden', minHeight: 260, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, right: 10, background: 'var(--ft-border-strong)', color: 'var(--ft-text-secondary)', borderRadius: 999, padding: '3px 8px', fontSize: '0.68rem', fontWeight: 800, zIndex: 1 }}>External</div>
      <div style={{ height: 134, background: 'var(--ft-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item.thumbnail ? <img src={item.thumbnail} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#ffffff' }} /> : <span style={{ fontSize: '2rem' }}>🛍️</span>}
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.92rem', lineHeight: 1.25, marginBottom: 7, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: 'var(--ft-text-secondary)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.source}</span>
          <strong style={{ color: '#ffffff', fontSize: '0.96rem', whiteSpace: 'nowrap' }}>{item.price || 'View price'}</strong>
        </div>
        {(item.rating || item.reviews) ? <div style={{ color: 'var(--ft-text-secondary)', fontSize: '0.75rem', marginBottom: 12 }}>★ {item.rating ?? '—'} {item.reviews ? `(${item.reviews})` : ''}</div> : <div style={{ height: 13, marginBottom: 12 }} />}
        <button onClick={onBuy} style={{ ...tealButtonStyle, width: '100%', padding: '0.7rem 1rem', minHeight: 40 }}>
          Buy via FreeTrust
        </button>
      </div>
    </div>
  )
}

export default function FindOnlineTab() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [intent, setIntent] = useState<SearchIntent | null>(null)
  const [internalResults, setInternalResults] = useState<InternalResult[]>([])
  const [externalResults, setExternalResults] = useState<ExternalResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedExternal | null>(null)
  const [loggingClick, setLoggingClick] = useState(false)

  async function requireAuth(redirectPath: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return true
    router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`)
    return false
  }

  async function openProductDetail(id: string) {
    const path = `/products/${id}`
    if (!(await requireAuth(path))) return
    router.push(path)
  }

  async function openCreateProduct() {
    const path = '/products/new'
    if (!(await requireAuth(path))) return
    router.push(path)
  }

  async function selectExternalResult(item: ExternalResult) {
    if (!(await requireAuth('/products'))) return
    setSelected({ ...item, searchQuery: intent?.keywords ?? query })
  }

  async function searchInternal(searchIntent: SearchIntent) {
    const terms = keywordTerms(searchIntent.keywords)
    const searchOr = terms.length > 0
      ? terms.flatMap(term => [`title.ilike.%${term}%`, `description.ilike.%${term}%`]).join(',')
      : `title.ilike.%${searchIntent.keywords}%,description.ilike.%${searchIntent.keywords}%`

    let builder = supabase
      .from('listings')
      .select('id, title, description, price, currency, currency_code, price_eur, images, cover_image, quality_score, seller_id, profiles!seller_id(id, full_name, avatar_url, trust_balance, is_verified)')
      .eq('status', 'active')
      .neq('product_type', 'service')
      .or(searchOr)
      .order('quality_score', { ascending: false })
      .limit(8)

    if (searchIntent.maxPrice != null) {
      builder = builder.lte('price_eur', searchIntent.maxPrice)
    }

    const { data, error: searchError } = await builder
    if (searchError) throw searchError

    return (data ?? []).map((row: Record<string, unknown>) => {
      const profile = row.profiles as Record<string, unknown> | null
      const priceEur = typeof row.price_eur === 'number' ? row.price_eur : null
      return {
        id: String(row.id),
        title: String(row.title ?? ''),
        description: String(row.description ?? ''),
        price: Number(priceEur ?? row.price ?? 0),
        currency: String(row.currency_code ?? row.currency ?? 'EUR'),
        image: firstImage(row),
        sellerName: String(profile?.full_name ?? 'FreeTrust Seller'),
        sellerAvatar: typeof profile?.avatar_url === 'string' ? profile.avatar_url : null,
        sellerTrust: typeof profile?.trust_balance === 'number' ? profile.trust_balance : null,
        sellerVerified: Boolean(profile?.is_verified),
        qualityScore: typeof row.quality_score === 'number' ? row.quality_score : null,
      }
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const rawQuery = query.trim()
    if (!rawQuery) return

    setLoading(true)
    setError(null)
    setInternalResults([])
    setExternalResults([])
    setIntent(null)

    try {
      const intentRes = await fetch('/api/parse-search-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: rawQuery }),
      })
      const parsed = await intentRes.json()
      if (!intentRes.ok) throw new Error(parsed?.error ?? 'Search parser failed')
      const nextIntent: SearchIntent = {
        keywords: parsed.keywords || rawQuery,
        maxPrice: typeof parsed.maxPrice === 'number' ? parsed.maxPrice : null,
        category: typeof parsed.category === 'string' ? parsed.category : null,
      }
      setIntent(nextIntent)

      const [internal, externalRes] = await Promise.all([
        searchInternal(nextIntent),
        fetch(`/api/search-external?q=${encodeURIComponent(nextIntent.keywords)}`).then(async res => {
          const json = await res.json()
          if (!res.ok) throw new Error(json?.error ?? 'External search failed')
          return json.results as ExternalResult[]
        }),
      ])

      setInternalResults(internal)
      setExternalResults(externalRes ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  async function continueToRetailer() {
    if (!selected) return
    if (!(await requireAuth('/products'))) return
    setLoggingClick(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('external_product_clicks').insert({
        user_id: user?.id ?? null,
        search_query: selected.searchQuery,
        product_title: selected.title,
        retailer_name: selected.source,
        product_url: selected.link,
        affiliate_link_generated: isAffiliateTrackingEnabled(),
        click_source: 'find_online',
      })
    } finally {
      setLoggingClick(false)
      window.open(toAffiliateUrl(selected.link), '_blank', 'noopener,noreferrer')
      setSelected(null)
    }
  }

  return (
    <div style={shellStyle}>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <label htmlFor="find-online-query" style={{ display: 'block', color: '#ffffff', fontWeight: 900, fontSize: '1.15rem', marginBottom: 12 }}>
          What are you looking for?
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <input
            id="find-online-query"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder='e.g. "wireless headphones under €50"'
            style={inputStyle}
          />
          <button type="submit" disabled={loading} style={{ ...tealButtonStyle, opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {intent ? (
          <div style={{ marginTop: 10, color: 'var(--ft-text-secondary)', fontSize: '0.82rem' }}>
            Searching for <strong style={{ color: '#00c2cb' }}>{intent.keywords}</strong>{intent.maxPrice ? ` under €${intent.maxPrice}` : ''}
          </div>
        ) : null}
      </form>

      {error ? <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fecaca', borderRadius: 12, padding: 12, marginBottom: 18 }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18, alignItems: 'start' }}>
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ height: 1, background: 'rgba(0,194,203,0.35)', flex: 1 }} />
            <h2 style={{ color: '#ffffff', fontSize: '1rem', margin: 0, whiteSpace: 'nowrap' }}>FreeTrust Sellers</h2>
            <div style={{ height: 1, background: 'rgba(0,194,203,0.35)', flex: 1 }} />
          </div>
          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2].map(i => <SkeletonCard key={i} />)}</div>
          ) : internalResults.length === 0 && intent ? (
            <div style={{ background: '#111827', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 12, padding: 18, textAlign: 'center' }}>
              <p style={{ color: 'var(--ft-text-secondary)', margin: '0 0 14px' }}>No FreeTrust sellers found for this product yet — be the first to list it!</p>
              <Link href="/products/new" onClick={e => { e.preventDefault(); void openCreateProduct() }} style={{ display: 'inline-block', background: '#00c2cb', color: '#ffffff', borderRadius: 8, padding: '0.7rem 1rem', fontWeight: 800, textDecoration: 'none' }}>+ List Product</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>{internalResults.map(item => <FreeTrustCard key={item.id} item={item} onOpen={openProductDetail} />)}</div>
          )}
        </section>

        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ height: 1, background: 'rgba(0,194,203,0.35)', flex: 1 }} />
            <h2 style={{ color: '#ffffff', fontSize: '1rem', margin: 0, whiteSpace: 'nowrap' }}>Online Prices</h2>
            <div style={{ height: 1, background: 'rgba(0,194,203,0.35)', flex: 1 }} />
          </div>
          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2].map(i => <SkeletonCard key={i} />)}</div>
          ) : externalResults.length === 0 && intent ? (
            <div style={{ background: '#111827', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 12, padding: 18, color: 'var(--ft-text-secondary)', textAlign: 'center' }}>
              No external results found. Try different keywords.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>{externalResults.map((item, index) => <ExternalCard key={`${item.link}-${index}`} item={item} onBuy={() => { void selectExternalResult(item) }} />)}</div>
          )}
        </section>
      </div>

      <p style={{ color: 'var(--ft-text-secondary)', fontSize: '0.78rem', lineHeight: 1.55, margin: '22px 0 0' }}>
        FreeTrust results show seller Trust Score. External prices are live retailer results and may change at checkout.
      </p>

      {selected ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div style={{ background: '#111827', color: '#ffffff', border: '1px solid rgba(0,194,203,0.35)', borderRadius: 16, padding: 22, maxWidth: 460, width: '100%', boxShadow: '0 22px 70px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem' }}>Continue through FreeTrust</h3>
            <p style={{ color: 'var(--ft-text-secondary)', lineHeight: 1.6, margin: '0 0 18px' }}>
              You’re about to buy from {selected.source}. FreeTrust earns a small referral fee on this purchase at no extra cost to you.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', color: 'var(--ft-text-secondary)', border: '1px solid var(--ft-border-strong)', borderRadius: 8, padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button onClick={continueToRetailer} disabled={loggingClick} style={{ ...tealButtonStyle, opacity: loggingClick ? 0.7 : 1, cursor: loggingClick ? 'wait' : 'pointer' }}>
                {loggingClick ? 'Opening…' : `Continue to ${selected.source}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
