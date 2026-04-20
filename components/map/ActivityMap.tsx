'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Script from 'next/script'

// ─── Pin types ───────────────────────────────────────────────────────────────
type PinType = 'member' | 'event' | 'product' | 'job'

interface BasePin {
  id: string
  type: PinType
  latitude: number
  longitude: number
  city?: string | null
  country?: string | null
}
interface MemberPin extends BasePin {
  type: 'member'
  username: string
  avatar_url?: string | null
  bio?: string | null
}
interface EventPin extends BasePin {
  type: 'event'
  title: string
  starts_at?: string | null
  venue_name?: string | null
  ticket_price?: number | null
  is_paid?: boolean
}
interface ProductPin extends BasePin {
  type: 'product'
  title: string
  price_eur?: number | null
  cover_image_url?: string | null
  category?: string | null
}
interface JobPin extends BasePin {
  type: 'job'
  title: string
  salary_min_eur?: number | null
  salary_max_eur?: number | null
}

type Pin = MemberPin | EventPin | ProductPin | JobPin

// ─── Config ──────────────────────────────────────────────────────────────────
const LAYER_CONFIG: Record<PinType, { label: string; emoji: string; color: string; glow: string }> = {
  member:  { label: 'Members',  emoji: '👤', color: '#6c63ff', glow: 'rgba(108,99,255,0.6)' },
  event:   { label: 'Events',   emoji: '🎟️', color: '#f59e0b', glow: 'rgba(245,158,11,0.6)' },
  product: { label: 'Products', emoji: '📦', color: '#00d4aa', glow: 'rgba(0,212,170,0.6)' },
  job:     { label: 'Jobs',     emoji: '💼', color: '#38bdf8', glow: 'rgba(56,189,248,0.6)' },
}

function buildMarkerHtml(color: string, glow: string): string {
  return `<div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;inset:-6px;background:radial-gradient(circle,${glow} 0%,transparent 70%);border-radius:50%;pointer-events:none"></div>
    <div style="width:16px;height:16px;background:radial-gradient(circle,#ffffff 0%,${color} 45%,${color}cc 100%);border-radius:50%;box-shadow:0 0 10px 3px ${glow},0 0 20px 6px ${color}44;cursor:pointer;flex-shrink:0"></div>
  </div>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildPopupHtml(pin: Pin): string {
  const base = 'background:#13131a;color:#f1f5f9;padding:14px 16px;border-radius:12px;min-width:200px;max-width:260px;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;'
  const btn = (color: string, href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;margin-top:10px;padding:6px 14px;border-radius:20px;background:${color};color:${color === '#f59e0b' || color === '#00d4aa' || color === '#38bdf8' ? '#0a0a0f' : '#fff'};font-weight:600;font-size:12px;text-decoration:none;">${label}</a>`

  if (pin.type === 'member') {
    const p = pin as MemberPin
    const avatar = p.avatar_url
      ? `<img src="${esc(p.avatar_url)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #6c63ff;flex-shrink:0" />`
      : `<div style="width:40px;height:40px;border-radius:50%;background:#6c63ff;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">👤</div>`
    const loc = [p.city, p.country].filter(Boolean).join(', ')
    const bio = p.bio ? `<div style="color:#94a3b8;font-size:12px;margin-top:4px">${esc(p.bio.slice(0, 70))}${p.bio.length > 70 ? '…' : ''}</div>` : ''
    return `<div style="${base}"><div style="display:flex;align-items:center;gap:10px">${avatar}<div><div style="font-weight:700">@${esc(p.username)}</div>${loc ? `<div style="color:#64748b;font-size:11px">📍 ${esc(loc)}</div>` : ''}</div></div>${bio}${btn('#6c63ff', `/members/${encodeURIComponent(p.username)}`, 'View Profile →')}</div>`
  }
  if (pin.type === 'event') {
    const e = pin as EventPin
    const loc = [e.venue_name, e.city].filter(Boolean).join(', ')
    const date = e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
    const price = e.is_paid && e.ticket_price ? `€${Number(e.ticket_price).toFixed(2)}` : 'Free'
    return `<div style="${base}"><div style="font-weight:700;font-size:14px">${esc(e.title)}</div>${date ? `<div style="color:#94a3b8;margin-top:4px">📅 ${esc(date)}</div>` : ''}${loc ? `<div style="color:#94a3b8">📍 ${esc(loc)}</div>` : ''}<div style="color:#f59e0b;font-weight:600;margin-top:4px">${esc(price)}</div>${btn('#f59e0b', `/events/${encodeURIComponent(e.id)}`, 'View Event →')}</div>`
  }
  if (pin.type === 'product') {
    const p = pin as ProductPin
    const loc = [p.city, p.country].filter(Boolean).join(', ')
    const img = p.cover_image_url ? `<img src="${esc(p.cover_image_url)}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:8px" />` : ''
    const price = p.price_eur ? `€${Number(p.price_eur).toFixed(2)}` : ''
    return `<div style="${base}">${img}<div style="font-weight:700">${esc(p.title)}</div>${price ? `<div style="color:#00d4aa;font-weight:600;margin-top:2px">${esc(price)}</div>` : ''}${loc ? `<div style="color:#64748b;font-size:11px">📍 ${esc(loc)}</div>` : ''}${btn('#00d4aa', `/listing/${encodeURIComponent(p.id)}`, 'View Listing →')}</div>`
  }
  if (pin.type === 'job') {
    const j = pin as JobPin
    const loc = [j.city, j.country].filter(Boolean).join(', ')
    const salary = j.salary_min_eur ? `€${Number(j.salary_min_eur / 1000).toFixed(0)}k${j.salary_max_eur ? ` – €${Number(j.salary_max_eur / 1000).toFixed(0)}k` : '+'}` : 'Competitive salary'
    return `<div style="${base}"><div style="font-weight:700">${esc(j.title)}</div><div style="color:#38bdf8;font-weight:600;margin-top:4px">💰 ${esc(salary)}</div>${loc ? `<div style="color:#94a3b8">📍 ${esc(loc)}</div>` : ''}${btn('#38bdf8', `/jobs/${encodeURIComponent(j.id)}`, 'View Job →')}</div>`
  }
  return ''
}

// ─── Declare maplibregl on window ─────────────────────────────────────────────
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    maplibregl: any
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ActivityMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, { marker: any; type: PinType }>>(new Map())

  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [scriptsLoaded, setScriptsLoaded] = useState(false)
  const [activeLayers, setActiveLayers] = useState<Set<PinType>>(
    new Set<PinType>(['member', 'event', 'product', 'job'])
  )

  // Fetch pins
  useEffect(() => {
    fetch('/api/map/pins')
      .then(r => r.json())
      .then(d => { setPins(d.pins ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Init map once CDN script loaded
  useEffect(() => {
    if (!scriptsLoaded || !containerRef.current || mapRef.current) return
    const maplibregl = window.maplibregl
    if (!maplibregl) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
      center: [0, 20],
      zoom: 2,
      attributionControl: false,
    })

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      mapRef.current = map
      setMapReady(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptsLoaded])

  // Add markers once map + pins ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || loading) return
    const maplibregl = window.maplibregl
    if (!maplibregl) return
    const map = mapRef.current

    // Remove old markers
    markersRef.current.forEach(({ marker }) => marker.remove())
    markersRef.current.clear()

    for (const pin of pins) {
      if (typeof pin.latitude !== 'number' || typeof pin.longitude !== 'number') continue
      const cfg = LAYER_CONFIG[pin.type]

      const el = document.createElement('div')
      el.style.overflow = 'visible'
      el.innerHTML = buildMarkerHtml(cfg.color, cfg.glow)

      const popup = new maplibregl.Popup({
        closeButton: true,
        maxWidth: '280px',
        className: 'ft-popup',
        offset: 20,
      }).setHTML(buildPopupHtml(pin))

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.longitude, pin.latitude])
        .setPopup(popup)
        .addTo(map)

      if (!activeLayers.has(pin.type)) {
        el.style.display = 'none'
      }

      markersRef.current.set(pin.id, { marker, type: pin.type })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, pins, loading])

  // Toggle layer visibility
  useEffect(() => {
    markersRef.current.forEach(({ marker, type }) => {
      const el = marker.getElement() as HTMLDivElement
      el.style.display = activeLayers.has(type) ? '' : 'none'
    })
  }, [activeLayers])

  const toggleLayer = useCallback((type: PinType) => {
    setActiveLayers(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type); else next.add(type)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setActiveLayers(prev =>
      prev.size === 4 ? new Set() : new Set<PinType>(['member', 'event', 'product', 'job'])
    )
  }, [])

  const flyToMe = useCallback(() => {
    if (!mapRef.current) return
    navigator.geolocation.getCurrentPosition(pos => {
      mapRef.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 10, speed: 1.5 })
    })
  }, [])

  const allOn = activeLayers.size === 4

  return (
    <>
      {/* Load MapLibre GL from CDN — avoids webpack/SSR bundling issues */}
      <Script
        src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(true)}
      />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Popup CSS overrides */}
        <style>{`
          .ft-popup .maplibregl-popup-content {
            background: #13131a !important;
            border: 1px solid #2a2a3a !important;
            border-radius: 12px !important;
            padding: 0 !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          }
          .ft-popup .maplibregl-popup-close-button {
            color: #94a3b8 !important;
            font-size: 18px !important;
            padding: 4px 8px !important;
            background: transparent !important;
          }
          .ft-popup .maplibregl-popup-tip {
            border-top-color: #2a2a3a !important;
            border-bottom-color: #2a2a3a !important;
          }
          .maplibregl-ctrl-attrib {
            background: rgba(13,13,26,0.8) !important;
            color: #64748b !important;
          }
          .maplibregl-ctrl-attrib a { color: #6c63ff !important; }
          @keyframes ft-spin { to { transform: rotate(360deg); } }
        `}</style>

        {/* Layer toggles */}
        <div style={{
          display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto',
          background: '#0d0d1a', borderBottom: '1px solid #1e1e2e', flexShrink: 0,
          scrollbarWidth: 'none',
        }}>
          <button onClick={toggleAll} style={{
            flexShrink: 0, padding: '6px 16px', borderRadius: 20,
            border: `1.5px solid ${allOn ? '#6c63ff' : '#2a2a3a'}`,
            background: allOn ? 'rgba(108,99,255,0.15)' : 'transparent',
            color: allOn ? '#6c63ff' : '#94a3b8',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>✦ All</button>

          {(Object.entries(LAYER_CONFIG) as [PinType, typeof LAYER_CONFIG[PinType]][]).map(([type, cfg]) => {
            const active = activeLayers.has(type)
            return (
              <button key={type} onClick={() => toggleLayer(type)} style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                border: `1.5px solid ${active ? cfg.color : '#2a2a3a'}`,
                background: active ? `${cfg.color}22` : 'transparent',
                color: active ? cfg.color : '#94a3b8',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: active ? cfg.color : '#55556a',
                  boxShadow: active ? `0 0 8px 2px ${cfg.glow}` : 'none',
                  flexShrink: 0,
                }} />
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Map container */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {/* Loading overlay */}
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: '#0a0a0f',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                border: '3px solid #1e1e2e', borderTop: '3px solid #6c63ff',
                animation: 'ft-spin 0.8s linear infinite',
              }} />
              <p style={{ color: '#64748b', marginTop: 12, fontSize: 13 }}>Loading activity…</p>
            </div>
          )}

          {/* Map div */}
          <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0a0a0f' }} />

          {/* Near Me button */}
          <button onClick={flyToMe} title="Fly to my location" style={{
            position: 'absolute', bottom: 24, right: 16, zIndex: 5,
            width: 48, height: 48, borderRadius: '50%',
            background: '#6c63ff', border: 'none', color: 'white', fontSize: 20,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(108,99,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>📍</button>

          {/* Pin count badge */}
          {!loading && pins.length > 0 && (
            <div style={{
              position: 'absolute', top: 12, right: 16, zIndex: 5,
              background: 'rgba(13,13,26,0.85)', border: '1px solid #2a2a3a',
              borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#94a3b8',
              backdropFilter: 'blur(8px)',
            }}>
              {pins.filter(p => activeLayers.has(p.type)).length} pins visible
            </div>
          )}
        </div>
      </div>
    </>
  )
}
