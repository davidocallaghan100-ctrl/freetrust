'use client'

// Persistent mini-player shown at the bottom of every page whenever a
// Music post is loaded into the global player (see
// context/MusicPlayerContext.tsx). This is what makes the "keep playing
// while I browse elsewhere in FreeTrust" behavior visible/controllable —
// without it, playback would continue silently in the background with no
// way to pause/seek/see what's playing once the originating feed card has
// scrolled out of view or the user has navigated to another page.

import MusicWaveform from '@/components/MusicWaveform'
import { FREETRUST_LOGO_SRC, useMusicPlayer } from '@/context/MusicPlayerContext'

function formatTimeMs(secs: number) {
  if (!Number.isFinite(secs) || secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const sec = Math.floor(secs % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function MusicMiniPlayer() {
  const { current, playing, currentTime, duration, blocked, play, pause, seek, stop, getAnalyser } = useMusicPlayer()

  if (!current) return null

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
  const artwork = current.backgroundImage || current.artwork
  const handleSeek = (fraction: number) => {
    if (duration > 0) seek(fraction * duration)
  }

  return (
    <>
      <style>{`
        .ft-music-mini { bottom: 0; }
        .ft-music-mini-main { display: flex; align-items: center; gap: 0.7rem; padding: 0.55rem 0.9rem; max-width: 1080px; margin: 0 auto; }
        .ft-music-mini-wave { flex: 1 1 260px; min-width: 0; max-width: 520px; }
        .ft-music-mini-time { color: #bae6fd; font-size: 11px; white-space: nowrap; min-width: 70px; text-align: right; }
        @media (max-width: 767px) {
          .ft-music-mini { bottom: calc(60px + env(safe-area-inset-bottom, 0px)); }
          .ft-music-mini-main { gap: 0.45rem; padding: 0.45rem 0.6rem; }
          .ft-music-mini-wave { flex-basis: 100px; }
          .ft-music-mini-time { display: none; }
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
        <div className="ft-music-mini-main">
          <div style={{ position: 'relative', width: 42, height: 42, flexShrink: 0, borderRadius: '10px', overflow: 'hidden', background: '#0b1220', border: '1px solid rgba(186,230,253,0.28)' }}>
            {artwork ? <img src={artwork} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
            <img src={FREETRUST_LOGO_SRC} alt="FreeTrust" style={{ position: 'absolute', inset: 0, width: artwork ? '58%' : '68%', height: artwork ? '58%' : '68%', margin: 'auto', objectFit: 'contain', filter: artwork ? 'drop-shadow(0 2px 5px rgba(0,0,0,0.55))' : 'none' }} />
          </div>
          <div style={{ flex: '0 1 170px', minWidth: 0 }}>
            <div style={{ color: '#f0f9ff', fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.title}</div>
            <div style={{ color: '#93c5fd', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {current.artist || `${formatTimeMs(currentTime)}${duration ? ` / ${formatTimeMs(duration)}` : ''}`}
              {blocked ? ' · tap ▶ to start' : ''}
            </div>
          </div>
          <div className="ft-music-mini-wave">
            <MusicWaveform
              peaks={current.waveform}
              seed={current.id}
              progress={progress}
              playing={playing}
              analyser={getAnalyser()}
              onSeek={duration > 0 ? handleSeek : undefined}
              height={46}
            />
          </div>
          <span className="ft-music-mini-time">
            {formatTimeMs(currentTime)} / {formatTimeMs(duration)}
          </span>
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
