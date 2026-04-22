"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import VerifiedBadge from "@/components/organisation/VerifiedBadge";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
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

type OrgTab = "overview" | "members" | "followers" | "reviews" | "jobs" | "activity";

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
  verified_at: string | null;
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

interface OrgJob {
  id: string;
  title: string;
  job_type: string | null;
  location_type: string | null;
  location: string | null;
  category: string | null;
  status: string;
  created_at: string;
  applicant_count: number | null;
  company_logo_url: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
}

interface OrgActivityItem {
  id: string;
  type: "job" | "event" | "listing";
  title: string;
  href: string;
  created_at: string;
  meta?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: OrgMember["role"] }) {
  const styles: Record<OrgMember["role"], React.CSSProperties> = {
    owner: { background: "rgba(109,40,217,0.3)", color: "#c4b5fd", border: "1px solid rgba(109,40,217,0.4)" },
    admin: { background: "rgba(37,99,235,0.3)", color: "#93c5fd", border: "1px solid rgba(37,99,235,0.4)" },
    member: { background: "rgba(30,41,59,0.8)", color: "#94a3b8", border: "1px solid #334155" },
  };
  const labels = { owner: "Owner", admin: "Admin", member: "Member" };
  return (
    <span style={{ ...styles[role], borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
      {labels[role]}
    </span>
  );
}

function MemberCard({
  member,
  canManage,
  currentUserId,
  creatorId,
  onRemove,
  removing,
}: {
  member: OrgMember;
  canManage: boolean;
  currentUserId: string | null;
  creatorId: string | null;
  onRemove: (userId: string, fullName: string) => void;
  removing: boolean;
}) {
  // The org creator is protected from removal — removing the
  // creator would leave the org ownerless. Admins can be removed
  // by the creator/owners, but the creator themselves cannot be
  // removed through this UI.
  const isCreator = member.profile.id === creatorId;
  const isSelf = member.profile.id === currentUserId;
  const showRemove = canManage && !isCreator && !isSelf;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, background: "rgba(15,23,42,0.6)", border: "1px solid #1e293b" }}>
      <Link href={`/profile?id=${member.profile.id}`} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, textDecoration: "none" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "#1e293b", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {member.profile.avatar_url
            ? <img src={member.profile.avatar_url} alt={member.profile.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <UserIcon style={{ width: 20, height: 20, color: "#475569" }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.profile.full_name}</div>
          {member.title && <div style={{ fontSize: 12, color: "#64748b", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.title}</div>}
          <div style={{ fontSize: 11, color: "#818cf8", marginTop: 2, fontWeight: 500 }}>₮{(member.profile.trust_balance ?? 0).toLocaleString()}</div>
        </div>
      </Link>
      <RoleBadge role={member.role} />
      {showRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(member.profile.id, member.profile.full_name);
          }}
          disabled={removing}
          title={`Remove ${member.profile.full_name} from this organisation`}
          aria-label={`Remove ${member.profile.full_name}`}
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 8,
            padding: "6px 10px",
            color: "#fca5a5",
            fontSize: 12,
            fontWeight: 600,
            cursor: removing ? "wait" : "pointer",
            flexShrink: 0,
            minHeight: 32,
            fontFamily: "inherit",
          }}
        >
          {removing ? "…" : "Remove"}
        </button>
      )}
    </div>
  );
}

function FollowerCard({ follower }: { follower: FollowerProfile }) {
  return (
    <Link href={`/profile?id=${follower.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, background: "rgba(15,23,42,0.6)", border: "1px solid #1e293b", textDecoration: "none" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "#1e293b", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {follower.avatar_url
          ? <img src={follower.avatar_url} alt={follower.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <UserIcon style={{ width: 20, height: 20, color: "#475569" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{follower.full_name}</div>
        {follower.username && <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>@{follower.username}</div>}
      </div>
      <span style={{ fontSize: 12, color: "#818cf8", fontWeight: 500, flexShrink: 0 }}>₮{(follower.trust_balance ?? 0).toLocaleString()}</span>
    </Link>
  );
}

function EmptyState({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center" }}>
      {icon && <div style={{ borderRadius: "50%", background: "#1e293b", border: "1px solid #334155", padding: 20, marginBottom: 16 }}>{icon}</div>}
      <div style={{ fontSize: 14, fontWeight: 600, color: "#cbd5e1" }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: "#475569", marginTop: 6, maxWidth: 280, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: "100vh", background: "#020617" }}>
      <div style={{ height: 200, background: "#1e293b", borderRadius: "0 0 24px 24px", animation: "pulse 1.5s infinite" }} />
      <div style={{ padding: "0 16px", marginTop: -40 }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "#334155", border: "4px solid #020617", marginBottom: 16 }} />
        <div style={{ height: 28, width: "60%", background: "#1e293b", borderRadius: 8, marginBottom: 10 }} />
        <div style={{ height: 16, width: "80%", background: "#1e293b", borderRadius: 6, marginBottom: 6 }} />
        <div style={{ height: 16, width: "50%", background: "#1e293b", borderRadius: 6 }} />
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

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [followers, setFollowers] = useState<FollowerProfile[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followersLoaded, setFollowersLoaded] = useState(false);

  const [reviews, setReviews] = useState<OrgReview[]>([]);
  const [reviewsAvg, setReviewsAvg] = useState<number | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  const [orgJobs, setOrgJobs] = useState<OrgJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsLoaded, setJobsLoaded] = useState(false);

  const [orgActivity, setOrgActivity] = useState<OrgActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Role of the current user within this org, if any. Used to
  // decide whether to show the Edit button and the member Remove
  // buttons. `null` means "not a member or still loading". The
  // source of truth is the `organisation_members` table; the org
  // creator is handled as a separate case via `org.creator_id`.
  const [userMemberRole, setUserMemberRole] = useState<OrgMember["role"] | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  // Fetch the current user's membership role whenever we have both
  // a user and an org loaded. Needed so admins / owners (who aren't
  // the creator) can see the Edit button and the Remove controls.
  useEffect(() => {
    if (!currentUserId || !org) return;
    const sb = createClient();
    sb.from("organisation_members")
      .select("role")
      .eq("organisation_id", org.id)
      .eq("user_id", currentUserId)
      .maybeSingle()
      .then(({ data }) => {
        const role = data?.role as OrgMember["role"] | undefined;
        setUserMemberRole(role ?? null);
      });
  }, [currentUserId, org]);

  // Admins + owners + the creator can edit the org and manage
  // members. This is the single source of truth for "can I do
  // admin things here?" — reused for the Edit button visibility
  // and the member Remove buttons below.
  const canManageOrg = Boolean(
    org && currentUserId &&
    (currentUserId === org.creator_id ||
     userMemberRole === "admin" ||
     userMemberRole === "owner")
  );

  async function handleRemoveMember(userId: string, fullName: string) {
    if (!org) return;
    if (!window.confirm(`Remove ${fullName} from ${org.name}?`)) return;
    setRemovingMemberId(userId);
    setMemberError(null);
    try {
      const res = await fetch(`/api/organisations/${id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[members] DELETE failed:", res.status, data);
        setMemberError(data?.error ?? `Failed to remove member (HTTP ${res.status})`);
        return;
      }
      // Optimistic UI — drop the member from the local list and
      // decrement the org member count chip so the Members tab
      // reflects the change immediately.
      setMembers(prev => prev.filter(m => m.profile.id !== userId));
      setOrg(prev => prev ? { ...prev, members_count: Math.max(0, prev.members_count - 1) } : prev);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[members] DELETE threw:", msg);
      setMemberError(msg);
    } finally {
      setRemovingMemberId(null);
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/organisations/${id}`)
      .then(async (res) => { if (!res.ok) { setNotFound(true); return null; } return res.json(); })
      .then((data) => { if (data) { setOrg(data as Organisation); setIsFollowing(data.isFollowing ?? false); } })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!org) return;
    fetch(`/api/organisations/${id}/followers`).then(r => r.json()).then(d => setFollowerCount(d.count ?? 0)).catch(() => {});
  }, [org, id]);

  useEffect(() => {
    if (activeTab === "members" && org && members.length === 0 && !membersLoading) {
      setMembersLoading(true);
      fetch(`/api/organisations/${id}/members`).then(r => r.json()).then(d => setMembers(d.members ?? [])).catch(() => {}).finally(() => setMembersLoading(false));
    }
  }, [activeTab, org, id, members.length, membersLoading]);

  useEffect(() => {
    if (activeTab === "followers" && org && !followersLoaded && !followersLoading) {
      setFollowersLoading(true);
      fetch(`/api/organisations/${id}/followers`).then(r => r.json()).then(d => { setFollowers(d.followers ?? []); setFollowerCount(d.count ?? 0); setFollowersLoaded(true); }).catch(() => {}).finally(() => setFollowersLoading(false));
    }
  }, [activeTab, org, id, followersLoaded, followersLoading]);

  useEffect(() => {
    if (activeTab === "reviews" && org && !reviewsLoaded && !reviewsLoading) {
      setReviewsLoading(true);
      fetch(`/api/organisations/${id}/reviews`).then(r => r.json()).then(d => { setReviews(d.reviews ?? []); setReviewsAvg(d.avg ?? null); setReviewsLoaded(true); }).catch(() => {}).finally(() => setReviewsLoading(false));
    }
  }, [activeTab, org, id, reviewsLoaded, reviewsLoading]);

  useEffect(() => {
    if (activeTab === "jobs" && org && !jobsLoaded && !jobsLoading) {
      setJobsLoading(true);
      fetch(`/api/organisations/${id}/jobs`)
        .then(r => r.json())
        .then(d => { setOrgJobs(d.jobs ?? []); setJobsLoaded(true); })
        .catch(() => {})
        .finally(() => setJobsLoading(false));
    }
  }, [activeTab, org, id, jobsLoaded, jobsLoading]);

  useEffect(() => {
    if (activeTab === "activity" && org && !activityLoaded && !activityLoading) {
      setActivityLoading(true);
      // Fetch jobs, events, listings for this org in parallel
      Promise.all([
        fetch(`/api/organisations/${id}/jobs`).then(r => r.json()).catch(() => ({ jobs: [] })),
        fetch(`/api/events?organiserId=${id}`).then(r => r.json()).catch(() => ({ events: [] })),
      ]).then(([jobsData, eventsData]) => {
        const items: OrgActivityItem[] = [];
        for (const j of (jobsData.jobs ?? [])) {
          items.push({ id: `job-${j.id}`, type: "job", title: `📋 Posted job: ${j.title}`, href: `/jobs/${j.id}`, created_at: j.created_at, meta: j.job_type ?? undefined });
        }
        for (const e of (eventsData.events ?? [])) {
          items.push({ id: `event-${e.id}`, type: "event", title: `📅 Created event: ${e.title}`, href: `/events/${e.id}`, created_at: e.created_at });
        }
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setOrgActivity(items);
        setActivityLoaded(true);
      }).finally(() => setActivityLoading(false));
    }
  }, [activeTab, org, id, activityLoaded, activityLoading]);

  async function handleReviewSubmit() {
    if (!reviewContent.trim()) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/organisations/${id}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating: reviewRating, title: reviewTitle.trim() || null, content: reviewContent.trim() }) });
      if (res.ok) {
        const d = await res.json();
        setReviews(prev => [d.review, ...prev.filter((r: OrgReview) => r.reviewer?.id !== d.review.reviewer?.id)]);
        const allReviews = [...reviews, d.review];
        setReviewsAvg(Math.round((allReviews.reduce((s: number, r: OrgReview) => s + r.rating, 0) / allReviews.length) * 10) / 10);
        setShowReviewForm(false); setReviewTitle(""); setReviewContent(""); setReviewRating(5);
      }
    } catch { /* silent */ } finally { setReviewSubmitting(false); }
  }

  function handleFollow() {
    if (!org) return;
    const nowFollowing = !isFollowing;
    setIsFollowing(nowFollowing);
    setFollowerCount(c => nowFollowing ? c + 1 : Math.max(0, c - 1));
    fetch(`/api/organisations/${id}/follow`, { method: nowFollowing ? "POST" : "DELETE", headers: { "Content-Type": "application/json" } })
      .catch(() => { setIsFollowing(!nowFollowing); setFollowerCount(c => nowFollowing ? Math.max(0, c - 1) : c + 1); });
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (loading) return <LoadingSkeleton />;

  if (notFound || !org) {
    return (
      <div style={{ minHeight: "100vh", background: "#020617", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "50%", padding: 24, marginBottom: 20 }}>
          <BuildingOfficeIcon style={{ width: 40, height: 40, color: "#475569" }} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Organisation not found</h1>
        <p style={{ fontSize: 14, color: "#475569", marginTop: 8, marginBottom: 24 }}>This organisation doesn&apos;t exist or may have been removed.</p>
        <Link href="/organisations" style={{ background: "#7c3aed", color: "#fff", borderRadius: 14, padding: "10px 24px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Browse organisations
        </Link>
      </div>
    );
  }

  const tabs: { key: OrgTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "jobs", label: "Jobs", count: orgJobs.length || undefined },
    { key: "activity", label: "Activity" },
    { key: "members", label: "Members", count: org.members_count },
    { key: "followers", label: "Followers", count: followerCount || undefined },
    { key: "reviews", label: "Reviews", count: reviews.length || undefined },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#020617" }}>

      {/* ── COVER ── pulls up to sit flush against the fixed nav bar ── */}
      <div style={{ position: "relative", height: 260, marginTop: -104, background: "linear-gradient(135deg, #0d0221 0%, #1e1b4b 40%, #1a1040 100%)" }}>
        {/* Inner clip wrapper — contains the image and overlay, not the logo */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 0 }}>
          {org.cover_url && !coverError && (
            <img src={org.cover_url} alt="cover" onError={() => setCoverError(true)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
          )}
          {/* Dark overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(2,6,23,0.55) 0%, rgba(2,6,23,0.1) 50%, rgba(2,6,23,0.92) 100%)" }} />
        </div>

        {/* Back button — sits in the visible zone below the 104px nav area */}
        <button onClick={() => router.back()}
          style={{ position: "absolute", top: 116, left: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 12px", color: "#f1f5f9", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          <ArrowLeftIcon style={{ width: 14, height: 14 }} />
          Back
        </button>

        {/* Share + Report */}
        <div style={{ position: "absolute", top: 116, right: 12, display: "flex", gap: 8 }}>
          <button onClick={handleShare}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 12px", color: "#f1f5f9", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            <ShareIcon style={{ width: 13, height: 13 }} />
            {copied ? "Copied!" : "Share"}
          </button>
          <button
            style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 12px", color: "#94a3b8", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            <FlagIcon style={{ width: 13, height: 13 }} />
            Report
          </button>
        </div>
      </div>

      {/* ── PROFILE HEADER ── */}
      <div style={{ padding: "0 16px" }}>

        {/* Logo — overlaps cover bottom, z-index ensures it sits above the cover */}
        <div style={{ marginTop: -50, marginBottom: 12, position: "relative", zIndex: 10 }}>
          <div style={{ width: 96, height: 96, borderRadius: 22, overflow: "hidden", background: "#0f172a", border: "4px solid #020617", boxShadow: "0 8px 40px rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {org.logo_url && !logoError
              ? <img src={org.logo_url} alt={org.name} onError={() => setLogoError(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <BuildingOfficeIcon style={{ width: 36, height: 36, color: "#475569" }} />}
          </div>
        </div>

        {/* Name row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: 0, lineHeight: 1.2 }}>{org.name}</h1>
              {org.is_verified && (
                <VerifiedBadge verifiedAt={org.verified_at} compact />
              )}
            </div>
            {org.tagline && (
              <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0", lineHeight: 1.4 }}>{org.tagline}</p>
            )}
          </div>
        </div>

        {/* Follow + Message + Edit buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={handleFollow}
            style={{
              display: "flex", alignItems: "center", gap: 6, borderRadius: 12, padding: "9px 18px",
              fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none",
              background: isFollowing ? "#1e293b" : "#7c3aed",
              color: isFollowing ? "#94a3b8" : "#fff",
              outline: isFollowing ? "1px solid #334155" : "none",
            }}>
            {isFollowing
              ? <><UserMinusIcon style={{ width: 16, height: 16 }} />Unfollow</>
              : <><UserPlusIcon style={{ width: 16, height: 16 }} />Follow</>}
          </button>
          <button
            style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 12, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", background: "#1e293b", color: "#cbd5e1", border: "1px solid #334155" }}>
            <ChatBubbleLeftRightIcon style={{ width: 16, height: 16 }} />
            Message
          </button>
          {canManageOrg && (
            <Link href={`/organisations/${id}/edit`}
              style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 12, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", background: "rgba(139,92,246,0.15)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.35)", textDecoration: "none" }}>
              ✏️ Edit
            </Link>
          )}
        </div>

        {/* Meta chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {org.type && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, background: "#1e293b", border: "1px solid #334155", borderRadius: 20, padding: "4px 10px", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
              <BuildingOfficeIcon style={{ width: 13, height: 13 }} />{org.type}
            </span>
          )}
          {org.location && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
              <MapPinIcon style={{ width: 13, height: 13 }} />{org.location}
            </span>
          )}
          {org.website && (
            <a href={org.website} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#818cf8", textDecoration: "none" }}>
              <GlobeAltIcon style={{ width: 13, height: 13 }} />
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {org.founded_year && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
              <CalendarDaysIcon style={{ width: 13, height: 13 }} />Est. {org.founded_year}
            </span>
          )}
          {org.sector && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
              <BriefcaseIcon style={{ width: 13, height: 13 }} />{org.sector}
            </span>
          )}
        </div>

        {/* Tags */}
        {org.tags && org.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {org.tags.map(tag => (
              <span key={tag} style={{ background: "rgba(109,40,217,0.15)", border: "1px solid rgba(109,40,217,0.25)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#a78bfa", fontWeight: 500 }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { value: followerCount.toLocaleString(), label: "Followers" },
            { value: org.members_count.toLocaleString(), label: "Members" },
          ].map((stat, i) => (
            <div key={i} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: "14px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid #1e293b", marginBottom: 20, display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                flexShrink: 0, padding: "10px 14px", fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400,
                color: activeTab === t.key ? "#f1f5f9" : "#475569",
                background: "none", border: "none", cursor: "pointer",
                borderBottom: activeTab === t.key ? "2px solid #7c3aed" : "2px solid transparent",
                marginBottom: -1, whiteSpace: "nowrap",
              }}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 600, borderRadius: 10, padding: "1px 6px", background: activeTab === t.key ? "rgba(124,58,237,0.25)" : "#1e293b", color: activeTab === t.key ? "#a78bfa" : "#64748b" }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ padding: "0 16px 40px" }}>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Verified badge (if applicable) */}
            {org.is_verified && (
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 16 }}>
                <VerifiedBadge verifiedAt={org.verified_at} />
              </div>
            )}

            {/* About */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>About</div>
              <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>{org.description}</p>
            </div>

            {/* Impact Statement */}
            {org.impact_statement && (
              <div style={{ background: "rgba(109,40,217,0.08)", border: "1px solid rgba(109,40,217,0.2)", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <ShieldCheckIcon style={{ width: 14, height: 14, color: "#7c3aed" }} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.1em" }}>Impact Statement</div>
                </div>
                <p style={{ fontSize: 14, color: "#c4b5fd", lineHeight: 1.65, margin: 0 }}>{org.impact_statement}</p>
              </div>
            )}

            {/* SDGs */}
            {org.sdgs && org.sdgs.length > 0 && (
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Sustainable Development Goals</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {org.sdgs.map(sdg => (
                    <span key={sdg} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, padding: "4px 10px", fontSize: 12, color: "#34d399", fontWeight: 500 }}>{sdg}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Details */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {([
                  org.sector && { icon: <BriefcaseIcon style={{ width: 15, height: 15 }} />, label: "Sector", value: org.sector },
                  org.size && { icon: <UserGroupIcon style={{ width: 15, height: 15 }} />, label: "Size", value: org.size },
                  org.founded_year && { icon: <CalendarDaysIcon style={{ width: 15, height: 15 }} />, label: "Founded", value: String(org.founded_year) },
                  org.location && { icon: <MapPinIcon style={{ width: 15, height: 15 }} />, label: "Location", value: org.location },
                  { icon: <UserPlusIcon style={{ width: 15, height: 15 }} />, label: "Followers", value: String(followerCount.toLocaleString()) },
                ] as (false | { icon: React.ReactNode; label: string; value: string })[])
                  .filter(Boolean)
                  .map(item => {
                    const d = item as { icon: React.ReactNode; label: string; value: string };
                    return (
                      <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#475569", flexShrink: 0 }}>{d.icon}</span>
                        <div>
                          <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{d.label}</div>
                          <div style={{ fontSize: 14, color: "#cbd5e1", marginTop: 1 }}>{d.value}</div>
                        </div>
                      </div>
                    );
                  })}
                {org.website && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <GlobeAltIcon style={{ width: 15, height: 15, color: "#475569", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Website</div>
                      <a href={org.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "#818cf8", textDecoration: "none", marginTop: 1, display: "block" }}>
                        {org.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── JOBS ── */}
        {activeTab === "jobs" && (
          <div>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 14 }}>
              Jobs posted by {org.name}
            </div>
            {canManageOrg && (
              <Link
                href={`/jobs/new?orgId=${org.id}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 14, padding: "12px 0", fontSize: 14, fontWeight: 600, color: "#a78bfa", cursor: "pointer", marginBottom: 16, textDecoration: "none" }}
              >
                <BriefcaseIcon style={{ width: 16, height: 16 }} />
                Post a Job as {org.name}
              </Link>
            )}
            {jobsLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: 100, borderRadius: 16, background: "#0f172a", border: "1px solid #1e293b" }} />)}
              </div>
            ) : orgJobs.length === 0 ? (
              <EmptyState
                icon={<BriefcaseIcon style={{ width: 28, height: 28, color: "#475569" }} />}
                title="No jobs posted yet"
                sub={canManageOrg ? "Post your first job on behalf of this organisation." : "This organisation hasn't posted any jobs yet."}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {orgJobs.map(job => (
                  <div key={job.id} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {job.company_logo_url ? (
                        <img src={job.company_logo_url} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0, background: "#1e293b" }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1e293b", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <BriefcaseIcon style={{ width: 20, height: 20, color: "#475569" }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{job.title}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {job.job_type && (
                            <span style={{ fontSize: 11, fontWeight: 600, background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 20, padding: "2px 8px" }}>
                              {job.job_type.replace(/_/g, " ")}
                            </span>
                          )}
                          {job.location_type && (
                            <span style={{ fontSize: 11, fontWeight: 600, background: "rgba(56,189,248,0.1)", color: "#7dd3fc", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 20, padding: "2px 8px" }}>
                              {job.location_type === "remote" ? "🌐 Remote" : job.location_type === "onsite" ? "📍 On-site" : "🔄 Hybrid"}
                            </span>
                          )}
                          <span style={{ fontSize: 11, fontWeight: 600, background: job.status === "active" ? "rgba(52,211,153,0.12)" : "rgba(100,116,139,0.15)", color: job.status === "active" ? "#34d399" : "#64748b", border: `1px solid ${job.status === "active" ? "rgba(52,211,153,0.25)" : "rgba(100,116,139,0.2)"}`, borderRadius: 20, padding: "2px 8px" }}>
                            {job.status}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontSize: 12, color: "#475569" }}>
                            {job.applicant_count != null && job.applicant_count > 0 && (
                              <span style={{ marginRight: 10 }}>👥 {job.applicant_count} applicant{job.applicant_count !== 1 ? "s" : ""}</span>
                            )}
                            {new Date(job.created_at).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <Link
                            href={`/jobs/${job.id}`}
                            style={{ fontSize: 12, fontWeight: 600, color: "#818cf8", border: "1px solid rgba(129,140,248,0.3)", borderRadius: 8, padding: "4px 12px", textDecoration: "none", flexShrink: 0 }}
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {activeTab === "activity" && (
          <div>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 14 }}>
              Recent Activity
            </div>
            {activityLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: 64, borderRadius: 16, background: "#0f172a", border: "1px solid #1e293b" }} />)}
              </div>
            ) : orgActivity.length === 0 ? (
              <EmptyState
                icon={<CalendarDaysIcon style={{ width: 28, height: 28, color: "#475569" }} />}
                title="No activity yet"
                sub="Jobs posted, events created, and other activity will appear here."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {orgActivity.map(item => (
                  <Link
                    key={item.id}
                    href={item.href}
                    style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "12px 16px", textDecoration: "none" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.4 }}>{item.title}</div>
                      {item.meta && <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{item.meta.replace(/_/g, " ")}</div>}
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                        {new Date(item.created_at).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                      {item.type === "job" ? "💼" : item.type === "event" ? "📅" : "🛍"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MEMBERS ── */}
        {activeTab === "members" && (
          <div>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 14 }}>
              {org.members_count} active member{org.members_count !== 1 ? "s" : ""}
            </div>
            {/* Inline error for member-management failures — any
                DELETE on /api/organisations/[id]/members that comes
                back non-2xx surfaces here so the user isn't left
                wondering why the Remove button did nothing. */}
            {memberError && (
              <div
                role="alert"
                style={{
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.25)",
                  borderRadius: 10,
                  padding: "0.6rem 0.85rem",
                  marginBottom: 12,
                  fontSize: 13,
                  color: "#fca5a5",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  lineHeight: 1.45,
                }}
              >
                <span>⚠️</span>
                <div style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{memberError}</div>
              </div>
            )}
            {membersLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: 72, borderRadius: 16, background: "#0f172a", border: "1px solid #1e293b" }} />)}
              </div>
            ) : members.length === 0 ? (
              <EmptyState icon={<UserGroupIcon style={{ width: 28, height: 28, color: "#475569" }} />} title="No members listed yet" sub="Members will appear here once added to the organisation." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {members.map(m => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    canManage={canManageOrg}
                    currentUserId={currentUserId}
                    creatorId={org.creator_id}
                    onRemove={handleRemoveMember}
                    removing={removingMemberId === m.profile.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FOLLOWERS ── */}
        {activeTab === "followers" && (
          <div>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 14 }}>
              {followerCount} follower{followerCount !== 1 ? "s" : ""}
            </div>
            {followersLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: 72, borderRadius: 16, background: "#0f172a", border: "1px solid #1e293b" }} />)}
              </div>
            ) : followers.length === 0 ? (
              <EmptyState icon={<UserPlusIcon style={{ width: 28, height: 28, color: "#475569" }} />} title="No followers yet" sub="Be the first to follow this organisation." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {followers.map(f => <FollowerCard key={f.id} follower={f} />)}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS ── */}
        {activeTab === "reviews" && (
          <div>
            {/* Rating summary */}
            {reviewsAvg !== null && reviews.length > 0 && (
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>{reviewsAvg.toFixed(1)}</div>
                  <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 4 }}>
                    {[1,2,3,4,5].map(s => (
                      <StarIcon key={s} style={{ width: 14, height: 14, color: s <= Math.round(reviewsAvg!) ? "#f59e0b" : "#1e293b", fill: s <= Math.round(reviewsAvg!) ? "#f59e0b" : "none" }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ flex: 1 }}>
                  {[5,4,3,2,1].map(s => {
                    const count = reviews.filter(r => r.rating === s).length;
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "#475569", width: 8 }}>{s}</span>
                        <StarIcon style={{ width: 11, height: 11, color: "#f59e0b", fill: "#f59e0b", flexShrink: 0 }} />
                        <div style={{ flex: 1, height: 4, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: "#f59e0b", borderRadius: 4, width: `${pct}%`, transition: "width 0.5s" }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#475569", width: 14, textAlign: "right" }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Write review */}
            {!showReviewForm && (
              <button onClick={() => setShowReviewForm(true)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(109,40,217,0.1)", border: "1px solid rgba(109,40,217,0.25)", borderRadius: 14, padding: "12px 0", fontSize: 14, fontWeight: 600, color: "#a78bfa", cursor: "pointer", marginBottom: 14 }}>
                <StarIcon style={{ width: 16, height: 16 }} />
                Write a Review
              </button>
            )}

            {/* Review form */}
            {showReviewForm && (
              <div style={{ background: "#0f172a", border: "1px solid rgba(109,40,217,0.3)", borderRadius: 16, padding: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Your Review</span>
                  <button onClick={() => setShowReviewForm(false)}
                    style={{ background: "#1e293b", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: "#94a3b8", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
                <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setReviewRating(s)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      <StarIcon style={{ width: 28, height: 28, color: s <= reviewRating ? "#f59e0b" : "#1e293b", fill: s <= reviewRating ? "#f59e0b" : "none" }} />
                    </button>
                  ))}
                </div>
                <input
                  style={{ width: "100%", boxSizing: "border-box", background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "10px 14px", fontSize: 16, color: "#f1f5f9", marginBottom: 10, outline: "none" }}
                  placeholder="Title (optional)"
                  value={reviewTitle}
                  onChange={e => setReviewTitle(e.target.value)}
                />
                <textarea
                  style={{ width: "100%", boxSizing: "border-box", background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "10px 14px", fontSize: 16, color: "#f1f5f9", resize: "none", marginBottom: 12, outline: "none" }}
                  placeholder="Share your experience…"
                  rows={3}
                  value={reviewContent}
                  onChange={e => setReviewContent(e.target.value)}
                />
                <button onClick={handleReviewSubmit} disabled={reviewSubmitting || !reviewContent.trim()}
                  style={{ width: "100%", background: reviewSubmitting || !reviewContent.trim() ? "#334155" : "#7c3aed", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, color: "#fff", cursor: reviewSubmitting || !reviewContent.trim() ? "not-allowed" : "pointer" }}>
                  {reviewSubmitting ? "Submitting…" : "Submit Review"}
                </button>
              </div>
            )}

            {/* Reviews list */}
            {reviewsLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1,2].map(i => <div key={i} style={{ height: 100, borderRadius: 16, background: "#0f172a", border: "1px solid #1e293b" }} />)}
              </div>
            ) : reviews.length === 0 ? (
              <EmptyState icon={<StarIcon style={{ width: 28, height: 28, color: "#475569" }} />} title="No reviews yet" sub="Be the first to leave a review for this organisation." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reviews.map(r => (
                  <div key={r.id} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Link href={r.reviewer?.id ? `/profile?id=${r.reviewer.id}` : "#"}>
                        <Avatar url={r.reviewer?.avatar_url ?? null} name={r.reviewer?.full_name ?? "Member"} size={36} />
                      </Link>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <Link href={r.reviewer?.id ? `/profile?id=${r.reviewer.id}` : "#"} style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.reviewer?.full_name ?? "FreeTrust Member"}
                          </Link>
                          <span style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>
                            {new Date(r.created_at).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                          {[1,2,3,4,5].map(s => (
                            <StarIcon key={s} style={{ width: 12, height: 12, color: s <= r.rating ? "#f59e0b" : "#1e293b", fill: s <= r.rating ? "#f59e0b" : "none" }} />
                          ))}
                        </div>
                      </div>
                    </div>
                    {r.title && <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>{r.title}</div>}
                    <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{r.content}</p>
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
