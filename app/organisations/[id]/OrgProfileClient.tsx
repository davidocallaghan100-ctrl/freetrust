"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import {
  UserGroupIcon,
  StarIcon,
  MapPinIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  UserPlusIcon,
  UserMinusIcon,
  FlagIcon,
  ShareIcon,
  CheckBadgeIcon,
  ArrowLeftIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────

type OrgTab = "overview" | "members" | "followers" | "reviews";

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

interface OrgMember {
  id: string;
  role: "owner" | "admin" | "member";
  title: string | null;
  joined_at: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    username: string | null;
    trust_balance: number;
    avg_rating: number | null;
    review_count: number;
    bio: string | null;
    location: string | null;
  };
}

interface FollowerProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username: string | null;
  trust_balance: number;
}

interface OrgReview {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  created_at: string;
  reviewer: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
    trust_balance: number | null;
  } | null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: OrgMember["role"] }) {
  const map: Record<OrgMember["role"], { label: string; cls: string }> = {
    owner: { label: "Owner", cls: "bg-violet-900/50 text-violet-300 border border-violet-800/50" },
    admin: { label: "Admin", cls: "bg-blue-900/50 text-blue-300 border border-blue-800/50" },
    member: { label: "Member", cls: "bg-gray-800 text-gray-400 border border-gray-700" },
  };
  const { label, cls } = map[role];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function MemberCard({ member }: { member: OrgMember }) {
  return (
    <Link
      href={`/profile?id=${member.profile.id}`}
      className="flex items-center gap-3 p-4 rounded-2xl bg-gray-900/60 border border-gray-800 hover:border-violet-700/50 hover:bg-gray-900 transition-all group"
    >
      <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-800 flex-shrink-0 flex items-center justify-center ring-2 ring-gray-800 group-hover:ring-violet-800/50 transition-all">
        {member.profile.avatar_url ? (
          <img src={member.profile.avatar_url} alt={member.profile.full_name} className="h-full w-full object-cover" />
        ) : (
          <UserIcon className="h-5 w-5 text-gray-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate group-hover:text-violet-200 transition-colors">{member.profile.full_name}</p>
        {member.title && <p className="text-xs text-gray-500 truncate mt-0.5">{member.title}</p>}
        <p className="text-xs text-violet-400/80 mt-0.5 font-medium">₮{(member.profile.trust_balance ?? 0).toLocaleString()}</p>
      </div>
      <RoleBadge role={member.role} />
    </Link>
  );
}

function FollowerCard({ follower }: { follower: FollowerProfile }) {
  return (
    <Link
      href={`/profile?id=${follower.id}`}
      className="flex items-center gap-3 p-4 rounded-2xl bg-gray-900/60 border border-gray-800 hover:border-violet-700/50 hover:bg-gray-900 transition-all group"
    >
      <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-800 flex-shrink-0 flex items-center justify-center ring-2 ring-gray-800 group-hover:ring-violet-800/50 transition-all">
        {follower.avatar_url ? (
          <img src={follower.avatar_url} alt={follower.full_name} className="h-full w-full object-cover" />
        ) : (
          <UserIcon className="h-5 w-5 text-gray-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate group-hover:text-violet-200 transition-colors">{follower.full_name}</p>
        {follower.username && <p className="text-xs text-gray-500 truncate mt-0.5">@{follower.username}</p>}
      </div>
      <span className="text-xs text-violet-400/80 font-medium flex-shrink-0">₮{(follower.trust_balance ?? 0).toLocaleString()}</span>
    </Link>
  );
}

function EmptyState({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon && <div className="rounded-full bg-gray-900 border border-gray-800 p-5 mb-4">{icon}</div>}
      <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
      {sub && <p className="mt-1.5 text-xs text-gray-500 max-w-xs leading-relaxed">{sub}</p>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950 animate-pulse">
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="h-4 w-14 rounded-lg bg-gray-800" />
      </div>
      <div className="relative mx-auto mt-2 max-w-5xl px-4">
        <div className="h-56 md:h-72 w-full rounded-3xl bg-gray-800" />
        <div className="absolute -bottom-14 left-6 h-28 w-28 rounded-3xl bg-gray-700 border-4 border-gray-950" />
      </div>
      <div className="mx-auto mt-20 max-w-5xl px-4 space-y-3">
        <div className="h-8 w-64 rounded-lg bg-gray-800" />
        <div className="h-4 w-96 rounded-lg bg-gray-800" />
        <div className="h-4 w-72 rounded-lg bg-gray-800" />
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-800" />)}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OrgProfilePage({ orgId }: { orgId: string }) {
  const router = useRouter();
  const id = orgId;

  const [org, setOrg] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<OrgTab>("overview");
  const [isFollowing, setIsFollowing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Members
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Followers
  const [followers, setFollowers] = useState<FollowerProfile[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followersLoaded, setFollowersLoaded] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<OrgReview[]>([]);
  const [reviewsAvg, setReviewsAvg] = useState<number | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Load org
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/organisations/${id}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return null; }
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

  // Load follower count
  useEffect(() => {
    if (!org) return;
    fetch(`/api/organisations/${id}/followers`)
      .then(r => r.json())
      .then(d => { setFollowerCount(d.count ?? 0); })
      .catch(() => {});
  }, [org, id]);

  // Load members on tab open
  useEffect(() => {
    if (activeTab === "members" && org && members.length === 0 && !membersLoading) {
      setMembersLoading(true);
      fetch(`/api/organisations/${id}/members`)
        .then(r => r.json())
        .then(d => setMembers(d.members ?? []))
        .catch(() => {})
        .finally(() => setMembersLoading(false));
    }
  }, [activeTab, org, id, members.length, membersLoading]);

  // Load followers on tab open
  useEffect(() => {
    if (activeTab === "followers" && org && !followersLoaded && !followersLoading) {
      setFollowersLoading(true);
      fetch(`/api/organisations/${id}/followers`)
        .then(r => r.json())
        .then(d => {
          setFollowers(d.followers ?? []);
          setFollowerCount(d.count ?? 0);
          setFollowersLoaded(true);
        })
        .catch(() => {})
        .finally(() => setFollowersLoading(false));
    }
  }, [activeTab, org, id, followersLoaded, followersLoading]);

  // Load reviews on tab open
  useEffect(() => {
    if (activeTab === "reviews" && org && !reviewsLoaded && !reviewsLoading) {
      setReviewsLoading(true);
      fetch(`/api/organisations/${id}/reviews`)
        .then(r => r.json())
        .then(d => {
          setReviews(d.reviews ?? []);
          setReviewsAvg(d.avg ?? null);
          setReviewsLoaded(true);
        })
        .catch(() => {})
        .finally(() => setReviewsLoading(false));
    }
  }, [activeTab, org, id, reviewsLoaded, reviewsLoading]);

  async function handleReviewSubmit() {
    if (!reviewContent.trim()) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/organisations/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, title: reviewTitle.trim() || null, content: reviewContent.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setReviews(prev => [d.review, ...prev.filter((r: OrgReview) => r.reviewer?.id !== d.review.reviewer?.id)]);
        const allReviews = [...reviews, d.review];
        const newAvg = Math.round((allReviews.reduce((s: number, r: OrgReview) => s + r.rating, 0) / allReviews.length) * 10) / 10;
        setReviewsAvg(newAvg);
        setShowReviewForm(false);
        setReviewTitle('');
        setReviewContent('');
        setReviewRating(5);
      }
    } catch { /* silent */ }
    finally { setReviewSubmitting(false); }
  }

  function handleFollow() {
    if (!org) return;
    const nowFollowing = !isFollowing;
    setIsFollowing(nowFollowing);
    setFollowerCount(c => nowFollowing ? c + 1 : Math.max(0, c - 1));
    fetch(`/api/organisations/${id}/follow`, {
      method: nowFollowing ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {
      setIsFollowing(!nowFollowing);
      setFollowerCount(c => nowFollowing ? Math.max(0, c - 1) : c + 1);
    });
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
        <div className="rounded-full bg-gray-900 border border-gray-800 p-6 mb-6">
          <BuildingOfficeIcon className="h-10 w-10 text-gray-600" />
        </div>
        <h1 className="text-xl font-bold text-white">Organisation not found</h1>
        <p className="mt-2 text-sm text-gray-400 max-w-sm">This organisation doesn&apos;t exist or may have been removed.</p>
        <Link href="/organisations" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition">
          Browse organisations
        </Link>
      </div>
    );
  }

  const displayName = org.name || "Unnamed Organisation";
  const trustLabel = org.trust_score >= 90 ? "Excellent" : org.trust_score >= 70 ? "Good" : "Fair";
  const trustColor = org.trust_score >= 90 ? "#10b981" : org.trust_score >= 70 ? "#f59e0b" : "#ef4444";

  const tabs: { key: OrgTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "members", label: "Members", count: org.members_count },
    { key: "followers", label: "Followers", count: followerCount },
    { key: "reviews", label: "Reviews", count: reviews.length > 0 ? reviews.length : undefined },
  ];

  return (
    <div className="min-h-screen bg-gray-950">

      {/* ── HERO SECTION ── */}
      <div className="relative">
        {/* Cover image */}
        <div className="relative h-56 sm:h-72 md:h-80 w-full overflow-hidden bg-gradient-to-br from-violet-950 via-indigo-950 to-gray-950">
          {org.cover_url && !coverError && (
            <img
              src={org.cover_url}
              alt="cover"
              className="h-full w-full object-cover"
              onError={() => setCoverError(true)}
            />
          )}
          {/* Bottom fade to page bg */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent" />
          {/* Top left back button */}
          <div className="absolute top-4 left-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-black/50 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-black/70 transition border border-white/10"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Back
            </button>
          </div>
          {/* Top right action buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-xl bg-black/50 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-black/70 transition border border-white/10"
            >
              <ShareIcon className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Share"}
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-black/50 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-black/70 transition border border-white/10">
              <FlagIcon className="h-3.5 w-3.5" />
              Report
            </button>
          </div>
        </div>

        {/* Logo + name row — overlaps cover bottom */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="relative -mt-14 sm:-mt-16 flex items-end gap-4 sm:gap-5">
            {/* Logo */}
            <div className="h-24 w-24 sm:h-28 sm:w-28 flex-shrink-0 overflow-hidden rounded-2xl sm:rounded-3xl border-4 border-gray-950 bg-gray-900 shadow-2xl flex items-center justify-center">
              {org.logo_url && !logoError ? (
                <img
                  src={org.logo_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <BuildingOfficeIcon className="h-10 w-10 text-gray-600" />
              )}
            </div>

            {/* Name + verified + follow — inline at bottom */}
            <div className="flex-1 min-w-0 pb-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">{displayName}</h1>
                  {org.is_verified && (
                    <CheckBadgeIcon className="h-5 w-5 sm:h-6 sm:w-6 text-violet-400 flex-shrink-0" title="Verified Organisation" />
                  )}
                </div>
                {org.tagline && (
                  <p className="mt-1 text-sm text-gray-400 leading-relaxed max-w-lg">{org.tagline}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleFollow}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    isFollowing
                      ? "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                      : "bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-900/40"
                  }`}
                >
                  {isFollowing
                    ? <><UserMinusIcon className="h-4 w-4" />Unfollow</>
                    : <><UserPlusIcon className="h-4 w-4" />Follow</>}
                </button>
                <button className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800 hover:border-gray-600 transition">
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  Message
                </button>
              </div>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
            {org.type && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs font-medium text-gray-400">
                <BuildingOfficeIcon className="h-3.5 w-3.5" />{org.type}
              </span>
            )}
            {org.location && (
              <span className="flex items-center gap-1.5">
                <MapPinIcon className="h-3.5 w-3.5" />{org.location}
              </span>
            )}
            {org.website && (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 transition">
                <GlobeAltIcon className="h-3.5 w-3.5" />
                {org.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {org.founded_year && (
              <span className="flex items-center gap-1.5">
                <CalendarDaysIcon className="h-3.5 w-3.5" />Est. {org.founded_year}
              </span>
            )}
            {org.sector && (
              <span className="flex items-center gap-1.5">
                <BriefcaseIcon className="h-3.5 w-3.5" />{org.sector}
              </span>
            )}
          </div>

          {/* Tags */}
          {org.tags && org.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {org.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-violet-950/50 border border-violet-800/30 px-2.5 py-0.5 text-xs font-medium text-violet-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats strip */}
          <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
            {/* Trust Score */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/80 px-4 py-4 text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-950/30 to-transparent pointer-events-none" />
              <div className="relative">
                <div className="text-2xl font-bold" style={{ color: trustColor }}>{org.trust_score}</div>
                <div className="text-xs text-gray-500 mt-0.5">{trustLabel}</div>
                <div className="mt-1 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Trust Score</div>
              </div>
            </div>
            {/* Followers */}
            <div className="rounded-2xl border border-gray-800 bg-gray-900/80 px-4 py-4 text-center">
              <div className="text-2xl font-bold text-white">{followerCount.toLocaleString()}</div>
              <div className="mt-1 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Followers</div>
            </div>
            {/* Members */}
            <div className="rounded-2xl border border-gray-800 bg-gray-900/80 px-4 py-4 text-center">
              <div className="text-2xl font-bold text-white">{org.members_count.toLocaleString()}</div>
              <div className="mt-1 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Members</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-800/80">
            <nav className="-mb-px flex gap-0 overflow-x-auto scrollbar-hide">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`relative whitespace-nowrap px-5 py-3.5 text-sm font-medium transition-all ${
                    activeTab === t.key
                      ? "text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      activeTab === t.key
                        ? "bg-violet-600/30 text-violet-300"
                        : "bg-gray-800 text-gray-500"
                    }`}>
                      {t.count}
                    </span>
                  )}
                  {activeTab === t.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-violet-500" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 mt-6 pb-24">

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-4">
              {/* About */}
              <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">About</h2>
                <p className="text-sm text-gray-300 leading-relaxed">{org.description}</p>
              </div>

              {/* Impact Statement */}
              {org.impact_statement && (
                <div className="relative overflow-hidden rounded-2xl border border-violet-800/30 bg-violet-950/20 p-5 sm:p-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 to-transparent pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheckIcon className="h-4 w-4 text-violet-400" />
                      <h2 className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Impact Statement</h2>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{org.impact_statement}</p>
                  </div>
                </div>
              )}

              {/* SDGs */}
              {org.sdgs && org.sdgs.length > 0 && (
                <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Sustainable Development Goals</h2>
                  <div className="flex flex-wrap gap-2">
                    {org.sdgs.map((sdg) => (
                      <span key={sdg} className="rounded-full bg-emerald-900/30 border border-emerald-800/40 px-3 py-1 text-xs font-medium text-emerald-400">
                        {sdg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Trust Score card */}
              <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Trust Score</h3>
                <div className="flex items-center gap-4">
                  {/* SVG ring */}
                  <div className="relative h-[72px] w-[72px] flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1f2937" strokeWidth="3.5" />
                      <circle
                        cx="18" cy="18" r="15.915" fill="none"
                        stroke={trustColor}
                        strokeWidth="3.5"
                        strokeDasharray={`${org.trust_score} ${100 - org.trust_score}`}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${trustColor}60)` }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: trustColor }}>
                      {org.trust_score}
                    </span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">{trustLabel}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">Based on reviews &amp; compliance</p>
                  </div>
                </div>
                {org.is_verified && (
                  <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-emerald-900/20 border border-emerald-800/30 px-3 py-2.5">
                    <ShieldCheckIcon className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-xs font-semibold text-emerald-400">Verified Organisation</p>
                  </div>
                )}
              </div>

              {/* Details card */}
              <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Details</h3>
                <div className="space-y-3.5">
                  {([
                    org.type       && { icon: <BuildingOfficeIcon className="h-4 w-4" />, label: "Type",     value: org.type },
                    org.sector     && { icon: <BriefcaseIcon className="h-4 w-4" />,      label: "Sector",   value: org.sector },
                    org.size       && { icon: <UserGroupIcon className="h-4 w-4" />,      label: "Size",     value: org.size },
                    org.founded_year && { icon: <CalendarDaysIcon className="h-4 w-4" />, label: "Founded",  value: String(org.founded_year) },
                    org.location   && { icon: <MapPinIcon className="h-4 w-4" />,         label: "Location", value: org.location },
                  ] as (false | { icon: React.ReactNode; label: string; value: string })[])
                    .filter(Boolean)
                    .map((item) => {
                      const d = item as { icon: React.ReactNode; label: string; value: string };
                      return (
                        <div key={d.label} className="flex items-start gap-3">
                          <span className="text-gray-600 mt-0.5 flex-shrink-0">{d.icon}</span>
                          <div>
                            <p className="text-[11px] text-gray-600 uppercase tracking-wider font-medium">{d.label}</p>
                            <p className="text-sm text-gray-300 mt-0.5">{d.value}</p>
                          </div>
                        </div>
                      );
                    })}
                  {org.website && (
                    <div className="flex items-start gap-3">
                      <GlobeAltIcon className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-gray-600 uppercase tracking-wider font-medium">Website</p>
                        <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-400 hover:text-violet-300 transition truncate block mt-0.5">
                          {org.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <UserPlusIcon className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-gray-600 uppercase tracking-wider font-medium">Followers</p>
                      <p className="text-sm text-gray-300 mt-0.5">{followerCount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MEMBERS ── */}
        {activeTab === "members" && (
          <div>
            <p className="mb-4 text-xs text-gray-600 uppercase tracking-widest font-medium">
              {org.members_count} active member{org.members_count !== 1 ? "s" : ""}
            </p>
            {membersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-[76px] rounded-2xl bg-gray-900 animate-pulse border border-gray-800" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <EmptyState
                icon={<UserGroupIcon className="h-8 w-8 text-gray-600" />}
                title="No members listed yet"
                sub="Members will appear here once added to the organisation."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map((m) => <MemberCard key={m.id} member={m} />)}
              </div>
            )}
          </div>
        )}

        {/* ── FOLLOWERS ── */}
        {activeTab === "followers" && (
          <div>
            <p className="mb-4 text-xs text-gray-600 uppercase tracking-widest font-medium">
              {followerCount} follower{followerCount !== 1 ? "s" : ""}
            </p>
            {followersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-[76px] rounded-2xl bg-gray-900 animate-pulse border border-gray-800" />
                ))}
              </div>
            ) : followers.length === 0 ? (
              <EmptyState
                icon={<UserPlusIcon className="h-8 w-8 text-gray-600" />}
                title="No followers yet"
                sub="Be the first to follow this organisation."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {followers.map((f) => <FollowerCard key={f.id} follower={f} />)}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS ── */}
        {activeTab === "reviews" && (
          <div>
            {/* Rating summary */}
            {reviewsAvg !== null && reviews.length > 0 && (
              <div className="flex items-center gap-5 mb-5 p-5 rounded-2xl bg-gray-900/60 border border-gray-800">
                <div className="text-center flex-shrink-0">
                  <div className="text-4xl font-bold text-white">{reviewsAvg.toFixed(1)}</div>
                  <div className="flex gap-0.5 justify-center mt-1.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <StarIcon key={s} className={`h-4 w-4 ${s <= Math.round(reviewsAvg!) ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`} />
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1.5">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map(s => {
                    const count = reviews.filter(r => r.rating === s).length;
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-2 flex-shrink-0">{s}</span>
                        <StarIcon className="h-3 w-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-600 w-4 text-right flex-shrink-0">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Write review button */}
            {!showReviewForm && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="w-full mb-5 flex items-center justify-center gap-2 rounded-2xl border border-violet-700/40 bg-violet-950/20 py-3 text-sm font-semibold text-violet-400 hover:bg-violet-950/40 hover:border-violet-600/50 transition"
              >
                <StarIcon className="h-4 w-4" />
                Write a Review
              </button>
            )}

            {/* Review form */}
            {showReviewForm && (
              <div className="mb-5 p-5 rounded-2xl bg-gray-900/80 border border-violet-700/30">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-white">Your Review</span>
                  <button
                    onClick={() => setShowReviewForm(false)}
                    className="rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition p-1.5 text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setReviewRating(s)} className="p-0.5">
                      <StarIcon className={`h-7 w-7 transition ${s <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-gray-700 hover:text-amber-300'}`} />
                    </button>
                  ))}
                </div>
                <input
                  className="w-full mb-3 rounded-xl bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600/40 transition"
                  style={{ fontSize: '16px' }}
                  placeholder="Title (optional)"
                  value={reviewTitle}
                  onChange={e => setReviewTitle(e.target.value)}
                />
                <textarea
                  className="w-full mb-4 rounded-xl bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600/40 transition resize-none"
                  style={{ fontSize: '16px' }}
                  placeholder="Share your experience with this organisation…"
                  rows={3}
                  value={reviewContent}
                  onChange={e => setReviewContent(e.target.value)}
                />
                <button
                  onClick={handleReviewSubmit}
                  disabled={reviewSubmitting || !reviewContent.trim()}
                  className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-500 transition disabled:opacity-50 shadow-lg shadow-violet-900/30"
                >
                  {reviewSubmitting ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            )}

            {/* Reviews list */}
            {reviewsLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-gray-900 animate-pulse border border-gray-800" />)}
              </div>
            ) : reviews.length === 0 ? (
              <EmptyState
                icon={<StarIcon className="h-8 w-8 text-gray-600" />}
                title="No reviews yet"
                sub="Be the first to leave a review for this organisation."
              />
            ) : (
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 hover:border-gray-700 transition">
                    <div className="flex items-start gap-3 mb-3">
                      <Link href={r.reviewer?.id ? `/profile?id=${r.reviewer.id}` : '#'} className="flex-shrink-0">
                        <Avatar url={r.reviewer?.avatar_url ?? null} name={r.reviewer?.full_name ?? 'Member'} size={38} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={r.reviewer?.id ? `/profile?id=${r.reviewer.id}` : '#'}
                            className="text-sm font-semibold text-white hover:text-violet-300 transition truncate"
                          >
                            {r.reviewer?.full_name ?? 'FreeTrust Member'}
                          </Link>
                          <span className="text-xs text-gray-600 flex-shrink-0">
                            {new Date(r.created_at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <StarIcon key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                    {r.title && <p className="text-sm font-semibold text-white mb-1.5">{r.title}</p>}
                    <p className="text-sm text-gray-400 leading-relaxed">{r.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
