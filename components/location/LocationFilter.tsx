'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  searchNominatim,
  reverseGeocode,
  getBrowserGeoPoint,
  RADIUS_OPTIONS,
  type StructuredLocation,
  type NominatimSuggestion,
  type RadiusValue,
  EMPTY_LOCATION,
} from '@/lib/geo'

// ────────────────────────────────────────────────────────────────────────────
// LocationFilter
// ────────────────────────────────────────────────────────────────────────────
// Browse-page filter panel shared by products, services, jobs, events.
// Controls:
//   * Location input with Nominatim autocomplete
//   * "Near Me" button that uses navigator.geolocation
//   * Radius selector (5, 25, 50, 100, 500 km, Worldwide)
//   * Country dropdown (populated from the listings the caller passes in)
//   * Remote/Online toggle (only shown when `showRemote` is true)
//
// All state is fully controlled by the parent — no internal filter memory.
// This keeps the filter reset logic simple on the browse pages.
//
// Props:
//   location        — current structured location (or EMPTY_LOCATION)
//   onLocationChange
//   radiusKm        — current radius (0 = worldwide)
//   onRadiusChange
//   country         — current country filter or null
//   onCountryChange
//   countryOptions  — available country codes from the caller's data
//   remote          — remote toggle state
//   onRemoteChange  — if passed, render the remote toggle
//   showRemote      — show the remote toggle regardless of onRemoteChange
//   compact         — smaller mobile-friendly layout

export interface LocationFilterProps {
  location: StructuredLocation
  onLocationChange: (loc: StructuredLocation) => void
  radiusKm: RadiusValue
  onRadiusChange: (r: RadiusValue) => void
  country: string | null
  onCountryChange: (c: string | null) => void
  countryOptions: Array<{ code: string; label: string; count?: number }>
  remote?: boolean
  onRemoteChange?: (v: boolean) => void
  showRemote?: boolean
  compact?: boolean
}

export default function LocationFilter({
  location,
  onLocationChange,
  radiusKm,
  onRadiusChange,
  country,
  onCountryChange,
  countryOptions,
  remote = false,
  onRemoteChange,
  showRemote = false,
  compact = false,
}: LocationFilterProps) {
  const [query, setQuery] = useState(location.location_label ?? '')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<NominatimSuggestion[]>([])
  const [locating, setLocating] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(location.location_label ?? '')
  }, [location.location_label])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query === location.location_label) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        const r = await searchNominatim(query, 6, ctrl.signal)
        setResults(r)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const nearMe = useCallback(async () => {
    setLocating(true)
    try {
      const pt = await getBrowserGeoPoint()
      if (!pt) return
      const struct = await reverseGeocode(pt.latitude, pt.longitude)
      onLocationChange({ ...struct, latitude: pt.latitude, longitude: pt.longitude })
      setQuery(struct.location_label ?? `${pt.latitude.toFixed(2)}, ${pt.longitude.toFixed(2)}`)
      // If no radius set yet, default to 50 km so results are immediately useful
      if (radiusKm === 0) onRadiusChange(50)
    } finally {
      setLocating(false)
    }
  }, [onLocationChange, onRadiusChange, radiusKm])

  const pick = useCallback(
    (s: NominatimSuggestion) => {
      onLocationChange(s.structured)
      setQuery(s.structured.location_label ?? '')
      setOpen(false)
      if (radiusKm === 0) onRadiusChange(50)
    },
    [onLocationChange, onRadiusChange, radiusKm]
  )

  const clear = useCallback(() => {
    onLocationChange(EMPTY_LOCATION)
    onRadiusChange(0)
    setQuery('')
    setResults([])
    setOpen(false)
  }, [onLocationChange, onRadiusChange])

  const gap = compact ? 8 : 10

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex', gap, alignItems: 'center', flexWrap: 'wrap',
        position: 'relative', width: '100%',
      }}
    >
      {/* Location input with autocomplete */}
      <div style={{ position: 'relative', flex: compact ? '1 1 200px' : '1 1 240px', minWidth: 180 }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: '#64748b', fontSize: 14, pointerEvents: 'none',
        }}>🌍</span>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query && setOpen(true)}
          placeholder="Filter by city or country…"
          style={{
            width: '100%', padding: '9px 12px 9px 34px', background: '#0f172a',
            border: '1.5px solid #334155', borderRadius: 10, fontSize: 13,
            color: '#f1f5f9', outline: 'none', boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear"
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', color: '#64748b',
              fontSize: 16, cursor: 'pointer',
            }}
          >×</button>
        )}

        {open && (loading || results.length > 0) && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 10, overflow: 'hidden', zIndex: 50,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {loading && (
              <div style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>Searching…</div>
            )}
            {!loading && results.map(r => (
              <button
                key={r.place_id}
                type="button"
                onClick={() => pick(r)}
                style={{
                  display: 'block', width: '100%', padding: '10px 14px',
                  textAlign: 'left', background: 'transparent', border: 'none',
                  color: '#f1f5f9', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontWeight: 600 }}>{r.label}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={nearMe}
        disabled={locating}
        style={{
          padding: '9px 12px', background: 'rgba(56,189,248,0.1)',
          border: '1px solid rgba(56,189,248,0.25)', borderRadius: 10,
          color: '#38bdf8', fontSize: 12, fontWeight: 700,
          cursor: locating ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap', opacity: locating ? 0.5 : 1,
        }}
      >
        {locating ? '⏳ Locating…' : '📍 Near Me'}
      </button>

      <select
        value={radiusKm}
        onChange={e => onRadiusChange(Number(e.target.value) as RadiusValue)}
        disabled={!location.latitude}
        style={{
          padding: '9px 12px', background: '#0f172a',
          border: '1.5px solid #334155', borderRadius: 10, color: '#f1f5f9',
          fontSize: 12, fontFamily: 'inherit', cursor: location.latitude ? 'pointer' : 'not-allowed',
          opacity: location.latitude ? 1 : 0.5,
        }}
      >
        {RADIUS_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {countryOptions.length > 0 && (
        <select
          value={country ?? ''}
          onChange={e => onCountryChange(e.target.value || null)}
          style={{
            padding: '9px 12px', background: '#0f172a',
            border: '1.5px solid #334155', borderRadius: 10, color: '#f1f5f9',
            fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
            maxWidth: 220,
          }}
        >
          <option value="">All countries</option>
          {/*
            countryOptions are pre-sorted by buildCountryOptions() in
            lib/countries.ts: data-derived entries (with counts) appear
            FIRST, then every other ISO 3166-1 country alphabetically.
            We insert an inert disabled separator once we cross from
            counted to uncounted entries so the dropdown clearly shows
            "available now" vs "browse the world".
          */}
          {(() => {
            const nodes: React.ReactNode[] = []
            let separatorEmitted = false
            for (const c of countryOptions) {
              const hasCount = typeof c.count === 'number'
              if (!hasCount && !separatorEmitted) {
                nodes.push(
                  <option key="__divider__" disabled value="">
                    ──────────  All countries  ──────────
                  </option>
                )
                separatorEmitted = true
              }
              nodes.push(
                <option key={c.code} value={c.code}>
                  {c.label}{hasCount ? ` (${c.count})` : ''}
                </option>
              )
            }
            return nodes
          })()}
        </select>
      )}

      {(showRemote || onRemoteChange) && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px',
          background: remote ? 'rgba(52,211,153,0.1)' : '#0f172a',
          border: `1.5px solid ${remote ? 'rgba(52,211,153,0.3)' : '#334155'}`,
          borderRadius: 10, fontSize: 12, fontWeight: 600,
          color: remote ? '#34d399' : '#94a3b8', cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>
          <input
            type="checkbox"
            checked={remote}
            onChange={e => onRemoteChange?.(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: '#34d399' }}
          />
          🌐 Remote
        </label>
      )}
    </div>
  )
}
