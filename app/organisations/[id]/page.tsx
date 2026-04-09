"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  UserGroupIcon,
  StarIcon,
  MapPinIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  CubeIcon,
  ChatBubbleLeftRightIcon,
  UserPlusIcon,
  UserMinusIcon,
  FlagIcon,
  ShareIcon,
  CheckBadgeIcon,
  ArrowLeftIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────

type OrgTab = "overview" | "services" | "products" | "members" | "reviews";

interface Organisation {
  id: string;
  creator_id: string;
  name: string;
  slug: string;
  type: string | null;
  description: string;
  location: string | null;
  website: string | null;
  sector: string | null;
  tags: string[];
  logo_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
  members_count: number;
  trust_score: number;
  status: string;
  founded_year: number | null;
  size: string | null;
  tagline: string | null;
  impact_statement: string | null;
  sdgs: string[];
  created_at: string;
  updated_at: string;
  isFollowing: boolean;
  userId: string | null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TrustBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? "text-emerald-400 bg-emerald-900/40"
      : score >= 70
      ? "text-amber-400 bg-amber-900/40"
      : "text-red-400 bg-red-900/40";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${color}`}
    >
      <ShieldCheckIcon className="h-4 w-4" />
      {score}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-gray-800 bg-gray-900 px-4 py-4">
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
      <span className="mt-1 text-xs font-medium text-gray-400">{label}</span>
    </div>
  );
}

function EmptyTabState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-gray-800 p-5 mb-4">
        <BriefcaseIcon className="h-8 w-8 text-gray-500" />
      </div>
      <h3 className="text-base font-semibold text-white">{label}</h3>
      <p className="mt-1 text-sm text-gray-500">
        This section will be available soon.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950 animate-pulse">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="h-4 w-16 rounded bg-gray-800" />
      </div>
      <div className="relative mx-auto mt-2 max-w-6xl px-4">
        <div className="h-52 md:h-72 w-full rounded-2xl bg-gray-800" />
        <div className="absolute -bottom-14 left-6 h-24 w-24 rounded-2xl bg-gray-700 border-4 border-gray-950" />
      </div>
      <div className="mx-auto mt-20 max-w-6xl px-4 space-y-4">
        <div className="h-8 w-64 rounded bg-gray-800" />
        <div className="h-4 w-96 rounded bg-gray-800" />
        <div className="h-4 w-80 rounded bg-gray-800" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-800" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OrgProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [org, setOrg] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<OrgTab>("overview");
  const [isFollowing, setIsFollowing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    fetch(`/api/organisations/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setOrg(data as Organisation);
          setIsFollowing(data.isFollowing ?? false);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  function handleFollow() {
    setIsFollowing((prev) => !prev);
    // TODO: wire up follow/unfollow API when available
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) return <LoadingSkeleton />;

  if (notFound || !org) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-center px-4">
        <div className="rounded-full bg-gray-800 p-6 mb-6">
          <BuildingOfficeIcon className="h-10 w-10 text-gray-500" />
        </div>
        <h1 className="text-2xl font-bold text-white">Organisation not found</h1>
        <p className="mt-2 text-sm text-gray-400">
          This organisation doesn&apos;t exist or may have been removed.
        </p>
        <Link
          href="/organisations"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
        >
          Browse organisations
        </Link>
      </div>
    );
  }

  const tabs: { key: OrgTab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BriefcaseIcon className="h-4 w-4" /> },
    { key: "services", label: "Services", icon: <BriefcaseIcon className="h-4 w-4" /> },
    { key: "products", label: "Products", icon: <CubeIcon className="h-4 w-4" /> },
    {
      key: "members",
      label: `Members (${org.members_count})`,
      icon: <UserGroupIcon className="h-4 w-4" />,
    },
    { key: "reviews", label: "Reviews", icon: <StarIcon className="h-4 w-4" /> },
  ];

  const displayName = org.name || "Unnamed Organisation";
  const trustLabel =
    org.trust_score >= 90 ? "Excellent" : org.trust_score >= 70 ? "Good" : "Fair";

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ── Back ── */}
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* ── Cover ── */}
      <div className="relative mx-auto mt-2 max-w-6xl px-4">
        <div className="relative h-52 md:h-72 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-violet-800 to-indigo-900 shadow-lg">
          {org.cover_url && !coverError && (
            <img
              src={org.cover_url}
              alt="cover"
              className="h-full w-full object-cover"
              onError={() => setCoverError(true)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        {/* ── Logo ── */}
        <div className="absolute -bottom-14 left-6 md:left-10 flex items-end gap-4">
          <div className="relative h-24 w-24 md:h-28 md:w-28 overflow-hidden rounded-2xl border-4 border-gray-950 bg-gray-800 shadow-lg flex items-center justify-center">
            {org.logo_url && !logoError ? (
              <img
                src={org.logo_url}
                alt={displayName}
                className="h-full w-full object-cover"
                onError={() => setLogoError(true)}
              />
            ) : (
              <BuildingOfficeIcon className="h-10 w-10 text-gray-500" />
            )}
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-gray-200 shadow backdrop-blur-sm hover:bg-black/80 transition"
          >
            <ShareIcon className="h-4 w-4" />
            {copied ? "Copied!" : "Share"}
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-gray-200 shadow backdrop-blur-sm hover:bg-black/80 transition">
            <FlagIcon className="h-4 w-4" />
            Report
          </button>
        </div>
      </div>

      {/* ── Profile Header ── */}
      <div className="mx-auto mt-16 max-w-6xl px-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{displayName}</h1>
              {org.is_verified && (
                <CheckBadgeIcon
                  className="h-6 w-6 text-violet-400"
                  title="Verified Organisation"
                />
              )}
              <TrustBadge score={org.trust_score} />
            </div>

            {org.type && (
              <p className="mt-0.5 text-sm text-gray-500">{org.type}</p>
            )}

            {org.tagline && (
              <p className="mt-2 text-sm text-gray-300 leading-relaxed max-w-2xl">
                {org.tagline}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-400">
              {org.location && (
                <span className="flex items-center gap-1">
                  <MapPinIcon className="h-4 w-4 text-gray-500" />
                  {org.location}
                </span>
              )}
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-violet-400 hover:underline"
                >
                  <GlobeAltIcon className="h-4 w-4" />
                  {org.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {org.founded_year && (
                <span className="flex items-center gap-1">
                  <CalendarDaysIcon className="h-4 w-4 text-gray-500" />
                  Founded {org.founded_year}
                </span>
              )}
              {org.size && (
                <span className="flex items-center gap-1">
                  <UserGroupIcon className="h-4 w-4 text-gray-500" />
                  {org.size}
                </span>
              )}
            </div>

            {/* Tags */}
            {org.tags && org.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {org.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-violet-900/40 px-3 py-0.5 text-xs font-medium text-violet-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Follow + Message */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleFollow}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow transition ${
                isFollowing
                  ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  : "bg-violet-600 text-white hover:bg-violet-700"
              }`}
            >
              {isFollowing ? (
                <>
                  <UserMinusIcon className="h-4 w-4" /> Unfollow
                </>
              ) : (
                <>
                  <UserPlusIcon className="h-4 w-4" /> Follow
                </>
              )}
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition">
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              Message
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Trust Score"
            value={org.trust_score.toString()}
            sub={trustLabel}
          />
          <StatCard
            label="Members"
            value={org.members_count.toString()}
            sub="active contributors"
          />
          {org.sector && (
            <StatCard label="Sector" value={org.sector} />
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="mt-8 border-b border-gray-800">
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
                  activeTab === t.key
                    ? "border-violet-500 text-violet-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab Content ── */}
        <div className="mt-6 pb-16">
          {/* Overview */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Main column */}
              <div className="lg:col-span-2 space-y-6">
                {/* About */}
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                  <h2 className="text-base font-semibold text-white">About</h2>
                  <p className="mt-3 text-sm text-gray-300 leading-relaxed">
                    {org.description}
                  </p>
                </div>

                {/* Impact Statement */}
                {org.impact_statement && (
                  <div className="rounded-xl border border-violet-800/50 bg-violet-900/20 p-6">
                    <h2 className="text-base font-semibold text-violet-300">
                      Impact Statement
                    </h2>
                    <p className="mt-3 text-sm text-gray-300 leading-relaxed">
                      {org.impact_statement}
                    </p>
                  </div>
                )}

                {/* SDGs */}
                {org.sdgs && org.sdgs.length > 0 && (
                  <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                    <h2 className="text-base font-semibold text-white mb-3">
                      Sustainable Development Goals
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {org.sdgs.map((sdg) => (
                        <span
                          key={sdg}
                          className="rounded-full bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-300"
                        >
                          {sdg}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Services preview */}
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-white">Services</h2>
                    <button
                      onClick={() => setActiveTab("services")}
                      className="text-xs font-medium text-violet-400 hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <EmptyTabState label="No services listed yet" />
                </div>

                {/* Reviews preview */}
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-white">Reviews</h2>
                    <button
                      onClick={() => setActiveTab("reviews")}
                      className="text-xs font-medium text-violet-400 hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <EmptyTabState label="No reviews yet" />
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                {/* Trust Score */}
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">Trust Score</h3>
                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                        <circle
                          cx="18"
                          cy="18"
                          r="15.915"
                          fill="none"
                          stroke="#1f2937"
                          strokeWidth="3"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15.915"
                          fill="none"
                          stroke="#7c3aed"
                          strokeWidth="3"
                          strokeDasharray={`${org.trust_score} ${100 - org.trust_score}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-violet-400">
                        {org.trust_score}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{trustLabel}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                        Based on delivery rate, reviews, and compliance.
                      </p>
                    </div>
                  </div>
                  {org.is_verified && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-900/30 px-3 py-2">
                      <ShieldCheckIcon className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-xs font-medium text-emerald-400">
                        Verified Organisation
                      </p>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-white">Details</h3>
                  {org.type && (
                    <div className="flex items-start gap-2 text-sm">
                      <BuildingOfficeIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Type</p>
                        <p className="text-gray-300">{org.type}</p>
                      </div>
                    </div>
                  )}
                  {org.sector && (
                    <div className="flex items-start gap-2 text-sm">
                      <BriefcaseIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Sector</p>
                        <p className="text-gray-300">{org.sector}</p>
                      </div>
                    </div>
                  )}
                  {org.size && (
                    <div className="flex items-start gap-2 text-sm">
                      <UserGroupIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Size</p>
                        <p className="text-gray-300">{org.size}</p>
                      </div>
                    </div>
                  )}
                  {org.founded_year && (
                    <div className="flex items-start gap-2 text-sm">
                      <CalendarDaysIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Founded</p>
                        <p className="text-gray-300">{org.founded_year}</p>
                      </div>
                    </div>
                  )}
                  {org.location && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPinIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Location</p>
                        <p className="text-gray-300">{org.location}</p>
                      </div>
                    </div>
                  )}
                  {org.website && (
                    <div className="flex items-start gap-2 text-sm">
                      <GlobeAltIcon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Website</p>
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 hover:underline truncate block"
                        >
                          {org.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Services Tab */}
          {activeTab === "services" && (
            <EmptyTabState label="Services coming soon" />
          )}

          {/* Products Tab */}
          {activeTab === "products" && (
            <EmptyTabState label="Products coming soon" />
          )}

          {/* Members Tab */}
          {activeTab === "members" && (
            <div>
              <p className="mb-5 text-sm text-gray-500">
                {org.members_count} active member{org.members_count !== 1 ? "s" : ""}
              </p>
              <EmptyTabState label="Member profiles coming soon" />
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === "reviews" && (
            <EmptyTabState label="Reviews coming soon" />
          )}
        </div>
      </div>
    </div>
  );
}
