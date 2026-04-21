'use client'

import { useEffect, useRef, useState } from 'react'
import Map, { type MapRef, Marker, Popup } from 'react-map-gl/mapbox'
import { createClient } from '@supabase/supabase-js'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN  = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
const MAP_STYLE     = 'mapbox://styles/davos212/cmo7emfe2000x01r3b3cn2zgq'
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

type Job = {
  id: string
  title: string
  location_label: string
  latitude: number
  longitude: number
}

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

export default function HeroGlobe({ size = 220 }: { size?: number }) {
  const mapRef       = useRef<MapRef | null>(null)
  const pad          = 60
  const [jobs, setJobs]               = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  // Fetch active jobs with coordinates
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) return
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON)
    sb
      .from('jobs')
      .select('id, title, location_label, latitude, longitude')
      .eq('status', 'active')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setJobs(data as Job[])
      })
  }, [])

  // Persistently fix touch-action so mobile pinch-zoom works.
  // Mapbox GL resets touch-action: none on the canvas on every render/interaction,
  // so we use a MutationObserver to override it back whenever it changes.
  useEffect(() => {
    let observer: MutationObserver | null = null

    const setupTouchFix = () => {
      const map = mapRef.current?.getMap()
      if (!map) return false

      const canvas = map.getCanvas()
      const container = map.getContainer()
      if (!canvas || !container) return false

      // Force touch-action on canvas and container only — do NOT walk up to page ancestors
      // as that would freeze mobile page scroll
      const forceTouch = () => {
        canvas.style.touchAction = 'pinch-zoom'
        container.style.touchAction = 'pinch-zoom'
      }

      forceTouch()

      // Watch the canvas style attribute and immediately override any reset
      observer = new MutationObserver(() => {
        if (canvas.style.touchAction !== 'pinch-zoom') {
          forceTouch()
        }
      })
      observer.observe(canvas, { attributes: true, attributeFilter: ['style'] })

      return true
    }

    // Poll until map style is loaded, then set up the persistent observer
    const pollTimer = setInterval(() => {
      if (setupTouchFix()) {
        clearInterval(pollTimer)
      }
    }, 200)

    return () => {
      clearInterval(pollTimer)
      observer?.disconnect()
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes hg-twinkle {
          0%,100% { opacity: var(--star-op); transform: scale(1); }
          50%      { opacity: calc(var(--star-op) * 0.25); transform: scale(0.6); }
        }
        @keyframes hg-glow {
          0%,100% { box-shadow: 0 0 0 2px rgba(200,235,255,0.7), 0 0 35px rgba(56,189,248,0.8), 0 0 70px rgba(56,189,248,0.4); }
          50%     { box-shadow: 0 0 0 2.5px rgba(220,245,255,0.9), 0 0 50px rgba(56,189,248,1), 0 0 100px rgba(56,189,248,0.55); }
        }
        @keyframes hg-pin { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(2); opacity:0.4; } }
        /* Clip map to circle without overflow:hidden blocking touch events */
        .hg-map-clip { clip-path: circle(50% at 50% 50%); }
        /* Override Mapbox popup default styles */
        .mapboxgl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        .mapboxgl-popup-tip { display: none !important; }
        /* Hide Mapbox branding */
        .mapboxgl-ctrl-logo { display: none !important; }
        .mapboxgl-ctrl-attrib { display: none !important; }
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
        {/* Twinkling stars */}
        {STARS.map((s, i) => (
          <span key={i} style={{
            position: 'absolute',
            top: s.top, left: s.left,
            width: s.size, height: s.size,
            borderRadius: '50%',
            background: '#fff',
            pointerEvents: 'none',
            // @ts-expect-error CSS custom property
            '--star-op': s.opacity,
            animation: `hg-twinkle ${2.5 + i * 0.3}s ease-in-out ${s.delay} infinite`,
            boxShadow: s.size >= 1.5 ? '0 0 3px rgba(200,230,255,0.8)' : 'none',
          }} />
        ))}

        {/* Globe */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>

          {/* Glow ring — separate from map so overflow:hidden doesn't block touch */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            boxShadow: '0 0 0 2px rgba(200,235,255,0.7), 0 0 35px rgba(56,189,248,0.8), 0 0 70px rgba(56,189,248,0.4), 0 0 120px rgba(56,189,248,0.2)',
            animation: 'hg-glow 3s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: 4,
          }} />

          {/* Map — clipped to circle via clip-path (no overflow:hidden) */}
          <div
            className="hg-map-clip"
            style={{ width: size, height: size, borderRadius: '50%', position: 'relative' }}
          >
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle={MAP_STYLE}
              projection={{ name: 'globe' }}
              initialViewState={{ longitude: -8, latitude: 20, zoom: 0.5 }}
              attributionControl={false}
              logoPosition="bottom-right"
              style={{ width: size, height: size }}
              dragPan={true}
              dragRotate={false}
              keyboard={false}
              scrollZoom={true}
              doubleClickZoom={true}
              touchZoomRotate={true}
              touchPitch={false}
              cooperativeGestures={false}
              onError={e => console.warn('[HeroGlobe]', e)}
            >
              {/* Job location pins */}
              {jobs.map(job => (
                <Marker
                  key={job.id}
                  longitude={job.longitude}
                  latitude={job.latitude}
                  anchor="center"
                  onClick={e => {
                    e.originalEvent.stopPropagation()
                    setSelectedJob(prev => prev?.id === job.id ? null : job)
                  }}
                >
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: '#34d399',
                    boxShadow: '0 0 6px rgba(52,211,153,0.9), 0 0 14px rgba(52,211,153,0.5)',
                    cursor: 'pointer',
                    border: '1.5px solid rgba(255,255,255,0.6)',
                  }} />
                </Marker>
              ))}

              {/* Popup for selected job */}
              {selectedJob && (
                <Popup
                  longitude={selectedJob.longitude}
                  latitude={selectedJob.latitude}
                  anchor="bottom"
                  closeButton={false}
                  closeOnClick={true}
                  onClose={() => setSelectedJob(null)}
                  offset={16}
                >
                  <div style={{
                    background: '#1a1a2e',
                    border: '1px solid rgba(52,211,153,0.4)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    minWidth: 160,
                    maxWidth: 220,
                  }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>
                      {selectedJob.title}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 8 }}>
                      {selectedJob.location_label}
                    </div>
                    <div
                      onClick={() => { window.location.href = '/jobs/' + selectedJob.id }}
                      style={{
                        color: '#34d399',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      View Job →
                    </div>
                  </div>
                </Popup>
              )}
            </Map>
          </div>

          {/* Overlays — atmosphere, crescent, shadow (all pointer-events:none) */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%, transparent 55%, rgba(96,165,250,0.06) 72%, rgba(56,189,248,0.22) 88%, rgba(147,210,255,0.4) 100%)', pointerEvents: 'none', zIndex: 2 }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 28% 22%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.07) 18%, transparent 45%)', pointerEvents: 'none', zIndex: 2 }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 74% 76%, rgba(0,0,10,0.32) 0%, transparent 48%)', pointerEvents: 'none', zIndex: 2 }} />

          {/* Europe pin */}
          <div style={{
            position: 'absolute',
            top: `${size * 0.33}px`,
            left: `${size * 0.47}px`,
            width: 10, height: 10, borderRadius: '50%',
            background: '#34d399',
            boxShadow: '0 0 8px rgba(52,211,153,1), 0 0 18px rgba(52,211,153,0.6)',
            animation: 'hg-pin 2s ease-in-out infinite',
            zIndex: 5,
            pointerEvents: 'none',
          }} />
        </div>
      </div>
    </>
  )
}
