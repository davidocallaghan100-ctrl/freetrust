'use client'

import { useEffect, useRef } from 'react'
import Map, { type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
const MAP_STYLE   = 'mapbox://styles/davos212/cmo7emfe2000x01r3b3cn2zgq'

// Subtle twinkling star field scattered around the globe
const STARS = [
  { top:  '6%', left: '10%', size: 1.5, opacity: 0.5,  delay: '0s'   },
  { top: '14%', left: '82%', size: 2,   opacity: 0.4,  delay: '0.8s' },
  { top: '22%', left: '24%', size: 1,   opacity: 0.35, delay: '1.5s' },
  { top: '70%', left:  '6%', size: 1.5, opacity: 0.45, delay: '0.3s' },
  { top: '80%', left: '90%', size: 2,   opacity: 0.3,  delay: '2.1s' },
  { top:  '4%', left: '52%', size: 1.5, opacity: 0.55, delay: '1.1s' },
  { top: '58%', left: '95%', size: 1,   opacity: 0.35, delay: '0.6s' },
  { top: '90%', left: '28%', size: 1.5, opacity: 0.45, delay: '1.8s' },
  { top: '30%', left:  '2%', size: 1,   opacity: 0.3,  delay: '2.4s' },
  { top: '46%', left: '98%', size: 1.5, opacity: 0.4,  delay: '0.9s' },
  { top: '94%', left: '68%', size: 1,   opacity: 0.35, delay: '1.3s' },
  { top: '12%', left: '40%', size: 1,   opacity: 0.45, delay: '2.7s' },
  { top: '65%', left: '50%', size: 1.5, opacity: 0.3,  delay: '0.4s' },
  { top: '38%', left: '88%', size: 1,   opacity: 0.4,  delay: '1.9s' },
  { top: '84%', left: '44%', size: 1.5, opacity: 0.35, delay: '3.1s' },
  { top: '50%', left: '15%', size: 1,   opacity: 0.3,  delay: '0.7s' },
  { top: '76%', left: '72%', size: 2,   opacity: 0.25, delay: '2.2s' },
  { top: '26%', left: '60%', size: 1,   opacity: 0.4,  delay: '1.6s' },
  { top:  '3%', left: '30%', size: 1.5, opacity: 0.45, delay: '3.4s' },
  { top: '55%', left: '35%', size: 1,   opacity: 0.3,  delay: '0.2s' },
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

  // Navigate to register on clean tap (not after zoom)
  const handleMapClick = () => {
    if (!recentZoomRef.current) {
      window.location.href = '/register'
    }
  }

  return (
    <>
      <style>{`
        @keyframes hg-twinkle {
          0%,100% { opacity: var(--star-op); transform: scale(1); }
          50%      { opacity: calc(var(--star-op) * 0.25); transform: scale(0.7); }
        }
        @keyframes hg-glow {
          0%,100% { box-shadow: 0 0 0 2px rgba(200,235,255,0.7), 0 0 35px rgba(56,189,248,0.8), 0 0 70px rgba(56,189,248,0.4); }
          50%     { box-shadow: 0 0 0 2.5px rgba(220,245,255,0.9), 0 0 50px rgba(56,189,248,1), 0 0 100px rgba(56,189,248,0.55); }
        }
        @keyframes hg-pin { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(2); opacity:0.4; } }
        .hg-outer:hover .hg-glow-box {
          box-shadow: 0 0 0 2.5px rgba(220,245,255,0.9), 0 0 55px rgba(56,189,248,1), 0 0 110px rgba(56,189,248,0.6) !important;
          animation: none !important;
        }
        .hg-outer .hg-join-label {
          opacity: 0;
          transform: translateX(-50%) translateY(4px);
          transition: opacity 0.25s ease, transform 0.25s ease;
          pointer-events: none;
        }
        .hg-outer:hover .hg-join-label {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      `}</style>

      {/* Outer container — no Link wrapper so touch events reach Mapbox freely */}
      <div
        className="hg-outer"
        style={{
          position: 'relative',
          width: size + pad,
          height: size + pad,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        {/* ── Twinkling star field ── */}
        {STARS.map((s, i) => (
          <span key={i} style={{
            position: 'absolute',
            top: s.top, left: s.left,
            width: s.size, height: s.size,
            borderRadius: '50%',
            background: '#fff',
            opacity: s.opacity,
            pointerEvents: 'none',
            // @ts-expect-error CSS custom property
            '--star-op': s.opacity,
            animation: `hg-twinkle ${2.5 + i * 0.3}s ease-in-out ${s.delay} infinite`,
            boxShadow: s.size >= 1.5 ? '0 0 3px rgba(200,230,255,0.8)' : 'none',
          }} />
        ))}

        {/* ── Globe wrapper ── */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>

          {/* Globe body — Mapbox receives all pointer events directly */}
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
              onClick={handleMapClick}
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
              zIndex: 4,
            }}
          >
            Join FreeTrust →
          </div>
        </div>
      </div>
    </>
  )
}
