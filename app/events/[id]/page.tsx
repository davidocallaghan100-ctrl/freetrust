<<<FILE: app/events/[id]/page.tsx>>>
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, formatDistance, isPast, isToday, addDays } from "date-fns";
import {
  CalendarDaysIcon,
  MapPinIcon,
  UserGroupIcon,
  ShareIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  GlobeAltIcon,
  TicketIcon,
  StarIcon,
  ChevronLeftIcon,
  PlusIcon,
  MinusIcon,
  CurrencyDollarIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftIcon,
  EllipsisHorizontalIcon,
  BellIcon,
  HeartIcon,
  QrCodeIcon,
  ArrowUpTrayIcon,
  LinkIcon,
  EnvelopeIcon,
  CheckIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  HeartIcon as HeartSolid,
  StarIcon as StarSolid,
  CheckCircleIcon as CheckCircleSolid,
} from "@heroicons/react/24/solid";
import { create } from "zustand";

// ─── Types ───────────────────────────────────────────────────────────────────

type TicketTier = {
  id: string;
  name: string;
  price: number; // 0 = free
  description: string;
  total: number;
  remaining: number;
  perks: string[];
};

type Attendee = {
  id: string;
  name: string;
  avatar: string;
  trustScore: number;
  ticketType: string;
  rsvpStatus: "going" | "maybe" | "not_going";
  joinedAt: string;
};

type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  likes: number;
  liked: boolean;
};

type Organiser = {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  trustScore: number;
  eventsHosted: number;
  totalAttendees: number;
  verified: boolean;
  rating: number;
  bio: string;
};

type Event = {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  category: string;
  tags: string[];
  type: "online" | "in_person" | "hybrid";
  startDate: string;
  endDate: string;
  timezone: string;
  location: {
    name: string;
    address: string;
    city: string;
    country: string;
    lat?: number;
    lng?: number;
    onlineUrl?: string;
  };
  coverImage: string;
  organiser: Organiser;
  tickets: TicketTier[];
  attendees: Attendee[];
  comments: Comment[];
  capacity: number;
  totalRsvp: number;
  isPublished: boolean;
  isFeatured: boolean;
  trustReward: number;
  agenda: { time: string; title: string; speaker?: string }[];
  faqs: { q: string; a: string }[];
};

type RSVPState = {
  status: "idle" | "going" | "maybe" | "not_going";
  selectedTicket: string | null;
  quantities: Record<string, number>;
  totalPaid: number;
  confirmed: boolean;
  trustEarned: number;
};

type EventStore = {
  event: Event | null;
  rsvp: RSVPState;
  liked: boolean;
  notified: boolean;
  shareOpen: boolean;
  checkoutOpen: boolean;
  activeTab: "about" | "agenda" | "attendees" | "comments" | "faqs";
  setEvent: (e: Event) => void;
  setRsvpStatus: (s: RSVPState["status"]) => void;
  setTicketQty: (id: string, qty: number) => void;
  confirmRsvp: () => void;
  toggleLike: () => void;
  toggleNotify: () => void;
  setShareOpen: (v: boolean) => void;
  setCheckoutOpen: (v: boolean) => void;
  setTab: (t: EventStore["activeTab"]) => void;
  addComment: (text: string) => void;
  toggleCommentLike: (id: string) => void;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_EVENT: Event = {
  id: "evt-001",
  title: "FreeTrust Summit 2025: Building Trust in the Digital Age",
  description:
    "The premier annual gathering for trust-builders, community leaders, and digital innovators.",
  longDescription: `Join us for a full-day immersive experience exploring how trust shapes our digital future. From panel discussions with industry leaders to hands-on workshops and networking sessions, FreeTrust Summit 2025 is the must-attend event for anyone serious about building authentic digital communities.\n\nThis year's theme — "Trust as Infrastructure" — challenges us to rethink how we design systems, platforms, and relationships in an era of misinformation and digital fatigue.\n\nWhether you're a developer, designer, community manager, or curious citizen, there's something here for you. Come ready to learn, share, and build lasting connections with like-minded trust advocates.`,
  category: "Technology",
  tags: ["trust", "community", "web3", "digital-identity", "networking"],
  type: "hybrid",
  startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  endDate: new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 14 + 1000 * 60 * 60 * 8
  ).toISOString(),
  timezone: "Europe/London",
  location: {
    name: "The Barbican Centre",
    address: "Silk Street",
    city: "London",
    country: "UK",
    onlineUrl: "https://stream.freetrust.io/summit2025",
  },
  coverImage: "",
  organiser: {
    id: "org-001",
    name: "FreeTrust Events",
    avatar: "",
    tagline: "Building trust, one event at a time",
    trustScore: 982,
    eventsHosted: 47,
    totalAttendees: 12400,
    verified: true,
    rating: 4.9,
    bio: "FreeTrust Events is the official events arm of the FreeTrust platform. We host world-class events that bring together the brightest minds in trust, community, and digital innovation.",
  },
  tickets: [
    {
      id: "t-free",
      name: "Online Access",
      price: 0,
      description: "Live stream access to all keynotes and panels",
      total: 500,
      remaining: 312,
      perks: ["Live stream", "Digital swag bag", "Community Discord access"],
    },
    {
      id: "t-standard",
      name: "In-Person Standard",
      price: 75,
      description: "Full in-person access with lunch included",
      total: 300,
      remaining: 87,
      perks: [
        "All sessions",
        "Lunch & refreshments",
        "Networking dinner",
        "+₮25 Trust bonus",
      ],
    },
    {
      id: "t-vip",
      name: "VIP Experience",
      price: 149,
      description: "Premium experience with speaker access",
      total: 50,
      remaining: 12,
      perks: [
        "Front-row seating",
        "Speaker meet & greet",
        "Exclusive workshops",
        "Premium swag",
        "+₮50 Trust bonus",
        "1:1 networking sessions",
      ],
    },
  ],
  attendees: [
    {
      id: "a1",
      name: "Maya Chen",
      avatar: "",
      trustScore: 847,
      ticketType: "VIP Experience",
      rsvpStatus: "going",
      joinedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "a2",
      name: "James Okafor",
      avatar: "",
      trustScore: 721,
      ticketType: "In-Person Standard",
      rsvpStatus: "going",
      joinedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: "a3",
      name: "Sophie Laurent",
      avatar: "",
      trustScore: 634,
      ticketType: "Online Access",
      rsvpStatus: "going",
      joinedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "a4",
      name: "Raj Patel",
      avatar: "",
      trustScore: 912,
      ticketType: "VIP Experience",
      rsvpStatus: "maybe",
      joinedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: "a5",
      name: "Lena Fischer",
      avatar: "",
      trustScore: 558,
      ticketType: "In-Person Standard",
      rsvpStatus: "going",
      joinedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
      id: "a6",
      name: "Carlos Mendez",
      avatar: "",
      trustScore: 445,
      ticketType: "Online Access",
      rsvpStatus: "going",
      joinedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
  ],
  comments: [
    {
      id: "c1",
      authorId: "a1",
      authorName: "Maya Chen",
      authorAvatar: "",
      content:
        "So excited for this! The speaker lineup looks incredible. Already blocked my calendar. See you all there! 🎉",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      likes: 14,
      liked: false,
    },
    {
      id: "c2",
      authorId: "a2",
      authorName: "James Okafor",
      authorAvatar: "",
      content:
        "Will there be recordings available for those who can't attend in person? The online ticket looks great but wondering about replay access.",
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      likes: 7,
      liked: false,
    },
    {
      id: "c3",
      authorId: "a4",
      authorName: "Raj Patel",
      authorAvatar: "",
      content:
        "Attended last year's summit — absolutely worth it. The VIP networking sessions alone were game-changing for my work. Highly recommend going VIP if you can!",
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      likes: 22,
      liked: true,
    },
  ],
  capacity: 850,
  totalRsvp: 401,
  isPublished: true,
  isFeatured: true,
  trustReward: 15,
  agenda: [
    {
      time: "09:00",
      title: "Registration & Morning Networking",
      speaker: undefined,
    },
    {
      time: "10:00",
      title: "Opening Keynote: Trust as Infrastructure",
      speaker: "Dr. Amara Nwosu",
    },
    {
      time: "11:00",
      title: "Panel: Decentralised Identity & Trust",
      speaker: "Multi-speaker panel",
    },
    {
      time: "12:30",
      title: "Lunch & Exhibition",
      speaker: undefined,
    },
    {
      time: "13:30",
      title: "Workshop: Building Trust-First Products",
      speaker: "Tom Kalliokoski",
    },
    {
      time: "15:00",
      title: "Fireside Chat: Community Trust at Scale",
      speaker: "Sarah Obi & Marcus Wells",
    },
    {
      time: "16:30",
      title: "Lightning Talks",
      speaker: "Various",
    },
    {
      time: "17:30",
      title: "Closing Keynote & Trust Awards",
      speaker: "FreeTrust CEO",
    },
    {
      time: "18:30",
      title: "Evening Networking Dinner (VIP)",
      speaker: undefined,
    },
  ],
  faqs: [
    {
      q: "Is the event accessible?",
      a: "Yes — The Barbican is fully accessible. Please contact us for specific accommodation needs.",
    },
    {
      q: "Can I switch from online to in-person?",
      a: "Yes, upgrades are available subject to ticket availability. Email events@freetrust.io.",
    },
    {
      q: "Will sessions be recorded?",
      a: "All keynotes and panels will be available on-demand for 30 days post-event for all ticket holders.",
    },
    {
      q: "What's the refund policy?",
      a: "Full refunds available up to 7 days before the event. 50% refund up to 48 hours before.",
    },
    {
      q: "How do I earn Trust tokens?",
      a: "Attending the event earns you ₮15. VIP and Standard ticket holders earn additional bonuses listed on their ticket.",
    },
  ],
};

// ─── Store ────────────────────────────────────────────────────────────────────

const useEventStore = create<EventStore>((set, get) => ({
  event: null,
  rsvp: {
    status: "idle",
    selectedTicket: null,
    quantities: {},
    totalPaid: 0,
    confirmed: false,
    trustEarned: 0,
  },
  liked: false,
  notified: false,
  shareOpen: false,
  checkoutOpen: false,
  activeTab: "about",
  setEvent: (e) => set({ event: e }),
  setRsvpStatus: (s) =>
    set((st) => ({ rsvp: { ...st.rsvp, status: s } })),
  setTicketQty: (id, qty) => {
    const event = get().event;
    if (!event) return;
    const ticket = event.tickets.find((t) => t.id === id);
    if (!ticket) return;
    const newQty = Math.max(0, Math.min(qty, Math.min(ticket.remaining, 5)));
    const newQuantities = { ...get().rsvp.quantities, [id]: newQty };
    const total = event.tickets.reduce(
      (sum, t) => sum + (newQuantities[t.id] || 0) * t.price,
      0
    );
    set((st) => ({
      rsvp: { ...st.rsvp, quantities: newQuantities, totalPaid: total },
    }));
  },
  confirmRsvp: () => {
    const { rsvp, event } = get();
    if (!event) return;
    const trustEarned =
      event.trustReward +
      event.tickets.reduce((sum, t) => {
        const qty = rsvp.quantities[t.id] || 0;
        if (qty > 0 && t.id === "t-vip") return sum + 50;
        if (qty > 0 && t.id === "t-standard") return sum + 25;
        return sum;
      }, 0);
    set((st) => ({
      rsvp: {
        ...st.rsvp,
        status: "going",
        confirmed: true,
        trustEarned,
      },
      checkoutOpen: false,
    }));
  },
  toggleLike: () => set((st) => ({ liked: !st.liked })),
  toggleNotify: () => set((st) => ({ notified: !st.notified })),
  setShareOpen: (v) => set({ shareOpen: v }),
  setCheckoutOpen: (v) => set({ checkoutOpen: v }),
  setTab: (t) => set({ activeTab: t }),
  addComment: (text) => {
    const event = get().event;
    if (!event || !text.trim()) return;
    const newComment: Comment = {
      id: `c-${Date.now()}`,
      authorId: "me",
      authorName: "You",
      authorAvatar: "",
      content: text.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
      liked: false,
    };
    set({
      event: { ...event, comments: [...event.comments, newComment] },
    });
  },
  toggleCommentLike: (id) => {
    const event = get().event;
    if (!event) return;
    set({
      event: {
        ...event,
        comments: event.comments.map((c) =>
          c.id === id
            ? { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 }
            : c
        ),
      },
    });
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
];

function avatarColor(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function formatPrice(p: number): string {
  return p === 0 ? "Free" : `£${p}`;
}

function capacityPct(rsvp: number, capacity: number): number {
  return Math.min(100, Math.round((rsvp / capacity) * 100));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const s =
    size === "sm"
      ? "w-8 h-8 text-xs"
      : size === "lg"
      ? "w-12 h-12 text-base"
      : size === "xl"
      ? "w-16 h-16 text-xl"
      : "w-10 h-10 text-sm";
  return (
    <div
      className={`${s} ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
    >
      {initials(name)}
    </div>
  );
}

function TrustBadge({ score }: { score: number }) {
  const color =
    score >= 800
      ? "text-violet-600 bg-violet-50"
      : score >= 600
      ? "text-emerald-600 bg-emerald-50"
      : "text-amber-600 bg-amber-50";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      ₮{score}
    </span>
  );
}

function StatusBadge({ type }: { type: "online" | "in_person" | "hybrid" }) {
  const map = {
    online: { label: "Online", color: "bg-sky-100 text-sky-700", Icon: GlobeAltIcon },
    in_person: {
      label: "In Person",
      color: "bg-emerald-100 text-emerald-700",
      Icon: MapPinIcon,
    },
    hybrid: {
      label: "Hybrid",
      color: "bg-violet-100 text-violet-700",
      Icon: BuildingOfficeIcon,
    },
  };
  const { label, color, Icon } = map[type];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────

function CheckoutModal({ event }: { event: Event }) {
  const { rsvp, setTicketQty, confirmRsvp, setCheckoutOpen } = useEventStore();
  const [step, setStep] = useState<"tickets" | "confirm">("tickets");
  const hasSelected = Object.values(rsvp.quantities).some((q) => q > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setCheckoutOpen(false)}
      />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">
              {step === "tickets" ? "Choose Tickets" : "Confirm RSVP"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
              {event.title}
            </p>
          </div>
          <button
            onClick={() => setCheckoutOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {step === "tickets" ? (
          <>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {event.tickets.map((ticket) => {
                const qty = rsvp.quantities[ticket.id] || 0;
                const soldOut = ticket.remaining === 0;
                return (
                  <div
                    key={ticket.id}
                    className={`border rounded-xl p-4 transition-all ${
                      qty > 0
                        ? "border-violet-400 bg-violet-50"
                        : soldOut
                        ? "border-gray-100 bg-gray-50 opacity-60"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">
                            {ticket.name}
                          </span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              ticket.price === 0
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {formatPrice(ticket.price)}
                          </span>
                          {ticket.remaining <= 20 && !soldOut && (
                            <span className="text-xs text-rose-600 font-medium">
                              Only {ticket.remaining} left!
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {ticket.description}
                        </p>
                        <ul className="mt-2 space-y-0.5">
                          {ticket.perks.map((p) => (
                            <li
                              key={p}
                              className="flex items-center gap-1.5 text-xs text-gray-600"
                            >
                              <CheckIcon className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {!soldOut ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() =>
                              setTicketQty(ticket.id, qty - 1)
                            }
                            disabled={qty === 0}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <MinusIcon className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center font-semibold text-gray-900 text-sm">
                            {qty}
                          </span>
                          <button
                            onClick={() =>
                              setTicketQty(ticket.id, qty + 1)
                            }
                            disabled={qty >= Math.min(ticket.remaining, 5)}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-gray-400 flex-shrink-0">
                          Sold Out
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Trust reward notice */}
            <div className="mx-5 mb-3 bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4 text-violet-600 flex-shrink-0" />
              <p className="text-xs text-violet-700">
                Attending earns you{" "}
                <span className="font-bold">₮{event.trustReward}</span> Trust
                tokens automatically.
              </p>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">
                  Total
                  {Object.values(rsvp.quantities).reduce((s, q) => s + q, 0) >
                    0 &&
                    ` (${Object.values(rsvp.quantities).reduce(
                      (s, q) => s + q,
                      0
                    )} ticket${
                      Object.values(rsvp.quantities).reduce((s, q) => s + q, 0) >
                      1
                        ? "s"
                        : ""
                    })`}
                </span>
                <span className="font-bold text-gray-900 text-lg">
                  {rsvp.totalPaid === 0 ? "Free" : `£${rsvp.totalPaid}`}
                </span>
              </div>
              <button
                disabled={!hasSelected}
                onClick={() => setStep("confirm")}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-violet-600 hover:bg-violet-700 text-white"
              >
                Continue →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">
                  Order Summary
                </h3>
                {event.tickets
                  .filter((t) => (rsvp.quantities[t.id] || 0) > 0)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-gray-600">
                        {t.name} × {rsvp.quantities[t.id]}
                      </span>
                      <span className="font-medium text-gray-900">
                        {t.price === 0
                          ? "Free"
                          : `£${t.price * rsvp.quantities[t.id]}`}
                      </span>
                    </div>
                  ))}
                <div className="pt-2 border-t border-gray-200 flex justify-between font-bold">
                  <span>Total</span>
                  <span>
                    {rsvp.totalPaid === 0 ? "Free" : `£${rsvp.totalPaid}`}
                  </span>
                </div>
              </div>

              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-center">
                <ShieldCheckIcon className="w-8 h-8 text-violet-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-violet-900">
                  You'll earn Trust tokens
                </p>
                <p className="text-xs text-violet-600 mt-1">
                  ₮{event.trustReward} base + any ticket bonuses, credited on
                  attendance
                </p>
              </div>

              <p className="text-xs text-gray-500 text-center">
                By confirming, you agree to the event's cancellation policy.
              </p>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => setStep("tickets")}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={confirmRsvp}
                className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
              >
                {rsvp.totalPaid === 0 ? "Confirm RSVP" : "Pay & RSVP"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

function ShareModal({ event }: { event: Event }) {
  const { setShareOpen } = useEventStore();
  const [copied, setCopied] = useState(false);
  const url = `https://freetrust.io/events/${event.id}`;

  const copy = () => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOptions = [
    {
      label: "Copy Link",
      Icon: copied ? CheckIcon : LinkIcon,
      action: copy,
      color: "text-gray-700",
      bg: "bg-gray-100 hover:bg-gray-200",
    },
    {
      label: "Email",
      Icon: EnvelopeIcon,
      action: () =>
        window.open(
          `mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(url)}`
        ),
      color: "text-violet-700",
      bg: "bg-violet-50 hover:bg-violet-100",
    },
    {
      label: "Twitter / X",
      Icon: ArrowUpTrayIcon,
      action: () =>
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            `Join me at ${event.title}!`
          )}&url=${encodeURIComponent(url)}`
        ),
      color: "text-sky-700",
      bg: "bg-sky-50 hover:bg-sky-100",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setShareOpen(false)}
      />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Share Event</h2>
          <button
            onClick={() => setShareOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Event link</p>
              <p className="text-sm font-medium text-gray-900 truncate">{url}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {shareOptions.map(({ label, Icon, action, color, bg }) => (
              <button
                key={label}
                onClick={action}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${bg}`}
              >
                <Icon className={`w-5 h-5 ${color}`} />
                <span className={`text-xs font-medium ${color}`}>{label}</span>
              </button>
            ))}
          </div>

          <div className="bg-gray-50 rounded-xl p-4 flex flex-col items-center gap-2">
            <QrCodeIcon className="w-8 h-8 text-gray-400" />
            <p className="text-xs text-gray-500">QR code coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RSVP Success Banner ──────────────────────────────────────────────────────

function RsvpSuccessBanner({ trustEarned }: { trustEarned: number }) {
  return (
    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
      <div className="flex items-start gap-3">
        <CheckCircleSolid className="w-8 h-8 text-white flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-lg">You're going! 🎉</h3>
          <p className="text-violet-200 text-sm mt-1">
            Your RSVP is confirmed. Check your email for details.
          </p>
          <div className="mt-3 bg-white/20 rounded-xl p-3 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-white" />
            <div>
              <p className="text-xs text-violet-200">Trust reward queued</p>
              <p className="font-bold">₮{trustEarned} tokens on attendance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function Tabs() {
  const { activeTab, setTab, event } = useEventStore();
  const tabs: { key: EventStore["activeTab"]; label: string; count?: number }[] =
    [
      { key: "about", label: "About" },
      { key: "agenda", label: "Agenda", count: event?.agenda.length },
      {
        key: "attendees",
        label: "Attendees",
        count: event?.attendees.length,
      },
      { key: "comments", label: "Discussion", count: event?.comments.length },
      { key: "faqs", label: "FAQs" },
    ];

  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide border-b border-gray-100 -mx-4 px-4">
      {tabs.map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === key
              ? "border-violet-600 text-violet-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {label}
          {count !== undefined && (
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === key
                  ? "bg-violet-100 text-violet-600"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Tab: About ───────────────────────────────────────────────────────────────

function AboutTab({ event }: { event: Event }) {
  const [expanded, setExpanded] = useState(false);
  const paras = event.longDescription.split("\n\n");

  return (
    <div className="space-y-6">
      <div>
        <div
          className={`text-gray-700 text-sm leading-relaxed space-y-3 ${
            !expanded ? "line-clamp-6" : ""
          }`}
        >
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-violet-600 text-sm font-medium hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {event.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Location */}
      <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <MapPinIcon className="w-4 h-4 text-violet-600" />
          Location
        </h3>
        {(event.type === "in_person" || event.type === "hybrid") && (
          <div>
            <p className="font-medium text-gray-900 text-sm">
              {event.location.name}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">
              {event.location.address}, {event.location.city},{" "}
              {event.location.country}
            </p>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(
                `${event.location.name}, ${event.location.city}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-violet-600 font-medium hover:underline"
            >
              <MapPinIcon className="w-3.5 h-3.5" />
              Open in Maps
            </a>
          </div>
        )}
        {(event.type === "online" || event.type === "hybrid") && (
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">Online access</p>
            <p className="text-sm text-violet-600 font-medium mt-0.5">
              Link provided after RSVP
            </p>
          </div>
        )}
      </div>

      {/* Organiser Card */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-3">Organiser</h3>
        <div className="flex items-start gap-3">
          <Avatar name={event.organiser.name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-gray-900">
                {event.organiser.name}
              </span>
              {event.organiser.verified && (
                <ShieldCheckIcon className="w-4 h-4 text-violet-600" />
              )}
              <TrustBadge score={event.organiser.trustScore} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {event.organiser.tagline}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <StarSolid
                    key={s}
                    className={`w-3 h-3 ${
                      s <= Math.round(event.organiser.rating)
                        ? "text-amber-400"
                        : "text-gray-200"
                    }`}
                  />
                ))}
                <span className="text-xs text-gray-500 ml-0.5">
                  {event.organiser.rating}
                </span>
              </div>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500">
                {event.organiser.eventsHosted} events
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500">
                {event.organiser.totalAttendees.toLocaleString()} attendees
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-3 leading-relaxed">
          {event.organiser.bio}
        </p>
        <div className="mt-3 pt-3 border-t border-violet-100 flex items-center gap-2">
          <InformationCircleIcon className="w-3.5 h-3.5 text-violet-500" />
          <p className="text-xs text-violet-600 font-medium">
            Hosting this event earns ₮{event.trustReward} Trust tokens
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Agenda ──────────────────────────────────────────────────────────────

function AgendaTab({ event }: { event: Event }) {
  return (
    <div className="space-y-2">
      {event.agenda.map((item, i) => (
        <div
          key={i}
          className="flex gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <div className="flex-shrink-0 w-14 text-right">
            <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-1 rounded-lg">
              {item.time}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm">{item.title}</p>
            {item.speaker && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <UserGroupIcon className="w-3 h-3" />
                {item.speaker}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Attendees ───────────────────────────────────────────────────────────

function AttendeesTab({ event }: { event: Event }) {
  const pct = capacityPct(event.totalRsvp, event.capacity);

  return (
    <div className="space-y-5">
      {/* Capacity bar */}
      <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-900">
            {event.totalRsvp} attending
          </span>
          <span className="text-gray-500">
            {event.capacity - event.totalRsvp} spots left
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 90
                ? "bg-rose-500"
                : pct >= 70
                ? "bg-amber-500"
                : "bg-violet-600"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">{pct}% capacity reached</p>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {(["going", "maybe", "not_going"] as const).map((s) => {
          const count = event.attendees.filter(
            (a) => a.rsvpStatus === s
          ).length;
          const label =
            s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't Go";
          const color =
            s === "going"
              ? "text-emerald-600 bg-emerald-50"
              : s === "maybe"
              ? "text-amber-600 bg-amber-50"
              : "text-gray-500 bg-gray-50";
          return (
            <div
              key={s}
              className={`rounded-xl p-3 text-center ${color}`}
            >
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs font-medium mt-0.5">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Attendee list */}
      <div className="space-y-2">
        {event.attendees.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
          >
            <Avatar name={a.name} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">
                {a.name}
              </p>
              <p className="text-xs text-gray-500">{a.ticketType}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <TrustBadge score={a.trustScore} />
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  a.rsvpStatus === "going"
                    ? "bg-emerald-100 text-emerald-700"
                    : a.rsvpStatus === "maybe"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {a.rsvpStatus === "going"
                  ? "Going"
                  : a.rsvpStatus === "maybe"
                  ? "Maybe"
                  : "No"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Comments ────────────────────────────────────────────────────────────

function CommentsTab({ event }: { event: Event }) {
  const { addComment, toggleCommentLike } = useEventStore();
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!text.trim()) return;
    addComment(text);
    setText("");
  };

  return (
    <div className="space-y-4">
      {/* Comment input */}
      <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="Ask a question or share your thoughts…"
          rows={3}
          className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none outline-none"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{text.length}/280</span>
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Post
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="space-y-3">
        {event.comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.authorName} size="sm" className="mt-0.5" />
            <div className="flex-1 bg-gray-50 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900">
                  {c.authorName}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDistance(new Date(c.createdAt), new Date(), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{c.content}</p>
              <button
                onClick={() => toggleCommentLike(c.id)}
                className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
              >
                {c.liked ? (
                  <HeartSolid className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <HeartIcon className="w-3.5 h-3.5" />
                )}
                <span className={c.liked ? "text-rose-500" : ""}>{c.likes}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: FAQs ────────────────────────────────────────────────────────────────

function FaqsTab({ event }: { event: Event }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {event.faqs.map((faq, i) => (
        <div
          key={i}
          className="border border-gray-100 rounded-xl overflow-hidden"
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-gray-900 text-sm pr-4">
              {faq.q}
            </span>
            <ChevronRightIcon
              className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                open === i ? "rotate-90" : ""
              }`}
            />
          </button>
          {open === i && (
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Sticky CTA ───────────────────────────────────────────────────────────────

function StickyCta({ event }: { event: Event }) {
  const { rsvp, setCheckoutOpen } = useEventStore();
  const lowestFree = event.tickets.find((t) => t.price === 0);
  const lowestPaid = event.tickets
    .filter((t) => t.price > 0)
    .sort((a, b) => a.price - b.price)[0];

  if (rsvp.confirmed) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 shadow-2xl px-4 py-3 sm:hidden">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500">From</p>
          <p className="font-bold text-gray-900">
            {lowestFree ? "Free" : lowestPaid ? `£${lowestPaid.price}` : "—"}
          </p>
        </div>
        <button
          onClick={() => setCheckoutOpen(true)}
          className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm rounded-xl transition-colors"
        >
          RSVP Now
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const {
    event,
    rsvp,
    liked,
    notified,
    shareOpen,
    checkoutOpen,
    activeTab,
    setEvent,
    toggleLike,
    toggleNotify,
    setShareOpen,
    setCheckoutOpen,
  } = useEventStore();

  // Load mock event
  useEffect(() => {
    const id = params?.id as string;
    setEvent({ ...MOCK_EVENT, id: id || MOCK_EVENT.id });
  }, [params?.id, setEvent]);

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading event…</p>
        </div>
      </div>
    );
  }

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const inPast = isPast(endDate);
  const eventIsToday = isToday(startDate);

  const lowestPrice = Math.min(...event.tickets.map((t) => t.price));
  const soldOut = event.tickets.every((t) => t.remaining === 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero ── */}
      <div className="relative bg-gradient-to-br from-violet-900 via-indigo-900 to-violet-800 min-h-[260px] sm:min-h-[340px]">
        {/* Back button */}
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium bg-black/20 hover:bg-black/30 backdrop-blur-sm px-3 py-2 rounded-xl transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Action buttons top-right */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={toggleNotify}
            className={`p-2 rounded-xl backdrop-blur-sm transition-colors ${
              notified
                ? "bg-amber-400/90 text-white"
                : "bg-black/20 hover:bg-black/30 text-white/80 hover:text-white"
            }`}
            title={notified ? "Notifications on" : "Get notified"}
          >
            <BellIcon className="w-5 h-5" />
          </button>
          <button
            onClick={toggleLike}
            className={`p-2 rounded-xl backdrop-blur-sm transition-colors ${
              liked
                ? "bg-rose-500/90 text-white"
                : "bg-black/20 hover:bg-black/30 text-white/80 hover:text-white"
            }`}
          >
            {liked ? (
              <HeartSolid className="w-5 h-5" />
            ) : (
              <HeartIcon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="p-2 rounded-xl bg-black/20 hover:bg-black/30 backdrop-blur-sm text-white/80 hover:text-white transition-colors"
          >
            <ShareIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />
        </div>

        {/* Hero content */}
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <StatusBadge type={event.type} />
            {event.isFeatured && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <StarSolid className="w-3 h-3" />
                Featured
              </span>
            )}
            {eventIsToday && (
              <span className="inline
