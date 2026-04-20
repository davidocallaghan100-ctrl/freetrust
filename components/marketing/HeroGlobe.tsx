'use client'

import { useEffect, useRef } from 'react'
import Map, { type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
const MAP_STYLE   = 'mapbox://styles/davos212/cmo7emfe2000x01r3b3cn2zgq'

// Static star field — scattered dots for a space backdrop (no animation, no straight lines)
const STARS = [
  { top:  '8%', left: '12%', size: 2,   opacity: 0.55 },
  { top: '18%', left: '78%', size: 2.5, opacity: 0.45 },
  { top: '72%', left:  '7%', size: 2,   opacity: 0.5  },
  { top: '82%', left: '88%', size: 3,   opacity: 0.35 },
  { top:  '5%', left: '55%', size: 2,   opacity: 0.6  },
  { top: '60%', left: '92%', size: 2.5, opacity: 0.4  },
  { top: '88%', left: '30%', size: 2,   opacity: 0.5  },
  { top: '32%', left:  '4%', size: 3,   opacity: 0.3  },
  { top: '48%', left: '96%', size: 2,   opacity: 0.45 },
  { top: '92%', left: '65%', size: 2.5, opacity: 0.4  },
  { top: '15%', left: '38%', size: 1.5, opacity: 0.5  },
  { top: '68%', left: '48%', size: 2,   opacity: 0.35 },
]

// ── HeroGlobe — Mapbox GL globe with auto-rotation ────────────────────────────
export default function HeroGlobe({ size = 220 }: { size?: number }) {
  const mapRef  = useRef<MapRef | null>(null)
  const bearRef = useRef(0)
  const rafRef  = useRef<number>(0)
  const pad     = 60

  useEffect(() => {
    // Wait for map to load then start slow rotation
    const step = () => {
      const map = mapRef.current?.getMap()
      if (map && map.isStyleLoaded()) {
        bearRef.current = (bearRef.current + 0.04) % 360
        map.setBearing(bearRef.current)
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <>
      {/* Keyframes for rings + pin pulse only — no shooting stars */}
      <style>{`
        @keyframes hg-spin-cw  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes hg-spin-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes hg-glow     { 0%,100% { box-shadow: 0 0 0 2px rgba(200,235,255,0.7), 0 0 35px rgba(56,189,248,0.8), 0 0 70px rgba(56,189,248,0.4); } 50% { box-shadow: 0 0 0 2.5px rgba(220,245,255,0.9), 0 0 50px rgba(56,189,248,1), 0 0 100px rgba(56,189,248,0.55); } }
        @keyframes hg-pin      { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(2); opacity:0.4; } }
      `}</style>

      <div style={{
        position: 'relative',
        width: size + pad,
        height: size + pad,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        flexShrink: 0,
      }}>
        {/* ── Static star field ── */}
        {STARS.map((s, i) => (
          <span key={i} style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: '#fff',
            opacity: s.opacity,
            pointerEvents: 'none',
          }} />
        ))}

        {/* ── Globe wrapper ── */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          {/* Outer spinning ring */}
          <div style={{
            position: 'absolute', inset: -22, borderRadius: '50%',
            border: '1.5px dashed rgba(147,210,255,0.35)',
            animation: 'hg-spin-cw 14s linear infinite',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
          {/* Inner counter-rotating ring */}
          <div style={{
            position: 'absolute', inset: -10, borderRadius: '50%',
            border: '1px dotted rgba(52,211,153,0.3)',
            animation: 'hg-spin-ccw 10s linear infinite',
            pointerEvents: 'none',
            zIndex: 2,
          }} />

          {/* Globe body — circular clipped Mapbox GL map */}
          <div style={{
            width: size, height: size, borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 0 0 2px rgba(200,235,255,0.7), 0 0 35px rgba(56,189,248,0.8), 0 0 70px rgba(56,189,248,0.4), 0 0 120px rgba(56,189,248,0.2)',
            animation: 'hg-glow 3s ease-in-out infinite',
          }}>
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle={MAP_STYLE}
              projection={{ name: 'globe' }}
              initialViewState={{ longitude: -8, latitude: 30, zoom: 0.5 }}
              interactive={false}
              attributionControl={false}
              logoPosition="bottom-right"
              style={{ width: size, height: size }}
              onError={e => console.warn('[HeroGlobe] map error', e)}
            />

            {/* Atmosphere rim overlay */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'radial-gradient(circle at 50% 50%, transparent 55%, rgba(96,165,250,0.06) 72%, rgba(56,189,248,0.22) 88%, rgba(147,210,255,0.4) 100%)',
              pointerEvents: 'none',
              zIndex: 1,
            }} />
            {/* Crescent highlight top-left */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'radial-gradient(circle at 28% 22%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.07) 18%, transparent 45%)',
              pointerEvents: 'none',
              zIndex: 1,
            }} />
            {/* Shadow bottom-right */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'radial-gradient(circle at 74% 76%, rgba(0,0,10,0.32) 0%, transparent 48%)',
              pointerEvents: 'none',
              zIndex: 1,
            }} />
          </div>

          {/* Ireland pin — rendered outside the clipped map div so it's always visible */}
          <div style={{
            position: 'absolute',
            top: `${size * 0.33}px`,
            left: `${size * 0.47}px`,
            width: 10, height: 10, borderRadius: '50%',
            background: '#34d399',
            boxShadow: '0 0 8px rgba(52,211,153,1), 0 0 18px rgba(52,211,153,0.6)',
            animation: 'hg-pin 2s ease-in-out infinite',
            zIndex: 3,
            pointerEvents: 'none',
          }} />
        </div>
      </div>
    </>
  )
}
