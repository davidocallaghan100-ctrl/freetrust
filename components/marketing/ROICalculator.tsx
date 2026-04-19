'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNum({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayed, setDisplayed] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    if (value === prev.current) return
    const from = prev.current
    prev.current = value
    const dur = 600
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setDisplayed(Math.round(from + (value - from) * e))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  return <>{prefix}{displayed.toLocaleString()}{suffix}</>
}

// ── Slider ────────────────────────────────────────────────────────────────────
function Slider({
  label, value, min, max, step = 1, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number
  format?: (v: number) => string; onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
          {format ? format(value) : value}
        </span>
      </div>
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        {/* Track */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4,
          borderRadius: 2, background: 'rgba(255,255,255,0.08)',
        }} />
        {/* Fill */}
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 4,
          borderRadius: 2, background: 'linear-gradient(90deg,#10b981,#34d399)',
          transition: 'width 0.1s',
        }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', inset: 0, width: '100%', opacity: 0,
            cursor: 'pointer', height: '100%', margin: 0,
          }}
        />
        {/* Thumb */}
        <div style={{
          position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
          width: 16, height: 16, borderRadius: '50%',
          background: '#10b981', border: '2px solid #0f172a',
          boxShadow: '0 0 8px rgba(16,185,129,0.5)',
          pointerEvents: 'none', transition: 'left 0.1s',
        }} />
      </div>
    </div>
  )
}

// ── Tier computation ──────────────────────────────────────────────────────────
function getTier(annual: number): { label: string; color: string; emoji: string } {
  if (annual >= 10000) return { label: 'Platinum',  color: '#38bdf8', emoji: '💎' }
  if (annual >= 5000)  return { label: 'Gold',      color: '#f59e0b', emoji: '🥇' }
  if (annual >= 1000)  return { label: 'Silver',    color: '#94a3b8', emoji: '🥈' }
  return                      { label: 'Member',    color: '#64748b', emoji: '🌱' }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ROICalculator() {
  const [mode, setMode] = useState<'seller' | 'buyer'>('seller')

  // Seller inputs
  const [listings, setListings] = useState(5)
  const [orderValue, setOrderValue] = useState(50)
  const [orders, setOrders]   = useState(10)
  const [onTime, setOnTime]   = useState(true)

  // Buyer inputs
  const [purchases, setPurchases] = useState(3)
  const [reviews, setReviews]     = useState(2)

  const result = useMemo(() => {
    if (mode === 'seller') {
      const fromListings = listings * 100
      const fromOrders   = orders * (onTime ? 150 : 50)
      const fromReviews  = Math.round(orders * 0.7 * 50)
      const monthly      = fromListings + fromOrders + fromReviews
      const annual       = monthly * 12
      const feeReduction = annual >= 10000 ? 3 : annual >= 5000 ? 2 : annual >= 1000 ? 1 : 0
      const moneySaved   = Math.round(orderValue * orders * 12 * (feeReduction / 100))
      return { monthly, annual, feeReduction, moneySaved }
    } else {
      const fromConfirming = purchases * 25
      const fromReviewing  = reviews * 55
      const monthly        = fromConfirming + fromReviewing
      const annual         = monthly * 12
      const feeReduction   = annual >= 1000 ? 1 : 0
      return { monthly, annual, feeReduction, moneySaved: 0 }
    }
  }, [mode, listings, orderValue, orders, onTime, purchases, reviews])

  const tier = getTier(result.annual)

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.8) 100%)',
      border: '1px solid rgba(16,185,129,0.2)',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 4px 40px rgba(16,185,129,0.08)',
    }}>
      {/* Mode tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        {(['seller', 'buyer'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1, padding: '14px 20px', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, transition: 'all 0.2s',
              background: mode === m
                ? m === 'seller' ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)'
                : 'transparent',
              color: mode === m
                ? m === 'seller' ? '#34d399' : '#60a5fa'
                : '#64748b',
              borderBottom: mode === m
                ? `2px solid ${m === 'seller' ? '#10b981' : '#3b82f6'}`
                : '2px solid transparent',
            }}
          >
            {m === 'seller' ? '🏪 I\'m a Seller' : '🛒 I\'m a Buyer'}
          </button>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
        gap: 0,
      }}>
        {/* ── Left: Inputs ── */}
        <div style={{
          padding: '24px 28px',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
            Your Activity
          </div>

          {mode === 'seller' ? (
            <>
              {/* Sliders group */}
              <div>
                <Slider
                  label="Listings per month"
                  value={listings} min={1} max={20}
                  onChange={setListings}
                />
                <Slider
                  label="Avg order value"
                  value={orderValue} min={10} max={500} step={5}
                  format={v => `€${v}`}
                  onChange={setOrderValue}
                />
                <Slider
                  label="Orders per month"
                  value={orders} min={1} max={30}
                  onChange={setOrders}
                />
                {/* On-time toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Deliver on time?</span>
                  <button
                    onClick={() => setOnTime(v => !v)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      position: 'relative', transition: 'background 0.2s',
                      background: onTime ? '#10b981' : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, width: 18, height: 18,
                      borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                      left: onTime ? 23 : 3,
                    }} />
                  </button>
                </div>
              </div>
              {/* Tip card pinned to bottom */}
              <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, fontSize: 12, color: '#6ee7b7', lineHeight: 1.6 }}>
                  {onTime
                    ? <>⚡ On-time deliveries earn <strong>+150₮</strong> per order</>
                    : <>📦 Late deliveries earn <strong>+50₮</strong> per order</>
                  }
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Sliders group */}
              <div>
                <Slider
                  label="Purchases per month"
                  value={purchases} min={1} max={10}
                  onChange={setPurchases}
                />
                <Slider
                  label="Reviews left per month"
                  value={reviews} min={0} max={10}
                  onChange={setReviews}
                />
              </div>
              {/* Tip card pinned to bottom */}
              <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, fontSize: 12, color: '#93c5fd', lineHeight: 1.6 }}>
                  💡 5-star reviews earn <strong>+55₮</strong> bonus (vs +30₮ for standard reviews)
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Right: Output ── */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Your Earnings
          </div>

          {/* Monthly */}
          <div style={{
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Monthly TrustCoins</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981', lineHeight: 1 }}>
              <AnimatedNum value={result.monthly} suffix="₮" />
            </div>
          </div>

          {/* Annual */}
          <div style={{
            background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)',
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>Annual projection</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#34d399' }}>
                <AnimatedNum value={result.annual} suffix="₮" />
              </div>
            </div>
            {/* Tier badge */}
            <div style={{
              background: `${tier.color}18`, border: `1px solid ${tier.color}40`,
              borderRadius: 10, padding: '6px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 18 }}>{tier.emoji}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: tier.color, letterSpacing: '0.06em' }}>
                {tier.label}
              </div>
            </div>
          </div>

          {/* Fee saving */}
          <div style={{
            background: result.feeReduction > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${result.feeReduction > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 12, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>Fee reduction</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: result.feeReduction > 0 ? '#f59e0b' : '#475569' }}>
              {result.feeReduction > 0
                ? <><AnimatedNum value={result.feeReduction} suffix="%" /> off platform fees</>
                : 'Earn 1,000₮ to unlock savings'
              }
            </div>
            {result.moneySaved > 0 && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                ≈ <strong style={{ color: '#fbbf24' }}>€<AnimatedNum value={result.moneySaved} /></strong> saved per year
              </div>
            )}
          </div>

          {/* CTA */}
          <Link
            href="/register"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'linear-gradient(135deg,#10b981,#059669)',
              color: '#fff', padding: '12px 20px', borderRadius: 10,
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
              transition: 'opacity 0.2s', marginTop: 2,
            }}
          >
            Start Earning — Join Free →
          </Link>
        </div>
      </div>

      {/* Earning breakdown footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '14px 28px',
        background: 'rgba(255,255,255,0.015)',
        display: 'flex', gap: 20, flexWrap: 'wrap',
      }}>
        {mode === 'seller' ? (
          <>
            <span style={{ fontSize: 11, color: '#475569' }}>🏪 <strong style={{ color: '#64748b' }}>+100₮</strong> per listing</span>
            <span style={{ fontSize: 11, color: '#475569' }}>⚡ <strong style={{ color: '#64748b' }}>+150₮</strong> on-time delivery</span>
            <span style={{ fontSize: 11, color: '#475569' }}>⭐ <strong style={{ color: '#64748b' }}>+50₮</strong> per review</span>
            <span style={{ fontSize: 11, color: '#475569' }}>🗺️ <strong style={{ color: '#64748b' }}>+10₮</strong> live tracking</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: '#475569' }}>✅ <strong style={{ color: '#64748b' }}>+25₮</strong> per purchase</span>
            <span style={{ fontSize: 11, color: '#475569' }}>⭐ <strong style={{ color: '#64748b' }}>+55₮</strong> 5-star review</span>
            <span style={{ fontSize: 11, color: '#475569' }}>🎁 <strong style={{ color: '#64748b' }}>+200₮</strong> signup bonus</span>
          </>
        )}
      </div>

      {/* Mobile responsive override */}
      <style>{`
        @media (max-width: 560px) {
          .roi-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
