<<<FILE: app/components/events/EventsShared.tsx>>>
"use client";

import React, { useState, useCallback } from "react";
import { create } from "zustand";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, parseISO } from "date-fns";
import {
  CalendarIcon,
  MapPinIcon,
  VideoCameraIcon,
  TicketIcon,
  UserGroupIcon,
  ShareIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  CurrencyDollarIcon,
  StarIcon,
  LinkIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  BellIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";

// ─── Types ───────────────────────────────────────────────────────────────────

type EventMode = "online" | "inperson" | "hybrid";
type TicketType = { id: string; name: string; price: number; qty: number; sold: number; description: string };
type Attendee = { id: string; name: string; avatar: string; email: string; ticketType: string; rsvpDate: string; status: "confirmed" | "waitlist" | "cancelled" };
type OrganizerProfile = { id: string; name: string; avatar: string; bio: string; eventsHosted: number; trustEarned: number; rating: number; followers: number; verified: boolean };
type Event = {
  id: string; title: string; description: string; category: string; mode: EventMode;
  location: string; meetingUrl: string; startDate: string; endDate: string;
  startTime: string; endTime: string; timezone: string; coverImage: string;
  tickets: TicketType[]; attendees: Attendee[]; organizer: OrganizerProfile;
  tags: string[]; published: boolean; trustReward: number; maxAttendees: number;
  createdAt: string;
};
type View = "list" | "calendar" | "detail" | "create" | "attendees" | "organizer";
type Store = {
  events: Event[]; currentView: View; selectedEvent: Event | null;
  editingEvent: Event | null; trustBalance: number; notification: string;
  setView: (v: View) => void; setSelectedEvent: (e: Event | null) => void;
  setEditingEvent: (e: Event | null) => void; addEvent: (e: Event) => void;
  updateEvent: (e: Event) => void; deleteEvent: (id: string) => void;
  rsvpEvent: (eventId: string, attendee: Attendee) => void;
  cancelRsvp: (eventId: string, attendeeId: string) => void;
  addTrust: (amt: number) => void; setNotification: (msg: string) => void;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockOrganizer: OrganizerProfile = {
  id: "org1", name: "Alex Rivera", avatar: "AR", bio: "Community builder & tech enthusiast. Hosting events that bring people together around innovation and trust.",
  eventsHosted: 14, trustEarned: 210, rating: 4.8, followers: 342, verified: true,
};

const mockOrganizer2: OrganizerProfile = {
  id: "org2", name: "Sam Chen", avatar: "SC", bio: "Web3 educator and DeFi researcher. Passionate about decentralized futures.",
  eventsHosted: 7, trustEarned: 105, rating: 4.5, followers: 189, verified: false,
};

const mockAttendees: Attendee[] = [
  { id: "a1", name: "Jordan Lee", avatar: "JL", email: "jordan@example.com", ticketType: "General", rsvpDate: "2024-05-01", status: "confirmed" },
  { id: "a2", name: "Taylor Kim", avatar: "TK", email: "taylor@example.com", ticketType: "VIP", rsvpDate: "2024-05-02", status: "confirmed" },
  { id: "a3", name: "Morgan Davis", avatar: "MD", email: "morgan@example.com", ticketType: "General", rsvpDate: "2024-05-03", status: "waitlist" },
  { id: "a4", name: "Casey Wu", avatar: "CW", email: "casey@example.com", ticketType: "General", rsvpDate: "2024-05-04", status: "confirmed" },
  { id: "a5", name: "Riley Singh", avatar: "RS", email: "riley@example.com", ticketType: "Early Bird", rsvpDate: "2024-04-28", status: "confirmed" },
];

const mockEvents: Event[] = [
  {
    id: "e1", title: "Web3 Trust Summit 2024", description: "Join us for a full day exploring the future of decentralized trust systems. Featuring keynotes, workshops, and networking with builders shaping the next wave of the internet.\n\nTopics include: Zero-knowledge proofs, on-chain reputation, decentralized identity, and community governance.",
    category: "Technology", mode: "hybrid", location: "San Francisco Convention Center, 747 Howard St", meetingUrl: "https://meet.freetrust.io/summit2024",
    startDate: "2024-06-15", endDate: "2024-06-15", startTime: "09:00", endTime: "18:00", timezone: "PST",
    coverImage: "tech", tickets: [
      { id: "t1", name: "Early Bird", price: 0, qty: 50, sold: 50, description: "Free early access ticket" },
      { id: "t2", name: "General", price: 25, qty: 200, sold: 143, description: "Standard admission" },
      { id: "t3", name: "VIP", price: 75, qty: 30, sold: 18, description: "VIP access with exclusive networking dinner" },
    ],
    attendees: mockAttendees, organizer: mockOrganizer, tags: ["web3", "trust", "blockchain", "networking"],
    published: true, trustReward: 15, maxAttendees: 280, createdAt: "2024-04-20",
  },
  {
    id: "e2", title: "DeFi for Everyone: A Beginner's Workshop", description: "New to decentralized finance? This hands-on workshop walks you through the basics — wallets, protocols, yield strategies, and how to stay safe.",
    category: "Education", mode: "online", location: "", meetingUrl: "https://meet.freetrust.io/defi101",
    startDate: "2024-06-22", endDate: "2024-06-22", startTime: "14:00", endTime: "16:00", timezone: "EST",
    coverImage: "education", tickets: [
      { id: "t4", name: "Free Access", price: 0, qty: 500, sold: 287, description: "Free online attendance" },
    ],
    attendees: mockAttendees.slice(0, 3), organizer: mockOrganizer2, tags: ["defi", "beginner", "workshop"],
    published: true, trustReward: 15, maxAttendees: 500, createdAt: "2024-05-01",
  },
  {
    id: "e3", title: "Community Governance Roundtable", description: "An intimate discussion on how decentralized communities can make better decisions. Bring your questions and experiences.",
    category: "Community", mode: "inperson", location: "FreeTrust HQ, 123 Market St, NYC",
    meetingUrl: "", startDate: "2024-07-05", endDate: "2024-07-05", startTime: "18:00", endTime: "20:00", timezone: "EST",
    coverImage: "community", tickets: [
      { id: "t5", name: "Member", price: 0, qty: 40, sold: 23, description: "Free for FreeTrust members" },
      { id: "t6", name: "Guest", price: 10, qty: 20, sold: 8, description: "Open to non-members" },
    ],
    attendees: mockAttendees.slice(1, 4), organizer: mockOrganizer, tags: ["governance", "community", "dao"],
    published: true, trustReward: 15, maxAttendees: 60, createdAt: "2024-05-10",
  },
];

// ─── Zustand Store ────────────────────────────────────────────────────────────

const useStore = create<Store>((set) => ({
  events: mockEvents,
  currentView: "list",
  selectedEvent: null,
  editingEvent: null,
  trustBalance: 120,
  notification: "",
  setView: (v) => set({ currentView: v }),
  setSelectedEvent: (e) => set({ selectedEvent: e }),
  setEditingEvent: (e) => set({ editingEvent: e }),
  addEvent: (e) => set((s) => ({ events: [...s.events, e] })),
  updateEvent: (e) => set((s) => ({ events: s.events.map((x) => (x.id === e.id ? e : x)) })),
  deleteEvent: (id) => set((s) => ({ events: s.events.filter((x) => x.id !== id) })),
  rsvpEvent: (eventId, attendee) =>
    set((s) => ({
      events: s.events.map((e) =>
        e.id === eventId ? { ...e, attendees: [...e.attendees, attendee] } : e
      ),
    })),
  cancelRsvp: (eventId, attendeeId) =>
    set((s) => ({
      events: s.events.map((e) =>
        e.id === eventId
          ? { ...e, attendees: e.attendees.map((a) => a.id === attendeeId ? { ...a, status: "cancelled" as const } : a) }
          : e
      ),
    })),
  addTrust: (amt) => set((s) => ({ trustBalance: s.trustBalance + amt })),
  setNotification: (msg) => set({ notification: msg }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  Technology: "bg-blue-100 text-blue-700", Education: "bg-purple-100 text-purple-700",
  Community: "bg-green-100 text-green-700", Finance: "bg-yellow-100 text-yellow-700",
  Art: "bg-pink-100 text-pink-700", Health: "bg-teal-100 text-teal-700",
};

const coverGradients: Record<string, string> = {
  tech: "from-blue-600 via-indigo-600 to-purple-700",
  education: "from-purple-600 via-violet-600 to-fuchsia-700",
  community: "from-green-600 via-emerald-600 to-teal-700",
  finance: "from-yellow-500 via-amber-500 to-orange-600",
  default: "from-gray-700 via-gray-600 to-gray-800",
};

const uid = () => Math.random().toString(36).slice(2, 10);

const fmtDate = (d: string) => {
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
};

const totalSold = (e: Event) => e.attendees.filter((a) => a.status === "confirmed").length;
const totalCapacity = (e: Event) => e.tickets.reduce((s, t) => s + t.qty, 0);
const isFree = (e: Event) => e.tickets.every((t) => t.price === 0);

function Avatar({ initials, size = "md", color = "indigo" }: { initials: string; size?: "sm" | "md" | "lg" | "xl"; color?: string }) {
  const sz = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base", xl: "w-16 h-16 text-xl" }[size];
  return (
    <div className={`${sz} rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info" }) {
  const v = {
    default: "bg-gray-100 text-gray-700", success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700", danger: "bg-red-100 text-red-700", info: "bg-blue-100 text-blue-700",
  }[variant];
  return <span className={`${v} text-xs font-medium px-2 py-0.5 rounded-full`}>{children}</span>;
}

function ModeIcon({ mode }: { mode: EventMode }) {
  if (mode === "online") return <VideoCameraIcon className="w-4 h-4" />;
  if (mode === "inperson") return <MapPinIcon className="w-4 h-4" />;
  return <GlobeAltIcon className="w-4 h-4" />;
}

function Notification({ msg, onClose }: { msg: string; onClose: () => void }) {
  if (!msg) return null;
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl max-w-sm">
      <CheckIcon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm font-medium">{msg}</span>
      <button onClick={onClose} className="ml-auto"><XMarkIcon className="w-4 h-4" /></button>
    </div>
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({ event, onClick }: { event: Event; onClick: () => void }) {
  const grad = coverGradients[event.coverImage] ?? coverGradients.default;
  const confirmed = totalSold(event);
  const cap = totalCapacity(event);
  const pct = Math.round((confirmed / cap) * 100);

  return (
    <div onClick={onClick} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group">
      <div className={`h-36 bg-gradient-to-br ${grad} relative flex items-end p-4`}>
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_white,_transparent)]" />
        <div className="flex gap-2 flex-wrap relative z-10">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryColors[event.category] ?? "bg-gray-100 text-gray-700"}`}>
            {event.category}
          </span>
          {isFree(event) && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Free</span>}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
          <ModeIcon mode={event.mode} />
          <span className="capitalize">{event.mode === "inperson" ? "In Person" : event.mode}</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2">{event.title}</h3>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>{fmtDate(event.startDate)}</span>
          <span>·</span>
          <ClockIcon className="w-3.5 h-3.5" />
          <span>{event.startTime}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3 truncate">
          <ModeIcon mode={event.mode} />
          <span className="truncate">{event.mode === "online" ? "Online Event" : event.location}</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Avatar initials={event.organizer.avatar} size="sm" />
            <span className="text-xs text-gray-600">{event.organizer.name}</span>
            {event.organizer.verified && <CheckIcon className="w-3.5 h-3.5 text-indigo-500" />}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <UserGroupIcon className="w-3.5 h-3.5" />
            <span>{confirmed}/{cap}</span>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{pct}% filled</span>
          <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <span>₮{event.trustReward} trust</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView() {
  const { events, setSelectedEvent, setView } = useStore();
  const [month, setMonth] = useState(new Date(2024, 5, 1));
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const firstDow = startOfMonth(month).getDay();

  const eventsOnDay = (d: Date) => events.filter((e) => {
    try { return isSameDay(parseISO(e.startDate), d); } catch { return false; }
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button onClick={() => setMonth((m) => subMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="font-semibold text-gray-900">{format(month, "MMMM yyyy")}</h2>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRightIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-100">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px] border-r border-b border-gray-50" />
        ))}
        {days.map((day) => {
          const dayEvents = eventsOnDay(day);
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className="min-h-[80px] border-r border-b border-gray-50 p-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${today ? "bg-indigo-600 text-white" : "text-gray-700"}`}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <button key={e.id} onClick={() => { setSelectedEvent(e); setView("detail"); }}
                    className="w-full text-left text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded px-1 py-0.5 truncate transition-colors">
                    {e.title}
                  </button>
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-xs text-gray-400 pl-1">+{dayEvents.length - 2} more</span>
                )}
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

  const copy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Share Event</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4 line-clamp-1 font-medium">{event.title}</p>
        <div className="flex gap-2 mb-5">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-600 truncate">{url}</div>
          <button onClick={copy} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            {copied ? <><CheckIcon className="w-4 h-4" />Copied</> : <><LinkIcon className="w-4 h-4" />Copy</>}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <EnvelopeIcon className="w-5 h-5" />, label: "Email", color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
            { icon: <GlobeAltIcon className="w-5 h-5" />, label: "Twitter", color: "bg-sky-50 text-sky-600 hover:bg-sky-100" },
            { icon: <ArrowUpTrayIcon className="w-5 h-5" />, label: "More", color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" },
          ].map((s) => (
            <button key={s.label} className={`${s.color} flex flex-col items-center gap-2 p-3 rounded-xl transition-colors text-sm font-medium`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RSVP Modal ───────────────────────────────────────────────────────────────

function RsvpModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const { rsvpEvent, setNotification } = useStore();
  const [selectedTicket, setSelectedTicket] = useState(event.tickets[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const ticket = event.tickets.find((t) => t.id === selectedTicket);
  const available = ticket ? ticket.qty - ticket.sold : 0;

  const submit = () => {
    if (!name || !email || !ticket) return;
    const attendee: Attendee = {
      id: uid(), name, avatar: name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      email, ticketType: ticket.name, rsvpDate: format(new Date(), "yyyy-MM-dd"),
      status: available > 0 ? "confirmed" : "waitlist",
    };
    rsvpEvent(event.id, attendee);
    setNotification(`🎉 You're registered for "${event.title}"!`);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Register for Event</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        {done ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-8 h-8 text-emerald-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">You're registered!</h4>
            <p className="text-sm text-gray-500 mb-2">Confirmation sent to {email}</p>
            {ticket && ticket.price === 0 && (
              <span className="inline-flex items-center gap-1 text-sm text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full">
                Free event — no payment needed
              </span>
            )}
            <button onClick={onClose} className="mt-5 block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors">Done</button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Ticket</label>
              <div className="space-y-2">
                {event.tickets.map((t) => {
                  const avail = t.qty - t.sold;
                  return (
                    <label key={t.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${selectedTicket === t.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"} ${avail === 0 ? "opacity-50 cursor-not-allowed" : ""}`}>
                      <input type="radio" name="ticket" value={t.id} checked={selectedTicket === t.id} onChange={() => avail > 0 && setSelectedTicket(t.id)} className="text-indigo-600" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{t.name}</span>
                          <span className="text-sm font-bold text-gray-900">{t.price === 0 ? "Free" : `$${t.price}`}</span>
                        </div>
                        <p className="text-xs text-gray-500">{t.description}</p>
                      </div>
                      {avail === 0 && <Badge variant="danger">Sold Out</Badge>}
                      {avail > 0 && avail < 10 && <Badge variant="warning">{avail} left</Badge>}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            {ticket && ticket.price > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 mb-4 flex justify-between items-center">
                <span className="text-sm text-gray-600">Total</span>
                <span className="font-bold text-gray-900">${ticket.price}</span>
              </div>
            )}
            <button onClick={submit} disabled={!name || !email} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
              {ticket?.price === 0 ? "Register for Free" : `Pay $${ticket?.price ?? 0}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Event Detail ─────────────────────────────────────────────────────────────

function EventDetail() {
  const { selectedEvent, setView, setSelectedEvent } = useStore();
  const [showShare, setShowShare] = useState(false);
  const [showRsvp, setShowRsvp] = useState(false);

  if (!selectedEvent) return null;
  const e = selectedEvent;
  const grad = coverGradients[e.coverImage] ?? coverGradients.default;
  const confirmed = totalSold(e);
  const cap = totalCapacity(e);
  const pct = Math.round((confirmed / cap) * 100);

  return (
    <div>
      {showShare && <ShareModal event={e} onClose={() => setShowShare(false)} />}
      {showRsvp && <RsvpModal event={e} onClose={() => setShowRsvp(false)} />}

      <button onClick={() => { setView("list"); setSelectedEvent(null); }} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors">
        <ChevronLeftIcon className="w-4 h-4" /> Back to Events
      </button>

      <div className={`h-52 bg-gradient-to-br ${grad} rounded-2xl relative flex items-end p-6 mb-6`}>
        <div className="absolute inset-0 rounded-2xl opacity-10 bg-[radial-gradient(ellipse_at_top_right,_white,_transparent)]" />
        <div className="absolute top-4 right-4 flex gap-2">
          <button onClick={() => setShowShare(true)} className="flex items-center gap-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white text-sm px-3 py-2 rounded-xl transition-colors">
            <ShareIcon className="w-4 h-4" /> Share
          </button>
          <button className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2 rounded-xl transition-colors">
            <BellIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="relative z-10">
          <div className="flex gap-2 flex-wrap mb-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryColors[e.category] ?? "bg-gray-100 text-gray-700"}`}>{e.category}</span>
            {isFree(e) && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Free Event</span>}
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight max-w-xl">{e.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: <CalendarIcon className="w-5 h-5 text-indigo-500" />, label: "Date", value: `${fmtDate(e.startDate)}${e.endDate !== e.startDate ? ` – ${fmtDate(e.endDate)}` : ""}` },
              { icon: <ClockIcon className="w-5 h-5 text-indigo-500" />, label: "Time", value: `${e.startTime} – ${e.endTime} ${e.timezone}` },
              { icon: <ModeIcon mode={e.mode} />, label: "Format", value: e.mode === "inperson" ? "In Person" : e.mode.charAt(0).toUpperCase() + e.mode.slice(1) },
              { icon: <UserGroupIcon className="w-5 h-5 text-indigo-500" />, label: "Attendees", value: `${confirmed} / ${cap} registered` },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                  <p className="text-sm font-medium text-gray-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Location */}
          {(e.location || e.meetingUrl) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MapPinIcon className="w-5 h-5 text-indigo-500" /> Location
              </h3>
              {e.mode !== "online" && e.location && (
                <p className="text-sm text-gray-700 mb-2">{e.location}</p>
              )}
              {e.meetingUrl && (
                <a href={e.meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  <VideoCameraIcon className="w-4 h-4" /> Join Online Meeting
                </a>
              )}
            </div>
          )}

          {/* Description */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">About This Event</h3>
            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{e.description}</div>
            <div className="flex flex-wrap gap-2 mt-4">
              {e.tags.map((t) => (
                <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">#{t}</span>
              ))}
            </div>
          </div>

          {/* Tickets */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TicketIcon className="w-5 h-5 text-indigo-500" /> Tickets
            </h3>
            <div className="space-y-3">
              {e.tickets.map((t) => {
                const avail = t.qty - t.sold;
                const tPct = Math.round((t.sold / t.qty) * 100);
                return (
                  <div key={t.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                        <p className="text-xs text-gray-500">{t.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{t.price === 0 ? "Free" : `$${t.price}`}</p>
                        <p className="text-xs text-gray-500">{avail > 0 ? `${avail} left` : "Sold out"}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${tPct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{t.sold}/{t.qty} sold</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Register CTA */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-4">
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Spots filled</span>
                <span className="font-medium text-gray-900">{pct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{cap - confirmed} spots remaining</p>
            </div>
            <button onClick={() => setShowRsvp(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors mb-3">
              Register Now
            </button>
            <button onClick={() => setShowShare(true)} className="w-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
              <ShareIcon className="w-4 h-4" /> Share Event
            </button>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-xl p-2.5">
              <span>Host earns</span>
              <span className="font-bold">₮{e.trustReward}</span>
              <span>trust</span>
            </div>
          </div>

          {/* Organizer Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Organizer</h3>
            <div className="flex items-center gap-3 mb-3">
              <Avatar initials={e.organizer.avatar} size="lg" />
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-gray-900 text-sm">{e.organizer.name}</p>
                  {e.organizer.verified && <CheckIcon className="w-4 h-4 text-indigo-500" />}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    i < Math.floor(e.organizer.rating)
                      ? <StarSolid key={i} className="w-3 h-3 text-amber-400" />
                      : <StarIcon key={i} className="w-3 h-3 text-gray-300" />
                  ))}
                  <span className="ml-1">{e.organizer.rating}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-3 leading-relaxed">{e.organizer.bio}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Events", value: e.organizer.eventsHosted },
                { label: "Trust", value: `₮${e.organizer.trustEarned}` },
                { label: "Followers", value: e.organizer.followers },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-2">
                  <p className="font-bold text-gray-900 text-sm">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setView("organizer")} className="mt-3 w-full border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 font-medium py-2 rounded-xl transition-colors">
              View Profile
            </button>
          </div>

          {/* Attendees Preview */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Attendees</h3>
              <button onClick={() => setView("attendees")} className="text-xs text-indigo-600 hover:text-indigo-700">View all</button>
            </div>
            <div className="flex -space-x-2 mb-3">
              {e.attendees.filter((a) => a.status === "confirmed").slice(0, 6).map((a) => (
                <div key={a.id} className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white">
                  {a.avatar}
                </div>
              ))}
              {confirmed > 6 && (
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center border-2 border-white">
                  +{confirmed - 6}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">{confirmed} confirmed attendees</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Attendee Management ──────────────────────────────────────────────────────

function AttendeeManager() {
  const { selectedEvent, setView, cancelRsvp } = useStore();
  const [filter, setFilter] = useState<"all" | "confirmed" | "waitlist" | "cancelled">("all");
  const [search, setSearch] = useState("");

  if (!selectedEvent) return null;
  const e = selectedEvent;

  const filtered = e.attendees.filter((a) => {
    const matchFilter = filter === "all" || a.status === filter;
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    all: e.attendees.length,
    confirmed: e.attendees.filter((a) => a.status === "confirmed").length,
    waitlist: e.attendees.filter((a) => a.status === "waitlist").length,
    cancelled: e.attendees.filter((a) => a.status === "cancelled").length,
  };

  return (
    <div>
      <button onClick={() => setView("detail")} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors">
        <ChevronLeftIcon className="w-4 h-4" /> Back to Event
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">Attendee Management</h2>
            <p className="text-sm text-gray-500">{e.title}</p>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <ArrowUpTrayIcon className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {(["all", "confirmed", "waitlist", "cancelled"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`p-3 rounded-xl border text-center transition-all ${filter === s ? "border-indigo-500 bg-indigo-50" : "border-gray-100 hover:border-gray-200"}`}>
              <p className="font-bold text-gray-900">{counts[s]}</p>
              <p className="text-xs text-gray-500 capitalize">{s}</p>
            </button>
          ))}
        </div>

        {/* Search */}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search attendees..." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Attendee", "Ticket", "RSVP Date", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={a.avatar} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.name}</p>
                        <p className="text-xs text-gray-500">{a.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-600">{a.ticketType}</td>
                  <td className="py-3 pr-4 text-sm text-gray-600">{fmtDate(a.rsvpDate)}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={a.status === "confirmed" ? "success" : a.status === "waitlist" ? "warning" : "danger"}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="py-3">
                    {a.status !== "cancelled" && (
                      <button onClick={() => cancelRsvp(e.id, a.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">No attendees found</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Organizer Profile ────────────────────────────────────────────────────────

function OrganizerProfileView() {
  const { selectedEvent, events, setView, setSelectedEvent } = useStore();
  const organizer = selectedEvent?.organizer ?? mockOrganizer;
  const orgEvents = events.filter((e) => e.organizer.id === organizer.id);

  return (
    <div>
      <button onClick={() => setView(selectedEvent ? "detail" : "list")} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors">
        <ChevronLeftIcon className="w-4 h-4" /> Back
      </button>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 text-white mb-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_bottom_left,_white,_transparent)]" />
          <div className="relative z-10 flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/20 text-white text-2xl font-bold flex items-center justify-center flex-shrink-0">
              {organizer.avatar}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold">{organizer.name}</h2>
                {organizer.verified && (
                  <span className="flex items-center gap-1 bg-white/20 text-white text-xs px-2.5 py-1 rounded-full">
                    <CheckIcon className="w-3.5 h-3.5" /> Verified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  i < Math.floor(organizer.rating)
                    ? <StarSolid key={i} className="w-4 h-4 text-amber-300" />
                    : <StarIcon key={i} className="w-4 h-4 text-white/40" />
                ))}
                <span className="text-sm ml-1">{organizer.rating} rating</span>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">{organizer.bio}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { icon: <CalendarIcon className="w-5 h-5 text-indigo-500" />, label: "Events Hosted", value: organizer.eventsHosted },
            { icon: <span className="text-amber-500 font-bold text-base">₮</span>, label: "Trust Earned", value: `₮${organizer.trustEarned}` },
            { icon: <UserGroupIcon className="w-5 h-5 text-indigo-500" />, label: "Followers", value: organizer.followers },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">{s.icon}</div>
              <div>
                <p className="font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Events by organizer */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Events by {organizer.name}</h3>
          {orgEvents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No events found</p>
          ) : (
            <div className="space-y-3">
              {orgEvents.map((ev) => (
                <div key={ev.id} onClick={() => { setSelectedEvent(ev); setView("detail"); }}
                  className="flex items-center gap-4 p-3 border border-gray-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer transition-all">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${coverGradients[ev.coverImage] ?? coverGradients.default} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                    <p className="text-xs text-gray-500">{fmtDate(ev.startDate)} · {ev.mode === "inperson" ? "In Person" : ev.mode}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={ev.published ? "success" : "default"}>{ev.published ? "Live" : "Draft"}</Badge>
                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Event Form ─────────────────────────────────────────────────

const emptyTicket = (): TicketType => ({ id: uid(), name: "", price: 0, qty: 100, sold: 0, description: "" });

function EventForm() {
  const { addEvent, updateEvent, editingEvent, setView, addTrust, setNotification, setEditingEvent } = useStore();
  const isEditing = !!editingEvent;

  const [form, setForm] = useState<Omit<Event, "id" | "attendees" | "organizer" | "createdAt">>({
    title: editingEvent?.title ?? "",
    description: editingEvent?.description ?? "",
    category: editingEvent?.category ?? "Technology",
    mode: editingEvent?.mode ?? "inperson",
    location: editingEvent?.location ?? "",
    meetingUrl: editingEvent?.meetingUrl ?? "",
    startDate: editingEvent?.startDate ?? "",
    endDate: editingEvent?.endDate ?? "",
    startTime: editingEvent?.startTime ?? "09:00",
    endTime: editingEvent?.endTime ?? "17:00",
    timezone: editingEvent?.timezone ?? "EST",
    coverImage: editingEvent?.coverImage ?? "default",
    tickets: editingEvent?.tickets ?? [emptyTicket()],
    tags: editingEvent?.tags ?? [],
    published: editingEvent?.published ?? false,
    trustReward: 15,
    maxAttendees: editingEvent?.maxAttendees ?? 100,
  });

  const [tagInput, setTagInput] = useState("");
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addTicket = () => set("tickets", [...form.tickets, emptyTicket()]);
  const removeTicket = (id: string) => set("tickets", form.tickets.filter((t) => t.id !== id));
  const updateTicket = (id: string, k: keyof TicketType, v: string | number) =>
    set("tickets", form.tickets.map((t) => (t.id === id ? { ...t, [k]: v } : t)));

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !form.tags.includes(tag)) { set("tags", [...form.tags, tag]); setTagInput(""); }
  };
  const removeTag = (t: string) => set("tags", form.tags.filter((x) => x !== t));

  const submit = (publish: boolean) => {
    const event: Event = {
      ...form, published: publish, id: editingEvent?.id ?? uid(),
      attendees: editingEvent?.attendees ?? [], organizer: editingEvent?.organizer ?? mockOrganizer,
      createdAt: editingEvent?.createdAt ?? format(new Date(), "yyyy-MM-dd"),
    };
    if (isEditing) { updateEvent(event); setEditingEvent(null); }
    else {
      addEvent(event);
      if (publish) { addTrust(15); setNotification("🎉 Event published! You earned ₮15 trust for hosting."); }
    }
    setView("list");
  };

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
  const labelCls = "block text-sm font-medium text-gray-700 
