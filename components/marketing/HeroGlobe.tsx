'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
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

// ── HeroGlobe — Mapbox GL globe, auto-rotate, zoom, click-to-register ─────────
export default function HeroGlobe({ size = 220 }: { size?: number }) {
  const mapRef          = useRef<MapRef | null>(null)
  const bearRef         = useRef(0)
  const rafRef          = useRef<number>(0)
  const isPausedRef     = useRef(false)
  const resumeTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recentZoomRef   = useRef(false)
  const recentZoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pad             = 60

  useEffect(() => {
    const step = () => {
      if (!isPausedRef.current) {
        const map = mapRef.current?.getMap()
        if (map && map.isStyleLoaded()) {
          bearRef.current = (bearRef.current + 0.04) % 360
          map.setBearing(bearRef.current)
        }
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const handleZoomStart = () => {
    isPausedRef.current = true
    recentZoomRef.current = true
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    if (recentZoomTimer.current) clearTimeout(recentZoomTimer.current)
  }

  const handleZoomEnd = () => {
    resumeTimerRef.current = setTimeout(() => { isPausedRef.current = false }, 2000)
    recentZoomTimer.current = setTimeout(() => { recentZoomRef.current = false }, 300)
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (recentZoomRef.current) e.preventDefault()
  }

  return (
    <>
      <style>{`
        @keyframes hg-spin-cw  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes hg-spin-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes hg-glow     {
          0%,100% { box-shadow: 0 0 0 2px rgba(200,235,255,0.7), 0 0 35px rgba(56,189,248,0.8), 0 0 70px rgba(56,189,248,0.4); }
          50%     { box-shadow: 0 0 0 2.5px rgba(220,245,255,0.9), 0 0 50px rgba(56,189,248,1), 0 0 100px rgba(56,189,248,0.55); }
        }
        @keyframes hg-pin { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(2); opacity:0.4; } }
        .hero-globe-link { display: block; text-decoration: none; cursor: pointer; }
        .hero-globe-link .hg-glow-box { transition: box-shadow 0.3s ease; }
        .hero-globe-link:hover .hg-glow-box {
          box-shadow: 0 0 0 2.5px rgba(220,245,255,0.9), 0 0 55px rgba(56,189,248,1), 0 0 110px rgba(56,189,248,0.6) !important;
          animation: none !important;
        }
        .hero-globe-link .hg-join-label {
          opacity: 0;
          transform: translateX(-50%) translateY(4px);
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .hero-globe-link:hover .hg-join-label {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      `}</style>

      <Link href="/register" onClick={handleClick} className="hero-globe-link">
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
              top: s.top, left: s.left,
              width: s.size, height: s.size,
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
            <div
              className="hg-glow-box"
              style={{
                width: size, height: size, borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 0 0 2px rgba(200,235,255,0.7), 0 0 35px rgba(56,189,248,0.8), 0 0 70px rgba(56,189,248,0.4), 0 0 120px rgba(56,189,248,0.2)',
                animation: 'hg-glow 3s ease-in-out infinite',
              }}
            >
              <Map
                ref={mapRef}
                mapboxAccessToken={MAPBOX_TOKEN}
                mapStyle={MAP_STYLE}
                projection={{ name: 'globe' }}
                initialViewState={{ longitude: -8, latitude: 30, zoom: 0.5 }}
                attributionControl={false}
                logoPosition="bottom-right"
                style={{ width: size, height: size }}
                dragPan={false}
                dragRotate={false}
                keyboard={false}
                scrollZoom={true}
                doubleClickZoom={true}
                touchZoomRotate={true}
                onZoomStart={handleZoomStart}
                onZoomEnd={handleZoomEnd}
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

            {/* Ireland pin */}
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

            {/* "Join FreeTrust →" hover label */}
            <div
              className="hg-join-label"
              style={{
                position: 'absolute',
                bottom: -38,
                left: '50%',
                background: 'rgba(10,20,40,0.85)',
                border: '1px solid rgba(56,189,248,0.4)',
                borderRadius: 999,
                padding: '5px 16px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#38bdf8',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(8px)',
                pointerEvents: 'none',
                zIndex: 4,
              }}
            >
              Join FreeTrust →
            </div>
          </div>
        </div>
      </Link>
    </>
  )
}
