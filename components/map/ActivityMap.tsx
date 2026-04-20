'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Map, { Marker, Popup, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

// ─── Pin types ────────────────────────────────────────────────────────────────
type PinType = 'member' | 'event' | 'product' | 'job'

interface BasePin {
  id: string
  type: PinType
  latitude: number
  longitude: number
  city?: string | null
  country?: string | null
}
interface MemberPin  extends BasePin { type: 'member';  username: string; avatar_url?: string | null; bio?: string | null }
interface EventPin   extends BasePin { type: 'event';   title: string; starts_at?: string | null; venue_name?: string | null; ticket_price?: number | null; is_paid?: boolean }
interface ProductPin extends BasePin { type: 'product'; title: string; price_eur?: number | null; cover_image_url?: string | null }
interface JobPin     extends BasePin { type: 'job';     title: string; salary_min_eur?: number | null; salary_max_eur?: number | null }

type Pin = MemberPin | EventPin | ProductPin | JobPin

// ─── Config ───────────────────────────────────────────────────────────────────
// Free dark tile style from CartoDB — no token required, no service-worker issues.
// Uses the MapLibre open-source renderer (already installed as maplibre-gl).
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const LAYER_CONFIG: Record<PinType, { label: string; color: string; glow: string }> = {
  member:  { label: 'Members',  color: '#00d4aa', glow: 'rgba(0,212,170,0.6)'  },
  event:   { label: 'Events',   color: '#f59e0b', glow: 'rgba(245,158,11,0.6)' },
  product: { label: 'Products', color: '#00d4aa', glow: 'rgba(0,212,170,0.6)'  },
  job:     { label: 'Jobs',     color: '#38bdf8', glow: 'rgba(56,189,248,0.6)' },
}

// ─── GlowDot marker ───────────────────────────────────────────────────────────
function GlowDot({ color, glow }: { color: string; glow: string }) {
  return (
    <div style={{ position: 'relative', width: 12, height: 12, overflow: 'visible', cursor: 'pointer' }}>
      {/* tight outer ring */}
      <div style={{
        position: 'absolute',
        inset: -3,
        borderRadius: '50%',
        border: `1.5px solid ${color}66`,
        pointerEvents: 'none',
      }} />
      {/* sharp center dot */}
      <div style={{
        width: 12, height: 12,
        background: color,
        borderRadius: '50%',
        border: '2px solid white',
        boxShadow: `0 0 4px 1px ${glow}, 0 1px 3px rgba(0,0,0,0.6)`,
      }} />
    </div>
  )
}

// ─── Popup content ────────────────────────────────────────────────────────────
function PinPopup({ pin }: { pin: Pin }) {
  const loc = [
    pin.type === 'event' ? (pin as EventPin).venue_name : undefined,
    pin.city,
    pin.country,
  ].filter(Boolean).join(', ')

  const baseStyle: React.CSSProperties = {
    minWidth: 200, maxWidth: 260,
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
    lineHeight: 1.5,
    color: '#f1f5f9',
  }

  const btnStyle = (color: string): React.CSSProperties => ({
    display: 'inline-block',
    marginTop: 10,
    padding: '6px 14px',
    borderRadius: 20,
    background: color,
    color: '#0a0a0f',
    fontWeight: 700,
    fontSize: 12,
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
  })

  if (pin.type === 'member') {
    const p = pin as MemberPin
    return (
      <div style={baseStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {p.avatar_url
            ? <img src={p.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #00d4aa', flexShrink: 0 }} alt="" />
            : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#00d4aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👤</div>
          }
          <div>
            <div style={{ fontWeight: 700 }}>@{p.username || 'member'}</div>
            {loc && <div style={{ color: '#64748b', fontSize: 11 }}>📍 {loc}</div>}
          </div>
        </div>
        {p.bio && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{p.bio.slice(0, 70)}{p.bio.length > 70 ? '…' : ''}</div>}
        <a href={`/members/${encodeURIComponent(p.username || '')}`} style={btnStyle('#00d4aa')}>View Profile →</a>
      </div>
    )
  }

  if (pin.type === 'event') {
    const e = pin as EventPin
    const date = e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
    const price = e.is_paid && e.ticket_price ? `€${Number(e.ticket_price).toFixed(2)}` : 'Free'
    return (
      <div style={baseStyle}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{e.title}</div>
        {date && <div style={{ color: '#94a3b8', marginTop: 4 }}>📅 {date}</div>}
        {loc  && <div style={{ color: '#94a3b8' }}>📍 {loc}</div>}
        <div style={{ color: '#f59e0b', fontWeight: 600, marginTop: 4 }}>{price}</div>
        <a href={`/events/${encodeURIComponent(e.id)}`} style={btnStyle('#f59e0b')}>View Event →</a>
      </div>
    )
  }

  if (pin.type === 'product') {
    const p = pin as ProductPin
    const price = p.price_eur ? `€${Number(p.price_eur).toFixed(2)}` : ''
    return (
      <div style={baseStyle}>
        {p.cover_image_url && (
          <img src={p.cover_image_url} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} alt="" />
        )}
        <div style={{ fontWeight: 700 }}>{p.title}</div>
        {price && <div style={{ color: '#00d4aa', fontWeight: 600, marginTop: 2 }}>{price}</div>}
        {loc   && <div style={{ color: '#64748b', fontSize: 11 }}>📍 {loc}</div>}
        <a href={`/listing/${encodeURIComponent(p.id)}`} style={btnStyle('#00d4aa')}>View Listing →</a>
      </div>
    )
  }

  if (pin.type === 'job') {
    const j = pin as JobPin
    const salary = j.salary_min_eur
      ? `€${Number(j.salary_min_eur / 1000).toFixed(0)}k${j.salary_max_eur ? ` – €${Number(j.salary_max_eur / 1000).toFixed(0)}k` : '+'}`
      : 'Competitive salary'
    return (
      <div style={baseStyle}>
        <div style={{ fontWeight: 700 }}>{j.title}</div>
        <div style={{ color: '#38bdf8', fontWeight: 600, marginTop: 4 }}>💰 {salary}</div>
        {loc && <div style={{ color: '#94a3b8' }}>📍 {loc}</div>}
        <a href={`/jobs/${encodeURIComponent(j.id)}`} style={btnStyle('#38bdf8')}>View Job →</a>
      </div>
    )
  }

  return null
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ActivityMap() {
  const [pins,         setPins]         = useState<Pin[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeLayers, setActiveLayers] = useState<Set<PinType>>(
    new Set<PinType>(['member', 'event', 'product', 'job'])
  )
  const [selectedPin, setSelectedPin]  = useState<Pin | null>(null)
  const mapRef = useRef<MapRef | null>(null)

  // Fetch pins
  useEffect(() => {
    fetch('/api/map/pins')
      .then(r => r.json())
      .then(d => { setPins(d.pins ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggleLayer = useCallback((type: PinType) => {
    setActiveLayers(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type); else next.add(type)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setActiveLayers(prev =>
      prev.size === 4 ? new Set<PinType>() : new Set<PinType>(['member', 'event', 'product', 'job'])
    )
  }, [])

  const flyToMe = useCallback(() => {
    navigator.geolocation.getCurrentPosition(pos => {
      mapRef.current?.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 10,
        speed: 1.5,
      })
    })
  }, [])

  const visiblePins = pins.filter(p => activeLayers.has(p.type))
  const allOn = activeLayers.size === 4

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* MapLibre popup override styles */}
      <style>{`
        .maplibregl-popup-content {
          background: #13131a !important;
          border: 1px solid #2a2a3a !important;
          border-radius: 12px !important;
          padding: 14px 16px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          color: #f1f5f9;
        }
        .maplibregl-popup-close-button {
          color: #94a3b8 !important;
          font-size: 18px !important;
          padding: 4px 8px !important;
          background: transparent !important;
          right: 0; top: 0;
        }
        .maplibregl-popup-tip {
          border-top-color: #2a2a3a !important;
          border-bottom-color: #2a2a3a !important;
        }
        .maplibregl-ctrl-attrib {
          background: rgba(13,13,26,0.85) !important;
          color: #64748b !important;
        }
        .maplibregl-ctrl-attrib a { color: #00d4aa !important; }
        @keyframes ft-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Layer toggles ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto',
        background: '#0d0d1a', borderBottom: '1px solid #1e1e2e', flexShrink: 0,
        scrollbarWidth: 'none',
      }}>
        <button onClick={toggleAll} style={{
          flexShrink: 0, padding: '6px 16px', borderRadius: 20,
          border: `1.5px solid ${allOn ? '#00d4aa' : '#2a2a3a'}`,
          background: allOn ? 'rgba(0,212,170,0.15)' : 'transparent',
          color: allOn ? '#00d4aa' : '#94a3b8',
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

      {/* ── Map ── */}
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
              border: '3px solid #1e1e2e', borderTop: '3px solid #00d4aa',
              animation: 'ft-spin 0.8s linear infinite',
            }} />
            <p style={{ color: '#64748b', marginTop: 12, fontSize: 13 }}>Loading activity…</p>
          </div>
        )}

        <Map
          ref={mapRef}
          mapStyle={MAP_STYLE}
          initialViewState={{ longitude: -2, latitude: 54, zoom: 5 }}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
        >
          {/* Markers */}
          {visiblePins.map(pin => {
            const cfg = LAYER_CONFIG[pin.type]
            return (
              <Marker
                key={`${pin.type}-${pin.id}`}
                longitude={pin.longitude}
                latitude={pin.latitude}
                anchor="center"
                onClick={e => {
                  e.originalEvent.stopPropagation()
                  setSelectedPin(pin)
                }}
              >
                <GlowDot color={cfg.color} glow={cfg.glow} />
              </Marker>
            )
          })}

          {/* Popup */}
          {selectedPin && (
            <Popup
              longitude={selectedPin.longitude}
              latitude={selectedPin.latitude}
              anchor="bottom"
              offset={16}
              closeButton
              closeOnClick={false}
              onClose={() => setSelectedPin(null)}
              maxWidth="280px"
            >
              <PinPopup pin={selectedPin} />
            </Popup>
          )}
        </Map>

        {/* Near Me button */}
        <button onClick={flyToMe} title="Fly to my location" style={{
          position: 'absolute', bottom: 24, right: 16, zIndex: 5,
          width: 48, height: 48, borderRadius: '50%',
          background: '#00d4aa', border: 'none', color: '#0a0a0f', fontSize: 20,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,212,170,0.5)',
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
            {visiblePins.length} pins visible
          </div>
        )}
      </div>
    </div>
  )
}
