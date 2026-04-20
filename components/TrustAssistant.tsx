'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  creditCost?: number
}

interface UserProfile {
  id: string
  name: string | null
  email: string | null
  trustBalance: number
}

// ─── Page context hints ───────────────────────────────────────────────────────
const PAGE_HINTS: Record<string, string> = {
  '/services':   'Need help finding the right service?',
  '/products':   'Looking for something specific? I can help you find it.',
  '/wallet':     'Want to know how to earn more Trust?',
  '/create':     'Need help writing your listing?',
  '/seller':     'Need help writing your listing?',
  '/checkout':   'Questions about our secure payment & escrow?',
  '/cart':       'Questions about your order or payment?',
  '/profile':    'Want tips to improve your profile and earn more Trust?',
  '/community':  'Looking for the right group to join?',
  '/jobs':       'Need help finding or posting a job?',
  '/impact':     'Want to learn how your purchases drive real-world change?',
  '/onboarding': 'Let me guide you through getting started on FreeTrust!',
  '/orders':     'Have questions about an order? I can help.',
  '/disputes':   "I can guide you through the dispute process step by step.",
}

function getPageHint(path: string): string | null {
  for (const [key, hint] of Object.entries(PAGE_HINTS)) {
    if (path.startsWith(key)) return hint
  }
  return null
}

// ─── Animated dots ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '10px 14px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: '#38bdf8', display: 'inline-block',
          animation: `ta-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ─── Rotating Globe ────────────────────────────────────────────────────────────
// Pure CSS globe using a scrolling SVG inside a circular clip to simulate rotation.
// Two SVG copies sit side-by-side and scroll left — creating a seamless continent loop.
function RotatingGlobe({ size = 56 }: { size?: number }) {
  const continentPaths = `
    <!-- North America -->
    <path d="M18,12 C20,8 28,7 34,10 C38,12 40,18 38,24 C36,28 30,32 26,30 C20,28 14,22 18,12 Z" fill="#22c55e"/>
    <path d="M20,28 C22,26 26,30 28,34 C26,38 20,38 18,34 C16,30 18,28 20,28 Z" fill="#16a34a"/>
    <!-- Greenland -->
    <path d="M30,2 C34,1 38,3 38,7 C38,11 34,12 30,10 C26,8 26,3 30,2 Z" fill="#4ade80" opacity="0.7"/>
    <!-- Europe -->
    <path d="M54,8 C58,6 64,8 66,12 C68,16 64,20 60,20 C56,20 52,16 52,12 C52,10 53,9 54,8 Z" fill="#22c55e"/>
    <!-- Scandinavia -->
    <path d="M58,2 C62,1 66,4 66,7 C64,9 60,8 58,6 C56,5 56,3 58,2 Z" fill="#4ade80"/>
    <!-- Africa -->
    <path d="M56,22 C62,20 70,22 72,30 C74,38 72,50 68,56 C64,60 58,60 56,54 C52,48 50,36 52,28 C53,24 54,22 56,22 Z" fill="#16a34a"/>
    <!-- Middle East / Arabian Peninsula -->
    <path d="M72,28 C76,26 80,28 82,34 C80,38 76,38 74,36 C72,34 70,30 72,28 Z" fill="#22c55e"/>
    <!-- Russia / Central Asia -->
    <path d="M70,4 C80,2 100,4 106,8 C110,12 108,18 100,18 C88,18 74,16 70,12 C68,10 68,6 70,4 Z" fill="#22c55e"/>
    <!-- India -->
    <path d="M84,22 C88,20 92,22 92,28 C92,34 88,40 84,40 C80,38 78,32 80,26 C81,24 82,22 84,22 Z" fill="#4ade80"/>
    <!-- China / SE Asia -->
    <path d="M98,10 C108,8 118,10 122,16 C124,22 120,28 112,28 C104,28 96,24 96,18 C96,14 97,11 98,10 Z" fill="#16a34a"/>
    <path d="M108,26 C114,24 120,28 122,34 C120,40 114,42 110,40 C106,38 104,32 106,28 C107,27 107,26 108,26 Z" fill="#22c55e"/>
    <!-- Japan -->
    <path d="M128,12 C130,10 134,12 134,16 C134,20 130,22 128,20 C126,18 126,14 128,12 Z" fill="#4ade80"/>
    <!-- Australia -->
    <path d="M114,52 C120,48 132,50 136,56 C138,62 134,70 128,72 C122,72 114,68 112,62 C110,58 112,54 114,52 Z" fill="#22c55e"/>
    <!-- South America -->
    <path d="M30,36 C36,32 44,34 46,42 C48,50 46,62 42,68 C38,72 32,72 28,66 C24,58 24,46 28,40 C29,38 30,36 30,36 Z" fill="#16a34a"/>
    <!-- Antarctica hint -->
    <path d="M0,90 Q50,82 100,84 Q150,82 200,90 L200,100 L0,100 Z" fill="white" opacity="0.5"/>
    <!-- Arctic -->
    <path d="M0,0 Q50,6 100,4 Q150,6 200,0 L200,8 Q150,14 100,12 Q50,14 0,8 Z" fill="white" opacity="0.4"/>
  `

  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
    }}>
      {/* Globe sphere with clipped scrolling continents */}
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 40% 35%, #2596d1 0%, #1565a8 45%, #0d3d6b 100%)',
        position: 'relative',
        boxShadow: '0 0 0 1.5px rgba(255,255,255,0.55), 0 0 16px rgba(56,189,248,0.55), 0 0 32px rgba(56,189,248,0.25)',
        animation: 'globe-glow 3s ease-in-out infinite',
      }}>
        {/* Scrolling continents — two SVGs side by side for seamless loop */}
        <div style={{
          display: 'flex',
          width: size * 4,
          height: size,
          animation: `globe-spin ${size > 100 ? 18 : 12}s linear infinite`,
        }}>
          {[0, 1, 2, 3].map(i => (
            <svg
              key={i}
              viewBox="0 0 200 100"
              preserveAspectRatio="xMidYMid slice"
              style={{ width: size, height: size, flexShrink: 0 }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="200" height="100" fill="transparent" />
              <g dangerouslySetInnerHTML={{ __html: continentPaths }} />
            </svg>
          ))}
        </div>

        {/* Sphere lighting overlay — 3D crescent highlight */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.1) 30%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Atmosphere rim glow on edges */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 50%, transparent 55%, rgba(56,189,248,0.12) 80%, rgba(56,189,248,0.25) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Ireland/Europe pin */}
        <div style={{
          position: 'absolute',
          top: `${size * 0.33}px`,
          left: `${size * 0.47}px`,
          width: size > 100 ? 8 : 5,
          height: size > 100 ? 8 : 5,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 0 6px rgba(255,255,255,0.9), 0 0 12px rgba(56,189,248,0.8)',
          animation: 'pin-pulse 2s ease-in-out infinite',
          zIndex: 2,
        }} />
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function TrustAssistant() {
  const pathname = usePathname()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [hintShown, setHintShown] = useState<string | null>(null)
  const [showHintBadge, setShowHintBadge] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [escalated, setEscalated] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Load user ──
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const [profileRes, walletRes] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle(),
          supabase.from('trust_balances').select('balance').eq('user_id', session.user.id).maybeSingle(),
        ])
        setUser({
          id: session.user.id,
          name: profileRes.data?.full_name ?? null,
          email: session.user.email ?? null,
          trustBalance: walletRes.data?.balance ?? 0,
        })
      } catch { /* no-op */ }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Page hint badge ──
  useEffect(() => {
    const hint = getPageHint(pathname)
    if (hint && hint !== hintShown && !open) {
      setHintShown(hint)
      setShowHintBadge(true)
      const t = setTimeout(() => setShowHintBadge(false), 8000)
      return () => clearTimeout(t)
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom on new message ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Focus input when opened ──
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // ── Greeting on first open ──
  const handleOpen = useCallback(() => {
    setOpen(true)
    setShowHintBadge(false)
    if (messages.length === 0) {
      const firstName = user?.name?.split(' ')[0] ?? 'there'
      const hint = getPageHint(pathname)
      const greeting = user
        ? `Hey ${firstName}! 👋 I'm your **Trust Assistant** — here to help you get the most from FreeTrust.\n\nYour Trust balance: **₮${user.trustBalance}**\n\n${hint ? hint + '\n\n' : ''}What can I help you with today?`
        : `Hey! 👋 I'm your **Trust Assistant** — here to help you get the most from FreeTrust.\n\n${hint ? hint + '\n\n' : ''}What can I help you with today?`
      setMessages([{ id: 'greeting', role: 'assistant', content: greeting, ts: Date.now() }])
    }
  }, [messages.length, user, pathname])

  // ── Send message ──
  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationId,
          page: pathname,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          user: user ? { name: user.name, trustBalance: user.trustBalance } : null,
        }),
      })
      const data = await res.json()
      if (data.conversationId) setConversationId(data.conversationId)
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply ?? "Sorry, I'm having a moment — try again?",
        ts: Date.now(),
        creditCost: data.creditCost,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: "Sorry, something went wrong. Try again in a moment!", ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, conversationId, pathname, messages, user])

  // ── Escalate to human ──
  const escalate = async () => {
    setEscalating(true)
    try {
      await fetch('/api/assistant/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          userId: user?.id,
          userName: user?.name,
          userEmail: user?.email,
          page: pathname,
          summary: messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n'),
        }),
      })
      setEscalated(true)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant', ts: Date.now(),
        content: "✅ I've created a support ticket and notified our team. Someone will follow up with you by email within a few hours. Is there anything else I can help with in the meantime?",
      }])
    } catch {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', ts: Date.now(), content: "Something went wrong creating your ticket. Please email support@freetrust.co directly." }])
    } finally {
      setEscalating(false)
    }
  }

  // ── Quick suggestions based on page ──
  const quickReplies: string[] = (() => {
    if (pathname.startsWith('/wallet')) return ['How do I earn more Trust?', 'How do I withdraw?', 'What is escrow?']
    if (pathname.startsWith('/services') || pathname.startsWith('/products')) return ['How does buying work?', 'Is payment secure?', 'How do I leave a review?']
    if (pathname.startsWith('/profile')) return ['How do I get verified?', 'How do I improve my Trust score?', 'How do I add a listing?']
    if (pathname.startsWith('/community')) return ['How do I create a group?', 'Are groups free?', 'How do I find my people?']
    if (pathname.startsWith('/orders') || pathname.startsWith('/disputes')) return ['How does escrow work?', 'How do I raise a dispute?', 'When do I get paid?']
    if (pathname.startsWith('/jobs')) return ['How do I post a job?', 'Is it free to apply?', 'How do I find remote jobs?']
    return ['How does Trust work?', 'How do I earn Trust points?', 'How does escrow protect me?']
  })()

  // ── Render markdown-lite (bold + newlines) ──
  function renderContent(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return part.split('\n').map((line, j) => (
        <React.Fragment key={`${i}-${j}`}>{line}{j < part.split('\n').length - 1 && <br />}</React.Fragment>
      ))
    })
  }

  const accent = '#38bdf8'

  // ── Globe click handler ──
  const handleGlobeClick = () => {
    if (open) {
      setOpen(false)
    } else {
      handleOpen()
    }
  }

  return (
    <>
      <style>{`
        @keyframes globe-spin {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes globe-glow {
          0%,100% { box-shadow: 0 0 0 1.5px rgba(255,255,255,0.55), 0 0 16px rgba(56,189,248,0.55), 0 0 32px rgba(56,189,248,0.25); }
          50%     { box-shadow: 0 0 0 2px rgba(255,255,255,0.75), 0 0 22px rgba(56,189,248,0.75), 0 0 44px rgba(56,189,248,0.4); }
        }
        @keyframes pin-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.6; transform: scale(1.5); }
        }
        @keyframes ta-dot {
          0%,80%,100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes ta-slide-up {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ta-hint-in {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .ta-globe-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: block;
          transition: transform 0.2s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .ta-globe-btn:hover { transform: scale(1.07); }
        .ta-globe-btn:active { transform: scale(0.96); }
        .ta-send:hover { background: #0ea5e9 !important; }
        .ta-quick:hover { background: rgba(56,189,248,0.15) !important; border-color: rgba(56,189,248,0.4) !important; }
        .ta-escalate:hover { background: rgba(251,191,36,0.15) !important; }
        .ta-msg-user { background: linear-gradient(135deg,#38bdf8,#0284c7); color: #0f172a; border-radius: 16px 16px 4px 16px; }
        .ta-msg-bot { background: #1e293b; color: #f1f5f9; border-radius: 16px 16px 16px 4px; border: 1px solid rgba(56,189,248,0.12); }
      `}</style>

      {/* ── Hint badge ── */}
      {showHintBadge && !open && hintShown && !dismissed && (
        <div style={{
          position: 'fixed', bottom: 158, right: 20, zIndex: 9998,
          background: '#1e293b', border: `1px solid ${accent}`, borderRadius: 12,
          padding: '10px 14px', maxWidth: 240, fontSize: '0.8rem', color: '#f1f5f9',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'ta-hint-in 0.3s ease',
          cursor: 'pointer',
        }} onClick={handleOpen}>
          <div style={{ fontSize: '0.72rem', color: accent, fontWeight: 700, marginBottom: 3 }}>Trust Assistant <span style={{ fontWeight: 900 }}>₮</span></div>
          {hintShown}
          <div style={{ position: 'absolute', bottom: -6, right: 20, width: 12, height: 12, background: '#1e293b', border: `1px solid ${accent}`, borderTop: 'none', borderLeft: 'none', transform: 'rotate(45deg)' }} />
        </div>
      )}

      {/* ── Floating globe + dismiss ── */}
      {!dismissed && (
        <div style={{
          position: 'fixed', bottom: 80, right: 14, zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}>
          {/* Dismiss ✕ button */}
          {!open && (
            <button
              onClick={() => setDismissed(true)}
              aria-label="Hide Trust Assistant"
              style={{
                width: 18, height: 18, borderRadius: '50%',
                background: '#334155', border: '1px solid #475569',
                color: '#94a3b8', fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', lineHeight: 1, padding: 0,
                alignSelf: 'flex-end', marginBottom: 2,
              }}
            >✕</button>
          )}

          {/* Globe button wrapper */}
          <div className="ta-globe-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              className="ta-globe-btn"
              onClick={handleGlobeClick}
              aria-label={open ? 'Close Trust Assistant' : 'Join FreeTrust'}
            >
              {open ? (
                /* Close X when chat is open */
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  border: '2px solid rgba(56,189,248,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  color: '#94a3b8', fontSize: 16, fontWeight: 700,
                }}>✕</div>
              ) : (
                <RotatingGlobe size={56} />
              )}
            </button>


          </div>
        </div>
      )}

      {/* ── Chat window ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 152, right: 16, zIndex: 9998,
          width: 'min(380px, calc(100vw - 32px))',
          height: 'min(560px, calc(100vh - 120px))',
          background: '#0d1627',
          border: `1px solid rgba(56,189,248,0.2)`,
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          animation: 'ta-slide-up 0.25s ease',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(2,132,199,0.1))', borderBottom: '1px solid rgba(56,189,248,0.15)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '-0.5px', fontFamily: 'system-ui, sans-serif', lineHeight: 1 }}>₮</span></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>Trust Assistant</div>
              <div style={{ fontSize: '0.7rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                Online · Always here to help
              </div>
            </div>
            {user && (
              <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, color: accent }}>
                ₮{user.trustBalance}
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div
                  className={msg.role === 'user' ? 'ta-msg-user' : 'ta-msg-bot'}
                  style={{ maxWidth: '85%', padding: '10px 13px', fontSize: '0.85rem', lineHeight: 1.55 }}
                >
                  {renderContent(msg.content)}
                  {msg.creditCost && (
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 4 }}>Used {msg.creditCost} AI credit</div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div className="ta-msg-bot" style={{ padding: '2px 4px' }}><TypingDots /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {messages.length <= 2 && (
            <div style={{ padding: '6px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
              {quickReplies.map(q => (
                <button key={q} className="ta-quick" onClick={() => send(q)}
                  style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 999, padding: '5px 10px', fontSize: '0.72rem', color: accent, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Escalate to human */}
          {messages.length >= 4 && !escalated && (
            <div style={{ padding: '4px 14px', flexShrink: 0 }}>
              <button className="ta-escalate" onClick={escalate} disabled={escalating}
                style={{ width: '100%', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '7px', fontSize: '0.75rem', color: '#fbbf24', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                {escalating ? 'Creating ticket…' : '👤 Talk to a human instead'}
              </button>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(56,189,248,0.1)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Ask me anything…"
              style={{ flex: 1, background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '9px 12px', fontSize: '0.85rem', color: '#f1f5f9', outline: 'none', fontFamily: 'inherit' }}
            />
            <button className="ta-send" onClick={() => send()} disabled={!input.trim() || loading}
              style={{ background: accent, border: 'none', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !input.trim() || loading ? 0.5 : 1, transition: 'background 0.15s' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '4px 0 8px', fontSize: '0.62rem', color: '#334155', flexShrink: 0 }}>
            Powered by FreeTrust AI · Free support, always
          </div>
        </div>
      )}
    </>
  )
}
