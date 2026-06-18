'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useCurrency } from '@/context/CurrencyContext'
import FAQAccordion from '@/components/marketing/FAQAccordion'
import { FAQS } from '@/lib/faq'
import { eventPosterDataUri, isUsableEventImage } from '@/lib/events/display'
import ROICalculator from './ROICalculator'
import HeroGlobe from './HeroGlobe'
import LegalDocModal from '@/components/legal/LegalDocModal'
import { legalDocs } from '@/lib/legalDocs'

export interface HomeClientProps {
  initialCounts: {
    members: number
    listings: number
    communities: number
  }
}

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
type HomeEvent = {
  id: string
  title: string
  starts_at: string | null
  cover_image_url: string | null
  city: string | null
  country: string | null
  location_label: string | null
  venue_name: string | null
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
interface HomeRentShare {
  id: string
  title: string
  category: string | null
  price_per_day: number | null
  price_per_week: number | null
  currency: string | null
  location: string | null
  images: string[] | null
  owner: { full_name: string | null; avatar_url: string | null } | null
}

const TEAL = '#00c2cb'
const NAVY = '#0a0f1e'
const CARD = '#111827'
const SLATE = '#94a3b8'

const FEATURE_CARDS = [
  { icon: '💳', title: 'Trust Payments', desc: 'Transfer money peer-to-peer with trust verification built in. Split bills, pay for services, send to family — all protected by FreeTrust’s reputation layer.' },
  { icon: '🛒', title: 'Product Marketplace', desc: 'Buy and sell physical and digital products with verified sellers. Real Trust Scores replace anonymous reviews. Shop with confidence.' },
  { icon: '💼', title: 'Service Marketplace', desc: 'Hire verified freelancers and local service providers. From design to construction — every provider is trust-rated by the community.' },
  { icon: '🌐', title: 'Community Platform', desc: 'Build your trusted network. Connect with people who share your values, collaborate on projects, and grow together.' },
  { icon: '📰', title: 'Newsfeed', desc: 'A creative, productive, positive, and inclusive feed. Share ideas, showcase work, celebrate wins — no toxic algorithms, no ads, just community.' },
  { icon: '₮', title: 'Trust Coin', desc: 'Earn Trust Coin (₮) for every verified transaction, review, and contribution. Spend it to reduce fees, boost listings, and unlock platform benefits.' },
]

const CAT_COLORS_HOME: Record<string, string> = {
  Technology: '#34d399', Startup: '#38bdf8', AI: '#e879f9', Business: '#a78bfa', Design: '#f472b6', Marketing: '#fb923c', Web3: '#818cf8', 'E-commerce': '#f59e0b', Sustainability: '#4ade80',
}

const screenshots = {
  wallet: '/landing-assets/trust-wallet-mobile.png',
  products: '/landing-assets/product-marketplace-mobile.png',
  services: '/landing-assets/service-marketplace-mobile.png',
  community: '/landing-assets/community-mobile.png',
}

async function fetchJsonWithTimeout<T>(url: string, fallback: T, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) return fallback
    return (await res.json()) as T
  } catch {
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}

function Counter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const prevTarget = useRef(0)
  useEffect(() => {
    if (target === prevTarget.current) return
    prevTarget.current = target
    if (target === 0) { setCount(0); return }
    const from = count
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / 900, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(from + (target - from) * e))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
  return <span>{prefix}{count.toLocaleString()}{suffix}</span>
}

function PhoneMockup({ src, label, tilt = 'left' }: { src: string; label: string; tilt?: 'left' | 'right' | 'none' }) {
  return (
    <div className={`ft-phone ft-phone-${tilt}`} aria-label={label}>
      <div className="ft-phone-notch" />
      <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 31 }} />
    </div>
  )
}

function SectionHeader({ eyebrow, title, children, light = false }: { eyebrow: string; title: string; children?: React.ReactNode; light?: boolean }) {
  return (
    <div className="ft-section-head" style={{ textAlign: 'center', maxWidth: 780, margin: '0 auto 2.75rem' }}>
      <div style={{ color: light ? '#0077b6' : '#7ff7ff', fontSize: 12, fontWeight: 900, letterSpacing: '0.11em', textTransform: 'uppercase', marginBottom: 10 }}>{eyebrow}</div>
      <h2 className="ft-h2" style={{ fontSize: 36, lineHeight: 1.1, letterSpacing: '-0.045em', margin: '0 0 0.85rem', color: light ? '#0f172a' : '#fff', fontWeight: 800 }}>{title}</h2>
      {children && <p style={{ margin: 0, color: light ? '#475569' : SLATE, fontSize: 16, lineHeight: 1.7 }}>{children}</p>}
    </div>
  )
}

function TrustWorldMap() {
  return (
    <svg viewBox="0 0 1200 320" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: '50px 0 auto', width: '100%', height: 320, opacity: 0.35, pointerEvents: 'none' }}>
      <path d="M80 162c128-94 206-22 324-67 97-37 157 33 250 12 131-30 222 22 307 58 74 31 129 4 190-18" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="8 12" />
      {[190, 438, 640, 858, 1034].map((x, i) => <circle key={x} cx={x} cy={[132, 91, 108, 163, 145][i]} r="6" fill={TEAL} style={{ filter: 'drop-shadow(0 0 10px #00c2cb)' }} />)}
    </svg>
  )
}

function LegacyTopDesign({
  initialCounts,
  stats,
  members,
  membersThisWeek,
  services,
  products,
  trustIssued,
  trustCirculation,
  trustHolders,
}: {
  initialCounts: HomeClientProps['initialCounts']
  stats: StatsData | null
  members: number
  membersThisWeek: number
  services: number
  products: number
  trustIssued: number
  trustCirculation: number
  trustHolders: number
}) {
  return (
    <>
      {/* ── 2. HERO ── */}
      <div style={{ background: 'radial-gradient(ellipse 100% 80% at 50% -5%, rgba(56,189,248,0.13) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 85% 40%, rgba(129,140,248,0.08) 0%, transparent 60%)', borderBottom: '1px solid rgba(56,189,248,0.08)', paddingTop: '3rem', paddingBottom: '2.5rem' }}>
        <div className="lp" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center' }} >
          <div className="hero-inner" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>

            {/* Left: rotating globe */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} className="bubble-col hero-globe-stack">
              <style>{`
                @media (max-width: 640px) { .bubble-col > div { transform: scale(0.78); transform-origin: center top; } }
              `}</style>
              <HeroGlobe size={220} />
              <img
                className="hero-frameless-logo"
                src="/icons/freetrust-mark-perfect-transparent-20260521.png"
                alt="FreeTrust trust knot logo"
                style={{
                  width: 140,
                  height: 'auto',
                  marginTop: '-0.45rem',
                  filter: 'drop-shadow(0 0 22px rgba(56,189,248,0.52)) drop-shadow(0 0 16px rgba(52,211,153,0.28))',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            </div>

            {/* Right: headline + CTAs */}
            <div className="hero-text" style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1.25rem', maxWidth: 560 }}>
              <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.75rem', color: '#38bdf8', letterSpacing: '0.06em', fontWeight: 700 }}>
                🌍 COMMUNITY ECONOMY PLATFORM
              </div>

              <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.1, margin: 0, letterSpacing: '-1.5px' }}>
                The marketplace where{' '}
                <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>trust is currency</span>
              </h1>

              <p style={{ fontSize: '1.05rem', color: '#94a3b8', margin: 0, lineHeight: 1.65, maxWidth: 480 }}>
                FreeTrust is the secure community economy platform — verified members, protected messaging, on-platform payments and TrustCoins (₮) for every contribution.
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
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#34d399' }}>✓</span> Payments stay inside FreeTrust</span>
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
              { val: members, prefix: '', suffix: '', label: 'Members & growing', sub: membersThisWeek > 0 ? `+${membersThisWeek} this week` : 'Join free', color: '#38bdf8' },
              { val: services, prefix: '', suffix: '', label: 'Services available', sub: services === 0 ? 'Be the first!' : 'Browse now', color: '#38bdf8' },
              { val: products, prefix: '', suffix: '', label: 'Products listed', sub: products === 0 ? 'List yours' : 'Shop now', color: '#38bdf8' },
              { val: trustIssued, prefix: '₮', suffix: '', label: 'Total ₮ issued', sub: 'Since launch', color: '#38bdf8' },
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
                { val: trustCirculation, prefix: '₮', label: '₮ in circulation', sub: 'Current balances held', color: '#2dd4bf' },
                { val: trustIssued, prefix: '₮', label: '₮ issued since launch', sub: 'Total ever earned', color: '#34d399' },
                { val: trustHolders, prefix: '', label: 'Members holding ₮', sub: 'Active trust holders', color: '#38bdf8' },
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
    </>
  )
}

export default function HomeClient({ initialCounts }: HomeClientProps) {
  const { format } = useCurrency()
  const [isLegalLibraryOpen, setIsLegalLibraryOpen] = useState(false)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [featuredServices, setFeaturedServices] = useState<FeaturedService[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([])
  const [homeEvents, setHomeEvents] = useState<HomeEvent[] | null>(null)
  const [homeJobs, setHomeJobs] = useState<HomeJob[] | null>(null)
  const [homeRentShare, setHomeRentShare] = useState<HomeRentShare[] | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' })
      if (res.ok) setStats(await res.json() as StatsData)
    } catch { /* keep landing resilient */ }
  }, [])

  useEffect(() => {
    void fetchStats()
    const iv = setInterval(fetchStats, 60_000)
    return () => clearInterval(iv)
  }, [fetchStats])

  useEffect(() => {
    void fetchJsonWithTimeout<FeaturedService[]>('/api/listings/featured', []).then(setFeaturedServices)
    void fetchJsonWithTimeout<FeaturedProduct[]>('/api/listings/featured-products', []).then(setFeaturedProducts)
    void fetchJsonWithTimeout<HomeEvent[]>('/api/landing/events-preview?limit=6', []).then(setHomeEvents)
    void fetchJsonWithTimeout<HomeJob[]>('/api/landing/jobs-preview?limit=6', []).then(setHomeJobs)
    void fetchJsonWithTimeout<{ listings?: HomeRentShare[] }>('/api/rent-share?limit=6', { listings: [] }).then(d => setHomeRentShare((d.listings ?? []).slice(0, 6)))
  }, [])

  const tm = stats?.members.total ?? initialCounts.members
  const tw = stats?.members.thisWeek ?? 0
  const tt = stats?.trust.total ?? 9415
  const tc = stats?.trust.inCirculation ?? 10145
  const th = stats?.trust.membersHolding ?? Math.max(39, Math.min(tm, stats?.trust.membersHolding ?? 39))
  const sl = stats?.listings.services ?? 0
  const pl = stats?.listings.products ?? 0
  const goal = stats?.foundingGoal ?? 1000
  const spotsRemaining = Math.max(0, goal - tm)
  const displaySpots = spotsRemaining > 0 && spotsRemaining < 100 ? spotsRemaining.toLocaleString() : 'Under 100'
  const liveListings = (featuredProducts.length + featuredServices.length + (homeEvents?.length ?? 0) + (homeJobs?.length ?? 0))

  const productSlides = useMemo(() => {
    const productCards = featuredProducts.slice(0, 4).map(p => ({ type: 'product', title: p.title, subtitle: p.seller, price: format(p.price, p.currency as 'GBP' | 'EUR' | 'USD'), image: p.coverImage, href: `/products/${p.id}`, badge: p.reviews > 0 ? `${p.rating.toFixed(1)}★ Trust Score` : 'Verified listing' }))
    if (productCards.length >= 4) return productCards
    return [...productCards, ...[
      { type: 'product', title: 'Creator Studio Kit', subtitle: 'Verified seller', price: '€84.00', image: null, href: '/products', badge: '4.9★ Trust Score' },
      { type: 'service', title: 'Sustainable Business Plan', subtitle: 'Service marketplace', price: '€395.00', image: null, href: '/services', badge: 'Trust 90%' },
      { type: 'event', title: 'Community Meetup', subtitle: 'Events', price: 'Free RSVP', image: null, href: '/events', badge: 'Verified event' },
      { type: 'job', title: 'Local Design Project', subtitle: 'Jobs', price: 'Apply free', image: null, href: '/jobs', badge: 'Trusted company' },
    ]].slice(0, 4)
  }, [featuredProducts, format])

  return (
      <main style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.5); } }
        @keyframes soft-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .live-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #34d399; animation: pulse-dot 1.8s ease-in-out infinite; flex-shrink: 0; }
        .lp { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; }
        .lp-sec { padding: 3.5rem 1.25rem; max-width: 1100px; margin: 0 auto; }
        .ft-container { max-width: 1180px; margin: 0 auto; padding-left: 34px; padding-right: 34px; }
        .ft-section { padding: 92px 0; position: relative; overflow: hidden; }
        .ft-phone { position: relative; width: 246px; height: 508px; border-radius: 42px; padding: 12px; background: linear-gradient(145deg,#243044,#050814); box-shadow: 0 34px 80px rgba(0,0,0,.56), inset 0 0 0 1px rgba(255,255,255,.08); overflow: hidden; }
        .ft-phone-left { transform: perspective(1000px) rotateY(-13deg) rotateZ(3deg); }
        .ft-phone-right { transform: perspective(1000px) rotateY(13deg) rotateZ(-3deg); }
        .ft-phone-notch { position: absolute; z-index: 2; top: 22px; left: 50%; transform: translateX(-50%); width: 78px; height: 24px; border-radius: 999px; background: #050814; box-shadow: 0 0 0 1px rgba(255,255,255,.05); }
        .ft-card-hover { transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
        .ft-card-hover:hover { border-color: rgba(0,194,203,.38) !important; box-shadow: 0 22px 70px rgba(0,194,203,.13) !important; transform: translateY(-3px); }
        .ft-hscroll { display:flex; gap:18px; overflow-x:auto; scrollbar-width:none; padding-bottom:8px; -webkit-overflow-scrolling:touch; }
        .ft-hscroll::-webkit-scrollbar { display:none; }
        .ticker-track { display:flex; animation:ticker-scroll 42s linear infinite; white-space:nowrap; width:max-content; }
        .ticker-track:hover { animation-play-state:paused; }
        @media (max-width: 900px) {
          .ft-hero-grid, .ft-showcase-row, .ft-showcase-row-alt, .ft-banner-inner, .ft-footer-grid { grid-template-columns: 1fr !important; }
          .ft-hero-copy { text-align:left !important; }
          .ft-phone-stage { min-height: 520px !important; transform: scale(.88); transform-origin: top center; }
          .ft-secondary-phone { display:none; }
          .ft-feature-grid, .ft-impact-grid, .ft-trust-grid, .ft-legacy-stat-grid, .ft-trust-econ-top-grid { grid-template-columns: 1fr 1fr !important; }
          .ft-slide-card { min-width: 72% !important; }
        }
        @media (max-width: 768px) {
          .hero-inner { flex-direction: column !important; text-align: center; }
          .hero-globe-stack { margin-bottom: -1.4rem !important; }
          .hero-frameless-logo { width: 118px !important; margin-top: -1.1rem !important; }
          .hero-text { align-items: center !important; }
          .hero-cta { flex-direction: column !important; width: 100% !important; }
          .hero-cta a, .hero-cta button { width: 100% !important; text-align: center; justify-content: center; }
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 0.6rem !important; }
          .trust-econ-grid { grid-template-columns: repeat(3,1fr) !important; }
          .stat-val { font-size: 1.4rem !important; }
          .trust-val { font-size: 1.3rem !important; }
          .lp-sec { padding: 2.5rem 1rem; }
          .lp { padding: 0 1rem; }
          .ft-container { padding-left: 22px; padding-right: 22px; }
          .ft-section { padding: 68px 0; }
          .ft-h1 { font-size: 32px !important; }
          .ft-h2 { font-size: 26px !important; }
          .ft-hero-ctas { flex-direction: column !important; }
          .ft-hero-ctas a { width: 100%; justify-content:center; }
          .ft-phone-stage { transform: scale(.78); margin-left:-10px; }
          .ft-float-score { right: 6px !important; }
          .ft-float-verified { left: 10px !important; }
          .ft-score-row { grid-template-columns:1fr !important; text-align:center; }
          .ft-factor-grid { grid-template-columns:1fr !important; }
          .ft-footer-links { grid-template-columns:1fr 1fr !important; }
          .ft-legacy-stat-grid, .ft-trust-econ-top-grid { grid-template-columns: 1fr !important; }
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

      <LegacyTopDesign
        initialCounts={initialCounts}
        stats={stats}
        members={tm}
        membersThisWeek={tw}
        services={sl}
        products={pl}
        trustIssued={tt}
        trustCirculation={tc}
        trustHolders={th}
      />

      <section style={{ minHeight: '92vh', position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 72% 42%, rgba(0,194,203,.27), transparent 28%), linear-gradient(135deg,#0a0f1e 0%,#0b1327 48%,#0f1f2e 100%)', borderBottom: '1px solid rgba(0,194,203,.12)' }}>
        <div style={{ position: 'absolute', inset: '-20%', background: 'radial-gradient(circle at 8% 8%,rgba(255,255,255,.08),transparent 22%),radial-gradient(circle at 88% 92%,rgba(0,119,182,.24),transparent 28%)', pointerEvents: 'none' }} />
        <div className="ft-container" style={{ position: 'relative', zIndex: 1, paddingTop: 72, paddingBottom: 86 }}>
          <div className="ft-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 560px', gap: 42, alignItems: 'center' }}>
            <div className="ft-hero-copy">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, background: 'rgba(0,194,203,.12)', border: '1px solid rgba(0,194,203,.34)', color: '#d8fdff', fontWeight: 800, fontSize: 14 }}>🌍 The Trust Economy is Here</div>
              <h2 className="ft-h1" style={{ fontSize: 48, lineHeight: 1.03, margin: '24px 0 18px', letterSpacing: '-0.06em', fontWeight: 800, maxWidth: 610 }}>Buy. Sell. Connect. <span style={{ background: 'linear-gradient(90deg,#fff,#7ff7ff)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Trust.</span></h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: SLATE, maxWidth: 560, margin: '0 0 30px' }}>FreeTrust is the community marketplace where verified trust unlocks better deals, real connections, and a fairer economy.</p>
              <div className="ft-hero-ctas" style={{ display: 'flex', gap: 14, marginBottom: 26 }}>
                <Link href="/register" style={{ minHeight: 52, padding: '0 22px', borderRadius: 999, fontWeight: 850, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: TEAL, color: '#041018', boxShadow: '0 16px 38px rgba(0,194,203,.3)' }}>Get Started Free</Link>
                <a href="#how-it-works" style={{ minHeight: 52, padding: '0 22px', borderRadius: 999, fontWeight: 850, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#fff', border: '1px solid rgba(255,255,255,.22)', background: 'rgba(255,255,255,.04)' }}>See How It Works</a>
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: '#cbd5e1', fontWeight: 750, fontSize: 14 }}>
                <span style={{ padding: '10px 13px', borderRadius: 999, background: 'rgba(17,24,39,.65)', border: '1px solid rgba(148,163,184,.16)' }}>{tm.toLocaleString()} Founding Members</span>
                <span style={{ padding: '10px 13px', borderRadius: 999, background: 'rgba(17,24,39,.65)', border: '1px solid rgba(148,163,184,.16)' }}>₮200 Welcome Bonus</span>
                <span style={{ padding: '10px 13px', borderRadius: 999, background: 'rgba(17,24,39,.65)', border: '1px solid rgba(148,163,184,.16)' }}>0% Subscription Fee</span>
              </div>
            </div>
            <div className="ft-phone-stage" style={{ height: 620, position: 'relative', perspective: 1200 }}>
              <div style={{ position: 'absolute', width: 430, height: 430, right: 68, top: 92, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,194,203,.55),rgba(0,119,182,.18) 42%,transparent 70%)', filter: 'blur(34px)' }} />
              <div className="ft-secondary-phone" style={{ position: 'absolute', right: 300, top: 94, zIndex: 2, opacity: .93 }}><PhoneMockup src={screenshots.wallet} label="Actual FreeTrust Trust Wallet mobile screenshot" tilt="right" /></div>
              <div style={{ position: 'absolute', right: 110, top: 48, zIndex: 3 }}><PhoneMockup src={screenshots.products} label="Actual FreeTrust product marketplace mobile screenshot" tilt="left" /></div>
              <div style={{ position: 'absolute', zIndex: 4, right: 34, top: 118, padding: '13px 15px', borderRadius: 18, background: 'rgba(0,194,203,.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,194,203,.3)', boxShadow: '0 18px 44px rgba(0,0,0,.3)', fontWeight: 850 }}>₮{tc.toLocaleString()} bal<div style={{ color: '#c8fbff', fontSize: 11, marginTop: 3 }}>Trust Coin ready</div></div>
              <div className="ft-float-verified" style={{ position: 'absolute', zIndex: 4, left: 62, bottom: 136, padding: '13px 15px', borderRadius: 18, background: 'rgba(0,194,203,.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,194,203,.3)', boxShadow: '0 18px 44px rgba(0,0,0,.3)', fontWeight: 850 }}>✓ Verified Member<div style={{ color: '#c8fbff', fontSize: 11, marginTop: 3 }}>Identity protected</div></div>
              <div className="ft-float-score" style={{ position: 'absolute', zIndex: 4, right: 12, bottom: 214, padding: '13px 15px', borderRadius: 18, background: 'rgba(255,255,255,.11)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 18px 44px rgba(0,0,0,.3)', fontWeight: 850 }}>4.9★ Trust Score<div style={{ color: '#c8fbff', fontSize: 11, marginTop: 3 }}>Portable reputation</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="ft-section" id="how-it-works" style={{ background: 'linear-gradient(180deg,#0a0f1e,#0b1327)', borderBottom: '1px solid rgba(0,194,203,.08)', scrollMarginTop: 80 }}>
        <div className="ft-container">
          <SectionHeader eyebrow="Platform features" title="Everything you need to trade, pay, hire, and connect with confidence.">FreeTrust brings marketplace commerce, payments, reputation, and community into one trust-forward platform.</SectionHeader>
          <div className="ft-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {FEATURE_CARDS.map(card => (
              <article className="ft-card-hover" key={card.title} style={{ background: 'linear-gradient(180deg,rgba(17,24,39,.96),rgba(17,24,39,.74))', border: '1px solid #1e293b', borderRadius: 16, padding: 28, minHeight: 260, boxShadow: '0 16px 50px rgba(0,0,0,.2)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 17, background: 'rgba(0,194,203,.13)', border: '1px solid rgba(0,194,203,.28)', display: 'grid', placeItems: 'center', fontSize: 28, marginBottom: 22 }}>{card.icon}</div>
                <h3 style={{ fontSize: 20, margin: '0 0 11px', letterSpacing: '-0.02em' }}>{card.title}</h3>
                <p style={{ color: SLATE, lineHeight: 1.65, margin: 0, fontSize: 15 }}>{card.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ft-section" style={{ background: 'linear-gradient(135deg,#0a0f1e 0%,#0f1f2e 100%)', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <TrustWorldMap />
        <div className="ft-container" style={{ position: 'relative', zIndex: 1 }}>
          <SectionHeader eyebrow="Impact economy" title="Built for Impact, Not Just Profit">Every transaction on FreeTrust contributes to a fairer, more transparent economy.</SectionHeader>
          <div className="ft-impact-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
            {[{ n: tm, s: '', label: 'Founding Members' }, { n: 200, s: '₮', label: 'Welcome Bonus' }, { text: '0%', label: 'Subscription Fees' }, { text: '5%', label: 'Max Platform Fee' }].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center', padding: 30, borderRadius: 20, background: 'rgba(17,24,39,.56)', border: '1px solid rgba(0,194,203,.14)', backdropFilter: 'blur(12px)' }}>
                <div style={{ fontSize: 46, fontWeight: 850, letterSpacing: '-0.05em' }}>{stat.text ?? <Counter target={stat.n ?? 0} prefix={stat.s} suffix={stat.label === 'Founding Members' ? '+' : ''} />}</div>
                <div style={{ color: '#cbd5e1', fontWeight: 750, marginTop: 7 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <p style={{ maxWidth: 760, margin: '32px auto 0', textAlign: 'center', color: SLATE, lineHeight: 1.8 }}>The FreeTrust Impact Fund directs a portion of every transaction fee toward verified community causes, selected transparently by members.</p>
        </div>
      </section>

      <section className="ft-section" style={{ background: '#081020', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container" style={{ display: 'grid', gap: 82 }}>
          {[
            { src: screenshots.products, eyebrow: 'Marketplace', title: 'Shop smarter. Sell with trust.', text: 'Discover FreeTrust sellers and external retailer finds in one trusted product experience.', points: ['Trust Score badges on every seller card.', 'Clear member listings and retailer deals.', 'Earn Trust Coin through verified marketplace activity.'], href: '/products' },
            { src: screenshots.wallet, eyebrow: 'Trust Wallet', title: 'Send value. Earn trust.', text: 'Your Trust Coin balance and reputation live beside the commerce you do every day.', points: ['Live Trust Economy figures pulled from Supabase.', 'TrustCoin balance visible in-app.', 'Reputation rewards for helpful contributions.'], href: '/wallet', alt: true },
            { src: screenshots.services, eyebrow: 'Services', title: 'Hire verified providers.', text: 'Service cards surface real providers, ratings, progress, and trust signals before you book.', points: ['Verified local and remote service providers.', 'Trust progress and rating signals on each card.', 'Built for freelancers, founders, and community work.'], href: '/services' },
            { src: screenshots.community, eyebrow: 'Community', title: 'Your trusted network.', text: 'A positive feed and connection layer designed for collaboration, not toxic engagement loops.', points: ['Verified member profiles and community moments.', 'Creative, productive, inclusive updates.', 'Network effects that reward helpful contributions.'], href: '/feed', alt: true },
          ].map(row => (
            <div key={row.title} className={row.alt ? 'ft-showcase-row-alt' : 'ft-showcase-row'} style={{ display: 'grid', gridTemplateColumns: row.alt ? '1fr 420px' : '420px 1fr', gap: 88, alignItems: 'center' }}>
              {!row.alt && <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}><div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,194,203,.36),transparent 68%)', filter: 'blur(22px)' }} /><PhoneMockup src={row.src} label={`Actual FreeTrust ${row.eyebrow} mobile screenshot`} /></div>}
              <div>
                <div style={{ color: '#7ff7ff', fontSize: 12, fontWeight: 900, letterSpacing: '0.11em', textTransform: 'uppercase', marginBottom: 10 }}>{row.eyebrow}</div>
                <h3 style={{ fontSize: 34, letterSpacing: '-0.04em', margin: '0 0 14px' }}>{row.title}</h3>
                <p style={{ color: SLATE, lineHeight: 1.7, margin: 0 }}>{row.text}</p>
                <ul style={{ color: SLATE, lineHeight: 1.8, paddingLeft: 20, margin: '18px 0 24px' }}>{row.points.map(point => <li key={point}>{point}</li>)}</ul>
                <Link href={row.href} style={{ color: '#031019', background: TEAL, borderRadius: 999, padding: '12px 16px', textDecoration: 'none', fontWeight: 850 }}>Open {row.eyebrow} →</Link>
              </div>
              {row.alt && <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}><div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,194,203,.36),transparent 68%)', filter: 'blur(22px)' }} /><PhoneMockup src={row.src} label={`Actual FreeTrust ${row.eyebrow} mobile screenshot`} tilt="right" /></div>}
            </div>
          ))}
        </div>
      </section>

      <section className="ft-section" style={{ background: 'linear-gradient(180deg,#0a0f1e,#081020)', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container">
          <SectionHeader eyebrow="Live marketplace" title="Fresh products, jobs, and events — all in motion.">Real FreeTrust data stays in the landing page, upgraded with premium dark cards, teal trust indicators, and mobile-friendly horizontal discovery.</SectionHeader>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 24, fontWeight: 850, color: '#cbd5e1', flexWrap: 'wrap' }}>
            <span style={{ color: '#fff', borderBottom: `3px solid ${TEAL}`, paddingBottom: 10 }}>🛒 Products</span><span>💼 Jobs</span><span>📅 Events</span>
          </div>
          <div className="ft-hscroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
            {productSlides.map(card => (
              <Link className="ft-slide-card ft-card-hover" key={`${card.type}-${card.title}`} href={card.href} style={{ minWidth: 0, textDecoration: 'none', background: CARD, border: '1px solid #1e293b', borderRadius: 20, overflow: 'hidden', color: '#fff' }}>
                <div style={{ height: 150, background: card.image ? `linear-gradient(180deg,rgba(10,15,30,.05),rgba(10,15,30,.54)), url(${card.image}) center/cover` : 'linear-gradient(135deg,#0e7490,#1e293b 55%,#111827)' }} />
                <div style={{ padding: 18 }}><h4 style={{ margin: '0 0 8px', lineHeight: 1.25 }}>{card.title}</h4><p style={{ color: SLATE, fontSize: 13, minHeight: 36, margin: 0 }}>{card.subtitle} · {card.price}</p><span style={{ display: 'inline-flex', marginTop: 12, padding: '7px 10px', borderRadius: 999, background: 'rgba(0,194,203,.13)', color: '#aafaff', fontSize: 12, fontWeight: 850 }}>{card.badge}</span></div>
              </Link>
            ))}
          </div>
          <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
            {homeJobs?.slice(0, 3).map(job => <Link key={job.id} href={`/jobs/${job.id}`} className="ft-card-hover" style={{ textDecoration: 'none', color: '#fff', background: CARD, border: '1px solid #1e293b', borderRadius: 16, padding: 18 }}><strong>{job.title}</strong><div style={{ color: SLATE, fontSize: 13, marginTop: 8 }}>{job.company_name ?? 'Company'} · {job.location_type === 'remote' ? 'Remote' : [job.city, job.country].filter(Boolean).join(', ') || 'On-site'}</div></Link>)}
            {homeEvents?.slice(0, 3).map(ev => <Link key={ev.id} href={`/events/${ev.id}`} className="ft-card-hover" style={{ textDecoration: 'none', color: '#fff', background: CARD, border: '1px solid #1e293b', borderRadius: 16, padding: 18 }}><strong>{ev.title}</strong><div style={{ color: SLATE, fontSize: 13, marginTop: 8 }}>{ev.is_online ? 'Online' : ev.venue_name || ev.location_label || [ev.city, ev.country].filter(Boolean).join(', ') || 'In person'}</div></Link>)}
          </div>
          <p style={{ margin: '20px 0 0', color: '#64748b', textAlign: 'center', fontSize: 13 }}>Showing live marketplace previews where available{liveListings ? ` · ${liveListings} live cards loaded` : ''}.</p>
        </div>
      </section>

      <section className="ft-section" style={{ background: '#f8fafc', color: '#0f172a', borderBottom: '1px solid #e2e8f0' }}>
        <div className="ft-container">
          <SectionHeader light eyebrow="Reputation layer" title="What is a Trust Score?">FreeTrust&apos;s Trust Score is your portable reputation — built from verified transactions, community reviews, and platform contributions.</SectionHeader>
          <div style={{ maxWidth: 820, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 28, padding: 36, boxShadow: '0 24px 70px rgba(15,23,42,.1)' }}>
            <div className="ft-score-row" style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 34, alignItems: 'center' }}>
              <div style={{ width: 174, height: 174, borderRadius: '50%', background: `conic-gradient(${TEAL} 0 94%,#e2e8f0 94%)`, display: 'grid', placeItems: 'center', boxShadow: '0 18px 44px rgba(0,194,203,.2)' }}><div style={{ width: 128, height: 128, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><strong style={{ fontSize: 34 }}>4.9</strong><br />/ 5.0</div></div></div>
              <div className="ft-factor-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{['Identity Verified', '47 Completed Transactions', '4.9★ Average Review', `₮${tc.toLocaleString()} Trust Coin Balance`, '2 Years Member'].map(f => <div key={f} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 14, padding: 13, fontWeight: 800, color: '#334155' }}>✓ {f}</div>)}</div>
            </div>
            <Link href="/profile" style={{ marginTop: 24, display: 'inline-flex', borderRadius: 999, background: TEAL, padding: '14px 18px', color: '#031019', textDecoration: 'none', fontWeight: 850 }}>Build Your Trust Score →</Link>
          </div>
        </div>
      </section>

      <section style={{ background: `linear-gradient(135deg, ${TEAL}, #0077b6)` }}>
        <div className="ft-container ft-banner-inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center', paddingTop: 54, paddingBottom: 54 }}>
          <div><h2 style={{ fontSize: 34, letterSpacing: '-0.04em', margin: '0 0 8px', color: '#031019' }}>Join the First 1,000 Founding Members</h2><p style={{ margin: 0, color: '#062636', fontWeight: 750, lineHeight: 1.6 }}>Get lifetime reduced fees, ₮200 Trust Coin welcome bonus, and a Founding Member badge on your profile. Only {displaySpots} spots remaining.</p></div>
          <Link href="/register" style={{ whiteSpace: 'nowrap', background: '#fff', color: '#06101f', borderRadius: 999, padding: '16px 22px', textDecoration: 'none', fontWeight: 900, boxShadow: '0 16px 34px rgba(0,0,0,.12)' }}>Claim Your Founding Member Spot</Link>
        </div>
      </section>

      {stats?.ticker && stats.ticker.length > 0 && (
        <section style={{ background: 'rgba(0,194,203,.045)', borderBottom: '1px solid rgba(0,194,203,.08)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0.65rem 0' }}><div style={{ flexShrink: 0, padding: '0 1rem', borderRight: '1px solid rgba(0,194,203,.18)', fontSize: 12, color: '#7ff7ff', fontWeight: 900 }}>LIVE</div><div style={{ flex: 1, overflow: 'hidden' }}><div className="ticker-track">{[...stats.ticker, ...stats.ticker].map((item, i) => <span key={`${item.id}-${i}`} style={{ padding: '0 1.25rem', color: SLATE, fontSize: 13, borderRight: '1px solid rgba(0,194,203,.08)' }}>{item.text}</span>)}</div></div></div>
        </section>
      )}

      <section className="ft-section" style={{ background: NAVY, borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container">
          <SectionHeader eyebrow="How it works" title="Four steps to join the trust economy">No subscriptions, no gatekeepers. Just sign up, contribute, build reputation, and grow.</SectionHeader>
          <div className="ft-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>{[
            ['🪪', 'Sign up free', 'Create your account and get ₮200 TrustCoins on signup.'], ['📦', 'List or discover', 'Publish a service, product, job, event, or community.'], ['🤝', 'Transact safely', 'Use verified profiles, Trust Scores, and on-platform payments.'], ['🌱', 'Earn and impact', 'Earn ₮, reduce fees, and support community causes.'],
          ].map(([icon, title, desc]) => <div key={title} className="ft-card-hover" style={{ background: CARD, border: '1px solid #1e293b', borderRadius: 16, padding: 22 }}><div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div><strong>{title}</strong><p style={{ color: SLATE, lineHeight: 1.65, margin: '10px 0 0', fontSize: 14 }}>{desc}</p></div>)}</div>
        </div>
      </section>

      {(featuredServices.length > 0 || featuredProducts.length > 0 || homeEvents?.length || homeRentShare?.length) && (
        <section className="ft-section" style={{ background: 'rgba(0,194,203,.025)', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
          <div className="ft-container">
            <SectionHeader eyebrow="Real activity" title="Live from the FreeTrust community">The landing page keeps its existing products, services, events, and sharing previews — now styled as one premium marketplace surface.</SectionHeader>
            <div className="ft-hscroll">
              {featuredServices.slice(0, 5).map(s => <Link key={s.id} href={`/services/${s.id}`} className="ft-card-hover" style={{ flexShrink: 0, width: 260, textDecoration: 'none', color: '#fff', background: CARD, border: '1px solid #1e293b', borderRadius: 18, overflow: 'hidden' }}><div style={{ height: 150, background: s.coverImage ? `url(${s.coverImage}) center/cover` : s.grad }} /><div style={{ padding: 16 }}><strong>{s.title}</strong><p style={{ margin: '8px 0', color: SLATE, fontSize: 13 }}>{s.provider}</p><span style={{ color: TEAL, fontWeight: 850 }}>{format(s.price, s.currency as 'GBP' | 'EUR' | 'USD')}</span></div></Link>)}
              {homeEvents?.slice(0, 4).map(ev => {
                const cat = ev.category ?? 'Technology'; const catColor = CAT_COLORS_HOME[cat] ?? TEAL; const location = ev.is_online ? 'Online' : ev.venue_name || ev.location_label || [ev.city, ev.country].filter(Boolean).join(', ') || 'In Person'; const eventImage = isUsableEventImage(ev.cover_image_url) ? ev.cover_image_url : eventPosterDataUri({ title: ev.title, category: ev.category, startsAt: ev.starts_at, location })
                return <Link key={ev.id} href={`/events/${ev.id}`} className="ft-card-hover" style={{ flexShrink: 0, width: 280, textDecoration: 'none', color: '#fff', background: CARD, border: '1px solid #1e293b', borderRadius: 18, overflow: 'hidden' }}><div style={{ height: 128, background: `linear-gradient(135deg, ${catColor}33, rgba(15,23,42,.96))`, position: 'relative' }}>{eventImage && <img src={eventImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div><div style={{ padding: 16 }}><strong>{ev.title}</strong><p style={{ margin: '8px 0 0', color: SLATE, fontSize: 13 }}>{location}</p></div></Link>
              })}
            </div>
          </div>
        </section>
      )}

      <section className="ft-section" style={{ background: '#081020', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container" style={{ maxWidth: 860 }}>
          <SectionHeader eyebrow="Your earnings" title="See what you’d earn on FreeTrust">TrustCoins compound — the more you participate, the less you pay in fees.</SectionHeader>
          <ROICalculator />
        </div>
      </section>

      <section className="ft-section" style={{ background: NAVY, borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container" style={{ maxWidth: 860 }}>
          <SectionHeader eyebrow="Frequently asked" title="Questions, answered">Everything you need to know about FreeTrust before you join.</SectionHeader>
          <FAQAccordion items={FAQS} />
        </div>
      </section>

      <footer style={{ background: '#060b16', borderTop: '1px solid #111827' }}>
        <div className="ft-container ft-footer-grid" style={{ paddingTop: 48, paddingBottom: 44, display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 34, color: SLATE }}>
          <div><div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff', fontWeight: 900, fontSize: 24 }}><img src="/icons/freetrust-mark-perfect-transparent-20260521.png" alt="" style={{ width: 38, height: 38 }} />FreeTrust</div><p style={{ lineHeight: 1.7 }}>Buy. Sell. Connect. Trust. A safer community economy powered by verified reputation.</p><button type="button" onClick={() => setIsLegalLibraryOpen(true)} style={{ color: '#99f6e4', background: 'rgba(45,212,191,.06)', border: '1px solid rgba(45,212,191,.24)', borderRadius: 999, minHeight: 44, padding: '0.65rem 1.15rem', fontSize: 14, fontWeight: 850, font: 'inherit', cursor: 'pointer' }}>Legal</button></div>
          <div className="ft-footer-links" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[['Services','/services'],['Products','/products'],['Events','/events'],['Articles','/articles'],['Impact','/impact'],['Trust & Safety','/safety'],['Privacy Policy','/privacy'],['Terms of Service','/terms'],['Join free','/register']].map(([label, href]) => <Link key={href} href={href} style={{ color: label === 'Join free' ? TEAL : '#cbd5e1', textDecoration: 'none', fontWeight: 750 }}>{label}</Link>)}
            <span style={{ color: '#64748b' }}>Instagram</span><span style={{ color: '#64748b' }}>X</span><span style={{ color: '#64748b' }}>LinkedIn</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, padding: '0 22px 24px' }}>© 2026 FreeTrust · Payments stay inside FreeTrust · Trust-based commerce for a safer internet.</div>
      </footer>
      <LegalDocModal docs={legalDocs} isOpen={isLegalLibraryOpen} onClose={() => setIsLegalLibraryOpen(false)} />
    </main>
  )
}
