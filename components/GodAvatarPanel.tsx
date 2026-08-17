'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { subscribeTrustAssistantState } from '@/lib/avatar/trustAssistantBus'

// ─── Config ──────────────────────────────────────────────────────────────────
const DESKTOP_QUERY = '(min-width: 1024px)'
const MS_PER_CHAR = 45
const MIN_TALK_MS = 2000
const MAX_TALK_MS = 12000
const MUTE_STORAGE_KEY = 'freetrust_god_avatar_muted'

// Mirrors TrustAssistant's own bottom-offset logic so the avatar panel stays
// vertically aligned with the chat window it sits beside, including on the
// mobile-service-checkout-bar pages where TrustAssistant shifts itself up.
// (Duplicated intentionally — small, self-contained, avoids refactoring
// TrustAssistant's internals just to share one derived number.)
function useChatBottomOffset(pathname: string) {
  const hasMobileServiceCheckoutBar = /^\/services\/[^/]+/.test(pathname)
  return hasMobileServiceCheckoutBar ? 232 : 152
}

function estimateTalkDuration(text: string) {
  const est = text.length * MS_PER_CHAR
  return Math.max(MIN_TALK_MS, Math.min(MAX_TALK_MS, est))
}

// Picks a male-sounding English voice if one is available; otherwise leaves
// the browser default. Purely best-effort — speechSynthesis voice lists load
// asynchronously in some browsers, so this quietly no-ops if none are ready.
function pickMaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const male = voices.find(v => /male/i.test(v.name) && /en/i.test(v.lang))
  return male ?? voices.find(v => /en/i.test(v.lang)) ?? voices[0] ?? null
}

// ─── Component ───────────────────────────────────────────────────────────────
// Desktop-only companion avatar for the TrustAssistant ("₮") chat widget.
// Renders David's Egyptian-god likeness as a fixed panel immediately to the
// left of the open chat window — the actual empty screen space at the moment
// the chat is open — rather than inside any single page's layout. Idle-loops
// until the chat opens; switches to a "talking" loop for the estimated
// duration of each new assistant reply, and can optionally read replies aloud
// via the Web Speech API.
export default function GodAvatarPanel() {
  const pathname = usePathname()
  const chatBottom = useChatBottomOffset(pathname)

  const [isDesktop, setIsDesktop] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [talking, setTalking] = useState(false)
  const [muted, setMuted] = useState(true)

  const talkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMessageIdRef = useRef<string | null>(null)

  // ── Desktop breakpoint gate ──
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(DESKTOP_QUERY)
    setIsDesktop(mq.matches)
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  // ── Restore mute preference ──
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MUTE_STORAGE_KEY)
      if (stored !== null) setMuted(stored === '1')
    } catch { /* no-op */ }
  }, [])

  // ── Subscribe to TrustAssistant open/close + new-reply events ──
  useEffect(() => {
    const unsubscribe = subscribeTrustAssistantState((detail) => {
      setChatOpen(detail.open)
      if (!detail.open) return

      if (detail.assistantMessageId && detail.assistantMessageId !== lastMessageIdRef.current) {
        lastMessageIdRef.current = detail.assistantMessageId
        const text = detail.assistantText ?? ''
        const duration = estimateTalkDuration(text)

        setTalking(true)
        if (talkTimerRef.current) clearTimeout(talkTimerRef.current)
        talkTimerRef.current = setTimeout(() => setTalking(false), duration)

        if (!muted && text && typeof window !== 'undefined' && window.speechSynthesis) {
          try {
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ''))
            const voice = pickMaleVoice()
            if (voice) utterance.voice = voice
            utterance.rate = 1
            window.speechSynthesis.speak(utterance)
          } catch { /* speech synthesis not available — silently skip */ }
        }
      }
    })
    return () => {
      unsubscribe()
      if (talkTimerRef.current) clearTimeout(talkTimerRef.current)
    }
  }, [muted])

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      try { window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0') } catch { /* no-op */ }
      if (next && typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
      return next
    })
  }, [])

  if (!isDesktop || !chatOpen || hidden) return null

  // Anchored immediately to the left of TrustAssistant's chat window
  // (right: 16, width min(380, 100vw-32)), with a small gap.
  const chatRight = 16
  const chatWidth = 380
  const gap = 14
  const panelWidth = 208

  return (
    <div
      className="ft-god-avatar-panel"
      style={{
        position: 'fixed',
        bottom: chatBottom,
        right: chatRight + chatWidth + gap,
        width: panelWidth,
        maxHeight: 'min(560px, calc(100vh - 120px))',
        zIndex: 9997,
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(56,189,248,0.18)',
        background: '#050a14',
        boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
        animation: 'god-avatar-fade-in 0.3s ease',
      }}
    >
      <style>{`
        @keyframes god-avatar-fade-in {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .god-avatar-video { transition: opacity 0.25s ease; }
        @media (max-width: 1023px) { .ft-god-avatar-panel { display: none !important; } }
      `}</style>

      {/* Close/hide control — independent of the chat's own close button */}
      <button
        onClick={() => setHidden(true)}
        aria-label="Hide avatar"
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 3,
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)',
          color: '#fff', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', lineHeight: 1, padding: 0,
        }}
      >✕</button>

      {/* Mute/unmute speech toggle */}
      <button
        onClick={toggleMute}
        aria-label={muted ? 'Unmute avatar voice' : 'Mute avatar voice'}
        style={{
          position: 'absolute', top: 8, left: 8, zIndex: 3,
          width: 26, height: 26, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)',
          color: '#fff', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0,
        }}
      >{muted ? '🔇' : '🔈'}</button>

      <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#000' }}>
        <video
          className="god-avatar-video"
          src="/avatar/god-idle.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            opacity: talking ? 0 : 1,
          }}
        />
        <video
          className="god-avatar-video"
          src="/avatar/god-talking.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            opacity: talking ? 1 : 0,
          }}
        />
      </div>

      <div style={{ padding: '8px 10px 10px', textAlign: 'center' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--ft-text-secondary)' }}>
          {talking ? 'Speaking…' : 'Listening'}
        </div>
      </div>
    </div>
  )
}
