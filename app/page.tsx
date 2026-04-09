'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
type TickerItem = { id: string; type: string; text: string; time: string }
type StatsData = {
  members: { total: number; thisWeek: number; thisMonth: number }
  listings: { services: number; products: number }
  events: { upcoming: number }
  articles: { published: number }
  communities: { total: number }
  trust: { total: number; thisWeek: number }
  ticker: TickerItem[]
  growth: { date: string; count: number; cumulative: number }[]
  foundingGoal: number
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    started.current = false
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return
      started.current = true
      observer.disconnect()
      const from = 0; const dur = 1000; const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - t0) / dur, 1)
        const e = 1 - Math.pow(1 - p, 3)
        setCount(Math.round(from + (target - from) * e))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.2 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])
  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

// ── AI Voice Bubble ───────────────────────────────────────────────────────────
const VOICE_MESSAGES = [
  'Welcome to FreeTrust — where trust is currency',
  'Buy, sell and connect with trusted members',
  'Earn Trust with every transaction you make',
  'Join as a founding member today',
  'Built for creators, freelancers and founders',
  'The more you earn, the less you pay in fees',
]

function AIVoiceBubble({ size = 220 }: { size?: number }) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [fade, setFade] = useState(true)
  const [speaking, setSpeaking] = useState(true)
  const s = size

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false)
      setSpeaking(false)
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % VOICE_MESSAGES.length)
        setFade(true)
        setSpeaking(true)
      }, 500)
    }, 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', userSelect: 'none' }}>
      {/* Bubble */}
      <div style={{ position: 'relative', width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="ai-bubble-wrap">
        {/* Outer rotating dashed ring */}
        <div className="ai-ring-outer" style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2px dashed rgba(56,189,248,0.35)',
          animation: 'ai-spin-cw 12s linear infinite',
        }} />
        {/* Ripple rings */}
        <div className="ai-ripple ai-ripple-1" style={{ position: 'absolute', borderRadius: '50%', border: '1px solid rgba(56,189,248,0.18)', animation: 'ai-ripple 3s ease-out infinite' }} />
        <div className="ai-ripple ai-ripple-2" style={{ position: 'absolute', borderRadius: '50%', border: '1px solid rgba(52,211,153,0.12)', animation: 'ai-ripple 3s ease-out infinite 1s' }} />
        <div className="ai-ripple ai-ripple-3" style={{ position: 'absolute', borderRadius: '50%', border: '1px solid rgba(56,189,248,0.08)', animation: 'ai-ripple 3s ease-out infinite 2s' }} />
        {/* Mid counter-rotating dotted ring */}
        <div style={{
          position: 'absolute', inset: Math.round(s * 0.08), borderRadius: '50%',
          border: '1.5px dotted rgba(52,211,153,0.4)',
          animation: 'ai-spin-ccw 8s linear infinite',
        }} />
        {/* Outer glow */}
        <div style={{
          position: 'absolute', inset: Math.round(s * 0.12), borderRadius: '50%',
          background: speaking
            ? 'radial-gradient(circle, rgba(52,211,153,0.18) 0%, rgba(56,189,248,0.12) 50%, transparent 75%)'
            : 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)',
          animation: 'ai-pulse 2.2s ease-in-out infinite',
          transition: 'background 0.6s',
        }} />
        {/* Core sphere */}
        <div style={{
          position: 'absolute', inset: Math.round(s * 0.18), borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, rgba(96,165,250,0.55) 0%, rgba(30,41,59,0.97) 55%, rgba(15,23,42,1) 100%)',
          boxShadow: speaking
            ? `0 0 ${Math.round(s*0.14)}px rgba(56,189,248,0.55), 0 0 ${Math.round(s*0.06)}px rgba(52,211,153,0.4) inset`
            : `0 0 ${Math.round(s*0.08)}px rgba(56,189,248,0.3)`,
          animation: 'ai-breathe 3s ease-in-out infinite',
          transition: 'box-shadow 0.6s',
        }}>
          {/* Shimmer highlight */}
          <div style={{
            position: 'absolute', top: '18%', left: '22%',
            width: '35%', height: '25%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.22) 0%, transparent 70%)',
            borderRadius: '50%',
          }} />
          {/* Inner glow core */}
          <div style={{
            position: 'absolute', inset: '25%',
            borderRadius: '50%',
            background: speaking
              ? 'radial-gradient(circle, rgba(52,211,153,0.45) 0%, rgba(56,189,248,0.3) 50%, transparent 75%)'
              : 'radial-gradient(circle, rgba(56,189,248,0.3) 0%, transparent 70%)',
            animation: 'ai-core-pulse 1.8s ease-in-out infinite',
            transition: 'background 0.6s',
          }} />
        </div>
        {/* Orbiting dot — centred, orbits via rotate+translateX */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: Math.round(s * 0.07), height: Math.round(s * 0.07),
          marginTop: -Math.round(s * 0.035), marginLeft: -Math.round(s * 0.035),
          borderRadius: '50%',
          background: 'radial-gradient(circle, #7dd3fc 0%, #0ea5e9 100%)',
          boxShadow: '0 0 10px rgba(56,189,248,1), 0 0 20px rgba(56,189,248,0.5)',
          animation: 'ai-orbit 4s linear infinite',
          transformOrigin: 'center center',
        }} />
      </div>

      {/* Rotating message */}
      <div style={{ minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
        <p style={{
          fontSize: 'clamp(0.85rem, 2.5vw, 1rem)', color: '#94a3b8',
          textAlign: 'center', margin: 0, maxWidth: 360, lineHeight: 1.5,
          opacity: fade ? 1 : 0, transition: 'opacity 0.4s',
          fontStyle: 'italic',
        }}>
          &ldquo;{VOICE_MESSAGES[msgIdx]}&rdquo;
        </p>
        {/* Speech wave bars */}
        {speaking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className={`ai-wave-bar ai-wave-bar-${i}`} style={{
                width: 3, borderRadius: 99,
                background: 'linear-gradient(to top, #38bdf8, #34d399)',
                animation: `ai-wave 1.2s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Talk to AI button */}
      <Link href="/feed" style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(52,211,153,0.1))',
        border: '1px solid rgba(56,189,248,0.35)',
        borderRadius: 999, padding: '0.6rem 1.4rem',
        color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700,
        textDecoration: 'none', transition: 'all 0.2s',
        backdropFilter: 'blur(8px)',
      }}>
        <span style={{ fontSize: '1rem' }}>🎙</span>
        Talk to FreeTrust AI
      </Link>
    </div>
  )
}

// ── Featured service card ─────────────────────────────────────────────────────
const FEATURED_SERVICES = [
  { id:'s1', title:'Brand Identity Design', provider:'Sarah Chen', avatar:'https://i.pravatar.cc/40?img=47', trust:1240, price:450, rating:4.9, reviews:127, tags:['Logo','Brand','Figma'], grad:'linear-gradient(135deg,#f472b6,#db2777)' },
  { id:'s2', title:'Full-Stack Web Dev', provider:'Priya Nair', avatar:'https://i.pravatar.cc/40?img=44', trust:1580, price:2800, rating:5.0, reviews:89, tags:['Next.js','Supabase','TypeScript'], grad:'linear-gradient(135deg,#38bdf8,#0284c7)' },
  { id:'s3', title:'SEO & Content Strategy', provider:'Marcus Obi', avatar:'https://i.pravatar.cc/40?img=12', trust:2100, price:320, rating:4.8, reviews:64, tags:['SEO','Content','Analytics'], grad:'linear-gradient(135deg,#34d399,#059669)' },
  { id:'s4', title:'Business Coaching', provider:'Amara Diallo', avatar:'https://i.pravatar.cc/40?img=45', trust:890, price:480, rating:4.9, reviews:38, tags:['Startup','Strategy','Growth'], grad:'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { id:'s5', title:'AI Automation Setup', provider:'Tom Walsh', avatar:'https://i.pravatar.cc/40?img=53', trust:780, price:380, rating:4.7, reviews:43, tags:['Make','Zapier','GPT'], grad:'linear-gradient(135deg,#fbbf24,#d97706)' },
]

const FEATURED_PRODUCTS = [
  { id:'p1', title:'Notion Business OS', seller:'Priya Nair', avatar:'https://i.pravatar.cc/40?img=44', price:29, rating:4.9, reviews:284, type:'digital', grad:'linear-gradient(135deg,#34d399,#059669)' },
  { id:'p2', title:'Next.js SaaS Boilerplate', seller:'Marcus Obi', avatar:'https://i.pravatar.cc/40?img=12', price:129, rating:4.9, reviews:378, type:'digital', grad:'linear-gradient(135deg,#818cf8,#4338ca)' },
  { id:'p3', title:'UI Component Library', seller:'Sarah Chen', avatar:'https://i.pravatar.cc/40?img=47', price:79, rating:5.0, reviews:512, type:'digital', grad:'linear-gradient(135deg,#f472b6,#db2777)' },
  { id:'p4', title:'FreeTrust Merch Hoodie', seller:'Maja Eriksson', avatar:'https://i.pravatar.cc/40?img=25', price:65, rating:4.8, reviews:91, type:'physical', grad:'linear-gradient(135deg,#38bdf8,#0284c7)' },
  { id:'p5', title:'Ambient Lo-Fi Music Pack', seller:'Lena Fischer', avatar:'https://i.pravatar.cc/40?img=41', price:24, rating:4.8, reviews:203, type:'digital', grad:'linear-gradient(135deg,#a78bfa,#7c3aed)' },
]

// ── Value props ───────────────────────────────────────────────────────────────
const VALUE_PROPS = [
  { icon: '₮', title: 'Trust is your currency', desc: 'Every transaction, review, and contribution earns Trust tokens. Higher Trust = lower fees and better visibility.' },
  { icon: '0%', title: 'Fees that drop to zero', desc: 'Start at 5%, reach Elite level and pay nothing. The more you do, the less it costs — forever.' },
  { icon: '🌍', title: 'Commerce with purpose', desc: '1% of every transaction funds community impact projects. Buy and sell knowing your money does more.' },
]

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [stats, setStats] = useState<StatsData | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' })
      if (res.ok) setStats(await res.json() as StatsData)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    void fetchStats()
    const iv = setInterval(fetchStats, 60_000)
    return () => clearInterval(iv)
  }, [fetchStats])

  const tm = stats?.members.total ?? 0
  const tw = stats?.members.thisWeek ?? 0
  const tt = stats?.trust.total ?? 0
  const sl = stats?.listings.services ?? 0
  const pl = stats?.listings.products ?? 0
  const goal = stats?.foundingGoal ?? 1000
  const pct = Math.min((tm / goal) * 100, 100)

  return (
    <main style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' }}>

      {/* ── GLOBAL STYLES ── */}
      <style>{`
        /* AI bubble animations */
        @keyframes ai-spin-cw  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes ai-spin-ccw { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
        @keyframes ai-pulse    { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
        @keyframes ai-breathe  { 0%,100% { transform: scale(1); }    50% { transform: scale(1.025); } }
        @keyframes ai-core-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        /* Orbiting dot — rotate around centre then counter-rotate the dot so it stays upright */
        @keyframes ai-orbit {
          from { transform: rotate(0deg) translateX(72px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(72px) rotate(-360deg); }
        }
        .ai-bubble-wrap .ai-ripple-1 { inset: -8px; }
        .ai-bubble-wrap .ai-ripple-2 { inset: -18px; }
        .ai-bubble-wrap .ai-ripple-3 { inset: -30px; }
        @keyframes ai-ripple { 0% { opacity: 0.6; transform: scale(1); } 100% { opacity: 0; transform: scale(1.4); } }
        @keyframes ai-wave   { 0%,100% { height: 4px; } 50% { height: 18px; } }
        .ai-wave-bar { display: inline-block; height: 4px; }

        /* Founding bar shimmer */
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .found-bar { background: linear-gradient(90deg,#38bdf8,#818cf8,#38bdf8); background-size: 200% auto; animation: shimmer 2.5s linear infinite; }
        @keyframes pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.5); } }
        .live-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #34d399; animation: pulse-dot 1.8s ease-in-out infinite; flex-shrink: 0; }

        /* Layout helpers */
        .lp { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; }
        .lp-sec { padding: 3.5rem 1.25rem; max-width: 1100px; margin: 0 auto; }
        .hscroll { display: flex; gap: 1rem; overflow-x: auto; scrollbar-width: none; padding-bottom: 6px; -webkit-overflow-scrolling: touch; }
        .hscroll::-webkit-scrollbar { display: none; }

        /* Mobile resets */
        @media (max-width: 768px) {
          .hero-inner { flex-direction: column !important; text-align: center; }
          .hero-text { align-items: center !important; }
          .hero-cta { flex-direction: column !important; width: 100% !important; }
          .hero-cta a, .hero-cta button { width: 100% !important; text-align: center; justify-content: center; }
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .val-grid { grid-template-columns: 1fr !important; }
          .found-inner { flex-direction: column !important; text-align: center; }
          .footer-links { justify-content: center !important; }
          .lp-sec { padding: 2.5rem 1rem; }
          .lp { padding: 0 1rem; }
          .section-h2 { font-size: clamp(1.4rem,5vw,2rem) !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {/* ── 2. HERO ── */}
      <div style={{ background: 'radial-gradient(ellipse 100% 80% at 50% -5%, rgba(56,189,248,0.13) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 85% 40%, rgba(129,140,248,0.08) 0%, transparent 60%)', borderBottom: '1px solid rgba(56,189,248,0.08)', paddingTop: '3rem', paddingBottom: '2.5rem' }}>
        <div className="lp" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center' }} >
          <div className="hero-inner" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>

            {/* Left: bubble */}
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center' }} className="bubble-col">
              <style>{`
                @media (max-width: 640px) { .bubble-col > div { transform: scale(0.78); transform-origin: center top; } }
              `}</style>
              <AIVoiceBubble size={220} />
            </div>

            {/* Right: headline + CTAs */}
            <div className="hero-text" style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1.25rem', maxWidth: 560 }}>
              <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.75rem', color: '#38bdf8', letterSpacing: '0.06em', fontWeight: 700 }}>
                ✦ THE TRUST ECONOMY
              </div>

              <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.1, margin: 0, letterSpacing: '-1.5px' }}>
                The platform where<br />
                <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>trust pays dividends</span>
              </h1>

              <p style={{ fontSize: '1.05rem', color: '#94a3b8', margin: 0, lineHeight: 1.65, maxWidth: 480 }}>
                FreeTrust is a social commerce platform where your reputation is your currency. The more you transact, the more you earn — and the less you pay in fees.
              </p>

              <div className="hero-cta" style={{ display: 'flex', flexDirection: 'row', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.9rem 2rem', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.35)' }}>
                  Claim Founding Spot →
                </Link>
                <Link href="/services" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', padding: '0.9rem 1.75rem', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none', border: '1px solid rgba(148,163,184,0.2)' }}>
                  Browse Marketplace
                </Link>
              </div>

              {/* Trust points */}
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#34d399' }}>✓</span> Free to join — ₮25 on signup</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#34d399' }}>✓</span> Fees from 0% at Elite</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#34d399' }}>✓</span> No subscription</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. STATS BAR ── */}
      <div style={{ background: 'rgba(56,189,248,0.03)', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div className="lp" style={{ padding: '1.75rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '1rem', fontSize: '0.72rem', color: '#475569' }}>
            <span className="live-dot" /> Live stats — refreshes every 60s
          </div>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.85rem', textAlign: 'center' }}>
            {[
              { val: tm, prefix: '', suffix: '', label: 'Members & growing', sub: tw > 0 ? `+${tw} this week` : 'Join free' },
              { val: sl, prefix: '', suffix: '', label: 'Services available', sub: sl === 0 ? 'Be the first!' : 'Browse now' },
              { val: pl, prefix: '', suffix: '', label: 'Products listed', sub: pl === 0 ? 'List yours' : 'Shop now' },
              { val: tt, prefix: '₮', suffix: '', label: 'Trust issued', sub: 'Earn yours today' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1rem 0.5rem' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '-1px' }}>
                  <Counter target={s.val} prefix={s.prefix} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: '0.65rem', color: '#38bdf8', marginTop: 3, fontWeight: 600 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5. WHY FREETRUST (3 value props) ── */}
      <div style={{ borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
        <div className="lp-sec">
          <h2 className="section-h2" style={{ fontSize: 'clamp(1.5rem,3.5vw,2.2rem)', fontWeight: 900, textAlign: 'center', margin: '0 0 2rem', letterSpacing: '-0.5px' }}>Why FreeTrust?</h2>
          <div className="val-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
            {VALUE_PROPS.map(v => (
              <div key={v.title} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.5rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8', marginBottom: '0.75rem', lineHeight: 1 }}>{v.icon}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.5rem' }}>{v.title}</div>
                <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 6. FEATURED SERVICES (horizontal scroll on mobile) ── */}
      <div style={{ borderBottom: '1px solid rgba(56,189,248,0.06)', background: 'rgba(56,189,248,0.02)' }}>
        <div className="lp-sec">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="section-h2" style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)', fontWeight: 900, margin: 0 }}>Featured Services</h2>
            <Link href="/services" style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
          </div>
          <div className="hscroll">
            {FEATURED_SERVICES.map(s => (
              <Link key={s.id} href="/services" style={{ textDecoration: 'none', flexShrink: 0, width: 220 }}>
                <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 6px 24px rgba(56,189,248,0.15)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='' }}>
                  <div style={{ height: 88, background: s.grad }} />
                  <div style={{ padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.4rem', lineHeight: 1.25 }}>{s.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <img src={s.avatar} alt={s.provider} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.provider}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#f1f5f9' }}>£{s.price}</span>
                      <span style={{ fontSize: '0.68rem', color: '#fbbf24' }}>★ {s.rating} ({s.reviews})</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── 7. FEATURED PRODUCTS (horizontal scroll on mobile) ── */}
      <div style={{ borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
        <div className="lp-sec">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="section-h2" style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)', fontWeight: 900, margin: 0 }}>Featured Products</h2>
            <Link href="/products" style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
          </div>
          <div className="hscroll">
            {FEATURED_PRODUCTS.map(p => (
              <Link key={p.id} href="/products" style={{ textDecoration: 'none', flexShrink: 0, width: 200 }}>
                <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 6px 24px rgba(56,189,248,0.15)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='' }}>
                  <div style={{ height: 88, background: p.grad, position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 8, right: 8, background: p.type === 'digital' ? 'rgba(56,189,248,0.9)' : 'rgba(148,163,184,0.9)', color: '#0f172a', fontSize: '0.58rem', fontWeight: 800, padding: '2px 6px', borderRadius: 999 }}>
                      {p.type === 'digital' ? 'DIGITAL' : 'PHYSICAL'}
                    </span>
                  </div>
                  <div style={{ padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.35rem', lineHeight: 1.25 }}>{p.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <img src={p.avatar} alt={p.seller} style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.seller}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#f1f5f9' }}>£{p.price}</span>
                      <span style={{ fontSize: '0.65rem', color: '#fbbf24' }}>★ {p.rating}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── 8. FOUNDING MEMBER CTA ── */}
      <div style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(129,140,248,0.06) 100%)', borderBottom: '1px solid rgba(56,189,248,0.1)' }}>
        <div className="lp-sec">
          <div className="found-inner" style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.1em', marginBottom: 6 }}>🏅 FOUNDING MEMBERS</div>
              <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>
                {Math.max(0, goal - tm).toLocaleString()} spots remaining
              </h2>
              <p style={{ color: '#64748b', margin: '0 0 1.25rem', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: 480 }}>
                Founding members get a permanent badge, early feature access, zero fees for 3 months, and priority Trust bonuses. Once all 1,000 spots are gone, they&apos;re gone.
              </p>
              {/* Progress bar */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: 5 }}>
                  <span><Counter target={tm} /> / {goal.toLocaleString()} founding spots taken</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 10, background: 'rgba(56,189,248,0.1)', borderRadius: 999, overflow: 'hidden', border: '1px solid rgba(56,189,248,0.12)' }}>
                  <div className="found-bar" style={{ height: '100%', width: `${Math.max(pct, 2)}%`, borderRadius: 999, transition: 'width 1s' }} />
                </div>
                {tw > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span className="live-dot" />
                    <span>+{tw} joined this week</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.85rem 2rem', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.35)' }}>
                  Claim My Spot Free →
                </Link>
                <Link href="/browse" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: '#94a3b8', padding: '0.85rem 1.5rem', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none', border: '1px solid rgba(148,163,184,0.2)' }}>
                  Browse Members
                </Link>
              </div>
            </div>
            {/* Badge visual */}
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, rgba(56,189,248,0.6) 0%, rgba(30,41,59,0.98) 60%)', border: '3px solid rgba(56,189,248,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(56,189,248,0.25)', margin: '0 auto' }}>
                <span style={{ fontSize: '2.5rem' }}>🏅</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.08em', marginTop: 4 }}>FOUNDER</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 8 }}>Permanent badge</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 9. FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(56,189,248,0.08)', padding: '1.5rem 1.25rem', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>
        <div className="footer-links" style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span>© 2026 FreeTrust</span>
          <Link href="/services"  style={{ color: '#475569', textDecoration: 'none' }}>Services</Link>
          <Link href="/products"  style={{ color: '#475569', textDecoration: 'none' }}>Products</Link>
          <Link href="/events"    style={{ color: '#475569', textDecoration: 'none' }}>Events</Link>
          <Link href="/articles"  style={{ color: '#475569', textDecoration: 'none' }}>Articles</Link>
          <Link href="/impact"    style={{ color: '#475569', textDecoration: 'none' }}>Impact</Link>
          <Link href="/register"  style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>Join free →</Link>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#334155' }}>Trust-based commerce for a better internet.</div>
      </footer>
    </main>
  )
}
