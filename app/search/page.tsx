"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  DocumentTextIcon,
  TagIcon,
  CheckBadgeIcon,
  StarIcon,
  MapPinIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultKind = "organisation" | "project" | "user" | "tag";

interface BaseResult {
  id: string;
  kind: ResultKind;
  title: string;
  description: string;
  createdAt: string;
}

interface OrgResult extends BaseResult {
  kind: "organisation";
  verified: boolean;
  location: string;
  sdgs: number[];
  followerCount: number;
  rating: number;
  logoUrl?: string;
}

interface ProjectResult extends BaseResult {
  kind: "project";
  orgName: string;
  orgId: string;
  tags: string[];
  sdgs: number[];
  status: "active" | "completed" | "draft";
}

interface UserResult extends BaseResult {
  kind: "user";
  username: string;
  role: string;
  avatarUrl?: string;
  orgs: string[];
}

interface TagResult extends BaseResult {
  kind: "tag";
  count: number;
  relatedTags: string[];
}

type SearchResult = OrgResult | ProjectResult | UserResult | TagResult;

interface SearchResponse {
  results: SearchResult[];
  total: number;
  took: number;
}

// ─── Mock fallback data ───────────────────────────────────────────────────────

function generateMockResults(q: string, kind: ResultKind | "all"): SearchResult[] {
  const base = q.toLowerCase();
  const mock: SearchResult[] = [
    {
      id: "org-1",
      kind: "organisation",
      title: `${q} Foundation`,
      description: `A leading organisation working on ${base}-related initiatives across the globe, building sustainable futures.`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
      verified: true,
      location: "Geneva, Switzerland",
      sdgs: [1, 3, 10, 17],
      followerCount: 4821,
      rating: 4.7,
    } as OrgResult,
    {
      id: "org-2",
      kind: "organisation",
      title: `Global ${q} Alliance`,
      description: `Connecting stakeholders to advance ${base} policy frameworks and impact measurement.`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
      verified: false,
      location: "Nairobi, Kenya",
      sdgs: [2, 6, 13],
      followerCount: 1230,
      rating: 3.9,
    } as OrgResult,
    {
      id: "proj-1",
      kind: "project",
      title: `${q} Impact Accelerator 2024`,
      description: `A 12-month program to accelerate high-impact ${base} solutions in underserved communities.`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      orgName: `${q} Foundation`,
      orgId: "org-1",
      tags: [base, "impact", "accelerator", "2024"],
      sdgs: [1, 8, 10],
      status: "active",
    } as ProjectResult,
    {
      id: "proj-2",
      kind: "project",
      title: `Mapping ${q} Resources`,
      description: `Open-data initiative to map and visualise ${base} resources across 50 countries.`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
      orgName: `Global ${q} Alliance`,
      orgId: "org-2",
      tags: [base, "open-data", "mapping"],
      sdgs: [9, 17],
      status: "active",
    } as ProjectResult,
    {
      id: "user-1",
      kind: "user",
      title: `Alex ${q.charAt(0).toUpperCase() + q.slice(1)}`,
      description: `Policy researcher and advocate with 8 years experience in ${base} sector.`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString(),
      username: `alex_${base}`,
      role: "Researcher",
      orgs: [`${q} Foundation`],
    } as UserResult,
    {
      id: "tag-1",
      kind: "tag",
      title: `#${base}`,
      description: `Browse all content tagged with #${base}`,
      createdAt: new Date().toISOString(),
      count: 382,
      relatedTags: [`${base}-policy`, `${base}-impact`, `sustainable-${base}`],
    } as TagResult,
  ];

  if (kind === "all") return mock;
  return mock.filter((r) => r.kind === kind);
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchResults(
  q: string,
  kind: ResultKind | "all",
  page: number
): Promise<SearchResponse> {
  try {
    const params = new URLSearchParams({ q, kind, page: String(page) });
    const res = await fetch(`/api/search?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("API error");
    return res.json();
  } catch {
    await new Promise((r) => setTimeout(r, 300));
    const results = generateMockResults(q, kind);
    return { results, total: results.length, took: 12 };
  }
}

// ─── SDG badge colours ────────────────────────────────────────────────────────

const SDG_COLORS: Record<number, string> = {
  1: "#E5243B", 2: "#DDA63A", 3: "#4C9F38", 4: "#C5192D",
  5: "#FF3A21", 6: "#26BDE2", 7: "#FCC30B", 8: "#A21942",
  9: "#FD6925", 10: "#DD1367", 11: "#FD9D24", 12: "#BF8B2E",
  13: "#3F7E44", 14: "#0A97D9", 15: "#56C02B", 16: "#00689D",
  17: "#19486A",
};

function SdgBadge({ n }: { n: number }) {
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold"
      style={{ backgroundColor: SDG_COLORS[n] ?? "#555" }}
      title={`SDG ${n}`}
    >
      {n}
    </span>
  );
}

// ─── Star rating ──────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i}>
          {i <= Math.round(rating) ? (
            <StarSolid className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <StarIcon className="w-3.5 h-3.5 text-neutral-600" />
          )}
        </span>
      ))}
      <span className="ml-1 text-xs text-neutral-400">{rating.toFixed(1)}</span>
    </span>
  );
}

// ─── Result cards ─────────────────────────────────────────────────────────────

function OrgCard({ r }: { r: OrgResult }) {
  return (
    <Link
      href={`/organisation/${r.id}`}
      className="group flex gap-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/60 hover:bg-neutral-800/60 transition-all duration-200"
    >
      <div className="shrink-0 w-12 h-12 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden">
        {r.logoUrl ? (
          <img src={r.logoUrl} alt={r.title} className="w-full h-full object-cover" />
        ) : (
          <BuildingOffice2Icon className="w-6 h-6 text-neutral-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
              {r.title}
            </span>
            {r.verified && (
              <CheckBadgeIcon className="w-4 h-4 text-indigo-400 shrink-0" title="Verified" />
            )}
          </div>
          <Stars rating={r.rating} />
        </div>
        <p className="text-sm text-neutral-400 mt-1 line-clamp-2">{r.description}</p>
        <div className="flex flex-wrap items-center gap-3 mt-2.5">
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <MapPinIcon className="w-3.5 h-3.5" /> {r.location}
          </span>
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <UserGroupIcon className="w-3.5 h-3.5" /> {r.followerCount.toLocaleString()} followers
          </span>
          <div className="flex items-center gap-1">
            {r.sdgs.map((n) => (
              <SdgBadge key={n} n={n} />
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProjectCard({ r }: { r: ProjectResult }) {
  const statusColor =
    r.status === "active"
      ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
      : r.status === "completed"
      ? "text-sky-400 bg-sky-400/10 border-sky-400/20"
      : "text-neutral-400 bg-neutral-400/10 border-neutral-400/20";

  return (
    <Link
      href={`/projects/${r.id}`}
      className="group flex gap-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/60 hover:bg-neutral-800/60 transition-all duration-200"
    >
      <div className="shrink-0 w-12 h-12 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center">
        <DocumentTextIcon className="w-6 h-6 text-neutral-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
            {r.title}
          </span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusColor}`}>
            {r.status}
          </span>
        </div>
        <Link
          href={`/organisation/${r.orgId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-indigo-400 hover:underline mt-0.5 inline-block"
        >
          {r.orgName}
        </Link>
        <p className="text-sm text-neutral-400 mt-1 line-clamp-2">{r.description}</p>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {r.sdgs.map((n) => (
            <SdgBadge key={n} n={n} />
          ))}
          {r.tags.map((t) => (
            <span
              key={t}
              className="text-[11px] text-neutral-400 bg-neutral-800 border border-neutral-700 rounded-full px-2 py-0.5"
            >
              #{t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function UserCard({ r }: { r: UserResult }) {
  const initials = r.title
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      href={`/profile/${r.username}`}
      className="group flex gap-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/60 hover:bg-neutral-800/60 transition-all duration-200"
    >
      <div className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
        {r.avatarUrl ? (
          <img src={r.avatarUrl} alt={r.title} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
            {r.title}
          </span>
          <span className="text-xs text-neutral-500">@{r.username}</span>
          <span className="text-[11px] text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 rounded-full px-2 py-0.5">
            {r.role}
          </span>
        </div>
        <p className="text-sm text-neutral-400 mt-1 line-clamp-2">{r.description}</p>
        {r.orgs.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {r.orgs.map((o) => (
              <span
                key={o}
                className="text-[11px] text-neutral-400 bg-neutral-800 border border-neutral-700 rounded-full px-2 py-0.5 flex items-center gap-1"
              >
                <BuildingOffice2Icon className="w-3 h-3" /> {o}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function TagCard({ r }: { r: TagResult }) {
  return (
    <Link
      href={`/tags/${r.title.replace("#", "")}`}
      className="group flex gap-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/60 hover:bg-neutral-800/60 transition-all duration-200"
    >
      <div className="shrink-0 w-12 h-12 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center">
        <TagIcon className="w-6 h-6 text-neutral-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
            {r.title}
          </span>
          <span className="text-xs text-neutral-400">{r.count.toLocaleString()} items</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {r.relatedTags.map((t) => (
            <span
              key={t}
              className="text-[11px] text-neutral-400 bg-neutral-800 border border-neutral-700 rounded-full px-2 py-0.5"
            >
              #{t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  switch (result.kind) {
    case "organisation":
      return <OrgCard r={result} />;
    case "project":
      return <ProjectCard r={result} />;
    case "user":
      return <UserCard r={result} />;
    case "tag":
      return <TagCard r={result} />;
  }
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

type KindFilter = ResultKind | "all";

const KIND_LABELS: { value: KindFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <MagnifyingGlassIcon className="w-3.5 h-3.5" /> },
  { value: "organisation", label: "Orgs", icon: <BuildingOffice2Icon className="w-3.5 h-3.5" /> },
  { value: "project", label: "Projects", icon: <DocumentTextIcon className="w-3.5 h-3.5" /> },
  { value: "user", label: "People", icon: <UserGroupIcon className="w-3.5 h-3.5" /> },
  { value: "tag", label: "Tags", icon: <TagIcon className="w-3.5 h-3.5" /> },
];

// ─── Sort options ──────────────────────────────────────────────────────────────

type SortOption = "relevance" | "newest" | "popular";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Most Relevant" },
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
];

// ─── Main search page (inner) ─────────────────────────────────────────────────

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQ = searchParams.get("q") ?? "";
  const initialKind = (searchParams.get("kind") as KindFilter) ?? "all";
  const initialSort = (searchParams.get("sort") as SortOption) ?? "relevance";

  const [query, setQuery] = useState(initialQ);
  const [inputVal, setInputVal] = useState(initialQ);
  const [kind, setKind] = useState<KindFilter>(initialKind);
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [took, setTook] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sdgFilter, setSdgFilter] = useState<number[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const PER_PAGE = 10;

  const doSearch = useCallback(
    async (q: string, k: KindFilter, p: number) => {
      if (!q.trim()) return;
      setLoading(true);
      try {
        const data = await fetchResults(q, k, p);
        if (p === 1) {
          setResults(data.results);
        } else {
          setResults((prev) => [...prev, ...data.results]);
        }
        setTotal(data.total);
        setTook(data.took);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (query) doSearch(query, kind, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kind, page]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputVal.trim();
    if (!q) return;
    setPage(1);
    setQuery(q);
    const params = new URLSearchParams({ q, kind, sort });
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  const handleKind = (k: KindFilter) => {
    setKind(k);
    setPage(1);
    const params = new URLSearchParams({ q: query, kind: k, sort });
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  const handleClear = () => {
    setInputVal("");
    setQuery("");
    setResults([]);
    setTotal(0);
    router.push("/search", { scroll: false });
  };

  const toggleSdg = (n: number) => {
    setSdgFilter((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  };

  const filteredResults = results.filter((r) => {
    if (verifiedOnly && r.kind === "organisation" && !r.verified) return false;
    if (sdgFilter.length > 0) {
      if (r.kind === "organisation" || r.kind === "project") {
        const hasSdg = sdgFilter.some((n) => r.sdgs.includes(n));
        if (!hasSdg) return false;
      }
    }
    return true;
  });

  const hasMore = results.length < total;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* ── Header / search bar ── */}
      <div className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur border-b border-neutral-800 px-4 py-3">
        <div className="max-w-3xl mx-auto space-y-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Search organisations, projects, people…"
                className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-white placeholder-neutral-500 transition"
                autoFocus
              />
              {inputVal && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`p-2.5 rounded-lg border transition ${
                showFilters
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white"
              }`}
              title="Filters"
            >
              <AdjustmentsHorizontalIcon className="w-4 h-4" />
            </button>
          </form>

          {/* Kind filter pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {KIND_LABELS.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => handleKind(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition ${
                  kind === value
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2 shrink-0">
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortOption);
                  setPage(1);
                }}
                className="bg-neutral-900 border border-neutral-700 text-neutral-400 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Expandable filter panel */}
          {showFilters && (
            <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  SDGs
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(SDG_COLORS).map((k) => {
                    const n = Number(k);
                    const active = sdgFilter.includes(n);
                    return (
                      <button
                        key={n}
                        onClick={() => toggleSdg(n)}
                        className={`w-8 h-8 rounded-full text-white text-[10px] font-bold border-2 transition ${
                          active ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-90"
                        }`}
                        style={{ backgroundColor: SDG_COLORS[n] }}
                        title={`SDG ${n}`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setVerifiedOnly((v) => !v)}
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      verifiedOnly ? "bg-indigo-600" : "bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        verifiedOnly ? "translate-x-4" : ""
                      }`}
                    />
                  </div>
                  <span className="text-sm text-neutral-300 flex items-center gap-1">
                    <CheckBadgeIcon className="w-4 h-4 text-indigo-400" />
                    Verified only
                  </span>
                </label>

                {(sdgFilter.length > 0 || verifiedOnly) && (
                  <button
                    onClick={() => {
                      setSdgFilter([]);
                      setVerifiedOnly(false);
                    }}
                    className="ml-auto text-xs text-neutral-500 hover:text-white transition"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Results area ── */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Meta line */}
        {query && !loading && results.length > 0 && (
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              {total.toLocaleString()} result{total !== 1 ? "s" : ""} for{" "}
              <span className="text-neutral-300 font-medium">"{query}"</span>
            </span>
            <span>{took}ms</span>
          </div>
        )}

        {/* Active filter chips */}
        {(sdgFilter.length > 0 || verifiedOnly) && (
          <div className="flex flex-wrap gap-2">
            {sdgFilter.map((n) => (
              <button
                key={n}
                onClick={() => toggleSdg(n)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-red-500/50 hover:text-red-400 transition"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: SDG_COLORS[n] }}
                />
                SDG {n}
                <XMarkIcon className="w-3 h-3" />
              </button>
            ))}
            {verifiedOnly && (
              <button
                onClick={() => setVerifiedOnly(false)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-red-500/50 hover:text-red-400 transition"
              >
                <CheckBadgeIcon className="w-3.5 h-3.5 text-indigo-400" />
                Verified only
                <XMarkIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && page === 1 && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-neutral-900 border border-neutral-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty / no-query state */}
        {!loading && !query && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <MagnifyingGlassIcon className="w-12 h-12 text-neutral-700 mb-4" />
            <p className="text-neutral-400 text-lg font-medium">Search FreeTrust</p>
            <p className="text-neutral-600 text-sm mt-1 max-w-xs">
              Find organisations, projects, people, and topics across the platform.
            </p>
          </div>
        )}

        {/* No results */}
        {!loading && query && filteredResults.length === 0 && results.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AdjustmentsHorizontalIcon className="w-10 h-10 text-neutral-700 mb-3" />
            <p className="text-neutral-400 font-medium">No results match your filters</p>
            <button
              onClick={() => {
                setSdgFilter([]);
                setVerifiedOnly(false);
              }}
              className="mt-3 text-sm text-indigo-400 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MagnifyingGlassIcon className="w-10 h-10 text-neutral-700 mb-3" />
            <p className="text-neutral-400 font-medium">No results for "{query}"</p>
            <p className="text-neutral-600 text-sm mt-1">
              Try different keywords or broaden your search.
            </p>
          </div>
        )}

        {/* Results list */}
        {filteredResults.map((r) => (
          <ResultCard key={`${r.kind}-${r.id}`} result={r} />
        ))}

        {/* Load more */}
        {!loading && hasMore && filteredResults.length > 0 && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-6 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 hover:border-indigo-500/60 text-sm text-neutral-300 hover:text-white transition flex items-center gap-2"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Load more results
            </button>
          </div>
        )}

        {/* Load more spinner */}
        {loading && page > 1 && (
          <div className="flex justify-center py-4">
            <ArrowPathIcon className="w-5 h-5 text-neutral-500 animate-spin" />
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Exported page (Suspense boundary for useSearchParams) ───────────────────

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
          <ArrowPathIcon className="w-6 h-6 text-neutral-600 animate-spin" />
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}

