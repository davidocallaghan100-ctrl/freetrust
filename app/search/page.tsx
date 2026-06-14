'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type HitType = 'member' | 'post' | 'service' | 'product' | 'job' | 'event' | 'article' | 'org' | 'grassroots'
type FeedFilter = 'all' | 'photos' | 'videos' | 'articles' | 'services' | 'jobs' | 'events' | 'trending'
type Scope = 'discover' | 'following'

interface SearchHit {
  id: string
  type: HitType
  title: string
  subtitle?: string
  snippet?: string
  url: string
  avatarUrl?: string | null
  authorName?: string | null
  authorAvatarUrl?: string | null
  createdAt?: string | null
  thumbnailUrl?: string | null
  thumbnailKind?: 'image' | 'video'
}

interface SearchResponse {
  hits: SearchHit[]
  total: number
  query: string
  filter?: string
  scope?: string
  message?: string
}

const FILTERS: { key: FeedFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '🔍' },
  { key: 'photos', label: 'Photos', icon: '📷' },
  { key: 'videos', label: 'Videos', icon: '🎬' },
  { key: 'articles', label: 'Articles', icon: '📰' },
  { key: 'services', label: 'Services', icon: '🛠' },
  { key: 'jobs', label: 'Jobs', icon: '💼' },
  { key: 'events', label: 'Events', icon: '📅' },
  { key: 'trending', label: 'Trending', icon: '🔥' },
]

const TYPE_LABEL: Record<HitType, string> = {
  member: 'Member',
  post: 'Post',
  service: 'Service',
  product: 'Product',
  job: 'Job',
  event: 'Event',
  article: 'Article',
  org: 'Organisation',
  grassroots: 'Grassroots',
}

const TYPE_ICON: Record<HitType, string> = {
  member: '👤',
  post: '📰',
  service: '🛠️',
  product: '📦',
  job: '💼',
  event: '📅',
  article: '✍️',
  org: '🏢',
  grassroots: '🌱',
}

function normaliseFilter(value: string | null): FeedFilter {
  return FILTERS.some((f) => f.key === value) ? (value as FeedFilter) : 'all'
}

function normaliseScope(value: string | null): Scope {
  return value === 'following' ? 'following' : 'discover'
}

function formatDate(value?: string | null): string | null {
  if (!value) return null
  try { return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return null }
}

function getInitials(name?: string | null) {
  return (name || 'FT').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'FT'
}

function Highlight({ text, query }: { text?: string | null; query: string }) {
  if (!text) return null
  const q = query.trim()
  if (!q) return <>{text}</>
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${escaped})`, 'ig')
  const parts = text.split(re)
  return <>{parts.map((part, idx) => part.toLowerCase() === q.toLowerCase() ? <mark key={idx} className="search-page__mark">{part}</mark> : <span key={idx}>{part}</span>)}</>
}

function Avatar({ src, name }: { src?: string | null; name?: string | null }) {
  if (src) return <img className="search-card__avatar" src={src} alt="" />
  return <span className="search-card__avatar search-card__avatar--fallback">{getInitials(name)}</span>
}

function SearchFeedCard({ hit, query }: { hit: SearchHit; query: string }) {
  const author = hit.authorName || hit.title
  const date = formatDate(hit.createdAt)
  return (
    <Link href={hit.url} className="search-card">
      <div className="search-card__top">
        <Avatar src={hit.authorAvatarUrl || hit.avatarUrl} name={author} />
        <div className="search-card__byline">
          <div className="search-card__author"><Highlight text={author} query={query} /> <span className={`search-card__badge search-card__badge--${hit.type}`}>{TYPE_ICON[hit.type]} {TYPE_LABEL[hit.type]}</span></div>
          <div className="search-card__meta">{[date, hit.subtitle].filter(Boolean).join(' · ')}</div>
        </div>
        <span className="search-card__arrow">→</span>
      </div>

      <div className="search-card__body">
        <h2><Highlight text={hit.title} query={query} /></h2>
        {hit.snippet && <p><Highlight text={hit.snippet} query={query} /></p>}
      </div>

      {hit.thumbnailUrl && (
        <div className="search-card__media">
          <img src={hit.thumbnailUrl} alt="" loading="lazy" />
        </div>
      )}

      <div className="search-card__footer">
        <span>{hit.url}</span>
        <strong>Open</strong>
      </div>
    </Link>
  )
}

function Skeleton() {
  return <div className="search-stack">{[0, 1, 2].map((i) => <div key={i} className="search-skeleton" />)}</div>
}

function SearchPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlQuery = searchParams.get('q') ?? ''
  const urlFilter = normaliseFilter(searchParams.get('filter'))
  const urlScope = normaliseScope(searchParams.get('scope'))

  const [inputVal, setInputVal] = useState(urlQuery)
  const [query, setQuery] = useState(urlQuery)
  const [filter, setFilter] = useState<FeedFilter>(urlFilter)
  const [scope, setScope] = useState<Scope>(urlScope)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [total, setTotal] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchSeqRef = useRef(0)

  useEffect(() => {
    setInputVal(urlQuery)
    setQuery(urlQuery)
    setFilter(urlFilter)
    setScope(urlScope)
  }, [urlQuery, urlFilter, urlScope])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: total }
    for (const hit of hits) {
      if (hit.type === 'post') {
        c.photos = (c.photos ?? 0) + (hit.thumbnailKind === 'image' ? 1 : 0)
        c.videos = (c.videos ?? 0) + (hit.thumbnailKind === 'video' ? 1 : 0)
      }
      if (hit.type === 'article') c.articles = (c.articles ?? 0) + 1
      if (hit.type === 'service') c.services = (c.services ?? 0) + 1
      if (hit.type === 'job') c.jobs = (c.jobs ?? 0) + 1
      if (hit.type === 'event') c.events = (c.events ?? 0) + 1
    }
    return c
  }, [hits, total])

  const runSearch = useCallback(async (q: string, nextFilter: FeedFilter, nextScope: Scope) => {
    const trimmed = q.trim()
    const seq = ++fetchSeqRef.current
    if (!trimmed) {
      setHits([]); setTotal(0); setMessage(null); setLoading(false)
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const params = new URLSearchParams({ q: trimmed, filter: nextFilter, scope: nextScope, limit: '50' })
      const res = await fetch(`/api/search?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('search error')
      const data = (await res.json()) as SearchResponse
      if (seq !== fetchSeqRef.current) return
      setHits(data.hits ?? [])
      setTotal(data.total ?? 0)
      setMessage(data.message ?? null)
    } catch {
      if (seq !== fetchSeqRef.current) return
      setHits([])
      setTotal(0)
      setMessage('search_failed')
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    runSearch(query, filter, scope)
  }, [query, filter, scope, runSearch])

  const pushSearch = (nextQuery: string, nextFilter: FeedFilter, nextScope: Scope) => {
    const params = new URLSearchParams()
    params.set('q', nextQuery)
    if (nextFilter !== 'all') params.set('filter', nextFilter)
    if (nextScope !== 'discover') params.set('scope', nextScope)
    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = inputVal.trim()
    if (!q) return
    setHits([])
    setTotal(0)
    // New text search always resets to Discover + All so stale filters cannot leak.
    pushSearch(q, 'all', 'discover')
  }

  const updateFilter = (next: FeedFilter) => {
    setFilter(next)
    pushSearch(query, next, scope)
  }

  const updateScope = (next: Scope) => {
    setScope(next)
    pushSearch(query, filter, next)
  }

  return (
    <div className="search-page">
      <section className="search-hero">
        <form onSubmit={handleSubmit} className="search-form">
          <span aria-hidden="true">🔍</span>
          <input value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="Search FreeTrust…" type="search" />
          <button type="submit">Search</button>
        </form>
        <div className="scope-toggle" role="tablist" aria-label="Search scope">
          <button type="button" className={scope === 'discover' ? 'active' : ''} onClick={() => updateScope('discover')}>✨ Discover</button>
          <button type="button" className={scope === 'following' ? 'active' : ''} onClick={() => updateScope('following')}>👥 Following</button>
        </div>
        <div className="filter-row" aria-label="Search filters">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={filter === f.key ? 'active' : ''} onClick={() => updateFilter(f.key)}>
              {f.icon} {f.label}{(counts[f.key] ?? 0) > 0 ? <span>{counts[f.key]}</span> : null}
            </button>
          ))}
        </div>
      </section>

      <main className="search-main">
        {query && !loading && !message && hits.length > 0 && <p className="search-meta">{total} result{total === 1 ? '' : 's'} for "<Highlight text={query} query={query} />"{filter !== 'all' ? ` · ${FILTERS.find((f) => f.key === filter)?.label}` : ''}</p>}
        {loading && <Skeleton />}
        {!loading && message === 'sign_in_required' && <div className="search-empty"><h2>Sign in to search Following</h2><p>Discover results are still available for everyone.</p></div>}
        {!loading && !query && <div className="search-empty"><h2>Search FreeTrust</h2><p>Find members, posts, services, jobs, events, and more.</p></div>}
        {!loading && query && !message && hits.length === 0 && <div className="search-empty"><h2>No results for "{query}"</h2><p>Try a different keyword or switch back to All.</p></div>}
        {!loading && hits.length > 0 && <div className="search-stack">{hits.map((hit) => <SearchFeedCard key={`${hit.type}-${hit.id}`} hit={hit} query={query} />)}</div>}
      </main>

      <style jsx global>{`
        .search-page { min-height: 100vh; background: #0f172a; color: #f8fafc; }
        .search-hero { position: sticky; top: 0; z-index: 40; background: rgba(15,23,42,.96); border-bottom: 1px solid rgba(148,163,184,.16); padding: 12px 16px 14px; backdrop-filter: blur(16px); }
        .search-form { max-width: 700px; margin: 0 auto; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 0 0 0 14px; }
        .search-form input { width: 100%; background: transparent; border: 0; color: #f8fafc; font-size: 16px; outline: none; padding: 13px 0; }
        .search-form button { margin: 5px; border: 0; border-radius: 12px; padding: 12px 18px; color: white; font-weight: 800; background: linear-gradient(135deg, #38bdf8, #818cf8); }
        .scope-toggle { max-width: 700px; margin: 12px auto 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border: 1px solid #26364f; border-radius: 999px; padding: 4px; }
        .scope-toggle button, .filter-row button { border: 0; color: #94a3b8; background: transparent; border-radius: 999px; font-weight: 800; padding: 10px 12px; white-space: nowrap; }
        .scope-toggle button.active, .filter-row button.active { color: #06111f; background: linear-gradient(135deg, #38bdf8, #818cf8); }
        .filter-row { max-width: 700px; margin: 12px auto 0; display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
        .filter-row::-webkit-scrollbar { display: none; }
        .filter-row button { background: rgba(56,189,248,.08); color: #64748b; }
        .filter-row button span { margin-left: 6px; padding: 1px 7px; border-radius: 999px; background: rgba(15,23,42,.25); font-size: 11px; }
        .search-main { max-width: 700px; margin: 0 auto; padding: 22px 16px 96px; }
        .search-meta { color: #94a3b8; font-size: 14px; margin: 0 0 18px; }
        .search-page__mark { background: rgba(134,239,172,.28); color: #bbf7d0; border-radius: 6px; padding: 0 3px; font-weight: 900; }
        .search-stack { display: flex; flex-direction: column; gap: 14px; }
        .search-card { display: block; text-decoration: none; color: inherit; background: #1e293b; border: 1px solid #334155; border-radius: 18px; overflow: hidden; box-shadow: 0 18px 50px rgba(2,6,23,.22); }
        .search-card__top { display: flex; align-items: center; gap: 12px; padding: 16px 16px 4px; }
        .search-card__avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; background: #334155; flex: 0 0 auto; }
        .search-card__avatar--fallback { display: inline-flex; align-items: center; justify-content: center; color: #0f172a; background: linear-gradient(135deg,#38bdf8,#22c55e); font-weight: 900; }
        .search-card__byline { flex: 1; min-width: 0; }
        .search-card__author { color: #f8fafc; font-weight: 900; line-height: 1.25; }
        .search-card__meta { margin-top: 4px; color: #64748b; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .search-card__badge { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; padding: 3px 8px; border-radius: 999px; color: #38bdf8; background: rgba(56,189,248,.15); font-size: 12px; }
        .search-card__badge--service { color: #34d399; background: rgba(52,211,153,.14); }
        .search-card__badge--job { color: #93c5fd; background: rgba(96,165,250,.16); }
        .search-card__arrow { color: #38bdf8; font-size: 28px; }
        .search-card__body { padding: 12px 16px 16px; }
        .search-card__body h2 { margin: 0 0 10px; font-size: 22px; line-height: 1.2; color: #f8fafc; }
        .search-card__body p { margin: 0; color: #cbd5e1; font-size: 16px; line-height: 1.55; }
        .search-card__media { background: #0f172a; border-top: 1px solid rgba(148,163,184,.16); }
        .search-card__media img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; }
        .search-card__footer { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px 14px; border-top: 1px solid rgba(148,163,184,.12); color: #38bdf8; font-weight: 800; }
        .search-card__footer span { min-width: 0; overflow-wrap: anywhere; }
        .search-skeleton { min-height: 260px; border-radius: 18px; background: linear-gradient(90deg,#1e293b,#26364f,#1e293b); animation: pulse 1.3s ease-in-out infinite; }
        .search-empty { text-align: center; padding: 72px 18px; color: #94a3b8; }
        .search-empty h2 { color: #e2e8f0; margin: 0 0 8px; }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }
        @media (max-width: 640px) {
          .search-hero { padding: 10px 16px 12px; }
          .search-main { padding: 18px 0 92px; }
          .search-meta { padding: 0 16px; }
          .search-stack { gap: 0; }
          .search-card { border-left: 0; border-right: 0; border-radius: 0; }
          .search-card + .search-card { border-top: 12px solid #0f172a; }
          .search-card__top, .search-card__body, .search-card__footer { padding-left: 16px; padding-right: 16px; }
          .search-card__body h2 { font-size: 23px; }
          .search-card__body p { font-size: 18px; line-height: 1.6; }
          .search-card__media img { aspect-ratio: 1 / .72; }
        }
      `}</style>
    </div>
  )
}

export default function SearchPage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f172a' }} />}><SearchPageInner /></Suspense>
}
