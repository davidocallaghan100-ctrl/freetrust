"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronDownIcon,
  XMarkIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserGroupIcon,
  CurrencyEuroIcon,
  ChartBarIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tier = {
  id: string;
  name: string;
  amount: string;
  amountNum: number;
  equity: string;
  badge: string;
  color: string;
  border: string;
  glow: string;
  perks: string[];
  popular?: boolean;
};

type Investor = {
  name: string;
  role: string;
  avatar: string;
  amount: string;
};

type FaqItem = {
  q: string;
  a: string;
};

type FormData = {
  name: string;
  email: string;
  tier: string;
  amount: string;
  message: string;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TIERS: Tier[] = [
  {
    id: "explorer",
    name: "Explorer",
    amount: "€500",
    amountNum: 500,
    equity: "0.01%",
    badge: "🔭",
    color: "from-sky-400/20 to-sky-600/10",
    border: "border-sky-500/30",
    glow: "hover:shadow-sky-500/20",
    perks: [
      "0.01% equity stake",
      "Early access to FreeTrust platform",
      "Investor newsletter & updates",
      "Explorer badge on profile",
      "Community Discord access",
    ],
  },
  {
    id: "builder",
    name: "Builder",
    amount: "€2,500",
    amountNum: 2500,
    equity: "0.05%",
    badge: "🏗️",
    color: "from-indigo-400/20 to-indigo-600/10",
    border: "border-indigo-500/30",
    glow: "hover:shadow-indigo-500/20",
    perks: [
      "0.05% equity stake",
      "All Explorer perks",
      "Quarterly investor calls",
      "Co-founder introductions",
      "Beta feature access",
      "Name in credits",
    ],
    popular: true,
  },
  {
    id: "pioneer",
    name: "Pioneer",
    amount: "€10,000",
    amountNum: 10000,
    equity: "0.25%",
    badge: "🚀",
    color: "from-violet-400/20 to-violet-600/10",
    border: "border-violet-500/30",
    glow: "hover:shadow-violet-500/20",
    perks: [
      "0.25% equity stake",
      "All Builder perks",
      "Monthly 1-on-1 with founders",
      "Advisory board invitation",
      "Logo on investor page",
      "Revenue share eligibility",
      "Priority support SLA",
    ],
  },
  {
    id: "visionary",
    name: "Visionary",
    amount: "€25,000+",
    amountNum: 25000,
    equity: "1%+",
    badge: "💎",
    color: "from-amber-400/20 to-amber-600/10",
    border: "border-amber-500/30",
    glow: "hover:shadow-amber-500/20",
    perks: [
      "1%+ equity (negotiable)",
      "All Pioneer perks",
      "Board observer seat",
      "Direct deal flow access",
      "Custom due diligence pack",
      "Co-investment rights",
      "Dedicated relationship manager",
      "Governance voting rights",
    ],
  },
];

const INVESTORS: Investor[] = [
  { name: "Sarah M.", role: "Angel Investor, Berlin", avatar: "SM", amount: "€10,000" },
  { name: "David K.", role: "Seed Fund Partner, Dublin", avatar: "DK", amount: "€25,000" },
  { name: "Priya R.", role: "Tech Entrepreneur, London", avatar: "PR", amount: "€2,500" },
  { name: "Marco F.", role: "VC Associate, Amsterdam", avatar: "MF", amount: "€10,000" },
  { name: "Lena B.", role: "Impact Investor, Vienna", avatar: "LB", amount: "€5,000" },
  { name: "James T.", role: "Startup Founder, Dublin", avatar: "JT", amount: "€500" },
];

const FAQS: FaqItem[] = [
  {
    q: "What type of equity is being offered?",
    a: "We are offering SAFE (Simple Agreement for Future Equity) notes in this seed round. SAFEs convert to equity at a future priced round, giving you downside protection and upside participation. Full legal documentation is provided upon expression of interest.",
  },
  {
    q: "Is there a minimum investment?",
    a: "Our minimum investment is €500 (Explorer tier). We've structured it this way to allow a broad community of supporters to participate in FreeTrust's growth, not just institutional investors.",
  },
  {
    q: "How is the €500K seed round structured?",
    a: "The round is structured as a SAFE with a €5M valuation cap and a 20% discount. The round will close once fully subscribed or by our target date. Funds will be used for product development, regulatory compliance, and go-to-market.",
  },
  {
    q: "When will I see a return on my investment?",
    a: "FreeTrust is targeting a Series A within 18–24 months, at which point SAFEs will convert. We are also exploring revenue-share mechanics for certain tiers. Investment timelines vary; this is a high-risk, high-reward early-stage opportunity.",
  },
  {
    q: "Is this investment regulated?",
    a: "FreeTrust is in the process of obtaining relevant regulatory approvals for crowdfunding under EU Regulation 2020/1503. All investments are subject to applicable laws in your jurisdiction. We recommend consulting a financial advisor before investing.",
  },
  {
    q: "What happens if the round doesn't close?",
    a: "If the round does not reach its minimum threshold, all committed funds are returned in full. We believe strongly in transparency — it's in our name. You will be kept informed at every stage.",
  },
];

const TOTAL_TARGET = 500000;
const TOTAL_RAISED = 312000;
const TOTAL_INVESTORS_COUNT = 47;

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnimatedCounter({ target, prefix = "", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  const formatted =
    target >= 1000
      ? count.toLocaleString("en-IE")
      : count.toString();

  return (
    <span ref={ref}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

function ProgressBar({ percentage }: { percentage: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(percentage), 400);
    return () => clearTimeout(t);
  }, [percentage]);

  return (
    <div className="relative w-full h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-500 transition-all duration-[2000ms] ease-out relative"
        style={{ width: `${width}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
      </div>
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-indigo-400 shadow-lg shadow-indigo-500/50 transition-all duration-[2000ms] ease-out"
        style={{ left: `${Math.min(width, 96)}%` }}
      />
    </div>
  );
}

function TierCard({ tier, onSelect }: { tier: Tier; onSelect: (t: Tier) => void }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border ${tier.border} bg-gradient-to-br ${tier.color} backdrop-blur-sm p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${tier.glow} ${
        tier.popular ? "ring-2 ring-indigo-500/60" : ""
      }`}
    >
      {tier.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 text-xs font-bold text-white shadow-lg">
          Most Popular
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{tier.badge}</span>
        <div>
          <h3 className="text-xl font-bold text-white">{tier.name}</h3>
          <p className="text-sm text-white/50">Tier</p>
        </div>
      </div>

      <div className="mb-4">
        <span className="text-4xl font-black text-white">{tier.amount}</span>
        <span className="ml-2 text-sm text-white/50">minimum</span>
      </div>

      <div className="mb-6 px-3 py-2 rounded-lg bg-white/5 border border-white/10 inline-flex items-center gap-2">
        <SparklesIcon className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-amber-300">{tier.equity} equity</span>
      </div>

      <ul className="flex-1 space-y-2 mb-6">
        {tier.perks.map((perk, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-white/70">
            <CheckCircleIcon className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
            {perk}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(tier)}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
          tier.popular
            ? "bg-gradient-to-r from-indigo-500 to-sky-500 text-white hover:from-indigo-400 hover:to-sky-400 shadow-lg shadow-indigo-500/30"
            : "bg-white/10 text-white hover:bg-white/20 border border-white/20"
        }`}
      >
        Register Interest →
      </button>
    </div>
  );
}

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
        >
          <button
            className="w-full flex items-center justify-between p-5 text-left"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="font-semibold text-white text-sm pr-4">{item.q}</span>
            <ChevronDownIcon
              className={`w-5 h-5 text-sky-400 shrink-0 transition-transform duration-300 ${
                open === i ? "rotate-180" : ""
              }`}
            />
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ${
              open === i ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <p className="px-5 pb-5 text-sm text-white/60 leading-relaxed">{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Modal({
  open,
  onClose,
  defaultTier,
}: {
  open: boolean;
  onClose: () => void;
  defaultTier: Tier | null;
}) {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    tier: defaultTier?.id ?? "explorer",
    amount: defaultTier?.amount ?? "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (defaultTier) {
      setForm((f) => ({ ...f, tier: defaultTier.id, amount: defaultTier.amountNum.toString() }));
    }
  }, [defaultTier]);

  useEffect(() => {
    if (open) {
      setSuccess(false);
      setError("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/invest/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message ?? "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Register Your Interest</h2>
            <p className="text-sm text-white/50 mt-0.5">Join {TOTAL_INVESTORS_COUNT}+ investors backing FreeTrust</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <XMarkIcon className="w-4 h-4 text-white" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-sky-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-8 h-8 text-sky-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">You're on the list!</h3>
            <p className="text-white/60 text-sm mb-6">
              We'll be in touch within 48 hours with next steps and legal documentation.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold text-sm hover:from-sky-400 hover:to-indigo-400 transition-all"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-sky-500/60 focus:bg-white/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-sky-500/60 focus:bg-white/10 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-white/60 mb-1.5 block">Investment Tier</label>
              <select
                value={form.tier}
                onChange={(e) => {
                  const t = TIERS.find((x) => x.id === e.target.value);
                  setForm({ ...form, tier: e.target.value, amount: t?.amountNum.toString() ?? "" });
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/60 transition-all appearance-none"
              >
                {TIERS.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#0f172a]">
                    {t.badge} {t.name} — {t.amount}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-white/60 mb-1.5 block">Amount Interested (€)</label>
              <input
                type="number"
                min="500"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="500"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-sky-500/60 focus:bg-white/10 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-white/60 mb-1.5 block">Message (optional)</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tell us about your background or questions..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-sky-500/60 focus:bg-white/10 transition-all resize-none"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <p className="text-xs text-white/30 leading-relaxed">
              By submitting you agree this is an expression of interest only, not a binding commitment. Investment is subject to legal documentation and regulatory compliance.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold text-sm hover:from-sky-400 hover:to-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  Submit Interest
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InvestPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);

  const pct = Math.round((TOTAL_RAISED / TOTAL_TARGET) * 100);

  const openModal = (tier?: Tier) => {
    setSelectedTier(tier ?? null);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="pt-24 pb-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold mb-8 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              Seed Round Open — €500K
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight mb-6">
              Invest in the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400">
                Trust Economy
              </span>
            </h1>

            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
              FreeTrust is redefining social commerce with trust-first infrastructure.
              Join our seed round and own a piece of the future of verified online trade.
            </p>

            {/* Funding progress */}
            <div className="max-w-2xl mx-auto bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-10">
              <div className="flex justify-between items-end mb-3">
                <div className="text-left">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Raised</p>
                  <p className="text-3xl font-black text-white">
                    <AnimatedCounter target={TOTAL_RAISED} prefix="€" />
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Target</p>
                  <p className="text-lg font-bold text-white/60">€500,000</p>
                </div>
              </div>
              <ProgressBar percentage={pct} />
              <div className="flex justify-between mt-3">
                <span className="text-xs text-sky-400 font-semibold">{pct}% funded</span>
                <span className="text-xs text-white/40">{100 - pct}% remaining</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => openModal()}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold text-base hover:from-sky-400 hover:to-indigo-400 transition-all hover:scale-105 shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2"
              >
                Register Interest
                <ArrowRightIcon className="w-4 h-4" />
              </button>
              <Link
                href="/invest/deck"
                className="px-8 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-base hover:bg-white/20 transition-all flex items-center justify-center gap-2"
              >
                View Investor Deck
              </Link>
            </div>
          </div>
        </section>

        {/* ── LIVE STATS ───────────────────────────────────────────────── */}
        <section className="py-12 px-4 border-y border-white/5">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                icon: UserGroupIcon,
                label: "Total Investors",
                value: TOTAL_INVESTORS_COUNT,
                suffix: "",
                color: "text-sky-400",
              },
              {
                icon: CurrencyEuroIcon,
                label: "Total Raised",
                value: TOTAL_RAISED,
                prefix: "€",
                color: "text-indigo-400",
              },
              {
                icon: ChartBarIcon,
                label: "Round Closed",
                value: pct,
                suffix: "%",
                color: "text-violet-400",
              },
              {
                icon: SparklesIcon,
                label: "Valuation Cap",
                value: 5,
                prefix: "€",
                suffix: "M",
                color: "text-amber-400",
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="flex flex-col items-center text-center p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
              >
                <stat.icon className={`w-6 h-6 ${stat.color} mb-3`} />
                <p className={`text-3xl font-black ${stat.color}`}>
                  <AnimatedCounter
                    target={stat.value}
                    prefix={stat.prefix ?? ""}
                    suffix={stat.suffix ?? ""}
                  />
                </p>
                <p className="text-xs text-white/40 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── INVESTMENT TIERS ─────────────────────────────────────────── */}
        <section className="py-20 px-4" id="tiers">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-4xl font-black text-white mb-3">Choose Your Tier</h2>
              <p className="text-white/50 text-lg">Every amount matters. Find the right level of commitment for you.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {TIERS.map((tier) => (
                <TierCard key={tier.id} tier={tier} onSelect={openModal} />
              ))}
            </div>
            <p className="text-center text-xs text-white/30 mt-8">
              * Equity figures are indicative SAFE notes with €5M valuation cap. Legal documentation provided upon registration.
            </p>
          </div>
        </section>

        {/* ── SOCIAL PROOF ─────────────────────────────────────────────── */}
        <section className="py-16 px-4 bg-white/2">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-white mb-2">Who's Already In</h2>
              <p className="text-white/50">Joining a growing community of early believers</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {INVESTORS.map((inv, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {inv.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{inv.name}</p>
                    <p className="text-xs text-white/40 truncate">{inv.role}</p>
                    <p className="text-xs text-sky-400 font-medium mt-0.5">{inv.amount}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trust indicators */}
            <div className="mt-10 flex flex-wrap justify-center gap-6 text-center">
              {[
                { emoji: "🔐", text: "SAFE Notes" },
                { emoji: "📋", text: "Full Legal Docs" },
                { emoji: "🇪🇺", text: "EU Compliant" },
                { emoji: "💼", text: "Audited Financials" },
                { emoji: "📞", text: "Founder Access" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-white/50">
                  <span>{item.emoji}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHY INVEST ───────────────────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-black text-white mb-2">Why FreeTrust, Why Now</h2>
              <p className="text-white/50">The numbers tell the story</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  stat: "€50B",
                  label: "Total Addressable Market",
                  desc: "EU social commerce is projected to hit €50B by 2027, growing at 23% CAGR.",
                  color: "from-sky-500/20 to-sky-700/10",
                  border: "border-sky-500/20",
                  badge: "🌍",
                },
                {
                  stat: "€312K",
                  label: "Community GMV (Pilot)",
                  desc: "Our closed beta generated €312K in gross merchandise value in 8 weeks.",
                  color: "from-indigo-500/20 to-indigo-700/10",
                  border: "border-indigo-500/20",
                  badge: "📈",
                },
                {
                  stat: "4.9★",
                  label: "Trust Score Average",
                  desc: "Our proprietary TrustScore algorithm gives buyers and sellers unprecedented confidence.",
                  color: "from-violet-500/20 to-violet-700/10",
                  border: "border-violet-500/20",
                  badge: "⭐",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`p-6 rounded-2xl bg-gradient-to-br ${item.color} border ${item.border}`}
                >
                  <span className="text-3xl mb-3 block">{item.badge}</span>
                  <p className="text-4xl font-black text-white mb-1">{item.stat}</p>
                  <p className="text-sm font-semibold text-white/80 mb-2">{item.label}</p>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="py-20 px-4 bg-white/2">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-white mb-2">Frequently Asked Questions</h2>
              <p className="text-white/50">Everything you need to know before you invest</p>
            </div>
            <FaqAccordion items={FAQS} />
          </div>
        </section>

        {/* ── BOTTOM CTA ───────────────────────────────────────────────── */}
        <section className="py-24 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="p-10 rounded-3xl bg-gradient-to-br from-sky-500/10 via-indigo-500/10 to-violet-500/10 border border-white/10 backdrop-blur-sm">
              <span className="text-4xl block mb-4">🚀</span>
              <h2 className="text-4xl font-black text-white mb-4">
                Ready to Back the Future?
              </h2>
              <p className="text-white/60 text-lg mb-8 leading-relaxed">
                The round is {pct}% subscribed. Secure your position now before it closes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => openModal()}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold text-base hover:from-sky-400 hover:to-indigo-400 transition-all hover:scale-105 shadow-xl shadow-indigo-500/25"
                >
                  Register Interest Now
                </button>
                <Link
                  href="/invest/deck"
                  className="px-8 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-base hover:bg-white/20 transition-all"
                >
                  Read the Deck First
                </Link>
              </div>
              <p className="text-xs text-white/30 mt-6">
                This is not financial advice. Investment involves risk. Past performance does not guarantee future results.
              </p>
            </div>
          </div>
        </section>

      </div>

      {/* ── MODAL ────────────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultTier={selectedTier}
      />
    </div>
  );
}

