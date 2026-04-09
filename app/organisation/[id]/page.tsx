"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BuildingOffice2Icon,
  GlobeAltIcon,
  MapPinIcon,
  UserGroupIcon,
  StarIcon,
  HeartIcon,
  ShareIcon,
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ChartBarIcon,
  PhotoIcon,
  ArrowLeftIcon,
  CalendarIcon,
  LinkIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";
import {
  HeartIcon as HeartSolid,
  StarIcon as StarSolid,
} from "@heroicons/react/24/solid";
import { format, parseISO } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type SDGNumber = 1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17;

interface SDG {
  number: SDGNumber;
  label: string;
  color: string;
}

interface Review {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  date: string;
  body: string;
  verified: boolean;
}

interface Project {
  id: string;
  title: string;
  status: "active" | "completed" | "planned";
  summary: string;
  startDate: string;
  endDate?: string;
  budget?: string;
  sdgs: SDGNumber[];
}

interface Update {
  id: string;
  title: string;
  date: string;
  body: string;
  imageUrl?: string;
}

interface GalleryItem {
  id: string;
  url: string;
  caption: string;
}

interface Organisation {
  id: string;
  name: string;
  tagline: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  location: string;
  country: string;
  website: string;
  founded: string;
  type: string;
  size: string;
  verified: boolean;
  followerCount: number;
  reviewCount: number;
  avgRating: number;
  sdgs: SDGNumber[];
  projects: Project[];
  reviews: Review[];
  updates: Update[];
  gallery: GalleryItem[];
  stats: { label: string; value: string }[];
  socialLinks: { platform: string; url: string }[];
  tags: string[];
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const SDG_META: Record<SDGNumber, { label: string; color: string }> = {
  1:  { label: "No Poverty",             color: "#E5243B" },
  2:  { label: "Zero Hunger",            color: "#DDA63A" },
  3:  { label: "Good Health",            color: "#4C9F38" },
  4:  { label: "Quality Education",      color: "#C5192D" },
  5:  { label: "Gender Equality",        color: "#FF3A21" },
  6:  { label: "Clean Water",            color: "#26BDE2" },
  7:  { label: "Clean Energy",           color: "#FCC30B" },
  8:  { label: "Decent Work",            color: "#A21942" },
  9:  { label: "Industry & Innovation",  color: "#FD6925" },
  10: { label: "Reduced Inequalities",   color: "#DD1367" },
  11: { label: "Sustainable Cities",     color: "#FD9D24" },
  12: { label: "Responsible Consumption",color: "#BF8B2E" },
  13: { label: "Climate Action",         color: "#3F7E44" },
  14: { label: "Life Below Water",       color: "#0A97D9" },
  15: { label: "Life on Land",           color: "#56C02B" },
  16: { label: "Peace & Justice",        color: "#00689D" },
  17: { label: "Partnerships",           color: "#19486A" },
};

function buildMockOrg(id: string): Organisation {
  return {
    id,
    name: "GreenFuture Initiative",
    tagline: "Empowering communities through sustainable innovation",
    description:
      "GreenFuture Initiative is a global non-profit dedicated to accelerating the transition to sustainable, equitable communities. Founded in 2012, we operate across 40+ countries partnering with governments, corporations, and grassroots organisations to deliver measurable impact on climate, education, and economic resilience. Our evidence-based programmes have reached over 2.3 million beneficiaries since inception.",
    logoUrl: "",
    coverUrl: "",
    location: "Geneva, Switzerland",
    country: "CH",
    website: "https://greenfuture.example.org",
    founded: "2012-03-15",
    type: "Non-profit / NGO",
    size: "201–500 employees",
    verified: true,
    followerCount: 14820,
    reviewCount: 238,
    avgRating: 4.6,
    sdgs: [1, 3, 4, 7, 11, 13, 17],
    tags: ["climate", "education", "clean energy", "community", "SDGs", "sustainability"],
    socialLinks: [
      { platform: "Twitter / X", url: "https://twitter.com" },
      { platform: "LinkedIn",    url: "https://linkedin.com" },
      { platform: "Instagram",   url: "https://instagram.com" },
    ],
    stats: [
      { label: "Countries active",   value: "43" },
      { label: "Beneficiaries",      value: "2.3M+" },
      { label: "Projects completed", value: "186" },
      { label: "Partnerships",       value: "320+" },
      { label: "Funds deployed",     value: "$48M" },
      { label: "Years active",       value: "12" },
    ],
    projects: [
      {
        id: "p1",
        title: "Solar Villages Phase III",
        status: "active",
        summary: "Off-grid solar deployment for 120 rural villages across sub-Saharan Africa.",
        startDate: "2023-01-01",
        endDate: "2025-12-31",
        budget: "$3.2M",
        sdgs: [7, 1, 3],
      },
      {
        id: "p2",
        title: "Urban Resilience Accelerator",
        status: "active",
        summary: "Co-designing climate adaptation plans with 15 mid-size cities in Latin America.",
        startDate: "2024-04-01",
        budget: "$1.8M",
        sdgs: [11, 13, 17],
      },
      {
        id: "p3",
        title: "Girls STEM Scholarship Fund",
        status: "completed",
        summary: "Awarded 4,200 scholarships to girls in STEM across 12 countries.",
        startDate: "2020-09-01",
        endDate: "2023-08-31",
        budget: "$2.1M",
        sdgs: [4, 5, 10],
      },
      {
        id: "p4",
        title: "Ocean Plastics Data Platform",
        status: "planned",
        summary: "Open-source platform aggregating citizen-science ocean-plastic data.",
        startDate: "2025-06-01",
        sdgs: [14, 12, 17],
      },
    ],
    reviews: [
      {
        id: "r1",
        author: "Amara Diallo",
        avatar: "",
        rating: 5,
        date: "2024-08-14",
        body: "Exceptional transparency and genuine community engagement. GreenFuture's Solar Villages project transformed our region — reliable electricity has kept children in school and clinics open at night.",
        verified: true,
      },
      {
        id: "r2",
        author: "Priya Nair",
        avatar: "",
        rating: 4,
        date: "2024-06-02",
        body: "Strong programme design and clear reporting. Communication with local partners could be more timely, but the on-ground outcomes are impressive and well-documented.",
        verified: true,
      },
      {
        id: "r3",
        author: "Carlos Mendes",
        avatar: "",
        rating: 5,
        date: "2024-03-19",
        body: "Partnered with them on the Urban Resilience Accelerator. Their facilitation methodology is best-in-class and the cross-city peer learning was invaluable.",
        verified: false,
      },
      {
        id: "r4",
        author: "Sophie Laurent",
        avatar: "",
        rating: 4,
        date: "2023-11-30",
        body: "Solid track record. Would love to see more detailed beneficiary-level data published in annual reports, but overall a highly trustworthy organisation.",
        verified: true,
      },
    ],
    updates: [
      {
        id: "u1",
        title: "Solar Villages Phase III reaches 80% deployment milestone",
        date: "2024-09-10",
        body: "We are thrilled to announce that 96 of 120 target villages now have fully operational solar micro-grids. This milestone was reached three months ahead of schedule thanks to our local partner network.",
        imageUrl: "",
      },
      {
        id: "u2",
        title: "New partnership with the European Climate Foundation",
        date: "2024-07-22",
        body: "GreenFuture and the European Climate Foundation have signed a 3-year €4M strategic partnership to scale urban adaptation programmes across Southern Europe and North Africa.",
      },
      {
        id: "u3",
        title: "2023 Annual Impact Report published",
        date: "2024-04-05",
        body: "Our 2023 Annual Impact Report is now available. Key highlights: 580,000 new beneficiaries reached, 14 new country programmes launched, and third-party verification of all impact metrics.",
      },
    ],
    gallery: [
      { id: "g1", url: "", caption: "Solar micro-grid installation, Kenya 2024" },
      { id: "g2", url: "", caption: "Girls STEM programme graduation, Bangladesh" },
      { id: "g3", url: "", caption: "Urban Resilience workshop, Medellín" },
      { id: "g4", url: "", caption: "Community water-point, Mali" },
      { id: "g5", url: "", caption: "Annual Summit 2023, Geneva" },
      { id: "g6", url: "", caption: "Ocean data volunteer day, Philippines" },
    ],
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.35,
        background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
      }}
    >
      {initials}
    </div>
  );
}

function StarRating({ value, max = 5, size = 16 }: { value: number; max?: number; size?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(value);
        const half = !filled && i < value;
        return filled || half ? (
          <StarSolid key={i} style={{ width: size, height: size, color: "#facc15" }} />
        ) : (
          <StarIcon key={i} style={{ width: size, height: size, color: "#4b5563" }} />
        );
      })}
    </span>
  );
}

function SDGBadge({ number }: { number: SDGNumber }) {
  const meta = SDG_META[number];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: meta.color }}
      title={meta.label}
    >
      SDG {number}
      <span className="hidden sm:inline">· {meta.label}</span>
    </span>
  );
}

function StatusPill({ status }: { status: Project["status"] }) {
  const map: Record<Project["status"], string> = {
    active:    "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    completed: "bg-sky-500/20 text-sky-400 border border-sky-500/30",
    planned:   "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  };
  return (
    <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${map[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function TabOverview({ org }: { org: Organisation }) {
  return (
    <div className="space-y-8">
      {/* Stats grid */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">
          Impact at a Glance
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {org.stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1"
            >
              <span className="text-2xl font-bold text-white">{s.value}</span>
              <span className="text-xs text-gray-400 leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
          About
        </h3>
        <p className="text-gray-300 leading-relaxed whitespace-pre-line">{org.description}</p>
      </section>

      {/* SDGs */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
          Sustainable Development Goals
        </h3>
        <div className="flex flex-wrap gap-2">
          {org.sdgs.map((n) => (
            <SDGBadge key={n} number={n} />
          ))}
        </div>
      </section>

      {/* Tags */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
          Focus Areas
        </h3>
        <div className="flex flex-wrap gap-2">
          {org.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-white/8 border border-white/10 px-3 py-1 text-sm text-gray-300"
            >
              #{t}
            </span>
          ))}
        </div>
      </section>

      {/* Meta info */}
      <section className="grid sm:grid-cols-2 gap-4 text-sm text-gray-400">
        {[
          { icon: BuildingOffice2Icon, label: "Type",     value: org.type },
          { icon: UserGroupIcon,       label: "Size",     value: org.size },
          { icon: MapPinIcon,          label: "Location", value: org.location },
          { icon: CalendarIcon,        label: "Founded",  value: org.founded ? format(parseISO(org.founded), "MMMM yyyy") : "—" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-gray-500">{label}:</span>
            <span className="text-gray-200">{value}</span>
          </div>
        ))}
        {org.website && (
          <div className="flex items-center gap-3">
            <GlobeAltIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-gray-500">Website:</span>
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline truncate"
            >
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}
        <div className="flex items-center gap-3">
          <LinkIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-gray-500">Socials:</span>
          <div className="flex gap-3">
            {org.socialLinks.map((s) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline text-xs"
              >
                {s.platform}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Tab: Projects ────────────────────────────────────────────────────────────

function TabProjects({ projects }: { projects: Project[] }) {
  const [filter, setFilter] = useState<"all" | Project["status"]>("all");
  const visible = filter === "all" ? projects : projects.filter((p) => p.status === filter);
  const counts = {
    all:       projects.length,
    active:    projects.filter((p) => p.status === "active").length,
    completed: projects.filter((p) => p.status === "completed").length,
    planned:   projects.filter((p) => p.status === "planned").length,
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["all", "active", "completed", "planned"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-white/8 text-gray-400 hover:text-white border border-white/10"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}{" "}
            <span className="opacity-60">({counts[f]})</span>
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {visible.map((p) => (
          <div
            key={p.id}
            className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-3 hover:border-indigo-500/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-white font-semibold leading-tight">{p.title}</h4>
              <StatusPill status={p.status} />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{p.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {p.sdgs.map((n) => (
                <SDGBadge key={n} number={n} />
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-1">
              <span className="flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5" />
                {format(parseISO(p.startDate), "MMM yyyy")}
                {p.endDate && ` → ${format(parseISO(p.endDate), "MMM yyyy")}`}
              </span>
              {p.budget && (
                <span className="flex items-center gap-1">
                  <ChartBarIcon className="w-3.5 h-3.5" />
                  Budget: {p.budget}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Updates ────────────────────────────────────────────────────────────

function TabUpdates({ updates }: { updates: Update[] }) {
  return (
    <div className="space-y-6">
      {updates.map((u) => (
        <article
          key={u.id}
          className="rounded-xl bg-white/5 border border-white/10 overflow-hidden hover:border-indigo-500/40 transition-colors"
        >
          {u.imageUrl && (
            <div className="h-40 bg-white/10 flex items-center justify-center">
              <PhotoIcon className="w-10 h-10 text-gray-600" />
            </div>
          )}
          <div className="p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <CalendarIcon className="w-3.5 h-3.5" />
              {format(parseISO(u.date), "d MMMM yyyy")}
            </div>
            <h4 className="text-white font-semibold">{u.title}</h4>
            <p className="text-gray-400 text-sm leading-relaxed">{u.body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

// ─── Tab: Reviews ────────────────────────────────────────────────────────────

function TabReviews({ reviews, avg, count }: { reviews: Review[]; avg: number; count: number }) {
  const [sort, setSort] = useState<"recent" | "highest" | "lowest">("recent");
  const sorted = [...reviews].sort((a, b) => {
    if (sort === "recent")  return parseISO(b.date).getTime() - parseISO(a.date).getTime();
    if (sort === "highest") return b.rating - a.rating;
    return a.rating - b.rating;
  });
  const dist = [5, 4, 3, 2, 1].map((r) => ({
    r,
    pct: Math.round((reviews.filter((x) => x.rating === r).length / reviews.length) * 100),
  }));

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="flex flex-col sm:flex-row gap-6 rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex flex-col items-center justify-center gap-1 min-w-[100px]">
          <span className="text-5xl font-bold text-white">{avg.toFixed(1)}</span>
          <StarRating value={avg} size={20} />
          <span className="text-xs text-gray-500 mt-1">{count} reviews</span>
        </div>
        <div className="flex-1 space-y-2">
          {dist.map(({ r, pct }) => (
            <div key={r} className="flex items-center gap-3 text-sm">
              <span className="w-4 text-gray-400 text-right">{r}</span>
              <StarSolid className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-yellow-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-gray-500 text-right">{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div className="flex gap-2">
        {(["recent", "highest", "lowest"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              sort === s
                ? "bg-indigo-600 text-white"
                : "bg-white/8 text-gray-400 hover:text-white border border-white/10"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Reviews list */}
      <div className="space-y-4">
        {sorted.map((r) => (
          <div key={r.id} className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Avatar name={r.author} size={38} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white text-sm">{r.author}</span>
                  {r.verified && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckBadgeIcon className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-500">
                    {format(parseISO(r.date), "d MMM yyyy")}
                  </span>
                </div>
                <StarRating value={r.rating} size={14} />
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Gallery ────────────────────────────────────────────────────────────

function TabGallery({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState<GalleryItem | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((g) => (
          <button
            key={g.id}
            onClick={() => setActive(g)}
            className="rounded-xl overflow-hidden bg-white/8 border border-white/10 aspect-video flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-indigo-500/50 hover:text-gray-300 transition-colors group"
          >
            <PhotoIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span className="text-xs px-2 text-center line-clamp-2">{g.caption}</span>
          </button>
        ))}
      </div>
      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setActive(null)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video bg-white/8 flex items-center justify-center">
              <PhotoIcon className="w-16 h-16 text-gray-600" />
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm text-gray-300">{active.caption}</span>
              <button
                onClick={() => setActive(null)}
                className="text-gray-500 hover:text-white text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Tab: Documents ──────────────────────────────────────────────────────────

function TabDocuments() {
  const docs = [
    { name: "2023 Annual Impact Report",     type: "PDF",  size: "3.4 MB", date: "2024-04-05" },
    { name: "2022 Financial Audit",           type: "PDF",  size: "1.2 MB", date: "2023-07-14" },
    { name: "Strategic Plan 2024–2027",       type: "PDF",  size: "892 KB", date: "2024-01-10" },
    { name: "Solar Villages III — Baseline",  type: "XLSX", size: "540 KB", date: "2023-02-20" },
    { name: "Safeguarding Policy",            type: "PDF",  size: "215 KB", date: "2022-09-01" },
  ];
  return (
    <div className="space-y-3">
      {docs.map((d) => (
        <div
          key={d.name}
          className="flex items-center gap-4 rounded-xl bg-white/5 border border-white/10 p-4 hover:border-indigo-500/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <DocumentTextIcon className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{d.name}</p>
            <p className="text-gray-500 text-xs">
              {d.type} · {d.size} · {format(parseISO(d.date), "d MMM yyyy")}
            </p>
          </div>
          <button className="text-indigo-400 hover:text-indigo-300 text-xs font-medium flex-shrink-0">
            Download
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",   label: "Overview" },
  { id: "projects",   label: "Projects" },
  { id: "updates",    label: "Updates" },
  { id: "reviews",    label: "Reviews" },
  { id: "gallery",    label: "Gallery" },
  { id: "documents",  label: "Documents" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function OrganisationPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? "1");

  const [org, setOrg] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [followed, setFollowed] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/organisations/${id}`);
      if (!res.ok) throw new Error("not found");
      const raw = await res.json();

      // Map Supabase snake_case fields to the Organisation interface shape.
      // Fields not stored in the DB fall back to safe defaults.
      const mapped: Organisation = {
        id:            raw.id,
        name:          raw.name ?? "",
        tagline:       raw.tagline ?? "",
        description:   raw.description ?? "",
        logoUrl:       raw.logo_url ?? raw.logoUrl ?? "",
        coverUrl:      raw.cover_url ?? raw.coverUrl ?? "",
        location:      raw.location ?? "",
        country:       raw.country ?? "",
        website:       raw.website ?? "",
        founded:       raw.founded_year ? `${raw.founded_year}-01-01` : (raw.founded ?? "2020-01-01"),
        type:          raw.type ?? "",
        size:          raw.size ?? "",
        verified:      raw.is_verified ?? raw.verified ?? false,
        followerCount: raw.members_count ?? raw.followerCount ?? 0,
        reviewCount:   raw.reviewCount ?? 0,
        avgRating:     raw.trust_score ?? raw.avgRating ?? 0,
        sdgs:          Array.isArray(raw.sdgs) ? raw.sdgs : [],
        tags:          Array.isArray(raw.tags) ? raw.tags : [],
        projects:      Array.isArray(raw.projects) ? raw.projects : [],
        reviews:       Array.isArray(raw.reviews) ? raw.reviews : [],
        updates:       Array.isArray(raw.updates) ? raw.updates : [],
        gallery:       Array.isArray(raw.gallery) ? raw.gallery : [],
        stats:         Array.isArray(raw.stats) ? raw.stats : [],
        socialLinks:   Array.isArray(raw.socialLinks) ? raw.socialLinks : [],
      };

      setOrg(mapped);
      setFollowed(raw.isFollowing ?? false);
    } catch {
      setOrg(buildMockOrg(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleFollow = async () => {
    if (!org) return;
    setFollowLoading(true);
    try {
      await fetch(`/api/organisations/${org.id}/follow`, {
        method: followed ? "DELETE" : "POST",
      });
      setFollowed((f) => !f);
      setOrg((o) =>
        o
          ? { ...o, followerCount: o.followerCount + (followed ? -1 : 1) }
          : o
      );
    } catch {
      setFollowed((f) => !f);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — do nothing
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center" style={{ paddingTop: 64 }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-gray-500 text-sm">Loading organisation…</span>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center" style={{ paddingTop: 64 }}>
        <div className="text-center space-y-4">
          <p className="text-white text-xl font-semibold">Organisation not found</p>
          <button
            onClick={() => router.back()}
            className="text-indigo-400 hover:underline text-sm"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const initials = org.name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      <style>{`
        .org-tab { transition: all 0.15s; white-space: nowrap; }
        .org-sdg { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 10px; font-size: 0.7rem; font-weight: 700; color: #fff; margin: 2px; }
        .org-tag { display: inline-block; background: rgba(148,163,184,0.1); border: 1px solid rgba(148,163,184,0.15); border-radius: 999px; padding: 2px 10px; font-size: 0.72rem; color: #94a3b8; margin: 2px; }
        @media (max-width: 640px) {
          .org-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* Cover banner */}
      <div style={{ position: 'relative', height: 140, background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e293b 100%)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 50%, rgba(99,102,241,0.4) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(139,92,246,0.3) 0%, transparent 50%)' }} />
        <button onClick={() => router.back()} style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: 999, padding: '6px 12px', fontSize: '0.82rem', color: '#f1f5f9', cursor: 'pointer' }}>
          ← Back
        </button>
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
          <button onClick={handleShare} style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: 999, padding: '6px 12px', fontSize: '0.8rem', color: '#f1f5f9', cursor: 'pointer' }}>
            {copied ? '✓ Copied' : '↗ Share'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
        {/* Logo + name card */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '16px', marginTop: -32, marginBottom: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', position: 'relative' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {/* Logo */}
            <div style={{ width: 64, height: 64, borderRadius: 14, background: org.logoUrl ? undefined : 'linear-gradient(135deg,#6366f1,#8b5cf6)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, color: '#fff', border: '3px solid #0f172a', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
              {org.logoUrl ? <img src={org.logoUrl} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
            </div>
            {/* Name + tagline + follow */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: 'clamp(1.1rem,4vw,1.5rem)', fontWeight: 800, margin: 0, lineHeight: 1.2, wordBreak: 'break-word' }}>{org.name}</h1>
                    {org.verified && <span style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 999, padding: '1px 8px', fontSize: '0.65rem', color: '#818cf8', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>✓ Verified</span>}
                  </div>
                  {org.tagline && <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0', lineHeight: 1.4 }}>{org.tagline}</p>}
                </div>
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  style={{ background: followed ? 'rgba(99,102,241,0.15)' : '#6366f1', border: followed ? '1px solid rgba(99,102,241,0.4)' : 'none', borderRadius: 999, padding: '7px 16px', fontSize: '0.8rem', fontWeight: 700, color: followed ? '#818cf8' : '#fff', cursor: 'pointer', flexShrink: 0, opacity: followLoading ? 0.6 : 1 }}
                >
                  {followLoading ? '…' : followed ? '✓ Following' : '+ Follow'}
                </button>
              </div>

              {/* Meta pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 10, fontSize: '0.78rem', color: '#64748b' }}>
                {org.location && <span>📍 {org.location}</span>}
                {org.followerCount > 0 && <span>👥 {org.followerCount.toLocaleString()} followers</span>}
                {org.type && <span>🏢 {org.type}</span>}
                {org.founded && <span>📅 Est. {org.founded.slice(0, 4)}</span>}
                {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>🌐 {org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>}
              </div>

              {/* SDG badges */}
              {org.sdgs.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {org.sdgs.map((n: SDGNumber) => {
                    const meta = SDG_META[n]
                    return <span key={n} className="org-sdg" style={{ background: meta.color }}>SDG {n}</span>
                  })}
                </div>
              )}

              {/* Tags */}
              {org.tags.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap' }}>
                  {org.tags.map((t: string) => <span key={t} className="org-tag">#{t}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid rgba(99,102,241,0.15)', marginBottom: 20, scrollbarWidth: 'none' }}>
          {TABS.map(({ id: tid, label }) => (
            <button
              key={tid}
              className="org-tab"
              onClick={() => setActiveTab(tid)}
              style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: activeTab === tid ? '2px solid #6366f1' : '2px solid transparent', color: activeTab === tid ? '#818cf8' : '#64748b', fontWeight: activeTab === tid ? 700 : 500, fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0 }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ paddingBottom: 40 }}>
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              {/* Description */}
              {org.description && (
                <div style={{ background: '#1e293b', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>About</div>
                  <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.7, margin: 0 }}>{org.description}</p>
                </div>
              )}

              {/* Stats grid */}
              {org.stats.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Impact at a Glance</div>
                  <div className="org-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                    {org.stats.map((s: { label: string; value: string }) => (
                      <div key={s.label} style={{ background: '#1e293b', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f1f5f9' }}>{s.value}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta details */}
              <div style={{ background: '#1e293b', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 12, padding: '16px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: '0.82rem' }}>
                  {org.type && <div><span style={{ color: '#475569' }}>Type</span><div style={{ color: '#f1f5f9', marginTop: 2 }}>{org.type}</div></div>}
                  {org.size && <div><span style={{ color: '#475569' }}>Size</span><div style={{ color: '#f1f5f9', marginTop: 2 }}>{org.size}</div></div>}
                  {org.location && <div><span style={{ color: '#475569' }}>Location</span><div style={{ color: '#f1f5f9', marginTop: 2 }}>{org.location}</div></div>}
                  {org.founded && org.founded !== '2020-01-01' && <div><span style={{ color: '#475569' }}>Founded</span><div style={{ color: '#f1f5f9', marginTop: 2 }}>{format(parseISO(org.founded), 'MMMM yyyy')}</div></div>}
                </div>
              </div>
            </div>
          )}

          {/* PROJECTS */}
          {activeTab === 'projects' && <TabProjects projects={org.projects} />}

          {/* UPDATES */}
          {activeTab === 'updates' && <TabUpdates updates={org.updates} />}

          {/* REVIEWS */}
          {activeTab === 'reviews' && (
            org.reviews.length > 0
              ? <TabReviews reviews={org.reviews} avg={org.avgRating} count={org.reviewCount} />
              : <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#475569' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⭐</div>
                  <p>No reviews yet — be the first to review this organisation.</p>
                </div>
          )}

          {/* GALLERY */}
          {activeTab === 'gallery' && <TabGallery items={org.gallery} />}

          {/* DOCUMENTS */}
          {activeTab === 'documents' && <TabDocuments />}
        </div>
      </div>
    </div>
  );
}

