'use client'

// Global, single-instance music player — mounted once at the app-shell level
// (see app/layout.tsx / components/AppShell.tsx) so it survives client-side
// route navigation instead of being torn down/recreated per feed card. This
// is what makes "keep playing while I browse elsewhere in FreeTrust" work:
// there is exactly one <audio> element + Web Audio graph for the whole app,
// owned by this provider, not one per <MusicPlayer> card instance.
//
// Also wires up the Media Session API (navigator.mediaSession) so the
// currently-playing track shows real title/artist/artwork and play/pause/
// seek controls on the OS lock screen / notification center / hardware
// media keys — the standard mechanism for "acts like a real music app"
// controls outside the page itself, on both mobile web and desktop.
//
// IMPORTANT scope note: this makes playback survive in-app navigation and
// gives it OS-level *remote control* surfaces. It does NOT make playback
// continue while the phone is locked or the user has switched to a
// different app entirely — mobile browsers suspend background tab audio
// more aggressively than that. True "keep playing while using other apps /
// screen locked" is only reliably achievable via the native app wrapper's
// OS background-audio capability (see .memory/capabilities/
// freetrust-mobile-release.md) — that is a separate, native-build-only
// follow-up, not something a web deploy can fully deliver.
//
// Participates in the platform-wide single-audio-source rule via the same
// FEED_AUDIO_PLAY_EVENT coordinator every other feed audio source
// (VideoPlayer, PhotoCarousel soundtrack, and this player) uses — see
// lib/feed/audioCoordinator.ts.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { FEED_AUDIO_PLAY_EVENT, announceFeedAudioPlayback, generateFeedPlayerId } from '@/lib/feed/audioCoordinator'

export const FREETRUST_LOGO_SRC = '/icons/freetrust-logo-website-20260521.png'

export type MusicTrackInfo = {
  /** Stable unique id for this track's *source post/card* — used to tell
   * whether a given feed card is the one currently loaded into the global
   * player (so it can render itself as "active" vs. idle). Using the post
   * id (not the audio URL) means two different posts that happen to share
   * a Spotify preview URL are still treated as distinct "now playing"
   * targets, matching what the user actually tapped. */
  id: string
  src: string
  title: string
  artist?: string | null
  artwork?: string | null
}

type MusicPlayerContextValue = {
  current: MusicTrackInfo | null
  playing: boolean
  blocked: boolean
  currentTime: number
  duration: number
  /** Load+play `track`. If it's already the loaded track, this toggles
   * play/pause instead of restarting it. */
  play: (track: MusicTrackInfo) => Promise<void>
  pause: () => void
  seek: (time: number) => void
  stop: () => void
  getAnalyser: () => AnalyserNode | null
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null)

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const playerIdRef = useRef(generateFeedPlayerId('ft-music-global'))
  const currentRef = useRef<MusicTrackInfo | null>(null)

  const [current, setCurrent] = useState<MusicTrackInfo | null>(null)
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => { currentRef.current = current }, [current])

  // Yield to any other feed audio source (video sound, soundtrack preview)
  // the moment it starts, and vice versa — every other player already
  // calls announceFeedAudioPlayback() before it becomes audible.
  useEffect(() => {
    const yieldToAnotherPlayer = (event: Event) => {
      const detail = (event as CustomEvent<{ playerId?: string }>).detail
      if (detail?.playerId === playerIdRef.current) return
      const audio = audioRef.current
      if (!audio || audio.paused) return
      audio.pause()
    }
    window.addEventListener(FEED_AUDIO_PLAY_EVENT, yieldToAnotherPlayer)
    return () => window.removeEventListener(FEED_AUDIO_PLAY_EVENT, yieldToAnotherPlayer)
  }, [])

  const ensureAudioGraph = useCallback(() => {
    const audio = audioRef.current
    if (!audio || sourceNodeRef.current) return
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = audioCtxRef.current ?? new AudioCtx()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.82
      // Safe to create this exactly once per <audio> element's lifetime —
      // this element is never destroyed/recreated (it's the one global
      // singleton, mounted once by this provider), and crossOrigin is set
      // on it before any `src` is ever assigned (see the JSX below), so
      // every future track load through it is correctly treated as a CORS
      // request instead of tainting the element for Web Audio.
      const sourceNode = ctx.createMediaElementSource(audio)
      sourceNode.connect(analyser)
      analyser.connect(ctx.destination)
      analyserRef.current = analyser
      sourceNodeRef.current = sourceNode
    } catch {
      // Web Audio unavailable/blocked — plain <audio> playback (and Media
      // Session controls) still work; only the visualizer stays idle.
    }
  }, [])

  const play = useCallback(async (track: MusicTrackInfo) => {
    const audio = audioRef.current
    if (!audio) return

    const isSameTrack = currentRef.current?.id === track.id
    if (isSameTrack) {
      if (!audio.paused) {
        audio.pause()
        return
      }
    } else {
      setCurrent(track)
      currentRef.current = track
      setCurrentTime(0)
      setDuration(0)
      audio.src = track.src
      audio.load()
    }

    ensureAudioGraph()
    if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume().catch(() => {})
    }
    try {
      announceFeedAudioPlayback(playerIdRef.current)
      await audio.play()
      setBlocked(false)
    } catch {
      // Autoplay/gesture rejection (e.g. NotAllowedError). Per the HTML
      // spec, calling play() sets `paused = false` and fires the native
      // 'play' event SYNCHRONOUSLY, before the returned promise settles —
      // so `playing` may already have flipped to true (via the onPlay
      // listener below) even though the promise is about to reject and no
      // audio is actually going to be audible. Some browsers don't follow
      // up a rejected play() with a native 'pause' event, which would
      // otherwise leave the UI stuck showing a Pause icon with no way to
      // actually start playback (tapping it would call pause(), a no-op).
      // Force both the real element and the `playing` state back to a
      // known "not playing" state here so the button always renders as a
      // tappable ▶ Play icon after a blocked attempt.
      audio.pause()
      setPlaying(false)
      setBlocked(true)
    }
  }, [ensureAudioGraph])

  const pause = useCallback(() => { audioRef.current?.pause() }, [])

  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = time
    setCurrentTime(time)
  }, [])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    setCurrent(null)
    currentRef.current = null
    setCurrentTime(0)
    setDuration(0)
  }, [])

  // ── Media Session API — lock-screen / notification-center / hardware
  // media-key controls on mobile web + desktop. ──────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !current) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist || 'FreeTrust',
        album: 'FreeTrust',
        artwork: [
          { src: current.artwork || FREETRUST_LOGO_SRC, sizes: '512x512', type: current.artwork ? undefined : 'image/png' },
        ].filter(a => !!a.src) as MediaImage[],
      })
    } catch {
      // MediaMetadata constructor can throw on malformed artwork entries in
      // some browsers — non-fatal, playback itself is unaffected.
    }
    navigator.mediaSession.setActionHandler('play', () => { if (current) void play(current) })
    navigator.mediaSession.setActionHandler('pause', () => pause())
    navigator.mediaSession.setActionHandler('seekto', details => {
      if (typeof details.seekTime === 'number') seek(details.seekTime)
    })
    navigator.mediaSession.setActionHandler('stop', () => stop())
    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('seekto', null)
        navigator.mediaSession.setActionHandler('stop', null)
      } catch { /* no-op */ }
    }
  }, [current, play, pause, seek, stop])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = current ? (playing ? 'playing' : 'paused') : 'none'
  }, [playing, current])

  const value = useMemo<MusicPlayerContextValue>(() => ({
    current,
    playing,
    blocked,
    currentTime,
    duration,
    play,
    pause,
    seek,
    stop,
    getAnalyser: () => analyserRef.current,
  }), [current, playing, blocked, currentTime, duration, play, pause, seek, stop])

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        // crossOrigin is set here, before this element is EVER given a
        // `src` (there is no `src` prop at all on initial mount — it's
        // only ever assigned imperatively via play() above). That
        // ordering is what makes this safe: per spec, "the crossorigin
        // content attribute must be set prior to setting the src content
        // attribute in order to take effect" for the *first* fetch a
        // media element performs, and here crossOrigin has already been
        // in place since before this element had any src to fetch.
        crossOrigin="anonymous"
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
      />
    </MusicPlayerContext.Provider>
  )
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext)
  if (!ctx) throw new Error('useMusicPlayer must be used within a MusicPlayerProvider')
  return ctx
}
