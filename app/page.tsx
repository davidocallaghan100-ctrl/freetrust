'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
type TickerItem = { id: string; type: string; text: string; time: string }
type GrowthPoint = { date: string; count: number; cumulative: number }
type StatsData = {
  members: { total: number; thisWeek: number; thisMonth: number }
  listings: { services: number; products: number }
  events: { upcoming: number }
  articles: { published: number }
  communities: { total: number }
  trust: { total: number; thisWeek: number }
  ticker: TickerItem[]
  growth: GrowthPoint[]
  foundingGoal: number
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, prefix = '', suffix = '', decimals = 0 }: {
  target: number; prefix?: string; suffix?: string; decimals?: number
}) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const prevTarget = useRef(0)

  useEffect(() => {
    const from = prevTarget.current
    prevTarget.current = target
    if (target === 0) { setCount(0); return }
    let start = from
    const duration = 900
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      start = from + (target - from) * eased
      setCount(start)
      if (progress < 1) requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      requestAnimationFrame(tick)
    }, { threshold: 0.2 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  const display = decimals > 0 ? count.toFixed(decimals) : Math.round(count).toLocaleString()
  return <span ref={ref}>{prefix}{display}{suffix}</span>
}

// ── Sparkline chart ───────────────────────────────────────────────────────────
function Sparkline({ data, color = '#38bdf8', height = 48 }: {
  data: number[]; color?: string; height?: number
}) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 200
  const h = height
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`${color}18`} stroke="none" />
    </svg>
  )
}

// ── Live ticker ───────────────────────────────────────────────────────────────
const FALLBACK_TICKS = [
  { id: 'f1', type: 'join', text: 'Someone just joined FreeTrust — be the first in your city!', time: new Date().toISOString() },
  { id: 'f2', type: 'trust', text: '₮25 Trust issued — new member signup bonus', time: new Date().toISOString() },
  { id: 'f3', type: 'article', text: 'New article published: "The Trust Economy: Why Reputation Will Replace Resumes by 2030"', time: new Date().toISOString() },
]

function LiveTicker({ items }: { items: TickerItem[] }) {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)
  const ticks = items.length > 0 ? items : FALLBACK_TICKS

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % ticks.length)
        setFade(true)
      }, 300)
    }, 4000)
    return () => clearInterval(t)
  }, [ticks.length])

  const item = ticks[idx]
  const icons: Record<string, string> = { join: '👋', trust: '₮', article: '✍️', service: '🛠️' }

  return (
    <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden', maxWidth: 560, margin: '0 auto' }}>
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icons[item.type] ?? '🔔'}</span>
      <span style={{ fontSize: '0.82rem', color: '#94a3b8', transition: 'opacity 0.3s', opacity: fade ? 1 : 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.text}
      </span>
      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '0.7rem', color: '#475569', background: 'rgba(56,189,248,0.08)', borderRadius: 999, padding: '1px 6px' }}>LIVE</span>
    </div>
  )
}

// ── Static data ───────────────────────────────────────────────────────────────
const TRUST_LEVELS = [
  { level: 'Starter',   min: 0,    max: 99,   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  perks: ['Access to marketplace', 'Post on feed', 'Join communities'] },
  { level: 'Trusted',   min: 100,  max: 499,  color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',   perks: ['Reduced platform fee (3%)', 'Verified badge', 'Priority search placement'] },
  { level: 'Pro',       min: 500,  max: 999,  color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  perks: ['1.5% platform fee', 'Featured listings', 'Early access to features'] },
  { level: 'Elite',     min: 1000, max: 4999, color: '#34d399', bg: 'rgba(52,211,153,0.1)',   perks: ['Zero platform fee', 'Top-tier search boost', 'Dedicated support'] },
  { level: 'Legendary', min: 5000, max: null, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   perks: ['Revenue share on referrals', 'Governance voting rights', 'Impact Fund allocation'] },
]

const FEE_COMPARISON = [
  { platform: 'Fiverr',      fee: '20%',    icon: '💸', color: '#ef4444' },
  { platform: 'Upwork',      fee: '10–20%', icon: '💸', color: '#ef4444' },
  { platform: 'Etsy',        fee: '6.5%',   icon: '🟡', color: '#f59e0b' },
  { platform: 'FreeTrust ★', fee: '0–5%',   icon: '✅', color: '#34d399', highlight: true },
]

const HOW_IT_WORKS = [
  { step: '01', icon: '🔑', title: 'Join free', desc: 'Create your account in 60 seconds. No credit card. Get ₮25 Trust on signup.' },
  { step: '02', icon: '🛍️', title: 'Transact', desc: 'Buy or sell services, products, and jobs. Every verified transaction earns Trust.' },
  { step: '03', icon: '⬆️', title: 'Level up', desc: 'As your Trust score grows, your fees drop — reaching zero at Elite level.' },
  { step: '04', icon: '💰', title: 'Earn more', desc: 'Elite members earn referral revenue and gain governance influence.' },
]

const EARN_WAYS = [
  { icon: '🛠️', action: 'Complete a service order',     earn: '+₮50–200' },
  { icon: '⭐', action: 'Receive a 5-star review',       earn: '+₮10'     },
  { icon: '🤝', action: 'Refer a new member',            earn: '+₮25'     },
  { icon: '✍️', action: 'Publish a community article',  earn: '+₮20'     },
  { icon: '📅', action: 'Host a community event',        earn: '+₮30'     },
  { icon: '🏆', action: 'Hit a Trust milestone',         earn: '+₮50–500' },
]

const TESTIMONIALS = [
  { name: 'Priya N.', role: 'Full-Stack Developer', quote: 'I cleared £8,400 in my first 3 months. With zero platform fee at Elite level, I keep almost everything I earn.', trust: 1240, avatarImg: 'https://i.pravatar.cc/150?img=44', grad: 'linear-gradient(135deg,#a78bfa,#7c3aed)', initials: 'PN' },
  { name: 'Marcus O.', role: 'SEO Consultant', quote: 'Fiverr was taking 20% off every order. FreeTrust dropped that to 3% in my first month — real money back in my pocket.', trust: 420, avatarImg: 'https://i.pravatar.cc/150?img=12', grad: 'linear-gradient(135deg,#34d399,#059669)', initials: 'MO' },
  { name: 'Amara D.', role: 'Business Coach', quote: 'The Trust economy is real. My Trust score opened doors that cold outreach never could. Clients come to me now.', trust: 890, avatarImg: 'https://i.pravatar.cc/150?img=45', grad: 'linear-gradient(135deg,#38bdf8,#0284c7)', initials: 'AD' },
]

const EMPTY_STATES: Record<string, { icon: string; msg: string; cta: string; href: string }> = {
  services: { icon: '🛠️', msg: 'Be the first to list a service in your area', cta: 'List a service', href: '/seller/gigs/create' },
  products: { icon: '📦', msg: 'No products yet — start selling to the community', cta: 'Add a product', href: '/seller/gigs/create' },
  events:   { icon: '📅', msg: 'No upcoming events — why not create one?', cta: 'Create event', href: '/events/create' },
  articles: { icon: '✍️', msg: 'No articles yet — share your expertise', cta: 'Write an article', href: '/articles/new' },
  communities: { icon: '🏘️', msg: 'Start the conversation — create a community', cta: 'Create community', href: '/community/new' },
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [activeTrustLevel, setActiveTrustLevel] = useState(1)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json() as StatsData
        setStats(data)
      }
    } catch { /* keep previous data */ }
    finally { setStatsLoading(false) }
  }, [])

  useEffect(() => {
    void fetchStats()
    const interval = setInterval(fetchStats, 60_000) // refresh every 60s
    return () => clearInterval(interval)
  }, [fetchStats])

  // Derived values
  const totalMembers = stats?.members.total ?? 0
  const membersThisWeek = stats?.members.thisWeek ?? 0
  const membersThisMonth = stats?.members.thisMonth ?? 0
  const servicesListed = stats?.listings.services ?? 0
  const productsListed = stats?.listings.products ?? 0
  const articlesPublished = stats?.articles.published ?? 0
  const communitiesCount = stats?.communities.total ?? 0
  const trustTotal = stats?.trust.total ?? 0
  const trustThisWeek = stats?.trust.thisWeek ?? 0
  const upcomingEvents = stats?.events.upcoming ?? 0
  const foundingGoal = stats?.foundingGoal ?? 1000
  const foundingPct = Math.min((totalMembers / foundingGoal) * 100, 100)

  // Growth sparkline data (cumulative member count)
  const growthData = (stats?.growth ?? []).map(g => g.cumulative)

  // Stats bar items — always show real values
  const STAT_ITEMS = [
    {
      value: totalMembers, prefix: '', suffix: '', label: 'Members & growing',
      empty: 'members', sub: membersThisWeek > 0 ? `+${membersThisWeek} this week` : 'Join as a founding member'
    },
    {
      value: servicesListed, prefix: '', suffix: '', label: 'Services listed',
      empty: 'services', sub: servicesListed === 0 ? 'Be the first!' : 'Browse the marketplace'
    },
    {
      value: productsListed, prefix: '', suffix: '', label: 'Products listed',
      empty: 'products', sub: productsListed === 0 ? 'Be the first!' : 'Shop the marketplace'
    },
    {
      value: trustTotal, prefix: '₮', suffix: '', label: 'Trust issued',
      empty: 'trust', sub: trustThisWeek > 0 ? `₮${trustThisWeek} issued this week` : 'Start earning Trust'
    },
  ]

  return (
    <main style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        .lp-section { max-width: 1100px; margin: 0 auto; padding: 4rem 1.25rem; }
        .lp-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; }
        .lp-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; }
        .lp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: center; }
        @media (max-width: 768px) {
          .lp-section { padding: 2.5rem 1rem; }
          .lp-grid-3 { grid-template-columns: 1fr; }
          .lp-grid-4 { grid-template-columns: repeat(2,1fr); }
          .lp-grid-2 { grid-template-columns: 1fr; }
          .hero-h1 { font-size: clamp(2rem,7vw,3.2rem) !important; }
          .hero-cta-row { flex-direction: column; align-items: stretch !important; }
          .hero-cta-row a { text-align: center; }
          .stats-row { grid-template-columns: repeat(2,1fr) !important; gap: 0.75rem !important; }
          .trust-tabs { overflow-x: auto; scrollbar-width: none; }
          .trust-tabs::-webkit-scrollbar { display: none; }
          .founding-inner { flex-direction: column !important; text-align: center; }
          .growth-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .lp-grid-4 { grid-template-columns: 1fr; }
        }
        .card-hover { transition: border-color 0.15s, transform 0.15s; }
        .card-hover:hover { border-color: rgba(56,189,248,0.4) !important; transform: translateY(-2px); }
        .trust-tab { cursor: pointer; padding: 0.5rem 1rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; white-space: nowrap; transition: all 0.15s; border: 1px solid transparent; }
        @keyframes pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.4); } }
        @keyframes founding-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes ticker-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; display: inline-block; animation: pulse-dot 1.8s ease-in-out infinite; flex-shrink: 0; }
        .founding-bar-fill { background: linear-gradient(90deg, #38bdf8, #818cf8, #38bdf8); background-size: 200% auto; animation: founding-shimmer 2.5s linear infinite; }
        .stat-pulse { animation: ticker-blink 2s ease-in-out 1; }
      `}</style>

      {/* ── HERO ── */}
      <div style={{ background: 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(56,189,248,0.14) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 80% 50%, rgba(129,140,248,0.08) 0%, transparent 60%)', padding: '4.5rem 1.25rem 3rem', textAlign: 'center', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.78rem', color: '#38bdf8', marginBottom: '1.25rem', letterSpacing: '0.06em', fontWeight: 700 }}>
          ✦ THE TRUST ECONOMY — EARN AS YOU BUILD
        </div>
        <h1 className="hero-h1" style={{ fontSize: 'clamp(2.4rem, 6vw, 4.6rem)', fontWeight: 900, lineHeight: 1.08, margin: '0 0 1.25rem', letterSpacing: '-2px' }}>
          The platform where<br />
          <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>trust pays dividends</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#94a3b8', marginBottom: '1rem', maxWidth: '600px', margin: '0 auto 1rem', lineHeight: 1.6 }}>
          FreeTrust is a social commerce platform where your reputation is your currency. The more you transact, the more you earn — and the less you pay in fees.
        </p>

        {/* Live ticker below tagline */}
        <div style={{ marginBottom: '1.5rem', marginTop: '1.25rem' }}>
          {!statsLoading && <LiveTicker items={stats?.ticker ?? []} />}
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem', fontSize: '0.82rem', color: '#64748b' }}>
          <span>✅ Free to join — ₮25 on signup</span>
          <span>✅ Fees from 0% at Elite level</span>
          <span>✅ No monthly subscription</span>
        </div>

        <div className="hero-cta-row" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
          <Link href="/register" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.9rem 2.2rem', borderRadius: 10, fontWeight: 800, fontSize: '1rem', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.35)' }}>
            Claim Founding Member Spot →
          </Link>
          <Link href="/services" style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', padding: '0.9rem 2rem', borderRadius: 10, fontWeight: 600, fontSize: '1rem', textDecoration: 'none', border: '1px solid rgba(148,163,184,0.2)' }}>
            Browse Marketplace
          </Link>
        </div>

        {/* Social proof row with real member count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
          <div style={{ display: 'flex' }}>
            {['SC','PN','MO','AD','TW'].map((initials, idx) => (
              <div key={initials} style={{ width: 30, height: 30, borderRadius: '50%', background: ['linear-gradient(135deg,#38bdf8,#0284c7)','linear-gradient(135deg,#a78bfa,#7c3aed)','linear-gradient(135deg,#34d399,#059669)','linear-gradient(135deg,#fb923c,#ea580c)','linear-gradient(135deg,#f472b6,#db2777)'][idx], border: '2px solid #0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', marginLeft: idx > 0 ? '-8px' : 0 }}>{initials}</div>
            ))}
          </div>
          <span>
            {statsLoading
              ? 'Growing daily…'
              : totalMembers > 0
                ? <>Joined by <strong style={{ color: '#f1f5f9' }}>{totalMembers.toLocaleString()}</strong> member{totalMembers !== 1 ? 's' : ''} earning Trust daily</>
                : 'Be the first founding member — join now'}
          </span>
        </div>
      </div>

      {/* ── FOUNDING MEMBER COUNTER ── */}
      <div style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.07) 0%, rgba(129,140,248,0.07) 100%)', borderBottom: '1px solid rgba(56,189,248,0.12)', padding: '1.75rem 1.25rem' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div className="founding-inner" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.1em', marginBottom: '2px' }}>🏅 FOUNDING MEMBERS</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1 }}>
                <Counter target={totalMembers} />
                <span style={{ color: '#475569', fontWeight: 400, fontSize: '1.2rem' }}> / {foundingGoal.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>spots taken — <span style={{ color: '#f59e0b', fontWeight: 700 }}>{Math.max(0, foundingGoal - totalMembers).toLocaleString()} remaining</span></div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: '4px' }}>
                <span>Progress to 1,000 Founding Members</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>{foundingPct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 10, background: 'rgba(56,189,248,0.1)', borderRadius: 999, overflow: 'hidden', border: '1px solid rgba(56,189,248,0.15)' }}>
                <div className="founding-bar-fill" style={{ height: '100%', width: `${Math.max(foundingPct, 2)}%`, borderRadius: 999, transition: 'width 1s ease' }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '5px' }}>
                🏅 Founding members get a permanent badge, early feature access & priority trust bonuses
              </div>
            </div>
          </div>
          {membersThisWeek > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span className="live-dot" />
              <span><strong style={{ color: '#34d399' }}>+{membersThisWeek}</strong> members joined this week · <strong style={{ color: '#38bdf8' }}>+{membersThisMonth}</strong> this month</span>
            </div>
          )}
        </div>
      </div>

      {/* ── LIVE STATS BAR ── */}
      <div style={{ background: 'rgba(56,189,248,0.03)', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.75rem', color: '#475569' }}>
            <span className="live-dot" />
            <span>Live stats — updated every 60 seconds</span>
          </div>
          <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', textAlign: 'center' }}>
            {STAT_ITEMS.map(s => (
              <div key={s.label} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem 0.75rem' }}>
                {s.value === 0 && !statsLoading ? (
                  <>
                    <div style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>{EMPTY_STATES[s.empty]?.icon ?? '📊'}</div>
                    <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, lineHeight: 1.3, marginBottom: '4px' }}>{EMPTY_STATES[s.empty]?.msg ?? s.label}</div>
                    <Link href={EMPTY_STATES[s.empty]?.href ?? '/register'} style={{ fontSize: '0.68rem', color: '#64748b', textDecoration: 'none', borderBottom: '1px solid #475569' }}>{EMPTY_STATES[s.empty]?.cta ?? 'Get started'}</Link>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '-1px' }}>
                      {statsLoading
                        ? <span style={{ color: '#334155' }}>—</span>
                        : <Counter target={s.value} prefix={s.prefix} suffix={s.suffix} />
                      }
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>{s.label}</div>
                    {s.sub && <div style={{ fontSize: '0.68rem', color: '#38bdf8', marginTop: '4px', fontWeight: 600 }}>{s.sub}</div>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── GROWTH VISUALISATION ── */}
      <div style={{ background: 'rgba(56,189,248,0.02)', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div className="lp-section" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 999, padding: '0.25rem 0.85rem', fontSize: '0.75rem', color: '#34d399', marginBottom: '0.75rem', fontWeight: 700 }}>
              <span className="live-dot" style={{ background: '#34d399' }} /> JOIN THE FREETRUST ECONOMY
            </div>
            <h2 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>A community growing in real time</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 500, margin: '0 auto' }}>
              Every day, more members join, more Trust is earned, and the economy grows.
            </p>
          </div>

          <div className="growth-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {/* Member growth card */}
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 14, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em' }}>MEMBER GROWTH</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#38bdf8' }}>
                    {statsLoading ? '—' : <Counter target={totalMembers} />}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {membersThisWeek > 0 && <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 700 }}>+{membersThisWeek} this week</div>}
                  {membersThisMonth > 0 && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>+{membersThisMonth} this month</div>}
                </div>
              </div>
              {growthData.length >= 2 ? (
                <Sparkline data={growthData} color="#38bdf8" height={52} />
              ) : (
                <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#334155', border: '1px dashed #334155', borderRadius: 8 }}>
                  📈 Chart populates as members join
                </div>
              )}
            </div>

            {/* Trust economy card */}
            <div style={{ background: '#1e293b', border: '1px solid rgba(52,211,153,0.12)', borderRadius: 14, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em' }}>TRUST ISSUED</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34d399' }}>
                    {statsLoading ? '—' : <><Counter target={trustTotal} prefix="₮" /></>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {trustThisWeek > 0 && <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 700 }}>+₮{trustThisWeek} this week</div>}
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>to {totalMembers} member{totalMembers !== 1 ? 's' : ''}</div>
                </div>
              </div>
              {trustTotal > 0 ? (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 8, padding: '0.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#34d399' }}>₮{Math.round(trustTotal / Math.max(totalMembers, 1))}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>avg per member</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#38bdf8' }}>₮{trustThisWeek}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>this week</div>
                  </div>
                </div>
              ) : (
                <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#334155', border: '1px dashed #334155', borderRadius: 8 }}>
                  ₮ Trust flows as members transact
                </div>
              )}
            </div>
          </div>

          {/* Platform snapshot - 4 mini stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Services', value: servicesListed, icon: '🛠️', empty: 'services', href: '/seller/gigs/create' },
              { label: 'Products', value: productsListed, icon: '📦', empty: 'products', href: '/seller/gigs/create' },
              { label: 'Events', value: upcomingEvents, icon: '📅', empty: 'events', href: '/events/create' },
              { label: 'Articles', value: articlesPublished, icon: '✍️', empty: 'articles', href: '/articles/new' },
            ].map(item => (
              <div key={item.label} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '0.9rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>{item.icon}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: item.value > 0 ? '#f1f5f9' : '#475569' }}>
                  {statsLoading ? '—' : item.value > 0 ? item.value.toLocaleString() : '0'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.label}</div>
                {item.value === 0 && !statsLoading && (
                  <Link href={item.href} style={{ fontSize: '0.62rem', color: '#38bdf8', textDecoration: 'none', display: 'block', marginTop: '3px', fontWeight: 600 }}>Be first →</Link>
                )}
              </div>
            ))}
          </div>

          {/* Social proof / week stats */}
          {!statsLoading && (membersThisWeek > 0 || membersThisMonth > 0) && (
            <div style={{ marginTop: '1.25rem', background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span className="live-dot" />
              {membersThisWeek > 0 && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}><strong style={{ color: '#34d399' }}>{membersThisWeek}</strong> people joined this week</span>}
              {membersThisMonth > 0 && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}><strong style={{ color: '#38bdf8' }}>{membersThisMonth}</strong> this month</span>}
              {articlesPublished > 0 && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}><strong style={{ color: '#a78bfa' }}>{articlesPublished}</strong> articles published</span>}
              {communitiesCount > 0 && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}><strong style={{ color: '#f59e0b' }}>{communitiesCount}</strong> communities</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── FEE COMPARISON ── */}
      <div className="lp-section">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-block', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 999, padding: '0.25rem 0.85rem', fontSize: '0.75rem', color: '#fca5a5', marginBottom: '0.75rem', fontWeight: 700 }}>
            💸 THE INDUSTRY IS TAKING TOO MUCH
          </div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>Stop giving away your earnings</h2>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 520, margin: '0 auto' }}>Traditional platforms take 10–20% of every transaction. FreeTrust rewards loyalty with fees that drop to zero.</p>
        </div>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {FEE_COMPARISON.map(f => (
            <div key={f.platform} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: f.highlight ? 'rgba(52,211,153,0.06)' : '#1e293b', border: `1px solid ${f.highlight ? 'rgba(52,211,153,0.3)' : '#334155'}`, borderRadius: '12px', padding: '14px 18px' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{f.icon}</span>
              <span style={{ flex: 1, fontSize: '14px', fontWeight: f.highlight ? 800 : 500, color: f.highlight ? '#f1f5f9' : '#94a3b8' }}>{f.platform}</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: f.color }}>{f.fee}</span>
              <span style={{ fontSize: '11px', color: '#475569' }}>fee</span>
              {f.highlight && <span style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>BEST</span>}
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569', marginTop: '1rem' }}>
          *FreeTrust fee drops from 5% → 3% → 1.5% → 0% as your Trust level increases
        </p>
      </div>

      {/* ── TRUST ECONOMY ── */}
      <div style={{ background: 'rgba(56,189,248,0.03)', borderTop: '1px solid rgba(56,189,248,0.08)', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div className="lp-section">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.25rem 0.85rem', fontSize: '0.75rem', color: '#38bdf8', marginBottom: '0.75rem', fontWeight: 700 }}>
              ₮ THE TRUST CURRENCY
            </div>
            <h2 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>Your reputation, quantified</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 520, margin: '0 auto' }}>Trust (₮) is earned through every positive interaction. Higher Trust = lower fees, better visibility, and real earning power.</p>
          </div>
          <div className="trust-tabs" style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'nowrap' }}>
            {TRUST_LEVELS.map((lvl, i) => (
              <button key={lvl.level} className="trust-tab"
                onClick={() => setActiveTrustLevel(i)}
                style={{ background: activeTrustLevel === i ? lvl.color : 'transparent', color: activeTrustLevel === i ? '#0f172a' : lvl.color, border: `1px solid ${lvl.color}50` }}>
                {lvl.level}
              </button>
            ))}
          </div>
          {(() => {
            const lvl = TRUST_LEVELS[activeTrustLevel]
            return (
              <div style={{ maxWidth: 600, margin: '0 auto', background: lvl.bg, border: `1px solid ${lvl.color}40`, borderRadius: '16px', padding: '1.5rem 1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: lvl.color }}>{lvl.level}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>₮{lvl.min.toLocaleString()}{lvl.max ? ` – ₮${lvl.max.toLocaleString()}` : '+'}</div>
                  </div>
                  <div style={{ background: `${lvl.color}20`, border: `1px solid ${lvl.color}40`, borderRadius: '10px', padding: '0.5rem 1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: lvl.color }}>{['5%','3%','1.5%','0%','0% + Rev'][activeTrustLevel]}</div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>PLATFORM FEE</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lvl.perks.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: '#cbd5e1' }}>
                      <span style={{ color: lvl.color, fontSize: '14px', flexShrink: 0 }}>✓</span>{p}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── HOW TO EARN ── */}
      <div className="lp-section">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>6 ways to earn Trust today</h2>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>Every action on FreeTrust moves you closer to Elite — and zero fees.</p>
        </div>
        <div className="lp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.85rem' }}>
          {EARN_WAYS.map(w => (
            <div key={w.action} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '22px', flexShrink: 0 }}>{w.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>{w.action}</div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap', flexShrink: 0 }}>{w.earn}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ background: 'rgba(56,189,248,0.03)', borderTop: '1px solid rgba(56,189,248,0.08)', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div className="lp-section">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>How it works</h2>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>From signup to zero fees in four steps.</p>
          </div>
          <div className="lp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
            {HOW_IT_WORKS.map(s => (
              <div key={s.step} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.25rem', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>STEP {s.step}</div>
                <div style={{ fontSize: '28px', marginBottom: '0.5rem' }}>{s.icon}</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.35rem' }}>{s.title}</div>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.55, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TESTIMONIALS ── */}
      <div className="lp-section">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>Real earnings, real stories</h2>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>Members who put the Trust economy to work.</p>
        </div>
        <div className="lp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.65, margin: 0, flex: 1 }}>&ldquo;{t.quote}&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid #334155', paddingTop: '0.75rem' }}>
                <img src={t.avatarImg} alt={t.name} width={36} height={36} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{t.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{t.role}</div>
                </div>
                <div style={{ marginLeft: 'auto', background: 'rgba(56,189,248,0.1)', borderRadius: '8px', padding: '3px 9px', fontSize: '11px', fontWeight: 700, color: '#38bdf8', flexShrink: 0 }}>
                  ₮{t.trust.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── IMPACT ── */}
      <div style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, rgba(56,189,248,0.06) 100%)', border: '1px solid rgba(52,211,153,0.12)', margin: '0 1.25rem 3rem', borderRadius: '20px', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🌍</div>
        <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 900, margin: '0 0 0.5rem' }}>Commerce with a conscience</h2>
        <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: '520px', margin: '0 auto 1.5rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
          1% of every transaction on FreeTrust flows into the community Impact Fund — financing sustainability and social good projects voted on by members.
        </p>
        <Link href="/impact" style={{ display: 'inline-block', padding: '0.7rem 1.8rem', borderRadius: '10px', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
          See the Impact Fund →
        </Link>
      </div>

      {/* ── FINAL CTA ── */}
      <div style={{ textAlign: 'center', padding: '3rem 1.25rem 4rem' }}>
        <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.25rem 0.85rem', fontSize: '0.75rem', color: '#38bdf8', marginBottom: '1rem', fontWeight: 700 }}>
          🏅 FOUNDING MEMBER SPOTS FILLING FAST
        </div>
        <h2 style={{ fontSize: 'clamp(1.8rem,5vw,3rem)', fontWeight: 900, margin: '0 0 0.75rem', letterSpacing: '-1px' }}>
          Your trust is worth more<br />
          <span style={{ background: 'linear-gradient(135deg,#38bdf8,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>than you think</span>
        </h2>
        <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '1rem', maxWidth: '460px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
          Join as a founding member. Start with ₮25 free. Reach Elite and pay zero platform fees — forever.
          {totalMembers > 0 && <><br /><strong style={{ color: '#f59e0b' }}>{Math.max(0, foundingGoal - totalMembers).toLocaleString()} founding spots remaining.</strong></>}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '1rem 2.5rem', borderRadius: 12, fontWeight: 800, fontSize: '1.05rem', textDecoration: 'none', boxShadow: '0 4px 24px rgba(56,189,248,0.4)' }}>
            Claim My Founding Spot
          </Link>
          <Link href="/browse" style={{ background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', padding: '1rem 2rem', borderRadius: 12, fontWeight: 600, fontSize: '1rem', textDecoration: 'none', border: '1px solid rgba(148,163,184,0.2)' }}>
            Browse the Directory
          </Link>
        </div>
      </div>

      <footer style={{ borderTop: '1px solid rgba(56,189,248,0.08)', padding: '1.5rem 1.25rem', textAlign: 'center', color: '#475569', fontSize: '0.8rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <span>© 2026 FreeTrust</span>
        <Link href="/services" style={{ color: '#475569', textDecoration: 'none' }}>Services</Link>
        <Link href="/products" style={{ color: '#475569', textDecoration: 'none' }}>Products</Link>
        <Link href="/jobs" style={{ color: '#475569', textDecoration: 'none' }}>Jobs</Link>
        <Link href="/impact" style={{ color: '#475569', textDecoration: 'none' }}>Impact</Link>
        <Link href="/register" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>Join free →</Link>
      </footer>
    </main>
  )
}
