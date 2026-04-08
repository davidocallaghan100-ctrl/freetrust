<<<FILE: app/events/[id]/page.tsx>>>
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  CalendarIcon,
  MapPinIcon,
  UserGroupIcon,
  ShareIcon,
  TicketIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronLeftIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  StarIcon,
  CurrencyDollarIcon,
  LinkIcon,
  EnvelopeIcon,
  PhoneIcon,
  EllipsisVerticalIcon,
  PencilSquareIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  UserIcon,
  BellIcon,
  BellSlashIcon,
  ArrowDownTrayIcon,
  QrCodeIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon as CheckCircleSolid,
  StarIcon as StarSolid,
  HeartIcon as HeartSolid,
} from "@heroicons/react/24/solid";
import { create } from "zustand";

// ─── Types ───────────────────────────────────────────────────────────────────

type EventMode = "online" | "in-person" | "hybrid";
type TicketType = { id: string; name: string; price: number; capacity: number; remaining: number; description: string };
type Attendee = { id: string; name: string; avatar: string; joinedAt: string; ticketType: string; verified: boolean };
type Organiser = { id: string; name: string; avatar: string; bio: string; email: string; phone: string; website: string; eventsHosted: number; trustScore: number; trustEarned: number; verified: boolean; followers: number };
type Event = {
  id: string; title: string; description: string; longDescription: string; mode: EventMode;
  startDate: string; endDate: string; timezone: string; location: string; onlineUrl: string;
  coverImage: string; category: string; tags: string[]; tickets: TicketType[];
  attendees: Attendee[]; organiser: Organiser; maxCapacity: number; isPublished: boolean;
  isFeatured: boolean; trustReward: number; agenda: { time: string; title: string; speaker: string }[];
  faqs: { q: string; a: string }[];
};

type RSVPState = { ticketId: string | null; qty: number; status: "idle" | "selecting" | "confirming" | "confirmed" | "cancelled" };

type Store = {
  rsvp: RSVPState;
  shareOpen: boolean;
  menuOpen: boolean;
  notifyEnabled: boolean;
  activeTab: string;
  setRsvp: (r: Partial<RSVPState>) => void;
  setShareOpen: (v: boolean) => void;
  setMenuOpen: (v: boolean) => void;
  setNotify: (v: boolean) => void;
  setTab: (t: string) => void;
};

// ─── Store ───────────────────────────────────────────────────────────────────

const useStore = create<Store>((set) => ({
  rsvp: { ticketId: null, qty: 1, status: "idle" },
  shareOpen: false,
  menuOpen: false,
  notifyEnabled: false,
  activeTab: "details",
  setRsvp: (r) => set((s) => ({ rsvp: { ...s.rsvp, ...r } })),
  setShareOpen: (v) => set({ shareOpen: v }),
  setMenuOpen: (v) => set({ menuOpen: v }),
  setNotify: (v) => set({ notifyEnabled: v }),
  setTab: (t) => set({ activeTab: t }),
}));

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_EVENT: Event = {
  id: "evt-001",
  title: "FreeTrust Community Summit 2025",
  description: "Join us for the biggest FreeTrust community event of the year — connecting builders, believers, and change-makers.",
  longDescription: `The FreeTrust Community Summit 2025 is a landmark gathering for everyone passionate about decentralised trust, community-driven economies, and the future of digital identity.

Whether you're a developer building on the FreeTrust protocol, a community organiser leveraging trust scores, or simply curious about the movement — this event is designed for you.

We'll feature keynote talks from industry pioneers, hands-on workshops, live demos of the latest FreeTrust features, and plenty of time to network with fellow community members.

Attendees who participate will earn Trust tokens and exclusive digital badges. Every session is designed to be practical, insightful, and genuinely transformative.

Don't miss the chance to be part of history in the making.`,
  mode: "hybrid",
  startDate: "2025-09-15T09:00:00Z",
  endDate: "2025-09-15T18:00:00Z",
  timezone: "Europe/London",
  location: "The Barbican Centre, Silk St, London EC2Y 8DS",
  onlineUrl: "https://meet.freetrust.io/summit-2025",
  coverImage: "",
  category: "Community",
  tags: ["trust", "community", "web3", "identity", "networking"],
  maxCapacity: 500,
  isPublished: true,
  isFeatured: true,
  trustReward: 15,
  tickets: [
    { id: "tk-free", name: "Community Pass", price: 0, capacity: 300, remaining: 87, description: "General admission — includes all keynotes and networking sessions." },
    { id: "tk-vip", name: "VIP Access", price: 49, capacity: 100, remaining: 23, description: "Priority seating, exclusive workshop access, VIP networking dinner, and digital goodie bag." },
    { id: "tk-online", name: "Online Ticket", price: 0, capacity: 1000, remaining: 643, description: "Stream all sessions live with interactive Q&A access." },
  ],
  attendees: [
    { id: "u1", name: "Alex Morgan", avatar: "AM", joinedAt: "2025-07-01T10:00:00Z", ticketType: "VIP Access", verified: true },
    { id: "u2", name: "Sam Chen", avatar: "SC", joinedAt: "2025-07-03T14:30:00Z", ticketType: "Community Pass", verified: true },
    { id: "u3", name: "Jordan Lee", avatar: "JL", joinedAt: "2025-07-05T09:15:00Z", ticketType: "Community Pass", verified: false },
    { id: "u4", name: "Taylor Kim", avatar: "TK", joinedAt: "2025-07-06T11:00:00Z", ticketType: "Online Ticket", verified: true },
    { id: "u5", name: "Riley Park", avatar: "RP", joinedAt: "2025-07-07T16:45:00Z", ticketType: "VIP Access", verified: true },
    { id: "u6", name: "Casey Wu", avatar: "CW", joinedAt: "2025-07-08T08:20:00Z", ticketType: "Community Pass", verified: false },
    { id: "u7", name: "Morgan Silva", avatar: "MS", joinedAt: "2025-07-09T13:10:00Z", ticketType: "Online Ticket", verified: true },
    { id: "u8", name: "Drew Patel", avatar: "DP", joinedAt: "2025-07-10T15:55:00Z", ticketType: "Community Pass", verified: true },
  ],
  organiser: {
    id: "org-001", name: "FreeTrust Foundation", avatar: "FF",
    bio: "The FreeTrust Foundation is a non-profit organisation dedicated to building open, community-driven trust infrastructure for the digital age.",
    email: "events@freetrust.io", phone: "+44 20 7946 0000", website: "https://freetrust.io",
    eventsHosted: 24, trustScore: 98, trustEarned: 360, verified: true, followers: 4821,
  },
  agenda: [
    { time: "09:00", title: "Registration & Welcome Coffee", speaker: "" },
    { time: "09:30", title: "Opening Keynote: The State of Trust", speaker: "FreeTrust Foundation" },
    { time: "10:30", title: "Building on the FreeTrust Protocol", speaker: "Alex Morgan, Core Dev" },
    { time: "11:30", title: "Workshop: Trust Scores in Practice", speaker: "Sam Chen" },
    { time: "12:30", title: "Lunch Break & Networking", speaker: "" },
    { time: "13:30", title: "Panel: Community-Driven Economies", speaker: "Multiple Speakers" },
    { time: "15:00", title: "Live Demo: FreeTrust v3 Features", speaker: "Product Team" },
    { time: "16:00", title: "Open Floor: Community Q&A", speaker: "All Speakers" },
    { time: "17:00", title: "Closing Remarks & Trust Token Distribution", speaker: "FreeTrust Foundation" },
    { time: "17:30", title: "VIP Networking Dinner (VIP only)", speaker: "" },
  ],
  faqs: [
    { q: "Will sessions be recorded?", a: "Yes, all keynotes and panels will be available for replay within 48 hours of the event." },
    { q: "How do I receive my Trust reward?", a: "Trust tokens (₮15) are automatically credited to your FreeTrust account upon verified attendance." },
    { q: "Is the venue accessible?", a: "Yes, the Barbican Centre is fully wheelchair accessible. Contact us for specific accessibility needs." },
    { q: "Can I transfer my ticket?", a: "Tickets can be transferred up to 24 hours before the event via your attendee dashboard." },
    { q: "What's included in the VIP ticket?", a: "Priority seating, all workshops, VIP networking dinner, digital goodie bag, and a signed copy of the FreeTrust whitepaper." },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const avatarColors = ["bg-indigo-500","bg-purple-500","bg-pink-500","bg-rose-500","bg-orange-500","bg-amber-500","bg-emerald-500","bg-teal-500","bg-cyan-500","bg-sky-500"];
const getColor = (s: string) => avatarColors[s.charCodeAt(0) % avatarColors.length];

function Avatar({ initials, size = "md", verified = false }: { initials: string; size?: "sm" | "md" | "lg" | "xl"; verified?: boolean }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg", xl: "w-20 h-20 text-2xl" };
  return (
    <div className="relative inline-flex flex-shrink-0">
      <div className={`${sizes[size]} ${getColor(initials)} rounded-full flex items-center justify-center font-bold text-white`}>
        {initials}
      </div>
      {verified && (
        <CheckCircleSolid className="absolute -bottom-0.5 -right-0.5 w-4 h-4 text-indigo-500 bg-white rounded-full" />
      )}
    </div>
  );
}

function Badge({ text, color = "gray" }: { text: string; color?: string }) {
  const colors: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700", indigo: "bg-indigo-100 text-indigo-700",
    purple: "bg-purple-100 text-purple-700", green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700", rose: "bg-rose-100 text-rose-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>{text}</span>;
}

function TrustBadge({ amount }: { amount: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm">
      <StarSolid className="w-3.5 h-3.5 text-yellow-300" />
      +₮{amount} Trust Reward
    </div>
  );
}

function formatPrice(p: number) { return p === 0 ? "Free" : `£${p}`; }

function getCapacityColor(remaining: number, capacity: number) {
  const pct = remaining / capacity;
  if (pct < 0.1) return "text-rose-600";
  if (pct < 0.25) return "text-amber-600";
  return "text-emerald-600";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ShareModal({ eventTitle, onClose }: { eventTitle: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "https://freetrust.io/events/evt-001";

  const copy = () => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const platforms = [
    { name: "Twitter / X", icon: "𝕏", href: `https://twitter.com/intent/tweet?text=Join me at ${encodeURIComponent(eventTitle)}&url=${encodeURIComponent(url)}`, color: "bg-black" },
    { name: "LinkedIn", icon: "in", href: `https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, color: "bg-blue-700" },
    { name: "WhatsApp", icon: "W", href: `https://wa.me/?text=${encodeURIComponent(eventTitle + " " + url)}`, color: "bg-green-500" },
    { name: "Email", icon: "✉", href: `mailto:?subject=${encodeURIComponent(eventTitle)}&body=${encodeURIComponent(url)}`, color: "bg-gray-600" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Share Event</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {platforms.map((p) => (
            <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer"
              className={`${p.color} text-white rounded-xl p-3.5 flex items-center gap-3 font-medium text-sm hover:opacity-90 transition-opacity`}>
              <span className="text-base font-bold w-5 text-center">{p.icon}</span>
              {p.name}
            </a>
          ))}
        </div>
        <div className="border border-gray-200 rounded-xl p-3 flex items-center gap-2">
          <input readOnly value={url} className="flex-1 text-sm text-gray-600 bg-transparent outline-none truncate" />
          <button onClick={copy} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${copied ? "bg-green-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
            {copied ? <><CheckCircleSolid className="w-4 h-4" /> Copied</> : <><LinkIcon className="w-4 h-4" /> Copy</>}
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 bg-indigo-50 rounded-xl p-3">
          <StarSolid className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <p className="text-xs text-indigo-700">Share earns your friends +₮5 Trust when they RSVP with your link.</p>
        </div>
      </div>
    </div>
  );
}

function RSVPModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const { rsvp, setRsvp } = useStore();
  const [step, setStep] = useState<"select" | "details" | "confirm" | "success">("select");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedTicket = event.tickets.find((t) => t.id === rsvp.ticketId) ?? event.tickets[0];

  const total = selectedTicket ? selectedTicket.price * rsvp.qty : 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    setStep("confirm");
  };

  const handleSubmit = () => {
    setStep("success");
    setRsvp({ status: "confirmed" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-200 text-sm">Registering for</p>
              <h3 className="font-bold text-lg leading-tight">{event.title}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          {/* Steps */}
          <div className="flex items-center gap-2 mt-4">
            {["select","details","confirm"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${step === s || (step === "success" && i < 3) ? "bg-white text-indigo-600 border-white" : ["select","details","confirm","success"].indexOf(step) > i ? "bg-indigo-400 border-indigo-400 text-white" : "bg-transparent border-white/40 text-white/60"}`}>
                  {["select","details","confirm","success"].indexOf(step) > i ? <CheckCircleSolid className="w-4 h-4" /> : i + 1}
                </div>
                {i < 2 && <div className={`h-0.5 w-8 rounded ${["select","details","confirm","success"].indexOf(step) > i ? "bg-white" : "bg-white/30"}`} />}
              </div>
            ))}
            <span className="text-white/80 text-xs ml-1 capitalize">{step === "success" ? "Done!" : step}</span>
          </div>
        </div>

        <div className="p-5">
          {/* Step 1: Ticket Selection */}
          {step === "select" && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 mb-3">Choose your ticket</h4>
              {event.tickets.map((t) => (
                <button key={t.id} onClick={() => setRsvp({ ticketId: t.id })}
                  className={`w-full text-left border-2 rounded-xl p-4 transition-all ${rsvp.ticketId === t.id || (!rsvp.ticketId && t.id === event.tickets[0].id) ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-300"}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{t.name}</span>
                        {t.price === 0 && <Badge text="Free" color="green" />}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>
                      <p className={`text-xs mt-1 font-medium ${getCapacityColor(t.remaining, t.capacity)}`}>
                        {t.remaining} spots left
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-3">
                      <span className="font-bold text-gray-900">{formatPrice(t.price)}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${rsvp.ticketId === t.id || (!rsvp.ticketId && t.id === event.tickets[0].id) ? "border-indigo-500 bg-indigo-500" : "border-gray-300"}`}>
                        {(rsvp.ticketId === t.id || (!rsvp.ticketId && t.id === event.tickets[0].id)) && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {selectedTicket && selectedTicket.price > 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <label className="text-sm text-gray-600 font-medium">Quantity:</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRsvp({ qty: Math.max(1, rsvp.qty - 1) })} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-700 font-bold hover:bg-gray-50 transition-colors">−</button>
                    <span className="w-8 text-center font-semibold">{rsvp.qty}</span>
                    <button onClick={() => setRsvp({ qty: Math.min(5, rsvp.qty + 1) })} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-700 font-bold hover:bg-gray-50 transition-colors">+</button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 bg-amber-50 rounded-xl p-3 mt-1">
                <StarSolid className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">Attending earns you +₮{event.trustReward} Trust</p>
              </div>
              <button onClick={() => { if (!rsvp.ticketId) setRsvp({ ticketId: event.tickets[0].id }); setStep("details"); }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors mt-2">
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: Details */}
          {step === "details" && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{selectedTicket?.name} × {rsvp.qty}</span>
                  <span className="font-bold text-gray-900">{total === 0 ? "Free" : `£${total}`}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className={`w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${errors.name ? "border-red-400" : "border-gray-200"}`} />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${errors.email ? "border-red-400" : "border-gray-200"}`} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={() => setStep("select")} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors">← Back</button>
                <button onClick={handleConfirm} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors">Review →</button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === "confirm" && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Review your booking</h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 space-y-2">
                  <Row label="Event" value={event.title} />
                  <Row label="Ticket" value={`${selectedTicket?.name} × ${rsvp.qty}`} />
                  <Row label="Attendee" value={name} />
                  <Row label="Email" value={email} />
                  <Row label="Date" value={format(new Date(event.startDate), "EEE, d MMM yyyy, HH:mm")} />
                  <Row label="Venue" value={event.mode === "online" ? "Online" : event.location} />
                </div>
                <div className="px-4 py-3 flex items-center justify-between bg-indigo-50">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-indigo-700 text-lg">{total === 0 ? "Free" : `£${total}`}</span>
                </div>
              </div>
              {total > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><CurrencyDollarIcon className="w-4 h-4" /> Payment</h5>
                  <input placeholder="Card number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="MM / YY" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input placeholder="CVC" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep("details")} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors">← Back</button>
                <button onClick={handleSubmit} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity">
                  {total === 0 ? "Confirm RSVP" : `Pay £${total}`}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === "success" && (
            <div className="text-center py-4 space-y-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircleSolid className="w-10 h-10 text-green-500" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-gray-900">You&apos;re registered!</h4>
                <p className="text-gray-500 text-sm mt-1">A confirmation has been sent to <strong>{email}</strong></p>
              </div>
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center justify-center gap-2">
                  <StarSolid className="w-5 h-5 text-indigo-500" />
                  <span className="font-semibold text-indigo-700">+₮{event.trustReward} Trust will be credited on attendance</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                  <ArrowDownTrayIcon className="w-4 h-4" /> Download Ticket
                </button>
                <button className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                  <QrCodeIcon className="w-4 h-4" /> View QR
                </button>
              </div>
              <button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value}</span>
    </div>
  );
}

function CalendarWidget({ startDate }: { startDate: string }) {
  const date = new Date(startDate);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const eventDay = date.getMonth() === month && date.getFullYear() === year ? date.getDate() : null;

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900 text-sm">{format(today, "MMMM yyyy")}</h4>
        <CalendarIcon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {blanks.map((b) => <div key={b} />)}
        {days.map((d) => (
          <button key={d} className={`aspect-square text-xs rounded-lg flex items-center justify-center font-medium transition-all
            ${d === today.getDate() ? "bg-gray-100 text-gray-900 ring-1 ring-gray-200" : "text-gray-600"}
            ${eventDay === d ? "bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-1 !text-white font-bold" : "hover:bg-gray-50"}`}>
            {d}
          </button>
        ))}
      </div>
      {eventDay && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <p className="text-xs text-gray-600">Event on {format(date, "d MMM")}</p>
        </div>
      )}
    </div>
  );
}

function CapacityBar({ remaining, capacity }: { remaining: number; capacity: number }) {
  const pct = Math.max(0, Math.min(100, ((capacity - remaining) / capacity) * 100));
  const color = pct > 90 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-indigo-500";
  return (
    <div className="space-y-1">
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500">{capacity - remaining} registered of {capacity}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { rsvp, setRsvp, shareOpen, setShareOpen, menuOpen, setMenuOpen, notifyEnabled, setNotify, activeTab, setTab } = useStore();

  const [event] = useState<Event>(MOCK_EVENT);
  const [showRSVP, setShowRSVP] = useState(false);
  const [expandDesc, setExpandDesc] = useState(false);

  const eventId = params?.id as string;
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const eventPast = isPast(endDate);
  const eventToday = isToday(startDate);

  const tabs = [
    { id: "details", label: "Details" },
    { id: "tickets", label: "Tickets" },
    { id: "attendees", label: `Attendees (${event.attendees.length})` },
    { id: "agenda", label: "Agenda" },
    { id: "organiser", label: "Organiser" },
    { id: "faq", label: "FAQ" },
  ];

  const handleRSVP = () => {
    setRsvp({ status: "selecting", ticketId: event.tickets[0].id, qty: 1 });
    setShowRSVP(true);
  };

  const modeIcon = event.mode === "online" ? <GlobeAltIcon className="w-4 h-4" /> : event.mode === "in-person" ? <BuildingOfficeIcon className="w-4 h-4" /> : <div className="flex gap-0.5"><GlobeAltIcon className="w-3.5 h-3.5" /><BuildingOfficeIcon className="w-3.5 h-3.5" /></div>;
  const modeLabel = event.mode === "online" ? "Online" : event.mode === "in-person" ? "In Person" : "Hybrid";
  const modeColor = event.mode === "online" ? "blue" : event.mode === "in-person" ? "purple" : "indigo";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Share Modal */}
      {shareOpen && <ShareModal eventTitle={event.title} onClose={() => setShareOpen(false)} />}
      {/* RSVP Modal */}
      {showRSVP && rsvp.status !== "confirmed" && <RSVPModal event={event} onClose={() => { setShowRSVP(false); }} />}

      {/* Top Nav */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
            <ChevronLeftIcon className="w-4 h-4" /> Events
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setNotify(!notifyEnabled)}
              className={`p-2 rounded-xl transition-colors ${notifyEnabled ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              title={notifyEnabled ? "Notifications on" : "Get notified"}>
              {notifyEnabled ? <BellIcon className="w-5 h-5" /> : <BellSlashIcon className="w-5 h-5" />}
            </button>
            <button onClick={() => setShareOpen(true)} className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors" title="Share">
              <ShareIcon className="w-5 h-5" />
            </button>
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                <EllipsisVerticalIcon className="w-5 h-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-44 z-50" onMouseLeave={() => setMenuOpen(false)}>
                  {[
                    { icon: <PencilSquareIcon className="w-4 h-4" />, label: "Edit Event", color: "text-gray-700" },
                    { icon: <ArrowDownTrayIcon className="w-4 h-4" />, label: "Export Attendees", color: "text-gray-700" },
                    { icon: <CalendarIcon className="w-4 h-4" />, label: "Add to Calendar", color: "text-gray-700" },
                    { icon: <ExclamationTriangleIcon className="w-4 h-4" />, label: "Report Event", color: "text-amber-600" },
                    { icon: <TrashIcon className="w-4 h-4" />, label: "Cancel Event", color: "text-rose-600" },
                  ].map((item) => (
                    <button key={item.label} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium ${item.color} hover:bg-gray-50 transition-colors`}>
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cover */}
      <div className="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 h-64 sm:h-80 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        {event.isFeatured && (
          <div className="absolute top-4 left-4">
            <div className="flex items-center gap-1.5 bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
              <StarSolid className="w-3.5 h-3.5" /> Featured Event
            </div>
          </div>
        )}
        <div className="absolute inset-0 flex items-end">
          <div className="w-full px-4 sm:px-8 pb-6 bg-gradient-to-t from-black/60 to-transparent pt-16">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge text={event.category} color="indigo" />
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm`}>
                  {modeIcon} {modeLabel}
                </div>
                {eventToday && <Badge text="Happening Today!" color="green" />}
                {eventPast && <Badge text="Past Event" color="gray" />}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{event.title}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Info Strip */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CalendarIcon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Date & Time</p>
                    <p className="text-sm font-semibold text-gray-900">{format(startDate, "EEE, d MMM yyyy")}</p>
                    <p className="text-xs text-gray-500">{format(startDate, "HH:mm")} – {format(endDate, "HH:mm")} {event.timezone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPinIcon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Location</p>
                    {event.mode !== "online" && <p className="text-sm font-semibold text-gray-900 leading-snug">{event.location.split(",")[0]}</p>}
                    {event.mode !== "in-person" && (
                      <a href={event.onlineUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 font-medium hover:underline">
                        Online Stream ↗
                      </a>
                    )}
                    {event.mode !== "online" && <p className="text-xs text-gray-500">{event.location.split(",").slice(1).join(",").trim()}</p>}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <UserGroupIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Capacity</p>
                    <p className="text-sm font-semibold text-gray-900">{event.maxCapacity} spots</p>
                    <p className={`text-xs font-medium ${getCapacityColor(event.tickets[0].remaining, event.tickets[0].capacity)}`}>
                      {event.tickets[0].remaining} remaining
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex overflow-x-auto border-b border-gray-200 scrollbar-hide">
                {tabs.map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex-shrink-0 px-4 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* Details Tab */}
                {activeTab === "details" && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">About this event</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{event.description}</p>
                      <div className={`overflow-hidden transition-all duration-300 ${expandDesc ? "max-h-[1000px]" : "max-h-0"}`}>
                        <div className="mt-3 space-y-3">
                          {event.longDescription.split("\n\n").map((p, i) => (
                            <p key={i} className="text-sm text-gray-600 leading-relaxed">{p}</p>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => setExpandDesc(!expandDesc)} className="mt-2 text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
                        {expandDesc ? "Show less ↑" : "Read more ↓"}
                      </button>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {event.tags.map((tag) => (
                          <span key={tag} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                      <div className="flex items-start gap-3">
                        <StarSolid className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-indigo-900">Earn Trust for attending</p>
                          <p className="text-xs text-indigo-700 mt-0.5">All verified attendees receive +₮{event.trustReward} Trust tokens automatically credited to their FreeTrust account after the event.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tickets Tab */}
                {activeTab === "tickets" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">Available Tickets</h3>
                      {!eventPast && <Badge text="On sale" color="green" />}
                    </div>
                    {event.tickets.map((t) => (
                      <div key={t.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-gray-900">{t.name}</h4>
                                {t.price === 0 && <Badge text="Free" color="green" />}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">{t.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-xl font-bold text-gray-900">{formatPrice(t.price)}</div>
                              <div className={`text-xs font-medium ${getCapacityColor(t.remaining, t.capacity)}`}>{t.remaining} left</div>
                            </div>
                          </div>
                          <div className="mt-3">
                            <CapacityBar remaining={t.remaining} capacity={t.capacity} />
                          </div>
                        </div>
                        <div className="px-4 pb-4">
                          <button onClick={handleRSVP} disabled={eventPast || t.remaining === 0}
                            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white">
                            {t.remaining === 0 ? "Sold Out" : t.price === 0 ? "Register Free" : `Get Ticket — £${t.price}`}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                      <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>Tickets can be transferred up to 24 hours before the event. All sales are final unless the event is cancelled.</span>
                    </div>
                  </div>
                )}

                {/* Attendees Tab */}
                {activeTab === "attendees" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-900">{event.attendees.length} Attendees</h3>
                      <div className="flex -space-x-2">
                        {event.attendees.slice(0, 5).map((a) => (
                          <div key={a.id} className={`w-7 h-7 ${getColor(a.avatar)} rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold`}>
                            {a.avatar[0]}
                          </div>
                        ))}
                        {event.attendees.length > 5 && (
                          <div className="w-7 h-7 bg-gray-200 rounded-full border-2 border-white flex items-center justify-center text-gray-600 text-xs font-bold">
                            +{event.attendees.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {event.attendees.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                          <Avatar initials={a.avatar} size="sm" verified={a.verified} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                              {a.verified && <CheckCircleSolid className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-gray-500">{a.ticketType}</p>
                          </div>
                          <p className="text-xs text-gray-400 flex-shrink-0">{formatDistanceToNow(new Date(a.joinedAt), { addSuffix: true })}</p>
                        </div>
                      ))}
                    </div>
                    <button className="w-full border border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors font-medium">
                      View all attendees →
                    </button>
                  </div>
                )}

                {/* Agenda Tab */}
                {activeTab === "agenda" && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-gray-900">Event Schedule</h3>
                    <div className="relative">
                      <div className="absolute left-16 top-0 bottom-0 w-px bg-gray-200" />
                      <div className="space-y-1">
                        {event.agenda.map((item, i) => (
                          <div key={i} className="flex items-start gap-4 py-2.5">
                            <div className="w-12 flex-shrink-0 text-right">
                              <span className="text-xs font-mono font-semibold text-gray-500">{item.time}</span>
                            </div>
                            <div className="relative z-10 w-8 flex justify-center flex-shrink-0">
                              <div className={`w-3 h-3 rounded-full border-2 mt-0.5 ${item.speaker ? "border-indigo-500 bg-indigo-500" : "border-gray-300 bg-white"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                              {item.speaker && <p className="text-xs text-gray-500 mt-0.5">{item.speaker}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Organiser Tab */}
                {activeTab === "organiser" && (
                  <div className="space-y-5">
                    <div className="flex items-start gap-4">
                      <Avatar initials={event.organiser.avatar} size="lg" verified={event.organiser.verified} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-gray-900">{event.organiser.name}</h3>
                          {event.organiser.verified && <Badge text="Verified Organiser" color="indigo" />}
                        </div>
                        <div className="flex flex-wrap gap-4 mt-2">
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-900">{event.organiser.eventsHosted}</div>
                            <div className="text-xs text-gray-500">Events</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-900">{event.organiser.followers.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">Followers</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-indigo-600">₮
