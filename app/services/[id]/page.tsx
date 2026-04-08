import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  StarIcon,
  CheckBadgeIcon,
  ClockIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  ShareIcon,
  ChevronRightIcon,
  UserCircleIcon,
  MapPinIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";

// ─── Types ───────────────────────────────────────────────────────────────────

type Package = {
  id: "basic" | "standard" | "premium";
  label: string;
  price: number;
  delivery: string;
  revisions: number;
  description: string;
  features: string[];
};

type Review = {
  id: string;
  author: string;
  avatar: string | null;
  country: string;
  rating: number;
  date: string;
  body: string;
  helpful: number;
};

type ServiceDetail = {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  rating: number;
  reviewCount: number;
  images: string[];
  seller: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    level: string;
    location: string;
    languages: string[];
    memberSince: string;
    responseTime: string;
    lastSeen: string;
    bio: string;
    skills: string[];
    totalOrders: number;
    completionRate: number;
  };
  packages: Package[];
  description: string;
  faq: { q: string; a: string }[];
  tags: string[];
  reviews: Review[];
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_SERVICES: Record<string, ServiceDetail> = {
  "svc-001": {
    id: "svc-001",
    title: "I will design a professional logo for your brand or business",
    category: "Graphics & Design",
    subcategory: "Logo Design",
    rating: 4.9,
    reviewCount: 342,
    images: [
      "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&q=80",
      "https://images.unsplash.com/photo-1558655146-364adaf1fcc9?w=800&q=80",
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
    ],
    seller: {
      id: "usr-101",
      name: "Alex Morgan",
      username: "alexdesigns",
      avatar: "https://i.pravatar.cc/150?img=11",
      level: "Top Rated Seller",
      location: "United Kingdom",
      languages: ["English", "French"],
      memberSince: "January 2021",
      responseTime: "1 hour",
      lastSeen: "Online",
      bio: "Award-winning graphic designer with 8+ years of experience creating compelling visual identities for startups and Fortune 500 companies. I specialise in logo design, brand systems, and visual storytelling.",
      skills: ["Logo Design", "Brand Identity", "Illustrator", "Figma", "Typography"],
      totalOrders: 1204,
      completionRate: 99,
    },
    packages: [
      {
        id: "basic",
        label: "Basic",
        price: 49,
        delivery: "3 days",
        revisions: 2,
        description: "Clean, simple logo for your brand",
        features: [
          "1 concept",
          "PNG & SVG files",
          "2 revisions",
          "3-day delivery",
          "Commercial use",
        ],
      },
      {
        id: "standard",
        label: "Standard",
        price: 99,
        delivery: "5 days",
        revisions: 5,
        description: "Full brand kit with multiple concepts",
        features: [
          "3 concepts",
          "All file formats",
          "5 revisions",
          "5-day delivery",
          "Commercial use",
          "Brand style guide",
          "Social media kit",
        ],
      },
      {
        id: "premium",
        label: "Premium",
        price: 199,
        delivery: "7 days",
        revisions: -1,
        description: "Complete brand identity system",
        features: [
          "5 concepts",
          "All file formats",
          "Unlimited revisions",
          "7-day delivery",
          "Commercial use",
          "Full brand guide",
          "Stationery design",
          "Source files",
          "Priority support",
        ],
      },
    ],
    description: `## What you'll get

A **professional, memorable logo** that captures your brand's essence. Every design is crafted from scratch — no templates, no clip art.

## My process

1. **Discovery** — I'll ask about your brand, audience, and vision
2. **Research** — competitor analysis and mood-boarding  
3. **Design** — multiple original concepts tailored to your brief
4. **Refine** — iterate until you're 100% satisfied
5. **Deliver** — all files in every format you need

## Why choose me?

- 8+ years of professional design experience
- 1,200+ completed projects across 40 countries
- Featured in Creative Bloq and Design Week
- 99% completion rate and 4.9-star average

All work is **100% original** and you receive full commercial rights upon delivery.`,
    faq: [
      {
        q: "What information do you need to get started?",
        a: "I'll need your business name, industry, target audience, preferred colour palette (if any), and any design references you like. A brief questionnaire is sent after purchase.",
      },
      {
        q: "Can I request changes after delivery?",
        a: "Yes! Revisions are included in every package. Unlimited revisions are available on the Premium package.",
      },
      {
        q: "What file formats will I receive?",
        a: "Basic delivers PNG and SVG. Standard and Premium include AI, EPS, PDF, PNG, SVG, and JPG — everything you need for print and digital.",
      },
      {
        q: "Do I own the copyright?",
        a: "Absolutely. Full commercial rights transfer to you upon final delivery and payment.",
      },
    ],
    tags: ["logo design", "brand identity", "minimalist logo", "startup branding", "business logo"],
    reviews: [
      {
        id: "rev-1",
        author: "Sarah K.",
        avatar: "https://i.pravatar.cc/150?img=5",
        country: "United States",
        rating: 5,
        date: "2024-05-12",
        body: "Alex delivered exactly what I envisioned — and then some. The logo perfectly captures my brand, communication was excellent throughout, and revisions were quick. Highly recommend!",
        helpful: 24,
      },
      {
        id: "rev-2",
        author: "James T.",
        avatar: "https://i.pravatar.cc/150?img=8",
        country: "Australia",
        rating: 5,
        date: "2024-04-28",
        body: "Third time working with Alex and still blown away every time. Incredible attention to detail, fast turnaround, and really listens to the brief. Will be back for our next project.",
        helpful: 17,
      },
      {
        id: "rev-3",
        author: "Mia R.",
        avatar: null,
        country: "Germany",
        rating: 4,
        date: "2024-04-15",
        body: "Great work overall. Took a bit longer than the estimated delivery but the quality made it worth the wait. Very professional communication.",
        helpful: 8,
      },
    ],
  },
};

const FALLBACK_SERVICE: ServiceDetail = MOCK_SERVICES["svc-001"];

function getMockService(id: string): ServiceDetail {
  return MOCK_SERVICES[id] ?? { ...FALLBACK_SERVICE, id };
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const svc = getMockService(params.id);
  return {
    title: `${svc.title} | FreeTrust`,
    description: svc.description.slice(0, 155),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stars({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarSolid
          key={n}
          className={`h-${size} w-${size} ${
            n <= Math.round(rating) ? "text-amber-400" : "text-gray-200"
          }`}
        />
      ))}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
      {children}
    </span>
  );
}

function SellerCard({ seller }: { seller: ServiceDetail["seller"] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        {seller.avatar ? (
          <Image
            src={seller.avatar}
            alt={seller.name}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-indigo-100"
          />
        ) : (
          <UserCircleIcon className="h-16 w-16 text-gray-300" />
        )}
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${seller.username}`}
            className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
          >
            {seller.name}
          </Link>
          <p className="text-sm text-gray-500">@{seller.username}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{seller.level}</Badge>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        {[
          { label: "Location", value: seller.location, icon: MapPinIcon },
          { label: "Member since", value: seller.memberSince, icon: BriefcaseIcon },
          { label: "Response time", value: seller.responseTime, icon: ClockIcon },
          { label: "Completion", value: `${seller.completionRate}%`, icon: CheckBadgeIcon },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span className="text-gray-500 truncate">
              {label}:{" "}
              <span className="font-medium text-gray-800">{value}</span>
            </span>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-sm text-gray-600 leading-relaxed">{seller.bio}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {seller.skills.map((s) => (
          <span
            key={s}
            className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
          >
            {s}
          </span>
        ))}
      </div>

      <Link
        href={`/profile/${seller.username}`}
        className="mt-5 flex w-full items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        View Profile
      </Link>
    </div>
  );
}

// ─── Package Picker (client island placeholder rendered as static) ─────────────

function PackageTabs({ packages }: { packages: Package[] }) {
  // Note: full interactivity would require a client component;
  // rendered statically showing all packages in a comparison grid.
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Tab headers */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`py-3 text-center text-sm font-semibold cursor-pointer transition ${
              pkg.id === "standard"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {pkg.label}
          </div>
        ))}
      </div>

      {/* Show standard package details by default */}
      {packages.map((pkg) =>
        pkg.id === "standard" ? (
          <div key={pkg.id} className="p-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  ₮{pkg.price.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-gray-500">{pkg.description}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <div className="flex items-center gap-1 justify-end">
                  <ClockIcon className="h-4 w-4" />
                  {pkg.delivery} delivery
                </div>
                <div className="flex items-center gap-1 justify-end mt-1">
                  <ArrowPathIcon className="h-4 w-4" />
                  {pkg.revisions === -1 ? "Unlimited" : pkg.revisions} revisions
                </div>
              </div>
            </div>

            <ul className="mt-5 space-y-2.5">
              {pkg.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckBadgeIcon className="h-4 w-4 flex-shrink-0 text-indigo-500" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-3">
              <Link
                href={`/checkout/service/${FALLBACK_SERVICE.id}?pkg=${pkg.id}`}
                className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[.98] transition-all"
              >
                Continue — ₮{pkg.price}
              </Link>
              <Link
                href={`/messages/new?to=${FALLBACK_SERVICE.seller.username}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <ChatBubbleLeftRightIcon className="h-4 w-4" />
                Contact Seller
              </Link>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400">
              <ShieldCheckIcon className="h-4 w-4 text-green-500" />
              Escrow-protected · money held until you approve
            </div>
          </div>
        ) : null
      )}

      {/* Package comparison footnote */}
      <div className="border-t border-gray-100 px-6 py-3 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          FreeTrust charges an 8% service fee on freelance services.{" "}
          <Link href="/pricing" className="underline hover:text-gray-700">
            Learn more
          </Link>
        </p>
      </div>
    </div>
  );
}

function PackageCompare({ packages }: { packages: Package[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="py-3 text-left font-medium text-gray-500 pr-4">Feature</th>
            {packages.map((p) => (
              <th
                key={p.id}
                className={`py-3 text-center font-semibold ${
                  p.id === "standard" ? "text-indigo-600" : "text-gray-700"
                }`}
              >
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {[
            { label: "Price", key: "price", fmt: (v: number) => `₮${v}` },
            { label: "Delivery", key: "delivery", fmt: (v: string) => v },
            {
              label: "Revisions",
              key: "revisions",
              fmt: (v: number) => (v === -1 ? "Unlimited" : String(v)),
            },
          ].map(({ label, key, fmt }) => (
            <tr key={label}>
              <td className="py-3 text-gray-500 pr-4">{label}</td>
              {packages.map((p) => (
                <td key={p.id} className="py-3 text-center font-medium text-gray-800">
                  {/* @ts-expect-error dynamic key */}
                  {fmt(p[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImageGallery({ images, title }: { images: string[]; title: string }) {
  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-100">
        <Image
          src={images[0]}
          alt={title}
          fill
          className="object-cover"
          priority
        />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-3 gap-3">
          {images.slice(1).map((src, i) => (
            <div
              key={i}
              className="relative aspect-video overflow-hidden rounded-xl bg-gray-100"
            >
              <Image
                src={src}
                alt={`${title} ${i + 2}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const d = new Date(review.date);
  const dateStr = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="border-b border-gray-100 py-6 last:border-0">
      <div className="flex items-start gap-3">
        {review.avatar ? (
          <Image
            src={review.avatar}
            alt={review.author}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <UserCircleIcon className="h-10 w-10 flex-shrink-0 text-gray-300" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{review.author}</span>
            <span className="text-xs text-gray-400">{review.country}</span>
            <Stars rating={review.rating} size={3} />
            <span className="ml-auto text-xs text-gray-400">{dateStr}</span>
          </div>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{review.body}</p>
          <p className="mt-2 text-xs text-gray-400">
            {review.helpful} people found this helpful
          </p>
        </div>
      </div>
    </div>
  );
}

function RatingBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 text-gray-600 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-gray-500 text-xs">{pct}%</span>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-gray-100 py-4">
      <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-gray-900 list-none gap-3">
        {q}
        <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-90" />
      </summary>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">{a}</p>
    </details>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const svc = getMockService(params.id);
  const { seller, packages, reviews } = svc;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 text-xs text-gray-500">
            <Link href="/" className="hover:text-indigo-600 transition-colors">
              Home
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <Link
              href={`/services?category=${encodeURIComponent(svc.category)}`}
              className="hover:text-indigo-600 transition-colors"
            >
              {svc.category}
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <Link
              href={`/services?subcategory=${encodeURIComponent(svc.subcategory)}`}
              className="hover:text-indigo-600 transition-colors"
            >
              {svc.subcategory}
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <span className="truncate max-w-xs text-gray-800">{svc.title}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* ── Left / Main ── */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & meta */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-snug">
                {svc.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link href={`/profile/${seller.username}`} className="flex items-center gap-2">
                  {seller.avatar ? (
                    <Image
                      src={seller.avatar}
                      alt={seller.name}
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircleIcon className="h-7 w-7 text-gray-300" />
                  )}
                  <span className="text-sm font-medium text-gray-800 hover:text-indigo-600 transition-colors">
                    {seller.name}
                  </span>
                </Link>
                <Badge>{seller.level}</Badge>
                <div className="flex items-center gap-1">
                  <StarSolid className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold text-gray-800">
                    {svc.rating.toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({svc.reviewCount.toLocaleString()})
                  </span>
                </div>
                <span className="text-sm text-gray-400">
                  {seller.totalOrders.toLocaleString()} orders
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                <HeartIcon className="h-4 w-4" />
                Save
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                <ShareIcon className="h-4 w-4" />
                Share
              </button>
            </div>

            {/* Gallery */}
            <ImageGallery images={svc.images} title={svc.title} />

            {/* Mobile: Package card */}
            <div className="lg:hidden">
              <PackageTabs packages={packages} />
            </div>

            {/* Description */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                About This Service
              </h2>
              <div className="prose prose-sm prose-indigo max-w-none text-gray-600 leading-relaxed whitespace-pre-line">
                {svc.description
                  .replace(/##\s/g, "")
                  .replace(/\*\*/g, "")}
              </div>
            </section>

            {/* Package comparison */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Compare Packages
              </h2>
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <PackageCompare packages={packages} />
              </div>
            </section>

            {/* Seller card (mobile) */}
            <div className="lg:hidden">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">About the Seller</h2>
              <SellerCard seller={seller} />
            </div>

            {/* FAQ */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">FAQ</h2>
              <div className="rounded-2xl border border-gray-100 bg-white px-6 shadow-sm">
                {svc.faq.map((item) => (
                  <FAQItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </section>

            {/* Reviews */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Reviews{" "}
                  <span className="text-gray-400 font-normal text-base">
                    ({svc.reviewCount})
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <StarSolid className="h-5 w-5 text-amber-400" />
                  <span className="text-xl font-bold text-gray-900">
                    {svc.rating.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Rating breakdown */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm mb-6 space-y-2">
                <RatingBar label="Communication" pct={98} />
                <RatingBar label="Service quality" pct={97} />
                <RatingBar label="Value for money" pct={94} />
                <RatingBar label="Recommend" pct={99} />
              </div>

              {/* Review list */}
              <div className="rounded-2xl border border-gray-100 bg-white px-6 shadow-sm">
                {reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>

              {svc.reviewCount > reviews.length && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Show all {svc.reviewCount} reviews
                  </button>
                </div>
              )}
            </section>

            {/* Tags */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {svc.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/search?q=${encodeURIComponent(tag)}`}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* ── Right / Sidebar ── */}
          <div className="hidden lg:block space-y-6">
            <div className="sticky top-6 space-y-6">
              <PackageTabs packages={packages} />
              <SellerCard seller={seller} />

              {/* Trust badges */}
              <div className="rounded-2xl border border-green-100 bg-green-50 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-green-800">
                  FreeTrust Guarantee
                </h3>
                {[
                  "Funds held in escrow until you approve",
                  "Full refund if order not delivered",
                  "Dispute resolution within 48 hours",
                  "Secure Stripe payment processing",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-2">
                    <ShieldCheckIcon className="h-4 w-4 flex-shrink-0 text-green-500 mt-0.5" />
                    <span className="text-xs text-green-700">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

