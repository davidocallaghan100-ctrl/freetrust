<<<FILE: app/events/page.tsx>>>
"use client";

import { useState, useMemo, useCallback } from "react";
import {
  CalendarDaysIcon,
  ListBulletIcon,
  PlusIcon,
  MapPinIcon,
  VideoCameraIcon,
  TicketIcon,
  UserGroupIcon,
  ShareIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  ClockIcon,
  StarIcon,
  BellAlertIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid, StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, parseISO } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventMode = "online" | "in-person" | "hybrid";
type TicketType = { id: string; name: string; price: number; capacity: number; sold: number; description: string };
type Attendee = { id: string; name: string; avatar: string; ticketType: string; status: "confirmed" | "pending" | "cancelled"; rsvpDate: string };
type Organiser = { id: string; name: string; avatar: string; bio: string; trustScore: number; eventsHosted: number; followers: number; verified: boolean };
type EventItem = {
  id: string; title: string; description: string; mode: EventMode;
  location: string; streamUrl?: string; date: string; endDate: string;
  category: string; image: string; organiser: Organiser;
  tickets: TicketType[]; attendees: Attendee[];
  tags: string[]; status: "upcoming" | "live" | "past" | "draft";
  trustReward: number; rsvpOpen: boolean; maxCapacity: number;
};

type FormData = {
  title: string; description: string; mode: EventMode;
  location: string; streamUrl: string; date: string; endDate: string;
  category: string; tags: string;
  tickets: { name: string; price: string; capacity: string; description: string }[];
  rsvpOpen: boolean; image: string;
};

type View = "list" | "calendar" | "detail" | "create" | "organiser" | "manage";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ORGANISERS: Organiser[] = [
  { id: "o1", name: "Sarah Chen", avatar: "SC", bio: "Web3 educator and community builder. Hosting events on blockchain, DeFi, and the future of trust-based economies.", trustScore: 4820, eventsHosted: 23, followers: 1240, verified: true },
  { id: "o2", name: "Marcus Webb", avatar: "MW", bio: "Developer advocate and open-source contributor. Passionate about decentralised tools and developer education.", trustScore: 3110, eventsHosted: 14, followers: 780, verified: true },
  { id: "o3", name: "Priya Nair", avatar: "PN", bio: "UX researcher focused on ethical design and digital accessibility. Runs workshops on inclusive product development.", trustScore: 2450, eventsHosted: 9, followers: 520, verified: false },
];

const MOCK_EVENTS: EventItem[] = [
  {
    id: "e1", title: "Web3 Trust Summit 2025", status: "upcoming", trustReward: 15, rsvpOpen: true, maxCapacity: 500,
    description: "Join us for a full-day summit exploring the intersection of blockchain technology, digital trust, and decentralised identity. Featuring keynotes, panel discussions, and hands-on workshops with industry leaders.",
    mode: "hybrid", location: "Southbank Centre, London", streamUrl: "https://stream.freetrust.io/summit2025",
    date: "2025-08-15T09:00:00", endDate: "2025-08-15T18:00:00",
    category: "Technology", image: "🌐", tags: ["blockchain", "web3", "identity", "trust"],
    organiser: ORGANISERS[0],
    tickets: [
      { id: "t1", name: "General Admission", price: 0, capacity: 300, sold: 187, description: "Access to all talks and networking areas" },
      { id: "t2", name: "Workshop Pass", price: 25, capacity: 150, sold: 98, description: "General admission + 3 hands-on workshops" },
      { id: "t3", name: "VIP", price: 75, capacity: 50, sold: 31, description: "Full access + VIP lounge + speaker dinner" },
    ],
    attendees: [
      { id: "a1", name: "Alex Morgan", avatar: "AM", ticketType: "General Admission", status: "confirmed", rsvpDate: "2025-07-01" },
      { id: "a2", name: "Jamie Liu", avatar: "JL", ticketType: "Workshop Pass", status: "confirmed", rsvpDate: "2025-07-03" },
      { id: "a3", name: "Taylor Reed", avatar: "TR", ticketType: "VIP", status: "confirmed", rsvpDate: "2025-07-05" },
      { id: "a4", name: "Casey Brooks", avatar: "CB", ticketType: "General Admission", status: "pending", rsvpDate: "2025-07-10" },
    ],
  },
  {
    id: "e2", title: "DeFi for Beginners Workshop", status: "upcoming", trustReward: 15, rsvpOpen: true, maxCapacity: 80,
    description: "A beginner-friendly workshop on decentralised finance. Learn about liquidity pools, yield farming, and how to navigate DeFi safely. No prior experience needed.",
    mode: "online", location: "", streamUrl: "https://zoom.us/j/freetrust-defi",
    date: "2025-08-22T14:00:00", endDate: "2025-08-22T16:30:00",
    category: "Education", image: "📚", tags: ["defi", "beginners", "finance"],
    organiser: ORGANISERS[1],
    tickets: [
      { id: "t4", name: "Free Seat", price: 0, capacity: 80, sold: 54, description: "Full workshop access" },
    ],
    attendees: [
      { id: "a5", name: "Sam Wilson", avatar: "SW", ticketType: "Free Seat", status: "confirmed", rsvpDate: "2025-07-15" },
      { id: "a6", name: "Dana Park", avatar: "DP", ticketType: "Free Seat", status: "confirmed", rsvpDate: "2025-07-18" },
    ],
  },
  {
    id: "e3", title: "Inclusive UX Design Masterclass", status: "upcoming", trustReward: 15, rsvpOpen: true, maxCapacity: 40,
    description: "An intensive masterclass on designing accessible and inclusive digital products. Covers WCAG guidelines, user research with diverse groups, and practical design patterns.",
    mode: "in-person", location: "Clerkenwell Design Studio, London",
    date: "2025-09-05T10:00:00", endDate: "2025-09-05T17:00:00",
    category: "Design", image: "🎨", tags: ["ux", "accessibility", "design", "inclusive"],
    organiser: ORGANISERS[2],
    tickets: [
      { id: "t5", name: "Standard", price: 45, capacity: 30, sold: 18, description: "Full day masterclass" },
      { id: "t6", name: "Concession", price: 20, capacity: 10, sold: 7, description: "For students and unwaged" },
    ],
    attendees: [
      { id: "a7", name: "Riley Evans", avatar: "RE", ticketType: "Standard", status: "confirmed", rsvpDate: "2025-07-20" },
    ],
  },
  {
    id: "e4", title: "FreeTrust Community Meetup", status: "live", trustReward: 15, rsvpOpen: false, maxCapacity: 100,
    description: "Monthly community meetup to share updates, celebrate milestones, and connect with fellow FreeTrust members. Come and meet the team!",
    mode: "hybrid", location: "Impact Hub, Birmingham", streamUrl: "https://stream.freetrust.io/meetup-jul",
    date: "2025-07-28T18:00:00", endDate: "2025-07-28T21:00:00",
    category: "Community", image: "🤝", tags: ["community", "networking", "freetrust"],
    organiser: ORGANISERS[0],
    tickets: [
      { id: "t7", name: "Free Entry", price: 0, capacity: 100, sold: 100, description: "All welcome" },
    ],
    attendees: [
      { id: "a8", name: "Jordan Kim", avatar: "JK", ticketType: "Free Entry", status: "confirmed", rsvpDate: "2025-07-01" },
      { id: "a9", name: "Morgan Ali", avatar: "MA", ticketType: "Free Entry", status: "confirmed", rsvpDate: "2025-07-02" },
    ],
  },
  {
    id: "e5", title: "Crypto Art & NFT Exhibition", status: "past", trustReward: 15, rsvpOpen: false, maxCapacity: 200,
    description: "A curated exhibition of digital art and NFTs from emerging and established Web3 artists. Panel discussion and minting demo included.",
    mode: "in-person", location: "Tate Modern, London",
    date: "2025-06-12T11:00:00", endDate: "2025-06-12T20:00:00",
    category: "Art", image: "🖼️", tags: ["nft", "art", "web3", "crypto"],
    organiser: ORGANISERS[1],
    tickets: [
      { id: "t8", name: "Visitor", price: 10, capacity: 200, sold: 200, description: "Exhibition entry" },
    ],
    attendees: [],
  },
];

const CATEGORIES = ["Technology", "Education", "Design", "Community", "Art", "Finance", "Health", "Sport", "Music", "Other"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const totalSold = (e: EventItem) => e.tickets.reduce((s, t) => s + t.sold, 0);
const totalCapacity = (e: EventItem) => e.tickets.reduce((s, t) => s + t.capacity, 0);
const isFree = (e: EventItem) => e.tickets.every(t => t.price === 0);
const minPrice = (e: EventItem) => Math.min(...e.tickets.map(t => t.price));
const statusColor = (s: EventItem["status"]) =>
  s === "live" ? "bg-red-500" : s === "upcoming" ? "bg-emerald-500" : s === "draft" ? "bg-amber-500" : "bg-slate-400";
const modeIcon = (m: EventMode) => m === "online" ? "💻" : m === "in-person" ? "📍" : "🔀";

function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined") navigator.clipboard?.writeText(text).catch(() => {});
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{children}</span>;
}

function Avatar({ initials, size = "sm" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-16 h-16 text-xl" : size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
  const color = colors[initials.charCodeAt(0) % colors.length];
  return <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>{initials}</div>;
}

function TrustBadge({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
      ₮{amount} trust
    </span>
  );
}

function CapacityBar({ sold, capacity }: { sold: number; capacity: number }) {
  const pct = Math.round((sold / capacity) * 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{sold} attending</span><span>{capacity - sold} left</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onClick }: { event: EventItem; onClick: () => void }) {
  const [shared, setShared] = useState(false);
  const sold = totalSold(event);
  const cap = totalCapacity(event);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(`https://freetrust.io/events/${event.id}`);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <div onClick={onClick} className="bg-white rounded-2xl border border-slate-200 hover:border-violet-300 hover:shadow-md transition-all cursor-pointer overflow-hidden group">
      <div className="bg-gradient-to-br from-violet-50 to-indigo-100 h-28 flex items-center justify-center text-5xl relative">
        {event.image}
        <div className={`absolute top-3 left-3 ${statusColor(event.status)} text-white text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide`}>
          {event.status}
        </div>
        <button onClick={handleShare} className="absolute top-3 right-3 bg-white/80 hover:bg-white rounded-full p-1.5 transition-all opacity-0 group-hover:opacity-100">
          {shared ? <CheckCircleSolid className="w-4 h-4 text-emerald-500" /> : <ShareIcon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">{event.title}</h3>
          <TrustBadge amount={event.trustReward} />
        </div>
        <div className="space-y-1 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{format(parseISO(event.date), "EEE d MMM, HH:mm")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{modeIcon(event.mode)}</span>
            <span className="truncate">{event.mode === "online" ? "Online Event" : event.location}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Badge color="bg-slate-100 text-slate-600">{event.category}</Badge>
          <Badge color={isFree(event) ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}>
            {isFree(event) ? "Free" : `From £${minPrice(event)}`}
          </Badge>
        </div>
        <CapacityBar sold={sold} capacity={cap} />
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          <Avatar initials={event.organiser.avatar} size="sm" />
          <span className="text-xs text-slate-500 truncate">{event.organiser.name}</span>
          {event.organiser.verified && <CheckCircleSolid className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
        </div>
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ events, onSelect }: { events: EventItem[]; onSelect: (e: EventItem) => void }) {
  const [month, setMonth] = useState(new Date(2025, 7, 1));
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const firstDay = (startOfMonth(month).getDay() + 6) % 7;

  const eventsOnDay = (day: Date) => events.filter(e => isSameDay(parseISO(e.date), day));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800">{format(month, "MMMM yyyy")}</h2>
        <div className="flex gap-2">
          <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeftIcon className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => setMonth(new Date(2025, 7, 1))} className="px-2 py-1 text-xs rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">Today</button>
          <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRightIcon className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-100">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="h-24 border-b border-r border-slate-50" />)}
        {days.map(day => {
          const dayEvents = eventsOnDay(day);
          return (
            <div key={day.toISOString()} className={`h-24 border-b border-r border-slate-50 p-1 ${isToday(day) ? "bg-violet-50" : ""}`}>
              <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday(day) ? "bg-violet-600 text-white" : "text-slate-600"}`}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map(ev => (
                  <button key={ev.id} onClick={() => onSelect(ev)}
                    className={`w-full text-left text-xs px-1 py-0.5 rounded truncate block ${statusColor(ev.status)} text-white font-medium hover:opacity-80 transition-opacity`}>
                    {ev.image} {ev.title}
                  </button>
                ))}
                {dayEvents.length > 2 && <div className="text-xs text-slate-400 pl-1">+{dayEvents.length - 2}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Organiser Profile ────────────────────────────────────────────────────────

function OrganiserProfile({ organiser, events, onBack, onViewEvent }: { organiser: Organiser; events: EventItem[]; onBack: () => void; onViewEvent: (e: EventItem) => void }) {
  const [following, setFollowing] = useState(false);
  const orgEvents = events.filter(e => e.organiser.id === organiser.id);

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors text-sm">
        <ChevronLeftIcon className="w-4 h-4" /> Back to events
      </button>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 h-24" />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-8 mb-4">
            <div className="w-16 h-16 bg-white rounded-2xl border-4 border-white shadow-sm flex items-center justify-center">
              <Avatar initials={organiser.avatar} size="lg" />
            </div>
            <button onClick={() => setFollowing(f => !f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${following ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-violet-600 text-white hover:bg-violet-700"}`}>
              {following ? "Following" : "Follow"}
            </button>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-800">{organiser.name}</h2>
            {organiser.verified && <CheckCircleSolid className="w-5 h-5 text-blue-500" />}
          </div>
          <p className="text-slate-500 text-sm mb-4">{organiser.bio}</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
              <div className="text-lg font-bold text-amber-700">₮{organiser.trustScore.toLocaleString()}</div>
              <div className="text-xs text-amber-600">Trust Score</div>
            </div>
            <div className="text-center p-3 bg-violet-50 rounded-xl border border-violet-100">
              <div className="text-lg font-bold text-violet-700">{organiser.eventsHosted}</div>
              <div className="text-xs text-violet-600">Events Hosted</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-lg font-bold text-slate-700">{(organiser.followers + (following ? 1 : 0)).toLocaleString()}</div>
              <div className="text-xs text-slate-500">Followers</div>
            </div>
          </div>
        </div>
      </div>
      <h3 className="font-semibold text-slate-700 mb-3">Events by {organiser.name}</h3>
      <div className="grid gap-4">
        {orgEvents.map(ev => <EventCard key={ev.id} event={ev} onClick={() => onViewEvent(ev)} />)}
      </div>
    </div>
  );
}

// ─── Attendee Row ─────────────────────────────────────────────────────────────

function AttendeeRow({ a, onUpdate }: { a: Attendee; onUpdate: (id: string, s: Attendee["status"]) => void }) {
  const statusBg = a.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : a.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <Avatar initials={a.avatar} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-slate-800">{a.name}</div>
        <div className="text-xs text-slate-500">{a.ticketType} · {format(parseISO(a.rsvpDate), "d MMM yyyy")}</div>
      </div>
      <Badge color={statusBg}>{a.status}</Badge>
      {a.status === "pending" && (
        <div className="flex gap-1">
          <button onClick={() => onUpdate(a.id, "confirmed")} className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors" title="Confirm">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
          </button>
          <button onClick={() => onUpdate(a.id, "cancelled")} className="p-1 rounded-lg bg-red-50 hover:bg-red-100 transition-colors" title="Cancel">
            <XMarkIcon className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Manage Event ─────────────────────────────────────────────────────────────

function ManageEvent({ event, onBack, onUpdate }: { event: EventItem; onBack: () => void; onUpdate: (e: EventItem) => void }) {
  const [attendees, setAttendees] = useState(event.attendees);

  const updateStatus = (id: string, status: Attendee["status"]) => {
    setAttendees(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    onUpdate({ ...event, attendees: attendees.map(a => a.id === id ? { ...a, status } : a) });
  };

  const sold = attendees.filter(a => a.status !== "cancelled").length;
  const confirmed = attendees.filter(a => a.status === "confirmed").length;
  const pending = attendees.filter(a => a.status === "pending").length;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors text-sm">
        <ChevronLeftIcon className="w-4 h-4" /> Back
      </button>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Manage: {event.title}</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge color={`${statusColor(event.status)} text-white`}>{event.status}</Badge>
          <TrustBadge amount={event.trustReward} />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-violet-50 rounded-xl p-3 border border-violet-100 text-center">
            <div className="text-xl font-bold text-violet-700">{sold}</div>
            <div className="text-xs text-violet-500">Registered</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-center">
            <div className="text-xl font-bold text-emerald-700">{confirmed}</div>
            <div className="text-xs text-emerald-500">Confirmed</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-center">
            <div className="text-xl font-bold text-amber-700">{pending}</div>
            <div className="text-xs text-amber-500">Pending</div>
          </div>
        </div>
        <div className="space-y-1 mb-4">
          {event.tickets.map(t => (
            <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
              <span className="font-medium text-slate-700">{t.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-slate-500">{t.sold}/{t.capacity}</span>
                <span className={`text-xs font-semibold ${t.price === 0 ? "text-emerald-600" : "text-violet-600"}`}>
                  {t.price === 0 ? "Free" : `£${t.price}`}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex items-center gap-3">
          <span className="text-2xl">₮</span>
          <div>
            <div className="text-sm font-semibold text-amber-800">Trust Reward Earned</div>
            <div className="text-xs text-amber-600">You earned ₮{event.trustReward} for hosting this event</div>
          </div>
          <div className="ml-auto text-lg font-bold text-amber-700">+₮{event.trustReward}</div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5 text-slate-400" /> Attendees ({attendees.length})
        </h3>
        {attendees.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No attendees yet</p>
        ) : (
          attendees.map(a => <AttendeeRow key={a.id} a={a} onUpdate={updateStatus} />)
        )}
      </div>
    </div>
  );
}

// ─── Event Detail ─────────────────────────────────────────────────────────────

function EventDetail({ event, onBack, onViewOrganiser, onManage }: { event: EventItem; onBack: () => void; onViewOrganiser: (o: Organiser) => void; onManage: () => void }) {
  const [rsvpDone, setRsvpDone] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState("");
  const [shared, setShared] = useState(false);
  const [notified, setNotified] = useState(false);

  const handleShare = () => {
    copyToClipboard(`https://freetrust.io/events/${event.id}`);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const handleRSVP = () => {
    if (!selectedTicket && event.rsvpOpen) return;
    setRsvpDone(true);
  };

  const sold = totalSold(event);
  const cap = totalCapacity(event);

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors text-sm">
        <ChevronLeftIcon className="w-4 h-4" /> Back to events
      </button>

      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-100 to-indigo-200 rounded-2xl h-40 flex items-center justify-center text-7xl mb-6 relative overflow-hidden">
        {event.image}
        <div className={`absolute top-4 left-4 ${statusColor(event.status)} text-white text-sm font-bold px-3 py-1 rounded-full uppercase`}>
          {event.status}
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <button onClick={handleShare} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${shared ? "bg-emerald-500 text-white" : "bg-white/90 text-slate-700 hover:bg-white"}`}>
            {shared ? <><CheckCircleSolid className="w-4 h-4" /> Copied!</> : <><ShareIcon className="w-4 h-4" /> Share</>}
          </button>
          <button onClick={() => { setNotified(n => !n); }} className={`p-1.5 rounded-full transition-all ${notified ? "bg-violet-500 text-white" : "bg-white/90 text-slate-700 hover:bg-white"}`} title="Get notified">
            <BellAlertIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge color="bg-slate-100 text-slate-600">{event.category}</Badge>
              <TrustBadge amount={event.trustReward} />
              {event.tags.map(t => <Badge key={t} color="bg-violet-50 text-violet-600">#{t}</Badge>)}
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-3">{event.title}</h1>
            <p className="text-slate-600 text-sm leading-relaxed">{event.description}</p>
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-700">Event Details</h3>
            <div className="flex items-start gap-3">
              <ClockIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-700">{format(parseISO(event.date), "EEEE, d MMMM yyyy")}</div>
                <div className="text-xs text-slate-500">{format(parseISO(event.date), "HH:mm")} – {format(parseISO(event.endDate), "HH:mm")}</div>
              </div>
            </div>
            {(event.mode === "in-person" || event.mode === "hybrid") && event.location && (
              <div className="flex items-start gap-3">
                <MapPinIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-700">{event.location}</div>
                  <div className="text-xs text-slate-500">In-person venue</div>
                </div>
              </div>
            )}
            {(event.mode === "online" || event.mode === "hybrid") && event.streamUrl && (
              <div className="flex items-start gap-3">
                <VideoCameraIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-700">Online stream available</div>
                  <a href={event.streamUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline truncate block">{event.streamUrl}</a>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <UserGroupIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-700 mb-1">Capacity</div>
                <CapacityBar sold={sold} capacity={cap} />
              </div>
            </div>
          </div>

          {/* Organiser */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-700 mb-4">Organiser</h3>
            <button onClick={() => onViewOrganiser(event.organiser)} className="flex items-center gap-3 w-full hover:bg-slate-50 rounded-xl p-2 -m-2 transition-colors">
              <Avatar initials={event.organiser.avatar} size="md" />
              <div className="flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-800">{event.organiser.name}</span>
                  {event.organiser.verified && <CheckCircleSolid className="w-4 h-4 text-blue-500" />}
                </div>
                <div className="text-xs text-slate-500">₮{event.organiser.trustScore.toLocaleString()} trust · {event.organiser.eventsHosted} events hosted</div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Tickets */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <TicketIcon className="w-4 h-4 text-slate-400" /> Tickets
            </h3>
            <div className="space-y-2 mb-4">
              {event.tickets.map(t => (
                <button key={t.id}
                  onClick={() => event.rsvpOpen && t.sold < t.capacity && setSelectedTicket(t.id)}
                  disabled={t.sold >= t.capacity || !event.rsvpOpen}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedTicket === t.id ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-slate-300"} ${t.sold >= t.capacity || !event.rsvpOpen ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-800">{t.name}</span>
                    <span className={`text-sm font-bold ${t.price === 0 ? "text-emerald-600" : "text-violet-600"}`}>
                      {t.price === 0 ? "Free" : `£${t.price}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">{t.description}</p>
                  <div className="text-xs text-slate-400">{t.capacity - t.sold} remaining</div>
                </button>
              ))}
            </div>

            {rsvpDone ? (
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 text-center">
                <CheckCircleSolid className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="font-semibold text-emerald-800 text-sm">RSVP Confirmed!</div>
                <div className="text-xs text-emerald-600 mt-1">You'll receive a confirmation email</div>
              </div>
            ) : (
              <button onClick={handleRSVP}
                disabled={!event.rsvpOpen || (!selectedTicket)}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-all text-sm">
                {!event.rsvpOpen ? "RSVP Closed" : !selectedTicket ? "Select a ticket" : "RSVP Now"}
              </button>
            )}
            {!event.rsvpOpen && <p className="text-xs text-slate-400 text-center mt-2">Registration is currently closed</p>}
          </div>

          {/* Trust reward */}
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <StarSolid className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-amber-800 text-sm">Host & Earn Trust</span>
            </div>
            <p className="text-xs text-amber-700">Hosting this event earns the organiser ₮{event.trustReward} trust on FreeTrust.</p>
          </div>

          {/* Manage button (simulated as organiser) */}
          <button onClick={onManage} className="w-full py-2.5 border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-700 font-medium rounded-xl transition-all text-sm flex items-center justify-center gap-2">
            <UserGroupIcon className="w-4 h-4" /> Manage Attendees
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Event Form ────────────────────────────────────────────────────────

const defaultTicket = { name: "", price: "0", capacity: "50", description: "" };

function CreateEventForm({ onBack, onCreate }: { onBack: () => void; onCreate: (e: EventItem) => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    title: "", description: "", mode: "in-person", location: "", streamUrl: "",
    date: "", endDate: "", category: "Technology", tags: "", rsvpOpen: true,
    image: "🎪", tickets: [{ ...defaultTicket, name: "General Admission" }],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const EMOJIS = ["🎪", "🌐", "📚", "🎨", "🤝", "🖼️", "💻", "🎵", "🏃", "💡"];

  const set = (k: keyof FormData, v: FormData[keyof FormData]) => setForm(f => ({ ...f, [k]: v }));

  const updateTicket = (i: number, k: string, v: string) =>
    setForm(f => ({ ...f, tickets: f.tickets.map((t, idx) => idx === i ? { ...t, [k]: v } : t) }));

  const addTicket = () => setForm(f => ({ ...f, tickets: [...f.tickets, { ...defaultTicket }] }));
  const removeTicket = (i: number) => setForm(f => ({ ...f, tickets: f.tickets.filter((_, idx) => idx !== i) }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.date) e.date = "Start date is required";
    if (!form.endDate) e.endDate = "End date is required";
    if (form.mode !== "online" && !form.location.trim()) e.location = "Location is required";
    if (form.mode !== "in-person" && !form.streamUrl.trim()) e.streamUrl = "Stream URL is required";
    form.tickets.forEach((t, i) => { if (!t.name.trim()) e[`t${i}`] = "Ticket name required"; });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const newEvent: EventItem = {
      id: `e${Date.now()}`, title: form.title, description: form.description,
      mode: form.mode, location: form.location, streamUrl: form.streamUrl,
      date: form.date || new Date().toISOString(), endDate: form.endDate || new Date().toISOString(),
      category: form.category, image: form.image, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      status: "upcoming", trustReward: 15, rsvpOpen: form.rsvpOpen, maxCapacity: 100,
      organiser: ORGANISERS[0],
      tickets: form.tickets.map((t, i) => ({ id: `nt${i}`, name: t.name, price: parseFloat(t.price) || 0, capacity: parseInt(t.capacity) || 50, sold: 0, description: t.description })),
      attendees: [],
    };
    onCreate(newEvent);
    setSubmitted(true);
  };

  const fieldClass = (k: string) => `w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-colors focus:outline-none focus:border-violet-500 ${errors[k] ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`;

  if (submitted) return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Event Created!</h2>
      <p className="text-slate-500 mb-2">Your event has been published successfully.</p>
      <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-6">
        <StarSolid className="w-4 h-4 text-amber-500" />
        <span className="text-amber-800 font-semibold text-sm">You earned ₮15 trust for hosting!</span>
      </div>
      <div><button onClick={onBack} className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-colors">View All Events</button></div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors text-sm">
        <ChevronLeftIcon className="w-4 h-4" /> Back
      </button>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {["Basic Info", "Location & Time", "Tickets"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step > i + 1 ? "bg-emerald-500 text-white" : step === i + 1 ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-400"}`}>
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span className={`text-sm hidden sm:block ${step === i + 1 ? "text-violet-600 font-medium" : "text-slate-400"}`}>{s}</span>
              {i < 2 && <div className="w-8 sm:w-16 h-px bg-slate-200 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-800">Basic Information</h2>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Event Image</label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => set("image", e)}
                    className={`w-10 h-10 rounded-xl border-2 text-xl transition-all ${form.image === e ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-slate-300"}`}>{e}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Event Title *</label>
              <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Web3 Trust Summit 2025" className={fieldClass("title")} />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Description *</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={4} placeholder="Describe your event..." className={fieldClass("description")} />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Category</label>
                <select value={form.category} onChange={e => set("category", e.target.value)} className={fieldClass("category")}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tags (comma-separated)</label>
                <input value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="web3, trust, defi" className={fieldClass("tags")} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-800">Location & Time</h2>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Event Format</label>
              <div className="grid grid-cols-3 gap-2">
                {(["in-person", "online", "hybrid"] as EventMode[]).map(m => (
                  <button key={m} onClick={() => set("mode", m)}
                    className={`py-3 rounded-xl border-2 text-sm font-medium flex flex-col items-center gap-1 transition-all ${form.mode === m ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <span>{modeIcon(m)}</span>
                    <span className="capitalize">{m.replace("-", " ")}</span>
                  </button>
                ))}
              </div>
            </div>
            {(form.mode === "in-person" || form.mode === "hybrid") && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Venue / Address *</label>
                <div className="relative">
                  <MapPinIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Southbank Centre, London" className={`${fieldClass("location")} pl-9`} />
                </div>
                {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
              </div>
            )}
            {(form.mode === "online" || form.mode === "hybrid") && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Stream / Meeting URL *</label>
                <div className="relative">
                  <GlobeAltIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input value={form.streamUrl} onChange={e => set("streamUrl", e.target.value)} placeholder="https://zoom.us/j/..." className={`${fieldClass("streamUrl")} pl-9`} />
                </div>
                {errors.streamUrl && <p className="text-red-500 text-xs mt-1">{errors.streamUrl}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Start Date & Time *</label>
                <input type="datetime-local" value={form.date} onChange={e => set("date", e.target.value)} className={fieldClass("date")} />
                {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">End Date & Time *</label>
                <input type="datetime-local" value={form.endDate} onChange={e => set("endDate", e.target.value)} className={fieldClass("endDate")} />
                {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input type="checkbox" id="rsvp" checked={form.rsvpOpen} onChange={e => set("rsvpOpen", e.target.checked)} className="w-4 h-4 accent-violet-600" />
              <label htmlFor="rsvp" className="text-sm font-medium text-slate-700 cursor-pointer">Open RSVP / Registration</label>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Ticket Types</h2>
              <button onClick={addTicket} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-sm font-medium transition-colors">
                <PlusIcon className="w-4 h-4" /> Add Ticket
              </button>
            </div>
            <div className="space-y-4">
              {form.tickets.map((t, i) => (
                <div key={i} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                      <TicketIcon className="w-4 h-4 text-slate-400" /> Ticket {i + 1}
                    </span>
                    {form.tickets.length > 1 && (
                      <button onClick={() => removeTicket(i)} className="p-1 hover:bg-red-50 rounded-lg transition-colors">
                        <XMarkIcon className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Name *</label>
                      <input value={t.name} onChange={e => updateTicket(i, "name", e.target.value)} placeholder="General Admission" className={fieldClass(`t${i}`)} />
                      {errors[`t${i}`] && <p className="text-red-500 text-xs mt-1">{errors[`t${i}`]}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Price (£)</label>
                      <div className="relative">
                        <CurrencyDollarIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input type="number" min="0" value={t.price} onChange={e => updateTicket(i, "price", e.target.value)} placeholder="0" className={`${fieldClass("")} pl-9`} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Capacity</label>
                      <input type="number" min="1" value={t.capacity} onChange={e => updateTicket(i, "capacity", e.target.value)} className={fieldClass("")} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Description</label>
                      <input value={t.description} onChange={e => updateTicket(i, "description", e.target.value)} placeholder="What's included?" className={fieldClass("")} />
                    </div>
                  
