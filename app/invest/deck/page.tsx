"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CurrencyEuroIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────

type TeamMember = {
  name: string;
  role: string;
  bg: string;
  initials: string;
  bio: string;
  tags: string[];
};

type Metric = {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
};

type FundSlice = {
  label: string;
  pct: number;
  color: string;
  detail: string;
};

// ── Mock Data ─────────────────────────────────────────────────────────────────

const team: TeamMember[] = [
  {
    name: "Ava Moreau",
    role: "CEO & Co-Founder",
    bg: "from-sky-500 to-indigo-600",
    initials: "AM",
    bio: "Former Trust & Safety lead at a top-5 marketplace. Built compliance infra handling €2B+ in transactions.",
    tags: ["Product", "Strategy", "Fundraising"],
  },
  {
    name: "Luca Ferretti",
    role: "CTO & Co-Founder",
    bg: "from-indigo-500 to-purple-600",
    initials: "LF",
    bio: "Ex-Staff Engineer at Stripe. Architect of distributed escrow and fraud-detection pipelines.",
    tags: ["Engineering", "Security", "Infra"],
  },
  {
    name: "Sophie Käfer",
    role: "Chief Growth Officer",
    bg: "from-purple-500 to-pink-600",
    initials: "SK",
    bio: "Grew Depop's European community from 0 to 4M users. Community-led growth specialist.",
    tags: ["Growth", "Community", "Partnerships"],
  },
  {
    name: "Kwame Asante",
    role: "Head of Finance",
    bg: "from-emerald-500 to-teal-600",
    initials: "KA",
    bio: "Previously CFO at two Series A fintech startups. Expertise in EU financial regulation and FX.",
    tags: ["Finance", "Compliance", "M&A"],
  },
];

const metrics: Metric[] = [
  {
    label: "Registered Members",
    value: "42,800+",
    sub: "+18% MoM",
    icon: <UserGroupIcon className="w-6 h-6" />,
    color: "sky",
  },
  {
    label: "Gross Merchandise Value",
    value: "€3.2M",
    sub: "Last 12 months",
    icon: <CurrencyEuroIcon className="w-6 h-6" />,
    color: "indigo",
  },
  {
    label: "Trust Scores Issued",
    value: "128,400",
    sub: "Verified interactions",
    icon: <ShieldCheckIcon className="w-6 h-6" />,
    color: "purple",
  },
  {
    label: "Avg. Transaction Value",
    value: "€74",
    sub: "+23% YoY",
    icon: <ArrowTrendingUpIcon className="w-6 h-6" />,
    color: "emerald",
  },
  {
    label: "Dispute Resolution Rate",
    value: "98.6%",
    sub: "Without escalation",
    icon: <CheckCircleIcon className="w-6 h-6" />,
    color: "teal",
  },
  {
    label: "NPS Score",
    value: "71",
    sub: "Industry avg: 32",
    icon: <ChartBarIcon className="w-6 h-6" />,
    color: "sky",
  },
];

const fundSlices: FundSlice[] = [
  {
    label: "Product & Engineering",
    pct: 40,
    color: "bg-sky-400",
    detail: "Core platform, mobile apps, trust algorithm v2",
  },
  {
    label: "Sales & Marketing",
    pct: 25,
    color: "bg-indigo-400",
    detail: "EU expansion, community growth, brand campaigns",
  },
  {
    label: "Operations & Compliance",
    pct: 20,
    color: "bg-purple-400",
    detail: "Regulatory licensing, payment infra, customer success",
  },
  {
    label: "G&A / Reserve",
    pct: 15,
    color: "bg-emerald-400",
    detail: "Legal, finance, strategic reserve",
  },
];

const problems = [
  {
    icon: "🔓",
    title: "Trust is Broken in Peer Commerce",
    body: "€18B is lost annually in the EU to peer-to-peer fraud. Buyers can't verify sellers, and sellers have no portable reputation — so every transaction starts from zero trust.",
  },
  {
    icon: "💸",
    title: "Payment Protection is Fragmented",
    body: "Existing escrow and dispute solutions are slow, expensive, or platform-locked. Small sellers can't afford enterprise-grade protection.",
  },
  {
    icon: "🏝️",
    title: "Reputation Doesn't Travel",
    body: "A seller with 500 five-star reviews on one platform is a stranger on another. There's no portable, verifiable identity layer for commerce.",
  },
];

const solutions = [
  {
    icon: "🛡️",
    title: "Universal Trust Score",
    body: "A cryptographically-signed, portable reputation layer that aggregates verified interactions across platforms, forming the credit score of peer commerce.",
  },
  {
    icon: "⚡",
    title: "Smart Escrow in 60 Seconds",
    body: "One-click escrow protection with automated dispute resolution powered by AI evidence analysis and a community jury system.",
  },
  {
    icon: "🔗",
    title: "Open Trust API",
    body: "Any marketplace or app can embed FreeTrust scores, enabling a network effect that grows the value of every participant's reputation.",
  },
];

const revenueStreams = [
  {
    name: "Transaction Fees",
    desc: "0.8–1.5% on escrow-protected transactions",
    pct: 55,
    color: "sky",
  },
  {
    name: "Premium Membership",
    desc: "€9.99–€29.99/mo for advanced trust features",
    pct: 28,
    color: "indigo",
  },
  {
    name: "API Licensing",
    desc: "Per-call or volume-based Trust Score API access",
    pct: 12,
    color: "purple",
  },
  {
    name: "Verification Services",
    desc: "ID, business & credential verification bundles",
    pct: 5,
    color: "emerald",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase bg-sky-400/10 text-sky-400 border border-sky-400/20 mb-4">
      {children}
    </span>
  );
}

function SectionHeading({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-10">
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
        {children}
      </h2>
      {sub && <p className="text-slate-400 text-lg max-w-2xl">{sub}</p>}
    </div>
  );
}

function GlassCard({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-white/[0.04] border border-white/10 rounded-2xl backdrop-blur-sm ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  );
}

function ColorBar({
  pct,
  colorClass,
}: {
  pct: number;
  colorClass: string;
}) {
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvestDeckPage() {
  const [activeFundSlice, setActiveFundSlice] = useState<number | null>(null);

  const colorMap: Record<string, string> = {
    sky: "text-sky-400",
    indigo: "text-indigo-400",
    purple: "text-purple-400",
    emerald: "text-emerald-400",
    teal: "text-teal-400",
  };

  const bgColorMap: Record<string, string> = {
    sky: "bg-sky-400/10 border-sky-400/20",
    indigo: "bg-indigo-400/10 border-indigo-400/20",
    purple: "bg-purple-400/10 border-purple-400/20",
    emerald: "bg-emerald-400/10 border-emerald-400/20",
    teal: "bg-teal-400/10 border-teal-400/20",
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white antialiased">
      {/* Ambient background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full bg-sky-600/10 blur-[120px]" />
        <div className="absolute top-[40%] right-[-150px] w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[100px]" />
        <div className="absolute bottom-[-100px] left-[30%] w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
      </div>

      {/* Top nav bar */}
      <nav className="sticky top-0 z-50 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/invest"
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back to Invest
            </Link>
            <span className="text-white/20">|</span>
            <span className="text-white font-semibold text-sm">
              FreeTrust Investor Deck
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm font-medium transition-all"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Download PDF
            </a>
            <a
              href="#book-call"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white text-sm font-semibold transition-all shadow-lg shadow-sky-500/20"
            >
              <CalendarDaysIcon className="w-4 h-4" />
              Book a Call
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 text-center overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-400/10 border border-sky-400/20 text-sky-400 text-xs font-semibold tracking-widest uppercase mb-8">
            <ShieldCheckIcon className="w-3.5 h-3.5" />
            Confidential · Seed Round · 2024
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              FreeTrust
            </span>
            <br />
            <span className="text-white">Investor Deck</span>
          </h1>
          <p className="text-slate-400 text-xl sm:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed">
            The trust infrastructure layer for the{" "}
            <span className="text-white font-semibold">
              €50B European peer commerce
            </span>{" "}
            economy.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#book-call"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-base transition-all shadow-2xl shadow-sky-500/30 hover:shadow-sky-500/50 hover:-translate-y-0.5"
            >
              <CalendarDaysIcon className="w-5 h-5" />
              Schedule Investor Meeting
            </a>
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-base transition-all hover:-translate-y-0.5"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Download Full Deck
            </a>
          </div>
        </div>

        {/* Key numbers strip */}
        <div className="max-w-4xl mx-auto mt-16 grid grid-cols-3 gap-4">
          {[
            { label: "Seed Round", value: "€500K", sub: "SAFE note" },
            { label: "Valuation Cap", value: "€4M", sub: "Pre-money" },
            { label: "Discount Rate", value: "20%", sub: "Early investors" },
          ].map((s) => (
            <GlassCard key={s.label} className="p-6 text-center">
              <div className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent mb-1">
                {s.value}
              </div>
              <div className="text-white font-semibold text-sm mb-0.5">
                {s.label}
              </div>
              <div className="text-slate-500 text-xs">{s.sub}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ── PROBLEM ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <SectionBadge>
              <LightBulbIcon className="w-3.5 h-3.5" /> The Problem
            </SectionBadge>
          </div>
          <SectionHeading
            sub="Three compounding failures make peer-to-peer commerce broken, expensive, and untrustworthy at scale."
          >
            <span className="text-center block">
              Trust is{" "}
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                the missing layer
              </span>{" "}
              in peer commerce
            </span>
          </SectionHeading>
          <div className="grid md:grid-cols-3 gap-6">
            {problems.map((p) => (
              <GlassCard
                key={p.title}
                className="p-7 group hover:border-white/20 transition-all"
              >
                <div className="text-4xl mb-5">{p.icon}</div>
                <h3 className="text-white font-bold text-lg mb-3 leading-snug">
                  {p.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">{p.body}</p>
              </GlassCard>
            ))}
          </div>

          {/* Stat callout */}
          <GlassCard className="mt-8 p-8 sm:p-10 text-center">
            <div className="text-5xl sm:text-6xl font-black text-red-400 mb-3">
              €18B
            </div>
            <p className="text-slate-300 text-lg">
              lost annually to peer-to-peer fraud in the EU alone —
              <span className="text-white font-semibold">
                {" "}
                a problem growing 22% year-over-year
              </span>
            </p>
          </GlassCard>
        </div>
      </section>

      {/* ── SOLUTION ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-transparent via-sky-950/20 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <SectionBadge>
              <RocketLaunchIcon className="w-3.5 h-3.5" /> The Solution
            </SectionBadge>
          </div>
          <SectionHeading
            sub="FreeTrust is not another marketplace. It's the trust infrastructure that all marketplaces will run on."
          >
            <span className="text-center block">
              We built the{" "}
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                trust layer
              </span>{" "}
              commerce is missing
            </span>
          </SectionHeading>
          <div className="grid md:grid-cols-3 gap-6">
            {solutions.map((s) => (
              <GlassCard
                key={s.title}
                className="p-7 relative overflow-hidden group hover:border-sky-400/30 transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="text-4xl mb-5">{s.icon}</div>
                <h3 className="text-white font-bold text-lg mb-3 leading-snug">
                  {s.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed relative z-10">
                  {s.body}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKET SIZE ──────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <SectionBadge>
              <ChartBarIcon className="w-3.5 h-3.5" /> Market Opportunity
            </SectionBadge>
          </div>
          <SectionHeading
            sub="We're entering a massive, underserved market at the perfect inflection point."
          >
            <span className="text-center block">
              A{" "}
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                €50B
              </span>{" "}
              addressable market
            </span>
          </SectionHeading>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {[
              {
                label: "TAM",
                value: "€50B",
                sub: "EU social & peer commerce",
                desc: "Total addressable: all peer-to-peer commerce transactions requiring trust verification in the EU.",
                color: "sky",
              },
              {
                label: "SAM",
                value: "€8B",
                sub: "Serviceable addressable",
                desc: "Online peer transactions in our initial 6 target markets: DE, FR, NL, ES, IT, PL.",
                color: "indigo",
              },
              {
                label: "SOM",
                value: "€240M",
                sub: "5-year capture target",
                desc: "3% share of SAM — achievable with our current growth trajectory and planned expansion.",
                color: "purple",
              },
            ].map((m) => (
              <GlassCard
                key={m.label}
                className={`p-7 border-${m.color}-400/20 hover:border-${m.color}-400/40 transition-all`}
              >
                <span
                  className={`text-xs font-bold tracking-widest uppercase ${colorMap[m.color]} mb-3 block`}
                >
                  {m.label}
                </span>
                <div
                  className={`text-4xl font-black ${colorMap[m.color]} mb-1`}
                >
                  {m.value}
                </div>
                <div className="text-slate-300 text-sm font-semibold mb-3">
                  {m.sub}
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">{m.desc}</p>
              </GlassCard>
            ))}
          </div>

          {/* Market tailwinds */}
          <GlassCard className="p-7">
            <h3 className="text-white font-bold text-base mb-5">
              Market Tailwinds
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  stat: "+34%",
                  label: "YoY growth in EU peer commerce",
                  color: "sky",
                },
                {
                  stat: "63%",
                  label: "of Gen-Z prefer peer buying over retail",
                  color: "indigo",
                },
                {
                  stat: "€1.2B",
                  label: "invested in trust & safety globally in 2023",
                  color: "purple",
                },
                {
                  stat: "2026",
                  label: "EU Digital Services Act full enforcement",
                  color: "emerald",
                },
              ].map((t) => (
                <div
                  key={t.label}
                  className="bg-white/[0.03] rounded-xl p-4 border border-white/5"
                >
                  <div
                    className={`text-2xl font-black ${colorMap[t.color]} mb-1`}
                  >
                    {t.stat}
                  </div>
                  <div className="text-slate-400 text-xs leading-relaxed">
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ── BUSINESS MODEL ───────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <SectionBadge>
              <CurrencyEuroIcon className="w-3.5 h-3.5" /> Business Model
            </SectionBadge>
          </div>
          <SectionHeading
            sub="Multiple, compounding revenue streams with high retention and expanding margins."
          >
            <span className="text-center block">
              Four{" "}
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                revenue streams
              </span>
              , one platform
            </span>
          </SectionHeading>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {revenueStreams.map((r) => (
              <GlassCard
                key={r.name}
                className="p-6 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold text-base mb-1">
                      {r.name}
                    </h3>
                    <p className="text-slate-400 text-sm">{r.desc}</p>
                  </div>
                  <span
                    className={`text-2xl font-black ${colorMap[r.color]} ml-4 shrink-0`}
                  >
                    {r.pct}%
                  </span>
                </div>
                <ColorBar
                  pct={r.pct}
                  colorClass={`bg-gradient-to-r from-${r.color}-500 to-${r.color}-400`}
                />
              </GlassCard>
            ))}
          </div>

          {/* Unit economics */}
          <GlassCard className="p-7">
            <h3 className="text-white font-bold text-base mb-5">
              Unit Economics
            </h3>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  label: "CAC (Blended)",
                  value: "€4.20",
                  sub: "Customer acquisition cost",
                  color: "sky",
                },
                {
                  label: "LTV (24-month)",
                  value: "€38.60",
                  sub: "Lifetime value",
                  color: "indigo",
                },
                {
                  label: "LTV:CAC Ratio",
                  value: "9.2×",
                  sub: "Target: >3× at Series A",
                  color: "emerald",
                },
              ].map((u) => (
                <div key={u.label} className="text-center">
                  <div
                    className={`text-3xl font-black ${colorMap[u.color]} mb-1`}
                  >
                    {u.value}
                  </div>
                  <div className="text-white font-semibold text-sm mb-1">
                    {u.label}
                  </div>
                  <div className="text-slate-500 text-xs">{u.sub}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ── TRACTION ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <SectionBadge>
              <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> Traction
            </SectionBadge>
          </div>
          <SectionHeading
            sub="Real numbers from real users. We haven't spent a cent on paid acquisition."
          >
            <span className="text-center block">
              Growing{" "}
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                18% month-over-month
              </span>{" "}
              organically
            </span>
          </SectionHeading>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {metrics.map((m) => (
              <GlassCard
                key={m.label}
                className={`p-6 border hover:border-white/20 transition-all ${bgColorMap[m.color]}`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${colorMap[m.color]} bg-white/5`}
                >
                  {m.icon}
                </div>
                <div
                  className={`text-3xl font-black ${colorMap[m.color]} mb-1`}
                >
                  {m.value}
                </div>
                <div className="text-white font-semibold text-sm mb-1">
                  {m.label}
                </div>
                <div className="text-slate-500 text-xs">{m.sub}</div>
              </GlassCard>
            ))}
          </div>

          {/* Growth chart placeholder */}
          <GlassCard className="mt-8 p-7">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-base">
                Monthly Active Users — 12-Month Trend
              </h3>
              <span className="text-emerald-400 text-sm font-semibold">
                +18% MoM avg
              </span>
            </div>
            <div className="flex items-end gap-2 h-32">
              {[18, 22, 26, 28, 32, 34, 38, 42, 46, 50, 56, 64].map(
                (h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-sky-600/60 to-sky-400/60 border-t border-sky-400/40 transition-all"
                      style={{ height: `${(h / 64) * 100}%` }}
                    />
                  </div>
                )
              )}
            </div>
            <div className="flex justify-between text-slate-600 text-xs mt-2">
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
              <span>Aug</span>
              <span>Sep</span>
              <span>Oct</span>
              <span>Nov</span>
              <span>Dec</span>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ── TEAM ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-transparent via-purple-950/20 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <SectionBadge>
              <UserGroupIcon className="w-3.5 h-3.5" /> The Team
            </SectionBadge>
          </div>
          <SectionHeading
            sub="Founder-led. Operator-built. We've done this before at scale."
          >
            <span className="text-center block">
              The{" "}
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                right people
              </span>{" "}
              for this problem
            </span>
          </SectionHeading>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((m) => (
              <GlassCard
                key={m.name}
                className="p-6 hover:border-white/20 transition-all group"
              >
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${m.bg} flex items-center justify-center text-white text-xl font-black mb-5 shadow-lg`}
                >
                  {m.initials}
                </div>
                <h3 className="text-white font-bold text-base mb-0.5">
                  {m.name}
                </h3>
                <p className="text-sky-400 text-xs font-semibold mb-4">
                  {m.role}
                </p>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  {m.bio}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {m.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Advisors note */}
          <GlassCard className="mt-6 p-6">
            <p className="text-center text-slate-400 text-sm">
              <span className="text-white font-semibold">
                Strategic Advisors:
              </span>{" "}
              Former CCO of Vinted · Ex-Trustpilot Head of Product · Partner at
              a top-3 EU fintech VC ·{" "}
              <span className="text-sky-400 cursor-pointer hover:underline">
                + 3 more (disclosed to qualified investors)
              </span>
            </p>
          </GlassCard>
        </div>
      </section>

      {/* ── USE OF FUNDS ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <SectionBadge>
              <BuildingStorefrontIcon className="w-3.5 h-3.5" /> Use of Funds
            </SectionBadge>
          </div>
          <SectionHeading
            sub="Every euro of this €500K seed is deployed against product-market fit and EU market expansion."
          >
            <span className="text-center block">
              How we deploy the{" "}
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                €500K seed
              </span>
            </span>
          </SectionHeading>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Pie-style visual using CSS */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72">
                {/* Stacked conic gradient ring */}
                <div
                  className="w-full h-full rounded-full"
                  style={{
                    background: `conic-gradient(
                      #38bdf8 0% 40%,
                      #818cf8 40% 65%,
                      #c084fc 65% 85%,
                      #34d399 85% 100%
                    )`,
                    boxShadow:
                      "0 0 60px rgba(56,189,248,0.2), 0 0 30px rgba(99,102,241,0.15)",
                  }}
                />
                {/* Center hole */}
                <div className="absolute inset-[20%] rounded-full bg-[#0f172a] flex flex-col items-center justify-center">
                  <div className="text-2xl font-black text-white">€500K</div>
                  <div className="text-xs text-slate-500">Seed Round</div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
                {fundSlices.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-sm shrink-0 ${s.color}`} />
                    <span className="text-slate-300 text-sm flex-1">
                      {s.label}
                    </span>
                    <span className="text-white font-bold text-sm">
                      {s.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fundSlices.map((s, i) => (
                <GlassCard
                  key={s.label}
                  className={`p-5 cursor-pointer transition-all hover:border-white/25 ${
                    activeFundSlice === i ? "border-white/30 bg-white/[0.07]" : ""
                  }`}
                  onClick={() =>
                    setActiveFundSlice(activeFundSlice === i ? null : i)
                  }
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-sm ${s.color}`} />
                    <span className="text-white font-bold text-sm">
                      {s.pct}%
                    </span>
                  </div>
                  <div className="text-slate-300 font-semibold text-sm mb-2">
                    {s.label}
                  </div>
                  <div className="text-slate-500 text-xs leading-relaxed">
                    {s.detail}
                  </div>
                  <div className="mt-3">
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.color}`}
                        style={{ width: `${s.pct * 2}%` }}
                      />
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* 18-month milestones */}
          <GlassCard className="mt-10 p-7">
            <h3 className="text-white font-bold text-base mb-6">
              18-Month Milestones (Post-Seed)
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />
              <div className="space-y-6 pl-12">
                {[
                  {
                    q: "Q1",
                    milestone:
                      "Launch Trust Score v2 + mobile app (iOS & Android)",
                    color: "sky",
                  },
                  {
                    q: "Q2",
                    milestone:
                      "Expand to Germany & France — target 100K registered users",
                    color: "indigo",
                  },
                  {
                    q: "Q3",
                    milestone:
                      "Open Trust API beta with 5 partner marketplace integrations",
                    color: "purple",
                  },
                  {
                    q: "Q4",
                    milestone:
                      "€500K MRR run-rate — Series A raise (€2.5M target)",
                    color: "emerald",
                  },
                ].map((item) => (
                  <div key={item.q} className="relative">
                    <div
                      className={`absolute -left-8 w-4 h-4 rounded-full border-2 border-${item.color}-400 bg-[#0f172a] -translate-x-1/2`}
                    />
                    <div className="flex items-start gap-3">
                      <span
                        className={`text-xs font-bold ${colorMap[item.color]} tracking-widest uppercase shrink-0 pt-0.5`}
                      >
                        {item.q}
                      </span>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {item.milestone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ── COMPETITIVE LANDSCAPE ────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-transparent via-sky-950/10 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <SectionBadge>Competitive Landscape</SectionBadge>
          </div>
          <SectionHeading
            sub="No one else is building portable, cross-platform trust infrastructure at this layer."
          >
            <span className="text-center block">
              We occupy a{" "}
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                unique position
              </span>
            </span>
          </SectionHeading>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-slate-400 font-semibold px-6 py-4">
                      Feature
                    </th>
                    {["FreeTrust", "Trustpilot", "Vinted", "PayPal"].map(
                      (c) => (
                        <th
                          key={c}
                          className={`text-center px-6 py-4 font-semibold ${
                            c === "FreeTrust"
                              ? "text-sky-400"
                              : "text-slate-400"
                          }`}
                        >
                          {c}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Portable Trust Score", true, false, false, false],
                    ["Peer-to-peer escrow", true, false, true, true],
                    ["AI dispute resolution", true, false, false, false],
                    ["Open API for marketplaces", true, false, false, false],
                    ["Peer commerce focus", true, false, true, false],
                    ["EU-first & GDPR-native", true, true, true, false],
                  ].map(([feat, ...vals]) => (
                    <tr
                      key={String(feat)}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="text-slate-300 px-6 py-4">{feat}</td>
                      {vals.map((v, i) => (
                        <td key={i} className="text-center px-6 py-4">
                          {v ? (
                            <span className="text-emerald-400 text-lg">✓</span>
                          ) : (
                            <span className="text-slate-700 text-lg">✗</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ── CTA / BOOK A CALL ────────────────────────────────────────────── */}
      <section
        id="book-call"
        className="py-24 px-4 sm:px-6"
      >
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-4">
            <SectionBadge>
              <CalendarDaysIcon className="w-3.5 h-3.5" /> Get Involved
            </SectionBadge>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
            Ready to invest in the{" "}
            <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
              Trust Economy?
            </span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            We're closing the €500K seed round with a select group of aligned
            investors. Book a 30-minute intro call or jump straight to the
            investment page.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-base transition-all shadow-2xl shadow-sky-500/30 hover:shadow-sky-500/50 hover:-translate-y-0.5"
            >
              <CalendarDaysIcon className="w-5 h-5" />
              Book 30-Minute Call
            </a>
            <Link
              href="/invest"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-base transition-all hover:-translate-y-0.5"
            >
              View Investment Tiers
              <ChevronLeftIcon className="w-4 h-4 rotate-180" />
            </Link>
          </div>

          <a
            href="#"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Download Full Pitch Deck (PDF)
          </a>

          {/* Trust signals */}
          <div className="mt-14 grid grid-cols-3 gap-4">
            {[
              { val: "€500K", label: "Round size", color: "sky" },
              { val: "€4M", label: "Valuation cap", color: "indigo" },
              { val: "20%", label: "Investor discount", color: "purple" },
            ].map((s) => (
              <GlassCard key={s.label} className="p-5 text-center">
                <div
                  className={`text-2xl font-black ${colorMap[s.color]} mb-1`}
                >
                  {s.val}
                </div>
                <div className="text-slate-500 text-xs">{s.label}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
              <ShieldCheckIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">FreeTrust</span>
          </div>
          <p className="text-slate-600 text-xs text-center max-w-md">
            This document contains forward-looking statements and is for
            informational purposes only. It does not constitute an offer to sell
            or a solicitation of an offer to buy securities.
          </p>
          <div className="flex items-center gap-4 text-slate-500 text-xs">
            <Link href="/invest" className="hover:text-white transition-colors">
              Invest
            </Link>
            <a href="#" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Legal
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

