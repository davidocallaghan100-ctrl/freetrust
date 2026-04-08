"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingCartIcon,
  BoltIcon,
  StarIcon,
  ShieldCheckIcon,
  TruckIcon,
  ArrowLeftIcon,
  HeartIcon,
  ShareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  MinusIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import {
  StarIcon as StarSolid,
  HeartIcon as HeartSolid,
} from "@heroicons/react/24/solid";
import { formatDistanceToNow } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductImage = { id: string; url: string; alt: string };
type Review = {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  date: Date;
  body: string;
  verified: boolean;
};
type Product = {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  price: number;
  originalPrice?: number;
  currency: string;
  category: string;
  condition: "New" | "Like New" | "Good" | "Fair";
  stock: number;
  images: ProductImage[];
  seller: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    rating: number;
    totalSales: number;
    responseTime: string;
    joinedAt: Date;
  };
  specs: Record<string, string>;
  tags: string[];
  reviews: Review[];
  avgRating: number;
  totalReviews: number;
  shippingInfo: string;
  returnsPolicy: string;
  escrowProtected: boolean;
  trustFee: number; // 5%
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_PRODUCTS: Record<string, Product> = {
  "1": {
    id: "1",
    title: "Premium Mechanical Keyboard — TKL RGB Backlit",
    description:
      "Tenkeyless mechanical keyboard with Cherry MX Blue switches and per-key RGB lighting. Perfect for programmers and gamers alike.",
    longDescription: `This premium TKL mechanical keyboard delivers an exceptional typing experience with genuine Cherry MX Blue switches — tactile, clicky, and built to last 100 million keystrokes.

Per-key RGB illumination with 16.8 million colours lets you customise every key individually. The aluminium top plate adds rigidity and a premium feel, while the detachable USB-C cable keeps your desk tidy.

Includes a set of PBT double-shot keycaps that resist shine and fade over years of heavy use. On-board memory stores up to 5 lighting profiles without software.`,
    price: 12900,
    originalPrice: 16900,
    currency: "USD",
    category: "Electronics",
    condition: "New",
    stock: 7,
    images: [
      { id: "img1", url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80", alt: "Keyboard front view" },
      { id: "img2", url: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&q=80", alt: "Keyboard RGB lighting" },
      { id: "img3", url: "https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=800&q=80", alt: "Keyboard side profile" },
      { id: "img4", url: "https://images.unsplash.com/photo-1595044426077-d36d9236d44a?w=800&q=80", alt: "Keyboard close-up switches" },
    ],
    seller: {
      id: "seller1",
      name: "TechGear Hub",
      avatar: "https://api.dicebear.com/7.x/initials/svg?seed=TechGear",
      verified: true,
      rating: 4.9,
      totalSales: 1243,
      responseTime: "< 1 hour",
      joinedAt: new Date("2021-03-15"),
    },
    specs: {
      "Switch Type": "Cherry MX Blue",
      "Form Factor": "TKL (80%)",
      "Connectivity": "USB-C (detachable)",
      "Backlighting": "Per-key RGB",
      "Keycaps": "PBT Double-shot",
      "Top Plate": "Aluminium",
      "Polling Rate": "1000 Hz",
      "Dimensions": "360 × 140 × 40 mm",
      "Weight": "870 g",
      "OS Support": "Windows / macOS / Linux",
    },
    tags: ["mechanical keyboard", "RGB", "Cherry MX", "TKL", "gaming", "typing"],
    reviews: [
      {
        id: "r1",
        author: "Alex R.",
        avatar: "https://api.dicebear.com/7.x/initials/svg?seed=AlexR",
        rating: 5,
        date: new Date("2024-11-20"),
        body: "Absolutely love this keyboard. The switches feel great and the build quality is top-notch. Shipping was fast too.",
        verified: true,
      },
      {
        id: "r2",
        author: "Sam K.",
        avatar: "https://api.dicebear.com/7.x/initials/svg?seed=SamK",
        rating: 5,
        date: new Date("2024-12-04"),
        body: "Best keyboard I've owned. The RGB is vibrant and the software-free profile storage is a huge plus.",
        verified: true,
      },
      {
        id: "r3",
        author: "Jordan P.",
        avatar: "https://api.dicebear.com/7.x/initials/svg?seed=JordanP",
        rating: 4,
        date: new Date("2025-01-11"),
        body: "Great quality but the clicky sound might bother office neighbours. Love the aluminium top plate.",
        verified: false,
      },
    ],
    avgRating: 4.8,
    totalReviews: 127,
    shippingInfo: "Free shipping on all orders. Estimated delivery 3–5 business days.",
    returnsPolicy: "30-day hassle-free returns. Item must be in original condition.",
    escrowProtected: true,
    trustFee: 5,
  },
  "2": {
    id: "2",
    title: "Ergonomic Mesh Office Chair",
    description:
      "Full mesh ergonomic chair with lumbar support, adjustable armrests, and 4D headrest. Designed for long work sessions.",
    longDescription: `Engineered for all-day comfort, this fully adjustable ergonomic chair features breathable mesh across the entire back and seat, keeping you cool during extended sessions.

The S-shaped lumbar support adapts to your spine's natural curve, reducing lower back fatigue. Four-dimensional armrests let you dial in the perfect position for your shoulders and wrists.

Height, recline tension, and headrest angle are all independently adjustable, making this chair suitable for a wide range of body types and work styles.`,
    price: 38900,
    originalPrice: 49900,
    currency: "USD",
    category: "Furniture",
    condition: "New",
    stock: 3,
    images: [
      { id: "img1", url: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=800&q=80", alt: "Office chair front" },
      { id: "img2", url: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800&q=80", alt: "Office chair side" },
    ],
    seller: {
      id: "seller2",
      name: "ErgoHome",
      avatar: "https://api.dicebear.com/7.x/initials/svg?seed=ErgoHome",
      verified: true,
      rating: 4.7,
      totalSales: 582,
      responseTime: "< 2 hours",
      joinedAt: new Date("2022-06-01"),
    },
    specs: {
      "Material": "Breathable mesh",
      "Max Load": "150 kg",
      "Seat Height": "42–52 cm (adjustable)",
      "Armrests": "4D adjustable",
      "Lumbar Support": "Yes (S-curve)",
      "Headrest": "4D adjustable",
      "Base": "Aluminium 5-star",
      "Casters": "PU soft-floor safe",
    },
    tags: ["ergonomic", "office chair", "mesh", "lumbar support", "home office"],
    reviews: [
      {
        id: "r1",
        author: "Morgan T.",
        avatar: "https://api.dicebear.com/7.x/initials/svg?seed=MorganT",
        rating: 5,
        date: new Date("2024-10-30"),
        body: "Back pain gone after switching to this chair. Worth every cent.",
        verified: true,
      },
    ],
    avgRating: 4.7,
    totalReviews: 64,
    shippingInfo: "Free delivery. White-glove assembly service available at checkout (+$49).",
    returnsPolicy: "14-day returns. Assembly service fee non-refundable.",
    escrowProtected: true,
    trustFee: 5,
  },
};

const FALLBACK_PRODUCT: Product = MOCK_PRODUCTS["1"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i + 1 <= Math.floor(rating);
        const partial = !filled && i < rating;
        return (
          <span key={i} className="relative inline-block">
            <StarIcon className="w-4 h-4 text-gray-300" />
            {(filled || partial) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: filled ? "100%" : `${(rating % 1) * 100}%` }}
              >
                <StarSolid className="w-4 h-4 text-amber-400" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function RatingBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-4 text-gray-600 text-right">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-xs text-gray-500 text-right">{pct}%</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const product: Product = MOCK_PRODUCTS[id] ?? FALLBACK_PRODUCT;

  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [wishlist, setWishlist] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "reviews">("description");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);

  const subtotal = product.price * qty;
  const fee = Math.round(subtotal * (product.trustFee / 100));
  const total = subtotal + fee;

  function prevImg() {
    setImgIdx((i) => (i === 0 ? product.images.length - 1 : i - 1));
  }
  function nextImg() {
    setImgIdx((i) => (i === product.images.length - 1 ? 0 : i + 1));
  }

  async function handleBuyNow() {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "product",
          itemId: product.id,
          qty,
          price: product.price,
          title: product.title,
          sellerId: product.seller.id,
        }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleAddToCart() {
    setCartLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setCartLoading(false);
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 2500);
  }

  const discountPct =
    product.originalPrice
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back
          </button>
          <span className="text-gray-300">/</span>
          <Link href="/search?category=products" className="text-sm text-gray-500 hover:text-gray-800">
            Products
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-700 font-medium truncate max-w-xs">
            {product.title}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* ── Image Gallery ─────────────────────────────────────── */}
          <div className="space-y-3 lg:sticky lg:top-24">
            <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm group">
              <Image
                src={product.images[imgIdx].url}
                alt={product.images[imgIdx].alt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              {discountPct && (
                <span className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  -{discountPct}%
                </span>
              )}
              {product.images.length > 1 && (
                <>
                  <button
                    onClick={prevImg}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full p-2 shadow-md hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeftIcon className="w-4 h-4 text-gray-700" />
                  </button>
                  <button
                    onClick={nextImg}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full p-2 shadow-md hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRightIcon className="w-4 h-4 text-gray-700" />
                  </button>
                </>
              )}
              {/* dot indicators */}
              {product.images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {product.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === imgIdx ? "bg-indigo-600 w-5" : "bg-white/60 hover:bg-white"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setImgIdx(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      i === imgIdx ? "border-indigo-500 shadow-md" : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Product Info ──────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Title + badges */}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-100">
                  {product.category}
                </span>
                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {product.condition}
                </span>
                {product.stock <= 5 && (
                  <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-100">
                    Only {product.stock} left
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-snug">
                {product.title}
              </h1>
            </div>

            {/* Rating summary */}
            <div className="flex items-center gap-3 flex-wrap">
              <StarRating rating={product.avgRating} />
              <span className="text-sm font-semibold text-gray-800">{product.avgRating}</span>
              <button
                onClick={() => setActiveTab("reviews")}
                className="text-sm text-indigo-600 hover:underline"
              >
                {product.totalReviews} reviews
              </button>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-500">{product.seller.totalSales} sold</span>
            </div>

            {/* Price */}
            <div className="flex items-end gap-3 flex-wrap">
              <span className="text-4xl font-extrabold text-gray-900">
                {fmtPrice(product.price, product.currency)}
              </span>
              {product.originalPrice && (
                <span className="text-xl text-gray-400 line-through">
                  {fmtPrice(product.originalPrice, product.currency)}
                </span>
              )}
              {discountPct && (
                <span className="text-sm font-bold text-rose-500">Save {discountPct}%</span>
              )}
            </div>

            {/* Trust + Escrow notice */}
            {product.escrowProtected && (
              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <ShieldCheckIcon className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Escrow Protected</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Payment held securely until you confirm delivery. A {product.trustFee}% FreeTrust fee applies (
                    {fmtPrice(fee, product.currency)} on this order).
                  </p>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Quantity</span>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-40"
                  disabled={qty <= 1}
                >
                  <MinusIcon className="w-4 h-4 text-gray-600" />
                </button>
                <span className="w-10 text-center text-sm font-semibold text-gray-900 select-none">
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                  className="px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-40"
                  disabled={qty >= product.stock}
                >
                  <PlusIcon className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <span className="text-xs text-gray-500">{product.stock} in stock</span>
            </div>

            {/* Order summary mini */}
            {qty > 1 && (
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1 border border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({qty} × {fmtPrice(product.price, product.currency)})</span>
                  <span>{fmtPrice(subtotal, product.currency)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>FreeTrust fee ({product.trustFee}%)</span>
                  <span>{fmtPrice(fee, product.currency)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Total</span>
                  <span>{fmtPrice(total, product.currency)}</span>
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex gap-3 flex-col sm:flex-row">
              <button
                onClick={handleBuyNow}
                disabled={checkoutLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors shadow-md shadow-indigo-200"
              >
                <BoltIcon className="w-5 h-5" />
                {checkoutLoading ? "Redirecting…" : "Buy Now"}
              </button>
              <button
                onClick={handleAddToCart}
                disabled={cartLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-900 font-semibold py-3.5 px-6 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-colors"
              >
                <ShoppingCartIcon className="w-5 h-5" />
                {cartLoading ? "Adding…" : cartAdded ? "✓ Added to Cart" : "Add to Cart"}
              </button>
            </div>

            {/* Action links */}
            <div className="flex items-center gap-4 pt-1">
              <button
                onClick={() => setWishlist((w) => !w)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-rose-500 transition-colors"
              >
                {wishlist ? (
                  <HeartSolid className="w-4 h-4 text-rose-500" />
                ) : (
                  <HeartIcon className="w-4 h-4" />
                )}
                {wishlist ? "Saved" : "Save"}
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: product.title, url: window.location.href });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <ShareIcon className="w-4 h-4" />
                Share
              </button>
            </div>

            {/* Shipping + Returns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-start gap-2.5 bg-white border border-gray-200 rounded-xl p-3.5">
                <TruckIcon className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-700">Shipping</p>
                  <p className="text-xs text-gray-500 mt-0.5">{product.shippingInfo}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 bg-white border border-gray-200 rounded-xl p-3.5">
                <ShieldCheckIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-700">Returns</p>
                  <p className="text-xs text-gray-500 mt-0.5">{product.returnsPolicy}</p>
                </div>
              </div>
            </div>

            {/* Seller card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4">
              <div className="relative">
                <Image
                  src={product.seller.avatar}
                  alt={product.seller.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full bg-gray-100"
                />
                {product.seller.verified && (
                  <CheckBadgeIcon className="w-5 h-5 text-indigo-600 absolute -bottom-1 -right-1 bg-white rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <Link
                      href={`/organisations/${product.seller.id}`}
                      className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors text-sm"
                    >
                      {product.seller.name}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StarSolid className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs text-gray-600">{product.seller.rating}</span>
                      <span className="text-gray-300 text-xs">·</span>
                      <span className="text-xs text-gray-500">{product.seller.totalSales} sales</span>
                    </div>
                  </div>
                  <button className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 transition-colors px-3 py-1.5 rounded-lg">
                    <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                    Message
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-xs text-gray-500">
                    Responds {product.seller.responseTime}
                  </span>
                  <span className="text-gray-300 text-xs">·</span>
                  <span className="text-xs text-gray-500">
                    Seller since{" "}
                    {product.seller.joinedAt.getFullYear()}
                  </span>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 text-xs font-medium px-3 py-1 rounded-full transition-colors border border-transparent hover:border-indigo-200"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div className="mt-14">
          <div className="flex gap-1 border-b border-gray-200">
            {(["description", "specs", "reviews"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab}
                {tab === "reviews" && (
                  <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                    {product.totalReviews}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-8">
            {/* Description */}
            {activeTab === "description" && (
              <div className="max-w-3xl">
                <p className="text-gray-500 text-base mb-4">{product.description}</p>
                <div className="prose prose-gray text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {product.longDescription}
                </div>
              </div>
            )}

            {/* Specs */}
            {activeTab === "specs" && (
              <div className="max-w-xl bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(product.specs).map(([key, val], i) => (
                      <tr key={key} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <td className="px-5 py-3 font-medium text-gray-600 w-40">{key}</td>
                        <td className="px-5 py-3 text-gray-900">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Reviews */}
            {activeTab === "reviews" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-4xl">
                {/* Summary */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col items-center text-center h-fit">
                  <span className="text-6xl font-extrabold text-gray-900">{product.avgRating}</span>
                  <StarRating rating={product.avgRating} />
                  <span className="text-sm text-gray-500 mt-2">
                    Based on {product.totalReviews} reviews
                  </span>
                  <div className="w-full mt-5 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const pct =
                        star === 5 ? 72 : star === 4 ? 18 : star === 3 ? 6 : star === 2 ? 2 : 2;
                      return <RatingBar key={star} label={String(star)} pct={pct} />;
                    })}
                  </div>
                </div>

                {/* Review list */}
                <div className="lg:col-span-2 space-y-4">
                  {product.reviews.map((rev) => (
                    <div key={rev.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <Image
                          src={rev.avatar}
                          alt={rev.author}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-gray-900">
                                {rev.author}
                              </span>
                              {rev.verified && (
                                <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                                  <CheckBadgeIcon className="w-3.5 h-3.5" />
                                  Verified
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">
                              {formatDistanceToNow(rev.date, { addSuffix: true })}
                            </span>
                          </div>
                          <StarRating rating={rev.rating} />
                          <p className="text-sm text-gray-600 mt-2 leading-relaxed">{rev.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {product.totalReviews > product.reviews.length && (
                    <button className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors font-medium">
                      Load more reviews ({product.totalReviews - product.reviews.length} remaining)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

