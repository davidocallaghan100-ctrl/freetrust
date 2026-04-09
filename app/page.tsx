'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      let start = 0
      const step = Math.ceil(target / 60)
      const timer = setInterval(() => {
        start = Math.min(start + step, target)
        setCount(start)
        if (start >= target) clearInterval(timer)
      }, 16)
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])
  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

// ── Data ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: 24800, prefix: '', suffix: '+', label: 'Active Members' },
  { value: 6200,  prefix: '', suffix: '+', label: 'Services Listed' },
  { value: 1200000, prefix: '£', suffix: '+', label: 'Transacted' },
  { value: 340,   prefix: '', suffix: '+', label: 'Organisations' },
]

const TRUST_LEVELS = [
  { level: 'Starter',   min: 0,    max: 99,   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  perks: ['Access to marketplace', 'Post on feed', 'Join communities'] },
  { level: 'Trusted',   min: 100,  max: 499,  color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',   perks: ['Reduced platform fee (3%)', 'Verified badge', 'Priority search placement'] },
  { level: 'Pro',       min: 500,  max: 999,  color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  perks: ['1.5% platform fee', 'Featured listings', 'Early access to features'] },
  { level: 'Elite',     min: 1000, max: 4999, color: '#34d399', bg: 'rgba(52,211,153,0.1)',   perks: ['Zero platform fee', 'Top-tier search boost', 'Dedicated support'] },
  { level: 'Legendary', min: 5000, max: null, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   perks: ['Revenue share on referrals', 'Governance voting rights', 'Impact Fund allocation'] },
]

const FEE_COMPARISON = [
  { platform: 'Fiverr',     fee: '20%',  icon: '💸', color: '#ef4444' },
  { platform: 'Upwork',     fee: '10–20%', icon: '💸', color: '#ef4444' },
  { platform: 'Etsy',       fee: '6.5%', icon: '🟡', color: '#f59e0b' },
  { platform: 'FreeTrust ★',fee: '0–3%', icon: '✅', color: '#34d399', highlight: true },
]

const HOW_IT_WORKS = [
  { step: '01', icon: '🔑', title: 'Join free', desc: 'Create your account in 60 seconds. No credit card needed. Get ₮25 Trust on signup.' },
  { step: '02', icon: '🛍️', title: 'Transact', desc: 'Buy or sell services, products, and jobs. Every verified transaction earns Trust.' },
  { step: '03', icon: '⬆️', title: 'Level up', desc: 'As your Trust score grows, your fees drop — reaching zero at Elite level.' },
  { step: '04', icon: '💰', title: 'Earn more', desc: 'Elite and Legendary members earn referral revenue and gain governance influence.' },
]

const EARN_WAYS = [
  { icon: '🛠️', action: 'Complete a service order',        earn: '+₮50–200'  },
  { icon: '⭐', action: 'Receive a 5-star review',          earn: '+₮10'      },
  { icon: '🤝', action: 'Refer a new member',               earn: '+₮25'      },
  { icon: '✍️', action: 'Publish a community article',     earn: '+₮5'       },
  { icon: '📅', action: 'Host a community event',           earn: '+₮30'      },
  { icon: '🏆', action: 'Hit a Trust milestone',            earn: '+₮50–500'  },
]

const TESTIMONIALS = [
  { name: 'Priya N.', role: 'Full-Stack Developer', quote: 'I cleared £8,400 in my first 3 months. With zero platform fee at Elite level, I keep almost everything I earn.', trust: 1240, avatar: 'PN', avatarImg: 'https://i.pravatar.cc/150?img=44', grad: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { name: 'Marcus O.', role: 'SEO Consultant', quote: 'Fiverr was taking 20% off every order. FreeTrust dropped that to 3% in my first month — that\'s real money back in my pocket.', trust: 420, avatar: 'MO', avatarImg: 'https://i.pravatar.cc/150?img=12', grad: 'linear-gradient(135deg,#34d399,#059669)' },
  { name: 'Amara D.', role: 'Business Coach', quote: 'The Trust economy is real. My Trust score opened doors that cold outreach never could. Clients come to me.', trust: 890, avatar: 'AD', avatarImg: 'https://i.pravatar.cc/150?img=45', grad: 'linear-gradient(135deg,#38bdf8,#0284c7)' },
]

export default function Home() {
  const [activeTrustLevel, setActiveTrustLevel] = useState(1)

  return (
    <main style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        .lp-section { max-width: 1100px; margin: 0 auto; padding: 4rem 1.25rem; }
        .lp-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; }
        .lp-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; }
        .lp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: center; }
        .fee-row { display: flex; align-items: center; gap: 0; }
        @media (max-width: 768px) {
          .lp-section { padding: 2.5rem 1rem; }
          .lp-grid-3 { grid-template-columns: 1fr; }
          .lp-grid-4 { grid-template-columns: repeat(2,1fr); }
          .lp-grid-2 { grid-template-columns: 1fr; }
          .hero-h1 { font-size: clamp(2.2rem,8vw,3.5rem) !important; }
          .hero-cta-row { flex-direction: column; align-items: stretch !important; }
          .hero-cta-row a { text-align: center; }
          .stats-row { grid-template-columns: repeat(2,1fr) !important; gap: 0.75rem !important; }
          .trust-tabs { overflow-x: auto; scrollbar-width: none; }
          .trust-tabs::-webkit-scrollbar { display: none; }
        }
        @media (max-width: 480px) {
          .lp-grid-4 { grid-template-columns: 1fr; }
        }
        .card-hover { transition: border-color 0.15s, transform 0.15s; }
        .card-hover:hover { border-color: rgba(56,189,248,0.4) !important; transform: translateY(-2px); }
        .trust-tab { cursor: pointer; padding: 0.5rem 1rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; white-space: nowrap; transition: all 0.15s; border: 1px solid transparent; }
      `}</style>

      {/* ── HERO ── */}
      <div style={{ background: 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(56,189,248,0.14) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 80% 50%, rgba(129,140,248,0.08) 0%, transparent 60%)', padding: '5rem 1.25rem 3.5rem', textAlign: 'center', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.78rem', color: '#38bdf8', marginBottom: '1.25rem', letterSpacing: '0.06em', fontWeight: 700 }}>
          ✦ THE TRUST ECONOMY — EARN AS YOU BUILD
        </div>
        <h1 className="hero-h1" style={{ fontSize: 'clamp(2.6rem, 6vw, 4.8rem)', fontWeight: 900, lineHeight: 1.08, margin: '0 0 1.25rem', letterSpacing: '-2px' }}>
          The platform where<br />
          <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>trust pays dividends</span>
        </h1>
        <p style={{ fontSize: '1.15rem', color: '#94a3b8', marginBottom: '1rem', maxWidth: '600px', margin: '0 auto 1rem', lineHeight: 1.6 }}>
          FreeTrust is a social commerce platform where your reputation is your currency. The more you transact, the more you earn — and the less you pay in fees.
        </p>

        {/* Micro-proof */}
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2.5rem', fontSize: '0.82rem', color: '#64748b' }}>
          <span>✅ Free to join — ₮25 on signup</span>
          <span>✅ Fees from 0% at Elite level</span>
          <span>✅ No monthly subscription</span>
        </div>

        <div className="hero-cta-row" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '3rem' }}>
          <Link href="/register" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.9rem 2.2rem', borderRadius: 10, fontWeight: 800, fontSize: '1rem', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.35)' }}>
            Start Earning Free →
          </Link>
          <Link href="/services" style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', padding: '0.9rem 2rem', borderRadius: 10, fontWeight: 600, fontSize: '1rem', textDecoration: 'none', border: '1px solid rgba(148,163,184,0.2)' }}>
            Browse Marketplace
          </Link>
        </div>

        {/* Social proof avatars */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
          <div style={{ display: 'flex' }}>
            {['SC','PN','MO','AD','TW'].map((i, idx) => (
              <div key={i} style={{ width: 30, height: 30, borderRadius: '50%', background: ['linear-gradient(135deg,#38bdf8,#0284c7)','linear-gradient(135deg,#a78bfa,#7c3aed)','linear-gradient(135deg,#34d399,#059669)','linear-gradient(135deg,#fb923c,#ea580c)','linear-gradient(135deg,#f472b6,#db2777)'][idx], border: '2px solid #0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', marginLeft: idx > 0 ? '-8px' : 0 }}>{i}</div>
            ))}
          </div>
          <span>Joined by <strong style={{ color: '#f1f5f9' }}>24,800+</strong> members earning Trust daily</span>
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{ background: 'rgba(56,189,248,0.03)', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.25rem' }}>
          <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', textAlign: 'center' }}>
            {STATS.map(s => (
              <div key={s.label}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '-1px' }}>
                  <Counter target={s.value} prefix={s.prefix} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
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

          {/* Level selector */}
          <div className="trust-tabs" style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'nowrap' }}>
            {TRUST_LEVELS.map((lvl, i) => (
              <button key={lvl.level} className="trust-tab"
                onClick={() => setActiveTrustLevel(i)}
                style={{ background: activeTrustLevel === i ? lvl.color : 'transparent', color: activeTrustLevel === i ? '#0f172a' : lvl.color, border: `1px solid ${lvl.color}50` }}>
                {lvl.level}
              </button>
            ))}
          </div>

          {/* Active level card */}
          {(() => {
            const lvl = TRUST_LEVELS[activeTrustLevel]
            return (
              <div style={{ maxWidth: 600, margin: '0 auto', background: lvl.bg, border: `1px solid ${lvl.color}40`, borderRadius: '16px', padding: '1.5rem 1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: lvl.color }}>{lvl.level}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      ₮{lvl.min.toLocaleString()}{lvl.max ? ` – ₮${lvl.max.toLocaleString()}` : '+'}
                    </div>
                  </div>
                  <div style={{ background: `${lvl.color}20`, border: `1px solid ${lvl.color}40`, borderRadius: '10px', padding: '0.5rem 1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: lvl.color }}>
                      {['5%','3%','1.5%','0%','0% + Rev'][activeTrustLevel]}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>PLATFORM FEE</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lvl.perks.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: '#cbd5e1' }}>
                      <span style={{ color: lvl.color, fontSize: '14px', flexShrink: 0 }}>✓</span>
                      {p}
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
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.step} style={{ position: 'relative' }}>
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.25rem', height: '100%', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>STEP {s.step}</div>
                  <div style={{ fontSize: '28px', marginBottom: '0.5rem' }}>{s.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.35rem' }}>{s.title}</div>
                  <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.55, margin: 0 }}>{s.desc}</p>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div style={{ display: 'none' }} className="step-arrow" />
                )}
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
                {t.avatarImg
                  ? <img src={t.avatarImg} alt={t.name} width={36} height={36} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>{t.avatar}</div>
                }
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
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399' }}>£1.2M+</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Impact funded</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399' }}>48</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Active projects</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399' }}>23</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Countries reached</div>
          </div>
        </div>
        <Link href="/impact" style={{ display: 'inline-block', padding: '0.7rem 1.8rem', borderRadius: '10px', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
          See the Impact Fund →
        </Link>
      </div>

      {/* ── FINAL CTA ── */}
      <div style={{ textAlign: 'center', padding: '3rem 1.25rem 4rem' }}>
        <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.25rem 0.85rem', fontSize: '0.75rem', color: '#38bdf8', marginBottom: '1rem', fontWeight: 700 }}>
          JOIN FREE TODAY
        </div>
        <h2 style={{ fontSize: 'clamp(1.8rem,5vw,3rem)', fontWeight: 900, margin: '0 0 0.75rem', letterSpacing: '-1px' }}>
          Your trust is worth more<br />
          <span style={{ background: 'linear-gradient(135deg,#38bdf8,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>than you think</span>
        </h2>
        <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '1rem', maxWidth: '440px', margin: '0 auto 2rem' }}>
          Start with ₮25 free. Every transaction builds your score. Reach Elite and pay zero platform fees — forever.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '1rem 2.5rem', borderRadius: 12, fontWeight: 800, fontSize: '1.05rem', textDecoration: 'none', boxShadow: '0 4px 24px rgba(56,189,248,0.4)' }}>
            Create Free Account
          </Link>
          <Link href="/browse" style={{ background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', padding: '1rem 2rem', borderRadius: 12, fontWeight: 600, fontSize: '1rem', textDecoration: 'none', border: '1px solid rgba(148,163,184,0.2)' }}>
            Browse the Directory
          </Link>
        </div>
      </div>

      <footer style={{ borderTop: '1px solid rgba(56,189,248,0.08)', padding: '1.5rem 1.25rem', textAlign: 'center', color: '#475569', fontSize: '0.8rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <span>© 2025 FreeTrust</span>
        <Link href="/services" style={{ color: '#475569', textDecoration: 'none' }}>Services</Link>
        <Link href="/products" style={{ color: '#475569', textDecoration: 'none' }}>Products</Link>
        <Link href="/jobs" style={{ color: '#475569', textDecoration: 'none' }}>Jobs</Link>
        <Link href="/impact" style={{ color: '#475569', textDecoration: 'none' }}>Impact</Link>
        <Link href="/register" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>Sign up →</Link>
      </footer>
    </main>
  )
}
