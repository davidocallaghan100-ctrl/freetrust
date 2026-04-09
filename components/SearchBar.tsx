'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SearchHit {
  id: string
  type: 'member' | 'service' | 'product' | 'event' | 'article' | 'org'
  title: string
  subtitle?: string
  url: string
}

interface SearchResults {
  hits: SearchHit[]
  total: number
}

function typeIcon(t: SearchHit['type']) {
  return { member: '👤', service: '🛠', product: '📦', event: '📅', article: '✍️', org: '🏢' }[t]
}
function typeLabel(t: SearchHit['type']) {
  return { member: 'Member', service: 'Service', product: 'Product', event: 'Event', article: 'Article', org: 'Organisation' }[t]
}

export default function SearchBar() {
  const router = useRouter()
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<SearchHit[]>([])
  const [loading, setLoading]     = useState(false)
  const [open, setOpen]           = useState(false)
  const containerRef              = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`)
      if (!res.ok) throw new Error('search failed')
      const data: SearchResults = await res.json()
      setResults(data.hits ?? [])
      setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 300)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setOpen(false)
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  const handleResultClick = () => {
    setOpen(false)
    setQuery('')
  }

  // Group hits by type for display
  const grouped = results.reduce<Record<string, SearchHit[]>>((acc, hit) => {
    const label = typeLabel(hit.type)
    if (!acc[label]) acc[label] = []
    acc[label].push(hit)
    return acc
  }, {})

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: '58px',
        left: 0,
        right: 0,
        background: '#0a0f1e',
        borderBottom: '1px solid #1e293b',
        zIndex: 90,
        padding: '8px 16px',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#64748b', pointerEvents: 'none' }}>
              {loading ? '⏳' : '🔍'}
            </span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={handleChange}
              onFocus={() => { if (results.length > 0) setOpen(true) }}
              placeholder="Search members, services, events…"
              autoComplete="off"
              style={{
                width: '100%', background: '#1e293b', border: '1px solid #334155',
                borderRadius: open && results.length > 0 ? '10px 10px 0 0' : '10px',
                padding: '8px 14px 8px 36px', fontSize: '14px', color: '#f1f5f9',
                outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
              }}
              onFocusCapture={e => (e.target.style.borderColor = '#38bdf8')}
              onBlurCapture={e => (e.target.style.borderColor = '#334155')}
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '16px', lineHeight: 1, padding: '2px' }}
              >✕</button>
            )}
          </div>
        </form>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: '#1e293b', border: '1px solid #38bdf8', borderTop: 'none',
            borderRadius: '0 0 12px 12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 91, maxHeight: '380px', overflowY: 'auto',
          }}>
            {Object.entries(grouped).map(([label, hits]) => (
              <div key={label}>
                <div style={{ padding: '6px 14px 3px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {label}
                </div>
                {hits.map(hit => (
                  <Link
                    key={hit.id}
                    href={hit.url}
                    onClick={handleResultClick}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '9px 14px', textDecoration: 'none',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0 }}>{typeIcon(hit.type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hit.title}</div>
                      {hit.subtitle && <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hit.subtitle}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            ))}

            {/* View all */}
            <div style={{ borderTop: '1px solid #334155', padding: '8px 14px' }}>
              <button
                onClick={() => { setOpen(false); router.push(`/search?q=${encodeURIComponent(query)}`) }}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#38bdf8', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', textAlign: 'left', padding: 0 }}
              >
                🔍 See all results for "{query}"
              </button>
            </div>
          </div>
        )}

        {/* No results state */}
        {open && !loading && query.trim() && results.length === 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: '#1e293b', border: '1px solid #334155', borderTop: 'none',
            borderRadius: '0 0 12px 12px', padding: '16px 14px',
            color: '#64748b', fontSize: '13px', textAlign: 'center', zIndex: 91,
          }}>
            No results for "{query}"
          </div>
        )}
      </div>
    </div>
  )
}
