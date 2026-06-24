'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCurrency } from '@/context/CurrencyContext'
import FAQAccordion from '@/components/marketing/FAQAccordion'
import { FAQS } from '@/lib/faq'
import { eventPosterDataUri, isUsableEventImage } from '@/lib/events/display'
import { EVENT_CATEGORY_COLORS, normalizeEventCategory } from '@/lib/events/categories'
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

const TESTIMONIAL_QUOTES = [
  { icon: '✅', label: 'Trust Score', quote: 'Watching my Trust Score grow is genuinely motivating. It means something here.' },
  { icon: '🛡️', label: 'Verified commerce', quote: 'Signed up in minutes and felt safe straight away. This is what online commerce should feel like.' },
  { icon: '🛒', label: 'Products', quote: 'Listed my solutions and sold three sets in a week. No time-wasters — everyone\'s verified.' },
  { icon: '🛠️', label: 'Services', quote: 'Clients arrive already knowing I\'m verified. We skip the awkward part and just get to work.' },
  { icon: '🏠', label: 'Rentals', quote: 'Replaced the big platforms entirely. Lower fees and I actually know who\'s staying in my property.' },
  { icon: '🪙', label: 'Trust Coin (₮)', quote: 'Earned Trust Coins on my first few sales and used them to unlock a premium listing. Clever system.' },
  { icon: '💬', label: 'Messaging', quote: 'Clean, private, file sharing built in. No need to swap numbers with strangers.' },
  { icon: '⭐', label: 'Reviews & Reputation', quote: 'Two way reviews mean both sides are accountable. That\'s exactly what the internet has been missing.' },
  { icon: '🤝', label: 'Impact Fund', quote: 'I actively choose FreeTrust because every transaction contributes to something bigger.' },
  { icon: '🏆', label: 'Founding Member', quote: 'Lifetime reduced fees and in from the start. Best decision I made this year.' },
]

const FOOTER_VISION_COPY = {
  problem: [
    'The internet has a trust crisis and it is costing people everything.',
    'Global online scam losses exceeded $1.026 trillion in 2023, according to the Global Anti Scam Alliance. One in four people worldwide was targeted by an online fraud attempt. In Ireland alone, reported fraud losses climbed past €85 million in 2024. Behind every statistic is a person, often a small business owner, a freelancer, a first time buyer, who extended trust, and was burned.',
    'The digital economy promised access. What it delivered, for too many, was exposure.',
    'Platforms that were built to connect people became vectors for exploitation. Fake reviews, phantom sellers, impersonation scams, ghost contractors, the information asymmetry Nobel economist George Akerlof described in his landmark “Market for Lemons” theory has metastasised into every corner of online commerce. When buyers cannot distinguish the trustworthy from the fraudulent, they pay a premium for fear, and honest sellers are driven out.',
    'FreeTrust was born from this wound. Our founder was defrauded by a developer who disappeared with the source code of an entire platform. That loss became a question: what would commerce look like if trust was not a risk you had to absorb alone?',
  ],
  vision: [
    'A world where every exchange of skills, goods, time, and value is grounded in verified trust, and where the economy rewards those who contribute to it.',
    'We believe trust is not a luxury feature. It is the foundation on which every market must be built. We envision a future where the independent worker, the local maker, the social enterprise, and the conscious consumer are the central players in a circular economy, not the margin case that larger platforms tolerate.',
    'FreeTrust is building that future: a verified community marketplace where reputation is earned, identity is confirmed, and value flows back to the people who create it.',
  ],
}

const FOOTER_MISSION_COMMITMENTS = [
  {
    title: 'Trust by Default',
    body: 'Every FreeTrust member is identity verified. Every transaction is backed by a reputation system built on real history, not anonymous ratings. We do not just reduce fraud, we make trust the baseline expectation, not the exception.',
  },
  {
    title: 'A Community Economy Built for People',
    body: 'FreeTrust is not a platform that extracts value from its members. It is a community that generates it together. Through our Trust Coin (₮) internal currency, members earn, spend, and circulate value within the ecosystem. Founding Members, capped at 1,000, hold lifetime preferential terms, because the people who build something deserve to benefit from it.',
  },
  {
    title: 'Impact as a First Class Category',
    body: 'Commerce does not have to be neutral. Every transaction on FreeTrust carries the potential to do more than exchange value, it can fund impact. Our Impact Fund channels contributions toward causes that address inequality at its roots. When you buy, sell, or earn on FreeTrust, you participate in an economy that knows what it stands for.',
  },
  {
    title: 'A Circular Economy, Not an Extractive One',
    body: 'The dominant platforms of the last two decades were built on a simple model: aggregate supply, capture demand, extract fees, repeat. FreeTrust is built on a different model. Value generated within the community stays within the community. Trust earned is trust rewarded. The economy we are building is not a funnel, it is a cycle.',
  },
]

const FOOTER_MISSION_COPY = {
  mission: 'FreeTrust’s mission is to rebuild online commerce around verified identity, community accountability, and a circular economy that puts impact, not just profit, at its core.',
  audience: 'FreeTrust is for the independent worker who was ghosted on payment. The buyer who received nothing after paying. The small business that built five star service but could not prove it to the next customer. The social enterprise that could not find a marketplace that shared its values. We are for the people the internet was supposed to liberate and too often failed.',
  world: 'When trust becomes infrastructure, commerce changes. Verified sellers win on merit. Buyers make decisions with confidence. Local and independent businesses compete on a level field. Impact is measured, not just mentioned. And the circular flow of value, skills, goods, time, currency, reputation, strengthens the community it moves through, rather than draining it.',
}

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

function translateTickerText(item: TickerItem, t: (key: string, values?: Record<string, string | number>) => string) {
  if (item.type === 'trust') {
    const amount = item.text.match(/^₮([^\s]+) Trust earned by a member$/)?.[1]
    if (amount) return t('stats.ticker.trust', { amount })
  }

  if (item.type === 'article') {
    const title = item.text.match(/^New article published: "(.+)"$/)?.[1]
    if (title) return t('stats.ticker.article', { title })
  }

  if (item.type === 'join') {
    const joined = item.text.match(/^(.+) just joined FreeTrust$/)?.[1]
    if (joined) {
      const [name, location] = joined.split(' from ')
      return location
        ? t('stats.ticker.joinWithLocation', { name, location })
        : t('stats.ticker.join', { name: name === 'Someone' ? t('stats.ticker.someone') : name })
    }
  }

  return item.text
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
      <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center bottom', display: 'block', borderRadius: 31 }} />
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
  const t = useTranslations('landing')

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
                {t('eyebrow')}
              </div>

              <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.1, margin: 0, letterSpacing: '-1.5px' }}>
                {t('headlineLead')}{' '}
                <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('headlineAccent')}</span>
              </h1>

              <p style={{ fontSize: '1.05rem', color: '#94a3b8', margin: 0, lineHeight: 1.65, maxWidth: 480 }}>
                {t('subtitle')}
              </p>

              <div className="hero-cta" style={{ display: 'flex', flexDirection: 'row', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.9rem 2rem', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.35)' }}>
                  {t('joinFree')}
                </Link>
                <a href="#how-it-works" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', padding: '0.9rem 1.75rem', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none', border: '1px solid rgba(148,163,184,0.2)', scrollBehavior: 'smooth' }}>
                  {t('seeHow')}
                </a>
              </div>

              {/* Trust points */}
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#34d399' }}>✓</span> {t('freeToJoin')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#34d399' }}>✓</span> {t('realPeople')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#34d399' }}>✓</span> {t('paymentsInside')}</span>
              </div>

              {/* Server-rendered live stats strip — matches the summary
                  crawled by AI search engines in the JSON-LD. Re-hydrates
                  with the server-fetched counts on first paint. */}
              <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#94a3b8' }}>
                <span><strong style={{ color: '#38bdf8' }}>{initialCounts.members.toLocaleString()}</strong> {t('members')}</span>
                <span aria-hidden="true" style={{ color: '#334155' }}>·</span>
                <span><strong style={{ color: '#38bdf8' }}>{initialCounts.listings.toLocaleString()}</strong> {t('listings')}</span>
                <span aria-hidden="true" style={{ color: '#334155' }}>·</span>
                <span><strong style={{ color: '#38bdf8' }}>{initialCounts.communities.toLocaleString()}</strong> {t('communities')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. STATS BAR ── */}
      <div style={{ background: 'rgba(56,189,248,0.03)', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div className="lp" style={{ padding: '1.75rem 1.25rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '1rem', fontSize: '0.72rem', color: '#475569' }}>
            <span className="live-dot" /> {t('liveStats')}
          </div>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.85rem', textAlign: 'center' }}>
            {[
              { val: members, prefix: '', suffix: '', label: t('stats.membersGrowing'), sub: membersThisWeek > 0 ? t('stats.thisWeek', {count: membersThisWeek}) : t('stats.joinFree'), color: '#38bdf8' },
              { val: services, prefix: '', suffix: '', label: t('stats.servicesAvailable'), sub: services === 0 ? t('stats.beFirst') : t('stats.browseNow'), color: '#38bdf8' },
              { val: products, prefix: '', suffix: '', label: t('stats.productsListed'), sub: products === 0 ? t('stats.listYours') : t('stats.shopNow'), color: '#38bdf8' },
              { val: trustIssued, prefix: '₮', suffix: '', label: t('stats.totalIssued'), sub: t('stats.sinceLaunch'), color: '#38bdf8' },
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
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#2dd4bf', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('trustEconomy.label')}</span>
              <span className="live-dot" style={{ width: 5, height: 5 } as React.CSSProperties} />
            </div>
            <div className="trust-econ-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', textAlign: 'center' }}>
              {[
                { val: trustCirculation, prefix: '₮', label: t('trustEconomy.inCirculation'), sub: t('trustEconomy.currentBalances'), color: '#2dd4bf' },
                { val: trustIssued, prefix: '₮', label: t('trustEconomy.issuedSinceLaunch'), sub: t('trustEconomy.totalEarned'), color: '#34d399' },
                { val: trustHolders, prefix: '', label: t('trustEconomy.membersHolding'), sub: t('trustEconomy.activeHolders'), color: '#38bdf8' },
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
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('stats.live')}</span>
            </div>
            {/* Scrolling track — doubled for seamless loop */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div className="ticker-track">
                {[...stats.ticker, ...stats.ticker].map((item, i) => {
                  const icon = item.type === 'join' ? '👋' : item.type === 'trust' ? '₮' : item.type === 'article' ? '📝' : '✨'
                  return (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0 1.25rem', fontSize: '0.75rem', color: '#94a3b8', borderRight: '1px solid rgba(56,189,248,0.06)', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.8rem' }}>{icon}</span>
                      {translateTickerText(item, t)}
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
  const t = useTranslations('landing')
  const [isLegalLibraryOpen, setIsLegalLibraryOpen] = useState(false)
  const [footerStory, setFooterStory] = useState<'vision' | 'mission' | null>(null)
  const [marketplaceTab, setMarketplaceTab] = useState<'services' | 'products' | 'jobs' | 'events'>('services')
  const [stats, setStats] = useState<StatsData | null>(null)
  const [featuredServices, setFeaturedServices] = useState<FeaturedService[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([])
  const [homeEvents, setHomeEvents] = useState<HomeEvent[] | null>(null)
  const [homeJobs, setHomeJobs] = useState<HomeJob[] | null>(null)
  const [homeRentShare, setHomeRentShare] = useState<HomeRentShare[] | null>(null)
  const [testimonialIndex, setTestimonialIndex] = useState(0)
  const featureCards = t.raw('features.cards') as typeof FEATURE_CARDS
  const testimonialQuotes = t.raw('testimonials.items') as typeof TESTIMONIAL_QUOTES
  const showcaseRows = t.raw('showcase.rows') as Array<{srcKey: keyof typeof screenshots; eyebrow: string; title: string; text: string; points: string[]; href: string; alt?: boolean}>
  const howItWorksSteps = t.raw('howItWorks.steps') as Array<[string, string, string]>
  const trustScoreFactors = t.raw('trustScore.factors') as string[]
  const footerLinks = t.raw('footer.links') as Array<[string, string]>
  const footerVisionProblem = t.raw('footer.vision.problem') as string[]
  const footerVisionVision = t.raw('footer.vision.vision') as string[]
  const footerMissionCommitments = t.raw('footer.mission.commitments') as typeof FOOTER_MISSION_COMMITMENTS
  const faqItems = t.raw('faq.items') as typeof FAQS
  const serviceFallbacks = t.raw('liveMarketplace.fallbacks.services') as Array<{title: string; subtitle: string; price: string; badge: string}>
  const productFallbacks = t.raw('liveMarketplace.fallbacks.products') as Array<{title: string; subtitle: string; price: string; badge: string}>
  const jobFallbacks = t.raw('liveMarketplace.fallbacks.jobs') as Array<{id: string; title: string; company_name: string; location: string; salary: string; job_type: string}>
  const eventFallbacks = t.raw('liveMarketplace.fallbacks.events') as Array<{id: string; title: string; category: string; location: string; catColor: string}>

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

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTestimonialIndex(index => (index + 1) % testimonialQuotes.length)
    }, 5200)
    return () => window.clearInterval(interval)
  }, [testimonialQuotes.length])

  const tm = stats?.members.total ?? initialCounts.members
  const tw = stats?.members.thisWeek ?? 0
  const tt = stats?.trust.total ?? 9415
  const tc = stats?.trust.inCirculation ?? 10145
  const th = stats?.trust.membersHolding ?? Math.max(39, Math.min(tm, stats?.trust.membersHolding ?? 39))
  const sl = stats?.listings.services ?? 0
  const pl = stats?.listings.products ?? 0
  const goal = stats?.foundingGoal ?? 1000
  const spotsRemaining = Math.max(0, goal - tm)
  const displaySpots = spotsRemaining > 0 && spotsRemaining < 100 ? spotsRemaining.toLocaleString() : t('founding.under100')
  const liveListings = (featuredProducts.length + featuredServices.length + (homeEvents?.length ?? 0) + (homeJobs?.length ?? 0))
  const activeTestimonial = testimonialQuotes[testimonialIndex] ?? testimonialQuotes[0]

  const serviceSlides = useMemo(() => {
    const serviceCards = featuredServices.slice(0, 6).map(s => ({ type: 'service', title: s.title, subtitle: s.provider, price: format(s.price, s.currency as 'GBP' | 'EUR' | 'USD'), image: s.coverImage || screenshots.services, href: `/services/${s.id}`, badge: s.reviews > 0 ? t('liveMarketplace.badges.trustScore', {score: s.rating.toFixed(1)}) : t('liveMarketplace.badges.verifiedService') }))
    if (serviceCards.length >= 6) return serviceCards
    return [...serviceCards, ...[
      ...serviceFallbacks.map(item => ({...item, type: 'service', image: screenshots.services, href: '/services'})),
    ]].slice(0, 6)
  }, [featuredServices, format, serviceFallbacks, t])

  const productSlides = useMemo(() => {
    const productCards = featuredProducts.slice(0, 8).map(p => ({ type: 'product', title: p.title, subtitle: p.seller, price: format(p.price, p.currency as 'GBP' | 'EUR' | 'USD'), image: p.coverImage || screenshots.products, href: `/products/${p.id}`, badge: p.reviews > 0 ? t('liveMarketplace.badges.trustScore', {score: p.rating.toFixed(1)}) : t('liveMarketplace.badges.verifiedListing') }))
    if (productCards.length >= 8) return productCards
    return [...productCards, ...[
      ...productFallbacks.map(item => ({...item, type: 'product', image: screenshots.products, href: '/products'})),
    ]].slice(0, 8)
  }, [featuredProducts, format, productFallbacks, t])

  const jobPreviewCards = useMemo(() => (homeJobs ?? []).slice(0, 6).map(job => {
    const location = job.location_type === 'remote' ? t('liveMarketplace.fallbacks.remote') : [job.city, job.country].filter(Boolean).join(', ') || t('liveMarketplace.fallbacks.onSite')
    const currency = (job.salary_currency || 'EUR').toUpperCase()
    const salary = job.salary_min || job.salary_max
      ? `${job.salary_min ? format(job.salary_min, currency as 'GBP' | 'EUR' | 'USD') : ''}${job.salary_min && job.salary_max ? '–' : ''}${job.salary_max ? format(job.salary_max, currency as 'GBP' | 'EUR' | 'USD') : ''}`
      : t('liveMarketplace.fallbacks.applyFree')
    return { ...job, location, salary }
  }), [homeJobs, format, t])

  const eventPreviewCards = useMemo(() => (homeEvents ?? []).slice(0, 6).map(ev => {
    const cat = normalizeEventCategory(ev.category, ev.title)
    const catColor = EVENT_CATEGORY_COLORS[cat] ?? CAT_COLORS_HOME[cat] ?? TEAL
    const location = ev.is_online ? t('liveMarketplace.fallbacks.online') : ev.venue_name || ev.location_label || [ev.city, ev.country].filter(Boolean).join(', ') || t('liveMarketplace.fallbacks.inPerson')
    const image = isUsableEventImage(ev.cover_image_url) ? ev.cover_image_url : eventPosterDataUri({ title: ev.title, category: ev.category, startsAt: ev.starts_at, location })
    return { ...ev, category: cat, location, image, catColor }
  }), [homeEvents, t])

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
        .ft-card-hover { transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
        .ft-card-hover:hover { border-color: rgba(0,194,203,.38) !important; box-shadow: 0 22px 70px rgba(0,194,203,.13) !important; transform: translateY(-3px); }
        .ft-hscroll { display:flex; gap:18px; overflow-x:auto; scrollbar-width:none; padding-bottom:8px; -webkit-overflow-scrolling:touch; }
        .ft-hscroll::-webkit-scrollbar { display:none; }
        .ticker-track { display:flex; animation:ticker-scroll 42s linear infinite; white-space:nowrap; width:max-content; }
        .ticker-track:hover { animation-play-state:paused; }
        .ft-footer-link-button { color: #cbd5e1; text-decoration: none; font-weight: 750; border: 0; background: transparent; padding: 0; text-align: left; font: inherit; cursor: pointer; }
        .ft-footer-link-button:hover, .ft-footer-link-button.is-active { color: #00c2cb; }
        .ft-footer-story-body { margin-top: 24px; border: 1px solid rgba(45,212,191,.14); border-radius: 18px; background: linear-gradient(145deg, rgba(17,24,39,.94), rgba(8,16,32,.82)); padding: 22px; color: #cbd5e1; font-size: 14px; line-height: 1.72; }
        .ft-footer-story-body h4 { margin: 22px 0 10px; color: #7ff7ff; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
        .ft-footer-story-body h4:first-child { margin-top: 0; }
        .ft-footer-story-body p { margin: 0 0 14px; }
        .ft-footer-story-body ol { margin: 0; padding-left: 1.15rem; display: grid; gap: 12px; }
        .ft-footer-story-body li strong { color: #fff; display: block; margin-bottom: 4px; }
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
          .ft-premium-hero { min-height: auto !important; }
          .ft-premium-hero .ft-container { padding-top: 56px !important; padding-bottom: 28px !important; }
          .ft-premium-hero .ft-phone-stage { height: 420px !important; min-height: 420px !important; transform: scale(.72); transform-origin: top center; margin-left: 0 !important; margin-bottom: -18px; }
          .ft-feature-grid { grid-template-columns: 1fr !important; max-width: 430px; margin-left: auto; margin-right: auto; }
          .ft-feature-grid > .ft-card-hover { text-align: center; }
          .ft-feature-grid > .ft-card-hover > div:first-child { margin-left: auto !important; margin-right: auto !important; }
          .ft-market-tabs { justify-content: center !important; overflow-x: auto; flex-wrap: nowrap !important; padding: 0 4px 4px; scrollbar-width: none; gap: 8px !important; }
          .ft-market-tabs::-webkit-scrollbar { display: none; }
          .ft-market-tab { flex: 0 0 auto; font-size: 16px !important; padding: 10px 12px !important; min-height: 46px; scroll-snap-align: center; }
          .ft-market-grid { display: flex !important; overflow-x: auto; gap: 16px !important; padding: 0 0 12px !important; scroll-snap-type: x proximity; scrollbar-width: none; }
          .ft-market-grid::-webkit-scrollbar { display: none; }
          .ft-market-product-card { flex: 0 0 78% !important; min-width: 250px !important; scroll-snap-align: start; }
          .ft-market-list { display: flex !important; overflow-x: auto; gap: 16px !important; padding: 0 0 12px !important; scroll-snap-type: x proximity; scrollbar-width: none; }
          .ft-market-list::-webkit-scrollbar { display: none; }
          .ft-market-list > a { flex: 0 0 82% !important; min-width: 260px !important; scroll-snap-align: start; }
          .ft-float-score { right: 6px !important; }
          .ft-float-verified { left: 10px !important; }
          .ft-score-row { grid-template-columns:1fr !important; text-align:center; }
          .ft-factor-grid { grid-template-columns:1fr !important; }
          .ft-footer-links { grid-template-columns:1fr 1fr !important; }
          .ft-footer-story-body { padding: 20px; }
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
          .ft-market-product-card { flex-basis: 82% !important; min-width: 238px !important; }
          .ft-market-list > a { flex-basis: 86% !important; min-width: 238px !important; }
          .ft-market-tab { font-size: 15px !important; padding-left: 10px !important; padding-right: 10px !important; }
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

      <section className="ft-premium-hero" style={{ minHeight: '92vh', position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 72% 42%, rgba(0,194,203,.27), transparent 28%), linear-gradient(135deg,#0a0f1e 0%,#0b1327 48%,#0f1f2e 100%)', borderBottom: '1px solid rgba(0,194,203,.12)' }}>
        <div style={{ position: 'absolute', inset: '-20%', background: 'radial-gradient(circle at 8% 8%,rgba(255,255,255,.08),transparent 22%),radial-gradient(circle at 88% 92%,rgba(0,119,182,.24),transparent 28%)', pointerEvents: 'none' }} />
        <div className="ft-container" style={{ position: 'relative', zIndex: 1, paddingTop: 72, paddingBottom: 86 }}>
          <div className="ft-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 560px', gap: 42, alignItems: 'center' }}>
            <div className="ft-hero-copy">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, background: 'rgba(0,194,203,.12)', border: '1px solid rgba(0,194,203,.34)', color: '#d8fdff', fontWeight: 800, fontSize: 14 }}>{t('premiumHero.eyebrow')}</div>
              <h2 className="ft-h1" style={{ fontSize: 48, lineHeight: 1.03, margin: '24px 0 18px', letterSpacing: '-0.06em', fontWeight: 800, maxWidth: 610 }}>{t('premiumHero.titleLead')} <span style={{ background: 'linear-gradient(90deg,#fff,#7ff7ff)', WebkitBackgroundClip: 'text', color: 'transparent' }}>{t('premiumHero.titleAccent')}</span></h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: SLATE, maxWidth: 560, margin: '0 0 30px' }}>{t('premiumHero.subtitle')}</p>
              <div className="ft-hero-ctas" style={{ display: 'flex', gap: 14, marginBottom: 26 }}>
                <Link href="/register" style={{ minHeight: 52, padding: '0 22px', borderRadius: 999, fontWeight: 850, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: TEAL, color: '#041018', boxShadow: '0 16px 38px rgba(0,194,203,.3)' }}>{t('premiumHero.primaryCta')}</Link>
                <a href="#how-it-works" style={{ minHeight: 52, padding: '0 22px', borderRadius: 999, fontWeight: 850, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#fff', border: '1px solid rgba(255,255,255,.22)', background: 'rgba(255,255,255,.04)' }}>{t('premiumHero.secondaryCta')}</a>
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: '#cbd5e1', fontWeight: 750, fontSize: 14 }}>
                <span style={{ padding: '10px 13px', borderRadius: 999, background: 'rgba(17,24,39,.65)', border: '1px solid rgba(148,163,184,.16)' }}>{t('premiumHero.membersBadge', {count: tm.toLocaleString()})}</span>
                <span style={{ padding: '10px 13px', borderRadius: 999, background: 'rgba(17,24,39,.65)', border: '1px solid rgba(148,163,184,.16)' }}>{t('premiumHero.welcomeBonus')}</span>
                <span style={{ padding: '10px 13px', borderRadius: 999, background: 'rgba(17,24,39,.65)', border: '1px solid rgba(148,163,184,.16)' }}>{t('premiumHero.noSubscription')}</span>
              </div>
            </div>
            <div className="ft-phone-stage" style={{ height: 620, position: 'relative', perspective: 1200 }}>
              <div style={{ position: 'absolute', width: 430, height: 430, right: 68, top: 92, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,194,203,.55),rgba(0,119,182,.18) 42%,transparent 70%)', filter: 'blur(34px)' }} />
              <div className="ft-secondary-phone" style={{ position: 'absolute', right: 300, top: 94, zIndex: 2, opacity: .93 }}><PhoneMockup src={screenshots.wallet} label={t('alt.walletScreenshot')} tilt="right" /></div>
              <div style={{ position: 'absolute', right: 110, top: 48, zIndex: 3 }}><PhoneMockup src={screenshots.products} label={t('alt.productScreenshot')} tilt="left" /></div>
              <div style={{ position: 'absolute', zIndex: 4, right: 34, top: 118, padding: '13px 15px', borderRadius: 18, background: 'rgba(0,194,203,.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,194,203,.3)', boxShadow: '0 18px 44px rgba(0,0,0,.3)', fontWeight: 850 }}>{t('floatingBadges.balance', {amount: tc.toLocaleString()})}<div style={{ color: '#c8fbff', fontSize: 11, marginTop: 3 }}>{t('floatingBadges.trustCoinReady')}</div></div>
              <div className="ft-float-verified" style={{ position: 'absolute', zIndex: 4, left: 62, bottom: 136, padding: '13px 15px', borderRadius: 18, background: 'rgba(0,194,203,.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,194,203,.3)', boxShadow: '0 18px 44px rgba(0,0,0,.3)', fontWeight: 850 }}>{t('floatingBadges.verifiedMember')}<div style={{ color: '#c8fbff', fontSize: 11, marginTop: 3 }}>{t('floatingBadges.identityProtected')}</div></div>
              <div className="ft-float-score" style={{ position: 'absolute', zIndex: 4, right: 12, bottom: 214, padding: '13px 15px', borderRadius: 18, background: 'rgba(255,255,255,.11)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 18px 44px rgba(0,0,0,.3)', fontWeight: 850 }}>{t('floatingBadges.trustScore')}<div style={{ color: '#c8fbff', fontSize: 11, marginTop: 3 }}>{t('floatingBadges.portableReputation')}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="ft-section" id="how-it-works" style={{ background: 'linear-gradient(180deg,#0a0f1e,#0b1327)', borderBottom: '1px solid rgba(0,194,203,.08)', scrollMarginTop: 80 }}>
        <div className="ft-container">
          <SectionHeader eyebrow={t('features.eyebrow')} title={t('features.title')}>{t('features.description')}</SectionHeader>
          <div className="ft-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {featureCards.map(card => (
              <article className="ft-card-hover" key={card.title} style={{ background: 'linear-gradient(180deg,rgba(17,24,39,.96),rgba(17,24,39,.74))', border: '1px solid #1e293b', borderRadius: 16, padding: 28, minHeight: 260, boxShadow: '0 16px 50px rgba(0,0,0,.2)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 17, background: 'rgba(0,194,203,.13)', border: '1px solid rgba(0,194,203,.28)', display: 'grid', placeItems: 'center', fontSize: 28, marginBottom: 22 }}>{card.icon}</div>
                <h3 style={{ fontSize: 20, margin: '0 0 11px', letterSpacing: '-0.02em' }}>{card.title}</h3>
                <p style={{ color: SLATE, lineHeight: 1.65, margin: 0, fontSize: 15 }}>{card.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ft-section" aria-label={t('testimonials.aria')} style={{ background: 'radial-gradient(circle at 18% 0%, rgba(0,194,203,.18), transparent 32%), linear-gradient(180deg,#0b1327,#07111f)', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container">
          <SectionHeader eyebrow={t('testimonials.eyebrow')} title={t('testimonials.title')}>{t('testimonials.description')}</SectionHeader>
          <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}>
            <article
              key={activeTestimonial.label}
              style={{
                minHeight: 286,
                borderRadius: 28,
                border: '1px solid rgba(127,247,255,.2)',
                background: 'linear-gradient(145deg, rgba(17,24,39,.94), rgba(8,16,32,.82))',
                boxShadow: '0 28px 90px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.05)',
                padding: '34px clamp(22px, 5vw, 54px)',
                display: 'grid',
                alignItems: 'center',
                textAlign: 'center',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 78% 20%, rgba(0,194,203,.16), transparent 34%)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ width: 62, height: 62, margin: '0 auto 18px', borderRadius: 18, display: 'grid', placeItems: 'center', fontSize: 30, background: 'rgba(0,194,203,.13)', border: '1px solid rgba(0,194,203,.28)', boxShadow: '0 18px 44px rgba(0,194,203,.12)' }}>{activeTestimonial.icon}</div>
                <div style={{ color: '#7ff7ff', fontSize: 12, fontWeight: 950, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>{activeTestimonial.label}</div>
                <blockquote style={{ margin: 0, color: '#f8fafc', fontSize: 'clamp(22px, 4vw, 34px)', lineHeight: 1.22, letterSpacing: '-0.045em', fontWeight: 850 }}>
                  “{activeTestimonial.quote}”
                </blockquote>
              </div>
            </article>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
              {testimonialQuotes.map((item, index) => {
                const active = index === testimonialIndex
                return (
                  <button
                    key={item.label}
                    type="button"
                    aria-label={t('testimonials.showQuote', {label: item.label})}
                    onClick={() => setTestimonialIndex(index)}
                    style={{
                      width: active ? 34 : 10,
                      height: 10,
                      borderRadius: 999,
                      border: 'none',
                      background: active ? TEAL : 'rgba(148,163,184,.28)',
                      cursor: 'pointer',
                      transition: 'width .2s ease, background .2s ease',
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="ft-section" style={{ background: 'linear-gradient(135deg,#0a0f1e 0%,#0f1f2e 100%)', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <TrustWorldMap />
        <div className="ft-container" style={{ position: 'relative', zIndex: 1 }}>
          <SectionHeader eyebrow={t('impact.eyebrow')} title={t('impact.title')}>{t('impact.description')}</SectionHeader>
          <div className="ft-impact-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
            {[{ n: tm, s: '', suffix: '+', label: t('impact.stats.foundingMembers') }, { n: 200, s: '₮', suffix: '', label: t('impact.stats.welcomeBonus') }, { text: '0%', label: t('impact.stats.subscriptionFees') }, { text: '5%', label: t('impact.stats.maxPlatformFee') }].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center', padding: 30, borderRadius: 20, background: 'rgba(17,24,39,.56)', border: '1px solid rgba(0,194,203,.14)', backdropFilter: 'blur(12px)' }}>
                <div style={{ fontSize: 46, fontWeight: 850, letterSpacing: '-0.05em' }}>{stat.text ?? <Counter target={stat.n ?? 0} prefix={stat.s} suffix={stat.suffix} />}</div>
                <div style={{ color: '#cbd5e1', fontWeight: 750, marginTop: 7 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <p style={{ maxWidth: 760, margin: '32px auto 0', textAlign: 'center', color: SLATE, lineHeight: 1.8 }}>{t('impact.body')}</p>
        </div>
      </section>

      <section className="ft-section" style={{ background: '#081020', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container" style={{ display: 'grid', gap: 82 }}>
          {showcaseRows.map(row => (
            <div key={row.title} className={row.alt ? 'ft-showcase-row-alt' : 'ft-showcase-row'} style={{ display: 'grid', gridTemplateColumns: row.alt ? '1fr 420px' : '420px 1fr', gap: 88, alignItems: 'center' }}>
              {!row.alt && <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}><div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,194,203,.36),transparent 68%)', filter: 'blur(22px)' }} /><PhoneMockup src={screenshots[row.srcKey]} label={t('alt.genericScreenshot', {name: row.eyebrow})} /></div>}
              <div>
                <div style={{ color: '#7ff7ff', fontSize: 12, fontWeight: 900, letterSpacing: '0.11em', textTransform: 'uppercase', marginBottom: 10 }}>{row.eyebrow}</div>
                <h3 style={{ fontSize: 34, letterSpacing: '-0.04em', margin: '0 0 14px' }}>{row.title}</h3>
                <p style={{ color: SLATE, lineHeight: 1.7, margin: 0 }}>{row.text}</p>
                <ul style={{ color: SLATE, lineHeight: 1.8, paddingLeft: 20, margin: '18px 0 24px' }}>{row.points.map(point => <li key={point}>{point}</li>)}</ul>
                <Link href={row.href} style={{ color: '#031019', background: TEAL, borderRadius: 999, padding: '12px 16px', textDecoration: 'none', fontWeight: 850 }}>{t('showcase.open', {name: row.eyebrow})}</Link>
              </div>
              {row.alt && <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}><div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,194,203,.36),transparent 68%)', filter: 'blur(22px)' }} /><PhoneMockup src={screenshots[row.srcKey]} label={t('alt.genericScreenshot', {name: row.eyebrow})} tilt="right" /></div>}
            </div>
          ))}
        </div>
      </section>

      <section className="ft-section" style={{ background: 'linear-gradient(180deg,#0a0f1e,#081020)', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container">
          <SectionHeader eyebrow={t('liveMarketplace.eyebrow')} title={t('liveMarketplace.title')}>{t('liveMarketplace.description')}</SectionHeader>
          <div className="ft-market-tabs" style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 28, fontWeight: 850, color: '#cbd5e1', flexWrap: 'wrap' }}>
            {[
              ['services', t('liveMarketplace.tabs.services')],
              ['products', t('liveMarketplace.tabs.products')],
              ['jobs', t('liveMarketplace.tabs.jobs')],
              ['events', t('liveMarketplace.tabs.events')],
            ].map(([key, label]) => {
              const active = marketplaceTab === key
              return (
                <button
                  key={key}
                  type="button"
                  className="ft-market-tab"
                  onClick={() => setMarketplaceTab(key as 'services' | 'products' | 'jobs' | 'events')}
                  style={{
                    color: active ? '#041018' : '#cbd5e1',
                    background: active ? TEAL : 'rgba(15,23,42,.74)',
                    border: active ? `1px solid ${TEAL}` : '1px solid rgba(148,163,184,.18)',
                    boxShadow: active ? '0 14px 34px rgba(0,194,203,.2)' : 'none',
                    borderRadius: 999,
                    padding: '11px 18px',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontWeight: 900,
                  }}
                >{label}</button>
              )
            })}
          </div>

          {marketplaceTab === 'services' && (
            <div className="ft-market-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
              {serviceSlides.map(card => (
                <Link className="ft-market-product-card ft-card-hover" key={`${card.type}-${card.title}`} href={card.href} style={{ minWidth: 0, textDecoration: 'none', background: 'linear-gradient(180deg,rgba(17,24,39,.96),rgba(8,16,32,.96))', border: '1px solid #1e293b', borderRadius: 24, overflow: 'hidden', color: '#fff', boxShadow: '0 22px 70px rgba(0,0,0,.22)' }}>
                  <div style={{ height: 190, position: 'relative', background: 'linear-gradient(135deg,#0e7490,#1e293b 55%,#111827)', overflow: 'hidden' }}>
                    {card.image && <img src={card.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scale(1.02)' }} />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(5,10,20,.02),rgba(5,10,20,.72))' }} />
                    <span style={{ position: 'absolute', left: 14, top: 14, display: 'inline-flex', padding: '7px 10px', borderRadius: 999, background: 'rgba(4,16,24,.72)', color: '#aafaff', fontSize: 12, fontWeight: 900, border: '1px solid rgba(127,247,255,.22)', backdropFilter: 'blur(10px)' }}>{card.badge}</span>
                    <strong style={{ position: 'absolute', left: 14, right: 14, bottom: 14, fontSize: 20, lineHeight: 1.12, letterSpacing: '-0.03em' }}>{card.title}</strong>
                  </div>
                  <div style={{ padding: 18 }}>
                    <p style={{ color: SLATE, fontSize: 13, minHeight: 36, margin: 0, lineHeight: 1.45 }}>{card.subtitle}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
                      <span style={{ color: '#fff', fontWeight: 950, fontSize: 18 }}>{card.price}</span>
                      <span style={{ color: TEAL, fontWeight: 900, fontSize: 13 }}>{t('liveMarketplace.cta.open')}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {marketplaceTab === 'products' && (
            <div className="ft-market-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
              {productSlides.map(card => (
                <Link className="ft-market-product-card ft-card-hover" key={`${card.type}-${card.title}`} href={card.href} style={{ minWidth: 0, textDecoration: 'none', background: 'linear-gradient(180deg,rgba(17,24,39,.96),rgba(8,16,32,.96))', border: '1px solid #1e293b', borderRadius: 24, overflow: 'hidden', color: '#fff', boxShadow: '0 22px 70px rgba(0,0,0,.22)' }}>
                  <div style={{ height: 210, position: 'relative', background: 'linear-gradient(135deg,#0e7490,#1e293b 55%,#111827)', overflow: 'hidden' }}>
                    {card.image && <img src={card.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scale(1.02)' }} />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(5,10,20,.02),rgba(5,10,20,.72))' }} />
                    <span style={{ position: 'absolute', left: 14, top: 14, display: 'inline-flex', padding: '7px 10px', borderRadius: 999, background: 'rgba(4,16,24,.72)', color: '#aafaff', fontSize: 12, fontWeight: 900, border: '1px solid rgba(127,247,255,.22)', backdropFilter: 'blur(10px)' }}>{card.badge}</span>
                    <strong style={{ position: 'absolute', left: 14, right: 14, bottom: 14, fontSize: 20, lineHeight: 1.12, letterSpacing: '-0.03em' }}>{card.title}</strong>
                  </div>
                  <div style={{ padding: 18 }}>
                    <p style={{ color: SLATE, fontSize: 13, minHeight: 36, margin: 0, lineHeight: 1.45 }}>{card.subtitle}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
                      <span style={{ color: '#fff', fontWeight: 950, fontSize: 18 }}>{card.price}</span>
                      <span style={{ color: TEAL, fontWeight: 900, fontSize: 13 }}>{t('liveMarketplace.cta.view')}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {marketplaceTab === 'jobs' && (
            <div className="ft-market-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {(jobPreviewCards.length ? jobPreviewCards : jobFallbacks).slice(0, 6).map(job => <Link key={job.id} href={job.id.startsWith('jobs') ? '/jobs' : `/jobs/${job.id}`} className="ft-card-hover" style={{ textDecoration: 'none', color: '#fff', background: 'linear-gradient(180deg,rgba(17,24,39,.96),rgba(8,16,32,.96))', border: '1px solid #1e293b', borderRadius: 20, padding: 20, minHeight: 178, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}><div><span style={{ display: 'inline-flex', padding: '7px 10px', borderRadius: 999, background: 'rgba(0,194,203,.13)', color: '#aafaff', fontSize: 12, fontWeight: 900 }}>{job.job_type ?? t('liveMarketplace.fallbacks.openRole')}</span><h4 style={{ margin: '16px 0 8px', fontSize: 20, lineHeight: 1.2, letterSpacing: '-0.03em' }}>{job.title}</h4><div style={{ color: SLATE, fontSize: 13, lineHeight: 1.5 }}>{job.company_name ?? t('liveMarketplace.fallbacks.company')} · {job.location}</div></div><div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><strong style={{ color: '#fff', fontSize: 14 }}>{job.salary}</strong><span style={{ color: TEAL, fontWeight: 900, fontSize: 13 }}>{t('liveMarketplace.cta.open')}</span></div></Link>)}
            </div>
          )}

          {marketplaceTab === 'events' && (
            <div className="ft-market-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {(eventPreviewCards.length ? eventPreviewCards : eventFallbacks.map(ev => ({...ev, starts_at: null, image: eventPosterDataUri({ title: ev.title, category: ev.category, startsAt: null, location: ev.location })}))).slice(0, 6).map(ev => <Link key={ev.id} href={ev.id.startsWith('events') ? '/events' : `/events/${ev.id}`} className="ft-card-hover" style={{ textDecoration: 'none', color: '#fff', background: 'linear-gradient(180deg,rgba(17,24,39,.96),rgba(8,16,32,.96))', border: '1px solid #1e293b', borderRadius: 20, overflow: 'hidden' }}><div style={{ height: 154, background: `linear-gradient(135deg, ${ev.catColor}33, rgba(15,23,42,.96))`, position: 'relative' }}><img src={ev.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /><span style={{ position: 'absolute', left: 13, top: 13, display: 'inline-flex', padding: '7px 10px', borderRadius: 999, background: 'rgba(4,16,24,.72)', color: '#fff', fontSize: 12, fontWeight: 900, border: '1px solid rgba(255,255,255,.18)', backdropFilter: 'blur(10px)' }}>{ev.category ?? t('liveMarketplace.fallbacks.event')}</span></div><div style={{ padding: 18 }}><h4 style={{ margin: '0 0 8px', fontSize: 20, lineHeight: 1.2, letterSpacing: '-0.03em' }}>{ev.title}</h4><div style={{ color: SLATE, fontSize: 13, lineHeight: 1.5 }}>{ev.location}</div><div style={{ marginTop: 16, color: TEAL, fontWeight: 900, fontSize: 13 }}>{t('liveMarketplace.cta.viewEvent')}</div></div></Link>)}
            </div>
          )}
          <p style={{ margin: '20px 0 0', color: '#64748b', textAlign: 'center', fontSize: 13 }}>{t('liveMarketplace.status.showing')}{liveListings ? t('liveMarketplace.status.loaded', {count: liveListings}) : ''}</p>
        </div>
      </section>

      <section className="ft-section" style={{ background: '#f8fafc', color: '#0f172a', borderBottom: '1px solid #e2e8f0' }}>
        <div className="ft-container">
          <SectionHeader light eyebrow={t('trustScore.eyebrow')} title={t('trustScore.title')}>{t('trustScore.description')}</SectionHeader>
          <div style={{ maxWidth: 820, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 28, padding: 36, boxShadow: '0 24px 70px rgba(15,23,42,.1)' }}>
            <div className="ft-score-row" style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 34, alignItems: 'center' }}>
              <div style={{ width: 174, height: 174, borderRadius: '50%', background: `conic-gradient(${TEAL} 0 94%,#e2e8f0 94%)`, display: 'grid', placeItems: 'center', boxShadow: '0 18px 44px rgba(0,194,203,.2)' }}><div style={{ width: 128, height: 128, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><strong style={{ fontSize: 34 }}>4.9</strong><br />/ 5.0</div></div></div>
              <div className="ft-factor-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{trustScoreFactors.map(f => <div key={f} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 14, padding: 13, fontWeight: 800, color: '#334155' }}>✓ {f.replace('{balance}', tc.toLocaleString())}</div>)}</div>
            </div>
            <Link href="/profile" style={{ marginTop: 24, display: 'inline-flex', borderRadius: 999, background: TEAL, padding: '14px 18px', color: '#031019', textDecoration: 'none', fontWeight: 850 }}>{t('trustScore.cta')}</Link>
          </div>
        </div>
      </section>

      <section style={{ background: `linear-gradient(135deg, ${TEAL}, #0077b6)` }}>
        <div className="ft-container ft-banner-inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center', paddingTop: 54, paddingBottom: 54 }}>
          <div><h2 style={{ fontSize: 34, letterSpacing: '-0.04em', margin: '0 0 8px', color: '#031019' }}>{t('founding.title')}</h2><p style={{ margin: 0, color: '#062636', fontWeight: 750, lineHeight: 1.6 }}>{t('founding.description', {spots: displaySpots})}</p></div>
          <Link href="/register" style={{ whiteSpace: 'nowrap', background: '#fff', color: '#06101f', borderRadius: 999, padding: '16px 22px', textDecoration: 'none', fontWeight: 900, boxShadow: '0 16px 34px rgba(0,0,0,.12)' }}>{t('founding.cta')}</Link>
        </div>
      </section>

      {stats?.ticker && stats.ticker.length > 0 && (
        <section style={{ background: 'rgba(0,194,203,.045)', borderBottom: '1px solid rgba(0,194,203,.08)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0.65rem 0' }}><div style={{ flexShrink: 0, padding: '0 1rem', borderRight: '1px solid rgba(0,194,203,.18)', fontSize: 12, color: '#7ff7ff', fontWeight: 900 }}>{t('stats.live')}</div><div style={{ flex: 1, overflow: 'hidden' }}><div className="ticker-track">{[...stats.ticker, ...stats.ticker].map((item, i) => <span key={`${item.id}-${i}`} style={{ padding: '0 1.25rem', color: SLATE, fontSize: 13, borderRight: '1px solid rgba(0,194,203,.08)' }}>{translateTickerText(item, t)}</span>)}</div></div></div>
        </section>
      )}

      <section className="ft-section" style={{ background: NAVY, borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container">
          <SectionHeader eyebrow={t('howItWorks.eyebrow')} title={t('howItWorks.title')}>{t('howItWorks.description')}</SectionHeader>
          <div className="ft-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>{howItWorksSteps.map(([icon, title, desc]) => <div key={title} className="ft-card-hover" style={{ background: CARD, border: '1px solid #1e293b', borderRadius: 16, padding: 22 }}><div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div><strong>{title}</strong><p style={{ color: SLATE, lineHeight: 1.65, margin: '10px 0 0', fontSize: 14 }}>{desc}</p></div>)}</div>
        </div>
      </section>

      {featuredServices.length > 0 && (
        <section className="ft-section" style={{ background: 'rgba(0,194,203,.025)', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
          <div className="ft-container">
            <SectionHeader eyebrow={t('featuredServices.eyebrow')} title={t('featuredServices.title')}>{t('featuredServices.description')}</SectionHeader>
            <div className="ft-hscroll">
              {featuredServices.slice(0, 5).map(s => <Link key={s.id} href={`/services/${s.id}`} className="ft-card-hover" style={{ flexShrink: 0, width: 260, textDecoration: 'none', color: '#fff', background: CARD, border: '1px solid #1e293b', borderRadius: 18, overflow: 'hidden' }}><div style={{ height: 150, background: s.coverImage ? `url(${s.coverImage}) center/cover` : s.grad }} /><div style={{ padding: 16 }}><strong>{s.title}</strong><p style={{ margin: '8px 0', color: SLATE, fontSize: 13 }}>{s.provider}</p><span style={{ color: TEAL, fontWeight: 850 }}>{format(s.price, s.currency as 'GBP' | 'EUR' | 'USD')}</span></div></Link>)}
            </div>
          </div>
        </section>
      )}

      <section className="ft-section" style={{ background: '#081020', borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container" style={{ maxWidth: 860 }}>
          <SectionHeader eyebrow={t('earnings.eyebrow')} title={t('earnings.title')}>{t('earnings.description')}</SectionHeader>
          <ROICalculator />
        </div>
      </section>

      <section className="ft-section" style={{ background: NAVY, borderBottom: '1px solid rgba(0,194,203,.08)' }}>
        <div className="ft-container" style={{ maxWidth: 860 }}>
          <SectionHeader eyebrow={t('faq.eyebrow')} title={t('faq.title')}>{t('faq.description')}</SectionHeader>
          <FAQAccordion items={faqItems} />
        </div>
      </section>

      <footer style={{ background: '#060b16', borderTop: '1px solid #111827' }}>
        <div className="ft-container ft-footer-grid" style={{ paddingTop: 48, paddingBottom: 44, display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 34, color: SLATE }}>
          <div><div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff', fontWeight: 900, fontSize: 24 }}><img src="/icons/freetrust-mark-perfect-transparent-20260521.png" alt="" style={{ width: 38, height: 38 }} />FreeTrust</div><p style={{ lineHeight: 1.7 }}>{t('footer.tagline')}</p><button type="button" onClick={() => setIsLegalLibraryOpen(true)} style={{ color: '#99f6e4', background: 'rgba(45,212,191,.06)', border: '1px solid rgba(45,212,191,.24)', borderRadius: 999, minHeight: 44, padding: '0.65rem 1.15rem', fontSize: 14, fontWeight: 850, font: 'inherit', cursor: 'pointer' }}>{t('footer.legal')}</button></div>
          <div>
          <div className="ft-footer-links" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {footerLinks.map(([label, href]) => <Link key={href} href={href} style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 750 }}>{label}</Link>)}
            <button type="button" className={`ft-footer-link-button${footerStory === 'vision' ? ' is-active' : ''}`} onClick={() => setFooterStory(footerStory === 'vision' ? null : 'vision')} aria-expanded={footerStory === 'vision'}>{t('footer.vision.label')}</button>
            <button type="button" className={`ft-footer-link-button${footerStory === 'mission' ? ' is-active' : ''}`} onClick={() => setFooterStory(footerStory === 'mission' ? null : 'mission')} aria-expanded={footerStory === 'mission'}>{t('footer.mission.label')}</button>
            <Link href="/register" style={{ color: TEAL, textDecoration: 'none', fontWeight: 750 }}>{t('footer.joinFree')}</Link>
            <span style={{ color: '#64748b' }}>Instagram</span><span style={{ color: '#64748b' }}>X</span><span style={{ color: '#64748b' }}>LinkedIn</span>
          </div>
            {footerStory === 'vision' && (
              <div className="ft-footer-story-body">
                <h4>{t('footer.vision.label')}</h4>
                <h4>{t('footer.vision.problemTitle')}</h4>
                {footerVisionProblem.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                <h4>{t('footer.vision.visionTitle')}</h4>
                {footerVisionVision.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              </div>
            )}
            {footerStory === 'mission' && (
              <div className="ft-footer-story-body">
                <h4>{t('footer.mission.label')}</h4>
                <h4>{t('footer.mission.missionTitle')}</h4>
                <p>{t('footer.mission.mission')}</p>
                <p>{t('footer.mission.commitmentsIntro')}</p>
                <ol>
                  {footerMissionCommitments.map(commitment => (
                    <li key={commitment.title}>
                      <strong>{commitment.title}</strong>
                      <span>{commitment.body}</span>
                    </li>
                  ))}
                </ol>
                <h4>{t('footer.mission.audienceTitle')}</h4>
                <p>{t('footer.mission.audience')}</p>
                <h4>{t('footer.mission.worldTitle')}</h4>
                <p>{t('footer.mission.world')}</p>
                <p><strong style={{ color: '#fff' }}>{t('footer.mission.closingStrong')}</strong></p>
                <p style={{ color: '#7ff7ff', fontWeight: 900 }}>{t('footer.mission.closing')}</p>
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, padding: '0 22px 24px' }}>{t('footer.copyright')}</div>
      </footer>
      <LegalDocModal docs={legalDocs} isOpen={isLegalLibraryOpen} onClose={() => setIsLegalLibraryOpen(false)} />
    </main>
  )
}
