'use client'

// Persistent mini-player shown at the bottom of every page whenever a
// Music post is loaded into the global player (see
// context/MusicPlayerContext.tsx). This is what makes the "keep playing
// while I browse elsewhere in FreeTrust" behavior visible/controllable —
// without it, playback would continue silently in the background with no
// way to pause/seek/see what's playing once the originating feed card has
// scrolled out of view or the user has navigated to another page.

import { useCallback, useEffect, useRef } from 'react'
import { FREETRUST_LOGO_SRC, useMusicPlayer } from '@/context/MusicPlayerContext'

function formatTimeMs(secs: number) {
  if (!Number.isFinite(secs) || secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const sec = Math.floor(secs % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function MusicMiniPlayer() {
  const { current, playing, currentTime, duration, blocked, play, pause, seek, stop, getAnalyser } = useMusicPlayer()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    const ctx2d = canvas?.getContext('2d')
    if (canvas && ctx2d) {
      const size = canvas.width
      ctx2d.clearRect(0, 0, size, size)
      const analyser = getAnalyser()
      const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
      if (analyser && freqData) analyser.getByteFrequencyData(freqData)
      const cx = size / 2
      const cy = size / 2
      const barCount = 16
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2
        let amp = 0.08
        if (freqData && playing) {
          const bin = freqData[Math.floor((i / barCount) * freqData.length)] ?? 0
          amp = Math.pow(bin / 255, 0.6) * (0.85 + 0.3 * Math.sin(Date.now() / 140 + i * 1.3))
          amp = Math.max(0.05, Math.min(1, amp))
        }
        const innerR = size * 0.28
        const outerR = innerR + amp * size * 0.22
        const x1 = cx + Math.cos(angle) * innerR
        const y1 = cy + Math.sin(angle) * innerR
        const x2 = cx + Math.cos(angle) * outerR
        const y2 = cy + Math.sin(angle) * outerR
        ctx2d.strokeStyle = playing ? `rgba(${56 + amp * 120},189,${248 - amp * 40},${0.6 + amp * 0.4})` : 'rgba(96,165,250,0.3)'
        ctx2d.lineWidth = Math.max(1.5, size * 0.03)
        ctx2d.lineCap = 'round'
        ctx2d.beginPath()
        ctx2d.moveTo(x1, y1)
        ctx2d.lineTo(x2, y2)
        ctx2d.stroke()
      }
    }
    rafRef.current = requestAnimationFrame(drawFrame)
  }, [getAnalyser, playing])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(drawFrame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [drawFrame])

  if (!current) return null

  const handleSeek = (clientX: number, target: HTMLDivElement) => {
    if (!duration) return
    const rect = target.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    seek(frac * duration)
  }

  return (
    <>
      <style>{`
        .ft-music-mini { bottom: 0; }
        @media (max-width: 767px) {
          .ft-music-mini { bottom: calc(60px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>
      <div
        className="ft-music-mini"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          zIndex: 140,
          background: 'linear-gradient(160deg, rgba(8,47,73,0.96), rgba(2,6,23,0.98))',
          borderTop: '1px solid rgba(56,189,248,0.28)',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.35)',
        }}
      >
        <div
          role="slider"
          aria-label="Seek track position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration || 0)}
          aria-valuenow={Math.round(currentTime)}
          onClick={e => handleSeek(e.clientX, e.currentTarget)}
          style={{ position: 'relative', height: 4, background: 'rgba(255,255,255,0.08)', cursor: duration ? 'pointer' : 'default' }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: duration ? `${Math.min(100, (currentTime / duration) * 100)}%` : '0%',
              background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
              transition: playing ? 'none' : 'width 0.2s ease-out',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.9rem' }}>
          <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: current.artwork ? `center/cover no-repeat url(${current.artwork})` : '#0b1220' }}>
            <canvas ref={canvasRef} width={40} height={40} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            {!current.artwork && (
              <img src={FREETRUST_LOGO_SRC} alt="FreeTrust" style={{ position: 'absolute', inset: 0, width: '62%', height: '62%', margin: 'auto', objectFit: 'contain' }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f0f9ff', fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.title}</div>
            <div style={{ color: '#93c5fd', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {current.artist ? current.artist : formatTimeMs(currentTime)}
              {blocked ? ' · tap ▶ to start' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => (playing ? pause() : void play(current))}
            aria-label={playing ? `Pause ${current.title}` : `Play ${current.title}`}
            style={{ width: 36, height: 36, flexShrink: 0, borderRadius: '50%', border: '1px solid rgba(186,230,253,0.4)', background: 'rgba(56,189,248,0.14)', color: '#f0f9ff', fontSize: 15, cursor: 'pointer' }}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            onClick={stop}
            aria-label="Close player"
            style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', border: 'none', background: 'transparent', color: '#93c5fd', fontSize: 15, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      </div>
    </>
  )
}
