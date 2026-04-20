'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Map, { Marker, Popup, type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

// ─── Pin types ────────────────────────────────────────────────────────────────
type PinType = 'member' | 'event' | 'product' | 'service' | 'job'

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
interface ServicePin extends BasePin { type: 'service'; title: string; price_eur?: number | null; cover_image_url?: string | null; category?: string | null }
interface JobPin     extends BasePin { type: 'job';     title: string; salary_min_eur?: number | null; salary_max_eur?: number | null }

type Pin = MemberPin | EventPin | ProductPin | ServicePin | JobPin

// ─── Config ───────────────────────────────────────────────────────────────────
// Custom Mapbox Studio style — globe with bright green land and vivid blue ocean.
// Published by davos212 on Mapbox Studio.
const MAP_STYLE = 'mapbox://styles/davos212/cmo7emfe2000x01r3b3cn2zgq'
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

const LAYER_CONFIG: Record<PinType, { label: string; color: string; glow: string }> = {
  member:  { label: 'Members',  color: '#00d4aa', glow: 'rgba(0,212,170,0.6)'  },
  event:   { label: 'Events',   color: '#f59e0b', glow: 'rgba(245,158,11,0.6)' },
  product: { label: 'Products', color: '#a855f7', glow: 'rgba(168,85,247,0.6)' },
  service: { label: 'Services', color: '#f97316', glow: 'rgba(249,115,22,0.6)' },
  job:     { label: 'Jobs',     color: '#38bdf8', glow: 'rgba(56,189,248,0.6)' },
}

// ─── PinMarker — image avatar or fallback glow dot ───────────────────────────
function PinMarker({ color, glow, imageUrl }: { color: string; glow: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <div style={{ position: 'relative', width: 32, height: 32, overflow: 'visible', cursor: 'pointer' }}>
        {/* Outer glow ring */}
        <div style={{
          position: 'absolute',
          inset: -4,
          borderRadius: '50%',
          border: `2px solid ${color}88`,
          boxShadow: `0 0 10px 3px ${glow}`,
          pointerEvents: 'none',
        }} />
        {/* Circular image */}
        <img
          src={imageUrl}
          alt=""
          style={{
            width: 32, height: 32,
            borderRadius: '50%',
            objectFit: 'cover',
            border: `2.5px solid ${color}`,
            boxShadow: `0 2px 8px rgba(0,0,0,0.5)`,
            display: 'block',
          }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>
    )
  }
  // Fallback: solid glow dot
  return (
    <div style={{ position: 'relative', width: 14, height: 14, overflow: 'visible', cursor: 'pointer' }}>
      <div style={{
        position: 'absolute', inset: -4, borderRadius: '50%',
        border: `1.5px solid ${color}55`, pointerEvents: 'none',
      }} />
      <div style={{
        width: 14, height: 14, background: color, borderRadius: '50%',
        border: '2.5px solid white',
        boxShadow: `0 0 6px 2px ${glow}, 0 1px 4px rgba(0,0,0,0.5)`,
      }} />
    </div>
  )
}

// ─── Popup content ────────────────────────────────────────────────────────────
function PinPopup({ pin }: { pin: Pin }) {
  const cfg = LAYER_CONFIG[pin.type]
  const loc = [
    pin.type === 'event' ? (pin as EventPin).venue_name : undefined,
    pin.city,
    pin.country,
  ].filter(Boolean).join(', ')

  const wrapStyle: React.CSSProperties = {
    minWidth: 210, maxWidth: 270,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 13, lineHeight: 1.5, color: '#f1f5f9',
  }

  const btnStyle = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    marginTop: 12, padding: '7px 16px', borderRadius: 24,
    background: color, color: '#0a0a0f',
    fontWeight: 700, fontSize: 12, textDecoration: 'none',
    border: 'none', cursor: 'pointer',
    boxShadow: `0 2px 8px ${color}55`,
  })

  const topBar = (
    <div style={{
      height: 3, background: cfg.color,
      borderRadius: '12px 12px 0 0', marginBottom: 12,
      boxShadow: `0 0 8px ${cfg.glow}`,
    }} />
  )

  if (pin.type === 'member') {
    const p = pin as MemberPin
    return (
      <div style={wrapStyle}>
        {topBar}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {p.avatar_url
            ? <img src={p.avatar_url} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${cfg.color}`, flexShrink: 0 }} alt="" />
            : <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${cfg.color}22`, border: `2px solid ${cfg.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👤</div>
          }
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>@{p.username || 'member'}</div>
            {loc && <div style={{ color: '#64748b', fontSize: 11, marginTop: 1 }}>📍 {loc}</div>}
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, padding: '2px 8px', borderRadius: 12, background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.3)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4aa', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: '#00d4aa', fontWeight: 600 }}>FreeTrust Member</span>
        </div>
        {p.bio && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{p.bio.slice(0, 80)}{p.bio.length > 80 ? '…' : ''}</div>}
        <a href={`/members/${encodeURIComponent(p.username || '')}`} style={btnStyle(cfg.color)}>View Profile →</a>
      </div>
    )
  }

  if (pin.type === 'event') {
    const e = pin as EventPin
    const date = e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
    const price = e.is_paid && e.ticket_price ? `€${Number(e.ticket_price).toFixed(2)}` : 'Free'
    return (
      <div style={wrapStyle}>
        {topBar}
        <div style={{ fontWeight: 700, fontSize: 14 }}>{e.title}</div>
        {date && <div style={{ color: '#94a3b8', marginTop: 5, fontSize: 12 }}>📅 {date}</div>}
        {loc  && <div style={{ color: '#94a3b8', fontSize: 12 }}>📍 {loc}</div>}
        <div style={{ color: cfg.color, fontWeight: 700, marginTop: 5, fontSize: 13 }}>{price}</div>
        <a href={`/events/${encodeURIComponent(e.id)}`} style={btnStyle(cfg.color)}>View Event →</a>
      </div>
    )
  }

  if (pin.type === 'product') {
    const p = pin as ProductPin
    const price = p.price_eur ? `€${Number(p.price_eur).toFixed(2)}` : ''
    return (
      <div style={wrapStyle}>
        {topBar}
        {p.cover_image_url && (
          <img src={p.cover_image_url} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} alt="" />
        )}
        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
        {price && <div style={{ color: cfg.color, fontWeight: 700, marginTop: 4 }}>{price}</div>}
        {loc   && <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>📍 {loc}</div>}
        <a href={`/listing/${encodeURIComponent(p.id)}`} style={btnStyle(cfg.color)}>View Listing →</a>
      </div>
    )
  }

  if (pin.type === 'service') {
    const s = pin as ServicePin
    const price = s.price_eur ? `€${Number(s.price_eur).toFixed(2)}` : 'Contact for price'
    return (
      <div style={wrapStyle}>
        {topBar}
        {s.cover_image_url && (
          <img src={s.cover_image_url} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} alt="" />
        )}
        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
        {s.category && <div style={{ fontSize: 11, color: cfg.color, marginTop: 2, textTransform: 'capitalize' }}>{s.category}</div>}
        <div style={{ color: cfg.color, fontWeight: 700, marginTop: 4 }}>{price}</div>
        {loc && <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>📍 {loc}</div>}
        <a href={`/listing/${encodeURIComponent(s.id)}`} style={btnStyle(cfg.color)}>View Service →</a>
      </div>
    )
  }

  if (pin.type === 'job') {
    const j = pin as JobPin
    const salary = j.salary_min_eur
      ? `€${Number(j.salary_min_eur / 1000).toFixed(0)}k${j.salary_max_eur ? ` – €${Number(j.salary_max_eur / 1000).toFixed(0)}k` : '+'}`
      : 'Competitive salary'
    return (
      <div style={wrapStyle}>
        {topBar}
        <div style={{ fontWeight: 700, fontSize: 14 }}>{j.title}</div>
        <div style={{ color: cfg.color, fontWeight: 700, marginTop: 5 }}>💰 {salary}</div>
        {loc && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>📍 {loc}</div>}
        <a href={`/jobs/${encodeURIComponent(j.id)}`} style={btnStyle(cfg.color)}>View Job →</a>
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
    new Set<PinType>(['member', 'event', 'product', 'service', 'job'])
  )
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const mapRef = useRef<MapRef | null>(null)

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
      prev.size === 5 ? new Set<PinType>() : new Set<PinType>(['member', 'event', 'product', 'service', 'job'])
    )
  }, [])

  const flyToMe = useCallback(() => {
    navigator.geolocation.getCurrentPosition(pos => {
      mapRef.current?.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 10, speed: 1.5,
      })
    })
  }, [])

  const visiblePins = pins.filter(p => activeLayers.has(p.type))
  const allOn = activeLayers.size === 5
  const countByType = (type: PinType) => pins.filter(p => p.type === type).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Global styles ── */}
      <style>{`
        .mapboxgl-popup-content {
          background: #13131a !important;
          border: 1px solid #2a2a3a !important;
          border-radius: 12px !important;
          padding: 0 !important;
          overflow: hidden !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.7) !important;
          color: #f1f5f9;
        }
        .mapboxgl-popup-content > div { padding: 0 16px 16px !important; }
        .mapboxgl-popup-close-button {
          color: #64748b !important; font-size: 20px !important;
          padding: 6px 10px !important; background: transparent !important;
          right: 0; top: 0; z-index: 10; line-height: 1;
        }
        .mapboxgl-popup-close-button:hover { color: #f1f5f9 !important; }
        .mapboxgl-popup-tip {
          border-top-color: #2a2a3a !important;
          border-bottom-color: #2a2a3a !important;
        }
        .mapboxgl-ctrl-attrib {
          background: rgba(13,13,26,0.85) !important; color: #64748b !important;
          font-size: 10px !important; border-radius: 6px !important;
        }
        .mapboxgl-ctrl-attrib a { color: #00d4aa !important; }
        @keyframes ft-spin { to { transform: rotate(360deg); } }
        @keyframes ft-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.8); }
        }
        .ft-toggle-btn { transition: all 0.15s ease !important; }
        .ft-toggle-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
        .ft-nearme-btn { transition: all 0.18s ease !important; }
        .ft-nearme-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 28px rgba(0,212,170,0.65) !important; }
      `}</style>

      {/* ── Layer toggles ── */}
      <div style={{
        display: 'flex', gap: 7, padding: '10px 14px',
        overflowX: 'auto', flexShrink: 0,
        background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(42,42,58,0.8)',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none' as React.CSSProperties['msOverflowStyle'],
      }}>
        {/* All toggle */}
        <button className="ft-toggle-btn" onClick={toggleAll} style={{
          flexShrink: 0, padding: '5px 14px', borderRadius: 24,
          border: `1.5px solid ${allOn ? '#00d4aa' : '#2a2a3a'}`,
          background: allOn
            ? 'linear-gradient(135deg, rgba(0,212,170,0.2), rgba(56,189,248,0.08))'
            : 'rgba(255,255,255,0.03)',
          color: allOn ? '#00d4aa' : '#64748b',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          boxShadow: allOn ? '0 0 12px rgba(0,212,170,0.18)' : 'none',
        }}>✦ All</button>

        {(Object.entries(LAYER_CONFIG) as [PinType, typeof LAYER_CONFIG[PinType]][]).map(([type, cfg]) => {
          const active = activeLayers.has(type)
          const count = countByType(type)
          return (
            <button key={type} className="ft-toggle-btn" onClick={() => toggleLayer(type)} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 24,
              border: `1.5px solid ${active ? cfg.color : '#2a2a3a'}`,
              background: active
                ? `linear-gradient(135deg, ${cfg.color}25, ${cfg.color}0d)`
                : 'rgba(255,255,255,0.03)',
              color: active ? cfg.color : '#64748b',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: active ? `0 0 10px ${cfg.color}30` : 'none',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: active ? cfg.color : '#3a3a4a',
                boxShadow: active ? `0 0 6px 2px ${cfg.glow}` : 'none',
              }} />
              {cfg.label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, lineHeight: 1,
                  background: active ? `${cfg.color}28` : 'rgba(255,255,255,0.06)',
                  color: active ? cfg.color : '#64748b',
                  borderRadius: 10, padding: '1px 6px',
                  border: `1px solid ${active ? cfg.color + '38' : 'transparent'}`,
                }}>
                  {count}
                </span>
              )}
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
              width: 56, height: 56, borderRadius: '50%',
              border: '3px solid #1e1e2e',
              borderTop: '3px solid #00d4aa',
              borderRight: '3px solid #38bdf8',
              animation: 'ft-spin 0.9s linear infinite',
              boxShadow: '0 0 20px rgba(0,212,170,0.18)',
            }} />
            <p style={{ color: '#64748b', marginTop: 16, fontSize: 13, fontWeight: 500 }}>
              Discovering activity near you…
            </p>
          </div>
        )}

        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={MAP_STYLE}
          initialViewState={{ longitude: -2, latitude: 54, zoom: 5 }}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
          onError={e => console.error('[ActivityMap] Mapbox error:', e)}
        >
          {visiblePins.map(pin => {
            const cfg = LAYER_CONFIG[pin.type]
            // Determine image URL: avatars for members, cover images for products/services
            let imageUrl: string | null = null
            if (pin.type === 'member')  imageUrl = (pin as MemberPin).avatar_url ?? null
            if (pin.type === 'product') imageUrl = (pin as ProductPin).cover_image_url ?? null
            if (pin.type === 'service') imageUrl = (pin as ServicePin).cover_image_url ?? null
            return (
              <Marker
                key={`${pin.type}-${pin.id}`}
                longitude={pin.longitude}
                latitude={pin.latitude}
                anchor="center"
                onClick={e => { e.originalEvent.stopPropagation(); setSelectedPin(pin) }}
              >
                <PinMarker color={cfg.color} glow={cfg.glow} imageUrl={imageUrl} />
              </Marker>
            )
          })}

          {selectedPin && (
            <Popup
              longitude={selectedPin.longitude}
              latitude={selectedPin.latitude}
              anchor="bottom"
              offset={18}
              closeButton
              closeOnClick={false}
              onClose={() => setSelectedPin(null)}
              maxWidth="290px"
            >
              <PinPopup pin={selectedPin} />
            </Popup>
          )}
        </Map>

        {/* Near Me — pill button */}
        <button
          className="ft-nearme-btn"
          onClick={flyToMe}
          title="Fly to my location"
          style={{
            position: 'absolute',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
            right: 16, zIndex: 5,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 24,
            background: 'linear-gradient(135deg, #00d4aa, #1abfa0)',
            border: 'none', color: '#0a0a0f',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,212,170,0.45)',
          }}
        >
          <span style={{ fontSize: 15 }}>📍</span>
          Near Me
        </button>

        {/* Live pin count badge */}
        {!loading && (
          <div style={{
            position: 'absolute', top: 12, right: 16, zIndex: 5,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(10,10,15,0.88)',
            border: '1px solid rgba(0,212,170,0.22)',
            borderRadius: 20, padding: '5px 12px',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#00d4aa',
              boxShadow: '0 0 5px rgba(0,212,170,0.9)',
              animation: 'ft-pulse 2s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
              {visiblePins.length} {visiblePins.length === 1 ? 'pin' : 'pins'}
            </span>
          </div>
        )}

        {/* No layers selected empty state */}
        {!loading && pins.length > 0 && visiblePins.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'rgba(13,13,26,0.92)', border: '1px solid #2a2a3a',
              borderRadius: 16, padding: '18px 28px', textAlign: 'center',
              backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
              <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }}>No layers selected</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Toggle a layer above to see pins on the map</div>
            </div>
          </div>
        )}

        {/* No data empty state */}
        {!loading && pins.length === 0 && (
          <div style={{
            position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
            zIndex: 4, pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(13,13,26,0.9)', border: '1px solid #2a2a3a',
              borderRadius: 14, padding: '12px 20px', textAlign: 'center',
              backdropFilter: 'blur(12px)', whiteSpace: 'nowrap',
            }}>
              <div style={{ color: '#64748b', fontSize: 12 }}>
                No activity in this area yet. Zoom out to discover more.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
