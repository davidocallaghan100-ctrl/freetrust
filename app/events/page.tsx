<<<FILE: app/events/page.tsx>>>
"use client";

import { useState, useMemo, useCallback } from "react";
import {
  CalendarDaysIcon,
  ListBulletIcon,
  PlusCircleIcon,
  MapPinIcon,
  ComputerDesktopIcon,
  TicketIcon,
  UserGroupIcon,
  ShareIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  ClockIcon,
  StarIcon,
  BoltIcon,
  UserCircleIcon,
  GlobeAltIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  parseISO,
  isPast,
  isToday,
} from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventMode = "online" | "inperson";
type TicketType = { id: string; name: string; price: number; capacity: number; sold: number };
type RSVP = { userId: string; name: string; avatar: string; ticketType: string; date: string; paid: boolean };
type Organiser = { id: string; name: string; avatar: string; bio: string; trustScore: number; eventsHosted: number; followers: number };
type Event = {
  id: string;
  title: string;
  description: string;
  category: string;
  mode: EventMode;
  location: string;
  meetingLink: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  coverImage: string;
  tickets: TicketType[];
  rsvps: RSVP[];
  organiser: Organiser;
  tags: string[];
  trustReward: number;
  published: boolean;
};

type View = "list" | "calendar" | "detail" | "create" | "organiser";
type Tab = "upcoming" | "past" | "mine";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ORGANISERS: Organiser[] = [
  { id: "u1", name: "Alex Rivera", avatar: "AR", bio: "Community builder & tech enthusiast. Hosting events since 2019.", trustScore: 4820, eventsHosted: 34, followers: 218 },
  { id: "u2", name: "Priya Sharma", avatar: "PS", bio: "Educator, speaker, and lifelong learner passionate about knowledge sharing.", trustScore: 3670, eventsHosted: 22, followers: 145 },
  { id: "u3", name: "Jordan Lee", avatar: "JL", bio: "Creative director and design thinking facilitator.", trustScore: 2910, eventsHosted: 18, followers: 97 },
];

const MOCK_EVENTS: Event[] = [
  {
    id: "e1",
    title: "Web3 & Trust: Building Decentralised Communities",
    description: "Join us for a deep-dive into how blockchain and trust-based systems are reshaping online communities. We'll cover governance models, tokenomics, and real-world case studies from FreeTrust and beyond.\n\nThis is a hands-on workshop — come ready to discuss and build!",
    category: "Technology",
    mode: "online",
    location: "",
    meetingLink: "https://meet.freetrust.io/web3-trust",
    startDate: "2025-07-18",
    endDate: "2025-07-18",
    startTime: "14:00",
    endTime: "16:00",
    coverImage: "🌐",
    tickets: [
      { id: "t1", name: "Free Entry", price: 0, capacity: 200, sold: 134 },
      { id: "t2", name: "VIP Access", price: 15, capacity: 20, sold: 11 },
    ],
    rsvps: [
      { userId: "r1", name: "Sam Okafor", avatar: "SO", ticketType: "Free Entry", date: "2025-07-10", paid: false },
      { userId: "r2", name: "Mia Chen", avatar: "MC", ticketType: "VIP Access", date: "2025-07-11", paid: true },
      { userId: "r3", name: "Luca Rossi", avatar: "LR", ticketType: "Free Entry", date: "2025-07-12", paid: false },
      { userId: "r4", name: "Amara Diallo", avatar: "AD", ticketType: "Free Entry", date: "2025-07-13", paid: false },
    ],
    organiser: MOCK_ORGANISERS[0],
    tags: ["web3", "blockchain", "community", "governance"],
    trustReward: 15,
    published: true,
  },
  {
    id: "e2",
    title: "Mindful Leadership Workshop",
    description: "A practical, immersive workshop on leading with empathy and intention. Perfect for team leads, managers, and anyone stepping into a leadership role.\n\nLight refreshments provided. Limited seats — book early!",
    category: "Workshops",
    mode: "inperson",
    location: "The Hub, 42 Innovation Street, London EC1A 1BB",
    meetingLink: "",
    startDate: "2025-07-24",
    endDate: "2025-07-24",
    startTime: "10:00",
    endTime: "13:00",
    coverImage: "🧘",
    tickets: [
      { id: "t3", name: "Standard", price: 25, capacity: 30, sold: 22 },
      { id: "t4", name: "Concession", price: 12, capacity: 10, sold: 7 },
    ],
    rsvps: [
      { userId: "r5", name: "Tom Walsh", avatar: "TW", ticketType: "Standard", date: "2025-07-08", paid: true },
      { userId: "r6", name: "Nina Petrov", avatar: "NP", ticketType: "Concession", date: "2025-07-09", paid: true },
      { userId: "r7", name: "Carlos Mendes", avatar: "CM", ticketType: "Standard", date: "2025-07-10", paid: true },
    ],
    organiser: MOCK_ORGANISERS[1],
    tags: ["leadership", "mindfulness", "professional"],
    trustReward: 15,
    published: true,
  },
  {
    id: "e3",
    title: "Design Systems: From Zero to Scale",
    description: "How do world-class teams build and maintain design systems that actually scale? In this talk we'll walk through the journey from ad-hoc components to a full-fledged system used by hundreds of designers and engineers.",
    category: "Design",
    mode: "online",
    location: "",
    meetingLink: "https://meet.freetrust.io/design-systems",
    startDate: "2025-08-05",
    endDate: "2025-08-05",
    startTime: "18:00",
    endTime: "19:30",
    coverImage: "🎨",
    tickets: [
      { id: "t5", name: "General Admission", price: 0, capacity: 500, sold: 289 },
    ],
    rsvps: [
      { userId: "r8", name: "Zoe Kim", avatar: "ZK", ticketType: "General Admission", date: "2025-07-15", paid: false },
      { userId: "r9", name: "Ben Foster", avatar: "BF", ticketType: "General Admission", date: "2025-07-16", paid: false },
    ],
    organiser: MOCK_ORGANISERS[2],
    tags: ["design", "ui", "systems", "figma"],
    trustReward: 15,
    published: true,
  },
  {
    id: "e4",
    title: "FreeTrust Community Meetup — July Edition",
    description: "Monthly in-person meetup for FreeTrust members. Share updates, meet the team, and help shape the roadmap. Food and drinks on us!",
    category: "Community",
    mode: "inperson",
    location: "The Collective, 8 Shoreditch High St, London E1 6JE",
    meetingLink: "",
    startDate: "2025-07-30",
    endDate: "2025-07-30",
    startTime: "19:00",
    endTime: "21:30",
    coverImage: "🤝",
    tickets: [
      { id: "t6", name: "Member", price: 0, capacity: 80, sold: 47 },
      { id: "t7", name: "Guest", price: 5, capacity: 20, sold: 8 },
    ],
    rsvps: [
      { userId: "r10", name: "Isla MacLeod", avatar: "IM", ticketType: "Member", date: "2025-07-14", paid: false },
      { userId: "r11", name: "Raj Patel", avatar: "RP", ticketType: "Member", date: "2025-07-15", paid: false },
      { userId: "r12", name: "Eva Müller", avatar: "EM", ticketType: "Guest", date: "2025-07-16", paid: true },
      { userId: "r13", name: "James Park", avatar: "JP", ticketType: "Member", date: "2025-07-17", paid: false },
      { userId: "r14", name: "Sofia Andrade", avatar: "SA", ticketType: "Member", date: "2025-07-18", paid: false },
    ],
    organiser: MOCK_ORGANISERS[0],
    tags: ["community", "networking", "freetrust"],
    trustReward: 15,
    published: true,
  },
  {
    id: "e5",
    title: "Intro to TypeScript for JavaScript Developers",
    description: "Already know JavaScript? This is the fastest path to TypeScript confidence. We cover types, interfaces, generics, and real-world patterns in 2 hours.",
    category: "Technology",
    mode: "online",
    location: "",
    meetingLink: "https://meet.freetrust.io/typescript-intro",
    startDate: "2025-06-12",
    endDate: "2025-06-12",
    startTime: "17:00",
    endTime: "19:00",
    coverImage: "💻",
    tickets: [
      { id: "t8", name: "Free", price: 0, capacity: 300, sold: 300 },
    ],
    rsvps: [],
    organiser: MOCK_ORGANISERS[1],
    tags: ["typescript", "javascript", "coding"],
    trustReward: 15,
    published: true,
  },
];

const CATEGORIES = ["All", "Technology", "Design", "Community", "Workshops", "Business", "Arts", "Health", "Education", "Other"];

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "Technology",
  mode: "online" as EventMode,
  location: "",
  meetingLink: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  coverEmoji: "🎉",
  tags: "",
  tickets: [{ id: "new1", name: "Free Entry", price: 0, capacity: 100, sold: 0 }] as TicketType[],
};

const EMOJI_OPTIONS = ["🎉", "🌐", "🧘", "🎨", "🤝", "💻", "🚀", "📚", "🎵", "🏃", "🍕", "💡", "🌱", "🔬", "🎭"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function totalCapacity(tickets: TicketType[]) { return tickets.reduce((s, t) => s + t.capacity, 0); }
function totalSold(tickets: TicketType[]) { return tickets.reduce((s, t) => s + t.sold, 0); }
function minPrice(tickets: TicketType[]) { return Math.min(...tickets.map(t => t.price)); }
function isFree(tickets: TicketType[]) { return tickets.every(t => t.price === 0); }

function avatarBg(initials: string) {
  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500", "bg-fuchsia-500"];
  const i = (initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % colors.length;
  return colors[i];
}

function copyToClipboard(text: string) {
  if (navigator?.clipboard) navigator.clipboard.writeText(text);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-9 h-9 text-sm";
  return (
    <div className={`${s} ${avatarBg(initials)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function TrustBadge({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
      <BoltIcon className="w-3.5 h-3.5" />
      +₮{amount} Trust
    </span>
  );
}

function EventCard({ event, onClick }: { event: Event; onClick: () => void }) {
  const past = isPast(parseISO(`${event.endDate}T${event.endTime}`));
  const spotsLeft = totalCapacity(event.tickets) - totalSold(event.tickets);
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-violet-300 transition-all duration-200 group"
    >
      <div className="h-32 bg-gradient-to-br from-violet-50 to-indigo-100 flex items-center justify-center text-6xl relative">
        {event.coverImage}
        {past && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="bg-white/90 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">Past Event</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          {event.mode === "online"
            ? <Badge label="Online" color="bg-blue-100 text-blue-700" />
            : <Badge label="In Person" color="bg-emerald-100 text-emerald-700" />}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-slate-800 text-sm leading-snug group-hover:text-violet-700 transition-colors line-clamp-2">{event.title}</h3>
          {isFree(event.tickets)
            ? <Badge label="Free" color="bg-emerald-100 text-emerald-700" />
            : <Badge label={`From £${minPrice(event.tickets)}`} color="bg-violet-100 text-violet-700" />}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
          <CalendarDaysIcon className="w-3.5 h-3.5" />
          {format(parseISO(event.startDate), "EEE d MMM yyyy")} · {event.startTime}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
          {event.mode === "online"
            ? <><ComputerDesktopIcon className="w-3.5 h-3.5" /><span>Online</span></>
            : <><MapPinIcon className="w-3.5 h-3.5" /><span className="truncate">{event.location.split(",")[0]}</span></>}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Avatar initials={event.organiser.avatar} size="sm" />
            <span className="text-xs text-slate-600">{event.organiser.name}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <UserGroupIcon className="w-3.5 h-3.5" />
            <span>{totalSold(event.tickets)} going</span>
            {spotsLeft > 0 && spotsLeft < 20 && <span className="text-orange-600 font-medium">· {spotsLeft} left</span>}
            {spotsLeft === 0 && <span className="text-red-600 font-medium">· Full</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ events, onSelectEvent }: { events: Event[]; onSelectEvent: (e: Event) => void }) {
  const [month, setMonth] = useState(new Date());
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startPad = startOfMonth(month).getDay();

  function eventsOnDay(day: Date) {
    return events.filter(e => isSameDay(parseISO(e.startDate), day));
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronLeftIcon className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="font-semibold text-slate-800">{format(month, "MMMM yyyy")}</h2>
        <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronRightIcon className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 border-b border-slate-100">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} className="min-h-[80px] border-b border-r border-slate-100" />)}
        {days.map(day => {
          const dayEvents = eventsOnDay(day);
          const today = isToday(day);
          const inMonth = isSameMonth(day, month);
          return (
            <div key={day.toISOString()} className={`min-h-[80px] p-1.5 border-b border-r border-slate-100 ${!inMonth ? "bg-slate-50" : ""}`}>
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${today ? "bg-violet-600 text-white" : "text-slate-700"}`}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map(e => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEvent(e)}
                    className="w-full text-left text-[10px] leading-tight bg-violet-100 text-violet-700 rounded px-1 py-0.5 truncate hover:bg-violet-200 transition-colors"
                  >
                    {e.coverImage} {e.title}
                  </button>
                ))}
                {dayEvents.length > 2 && <div className="text-[10px] text-slate-500 pl-1">+{dayEvents.length - 2} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

function ShareModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = `https://freetrust.io/events/${event.id}`;

  function handleCopy() {
    copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shareOptions = [
    { label: "Copy Link", icon: LinkIcon, action: handleCopy },
    { label: "Twitter / X", icon: GlobeAltIcon, action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(event.title)}&url=${encodeURIComponent(url)}`) },
    { label: "LinkedIn", icon: GlobeAltIcon, action: () => window.open(`https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Share Event</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="text-3xl text-center mb-3">{event.coverImage}</div>
        <p className="text-sm text-center font-medium text-slate-700 mb-4">{event.title}</p>
        <div className="bg-slate-50 rounded-xl px-3 py-2 flex items-center gap-2 mb-4">
          <span className="text-xs text-slate-500 truncate flex-1">{url}</span>
          <button onClick={handleCopy} className="text-violet-600 text-xs font-semibold hover:text-violet-800 transition-colors flex-shrink-0">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {shareOptions.map(opt => (
            <button key={opt.label} onClick={opt.action} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-xs text-slate-600">
              <opt.icon className="w-5 h-5 text-violet-600" />
              {opt.label === "Copy Link" && copied ? "Copied!" : opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RSVP Modal ───────────────────────────────────────────────────────────────

function RSVPModal({ event, onClose, onConfirm }: { event: Event; onClose: () => void; onConfirm: (ticketId: string) => void }) {
  const [selected, setSelected] = useState(event.tickets[0]?.id ?? "");
  const ticket = event.tickets.find(t => t.id === selected);
  const spotsLeft = ticket ? ticket.capacity - ticket.sold : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-800 text-lg">Reserve Your Spot</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-3 bg-violet-50 rounded-xl p-3 mb-5">
          <span className="text-3xl">{event.coverImage}</span>
          <div>
            <p className="font-medium text-slate-800 text-sm">{event.title}</p>
            <p className="text-xs text-slate-500">{format(parseISO(event.startDate), "EEE d MMM yyyy")} · {event.startTime}</p>
          </div>
        </div>
        <p className="text-sm font-medium text-slate-700 mb-3">Select ticket type</p>
        <div className="space-y-2 mb-5">
          {event.tickets.map(t => {
            const left = t.capacity - t.sold;
            const full = left <= 0;
            return (
              <label
                key={t.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${full ? "opacity-50 cursor-not-allowed" : selected === t.id ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-violet-300"}`}
              >
                <input type="radio" name="ticket" value={t.id} checked={selected === t.id} disabled={full} onChange={() => setSelected(t.id)} className="accent-violet-600" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{t.name}</span>
                    <span className="text-sm font-semibold text-violet-700">{t.price === 0 ? "Free" : `£${t.price}`}</span>
                  </div>
                  <div className="text-xs text-slate-500">{full ? "Sold out" : `${left} of ${t.capacity} remaining`}</div>
                </div>
              </label>
            );
          })}
        </div>
        <button
          onClick={() => { onConfirm(selected); onClose(); }}
          disabled={!selected || spotsLeft <= 0}
          className="w-full bg-violet-600 text-white rounded-xl py-3 font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ticket?.price === 0 ? "Confirm RSVP (Free)" : `Continue to Payment · £${ticket?.price}`}
        </button>
      </div>
    </div>
  );
}

// ─── Event Detail ─────────────────────────────────────────────────────────────

function EventDetail({
  event,
  onBack,
  onOrganiser,
  onRSVP,
}: {
  event: Event;
  onBack: () => void;
  onOrganiser: (o: Organiser) => void;
  onRSVP: (e: Event) => void;
}) {
  const [showShare, setShowShare] = useState(false);
  const [rsvpDone, setRsvpDone] = useState(false);
  const past = isPast(parseISO(`${event.endDate}T${event.endTime}`));
  const sold = totalSold(event.tickets);
  const cap = totalCapacity(event.tickets);

  return (
    <div className="max-w-3xl mx-auto">
      {showShare && <ShareModal event={event} onClose={() => setShowShare(false)} />}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-4 transition-colors">
        <ChevronLeftIcon className="w-4 h-4" /> Back to events
      </button>

      {/* Cover */}
      <div className="h-52 bg-gradient-to-br from-violet-100 to-indigo-200 rounded-2xl flex items-center justify-center text-8xl mb-6 relative overflow-hidden">
        {event.coverImage}
        <div className="absolute top-3 left-3 flex gap-2">
          {event.mode === "online"
            ? <Badge label="Online" color="bg-blue-100 text-blue-700" />
            : <Badge label="In Person" color="bg-emerald-100 text-emerald-700" />}
          <Badge label={event.category} color="bg-white/80 text-slate-700" />
        </div>
        <div className="absolute top-3 right-3">
          <TrustBadge amount={event.trustReward} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{event.title}</h1>
            <div className="flex flex-wrap gap-1.5">
              {event.tags.map(tag => (
                <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">#{tag}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2.5">
              <CalendarDaysIcon className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-500 font-medium">Date & Time</div>
                <div className="text-sm text-slate-800 font-medium">{format(parseISO(event.startDate), "EEE d MMM yyyy")}</div>
                <div className="text-xs text-slate-600">{event.startTime} – {event.endTime}</div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2.5">
              {event.mode === "online"
                ? <ComputerDesktopIcon className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                : <MapPinIcon className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />}
              <div>
                <div className="text-xs text-slate-500 font-medium">{event.mode === "online" ? "Location" : "Venue"}</div>
                {event.mode === "online"
                  ? <div className="text-sm text-slate-800 font-medium">Online Event</div>
                  : <div className="text-sm text-slate-800 font-medium leading-snug">{event.location}</div>}
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-slate-800 mb-2">About this event</h2>
            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{event.description}</div>
          </div>

          {/* Tickets */}
          <div>
            <h2 className="font-semibold text-slate-800 mb-3">Tickets</h2>
            <div className="space-y-2">
              {event.tickets.map(t => {
                const pct = Math.round((t.sold / t.capacity) * 100);
                return (
                  <div key={t.id} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <TicketIcon className="w-4 h-4 text-violet-600" />
                        <span className="text-sm font-medium text-slate-800">{t.name}</span>
                      </div>
                      <span className="font-semibold text-violet-700">{t.price === 0 ? "Free" : `£${t.price}`}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                      <div className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-violet-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-slate-500">{t.sold} / {t.capacity} sold</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Attendees */}
          <div>
            <h2 className="font-semibold text-slate-800 mb-3">
              Attendees <span className="text-slate-400 font-normal text-sm">({event.rsvps.length})</span>
            </h2>
            {event.rsvps.length === 0
              ? <p className="text-sm text-slate-500">No RSVPs yet. Be the first!</p>
              : (
                <div className="flex flex-wrap gap-2">
                  {event.rsvps.map(r => (
                    <div key={r.userId} className="flex items-center gap-1.5 bg-slate-50 rounded-full px-2.5 py-1">
                      <Avatar initials={r.avatar} size="sm" />
                      <span className="text-xs text-slate-700">{r.name}</span>
                      {r.paid && <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Action card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {isFree(event.tickets) ? "Free" : `From £${minPrice(event.tickets)}`}
                </div>
                <div className="text-xs text-slate-500">{sold} / {cap} spots taken</div>
              </div>
              <button onClick={() => setShowShare(true)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                <ShareIcon className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="h-2 bg-slate-100 rounded-full mb-3 overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, Math.round((sold / cap) * 100))}%` }} />
            </div>
            {rsvpDone
              ? (
                <div className="flex items-center gap-2 justify-center bg-emerald-50 text-emerald-700 rounded-xl py-3 font-semibold text-sm">
                  <CheckCircleIcon className="w-5 h-5" /> You're going!
                </div>
              )
              : (
                <button
                  onClick={() => onRSVP(event)}
                  disabled={past || sold >= cap}
                  className="w-full bg-violet-600 text-white rounded-xl py-3 font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {past ? "Event Ended" : sold >= cap ? "Sold Out" : "RSVP Now"}
                </button>
              )}
            {!rsvpDone && !past && <p className="text-center text-xs text-slate-500 mt-2">No account needed for free events</p>}
          </div>

          {/* Organiser card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Organiser</h3>
            <div className="flex items-center gap-2.5 mb-3">
              <Avatar initials={event.organiser.avatar} size="md" />
              <div>
                <div className="font-medium text-slate-800 text-sm">{event.organiser.name}</div>
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <StarIcon className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ₮{event.organiser.trustScore.toLocaleString()} Trust
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">{event.organiser.bio}</p>
            <div className="grid grid-cols-2 gap-2 text-center mb-3">
              <div className="bg-slate-50 rounded-lg py-1.5">
                <div className="text-sm font-bold text-slate-800">{event.organiser.eventsHosted}</div>
                <div className="text-xs text-slate-500">Events</div>
              </div>
              <div className="bg-slate-50 rounded-lg py-1.5">
                <div className="text-sm font-bold text-slate-800">{event.organiser.followers}</div>
                <div className="text-xs text-slate-500">Followers</div>
              </div>
            </div>
            <button
              onClick={() => onOrganiser(event.organiser)}
              className="w-full text-sm text-violet-600 border border-violet-200 rounded-xl py-2 hover:bg-violet-50 transition-colors font-medium"
            >
              View Profile
            </button>
          </div>

          {/* Trust reward */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <BoltIcon className="w-5 h-5 text-amber-600" />
              <span className="font-semibold text-amber-800 text-sm">Trust Reward</span>
            </div>
            <p className="text-xs text-amber-700">Host this event and earn <strong>₮{event.trustReward}</strong> Trust when it completes successfully.</p>
          </div>

          {event.mode === "online" && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ComputerDesktopIcon className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-800 text-sm">Online Event</span>
              </div>
              <p className="text-xs text-blue-700">Meeting link will be sent to registered attendees before the event.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Organiser Profile ────────────────────────────────────────────────────────

function OrganiserProfile({ organiser, events, onBack, onEventClick }: { organiser: Organiser; events: Event[]; onBack: () => void; onEventClick: (e: Event) => void }) {
  const orgEvents = events.filter(e => e.organiser.id === organiser.id);
  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-4 transition-colors">
        <ChevronLeftIcon className="w-4 h-4" /> Back
      </button>
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">{organiser.avatar}</div>
          <div>
            <h1 className="text-xl font-bold">{organiser.name}</h1>
            <p className="text-violet-200 text-sm">{organiser.bio}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5">
          {[
            { label: "Trust Score", value: `₮${organiser.trustScore.toLocaleString()}` },
            { label: "Events Hosted", value: organiser.eventsHosted },
            { label: "Followers", value: organiser.followers },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-xs text-violet-200">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <h2 className="font-semibold text-slate-800 mb-3">Events by {organiser.name}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {orgEvents.map(e => <EventCard key={e.id} event={e} onClick={() => onEventClick(e)} />)}
      </div>
      {orgEvents.length === 0 && <p className="text-sm text-slate-500">No events yet.</p>}
    </div>
  );
}

// ─── Create Event Form ────────────────────────────────────────────────────────

function CreateEventForm({ onBack, onCreate }: { onBack: () => void; onCreate: (e: Event) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }

  function setTicket(idx: number, field: keyof TicketType, val: string | number) {
    setForm(f => {
      const ts = [...f.tickets];
      ts[idx] = { ...ts[idx], [field]: val };
      return { ...f, tickets: ts };
    });
  }

  function addTicket() {
    setForm(f => ({
      ...f,
      tickets: [...f.tickets, { id: `new-${Date.now()}`, name: "New Ticket", price: 0, capacity: 50, sold: 0 }],
    }));
  }

  function removeTicket(idx: number) {
    setForm(f => ({ ...f, tickets: f.tickets.filter((_, i) => i !== idx) }));
  }

  function validate1() {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.startDate) e.startDate = "Start date required";
    if (!form.startTime) e.startTime = "Start time required";
    if (!form.endTime) e.endTime = "End time required";
    if (form.mode === "inperson" && !form.location.trim()) e.location = "Location required for in-person events";
    if (form.mode === "online" && !form.meetingLink.trim()) e.meetingLink = "Meeting link required for online events";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validate2() {
    const e: Record<string, string> = {};
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (step === 1 && validate1()) setStep(2);
    else if (step === 2 && validate2()) setStep(3);
  }

  function handleSubmit() {
    const newEvent: Event = {
      id: `e${Date.now()}`,
      title: form.title,
      description: form.description,
      category: form.category,
      mode: form.mode,
      location: form.location,
      meetingLink: form.meetingLink,
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      startTime: form.startTime,
      endTime: form.endTime,
      coverImage: form.coverEmoji,
      tickets: form.tickets,
      rsvps: [],
      organiser: MOCK_ORGANISERS[0],
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      trustReward: 15,
      published: true,
    };
    onCreate(newEvent);
  }

  const steps = [
    { n: 1, label: "Details" },
    { n: 2, label: "Description" },
    { n: 3, label: "Tickets" },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-4 transition-colors">
        <ChevronLeftIcon className="w-4 h-4" /> Back to events
      </button>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5">
          <h1 className="text-xl font-bold text-white">Create New Event</h1>
          <p className="text-violet-200 text-sm mt-0.5">Earn ₮15 Trust when your event completes</p>
          {/* Steps */}
          <div className="flex items-center gap-0 mt-4">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold transition-all ${step >= s.n ? "bg-white text-violet-600" : "bg-violet-400 text-white"}`}>
                  {step > s.n ? <CheckCircleIcon className="w-5 h-5" /> : s.n}
                </div>
                <span className={`ml-1.5 text-sm ${step >= s.n ? "text-white" : "text-violet-300"}`}>{s.label}</span>
                {i < steps.length - 1 && <div className={`w-8 h-0.5 mx-2 ${step > s.n ? "bg-white" : "bg-violet-400"}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1 */}
          {step === 1 && (
            <>
              {/* Emoji picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Event Cover</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(em => (
                    <button
                      key={em}
                      onClick={() => set("coverEmoji", em)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${form.coverEmoji === em ? "bg-violet-100 ring-2 ring-violet-500" : "bg-slate-50 hover:bg-slate-100"}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Event Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => set("title", e.target.value)}
                  placeholder="Give your event a great name"
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 transition-all ${errors.title ? "border-red-400" : "border-slate-200"}`}
                />
                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={e => set("category", e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Event Type</label>
                  <div className="flex gap-2">
                    {(["online", "inperson"] as EventMode[]).map(m => (
                      <button
                        key={m}
                        onClick={() => set("mode", m)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${form.mode === m ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:border-violet-300"}`}
                      >
                        {m === "online" ? <ComputerDesktopIcon className="w-4 h-4" /> : <MapPinIcon className="w-4 h-4" />}
                        {m === "online" ? "Online" : "In Person"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => set("startDate", e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 ${errors.startDate ? "border-red-400" : "border-slate-200"}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => set("endDate", e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Time *</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => set("startTime", e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 ${errors.startTime ? "border-red-400" : "border-slate-200"}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">End Time *</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => set("endTime", e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 ${errors.endTime ? "border-red-400" : "border-slate-200"}`}
                  />
                </div>
              </div>

              {form.mode === "inperson" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Venue Address *</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => set("location", e.target.value)}
                    placeholder="42 Innovation Street, London EC1A 1BB"
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 ${errors.location ? "border-red-400" : "border-slate-200"}`}
                  />
                  {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
                </div>
              )}

              {form.mode === "online" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Meeting Link *</label>
                  <input
                    type="url"
                    value={form.meetingLink}
                    onChange={e => set("meetingLink", e.target.value)}
                    placeholder="https://meet.freetrust.io/your-event"
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 ${errors.meetingLink ? "border-red-400" : "border-slate-200"}`}
                  />
                  {errors.meetingLink && <p className="text-xs text-red-500 mt-1">{errors.meetingLink}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tags <span className="text-slate-400 font-normal">(comma separated)</span></label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => set("tags", e.target.value)}
                  placeholder="community, networking, tech"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Event Description *</label>
              <textarea
                value={form.description}
                onChange={e => set("description", e.target.value)}
                rows={10}
                placeholder="Tell people what your event is about. What will they learn, experience, or take away? Who is it for?"
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none ${errors.description ? "border-red-400" : "border-slate-200"}`}
              />
              {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
              <p className="text-xs text-slate-400 mt-1">{form.description.length} characters</p>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-slate-800">Ticket Types</h3>
                <button onClick={addTicket} className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium">
                  <PlusCircleIcon className="w-4 h-4" /> Add Ticket
                </button>
              </div>
              <div className="space-y-3">
                {form.tickets.map((t, idx) => (
                  <div key={t.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">Ticket {idx + 1}</span>
                      {form.tickets.length > 1 && (
                        <button onClick={() => removeTicket(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-3">
                        <label className="block text-xs text-slate-500 mb-1">Ticket Name</label>
                        <input
                          type="text"
                          value={t.name}
                          onChange={e => setTicket(idx, "name", e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
