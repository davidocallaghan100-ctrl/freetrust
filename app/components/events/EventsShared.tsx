<<<FILE: app/components/events/EventsShared.tsx>>>
"use client";

import { useState, useEffect, useRef } from "react";
import { create } from "zustand";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO } from "date-fns";
import {
  CalendarIcon,
  MapPinIcon,
  GlobeAltIcon,
  UserGroupIcon,
  TicketIcon,
  ShareIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  CheckIcon,
  CurrencyDollarIcon,
  ClockIcon,
  PencilSquareIcon,
  TrashIcon,
  StarIcon,
  BellIcon,
  LinkIcon,
  EnvelopeIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketType = {
  id: string;
  name: string;
  price: number; // 0 = free
  quantity: number;
  sold: number;
  description: string;
};

type Attendee = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  ticketType: string;
  rsvpStatus: "confirmed" | "waitlist" | "cancelled";
  joinedAt: string;
};

type Organiser = {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  eventsHosted: number;
  trustScore: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
};

type Event = {
  id: string;
  title: string;
  description: string;
  category: string;
  coverImage: string;
  mode: "online" | "in-person" | "hybrid";
  location: string;
  meetingLink: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  tickets: TicketType[];
  attendees: Attendee[];
  organiser: Organiser;
  maxCapacity: number;
  tags: string[];
  status: "draft" | "published" | "cancelled" | "completed";
  trustReward: number;
  createdAt: string;
};

type View = "list" | "calendar" | "create" | "detail" | "organiser" | "manage";

type Store = {
  events: Event[];
  currentView: View;
  selectedEvent: Event | null;
  currentUser: { id: string; name: string; trustBalance: number };
  calendarDate: Date;
  addEvent: (e: Event) => void;
  updateEvent: (id: string, patch: Partial<Event>) => void;
  deleteEvent: (id: string) => void;
  setView: (v: View) => void;
  setSelectedEvent: (e: Event | null) => void;
  setCalendarDate: (d: Date) => void;
  rsvpEvent: (eventId: string, attendee: Attendee) => void;
  cancelRsvp: (eventId: string, attendeeId: string) => void;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ORGANISER: Organiser = {
  id: "org-1",
  name: "Sarah Chen",
  avatar: "https://i.pravatar.cc/150?img=47",
  bio: "Community builder & tech enthusiast. I host events focused on Web3, decentralised finance, and digital trust. Passionate about creating spaces where people can learn and connect.",
  eventsHosted: 24,
  trustScore: 4820,
  rating: 4.8,
  reviewCount: 156,
  verified: true,
};

const MOCK_ORGANISER_2: Organiser = {
  id: "org-2",
  name: "Marcus Webb",
  avatar: "https://i.pravatar.cc/150?img=12",
  bio: "Entrepreneur and open-source advocate. Running workshops on blockchain fundamentals and smart contract security.",
  eventsHosted: 11,
  trustScore: 2150,
  rating: 4.6,
  reviewCount: 78,
  verified: true,
};

const MOCK_EVENTS: Event[] = [
  {
    id: "evt-1",
    title: "Web3 Trust & Identity Summit",
    description: "Join us for a deep dive into decentralised identity systems, verifiable credentials, and the future of digital trust. Speakers from major Web3 projects will share insights on building trustworthy systems at scale.\n\nAgenda:\n• 10:00 – Opening keynote: The Trust Economy\n• 11:00 – Panel: Self-Sovereign Identity\n• 13:00 – Workshop: Building with DIDs\n• 15:00 – Networking & Demo Booths",
    category: "Technology",
    coverImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    mode: "hybrid",
    location: "Level 3, The Hub, 22 Innovation St, London EC2A 4NE",
    meetingLink: "https://meet.freetrust.io/web3-summit",
    startDate: "2025-02-15",
    endDate: "2025-02-15",
    startTime: "10:00",
    endTime: "17:00",
    timezone: "Europe/London",
    tickets: [
      { id: "t1", name: "General Admission", price: 0, quantity: 200, sold: 147, description: "Access to all talks and panels" },
      { id: "t2", name: "VIP Pass", price: 49, quantity: 50, sold: 31, description: "Front row seating, workshop access, networking dinner" },
      { id: "t3", name: "Online Stream", price: 0, quantity: 500, sold: 312, description: "Live stream access + recordings" },
    ],
    attendees: [
      { id: "a1", name: "Alex Kim", email: "alex@example.com", avatar: "https://i.pravatar.cc/150?img=3", ticketType: "General Admission", rsvpStatus: "confirmed", joinedAt: "2025-01-20" },
      { id: "a2", name: "Priya Patel", email: "priya@example.com", avatar: "https://i.pravatar.cc/150?img=25", ticketType: "VIP Pass", rsvpStatus: "confirmed", joinedAt: "2025-01-21" },
      { id: "a3", name: "James Liu", email: "james@example.com", avatar: "https://i.pravatar.cc/150?img=8", ticketType: "Online Stream", rsvpStatus: "confirmed", joinedAt: "2025-01-22" },
      { id: "a4", name: "Maria Santos", email: "maria@example.com", avatar: "https://i.pravatar.cc/150?img=32", ticketType: "General Admission", rsvpStatus: "confirmed", joinedAt: "2025-01-23" },
      { id: "a5", name: "Tom Bridges", email: "tom@example.com", avatar: "https://i.pravatar.cc/150?img=15", ticketType: "General Admission", rsvpStatus: "waitlist", joinedAt: "2025-01-28" },
    ],
    organiser: MOCK_ORGANISER,
    maxCapacity: 750,
    tags: ["Web3", "Identity", "DID", "Blockchain", "Networking"],
    status: "published",
    trustReward: 15,
    createdAt: "2025-01-10",
  },
  {
    id: "evt-2",
    title: "Smart Contract Security Workshop",
    description: "Hands-on workshop covering common smart contract vulnerabilities, audit techniques, and best practices for writing secure Solidity code. Suitable for intermediate developers.",
    category: "Workshop",
    coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
    mode: "online",
    location: "",
    meetingLink: "https://zoom.us/j/987654321",
    startDate: "2025-02-22",
    endDate: "2025-02-22",
    startTime: "14:00",
    endTime: "17:00",
    timezone: "UTC",
    tickets: [
      { id: "t1", name: "Workshop Seat", price: 25, quantity: 30, sold: 22, description: "Interactive session with exercises" },
      { id: "t2", name: "Audit Only", price: 0, quantity: 100, sold: 67, description: "Watch-only access to the session" },
    ],
    attendees: [
      { id: "a1", name: "Dev User", email: "dev@example.com", avatar: "https://i.pravatar.cc/150?img=5", ticketType: "Workshop Seat", rsvpStatus: "confirmed", joinedAt: "2025-01-25" },
    ],
    organiser: MOCK_ORGANISER_2,
    maxCapacity: 130,
    tags: ["Solidity", "Security", "Smart Contracts", "Ethereum"],
    status: "published",
    trustReward: 15,
    createdAt: "2025-01-12",
  },
  {
    id: "evt-3",
    title: "DeFi Founders Meetup – London",
    description: "Monthly informal meetup for DeFi founders, builders, and investors in London. Share what you're building, get feedback, and make connections.",
    category: "Networking",
    coverImage: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80",
    mode: "in-person",
    location: "The Fintech Hub, 1 Canada Square, Canary Wharf, London E14 5AB",
    meetingLink: "",
    startDate: "2025-03-05",
    endDate: "2025-03-05",
    startTime: "18:30",
    endTime: "21:00",
    timezone: "Europe/London",
    tickets: [
      { id: "t1", name: "General", price: 0, quantity: 80, sold: 54, description: "Free entry, drinks not included" },
    ],
    attendees: [],
    organiser: MOCK_ORGANISER,
    maxCapacity: 80,
    tags: ["DeFi", "Networking", "Founders", "London"],
    status: "published",
    trustReward: 15,
    createdAt: "2025-01-15",
  },
  {
    id: "evt-4",
    title: "NFT Art & Culture Evening",
    description: "A celebration of digital art and culture in the NFT space. Features live minting demonstrations, artist talks, and an auction of curated digital works.",
    category: "Arts",
    coverImage: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&q=80",
    mode: "in-person",
    location: "Tate Modern, Bankside, London SE1 9TG",
    meetingLink: "",
    startDate: "2025-02-28",
    endDate: "2025-02-28",
    startTime: "19:00",
    endTime: "22:00",
    timezone: "Europe/London",
    tickets: [
      { id: "t1", name: "Standard Entry", price: 15, quantity: 150, sold: 89, description: "Entry + welcome drink" },
      { id: "t2", name: "Collector's Pass", price: 75, quantity: 20, sold: 14, description: "Priority bidding + artist meet & greet" },
    ],
    attendees: [],
    organiser: MOCK_ORGANISER_2,
    maxCapacity: 170,
    tags: ["NFT", "Art", "Culture", "Digital Art"],
    status: "published",
    trustReward: 15,
    createdAt: "2025-01-18",
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

const useStore = create<Store>((set) => ({
  events: MOCK_EVENTS,
  currentView: "list",
  selectedEvent: null,
  currentUser: { id: "user-current", name: "You", trustBalance: 1240 },
  calendarDate: new Date(),
  addEvent: (e) => set((s) => ({ events: [...s.events, e] })),
  updateEvent: (id, patch) =>
    set((s) => ({ events: s.events.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev)) })),
  deleteEvent: (id) => set((s) => ({ events: s.events.filter((ev) => ev.id !== id) })),
  setView: (v) => set({ currentView: v }),
  setSelectedEvent: (e) => set({ selectedEvent: e }),
  setCalendarDate: (d) => set({ calendarDate: d }),
  rsvpEvent: (eventId, attendee) =>
    set((s) => ({
      events: s.events.map((ev) =>
        ev.id === eventId ? { ...ev, attendees: [...ev.attendees, attendee] } : ev
      ),
    })),
  cancelRsvp: (eventId, attendeeId) =>
    set((s) => ({
      events: s.events.map((ev) =>
        ev.id === eventId
          ? { ...ev, attendees: ev.attendees.filter((a) => a.id !== attendeeId) }
          : ev
      ),
    })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES = ["Technology", "Workshop", "Networking", "Arts", "Business", "Education", "Health", "Sports", "Music", "Other"];
const TIMEZONES = ["UTC", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];

function totalSold(e: Event) {
  return e.tickets.reduce((s, t) => s + t.sold, 0);
}

function totalCapacity(e: Event) {
  return e.tickets.reduce((s, t) => s + t.quantity, 0);
}

function spotsLeft(e: Event) {
  return totalCapacity(e) - totalSold(e);
}

function lowestPrice(e: Event) {
  const prices = e.tickets.map((t) => t.price);
  const min = Math.min(...prices);
  return min === 0 ? "Free" : `From £${min}`;
}

function modeColor(mode: Event["mode"]) {
  return mode === "online" ? "bg-blue-100 text-blue-700" : mode === "in-person" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700";
}

function modeLabel(mode: Event["mode"]) {
  return mode === "online" ? "Online" : mode === "in-person" ? "In Person" : "Hybrid";
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function TrustBadge({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-200">
      ₮{amount}
    </span>
  );
}

function AvatarStack({ attendees, max = 4 }: { attendees: Attendee[]; max?: number }) {
  const shown = attendees.slice(0, max);
  const extra = attendees.length - max;
  return (
    <div className="flex -space-x-2">
      {shown.map((a) => (
        <img key={a.id} src={a.avatar} alt={a.name} className="w-7 h-7 rounded-full border-2 border-white object-cover" />
      ))}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
          +{extra}
        </div>
      )}
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

function ShareModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = `https://freetrust.io/events/${event.id}`;

  function copy() {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Share Event</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{event.title}</p>
        <div className="flex gap-2 mb-5">
          <input readOnly value={url} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700" />
          <button onClick={copy} className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">
            {copied ? <CheckIcon className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Twitter/X", bg: "bg-black text-white", icon: "𝕏" },
            { label: "Email", bg: "bg-gray-100 text-gray-800", icon: "✉" },
            { label: "WhatsApp", bg: "bg-green-500 text-white", icon: "💬" },
          ].map((s) => (
            <button key={s.label} className={`${s.bg} rounded-xl py-3 text-sm font-semibold flex flex-col items-center gap-1 hover:opacity-90 transition`}>
              <span className="text-lg">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RSVP Modal ───────────────────────────────────────────────────────────────

function RsvpModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const { rsvpEvent, currentUser } = useStore();
  const [selected, setSelected] = useState<TicketType | null>(event.tickets[0] ?? null);
  const [step, setStep] = useState<"pick" | "details" | "confirm">("pick");
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState("you@example.com");
  const [done, setDone] = useState(false);

  function submit() {
    if (!selected) return;
    const attendee: Attendee = {
      id: "a-" + uid(),
      name,
      email,
      avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
      ticketType: selected.name,
      rsvpStatus: spotsLeft(event) > 0 ? "confirmed" : "waitlist",
      joinedAt: format(new Date(), "yyyy-MM-dd"),
    };
    rsvpEvent(event.id, attendee);
    setDone(true);
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckIcon className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">You're registered!</h3>
          <p className="text-gray-500 text-sm mb-6">A confirmation has been sent to {email}. See you there!</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-center justify-between">
            <span className="text-sm text-amber-800">Trust earned for attending</span>
            <TrustBadge amount={5} />
          </div>
          <button onClick={onClose} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Register for Event</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        {step === "pick" && (
          <div className="p-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">Choose a ticket type</p>
            <div className="space-y-3">
              {event.tickets.map((t) => {
                const avail = t.quantity - t.sold;
                const isOut = avail <= 0;
                return (
                  <button
                    key={t.id}
                    disabled={isOut}
                    onClick={() => setSelected(t)}
                    className={`w-full text-left border-2 rounded-xl p-4 transition ${selected?.id === t.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"} ${isOut ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-indigo-700">{t.price === 0 ? "Free" : `£${t.price}`}</p>
                        <p className="text-xs text-gray-400">{isOut ? "Sold out" : `${avail} left`}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button disabled={!selected} onClick={() => setStep("details")} className="mt-5 w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 transition">
              Continue
            </button>
          </div>
        )}

        {step === "details" && (
          <div className="p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Your details</p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email Address</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            {selected && selected.price > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{selected.name}</span>
                  <span className="font-semibold">£{selected.price}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Booking fee</span>
                  <span>£0.00</span>
                </div>
                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold text-gray-900 text-sm">
                  <span>Total</span>
                  <span>£{selected.price}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep("pick")} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition text-sm">Back</button>
              <button onClick={() => setStep("confirm")} disabled={!name || !email} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 transition text-sm">
                {selected?.price ? "Proceed to Payment" : "Confirm"}
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="p-6">
            <div className="bg-indigo-50 rounded-xl p-4 mb-5">
              <p className="text-xs text-indigo-500 font-semibold mb-2">Order Summary</p>
              <p className="font-bold text-gray-900">{event.title}</p>
              <p className="text-sm text-gray-600 mt-1">{format(parseISO(event.startDate), "EEE, d MMM yyyy")} · {event.startTime}</p>
              <p className="text-sm text-gray-600">{selected?.name} · {selected?.price === 0 ? "Free" : `£${selected?.price}`}</p>
            </div>
            <p className="text-xs text-gray-400 text-center mb-4">By registering you agree to the event's terms and FreeTrust's policies.</p>
            <div className="flex gap-3">
              <button onClick={() => setStep("details")} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition text-sm">Back</button>
              <button onClick={submit} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition text-sm">
                {selected?.price ? `Pay £${selected.price}` : "Confirm RSVP"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: Event }) {
  const { setSelectedEvent, setView } = useStore();
  const [sharing, setSharing] = useState(false);

  function open() {
    setSelectedEvent(event);
    setView("detail");
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition group">
      <div className="relative h-44 overflow-hidden cursor-pointer" onClick={open}>
        <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge label={modeLabel(event.mode)} cls={modeColor(event.mode)} />
          <Badge label={event.category} cls="bg-white/90 text-gray-700" />
        </div>
        <div className="absolute top-3 right-3">
          <TrustBadge amount={event.trustReward} />
        </div>
      </div>
      <div className="p-4">
        <button onClick={open} className="text-left w-full">
          <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-indigo-700 transition">{event.title}</h3>
        </button>
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
            {format(parseISO(event.startDate), "EEE, d MMM yyyy")} · {event.startTime}
          </div>
          {event.mode !== "online" && event.location && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          )}
          {event.mode === "online" && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <GlobeAltIcon className="w-3.5 h-3.5 shrink-0" />
              Online Event
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <AvatarStack attendees={event.attendees} />
            <span className="text-xs text-gray-500">{totalSold(event)} going</span>
          </div>
          <span className="text-xs font-bold text-indigo-700">{lowestPrice(event)}</span>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={open} className="flex-1 bg-indigo-600 text-white text-xs font-semibold py-2 rounded-xl hover:bg-indigo-700 transition">
            View Event
          </button>
          <button onClick={() => setSharing(true)} className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            <ShareIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      {sharing && <ShareModal event={event} onClose={() => setSharing(false)} />}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView() {
  const { events, setView } = useStore();
  const [filter, setFilter] = useState<"all" | "online" | "in-person" | "hybrid">("all");
  const [catFilter, setCatFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = events.filter((e) => {
    if (e.status !== "published") return false;
    if (filter !== "all" && e.mode !== filter) return false;
    if (catFilter !== "All" && e.category !== catFilter) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Events</h1>
              <p className="text-sm text-gray-500">{filtered.length} events found</p>
            </div>
            <button onClick={() => setView("create")} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition shadow-sm">
              <PlusIcon className="w-4 h-4" />
              Create Event
            </button>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events…" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-52" />
            <div className="flex gap-1">
              {(["all", "online", "in-person", "hybrid"] as const).map((m) => (
                <button key={m} onClick={() => setFilter(m)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${filter === m ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {m === "all" ? "All" : modeLabel(m)}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {["All", ...CATEGORIES.slice(0, 5)].map((c) => (
                <button key={c} onClick={() => setCatFilter(c)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${catFilter === c ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {c}
                </button>
              ))}
            </div>
            <button onClick={() => setView("calendar")} className="ml-auto flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-700 transition">
              <CalendarIcon className="w-4 h-4" />
              Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-semibold">No events found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView() {
  const { events, calendarDate, setCalendarDate, setView, setSelectedEvent } = useStore();
  const days = eachDayOfInterval({ start: startOfMonth(calendarDate), end: endOfMonth(calendarDate) });
  const startPad = startOfMonth(calendarDate).getDay(); // 0=Sun

  function eventsOnDay(d: Date) {
    return events.filter((e) => e.status === "published" && isSameDay(parseISO(e.startDate), d));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setView("list")} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">← List View</button>
            <h2 className="text-xl font-black text-gray-900">{format(calendarDate, "MMMM yyyy")}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))} className="p-2 border border-gray-200 rounded-xl hover:bg-gray-100 transition">
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setCalendarDate(new Date())} className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-100 transition font-medium">Today</button>
            <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} className="p-2 border border-gray-200 rounded-xl hover:bg-gray-100 transition">
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={"pad-" + i} className="min-h-[90px] border-r border-b border-gray-50" />
            ))}
            {days.map((day) => {
              const dayEvents = eventsOnDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={`min-h-[90px] border-r border-b border-gray-50 p-1.5 ${!isSameMonth(day, calendarDate) ? "opacity-30" : ""}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${isToday ? "bg-indigo-600 text-white" : "text-gray-700"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => { setSelectedEvent(ev); setView("detail"); }}
                        className="w-full text-left text-xs bg-indigo-100 text-indigo-800 rounded px-1 py-0.5 truncate hover:bg-indigo-200 transition font-medium"
                      >
                        {ev.startTime} {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-xs text-gray-400 pl-1">+{dayEvents.length - 2} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming list */}
        <div className="mt-6">
          <h3 className="font-bold text-gray-700 mb-3">This Month</h3>
          <div className="space-y-2">
            {events
              .filter((e) => e.status === "published" && isSameMonth(parseISO(e.startDate), calendarDate))
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map((ev) => (
                <button key={ev.id} onClick={() => { setSelectedEvent(ev); setView("detail"); }}
                  className="w-full bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-4 hover:shadow-sm transition text-left">
                  <div className="w-12 text-center shrink-0">
                    <p className="text-xs text-gray-400">{format(parseISO(ev.startDate), "MMM")}</p>
                    <p className="text-xl font-black text-indigo-700 leading-none">{format(parseISO(ev.startDate), "d")}</p>
                  </div>
                  <img src={ev.coverImage} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{ev.title}</p>
                    <p className="text-xs text-gray-500">{ev.startTime} · {modeLabel(ev.mode)}</p>
                  </div>
                  <Badge label={lowestPrice(ev)} cls="bg-indigo-50 text-indigo-700 shrink-0" />
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Event Detail ─────────────────────────────────────────────────────────────

function EventDetail() {
  const { selectedEvent, setView, setSelectedEvent } = useStore();
  const [sharing, setSharing] = useState(false);
  const [rsvping, setRsvping] = useState(false);

  if (!selectedEvent) return null;
  const ev = selectedEvent;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative h-72 overflow-hidden">
        <img src={ev.coverImage} alt={ev.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <button onClick={() => { setSelectedEvent(null); setView("list"); }} className="absolute top-4 left-4 bg-white/90 text-gray-800 px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-white transition">
          ← Back
        </button>
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div>
            <div className="flex gap-2 mb-2">
              <Badge label={modeLabel(ev.mode)} cls={modeColor(ev.mode)} />
              <Badge label={ev.category} cls="bg-white/90 text-gray-700" />
            </div>
            <h1 className="text-2xl font-black text-white leading-tight">{ev.title}</h1>
          </div>
          <button onClick={() => setSharing(true)} className="p-2.5 bg-white/90 rounded-xl hover:bg-white transition">
            <ShareIcon className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Info cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarIcon className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date & Time</span>
              </div>
              <p className="font-bold text-gray-900 text-sm">{format(parseISO(ev.startDate), "EEE, d MMM yyyy")}</p>
              <p className="text-sm text-gray-600">{ev.startTime} – {ev.endTime} {ev.timezone}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-1">
                {ev.mode === "online" ? <GlobeAltIcon className="w-4 h-4 text-blue-500" /> : <MapPinIcon className="w-4 h-4 text-green-500" />}
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</span>
              </div>
              {ev.mode !== "online" && ev.location ? (
                <p className="font-bold text-gray-900 text-sm line-clamp-2">{ev.location}</p>
              ) : (
                <p className="font-bold text-gray-900 text-sm">Online Event</p>
              )}
              {ev.mode !== "in-person" && ev.meetingLink && (
                <a href={ev.meetingLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Join Link</a>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-900 mb-3">About this event</h2>
            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{ev.description}</div>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {ev.tags.map((t) => (
                <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{t}</span>
              ))}
            </div>
          </div>

          {/* Attendees */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Attendees ({totalSold(ev)})</h2>
              <span className="text-xs text-gray-400">{spotsLeft(ev)} spots left</span>
            </div>
            <div className="flex -space-x-2 flex-wrap">
              {ev.attendees.slice(0, 12).map((a) => (
                <div key={a.id} className="relative group/att">
                  <img src={a.avatar} alt={a.name} className="w-9 h-9 rounded-full border-2 border-white object-cover" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover/att:opacity-100 transition pointer-events-none z-10">
                    {a.name}
                  </div>
                </div>
              ))}
              {ev.attendees.length > 12 && (
                <div className="w-9 h-9 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                  +{ev.attendees.length - 12}
                </div>
              )}
            </div>
          </div>

          {/* Organiser */}
          <OrganiserCard organiser={ev.organiser} compact />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Trust reward */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700">Trust Reward</p>
              <p className="text-xs text-amber-600">Earned for hosting</p>
            </div>
            <TrustBadge amount={ev.trustReward} />
          </div>

          {/* Tickets */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3">Tickets</h3>
            <div className="space-y-2 mb-4">
              {ev.tickets.map((t) => {
                const avail = t.quantity - t.sold;
                const pct = Math.round((t.sold / t.quantity) * 100);
                return (
                  <div key={t.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <p className="text-sm font-bold text-indigo-700">{t.price === 0 ? "Free" : `£${t.price}`}</p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400">{avail > 0 ? `${avail} remaining` : "Sold out"}</p>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setRsvping(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-sm">
              Register Now
            </button>
            <button onClick={() => setSharing(true)} className="w-full mt-2 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition">
              <ShareIcon className="w-4 h-4" />
              Share Event
            </button>
          </div>

          {/* Capacity */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserGroupIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">Capacity</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (totalSold(ev) / ev.maxCapacity) * 100)}%` }} />
            </div>
            <p className="text-xs text-gray-500">{totalSold(ev)} / {ev.maxCapacity} registered</p>
          </div>
        </div>
      </div>

      {sharing && <ShareModal event={ev} onClose={() => setSharing(false)} />}
      {rsvping && <RsvpModal event={ev} onClose={() => setRsvping(false)} />}
    </div>
  );
}

// ─── Organiser Card ───────────────────────────────────────────────────────────

function OrganiserCard({ organiser, compact = false }: { organiser: Organiser; compact?: boolean }) {
  const { setView } = useStore();
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Organiser</p>
      <div className="flex items-start gap-3">
        <img src={organiser.avatar} alt={organiser.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-gray-900">{organiser.name}</p>
            {organiser.verified && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">✓ Verified</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                i < Math.floor(organiser.rating) ? (
                  <StarSolid key={i} className="w-3 h-3 text-amber-400" />
                ) : (
                  <StarIcon key={i} className="w-3 h-3 text-gray-300" />
                )
              ))}
              <span className="text-xs text-gray-500 ml-1">{organiser.rating} ({organiser.reviewCount})</span>
            </div>
          </div>
          <div className="flex gap-3 mt-1 text-xs text-gray-500">
            <span>{organiser.eventsHosted} events</span>
            <span>₮{organiser.trustScore.toLocaleString()} trust</span>
          </div>
          {!compact && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{organiser.bio}</p>}
        </div>
      </div>
      {compact && (
        <button onClick={() => setView("organiser")} className="mt-3 w-full text-sm text-indigo-600 font-medium text-center hover:text-indigo-700 transition">
          View Organiser Profile →
        </button>
      )}
    </div>
  );
}

// ─── Organiser Profile ────────────────────────────────────────────────────────

function OrganiserProfile() {
  const { events, setView, setSelectedEvent, selectedEvent } = useStore();
  const organiser = selectedEvent?.organiser ?? MOCK_ORGANISER;
  const orgEvents = events.filter((e) => e.organiser.id === organiser.id && e.status === "published");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button onClick={() => setView("detail")} className="text-sm text-indigo-600 font-medium mb-5 hover:text-indigo-700">← Back to Event</button>

        {/* Profile header */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
          <div className="flex items-start gap-5">
            <img src={organiser.avatar} alt={organiser.name} className="w-20 h-20 rounded-full object-cover border-4 border-indigo-100 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-black text-gray-900">{organiser.name}</h1>
                {organiser.verified && (
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">✓ Verified Organiser</span>
                )}
              </div>
              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  i < Math.floor(organiser.rating) ? (
                    <StarSolid key={i} className="w-4 h-4 text-amber-400" />
                  ) : (
                    <StarIcon key={i} className="w-4 h-4 text-gray-300" />
                  )
                ))}
                <span className="text-sm text-gray-500 ml-1">{organiser.rating} · {organiser.reviewCount} reviews</span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{organiser.bio}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-black text-indigo-700">{organiser.eventsHosted}</p>
              <p className="text-xs text-gray-500">Events Hosted</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-amber-600">₮{organiser.trustScore.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Trust Score</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-green-600">{organiser.rating}</p>
              <p className="text-xs text-gray-500">Avg. Rating</p>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition">
              <BellIcon className="w-4 h-4" /> Follow
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition">
              <EnvelopeIcon className="w-4 h-4" /> Contact
            </button>
          </div>
        </div>

        {/* Trust earned breakdown */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5">
          <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
            <span className="text-lg">₮</span> Trust Earned from Events
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 border border-amber-100">
              <p className="text-xs text-gray-500">Per event hosted</p>
              <p className="text-
