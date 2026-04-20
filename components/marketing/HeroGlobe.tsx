'use client'

import { useEffect, useRef } from 'react'
import Map, { type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
const MAP_STYLE   = 'mapbox://styles/davos212/cmo7emfe2000x01r3b3cn2zgq'

// ── Shooting star helper ───────────────────────────────────────────────────────
type ShootingStarProps = {
  style: React.CSSProperties
  animName: string
  duration: string
  delay: string
  width?: number
}
function ShootingStar({ style, animName, duration, delay, width = 60 }: ShootingStarProps) {
  return (
    <div style={{
      position: 'absolute',
      width,
      height: 2,
      background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.9), rgba(200,230,255,0.6), transparent)',
      borderRadius: 2,
      filter: 'blur(0.5px)',
      boxShadow: '0 0 4px rgba(255,255,255,0.8), 0 0 8px rgba(147,210,255,0.5)',
      animation: `${animName} ${duration} ease-in-out ${delay} infinite`,
      pointerEvents: 'none',
      ...style,
    }} />
  )
}

// ── HeroGlobe — Mapbox GL globe with auto-rotation ────────────────────────────
export default function HeroGlobe({ size = 220 }: { size?: number }) {
  const mapRef  = useRef<MapRef | null>(null)
  const bearRef = useRef(0)
  const rafRef  = useRef<number>(0)
  const pad     = 80

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
      {/* Keyframes for shooting stars + rings + pin pulse */}
      <style>{`
        @keyframes hg-spin-cw  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes hg-spin-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes hg-glow     { 0%,100% { box-shadow: 0 0 0 2px rgba(200,235,255,0.7), 0 0 35px rgba(56,189,248,0.8), 0 0 70px rgba(56,189,248,0.4); } 50% { box-shadow: 0 0 0 2.5px rgba(220,245,255,0.9), 0 0 50px rgba(56,189,248,1), 0 0 100px rgba(56,189,248,0.55); } }
        @keyframes hg-pin      { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(2); opacity:0.4; } }
        @keyframes hg-shoot-1  { 0%,82%,100%{ opacity:0; transform:translate(-70px,-25px) rotate(-25deg) scaleX(0.3); } 85%{ opacity:1; transform:translate(0,0) rotate(-25deg) scaleX(1); } 90%{ opacity:0; transform:translate(50px,18px) rotate(-25deg) scaleX(0.5); } }
        @keyframes hg-shoot-2  { 0%,68%,100%{ opacity:0; transform:translate(-90px,10px) rotate(-15deg) scaleX(0.3); } 71%{ opacity:0.9; transform:translate(0,0) rotate(-15deg) scaleX(1); } 76%{ opacity:0; transform:translate(60px,-22px) rotate(-15deg) scaleX(0.5); } }
        @keyframes hg-shoot-3  { 0%,55%,100%{ opacity:0; transform:translate(-50px,-40px) rotate(-35deg) scaleX(0.3); } 58%{ opacity:1; transform:translate(0,0) rotate(-35deg) scaleX(1); } 63%{ opacity:0; transform:translate(35px,28px) rotate(-35deg) scaleX(0.5); } }
        @keyframes hg-shoot-4  { 0%,40%,100%{ opacity:0; transform:translate(-75px,5px) rotate(-20deg) scaleX(0.3); } 43%{ opacity:0.85; transform:translate(0,0) rotate(-20deg) scaleX(1); } 48%{ opacity:0; transform:translate(55px,-15px) rotate(-20deg) scaleX(0.5); } }
        @keyframes hg-shoot-5  { 0%,25%,100%{ opacity:0; transform:translate(-60px,-15px) rotate(-30deg) scaleX(0.3); } 28%{ opacity:1; transform:translate(0,0) rotate(-30deg) scaleX(1); } 33%{ opacity:0; transform:translate(45px,10px) rotate(-30deg) scaleX(0.5); } }
        @keyframes hg-shoot-6  { 0%,90%,100%{ opacity:0; transform:translate(-85px,20px) rotate(-10deg) scaleX(0.3); } 93%{ opacity:0.9; transform:translate(0,0) rotate(-10deg) scaleX(1); } 97%{ opacity:0; transform:translate(65px,-30px) rotate(-10deg) scaleX(0.5); } }
        @keyframes hg-shoot-7  { 0%,10%,100%{ opacity:0; transform:translate(-65px,-30px) rotate(-40deg) scaleX(0.3); } 13%{ opacity:1; transform:translate(0,0) rotate(-40deg) scaleX(1); } 18%{ opacity:0; transform:translate(40px,20px) rotate(-40deg) scaleX(0.5); } }
        @keyframes hg-shoot-8  { 0%,48%,100%{ opacity:0; transform:translate(-55px,15px) rotate(-18deg) scaleX(0.3); } 51%{ opacity:0.85; transform:translate(0,0) rotate(-18deg) scaleX(1); } 56%{ opacity:0; transform:translate(40px,-12px) rotate(-18deg) scaleX(0.5); } }
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
        {/* ── Shooting stars ── */}
        <ShootingStar style={{ top: 10, left: 20 }}         animName="hg-shoot-1" duration="7s"   delay="0s"    width={65} />
        <ShootingStar style={{ top: 30, right: 15 }}        animName="hg-shoot-2" duration="9s"   delay="1.2s"  width={55} />
        <ShootingStar style={{ top: '60%', left: -10 }}     animName="hg-shoot-3" duration="8s"   delay="2.5s"  width={50} />
        <ShootingStar style={{ bottom: 40, right: 10 }}     animName="hg-shoot-4" duration="7.5s" delay="3.8s"  width={70} />
        <ShootingStar style={{ top: '15%', right: 25 }}     animName="hg-shoot-5" duration="10s"  delay="0.7s"  width={60} />
        <ShootingStar style={{ bottom: 20, left: 30 }}      animName="hg-shoot-6" duration="8.5s" delay="4.5s"  width={45} />
        <ShootingStar style={{ top: 5, left: '45%' }}       animName="hg-shoot-7" duration="9.5s" delay="5.5s"  width={58} />
        <ShootingStar style={{ bottom: '10%', right: 40 }}  animName="hg-shoot-8" duration="7s"   delay="2s"    width={52} />

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
