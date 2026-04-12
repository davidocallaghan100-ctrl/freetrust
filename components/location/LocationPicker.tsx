'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  searchNominatim,
  reverseGeocode,
  getBrowserGeoPoint,
  type StructuredLocation,
  type NominatimSuggestion,
  EMPTY_LOCATION,
} from '@/lib/geo'

// ────────────────────────────────────────────────────────────────────────────
// LocationPicker
// ────────────────────────────────────────────────────────────────────────────
// Reusable text input + autocomplete dropdown that resolves a city/country
// match via Nominatim (OpenStreetMap). When the user picks a result it
// calls `onChange` with a full StructuredLocation so the caller can post
// it straight to the database.
//
// Also exposes a small "📍 Use my location" button that triggers the
// browser geolocation API and reverse-geocodes the result back to a
// label — used on listing create forms to speed up the common case.
//
// If the parent passes `onRemoteToggle`, a remote checkbox is rendered
// next to the input and the location becomes optional.
//
// Props:
//   value           — current StructuredLocation (from parent state)
//   onChange        — called with the new StructuredLocation
//   required        — disables the remote toggle path
//   placeholder     — input placeholder (default: "City, country")
//   remote          — current remote toggle state (optional)
//   onRemoteToggle  — if passed, render the remote toggle
//   remoteLabel     — label text for the remote toggle
//
// Pure inline styles (matches the rest of the codebase).

export interface LocationPickerProps {
  value: StructuredLocation
  onChange: (loc: StructuredLocation) => void
  placeholder?: string
  remote?: boolean
  onRemoteToggle?: (v: boolean) => void
  remoteLabel?: string
  autoFocus?: boolean
}

export default function LocationPicker({
  value,
  onChange,
  placeholder = 'City, country',
  remote = false,
  onRemoteToggle,
  remoteLabel = 'Available remotely / online',
  autoFocus = false,
}: LocationPickerProps) {
  const [query, setQuery] = useState(value.location_label ?? '')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<NominatimSuggestion[]>([])
  const [locating, setLocating] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync external value → local query text (e.g. parent resets the form)
  useEffect(() => {
    setQuery(value.location_label ?? '')
  }, [value.location_label])

  // Debounced Nominatim search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query === value.location_label) {
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
      } catch {
        // Swallow — user might type more
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const pick = useCallback(
    (s: NominatimSuggestion) => {
      onChange(s.structured)
      setQuery(s.structured.location_label ?? '')
      setOpen(false)
    },
    [onChange]
  )

  const clear = useCallback(() => {
    onChange(EMPTY_LOCATION)
    setQuery('')
    setResults([])
    setOpen(false)
  }, [onChange])

  const useMyLocation = useCallback(async () => {
    setLocating(true)
    try {
      const pt = await getBrowserGeoPoint()
      if (!pt) {
        setLocating(false)
        return
      }
      const struct = await reverseGeocode(pt.latitude, pt.longitude)
      onChange({ ...struct, latitude: pt.latitude, longitude: pt.longitude })
      setQuery(struct.location_label ?? `${pt.latitude.toFixed(3)}, ${pt.longitude.toFixed(3)}`)
    } finally {
      setLocating(false)
    }
  }, [onChange])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#64748b', fontSize: 15, pointerEvents: 'none',
          }}>📍</span>
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => query && setOpen(true)}
            placeholder={remote ? 'Optional (remote listing)' : placeholder}
            autoFocus={autoFocus}
            disabled={remote}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              background: remote ? '#0b1120' : '#0f172a',
              border: '1.5px solid #334155',
              borderRadius: 10,
              fontSize: 14,
              color: remote ? '#475569' : '#f1f5f9',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              opacity: remote ? 0.6 : 1,
            }}
          />
          {value.location_label && !remote && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear location"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: '#64748b',
                fontSize: 18, cursor: 'pointer', width: 24, height: 24, borderRadius: 4,
              }}
            >×</button>
          )}
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating || remote}
          style={{
            padding: '10px 12px', background: 'rgba(56,189,248,0.1)',
            border: '1px solid rgba(56,189,248,0.25)', borderRadius: 10,
            color: '#38bdf8', fontSize: 13, fontWeight: 600,
            cursor: (locating || remote) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
            opacity: (locating || remote) ? 0.5 : 1,
          }}
        >
          {locating ? '⏳' : '📍'} {locating ? 'Locating…' : 'Use my location'}
        </button>
      </div>

      {onRemoteToggle && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
          fontSize: 13, color: '#94a3b8', cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={remote}
            onChange={e => onRemoteToggle(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#38bdf8' }}
          />
          🌐 {remoteLabel}
        </label>
      )}

      {open && !remote && (loading || results.length > 0) && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 10, overflow: 'hidden', zIndex: 50,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {loading && (
            <div style={{ padding: '10px 14px', color: '#64748b', fontSize: 13 }}>Searching…</div>
          )}
          {!loading && results.map(r => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => pick(r)}
              style={{
                display: 'block', width: '100%', padding: '10px 14px',
                textAlign: 'left', background: 'transparent', border: 'none',
                color: '#f1f5f9', fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit', borderBottom: '1px solid rgba(148,163,184,0.08)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontWeight: 600 }}>{r.label}</div>
              {r.full_label !== r.label && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.full_label}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
