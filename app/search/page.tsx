'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

type HitType = 'member' | 'service' | 'product' | 'event' | 'article' | 'org'
type FilterTab = 'all' | HitType

interface SearchHit {
  id: string
  type: HitType
  title: string
  subtitle?: string
  url: string
}

interface SearchResponse {
  hits: SearchHit[]
  total: number
  query: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<HitType, string> = {
  member:  '👤',
  service: '🛠',
  product: '📦',
  event:   '📅',
  article: '✍️',
  org:     '🏢',
}

const TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: 'all',     label: 'All',           icon: '🔍' },
  { key: 'member',  label: 'Members',       icon: '👤' },
  { key: 'org',     label: 'Organisations', icon: '🏢' },
  { key: 'service', label: 'Services',      icon: '🛠' },
  { key: 'product', label: 'Products',      icon: '📦' },
  { key: 'event',   label: 'Events',        icon: '📅' },
  { key: 'article', label: 'Articles',      icon: '✍️' },
]

// ─── Hit card ─────────────────────────────────────────────────────────────────

function HitCard({ hit }: { hit: SearchHit }) {
  return (
    <Link
      href={hit.url}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
        padding: '14px 16px', textDecoration: 'none', transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#38bdf8')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#334155')}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
        background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
      }}>
        {TYPE_ICON[hit.type]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hit.title}
        </div>
        {hit.subtitle && (
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hit.subtitle}
          </div>
        )}
        <div style={{ marginTop: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 7px', borderRadius: '20px' }}>
            {hit.type}
          </span>
        </div>
      </div>
      <span style={{ color: '#38bdf8', fontSize: '16px', flexShrink: 0 }}>→</span>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ height: '72px', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', animation: 'pulse 1.4s ease-in-out infinite' }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </>
  )
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function SearchPageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const initialQ = searchParams.get('q') ?? ''

  const [inputVal, setInputVal] = useState(initialQ)
  const [query,    setQuery]    = useState(initialQ)
  const [tab,      setTab]      = useState<FilterTab>('all')
  const [hits,     setHits]     = useState<SearchHit[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setHits([]); setTotal(0); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=50`, { cache: 'no-store' })
      if (!res.ok) throw new Error('search error')
      const data: SearchResponse = await res.json()
      setHits(data.hits ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setHits([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (query) doSearch(query)
  }, [query, doSearch])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = inputVal.trim()
    if (!q) return
    setQuery(q)
    setTab('all')
    router.push(`/search?q=${encodeURIComponent(q)}`, { scroll: false })
  }

  const visibleHits = tab === 'all' ? hits : hits.filter(h => h.type === tab)

  // Count per tab for badges
  const countByType = hits.reduce<Record<string, number>>((acc, h) => {
    acc[h.type] = (acc[h.type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      {/* Search bar */}
      <div style={{ position: 'sticky', top: '104px', zIndex: 80, background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '12px 16px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
              <input
                type="search"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="Search FreeTrust…"
                autoFocus
                style={{
                  width: '100%', background: '#1e293b', border: '1px solid #334155',
                  borderRadius: '10px', padding: '10px 14px 10px 36px', fontSize: '14px',
                  color: '#f1f5f9', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = '#38bdf8')}
                onBlur={e => (e.target.style.borderColor = '#334155')}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #38bdf8, #818cf8)', color: '#fff',
                fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              Search
            </button>
          </form>

          {/* Filter tabs */}
          {query && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', overflowX: 'auto', paddingBottom: '2px' }}>
              {TABS.map(t => {
                const count = t.key === 'all' ? total : (countByType[t.key] ?? 0)
                if (t.key !== 'all' && count === 0 && hits.length > 0) return null
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px',
                      borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px',
                      fontWeight: tab === t.key ? 700 : 400, fontFamily: 'inherit', whiteSpace: 'nowrap',
                      background: tab === t.key ? '#38bdf8' : 'rgba(56,189,248,0.07)',
                      color: tab === t.key ? '#0f172a' : '#64748b', transition: 'all 0.15s',
                    }}
                  >
                    {t.icon} {t.label}
                    {count > 0 && (
                      <span style={{ background: tab === t.key ? 'rgba(0,0,0,0.2)' : 'rgba(56,189,248,0.15)', color: tab === t.key ? '#0f172a' : '#38bdf8', fontSize: '10px', fontWeight: 700, padding: '0 5px', borderRadius: '10px' }}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '20px 16px 80px' }}>
        {/* Meta */}
        {query && !loading && hits.length > 0 && (
          <div style={{ fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
            {total} result{total !== 1 ? 's' : ''} for <strong style={{ color: '#94a3b8' }}>"{query}"</strong>
          </div>
        )}

        {loading && <Skeleton />}

        {/* Empty state — no query */}
        {!loading && !query && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#475569' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Search FreeTrust</div>
            <div style={{ fontSize: '14px' }}>Find members, services, products, events, and more</div>
          </div>
        )}

        {/* No results */}
        {!loading && query && visibleHits.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>😕</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>No results for "{query}"</div>
            <div style={{ fontSize: '13px' }}>Try different keywords or check your spelling</div>
          </div>
        )}

        {/* Results list */}
        {!loading && visibleHits.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visibleHits.map(hit => (
              <HitCard key={`${hit.type}-${hit.id}`} hit={hit} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Exported page ────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Loading…
      </div>
    }>
      <SearchPageInner />
    </Suspense>
  )
}
