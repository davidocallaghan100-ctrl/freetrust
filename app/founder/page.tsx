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
  type FounderTier,
} from '@/lib/founder/tiers';

export default function FounderPage() {
  const [amount, setAmount] = useState<number>(499);
  const [annualRevenue, setAnnualRevenue] = useState<number>(10000);
  const [loadingPurchase, setLoadingPurchase] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeTier: FounderTier = useMemo(() => getTierByAmount(amount), [amount]);

  const annualSavings = useMemo(
    () => calculateAnnualSavings(activeTier, annualRevenue),
    [activeTier, annualRevenue]
  );

  const breakEvenMonths = useMemo(
    () => calculateBreakEvenMonths(activeTier, annualRevenue),
    [activeTier, annualRevenue]
  );

  const breakEvenDisplay = useMemo(() => {
    if (!Number.isFinite(breakEvenMonths)) return 'N/A';
    if (breakEvenMonths > 60) return '>5 years';
    return `${breakEvenMonths} months`;
  }, [breakEvenMonths]);

  async function handlePurchase(tierAmount: number) {
    setLoadingPurchase(true);
    setError(null);

    try {
      const res = await fetch('/api/founder/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountEur: tierAmount }),
      });

      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ error: 'Checkout is not yet available.' }));
        throw new Error(body.error ?? 'Checkout failed.');
      }

      const { url } = await res.json();
      if (!url) throw new Error('No checkout URL returned.');
      window.location.href = url;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Checkout is not yet available. Please check back shortly.';
      setError(message);
      setLoadingPurchase(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="text-xs tracking-widest text-sky-400 mb-2">
            FOUNDER INVESTMENT
          </div>
          <h1 className="text-3xl md:text-4xl font-medium text-white mb-3">
            Invest once. Save forever.
          </h1>
          <p className="text-slate-300 max-w-2xl mx-auto">
            One-time investment. AI Credit grant. ₮ TrustCoin bonus. Lower
            transaction fees for life. Monthly AI Credit refill that never
            stops. No recurring charges, ever.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/40 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Interactive scale */}
        <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <label
              htmlFor="amount"
              className="text-sm text-slate-400 min-w-[100px]"
            >
              Your investment
            </label>
            <input
              id="amount"
              type="range"
              min={MIN_INVESTMENT_EUR}
              max={MAX_INVESTMENT_EUR}
              step={1}
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value, 10))}
              className="flex-1 accent-sky-400"
            />
            <span className="text-xl font-medium text-white min-w-[80px] text-right">
              €{amount.toLocaleString()}
            </span>
          </div>

          <div className="text-center my-4">
            <div className="text-2xl font-medium text-white">
              <span className="mr-2">{activeTier.icon}</span>
              {activeTier.displayName}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <StatCard
              label="Service fee"
              value={`${activeTier.serviceFeePercent}%`}
              hint={`was ${STANDARD_SERVICE_FEE_PERCENT}%`}
            />
            <StatCard
              label="Product fee"
              value={`${activeTier.productFeePercent}%`}
              hint={`was ${STANDARD_PRODUCT_FEE_PERCENT}%`}
            />
            <StatCard
              label="AI Credits"
              value={`+${activeTier.aiCreditsBonus.toLocaleString()}`}
              hint="one-time"
            />
            <StatCard
              label="₮ bonus"
              value={`+${activeTier.trustBonus.toLocaleString()}`}
              hint="one-time"
            />
            <StatCard
              label="Monthly refill"
              value={`+${activeTier.monthlyAiCreditRefill}/mo`}
              hint="for life"
            />
          </div>
        </div>

        {/* Savings calculator */}
        <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 mb-8">
          <div className="text-sm font-medium text-white mb-3">
            Lifetime savings calculator
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label
              htmlFor="revenue"
              className="text-sm text-slate-400 min-w-[100px]"
            >
              Annual sales
            </label>
            <input
              id="revenue"
              type="number"
              min={0}
              step={500}
              value={annualRevenue}
              onChange={(e) =>
                setAnnualRevenue(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm w-32 focus:outline-none focus:border-sky-400"
            />
            <span className="text-sm text-slate-400">EUR</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Annual fee savings"
              value={`€${Math.round(annualSavings).toLocaleString()}`}
            />
            <StatCard label="Break-even" value={breakEvenDisplay} />
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {FOUNDER_TIERS.map((tier) => {
            const isActive = tier.key === activeTier.key;
            return (
              <button
                key={tier.key}
                type="button"
                onClick={() => setAmount(tier.priceEur)}
                className={`text-center rounded-xl p-4 transition ${
                  isActive
                    ? 'bg-slate-900 border-2 border-sky-400'
                    : 'bg-slate-900/60 border border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="text-2xl mb-1">{tier.icon}</div>
                <div className="text-sm font-medium text-white">
                  {tier.displayName}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  €{tier.priceEur}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {tier.serviceFeePercent}% / {tier.productFeePercent}%
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => handlePurchase(activeTier.priceEur)}
          disabled={loadingPurchase}
          className="w-full py-4 bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingPurchase
            ? 'Redirecting to Stripe…'
            : `Become a ${activeTier.displayName} founder — €${activeTier.priceEur}`}
        </button>

        {/* FAQ */}
        <div className="mt-12 space-y-4">
          <h2 className="text-xl font-medium text-white mb-4">
            Common questions
          </h2>
          <FaqItem
            q="Is this a subscription?"
            a="No. It is a one-time payment for lifetime benefits. Pay once, get lower fees, AI Credits, TrustCoins, and monthly refills for as long as your account is active."
          />
          <FaqItem
            q="Can I upgrade my tier later?"
            a="Yes. Pay the difference between your current tier and the new one, and your benefits upgrade immediately."
          />
          <FaqItem
            q="What happens to my AI Credit refills if I stop using the platform?"
            a="Refills accrue monthly while your account is active. If you come back after a break, your balance picks up where it left off."
          />
          <FaqItem
            q="Are there refunds?"
            a="Within 14 days of purchase if you have not spent more than 50 of your granted AI Credits, full refund. After that, founder tier is non-refundable."
          />
        </div>

        <div className="mt-8 text-center text-sm text-slate-400">
          Secure payment by Stripe ·{' '}
          <Link href="/wallet" className="text-sky-400 hover:text-sky-300">
            See your wallet
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="text-lg font-medium text-white mt-1">{value}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
      <summary className="cursor-pointer text-white font-medium text-sm">
        {q}
      </summary>
      <p className="mt-2 text-sm text-slate-300 leading-relaxed">{a}</p>
    </details>
  );
}
