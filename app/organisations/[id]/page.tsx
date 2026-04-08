"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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
  ClockIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { formatDistanceToNow, format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────

type OrgTab = "overview" | "services" | "products" | "members" | "reviews";

interface Member {
  id: string;
  name: string;
  avatar: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  trustScore: number;
}

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  rating: number;
  reviewCount: number;
  deliveryDays: number;
  image: string;
  category: string;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  rating: number;
  reviewCount: number;
  image: string;
  category: string;
  stock: number;
}

interface Review {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  comment: string;
  createdAt: string;
  type: "service" | "product";
  itemTitle: string;
}

interface Organisation {
  id: string;
  name: string;
  handle: string;
  tagline: string;
  description: string;
  coverImage: string;
  avatar: string;
  verified: boolean;
  trustScore: number;
  location: string;
  website: string;
  foundedAt: string;
  followerCount: number;
  followingCount: number;
  memberCount: number;
  totalSales: number;
  totalRevenue: number;
  avgRating: number;
  reviewCount: number;
  categories: string[];
  members: Member[];
  services: Service[];
  products: Product[];
  reviews: Review[];
}

// ── Mock Data ──────────────────────────────────────────────────────────────────

const MOCK_ORG: Organisation = {
  id: "org_1",
  name: "TrustTech Solutions",
  handle: "@trusttech",
  tagline: "Building trust through technology — verified, fast, reliable.",
  description:
    "TrustTech Solutions is a distributed team of 12 specialists delivering world-class software development, UI/UX design, and blockchain consulting. Founded in 2019, we have served 300+ clients across 40 countries. Every delivery is backed by our escrow guarantee — funds release only when you're satisfied.",
  coverImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
  avatar: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&q=80",
  verified: true,
  trustScore: 94,
  location: "San Francisco, CA",
  website: "https://trusttech.io",
  foundedAt: "2019-03-15T00:00:00Z",
  followerCount: 2841,
  followingCount: 134,
  memberCount: 12,
  totalSales: 487,
  totalRevenue: 142600,
  avgRating: 4.8,
  reviewCount: 312,
  categories: ["Software Development", "UI/UX Design", "Blockchain", "Consulting"],
  members: [
    {
      id: "m1",
      name: "Alex Rivera",
      avatar: "https://i.pravatar.cc/80?img=1",
      role: "owner",
      joinedAt: "2019-03-15T00:00:00Z",
      trustScore: 98,
    },
    {
      id: "m2",
      name: "Priya Nair",
      avatar: "https://i.pravatar.cc/80?img=5",
      role: "admin",
      joinedAt: "2019-06-01T00:00:00Z",
      trustScore: 95,
    },
    {
      id: "m3",
      name: "Marcus Chen",
      avatar: "https://i.pravatar.cc/80?img=3",
      role: "member",
      joinedAt: "2020-01-10T00:00:00Z",
      trustScore: 91,
    },
    {
      id: "m4",
      name: "Sophie Laurent",
      avatar: "https://i.pravatar.cc/80?img=9",
      role: "member",
      joinedAt: "2020-07-22T00:00:00Z",
      trustScore: 89,
    },
    {
      id: "m5",
      name: "Jamal Osei",
      avatar: "https://i.pravatar.cc/80?img=12",
      role: "member",
      joinedAt: "2021-02-14T00:00:00Z",
      trustScore: 87,
    },
    {
      id: "m6",
      name: "Yuki Tanaka",
      avatar: "https://i.pravatar.cc/80?img=15",
      role: "member",
      joinedAt: "2021-09-05T00:00:00Z",
      trustScore: 93,
    },
  ],
  services: [
    {
      id: "svc_1",
      title: "Full-Stack Web Application Development",
      description: "End-to-end Next.js + Node.js app with auth, payments, and deployment.",
      price: 1200,
      rating: 4.9,
      reviewCount: 87,
      deliveryDays: 21,
      image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=80",
      category: "Software Development",
    },
    {
      id: "svc_2",
      title: "Brand Identity & UI/UX Design",
      description: "Complete brand kit, Figma prototypes, and design system documentation.",
      price: 650,
      rating: 4.8,
      reviewCount: 64,
      deliveryDays: 14,
      image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80",
      category: "UI/UX Design",
    },
    {
      id: "svc_3",
      title: "Smart Contract Audit & Blockchain Consulting",
      description: "Solidity/Rust audit reports, vulnerability assessment, and architecture review.",
      price: 2400,
      rating: 4.9,
      reviewCount: 42,
      deliveryDays: 10,
      image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&q=80",
      category: "Blockchain",
    },
    {
      id: "svc_4",
      title: "Technical Due Diligence Report",
      description: "In-depth codebase review, scalability assessment, and risk matrix.",
      price: 900,
      rating: 4.7,
      reviewCount: 29,
      deliveryDays: 7,
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80",
      category: "Consulting",
    },
  ],
  products: [
    {
      id: "prd_1",
      title: "React Component Library — Pro",
      description: "60+ production-ready components with dark mode, a11y, and Storybook docs.",
      price: 149,
      rating: 4.8,
      reviewCount: 211,
      image: "https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=400&q=80",
      category: "Software Development",
      stock: 999,
    },
    {
      id: "prd_2",
      title: "SaaS Dashboard Figma Kit",
      description: "200+ screens, 500+ components, auto-layout, and responsive frames.",
      price: 79,
      rating: 4.9,
      reviewCount: 188,
      image: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=400&q=80",
      category: "UI/UX Design",
      stock: 999,
    },
    {
      id: "prd_3",
      title: "Blockchain Starter Boilerplate",
      description: "Hardhat + Wagmi + Next.js scaffold with wallet connect and contract hooks.",
      price: 199,
      rating: 4.7,
      reviewCount: 94,
      image: "https://images.unsplash.com/photo-1644361566696-3d442b5b482a?w=400&q=80",
      category: "Blockchain",
      stock: 999,
    },
  ],
  reviews: [
    {
      id: "rv1",
      author: "Daniel K.",
      avatar: "https://i.pravatar.cc/60?img=20",
      rating: 5,
      comment:
        "Absolutely stellar work. Delivered a complex fintech dashboard two days early, with pixel-perfect attention to design. Communication was top-notch throughout.",
      createdAt: "2024-05-18T10:30:00Z",
      type: "service",
      itemTitle: "Full-Stack Web Application Development",
    },
    {
      id: "rv2",
      author: "Amara S.",
      avatar: "https://i.pravatar.cc/60?img=25",
      rating: 5,
      comment:
        "The smart contract audit caught 3 critical vulnerabilities we'd completely missed. Worth every dollar. Will hire again for our next launch.",
      createdAt: "2024-04-30T14:15:00Z",
      type: "service",
      itemTitle: "Smart Contract Audit & Blockchain Consulting",
    },
    {
      id: "rv3",
      author: "Tim W.",
      avatar: "https://i.pravatar.cc/60?img=30",
      rating: 4,
      comment:
        "Great component library — saves hours of work. Docs could be a bit more detailed for edge cases, but overall excellent quality.",
      createdAt: "2024-04-10T09:00:00Z",
      type: "product",
      itemTitle: "React Component Library — Pro",
    },
    {
      id: "rv4",
      author: "Fatima A.",
      avatar: "https://i.pravatar.cc/60?img=35",
      rating: 5,
      comment:
        "The Figma kit is insanely comprehensive. Saved our startup at least 3 weeks of design work. Highly recommended.",
      createdAt: "2024-03-22T16:45:00Z",
      type: "product",
      itemTitle: "SaaS Dashboard Figma Kit",
    },
    {
      id: "rv5",
      author: "Leo B.",
      avatar: "https://i.pravatar.cc/60?img=40",
      rating: 5,
      comment:
        "Hired for brand identity work and was blown away. They nailed our vision in the first round of revisions. The design system is now the backbone of our product.",
      createdAt: "2024-03-05T11:20:00Z",
      type: "service",
      itemTitle: "Brand Identity & UI/UX Design",
    },
  ],
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarSolid
          key={i}
          className={`${sz} ${i <= Math.round(rating) ? "text-amber-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function RoleBadge({ role }: { role: Member["role"] }) {
  const map: Record<Member["role"], { label: string; cls: string }> = {
    owner: { label: "Owner", cls: "bg-violet-100 text-violet-700" },
    admin: { label: "Admin", cls: "bg-blue-100 text-blue-700" },
    member: { label: "Member", cls: "bg-gray-100 text-gray-600" },
  };
  const { label, cls } = map[role];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function TrustBadge({ score }: { score: number }) {
  const color =
    score >= 90 ? "text-emerald-600 bg-emerald-50" :
    score >= 70 ? "text-amber-600 bg-amber-50" :
    "text-red-600 bg-red-50";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${color}`}>
      <ShieldCheckIcon className="h-4 w-4" />
      {score}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
      <span className="mt-1 text-xs font-medium text-gray-500">{label}</span>
    </div>
  );
}

function ServiceCard({ svc }: { svc: Service }) {
  return (
    <Link
      href={`/services/${svc.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative h-44 w-full overflow-hidden bg-gray-100">
        <img
          src={svc.image}
          alt={svc.title}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-600 shadow-sm">
          {svc.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-violet-700">
          {svc.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{svc.description}</p>
        <div className="mt-auto pt-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <StarRating rating={svc.rating} />
            <span className="text-xs text-gray-500">({svc.reviewCount})</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">From</p>
            <p className="font-bold text-violet-700">${svc.price.toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
          <ClockIcon className="h-3.5 w-3.5" />
          <span>{svc.deliveryDays}-day delivery</span>
        </div>
      </div>
    </Link>
  );
}

function ProductCard({ prd }: { prd: Product }) {
  return (
    <Link
      href={`/products/${prd.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative h-44 w-full overflow-hidden bg-gray-100">
        <img
          src={prd.image}
          alt={prd.title}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-600 shadow-sm">
          {prd.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-violet-700">
          {prd.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{prd.description}</p>
        <div className="mt-auto pt-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <StarRating rating={prd.rating} />
            <span className="text-xs text-gray-500">({prd.reviewCount})</span>
          </div>
          <p className="font-bold text-violet-700">${prd.price.toLocaleString()}</p>
        </div>
      </div>
    </Link>
  );
}

function ReviewCard({ rv }: { rv: Review }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <img src={rv.avatar} alt={rv.author} className="h-10 w-10 rounded-full object-cover" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">{rv.author}</p>
              <p className="text-xs text-gray-400">
                on{" "}
                <span className="font-medium text-gray-600 italic">{rv.itemTitle}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StarRating rating={rv.rating} />
              <p className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(rv.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-700 leading-relaxed">{rv.comment}</p>
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

  const [org] = useState<Organisation>(MOCK_ORG);
  const [activeTab, setActiveTab] = useState<OrgTab>("overview");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(MOCK_ORG.followerCount);
  const [copied, setCopied] = useState(false);
  const [coverError, setCoverError] = useState(false);

  const tabs: { key: OrgTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "overview", label: "Overview", icon: <BriefcaseIcon className="h-4 w-4" /> },
    {
      key: "services",
      label: "Services",
      icon: <BriefcaseIcon className="h-4 w-4" />,
      count: org.services.length,
    },
    {
      key: "products",
      label: "Products",
      icon: <CubeIcon className="h-4 w-4" />,
      count: org.products.length,
    },
    {
      key: "members",
      label: "Members",
      icon: <UserGroupIcon className="h-4 w-4" />,
      count: org.members.length,
    },
    {
      key: "reviews",
      label: "Reviews",
      icon: <StarIcon className="h-4 w-4" />,
      count: org.reviewCount,
    },
  ];

  function handleFollow() {
    setIsFollowing((prev) => {
      setFollowerCount((c) => (prev ? c - 1 : c + 1));
      return !prev;
    });
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Back ── */}
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* ── Cover ── */}
      <div className="relative mx-auto mt-2 max-w-6xl px-4">
        <div className="relative h-52 md:h-72 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700 shadow-lg">
          {!coverError && (
            <img
              src={org.coverImage}
              alt="cover"
              className="h-full w-full object-cover"
              onError={() => setCoverError(true)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        {/* ── Avatar + Header Info ── */}
        <div className="absolute -bottom-14 left-6 md:left-10 flex items-end gap-4">
          <div className="relative h-24 w-24 md:h-28 md:w-28 overflow-hidden rounded-2xl border-4 border-white bg-gray-100 shadow-lg">
            <img src={org.avatar} alt={org.name} className="h-full w-full object-cover" />
          </div>
        </div>

        {/* ── Action Buttons (top-right of card) ── */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow backdrop-blur-sm hover:bg-white transition"
          >
            <ShareIcon className="h-4 w-4" />
            {copied ? "Copied!" : "Share"}
          </button>
          <button
            className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow backdrop-blur-sm hover:bg-white transition"
          >
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
              <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
              {org.verified && (
                <CheckBadgeIcon className="h-6 w-6 text-violet-600" title="Verified Organisation" />
              )}
              <TrustBadge score={org.trustScore} />
            </div>
            <p className="mt-0.5 text-sm text-gray-500">{org.handle}</p>
            <p className="mt-2 text-sm text-gray-700 leading-relaxed max-w-2xl">{org.tagline}</p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              {org.location && (
                <span className="flex items-center gap-1">
                  <MapPinIcon className="h-4 w-4 text-gray-400" />
                  {org.location}
                </span>
              )}
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-violet-600 hover:underline"
                >
                  <GlobeAltIcon className="h-4 w-4" />
                  {org.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              <span className="flex items-center gap-1">
                <ClockIcon className="h-4 w-4 text-gray-400" />
                Founded {format(new Date(org.foundedAt), "MMM yyyy")}
              </span>
            </div>

            {/* Category tags */}
            <div className="mt-3 flex flex-wrap gap-2">
              {org.categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full bg-violet-50 px-3 py-0.5 text-xs font-medium text-violet-700"
                >
                  {cat}
                </span>
              ))}
            </div>

            {/* Followers */}
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span>
                <strong className="text-gray-900">{followerCount.toLocaleString()}</strong>{" "}
                <span className="text-gray-500">followers</span>
              </span>
              <span>
                <strong className="text-gray-900">{org.followingCount.toLocaleString()}</strong>{" "}
                <span className="text-gray-500">following</span>
              </span>
            </div>
          </div>

          {/* Follow + Message */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleFollow}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow transition ${
                isFollowing
                  ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
            <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition">
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              Message
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Sales"
            value={org.totalSales.toLocaleString()}
            sub="completed orders"
          />
          <StatCard
            label="Revenue"
            value={`$${(org.totalRevenue / 1000).toFixed(0)}k`}
            sub="all time"
          />
          <StatCard
            label="Rating"
            value={org.avgRating.toFixed(1)}
            sub={`${org.reviewCount} reviews`}
          />
          <StatCard
            label="Members"
            value={org.memberCount.toString()}
            sub="active contributors"
          />
        </div>

        {/* ── Tabs ── */}
        <div className="mt-8 border-b border-gray-200">
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
                  activeTab === t.key
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t.icon}
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      activeTab === t.key
                        ? "bg-violet-100 text-violet-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab Content ── */}
        <div className="mt-6 pb-16">
          {/* Overview */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* About */}
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-900">About</h2>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">{org.description}</p>
                </div>

                {/* Latest Services */}
                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-900">Top Services</h2>
                    <button
                      onClick={() => setActiveTab("services")}
                      className="text-xs font-medium text-violet-600 hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {org.services.slice(0, 2).map((svc) => (
                      <ServiceCard key={svc.id} svc={svc} />
                    ))}
                  </div>
                </div>

                {/* Latest Reviews */}
                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-900">Recent Reviews</h2>
                    <button
                      onClick={() => setActiveTab("reviews")}
                      className="text-xs font-medium text-violet-600 hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div className="space-y-4">
                    {org.reviews.slice(0, 2).map((rv) => (
                      <ReviewCard key={rv.id} rv={rv} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                {/* Rating Summary */}
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Rating Summary</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-extrabold text-gray-900">
                      {org.avgRating.toFixed(1)}
                    </span>
                    <div>
                      <StarRating rating={org.avgRating} size="md" />
                      <p className="mt-1 text-xs text-gray-400">{org.reviewCount} reviews</p>
                    </div>
                  </div>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const pct = star === 5 ? 72 : star === 4 ? 18 : star === 3 ? 6 : star === 2 ? 3 : 1;
                    return (
                      <div key={star} className="mt-2 flex items-center gap-2">
                        <span className="w-4 text-xs text-gray-500 text-right">{star}</span>
                        <StarSolid className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-xs text-gray-400 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Team spotlight */}
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Team</h3>
                    <button
                      onClick={() => setActiveTab("members")}
                      className="text-xs font-medium text-violet-600 hover:underline"
                    >
                      See all
                    </button>
                  </div>
                  <div className="space-y-3">
                    {org.members.slice(0, 4).map((m) => (
                      <div key={m.id} className="flex items-center gap-2">
                        <img
                          src={m.avatar}
                          alt={m.name}
                          className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{m.name}</p>
                        </div>
                        <RoleBadge role={m.role} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trust Score */}
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Trust Score</h3>
                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                        <circle
                          cx="18" cy="18" r="15.915"
                          fill="none" stroke="#f3f4f6" strokeWidth="3"
                        />
                        <circle
                          cx="18" cy="18" r="15.915"
                          fill="none" stroke="#7c3aed" strokeWidth="3"
                          strokeDasharray={`${org.trustScore} ${100 - org.trustScore}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-violet-700">
                        {org.trustScore}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {org.trustScore >= 90 ? "Excellent" : org.trustScore >= 70 ? "Good" : "Fair"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                        Based on delivery rate, reviews, dispute history &amp; escrow compliance.
                      </p>
                    </div>
                  </div>
                  {org.verified && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                      <ShieldCheckIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-xs font-medium text-emerald-700">Verified Organisation</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Services Tab */}
          {activeTab === "services" && (
            <div>
              <p className="mb-5 text-sm text-gray-500">
                {org.services.length} service{org.services.length !== 1 ? "s" : ""} offered by{" "}
                {org.name}
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {org.services.map((svc) => (
                  <ServiceCard key={svc.id} svc={svc} />
                ))}
              </div>
            </div>
          )}

          {/* Products Tab */}
          {activeTab === "products" && (
            <div>
              <p className="mb-5 text-sm text-gray-500">
                {org.products.length} product{org.products.length !== 1 ? "s" : ""} sold by{" "}
                {org.name}
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {org.products.map((prd) => (
                  <ProductCard key={prd.id} prd={prd} />
                ))}
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === "members" && (
            <div>
              <p className="mb-5 text-sm text-gray-500">
                {org.members.length} active member{org.members.length !== 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {org.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition"
                  >
                    <img
                      src={m.avatar}
                      alt={m.name}
                      className="h-14 w-14 rounded-full object-cover flex-shrink-0 ring-2 ring-violet-100"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                        <RoleBadge role={m.role} />
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        <TrustBadge score={m.trustScore} />
                        <p className="text-xs text-gray-400">
                          Joined {format(new Date(m.joinedAt), "MMM yyyy")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === "reviews" && (
            <div>
              {/* Summary bar */}
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-extrabold text-gray-900">
                    {org.avgRating.toFixed(1)}
                  </span>
                  <div>
                    <StarRating rating={org.avgRating} size="md" />
                    <p className="mt-1 text-xs text-gray-400">{org.reviewCount} total reviews</p>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-5 gap-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const pct = star === 5 ? 72 : star === 4 ? 18 : star === 3 ? 6 : star === 2 ? 3 : 1;
                    return (
                      <div key={star} className="flex flex-col items-center gap-1">
                        <div className="h-16 w-full rounded bg-gray-100 overflow-hidden flex flex-col justify-end">
                          <div
                            className="w-full rounded bg-amber-400 transition-all"
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{star}★</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                {org.reviews.map((rv) => (
                  <ReviewCard key={rv.id} rv={rv} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

