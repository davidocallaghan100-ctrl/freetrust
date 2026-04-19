'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FOUNDER_TIERS,
  MIN_INVESTMENT_EUR,
  MAX_INVESTMENT_EUR,
  STANDARD_SERVICE_FEE_PERCENT,
  STANDARD_PRODUCT_FEE_PERCENT,
  getTierByAmount,
  calculateAnnualSavings,
  calculateBreakEvenMonths,
  calculateFiveYearSavings,
} from '@/lib/founder/tiers';

const COLORS = {
  bgBase: '#0f172a',
  card: '#1e293b',
  cardSoft: 'rgba(30,41,59,0.6)',
  border: 'rgba(56,189,248,0.12)',
  borderStrong: 'rgba(56,189,248,0.4)',
  borderMuted: 'rgba(148,163,184,0.15)',
  sky: '#38bdf8',
  skyHover: '#7dd3fc',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  success: '#34d399',
  danger: '#f87171',
  gold: '#fbbf24',
  radius: 14,
};

const PRESET_SALES: { label: string; value: number }[] = [
  { label: '€5k', value: 5000 },
  { label: '€25k', value: 25000 },
  { label: '€100k', value: 100000 },
  { label: '€500k', value: 500000 },
];

export default function FounderPage() {
  const [amount, setAmount] = useState<number>(999);
  const [annualRevenue, setAnnualRevenue] = useState<number>(25000);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const tier = useMemo(() => getTierByAmount(amount), [amount]);
  const annualSavings = useMemo(() => calculateAnnualSavings(tier, annualRevenue), [tier, annualRevenue]);
  const breakEven = useMemo(() => calculateBreakEvenMonths(tier, annualRevenue), [tier, annualRevenue]);
  const fiveYearSavings = useMemo(() => calculateFiveYearSavings(tier, annualRevenue), [tier, annualRevenue]);

  const breakEvenLabel = useMemo(() => {
    if (!Number.isFinite(breakEven)) return '—';
    if (breakEven > 60) return '>5 yrs';
    if (breakEven < 1) return '<1 mo';
    return `${breakEven} mo`;
  }, [breakEven]);

  async function handlePurchase() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/founder/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountEur: tier.priceEur }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Checkout is coming soon.' }));
        throw new Error(body.error ?? 'Checkout failed.');
      }
      const { url } = await res.json();
      if (!url) throw new Error('No checkout URL returned.');
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout is coming soon.';
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="founder-page" style={{ color: COLORS.text, width: '100%' }}>
      <style>{`
        .founder-page { padding-bottom: 80px; }
        .founder-container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
        .founder-hero { text-align: center; padding: 80px 20px 48px; }
        .founder-hero h1 { font-size: 48px; line-height: 1.05; margin: 16px 0 20px; font-weight: 600; }
        .founder-hero h1 .accent { color: ${COLORS.sky}; }
        .founder-hero p { font-size: 18px; color: ${COLORS.textMuted}; line-height: 1.6; max-width: 640px; margin: 0 auto 24px; }
        .pretitle { font-size: 11px; letter-spacing: 3px; color: ${COLORS.sky}; font-weight: 500; text-transform: uppercase; margin-bottom: 12px; }
        .checks { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px; font-size: 14px; color: ${COLORS.textMuted}; }
        .check-item { display: inline-flex; align-items: center; gap: 6px; }
        .check-mark { color: ${COLORS.success}; }
        .section { padding: 56px 20px; border-top: 1px solid ${COLORS.borderMuted}; }
        .section-head { text-align: center; margin-bottom: 40px; }
        .section-head h2 { font-size: 32px; font-weight: 600; margin: 12px 0 8px; }
        .section-head p { color: ${COLORS.textMuted}; max-width: 520px; margin: 0 auto; font-size: 16px; }
        .invest-card { background: ${COLORS.card}; border: 1px solid ${COLORS.border}; border-radius: ${COLORS.radius}px; padding: 40px 32px; }
        .invest-display { text-align: center; margin-bottom: 24px; }
        .invest-label { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: ${COLORS.textFaint}; margin-bottom: 10px; }
        .invest-value { font-size: 72px; font-weight: 600; line-height: 1; color: ${COLORS.text}; }
        .slider { width: 100%; margin: 24px 0 8px; accent-color: ${COLORS.sky}; cursor: pointer; }
        .slider-marks { display: flex; justify-content: space-between; font-size: 12px; color: ${COLORS.textFaint}; margin-bottom: 24px; }
        .tier-pill { display: inline-flex; align-items: center; gap: 10px; padding: 10px 20px; background: rgba(56,189,248,0.1); border: 1px solid ${COLORS.borderStrong}; border-radius: 999px; font-size: 16px; font-weight: 500; }
        .tier-pill-icon { font-size: 22px; line-height: 1; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 24px; }
        .stat { background: rgba(15,23,42,0.6); border: 1px solid ${COLORS.borderMuted}; border-radius: 10px; padding: 14px 10px; text-align: center; }
        .stat-accent { background: rgba(56,189,248,0.08); border-color: rgba(56,189,248,0.25); }
        .stat-label { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: ${COLORS.textMuted}; margin-bottom: 6px; }
        .stat-value { font-size: 18px; font-weight: 600; color: ${COLORS.text}; }
        .stat-hint { font-size: 10px; color: ${COLORS.textFaint}; margin-top: 3px; }
        .cta-btn { display: block; width: 100%; padding: 16px 24px; background: ${COLORS.sky}; color: ${COLORS.bgBase}; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.15s; margin-top: 20px; }
        .cta-btn:hover:not(:disabled) { background: ${COLORS.skyHover}; }
        .cta-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cta-note { text-align: center; font-size: 12px; color: ${COLORS.textFaint}; margin-top: 14px; }
        .error-box { margin-top: 16px; padding: 14px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 10px; color: ${COLORS.danger}; font-size: 14px; text-align: center; }
        .tier-ladder { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .tier-card { text-align: left; background: ${COLORS.card}; border: 1px solid ${COLORS.borderMuted}; border-radius: ${COLORS.radius}px; padding: 20px; cursor: pointer; color: inherit; font: inherit; transition: border-color 0.15s; }
        .tier-card:hover { border-color: rgba(148,163,184,0.35); }
        .tier-card-active { background: rgba(56,189,248,0.08); border: 2px solid ${COLORS.sky}; padding: 19px; }
        .tier-card-premium { border-color: rgba(251,191,36,0.25); }
        .tier-card-premium.tier-card-active { border-color: ${COLORS.gold}; background: rgba(251,191,36,0.06); }
        .tier-icon { font-size: 28px; line-height: 1; margin-bottom: 10px; }
        .tier-name { font-size: 18px; font-weight: 600; margin-bottom: 2px; color: ${COLORS.text}; }
        .tier-price { font-size: 20px; font-weight: 600; color: ${COLORS.sky}; margin-bottom: 14px; }
        .tier-card-premium .tier-price { color: ${COLORS.gold}; }
        .tier-rows { display: flex; flex-direction: column; gap: 5px; font-size: 13px; }
        .tier-row { display: flex; justify-content: space-between; }
        .tier-row-label { color: ${COLORS.textMuted}; }
        .tier-row-value { color: ${COLORS.text}; font-weight: 500; }
        .calc-card { background: ${COLORS.card}; border: 1px solid ${COLORS.border}; border-radius: ${COLORS.radius}px; padding: 28px; max-width: 620px; margin: 0 auto; }
        .calc-input-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .calc-euro { font-size: 22px; color: ${COLORS.textMuted}; }
        .calc-input { flex: 1; background: rgba(15,23,42,0.6); border: 1px solid ${COLORS.borderMuted}; border-radius: 10px; padding: 12px 14px; color: ${COLORS.text}; font-size: 20px; font-weight: 600; outline: none; }
        .calc-input:focus { border-color: ${COLORS.sky}; }
        .calc-presets { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .calc-preset { background: rgba(15,23,42,0.6); border: 1px solid ${COLORS.borderMuted}; color: ${COLORS.textMuted}; border-radius: 999px; padding: 6px 14px; font-size: 13px; cursor: pointer; transition: all 0.15s; }
        .calc-preset:hover { border-color: ${COLORS.borderStrong}; color: ${COLORS.text}; }
        .calc-preset-active { background: rgba(56,189,248,0.1); border-color: ${COLORS.sky}; color: ${COLORS.sky}; }
        .calc-results { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .calc-note { text-align: center; font-size: 12px; color: ${COLORS.textFaint}; }
        .faq-list { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
        .faq-item { background: ${COLORS.card}; border: 1px solid ${COLORS.borderMuted}; border-radius: 12px; overflow: hidden; }
        .faq-summary { cursor: pointer; padding: 18px 20px; list-style: none; display: flex; justify-content: space-between; align-items: center; font-weight: 500; }
        .faq-summary::-webkit-details-marker { display: none; }
        .faq-plus { color: ${COLORS.sky}; font-size: 22px; transition: transform 0.15s; flex-shrink: 0; margin-left: 12px; }
        .faq-item[open] .faq-plus { transform: rotate(45deg); }
        .faq-body { padding: 0 20px 18px; color: ${COLORS.textMuted}; line-height: 1.6; font-size: 15px; }
        .final-cta { text-align: center; padding: 64px 20px; }
        .final-cta h2 { font-size: 32px; font-weight: 600; margin-bottom: 14px; }
        .final-cta p { font-size: 18px; color: ${COLORS.textMuted}; margin-bottom: 28px; }
        .final-cta-btn { display: inline-block; padding: 16px 40px; background: ${COLORS.sky}; color: ${COLORS.bgBase}; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .final-cta-btn:hover:not(:disabled) { background: ${COLORS.skyHover}; }
        .final-cta-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .wallet-link { color: ${COLORS.sky}; text-decoration: none; font-size: 14px; }
        .wallet-link:hover { color: ${COLORS.skyHover}; }

        @media (min-width: 560px) {
          .stats-grid { grid-template-columns: repeat(5, 1fr); }
        }
        @media (min-width: 640px) {
          .tier-ladder { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 900px) {
          .tier-ladder { grid-template-columns: repeat(4, 1fr); }
        }
        @media (min-width: 1100px) {
          .tier-ladder { grid-template-columns: repeat(7, 1fr); gap: 10px; }
          .tier-card { padding: 16px 14px; }
          .tier-card-active { padding: 15px 13px; }
          .tier-icon { font-size: 24px; margin-bottom: 8px; }
          .tier-name { font-size: 16px; }
          .tier-price { font-size: 18px; margin-bottom: 10px; }
          .tier-rows { font-size: 12px; gap: 4px; }
        }
        @media (max-width: 640px) {
          .founder-hero { padding: 56px 20px 32px; }
          .founder-hero h1 { font-size: 36px; }
          .founder-hero p { font-size: 16px; }
          .invest-value { font-size: 56px; }
          .invest-card { padding: 28px 20px; }
          .section { padding: 44px 16px; }
          .section-head h2 { font-size: 26px; }
          .final-cta h2 { font-size: 26px; }
          .calc-results { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* HERO */}
      <section className="founder-hero">
        <div className="pretitle">✦ Founder investment</div>
        <h1>
          Invest once.
          <br />
          <span className="accent">Save forever.</span>
        </h1>
        <p>
          Pay once, keep lower fees for life. From €99 to €5,000 — every tier pays back in months, not years. Then keeps paying forever.
        </p>
        <div className="checks">
          <span className="check-item"><span className="check-mark">✓</span> One-time payment</span>
          <span className="check-item"><span className="check-mark">✓</span> Lower fees for life</span>
          <span className="check-item"><span className="check-mark">✓</span> 30% discount on AI Credits</span>
          <span className="check-item"><span className="check-mark">✓</span> 14-day refund</span>
        </div>
      </section>

      {/* EARLY INVESTOR ROI — moved to top as primary hook */}
      <section className="section" style={{ borderTop: `1px solid ${'rgba(148,163,184,0.15)'}` }}>
        <div className="founder-container">
          <div className="section-head">
            <div className="pretitle">✦ First 100 investors</div>
            <h2>Invest early. <span style={{ color: '#38bdf8' }}>Get more.</span></h2>
            <p>The first 100 FreeTrust investors — at any tier — unlock permanent benefits that new members will never get, even if they pay more later.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginBottom: 28 }}>
            <div className="invest-card" style={{ padding: 28 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
                <div style={{ fontSize: 36, lineHeight: 1 }}>🏅</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: '#f1f5f9' }}>Permanent &quot;Founding Investor&quot; badge</div>
                  <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>Appears on your profile forever. Unmissable social proof that you believed in FreeTrust before anyone else.</div>
                </div>
              </div>
            </div>

            <div className="invest-card" style={{ padding: 28 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
                <div style={{ fontSize: 36, lineHeight: 1 }}>🔒</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: '#f1f5f9' }}>Fee + Credit rates locked forever</div>
                  <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>If we ever restructure tiers or raise prices, your original rates stay. The first 100 are immune to tier changes.</div>
                </div>
              </div>
            </div>

            <div className="invest-card" style={{ padding: 28 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
                <div style={{ fontSize: 36, lineHeight: 1 }}>🚀</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: '#f1f5f9' }}>Priority access to every new feature</div>
                  <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>New AI agents, marketplace features, organisation tools — first 100 get access weeks before anyone else. Every time.</div>
                </div>
              </div>
            </div>

            <div className="invest-card" style={{ padding: 28 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
                <div style={{ fontSize: 36, lineHeight: 1 }}>🗳</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: '#f1f5f9' }}>Governance vote weight</div>
                  <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>When FreeTrust introduces member-owned governance, first-100 investors get 2× vote weight on platform decisions, for life.</div>
                </div>
              </div>
            </div>

            <div className="invest-card" style={{ padding: 28 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
                <div style={{ fontSize: 36, lineHeight: 1 }}>🎟</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: '#f1f5f9' }}>Founding Investor annual event</div>
                  <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>Exclusive in-person gathering — Ireland, first year; rotates globally. Meet the founder, shape the roadmap, meet other founding investors.</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: 20, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 14 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Early-investor spots remaining</div>
            <div style={{ fontSize: 32, fontWeight: 600, color: '#38bdf8' }}>— / 100</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Applies at every tier from Seed (€99) to Legacy (€5,000)</div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE SCALE */}
      <section style={{ padding: '0 20px 48px' }}>
        <div className="founder-container" style={{ maxWidth: 820 }}>
          <div className="invest-card">
            <div className="invest-display">
              <div className="invest-label">Your investment</div>
              <div className="invest-value">€{amount.toLocaleString()}</div>
            </div>

            <input
              className="slider"
              type="range"
              min={MIN_INVESTMENT_EUR}
              max={MAX_INVESTMENT_EUR}
              step={1}
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value, 10))}
              aria-label="Investment amount"
            />
            <div className="slider-marks">
              <span>€{MIN_INVESTMENT_EUR}</span>
              <span>€{MAX_INVESTMENT_EUR.toLocaleString()}</span>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span className="tier-pill">
                <span className="tier-pill-icon">{tier.icon}</span>
                <span>{tier.displayName} tier</span>
              </span>
            </div>

            <div className="stats-grid">
              <div className="stat stat-accent">
                <div className="stat-label">Service fee</div>
                <div className="stat-value">{tier.serviceFeePercent}%</div>
                <div className="stat-hint">was {STANDARD_SERVICE_FEE_PERCENT}%</div>
              </div>
              <div className="stat stat-accent">
                <div className="stat-label">Product fee</div>
                <div className="stat-value">{tier.productFeePercent}%</div>
                <div className="stat-hint">was {STANDARD_PRODUCT_FEE_PERCENT}%</div>
              </div>
              <div className="stat">
                <div className="stat-label">AI Credits</div>
                <div className="stat-value">+{tier.aiCreditsBonus.toLocaleString()}</div>
                <div className="stat-hint">one-time</div>
              </div>
              <div className="stat">
                <div className="stat-label">₮ bonus</div>
                <div className="stat-value">+{tier.trustBonus.toLocaleString()}</div>
                <div className="stat-hint">one-time</div>
              </div>
              <div className="stat stat-accent">
                <div className="stat-label">Top-up discount</div>
                <div className="stat-value">–30%</div>
                <div className="stat-hint">permanent</div>
              </div>
            </div>
          </div>

          <button type="button" className="cta-btn" onClick={handlePurchase} disabled={loading}>
            {loading ? 'Redirecting to Stripe…' : `Become a ${tier.displayName} founder — €${tier.priceEur.toLocaleString()}`}
          </button>
          {error && <div className="error-box">{error}</div>}
          <div className="cta-note">Secure payment by Stripe · 14-day refund if fewer than 50 AI Credits spent</div>
        </div>
      </section>

      {/* TIER LADDER */}
      <section className="section">
        <div className="founder-container">
          <div className="section-head">
            <div className="pretitle">✦ Choose your tier</div>
            <h2>Seven tiers. One community.</h2>
            <p>From a no-brainer €99 entry to the €5,000 Legacy tier with lifetime 0.25% fees. Every tier is ROI-positive.</p>
          </div>
          <div className="tier-ladder">
            {FOUNDER_TIERS.map((t) => {
              const isActive = t.key === tier.key;
              const isPremium = t.key === 'summit' || t.key === 'legacy';
              const classes = [
                'tier-card',
                isActive ? 'tier-card-active' : '',
                isPremium ? 'tier-card-premium' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={t.key}
                  type="button"
                  className={classes}
                  onClick={() => setAmount(t.priceEur)}
                >
                  <div className="tier-icon">{t.icon}</div>
                  <div className="tier-name">{t.displayName}</div>
                  <div className="tier-price">€{t.priceEur.toLocaleString()}</div>
                  <div className="tier-rows">
                    <div className="tier-row"><span className="tier-row-label">Service</span><span className="tier-row-value">{t.serviceFeePercent}%</span></div>
                    <div className="tier-row"><span className="tier-row-label">Product</span><span className="tier-row-value">{t.productFeePercent}%</span></div>
                    <div className="tier-row"><span className="tier-row-label">Credits</span><span className="tier-row-value">+{t.aiCreditsBonus.toLocaleString()}</span></div>
                    <div className="tier-row"><span className="tier-row-label">₮</span><span className="tier-row-value">+{t.trustBonus.toLocaleString()}</span></div>
                    <div className="tier-row"><span className="tier-row-label">Top-up</span><span className="tier-row-value">–30%</span></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* SAVINGS CALCULATOR */}
      <section className="section">
        <div className="founder-container">
          <div className="section-head">
            <div className="pretitle">✦ Calculate your ROI</div>
            <h2>See your savings</h2>
            <p>Enter your expected annual sales to see how fast you break even — and what you save over five years.</p>
          </div>
          <div className="calc-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 10, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{tier.icon}</span>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#94a3b8' }}>Calculating for</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{tier.displayName} tier · €{tier.priceEur.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right' }}>
                {tier.serviceFeePercent}% / {tier.productFeePercent}%<br/>fees
              </div>
            </div>
            <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 10 }}>Expected annual sales</div>
            <div className="calc-input-row">
              <span className="calc-euro">€</span>
              <input
                className="calc-input"
                type="number"
                min={0}
                step={500}
                value={annualRevenue}
                onChange={(e) => setAnnualRevenue(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </div>
            <div className="calc-presets">
              {PRESET_SALES.map((preset) => {
                const isActive = preset.value === annualRevenue;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    className={`calc-preset ${isActive ? 'calc-preset-active' : ''}`}
                    onClick={() => setAnnualRevenue(preset.value)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="calc-results">
              <div className="stat stat-accent">
                <div className="stat-label">Annual savings</div>
                <div className="stat-value">€{Math.round(annualSavings).toLocaleString()}</div>
                <div className="stat-hint">vs 8% / 5% standard</div>
              </div>
              <div className="stat">
                <div className="stat-label">Break-even</div>
                <div className="stat-value">{breakEvenLabel}</div>
                <div className="stat-hint">€{tier.priceEur.toLocaleString()} paid back</div>
              </div>
              <div className="stat stat-accent">
                <div className="stat-label">5-year net gain</div>
                <div className="stat-value">€{Math.round(fiveYearSavings).toLocaleString()}</div>
                <div className="stat-hint">after investment</div>
              </div>
            </div>
            <div className="calc-note">Assumes a 60/40 mix of service and product sales.</div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="founder-container">
          <div className="section-head">
            <div className="pretitle">✦ Frequently asked</div>
            <h2>Common questions</h2>
          </div>
          <div className="faq-list">
            <FaqItem q="Is this a subscription?" a="No. One-time payment, lifetime benefits. Pay once and keep lower fees, a permanent 30% discount on AI Credit top-ups, and your TrustCoin bonus forever." />
            <FaqItem q="Can I upgrade later?" a="Yes. Pay the difference between your current tier and the new one, and your benefits upgrade immediately. No double-paying." />
            <FaqItem q="Which tier should I pick?" a="Seed (€99) if you're just starting. Tree (€499) if you sell €10k-€50k/year. Forest (€1,999) for €50k-€200k/year. Summit or Legacy if FreeTrust is your primary income channel." />
            <FaqItem q="What does the Legacy tier get me that Summit doesn't?" a="Nearly zero fees forever (0.25% / 0%), 20,000 starting AI Credits, 5,000 ₮ bonus, and a permanent 30% discount on all future AI Credit top-ups. It's priced for people who've decided FreeTrust is their business." />
            <FaqItem q="Does this stack with free Founding Member perks?" a="Yes. Free Founding Member perks are additive to any paid tier — you keep the badge and the 3-month zero fees." />
            <FaqItem q="What happens if I go inactive?" a="Your fee tier and 30% top-up discount never expire, even if you go inactive. Return any time and your rates are still locked. Fee tier never expires." />
            <FaqItem q="Are refunds available?" a="Full refund within 14 days of purchase if fewer than 50 AI Credits have been spent. After that, non-refundable." />
            <FaqItem q="Will my founder fees stay low forever?" a="Yes. Your tier rate is locked for life. Future fee reductions apply to you too — but your rate is never raised." />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta" style={{ borderTop: `1px solid ${COLORS.borderMuted}` }}>
        <div className="founder-container">
          <h2>Ready to invest in FreeTrust?</h2>
          <p>
            Currently viewing the <span style={{ color: COLORS.sky, fontWeight: 500 }}>{tier.displayName}</span> tier at{' '}
            <span style={{ color: COLORS.text, fontWeight: 500 }}>€{tier.priceEur.toLocaleString()}</span>.
          </p>
          <button type="button" className="final-cta-btn" onClick={handlePurchase} disabled={loading}>
            {loading ? 'Redirecting…' : `Become a ${tier.displayName} founder →`}
          </button>
          <div style={{ marginTop: 24 }}>
            <Link href="/wallet" className="wallet-link">See your wallet →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="faq-item">
      <summary className="faq-summary">
        <span>{q}</span>
        <span className="faq-plus">+</span>
      </summary>
      <div className="faq-body">{a}</div>
    </details>
  );
}
