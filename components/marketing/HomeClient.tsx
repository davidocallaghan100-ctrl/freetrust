'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useCurrency } from '@/context/CurrencyContext'
import FAQAccordion from '@/components/marketing/FAQAccordion'
import { FAQS } from '@/lib/faq'
import ROICalculator from './ROICalculator'
import { createClient } from '@/lib/supabase/client'

export interface HomeClientProps {
  initialCounts: {
    members:     number
    listings:    number
    communities: number
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
type TickerItem = { id: string; type: string; text: string; time: string }
type StatsData = {
  members: { total: number; thisWeek: number; thisMonth: number }
  listings: { services: number; products: number }
  events: { upcoming: number }
  articles: { published: number }
  communities: { total: number }
  trust: { total: number; thisWeek: number; inCirculation: number; membersHolding: number }
  ticker: TickerItem[]
  growth: { date: string; count: number; cumulative: number }[]
  foundingGoal: number
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === prevTarget.current) return
    prevTarget.current = target
    if (target === 0) { setCount(0); return }

    // Animate from current displayed value to new target
    const from = count
    const dur = 900
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(from + (target - from) * e))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {/* Orbiting dot — wrapper rotates, dot translates out, then counter-rotates to stay round */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 0, height: 0,
          animation: 'ai-orbit-arm 4s linear infinite',
          transformOrigin: '0 0',
        }}>
          <div style={{
            position: 'absolute',
            width: Math.round(s * 0.07), height: Math.round(s * 0.07),
            marginTop: -Math.round(s * 0.035),
            left: 72,
            marginLeft: -Math.round(s * 0.035),
            borderRadius: '50%',
            background: 'radial-gradient(circle, #7dd3fc 0%, #0ea5e9 100%)',
            boxShadow: '0 0 10px rgba(56,189,248,1), 0 0 20px rgba(56,189,248,0.5)',
            animation: 'ai-orbit-dot 4s linear infinite',
          }} />
        </div>
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
              <div key={i} style={{
                width: 3, height: 4, borderRadius: 99, display: 'inline-block',
                background: 'linear-gradient(to top, #38bdf8, #34d399)',
                animation: `ai-wave 1.2s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Talk to AI button */}
      <Link href="/ai" style={{
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
type FeaturedService = {
  id: string
  title: string
  provider: string
  avatarUrl: string | null
  coverImage?: string | null
  price: number
  currency: string
  rating: number
  reviews: number
  tags: string[]
  grad: string
}

const GRADS = [
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  'linear-gradient(135deg,#fb923c,#ea580c)',
]

type FeaturedProduct = {
  id: string
  title: string
  seller: string
  avatarUrl: string | null
  coverImage?: string | null
  price: number
  currency: string
  rating: number
  reviews: number
  type: string
  grad: string
}

// ── Value props ───────────────────────────────────────────────────────────────
const VALUE_PROPS = [
  { icon: '🙋', title: 'Real people. No bots.', desc: 'Every member is a verified human. We have zero tolerance for fake profiles, automated accounts or bots — your trust score depends on it.' },
  { icon: '₮', title: 'Trust is your currency', desc: 'Every transaction, review, and contribution earns Trust tokens. Higher Trust = lower fees and better visibility across the platform.' },
  { icon: '🌍', title: 'Commerce with purpose', desc: '1% of every transaction funds community impact projects. Buy, sell and connect knowing your activity does more good in the world.' },
]

// ── Preview types for homepage sections ───────────────────────────────────────
type HomeEvent = {
  id: string
  title: string
  starts_at: string | null
  city: string | null
  country: string | null
  category: string | null
  attendee_count: number | null
  is_online: boolean
}

type HomeJob = {
  id: string
  title: string
  company_name: string | null
  city: string | null
  country: string | null
  location_type: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  job_type: string | null
}

const CAT_COLORS_HOME: Record<string, string> = {
  Technology: '#34d399', Startup: '#38bdf8', AI: '#e879f9',
  Business: '#a78bfa', Design: '#f472b6', Marketing: '#fb923c',
  Web3: '#818cf8', 'E-commerce': '#f59e0b', Sustainability: '#4ade80',
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HomeClient({ initialCounts }: HomeClientProps) {
  const { format } = useCurrency()
  const [stats, setStats] = useState<StatsData | null>(null)
  const [featuredServices, setFeaturedServices] = useState<FeaturedService[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([])
  const [homeEvents, setHomeEvents] = useState<HomeEvent[] | null>(null)
  const [homeJobs, setHomeJobs] = useState<HomeJob[] | null>(null)

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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/listings/featured')
        if (res.ok) {
          const data = await res.json() as FeaturedService[]
          setFeaturedServices(data)
        }
      } catch { /* silent */ }
    }
    void load()
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/listings/featured-products')
        if (res.ok) {
          const data = await res.json() as FeaturedProduct[]
          setFeaturedProducts(data)
        }
      } catch { /* silent */ }
    }
    void load()
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const now = new Date().toISOString()
        const { data } = await supabase
          .from('events')
          .select('id, title, starts_at, city, country, category, attendee_count, is_online')
          .eq('status', 'published')
          .gte('starts_at', now)
          .order('starts_at', { ascending: true })
          .limit(6)
        setHomeEvents((data as HomeEvent[]) ?? [])
      } catch { setHomeEvents([]) }
    }
    void load()
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('jobs')
          .select('id, title, company_name, city, country, location_type, salary_min, salary_max, salary_currency, job_type')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(6)
        setHomeJobs((data as HomeJob[]) ?? [])
      } catch { setHomeJobs([]) }
    }
    void load()
  }, [])

  const tm = stats?.members.total ?? 0
  const tw = stats?.members.thisWeek ?? 0
  const tt = stats?.trust.total ?? 0
  const tc = stats?.trust.inCirculation ?? 0
  const th = stats?.trust.membersHolding ?? 0
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
        /* Orbiting dot — arm rotates, dot counter-rotates to stay round */
        @keyframes ai-orbit-arm { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes ai-orbit-dot { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
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
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 0.6rem !important; }
          .trust-econ-grid { grid-template-columns: repeat(3,1fr) !important; }
          .stat-val { font-size: 1.4rem !important; }
          .trust-val { font-size: 1.3rem !important; }
          .val-grid { grid-template-columns: 1fr !important; }
          .found-inner { flex-direction: column !important; text-align: center; }
          .footer-links { justify-content: center !important; }
          .lp-sec { padding: 2.5rem 1rem; }
          .lp { padding: 0 1rem; }
          .section-h2 { font-size: clamp(1.4rem,5vw,2rem) !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 0.5rem !important; }
          .stat-val { font-size: 1.15rem !important; letter-spacing: -0.5px !important; }
          .trust-econ-grid { grid-template-columns: repeat(3,1fr) !important; gap: 0.5rem !important; }
          .trust-val { font-size: 1rem !important; letter-spacing: -0.5px !important; }
          .trust-econ-label { font-size: 0.58rem !important; }
          .trust-econ-sub { font-size: 0.54rem !important; }
          .stat-label { font-size: 0.65rem !important; }
          .stat-sub { font-size: 0.58rem !important; }
          .trust-econ-strip { padding: 0.75rem 0.6rem !important; }
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
                🇮🇪 BUILT IN IRELAND
              </div>

              <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.1, margin: 0, letterSpacing: '-1.5px' }}>
                The marketplace where{' '}
                <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>trust is currency</span>
              </h1>

              <p style={{ fontSize: '1.05rem', color: '#94a3b8', margin: 0, lineHeight: 1.65, maxWidth: 480 }}>
                FreeTrust is Ireland&apos;s community economy platform — earn TrustCoins (₮) for every contribution, spend them to grow.
              </p>

              <div className="hero-cta" style={{ display: 'flex', flexDirection: 'row', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.9rem 2rem', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.35)' }}>
                  Join FreeTrust Free →
                </Link>
                <a href="#how-it-works" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', padding: '0.9rem 1.75rem', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none', border: '1px solid rgba(148,163,184,0.2)', scrollBehavior: 'smooth' }}>
                  See how it works
                </a>
              </div>

              {/* Trust points */}
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#34d399' }}>✓</span> Free to join — ₮200 on signup</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#34d399' }}>✓</span> Real people only — no bots</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#34d399' }}>✓</span> No subscription</span>
              </div>

              {/* Server-rendered live stats strip — matches the summary
                  crawled by AI search engines in the JSON-LD. Re-hydrates
                  with the server-fetched counts on first paint. */}
              <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#94a3b8' }}>
                <span><strong style={{ color: '#38bdf8' }}>{initialCounts.members.toLocaleString()}</strong> members</span>
                <span aria-hidden="true" style={{ color: '#334155' }}>·</span>
                <span><strong style={{ color: '#38bdf8' }}>{initialCounts.listings.toLocaleString()}</strong> listings</span>
                <span aria-hidden="true" style={{ color: '#334155' }}>·</span>
                <span><strong style={{ color: '#38bdf8' }}>{initialCounts.communities.toLocaleString()}</strong> communities</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. STATS BAR ── */}
      <div style={{ background: 'rgba(56,189,248,0.03)', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div className="lp" style={{ padding: '1.75rem 1.25rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '1rem', fontSize: '0.72rem', color: '#475569' }}>
            <span className="live-dot" /> Live stats — refreshes every 60s
          </div>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.85rem', textAlign: 'center' }}>
            {[
              { val: tm, prefix: '', suffix: '', label: 'Members & growing', sub: tw > 0 ? `+${tw} this week` : 'Join free', color: '#38bdf8' },
              { val: sl, prefix: '', suffix: '', label: 'Services available', sub: sl === 0 ? 'Be the first!' : 'Browse now', color: '#38bdf8' },
              { val: pl, prefix: '', suffix: '', label: 'Products listed', sub: pl === 0 ? 'List yours' : 'Shop now', color: '#38bdf8' },
              { val: tt, prefix: '₮', suffix: '', label: 'Total ₮ issued', sub: 'Since launch', color: '#38bdf8' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1rem 0.5rem' }}>
                <div className="stat-val" style={{ fontSize: '1.8rem', fontWeight: 900, color: s.color, letterSpacing: '-1px' }}>
                  <Counter target={s.val} prefix={s.prefix} suffix={s.suffix} />
                </div>
                <div className="stat-label" style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2, fontWeight: 500 }}>{s.label}</div>
                <div className="stat-sub" style={{ fontSize: '0.65rem', color: s.color, marginTop: 3, fontWeight: 600 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Trust Economy strip */}
          <div className="trust-econ-strip" style={{ marginTop: '0.85rem', background: 'linear-gradient(135deg,rgba(45,212,191,0.07),rgba(56,189,248,0.04))', border: '1px solid rgba(45,212,191,0.15)', borderRadius: 12, padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#2dd4bf', letterSpacing: '0.1em', textTransform: 'uppercase' }}>₮ Trust Economy</span>
              <span className="live-dot" style={{ width: 5, height: 5 } as React.CSSProperties} />
            </div>
            <div className="trust-econ-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', textAlign: 'center' }}>
              {[
                { val: tc, prefix: '₮', label: '₮ in circulation', sub: 'Current balances held', color: '#2dd4bf' },
                { val: tt, prefix: '₮', label: '₮ issued since launch', sub: 'Total ever earned', color: '#34d399' },
                { val: th, prefix: '', label: 'Members holding ₮', sub: 'Active trust holders', color: '#38bdf8' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: '0.75rem 0.5rem', border: '1px solid rgba(45,212,191,0.1)' }}>
                  <div className="trust-val" style={{ fontSize: '1.6rem', fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>
                    <Counter target={s.val} prefix={s.prefix} />
                  </div>
                  <div className="trust-econ-label" style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, fontWeight: 500 }}>{s.label}</div>
                  <div className="trust-econ-sub" style={{ fontSize: '0.62rem', color: s.color, marginTop: 2, fontWeight: 600, opacity: 0.8 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4b. LIVE TICKER ── */}
      {stats?.ticker && stats.ticker.length > 0 && (
        <div style={{ background: 'rgba(56,189,248,0.04)', borderBottom: '1px solid rgba(56,189,248,0.06)', overflow: 'hidden', position: 'relative' }}>
          <style>{`
            @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
            .ticker-track { display: flex; animation: ticker-scroll 40s linear infinite; white-space: nowrap; width: max-content; }
            .ticker-track:hover { animation-play-state: paused; }
          `}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0.55rem 0' }}>
            {/* Live label */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0 1rem', borderRight: '1px solid rgba(56,189,248,0.12)', background: 'rgba(56,189,248,0.06)', height: '100%', zIndex: 1 }}>
              <span className="live-dot" />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live</span>
            </div>
            {/* Scrolling track — doubled for seamless loop */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div className="ticker-track">
                {[...stats.ticker, ...stats.ticker].map((item, i) => {
                  const icon = item.type === 'join' ? '👋' : item.type === 'trust' ? '₮' : item.type === 'article' ? '📝' : '✨'
                  return (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0 1.25rem', fontSize: '0.75rem', color: '#94a3b8', borderRight: '1px solid rgba(56,189,248,0.06)', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.8rem' }}>{icon}</span>
                      {item.text}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ borderBottom: '1px solid rgba(56,189,248,0.06)', scrollMarginTop: 80 }}>
        <div className="lp-sec">
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <div style={{ display: 'inline-block', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '0.3rem 0.9rem', fontSize: '0.72rem', color: '#34d399', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.85rem' }}>✦ HOW IT WORKS</div>
            <h2 className="section-h2" style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>Four steps to join the community economy</h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: 560, margin: '0 auto' }}>No subscriptions, no gatekeepers. Just sign up, contribute and grow.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem' }}>
            {[
              { n: 1, icon: '🪪', title: 'Sign up free and build your profile', desc: 'Create your account in under a minute and get ₮200 TrustCoins on signup. No card, no subscription.' },
              { n: 2, icon: '📦', title: 'List your services, products or jobs', desc: 'Publish a service gig, physical or digital product, or a local job and start reaching the community.' },
              { n: 3, icon: '🤝', title: 'Connect, collaborate and earn TrustCoins', desc: 'Every listing, sale, article and review earns you ₮ — the native reputation currency.' },
              { n: 4, icon: '🌱', title: 'Spend ₮ to boost visibility and support impact', desc: 'Boost listings, unlock perks, and donate to the Sustainability Fund to back real-world projects.' },
            ].map(step => (
              <div key={step.n} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.5rem 1.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900, color: '#38bdf8' }}>{step.n}</div>
                  <div style={{ fontSize: '1.35rem' }}>{step.icon}</div>
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.4rem', lineHeight: 1.3 }}>{step.title}</div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID (8) ── */}
      <section style={{ borderBottom: '1px solid rgba(56,189,248,0.06)', background: 'rgba(56,189,248,0.02)' }}>
        <div className="lp-sec">
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.3rem 0.9rem', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.85rem' }}>✦ EVERYTHING ON ONE PLATFORM</div>
            <h2 className="section-h2" style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>One membership, eight ways to grow</h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: 560, margin: '0 auto' }}>Everything you need to participate in the community economy — from marketplace to social feed.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.85rem' }}>
            {[
              { icon: '🛒', title: 'Marketplace',       desc: 'Buy and sell products and services' },
              { icon: '💼', title: 'Jobs Board',        desc: 'Post and find local opportunities' },
              { icon: '📅', title: 'Events',            desc: 'Create and discover community events' },
              { icon: '🏘️', title: 'Communities',       desc: 'Build and join groups around shared interests' },
              { icon: '📰', title: 'Social Feed',       desc: 'Share updates and connect with members' },
              { icon: '₮',  title: 'Trust Economy',     desc: 'Earn coins for every contribution' },
              { icon: '🌱', title: 'Sustainability Fund', desc: 'Donate ₮ to community impact projects' },
              { icon: '🏢', title: 'Organisations',     desc: 'List and discover local organisations' },
            ].map(f => (
              <div key={f.title} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.1rem 1rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{f.icon}</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.3rem' }}>{f.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ECONOMY EXPLAINER ── */}
      <section style={{ borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
        <div className="lp-sec">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '1.5rem', alignItems: 'start' }}>
            <div>
              <div style={{ display: 'inline-block', background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 999, padding: '0.3rem 0.9rem', fontSize: '0.72rem', color: '#2dd4bf', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.85rem' }}>₮ TRUST ECONOMY</div>
              <h2 className="section-h2" style={{ fontSize: 'clamp(1.5rem,3.5vw,2.1rem)', fontWeight: 900, margin: '0 0 0.75rem', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                What are <span style={{ color: '#2dd4bf' }}>TrustCoins</span> (₮)?
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 1rem' }}>
                TrustCoins (₮) are the native reputation currency of FreeTrust. Every contribution to the community earns you ₮. The more you contribute, the more visibility you unlock.
              </p>
              <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.65, margin: 0 }}>
                ₮ is not a cryptocurrency. It can&apos;t be withdrawn or traded externally — it&apos;s a reputation metric that powers the entire platform.
              </p>
            </div>
            <div style={{ background: '#1e293b', border: '1px solid rgba(45,212,191,0.18)', borderRadius: 14, padding: '1.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#34d399', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.85rem' }}>How to earn ₮</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.6rem' }}>
                {[
                  { label: 'Sign up',                  reward: 200 },
                  { label: 'Create a listing',         reward: 50  },
                  { label: 'Publish an article',       reward: 75  },
                  { label: 'Complete an order',        reward: 100 },
                  { label: 'Create a community',       reward: 100 },
                  { label: 'Leave a review',           reward: 10  },
                ].map(r => (
                  <li key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingBottom: '0.55rem', borderBottom: '1px dashed rgba(45,212,191,0.15)' }}>
                    <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{r.label}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#2dd4bf' }}>₮{r.reward}</span>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '1.1rem', padding: '0.85rem 1rem', background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.15)', borderRadius: 10 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2dd4bf', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Spend ₮ on</div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.7 }}>
                  Boost your listings · Donate to the Sustainability Fund · Unlock profile badges · Feature your profile for 3 days
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO IS FREETRUST FOR? (4 personas) ── */}
      <section style={{ borderBottom: '1px solid rgba(56,189,248,0.06)', background: 'rgba(56,189,248,0.02)' }}>
        <div className="lp-sec">
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <div style={{ display: 'inline-block', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 999, padding: '0.3rem 0.9rem', fontSize: '0.72rem', color: '#818cf8', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.85rem' }}>✦ WHO IS FREETRUST FOR?</div>
            <h2 className="section-h2" style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>Built for everyone in the community economy</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '1rem' }}>
            {[
              { icon: '🧑‍💻', title: 'Freelancers & Service Providers', desc: 'Publish your gigs, get discovered by local buyers and build a reputation that actually pays.',           benefit: 'Higher trust = lower fees' },
              { icon: '🏪',   title: 'Small Businesses & Makers',       desc: 'Sell physical or digital products with built-in Stripe payouts and no monthly listing fees.',        benefit: 'Zero subscription ever' },
              { icon: '🎪',   title: 'Community Organisers & Event Hosts', desc: 'Run events, grow communities and connect people around shared interests and causes.',              benefit: 'Earn ₮ for every event' },
              { icon: '🌍',   title: 'Nonprofits & Social Enterprises',  desc: 'List your organisation, share your mission and receive direct community support via the Sustainability Fund.', benefit: 'Free organisation page' },
            ].map(p => (
              <div key={p.title} style={{ background: '#1e293b', border: '1px solid rgba(129,140,248,0.15)', borderRadius: 14, padding: '1.4rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.65rem' }}>{p.icon}</div>
                <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.5rem', lineHeight: 1.3 }}>{p.title}</div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 0.85rem' }}>{p.desc}</p>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a5b4fc', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(129,140,248,0.1)', borderRadius: 6, padding: '0.3rem 0.55rem' }}>
                  <span>✓</span> {p.benefit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
            {featuredServices.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ flexShrink: 0, width: 240, height: 268, background: '#1e293b', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(56,189,248,0.1)', animation: 'shimmer 1.4s infinite', backgroundImage: 'linear-gradient(90deg,#1e293b 25%,#273548 50%,#1e293b 75%)', backgroundSize: '200% 100%' }} />
                ))
              : featuredServices.map(s => (
                  <Link key={s.id} href={`/services/${s.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: 240 }}>
                    <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s', display: 'flex', flexDirection: 'column', height: 268 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 6px 24px rgba(56,189,248,0.15)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='' }}>
                      {/* Banner — fixed 148px, object-cover so all images fill uniformly */}
                      <div style={{ height: 148, flexShrink: 0, background: s.grad, overflow: 'hidden', position: 'relative' }}>
                        {s.coverImage && (
                          <img
                            src={s.coverImage}
                            alt=""
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                      </div>
                      {/* Body — flex-col, price pinned to bottom */}
                      <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '0.3rem' } as React.CSSProperties}>{s.title}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.provider}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#f1f5f9' }}>{format(s.price, s.currency as 'GBP' | 'EUR' | 'USD')}</span>
                          {s.reviews > 0 && <span style={{ fontSize: '0.68rem', color: '#fbbf24' }}>★ {s.rating.toFixed(1)} ({s.reviews})</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
            }
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
            {featuredProducts.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ flexShrink: 0, width: 220, height: 210, background: '#1e293b', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(56,189,248,0.1)', animation: 'shimmer 1.4s infinite', backgroundImage: 'linear-gradient(90deg,#1e293b 25%,#273548 50%,#1e293b 75%)', backgroundSize: '200% 100%' }} />
                ))
              : featuredProducts.map(p => (
                <Link key={p.id} href={`/products/${p.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: 220 }}>
                  <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 6px 24px rgba(56,189,248,0.15)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='' }}>
                    <div style={{ height: 140, background: p.grad, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {/* Fallback: avatar circle or initials, always rendered under the cover */}
                      {p.avatarUrl
                        ? <img src={p.avatarUrl} alt={p.seller} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', color: '#fff', flexShrink: 0 }}>
                            {p.seller.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()}
                          </div>
                      }
                      {/* Cover image: absolutely fills the banner; hidden via onError if URL is broken */}
                      {p.coverImage && (
                        <img src={p.coverImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      )}
                      <span style={{ position: 'absolute', top: 8, right: 8, background: p.type === 'digital' ? 'rgba(56,189,248,0.9)' : 'rgba(148,163,184,0.9)', color: '#0f172a', fontSize: '0.58rem', fontWeight: 800, padding: '2px 6px', borderRadius: 999 }}>
                        {p.type === 'digital' ? 'DIGITAL' : 'PHYSICAL'}
                      </span>
                    </div>
                    <div style={{ padding: '0.85rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.35rem', lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{p.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.seller}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#f1f5f9' }}>{format(p.price, p.currency as 'GBP' | 'EUR' | 'USD')}</span>
                        {p.reviews > 0 && <span style={{ fontSize: '0.65rem', color: '#fbbf24' }}>★ {p.rating.toFixed(1)}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── UPCOMING EVENTS ── */}
      <div style={{ borderBottom: '1px solid rgba(56,189,248,0.06)', background: 'rgba(56,189,248,0.02)' }}>
        <div className="lp-sec">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 className="section-h2" style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)', fontWeight: 900, margin: '0 0 0.2rem' }}>📅 Upcoming Events</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Global startup & tech events — discover, attend, connect</p>
            </div>
            <Link href="/events" style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>View all events →</Link>
          </div>
          {homeEvents === null ? (
            // Skeleton
            <div className="hscroll">
              {[0,1,2].map(i => (
                <div key={i} style={{ flexShrink: 0, width: 280, height: 120, background: '#1e293b', borderRadius: 14, border: '1px solid rgba(56,189,248,0.08)', animation: 'shimmer 1.4s infinite', backgroundImage: 'linear-gradient(90deg,#1e293b 25%,#273548 50%,#1e293b 75%)', backgroundSize: '200% 100%' }} />
              ))}
            </div>
          ) : homeEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.88rem' }}>No upcoming events yet — <Link href="/events/create" style={{ color: '#38bdf8' }}>create one</Link>.</div>
          ) : (
            <div className="hscroll">
              {homeEvents.map(ev => {
                const cat = ev.category ?? 'Technology'
                const catColor = CAT_COLORS_HOME[cat] ?? '#38bdf8'
                const dateStr = ev.starts_at
                  ? new Date(ev.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Date TBC'
                const location = ev.is_online ? 'Online' : [ev.city, ev.country].filter(Boolean).join(', ') || 'In Person'
                return (
                  <Link key={ev.id} href={`/events/${ev.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: 280 }}>
                    <div
                      style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer', height: '100%' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 6px 24px rgba(56,189,248,0.12)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3, flex: 1 }}>{ev.title}</div>
                        <span style={{ flexShrink: 0, background: `${catColor}18`, border: `1px solid ${catColor}40`, color: catColor, fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999 }}>{cat}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.76rem', color: '#64748b' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>🗓 {dateStr}</span>
                        <span>📍 {location}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#475569' }}>👥 {(ev.attendee_count ?? 0).toLocaleString()} attending</span>
                        {ev.is_online && <span style={{ fontSize: '0.62rem', fontWeight: 800, background: 'rgba(56,189,248,0.12)', color: '#38bdf8', padding: '2px 7px', borderRadius: 999 }}>ONLINE</span>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── LATEST JOBS ── */}
      <div style={{ borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
        <div className="lp-sec">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 className="section-h2" style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)', fontWeight: 900, margin: '0 0 0.2rem' }}>💼 Latest Jobs</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Real roles at leading startups and tech companies</p>
            </div>
            <Link href="/jobs" style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>Browse all jobs →</Link>
          </div>
          {homeJobs === null ? (
            <div className="hscroll">
              {[0,1,2].map(i => (
                <div key={i} style={{ flexShrink: 0, width: 280, height: 90, background: '#1e293b', borderRadius: 12, border: '1px solid rgba(56,189,248,0.08)', animation: 'shimmer 1.4s infinite', backgroundImage: 'linear-gradient(90deg,#1e293b 25%,#273548 50%,#1e293b 75%)', backgroundSize: '200% 100%' }} />
              ))}
            </div>
          ) : homeJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.88rem' }}>No jobs posted yet — <Link href="/jobs/new" style={{ color: '#38bdf8' }}>post one</Link>.</div>
          ) : (
            <div className="hscroll">
              {homeJobs.map(job => {
                const isRemote = job.location_type === 'remote'
                const location = isRemote ? 'Remote' : [job.city, job.country].filter(Boolean).join(', ') || 'On-site'
                const salaryStr = job.salary_min && job.salary_max && job.salary_currency
                  ? `${job.salary_currency} ${(job.salary_min / 1000).toFixed(0)}k–${(job.salary_max / 1000).toFixed(0)}k`
                  : null
                const jobTypeLabel = job.job_type === 'full_time' ? 'Full-time' : job.job_type === 'part_time' ? 'Part-time' : job.job_type === 'contract' ? 'Contract' : 'Freelance'
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: 280 }}>
                    <div
                      style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer', height: '100%' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 6px 24px rgba(56,189,248,0.12)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='' }}
                    >
                      {/* Top row: avatar + title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,rgba(56,189,248,0.2),rgba(129,140,248,0.2))', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900, color: '#38bdf8', flexShrink: 0 }}>
                          {(job.company_name ?? 'J')[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company_name ?? 'Company'}</div>
                        </div>
                      </div>
                      {/* Location + salary */}
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        📍 {location}{salaryStr ? ` · ${salaryStr}` : ''}
                      </div>
                      {/* Badges */}
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, background: isRemote ? 'rgba(56,189,248,0.12)' : 'rgba(148,163,184,0.12)', color: isRemote ? '#38bdf8' : '#94a3b8', border: `1px solid ${isRemote ? 'rgba(56,189,248,0.3)' : 'rgba(148,163,184,0.2)'}`, padding: '2px 6px', borderRadius: 999 }}>
                          {isRemote ? '🌐 Remote' : '🏢 On-site'}
                        </span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', padding: '2px 6px', borderRadius: 999 }}>
                          {jobTypeLabel}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
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

      {/* ── ROI CALCULATOR ── */}
      <section style={{ borderBottom: '1px solid rgba(16,185,129,0.08)', background: 'linear-gradient(180deg, rgba(16,185,129,0.03) 0%, transparent 100%)' }}>
        <div className="lp-sec" style={{ maxWidth: 820 }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-block', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 999, padding: '0.3rem 0.9rem', fontSize: '0.72rem', color: '#34d399', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.85rem' }}>✦ YOUR EARNINGS</div>
            <h2 className="section-h2" style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>
              See What You&apos;d Earn on FreeTrust
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: 480, margin: '0 auto' }}>
              TrustCoins compound — the more you participate, the less you pay in fees.
            </p>
          </div>
          <ROICalculator />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
        <div className="lp-sec" style={{ maxWidth: 820 }}>
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.3rem 0.9rem', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.85rem' }}>✦ FREQUENTLY ASKED</div>
            <h2 className="section-h2" style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>Questions, answered</h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: 500, margin: '0 auto' }}>Everything you need to know about FreeTrust before you join.</p>
          </div>
          <FAQAccordion items={FAQS} />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ borderBottom: '1px solid rgba(56,189,248,0.08)', background: 'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(52,211,153,0.06) 100%)' }}>
        <div className="lp-sec" style={{ textAlign: 'center', maxWidth: 720 }}>
          <h2 className="section-h2" style={{ fontSize: 'clamp(1.7rem,4.5vw,2.6rem)', fontWeight: 900, margin: '0 0 0.85rem', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            Ready to join the <span style={{ background: 'linear-gradient(135deg,#38bdf8,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>community economy</span>?
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1rem', margin: '0 0 1.5rem', lineHeight: 1.65 }}>
            Free to join. ₮200 on signup. No subscription, no credit card.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.95rem 2.25rem', borderRadius: 10, fontWeight: 800, fontSize: '1rem', textDecoration: 'none', boxShadow: '0 4px 24px rgba(56,189,248,0.4)' }}>
              Join FreeTrust Free →
            </Link>
          </div>
          <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            Built in Ireland 🇮🇪
          </div>
        </div>
      </section>

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
