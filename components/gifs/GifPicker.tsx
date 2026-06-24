'use client'

import { useEffect, useMemo, useState } from 'react'
import type { GifResult } from '@/lib/gifs'

type GifPickerProps = {
  selectedGif: GifResult | null
  onSelect: (gif: GifResult | null) => void
  disabled?: boolean
  compact?: boolean
}

export default function GifPicker({ selectedGif, onSelect, disabled = false, compact = false }: GifPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: compact ? '12' : '16' })
        const q = query.trim()
        if (q) params.set('q', q)
        const res = await fetch(`/api/gifs?${params.toString()}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({ gifs: [] })) as { gifs?: GifResult[] }
        if (!cancelled) setGifs(data.gifs ?? [])
      } catch {
        if (!cancelled) setGifs([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, query ? 220 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, query, compact])

  const panelWidth = useMemo(() => compact ? 290 : 330, [compact])

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        aria-label="Add a GIF"
        title="Add a funny GIF"
        style={{
          border: selectedGif ? '1px solid rgba(52,211,153,0.45)' : '1px solid rgba(148,163,184,0.2)',
          background: selectedGif ? 'rgba(52,211,153,0.14)' : 'rgba(15,23,42,0.75)',
          color: selectedGif ? '#86efac' : '#cbd5e1',
          borderRadius: 999,
          minWidth: compact ? 34 : 40,
          height: compact ? 30 : 36,
          padding: compact ? '0 0.55rem' : '0 0.75rem',
          fontSize: compact ? 12 : 13,
          fontWeight: 800,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        GIF
      </button>
      {selectedGif && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="Remove selected GIF"
          style={{
            marginLeft: 6,
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: '1px solid rgba(148,163,184,0.22)',
            background: 'rgba(15,23,42,0.85)',
            color: '#cbd5e1',
            cursor: 'pointer',
            fontWeight: 900,
          }}
        >×</button>
      )}
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: 'calc(100% + 10px)',
            width: panelWidth,
            maxWidth: 'calc(100vw - 28px)',
            padding: 10,
            borderRadius: 18,
            border: '1px solid rgba(56,189,248,0.2)',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
            boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
            zIndex: 80,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search funny GIFs"
              autoFocus
              style={{
                flex: 1,
                minWidth: 0,
                height: 36,
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.22)',
                background: 'rgba(15,23,42,0.9)',
                color: '#f8fafc',
                outline: 'none',
                padding: '0 12px',
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            />
            <button type="button" onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, maxHeight: compact ? 250 : 320, overflowY: 'auto' }}>
            {gifs.map(gif => (
              <button
                type="button"
                key={`${gif.source}-${gif.id}`}
                onClick={() => { onSelect(gif); setOpen(false) }}
                title={gif.title}
                style={{
                  border: '1px solid rgba(148,163,184,0.16)',
                  background: 'rgba(15,23,42,0.72)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  padding: 0,
                  cursor: 'pointer',
                  aspectRatio: '1.25 / 1',
                }}
              >
                {/* External animated GIF previews are intentionally rendered with img. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gif.previewUrl} alt={gif.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
            {!loading && gifs.length === 0 && (
              <div style={{ gridColumn: '1 / -1', color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '1rem 0' }}>No GIFs found.</div>
            )}
          </div>
          <div style={{ marginTop: 8, color: '#64748b', fontSize: 10, textAlign: 'center' }}>
            {loading ? 'Searching…' : 'Tap a GIF to attach it'}
          </div>
        </div>
      )}
    </div>
  )
}
