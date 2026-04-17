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
} from '@/lib/founder/tiers';

export default function FounderPage() {
  const [amount, setAmount] = useState<number>(499);
  const [annualRevenue, setAnnualRevenue] = useState<number>(10000);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const tier = useMemo(() => getTierByAmount(amount), [amount]);
  const savings = useMemo(
    () => calculateAnnualSavings(tier, annualRevenue),
    [tier, annualRevenue]
  );
  const breakEven = useMemo(
    () => calculateBreakEvenMonths(tier, annualRevenue),
    [tier, annualRevenue]
  );

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
      const message =
        err instanceof Error
          ? err.message
          : 'Checkout is coming soon.';
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      {/* HERO */}
      <section className="px-4 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs tracking-[0.25em] text-sky-400 font-medium mb-4">
            ✦ FOUNDER INVESTMENT
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold leading-tight mb-5">
            Invest once.<br />
            <span className="text-sky-400">Save forever.</span>
          </h1>
          <p className="text-slate-300 text-base md:text-xl max-w-2xl mx-auto leading-relaxed mb-8">
            A one-time investment unlocks lifetime lower fees, an AI Credit grant, a TrustCoin bonus, and a monthly Credit refill that never stops.
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> One-time payment</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Lower fees for life</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Monthly refills</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> 14-day refund</span>
          </div>
        </div>
      </section>

      {/* INTERACTIVE SCALE */}
      <section className="px-4 pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-10">
            <div className="text-center mb-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-3">
                Your investment
              </div>
              <div className="text-5xl md:text-7xl font-semibold text-white leading-none">
                €{amount.toLocaleString()}
              </div>
            </div>

            <div className="mb-8">
              <input
                type="range"
                min={MIN_INVESTMENT_EUR}
                max={MAX_INVESTMENT_EUR}
                step={1}
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value, 10))}
                className="w-full accent-sky-400 h-2 cursor-pointer"
                aria-label="Investment amount"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>€{MIN_INVESTMENT_EUR}</span>
                <span>€{MAX_INVESTMENT_EUR}</span>
              </div>
            </div>

            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-sky-400/10 border border-sky-400/30 rounded-full">
                <span className="text-2xl leading-none">{tier.icon}</span>
                <span className="text-lg font-medium text-white">{tier.displayName} tier</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <StatBox label="Service fee" value={`${tier.serviceFeePercent}%`} hint={`was ${STANDARD_SERVICE_FEE_PERCENT}%`} accent />
              <StatBox label="Product fee" value={`${tier.productFeePercent}%`} hint={`was ${STANDARD_PRODUCT_FEE_PERCENT}%`} accent />
              <StatBox label="AI Credits" value={`+${tier.aiCreditsBonus.toLocaleString()}`} hint="one-time" />
              <StatBox label="₮ bonus" value={`+${tier.trustBonus.toLocaleString()}`} hint="one-time" />
              <StatBox label="Monthly refill" value={`+${tier.monthlyAiCreditRefill}`} hint="for life" />
            </div>
          </div>

          <button
            type="button"
            onClick={handlePurchase}
            disabled={loading}
            className="w-full mt-6 py-4 bg-sky-400 hover:bg-sky-300 active:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold text-base md:text-lg rounded-xl transition"
          >
            {loading
              ? 'Redirecting to Stripe…'
              : `Become a ${tier.displayName} founder — €${tier.priceEur}`}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-500 text-center mt-4">
            Secure payment by Stripe. 14-day refund if you have spent fewer than 50 AI Credits.
          </p>
        </div>
      </section>

      {/* TIER LADDER */}
      <section className="px-4 py-16 border-t border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs tracking-[0.25em] text-sky-400 font-medium mb-3">
              ✦ CHOOSE YOUR TIER
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold mb-3">
              Five tiers. One community.
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Every tier includes lifetime lower fees, a starting boost, and a monthly refill. The bigger the investment, the faster you break even.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {FOUNDER_TIERS.map((t) => {
              const isActive = t.key === tier.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setAmount(t.priceEur)}
                  className={`text-left rounded-2xl p-5 transition ${
                    isActive
                      ? 'bg-sky-400/10 border-2 border-sky-400'
                      : 'bg-slate-900/40 border border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="text-3xl mb-3 leading-none">{t.icon}</div>
                  <div className="text-xl font-semibold text-white mb-1">{t.displayName}</div>
                  <div className="text-2xl font-semibold text-sky-400 mb-4">€{t.priceEur}</div>

                  <div className="space-y-2 text-sm">
                    <Row label="Service fee" value={`${t.serviceFeePercent}%`} />
                    <Row label="Product fee" value={`${t.productFeePercent}%`} />
                    <Row label="AI Credits" value={`+${t.aiCreditsBonus.toLocaleString()}`} />
                    <Row label="₮ bonus" value={`+${t.trustBonus.toLocaleString()}`} />
                    <Row label="Refill" value={`+${t.monthlyAiCreditRefill}/mo`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* SAVINGS CALCULATOR */}
      <section className="px-4 py-16 border-t border-slate-800">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-xs tracking-[0.25em] text-sky-400 font-medium mb-3">
              ✦ CALCULATE YOUR ROI
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold mb-3">See your savings</h2>
            <p className="text-slate-400">
              Enter your expected annual sales on FreeTrust to see your break-even.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 md:p-8">
            <label htmlFor="revenue" className="block text-sm text-slate-400 mb-3">
              Expected annual sales
            </label>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl text-slate-400">€</span>
              <input
                id="revenue"
                type="number"
                min={0}
                step={500}
                value={annualRevenue}
                onChange={(e) =>
                  setAnnualRevenue(Math.max(0, parseInt(e.target.value, 10) || 0))
                }
                className="flex-1 bg-slate-800 border border-slate-700 focus:border-sky-400 rounded-lg px-4 py-3 text-white text-xl font-semibold outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatBox
                label={`Annual savings`}
                value={`€${Math.round(savings).toLocaleString()}`}
                hint={`vs 8% / 5% standard`}
                accent
              />
              <StatBox
                label="Break-even"
                value={breakEvenLabel}
                hint={`€${tier.priceEur} paid back`}
              />
            </div>

            <p className="text-xs text-slate-500 text-center">
              Assumes a 60/40 mix of service and product sales.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-16 border-t border-slate-800">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs tracking-[0.25em] text-sky-400 font-medium mb-3">
              ✦ FREQUENTLY ASKED
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold">Common questions</h2>
          </div>

          <div className="space-y-3">
            <FaqItem
              q="Is this a subscription?"
              a="No. One-time payment, lifetime benefits. You pay once and keep the lower fees, monthly refills, and TrustCoin bonus forever."
            />
            <FaqItem
              q="Can I upgrade later?"
              a="Yes. Pay the difference between your current tier and the new one, and your benefits upgrade immediately. No double-paying."
            />
            <FaqItem
              q="I am already a free Founding Member. Does this stack?"
              a="Yes. Your free Founding Member perks (badge, zero fees for 3 months, Trust bonuses) stack on top of any paid tier. They are additive, not exclusive."
            />
            <FaqItem
              q="What happens to monthly refills if I go inactive?"
              a="Refills accrue monthly while your account is active. Come back after a break and your balance is waiting."
            />
            <FaqItem
              q="Are refunds available?"
              a="Full refund within 14 days of purchase if you have spent fewer than 50 of your granted AI Credits. After that, founder tier is non-refundable."
            />
            <FaqItem
              q="Will my founder fees stay low forever?"
              a="Yes. Your tier rate is locked to your account for life. We may reduce fees for everyone in future, but your founder rate is never raised."
            />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 py-20 border-t border-slate-800 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Ready to invest in FreeTrust?
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            Currently on the <span className="text-sky-400 font-medium">{tier.displayName}</span> tier at <span className="text-white font-medium">€{tier.priceEur}</span>.
          </p>
          <button
            type="button"
            onClick={handlePurchase}
            disabled={loading}
            className="inline-block px-10 py-4 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 font-semibold text-base md:text-lg rounded-xl transition"
          >
            {loading ? 'Redirecting…' : `Become a ${tier.displayName} founder →`}
          </button>
          <div className="mt-6">
            <Link href="/wallet" className="text-sky-400 hover:text-sky-300 text-sm">
              See your wallet →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatBox({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 text-center ${
        accent
          ? 'bg-sky-400/10 border border-sky-400/20'
          : 'bg-slate-800/60'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </div>
      <div className="text-base md:text-lg font-semibold text-white leading-tight">
        {value}
      </div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
      <summary className="cursor-pointer list-none p-5 flex justify-between items-center hover:bg-slate-900/60 transition">
        <span className="font-medium text-white pr-4">{q}</span>
        <span className="text-sky-400 text-xl transition-transform group-open:rotate-45 shrink-0">
          +
        </span>
      </summary>
      <div className="px-5 pb-5 text-slate-300 leading-relaxed">{a}</div>
    </details>
  );
}
