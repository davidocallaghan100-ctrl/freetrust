"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  MapPinIcon,
  ComputerDesktopIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";

type EventMode = "online" | "in-person";
type TicketType = "free" | "paid";

interface CalEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime: string;
  mode: EventMode;
  ticketType: TicketType;
  price?: number;
  location?: string;
  attendees: number;
  maxAttendees?: number;
  category: string;
  organiser: string;
  color: string;
}

const MOCK_EVENTS: CalEvent[] = [
  {
    id: "1",
    title: "Web3 Trust Summit",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    endTime: "12:00",
    mode: "online",
    ticketType: "free",
    attendees: 142,
    maxAttendees: 200,
    category: "Technology",
    organiser: "FreeTrust Team",
    color: "bg-violet-500",
  },
  {
    id: "2",
    title: "Community Meetup",
    date: format(addDays(new Date(), 3), "yyyy-MM-dd"),
    time: "18:00",
    endTime: "20:30",
    mode: "in-person",
    ticketType: "free",
    location: "London, UK",
    attendees: 34,
    maxAttendees: 50,
    category: "Networking",
    organiser: "Alice Johnson",
    color: "bg-emerald-500",
  },
  {
    id: "3",
    title: "DeFi Workshop",
    date: format(addDays(new Date(), 3), "yyyy-MM-dd"),
    time: "14:00",
    endTime: "16:00",
    mode: "online",
    ticketType: "paid",
    price: 25,
    attendees: 67,
    maxAttendees: 100,
    category: "Finance",
    organiser: "CryptoEd",
    color: "bg-blue-500",
  },
  {
    id: "4",
    title: "NFT Art Exhibition",
    date: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    time: "11:00",
    endTime: "17:00",
    mode: "in-person",
    ticketType: "paid",
    price: 15,
    location: "Manchester, UK",
    attendees: 89,
    maxAttendees: 150,
    category: "Art",
    organiser: "Digital Arts Co.",
    color: "bg-pink-500",
  },
  {
    id: "5",
    title: "Blockchain Dev Hackathon",
    date: format(addDays(new Date(), 12), "yyyy-MM-dd"),
    time: "09:00",
    endTime: "21:00",
    mode: "in-person",
    ticketType: "free",
    location: "Birmingham, UK",
    attendees: 55,
    maxAttendees: 80,
    category: "Technology",
    organiser: "HackChain",
    color: "bg-orange-500",
  },
  {
    id: "6",
    title: "Trust Score Q&A",
    date: format(addDays(new Date(), -4), "yyyy-MM-dd"),
    time: "15:00",
    endTime: "16:00",
    mode: "online",
    ticketType: "free",
    attendees: 201,
    category: "Education",
    organiser: "FreeTrust Team",
    color: "bg-violet-500",
  },
  {
    id: "7",
    title: "DAO Governance Forum",
    date: format(addDays(new Date(), 18), "yyyy-MM-dd"),
    time: "17:00",
    endTime: "19:00",
    mode: "online",
    ticketType: "free",
    attendees: 78,
    maxAttendees: 300,
    category: "Governance",
    organiser: "OpenDAO",
    color: "bg-teal-500",
  },
  {
    id: "8",
    title: "Crypto Investor Dinner",
    date: format(addDays(new Date(), 21), "yyyy-MM-dd"),
    time: "19:00",
    endTime: "22:00",
    mode: "in-person",
    ticketType: "paid",
    price: 75,
    location: "London, UK",
    attendees: 28,
    maxAttendees: 40,
    category: "Networking",
    organiser: "InvestDAO",
    color: "bg-amber-500",
  },
];

const CATEGORIES = ["All", "Technology", "Finance", "Networking", "Art", "Education", "Governance"];
const MODES: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Online", value: "online" },
  { label: "In Person", value: "in-person" },
];

type ViewMode = "month" | "week" | "list";

function getDaysInView(currentDate: Date, view: "month" | "week"): Date[] {
  if (view === "week") {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = start;
  while (d <= end) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterMode, setFilterMode] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  const filteredEvents = useMemo(() => {
    return MOCK_EVENTS.filter((e) => {
      if (filterCategory !== "All" && e.category !== filterCategory) return false;
      if (filterMode !== "all" && e.mode !== filterMode) return false;
      return true;
    });
  }, [filterCategory, filterMode]);

  const eventsForDay = (day: Date) =>
    filteredEvents.filter((e) => isSameDay(parseISO(e.date), day));

  const eventsForSelectedDay = selectedDay ? eventsForDay(selectedDay) : [];

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return filteredEvents
      .filter((e) => parseISO(e.date) >= now)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [filteredEvents]);

  const days = useMemo(
    () => (view !== "list" ? getDaysInView(currentDate, view) : []),
    [currentDate, view]
  );

  const navigate = (dir: 1 | -1) => {
    if (view === "month") setCurrentDate((d) => (dir === 1 ? addMonths(d, 1) : subMonths(d, 1)));
    else if (view === "week")
      setCurrentDate((d) => addDays(d, dir * 7));
  };

  const headerLabel =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : view === "week"
      ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM")} – ${format(
          endOfWeek(currentDate, { weekStartsOn: 1 }),
          "d MMM yyyy"
        )}`
      : "Upcoming Events";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <CalendarDaysIcon className="w-7 h-7 text-violet-400" />
            <h1 className="text-xl font-bold">Events Calendar</h1>
            <span className="text-xs bg-violet-900/50 text-violet-300 border border-violet-700 rounded-full px-2 py-0.5">
              Host &amp; earn ₮15
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
              {(["month", "week", "list"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                    view === v
                      ? "bg-violet-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <Link
              href="/events/create"
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              New Event
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="lg:w-64 flex-shrink-0 space-y-5">
          {/* Mini Today Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Today</p>
            <p className="text-2xl font-bold text-white">{format(new Date(), "d")}</p>
            <p className="text-sm text-gray-400">{format(new Date(), "EEEE, MMMM yyyy")}</p>
            <div className="mt-3 flex gap-2 flex-wrap">
              <span className="text-xs bg-violet-900/40 text-violet-300 border border-violet-800 rounded-md px-2 py-0.5">
                {MOCK_EVENTS.filter((e) => isSameDay(parseISO(e.date), new Date())).length} today
              </span>
              <span className="text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-800 rounded-md px-2 py-0.5">
                {
                  MOCK_EVENTS.filter(
                    (e) => parseISO(e.date) >= new Date()
                  ).length
                }{" "}
                upcoming
              </span>
            </div>
          </div>

          {/* Category Filter */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Category</p>
            <div className="flex flex-col gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCategory(c)}
                  className={`text-left text-sm px-3 py-1.5 rounded-lg transition-all ${
                    filterCategory === c
                      ? "bg-violet-700/40 text-violet-300 font-medium"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Filter */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Format</p>
            <div className="flex flex-col gap-1">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setFilterMode(m.value)}
                  className={`text-left text-sm px-3 py-1.5 rounded-lg transition-all ${
                    filterMode === m.value
                      ? "bg-violet-700/40 text-violet-300 font-medium"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trust Reward Banner */}
          <div className="bg-gradient-to-br from-violet-900/50 to-indigo-900/50 border border-violet-700/50 rounded-xl p-4">
            <p className="text-sm font-semibold text-violet-300 mb-1">Host &amp; Earn</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Organise a verified event and earn{" "}
              <span className="text-amber-400 font-bold">₮15 Trust</span> added to
              your profile.
            </p>
            <Link
              href="/events/create"
              className="mt-3 block text-center text-xs bg-violet-600 hover:bg-violet-500 text-white font-medium py-2 rounded-lg transition-colors"
            >
              Create Event
            </Link>
          </div>
        </aside>

        {/* Main Calendar Area */}
        <div className="flex-1 min-w-0">
          {/* Calendar Nav */}
          {view !== "list" && (
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-white">{headerLabel}</h2>
              <button
                onClick={() => navigate(1)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Month / Week Grid */}
          {view !== "list" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Day Labels */}
              <div className="grid grid-cols-7 border-b border-gray-800">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const dayEvents = eventsForDay(day);
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const todayFlag = isToday(day);

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(day)}
                      className={`min-h-[72px] p-1.5 border-b border-r border-gray-800 text-left transition-colors relative group
                        ${isSelected ? "bg-violet-900/30" : "hover:bg-gray-800/60"}
                        ${i % 7 === 6 ? "border-r-0" : ""}
                      `}
                    >
                      <span
                        className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full mb-1
                          ${todayFlag ? "bg-violet-600 text-white" : ""}
                          ${!todayFlag && isCurrentMonth ? "text-gray-200" : ""}
                          ${!todayFlag && !isCurrentMonth ? "text-gray-600" : ""}
                        `}
                      >
                        {format(day, "d")}
                      </span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(ev);
                            }}
                            className={`truncate text-xs px-1 py-0.5 rounded font-medium text-white cursor-pointer hover:opacity-80 ${ev.color}`}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-500 pl-1">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* List View */}
          {view === "list" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-white mb-4">Upcoming Events</h2>
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <CalendarDaysIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No events found</p>
                </div>
              ) : (
                upcomingEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} onClick={() => setSelectedEvent(ev)} />
                ))
              )}
            </div>
          )}

          {/* Selected Day Events (month/week view) */}
          {view !== "list" && selectedDay && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                {isToday(selectedDay) ? "Today" : format(selectedDay, "EEEE, d MMMM yyyy")}
                {eventsForSelectedDay.length > 0 && (
                  <span className="ml-2 text-xs bg-gray-800 text-gray-400 rounded-full px-2 py-0.5">
                    {eventsForSelectedDay.length} event{eventsForSelectedDay.length !== 1 ? "s" : ""}
                  </span>
                )}
              </h3>
              {eventsForSelectedDay.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl py-10 text-center text-gray-600">
                  <CalendarDaysIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No events on this day</p>
                  <Link
                    href="/events/create"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Create one
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {eventsForSelectedDay.map((ev) => (
                    <EventCard key={ev.id} event={ev} onClick={() => setSelectedEvent(ev)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

function EventCard({ event, onClick }: { event: CalEvent; onClick: () => void }) {
  const spotsLeft =
    event.maxAttendees != null ? event.maxAttendees - event.attendees : null;
  const fillPct =
    event.maxAttendees != null
      ? Math.round((event.attendees / event.maxAttendees) * 100)
      : null;

  return (
    <div
      onClick={onClick}
      className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 cursor-pointer transition-all hover:bg-gray-800/60 group"
    >
      <div className="flex items-start gap-3">
        <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${event.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 bg-gray-800 rounded px-2 py-0.5">
              {event.category}
            </span>
            <span
              className={`text-xs rounded px-2 py-0.5 flex items-center gap-1 ${
                event.mode === "online"
                  ? "bg-blue-900/40 text-blue-300"
                  : "bg-emerald-900/40 text-emerald-300"
              }`}
            >
              {event.mode === "online" ? (
                <ComputerDesktopIcon className="w-3 h-3" />
              ) : (
                <MapPinIcon className="w-3 h-3" />
              )}
              {event.mode === "online" ? "Online" : "In Person"}
            </span>
            <span
              className={`text-xs rounded px-2 py-0.5 flex items-center gap-1 ${
                event.ticketType === "free"
                  ? "bg-gray-800 text-gray-400"
                  : "bg-amber-900/40 text-amber-300"
              }`}
            >
              <TicketIcon className="w-3 h-3" />
              {event.ticketType === "free" ? "Free" : `£${event.price}`}
            </span>
          </div>
          <h4 className="font-semibold text-white group-hover:text-violet-300 transition-colors truncate">
            {event.title}
          </h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5" />
              {format(parseISO(event.date), "d MMM")} · {event.time}–{event.endTime}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPinIcon className="w-3.5 h-3.5" />
                {event.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <UserGroupIcon className="w-3.5 h-3.5" />
              {event.attendees}
              {event.maxAttendees != null ? `/${event.maxAttendees}` : ""} attending
            </span>
          </div>
          {fillPct != null && (
            <div className="mt-2">
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${event.color}`}
                  style={{ width: `${Math.min(fillPct, 100)}%` }}
                />
              </div>
              {spotsLeft != null && spotsLeft <= 10 && spotsLeft > 0 && (
                <p className="text-xs text-amber-400 mt-1">{spotsLeft} spots left</p>
              )}
              {spotsLeft === 0 && (
                <p className="text-xs text-red-400 mt-1">Fully booked</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const [rsvpDone, setRsvpDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const spotsLeft =
    event.maxAttendees != null ? event.maxAttendees - event.attendees : null;

  const handleShare = () => {
    const url = `${window.location.origin}/events/${event.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRSVP = () => setRsvpDone(true);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color banner */}
        <div className={`h-2 w-full ${event.color}`} />

        <div className="p-6">
          {/* Top badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs bg-gray-800 text-gray-400 rounded px-2 py-0.5">
              {event.category}
            </span>
            <span
              className={`text-xs rounded px-2 py-0.5 flex items-center gap-1 ${
                event.mode === "online"
                  ? "bg-blue-900/40 text-blue-300"
                  : "bg-emerald-900/40 text-emerald-300"
              }`}
            >
              {event.mode === "online" ? (
                <ComputerDesktopIcon className="w-3 h-3" />
              ) : (
                <MapPinIcon className="w-3 h-3" />
              )}
              {event.mode === "online" ? "Online" : "In Person"}
            </span>
            <span
              className={`text-xs rounded px-2 py-0.5 flex items-center gap-1 ${
                event.ticketType === "free"
                  ? "bg-gray-800 text-gray-400"
                  : "bg-amber-900/40 text-amber-300"
              }`}
            >
              <TicketIcon className="w-3 h-3" />
              {event.ticketType === "free" ? "Free" : `£${event.price}`}
            </span>
          </div>

          <h2 className="text-xl font-bold text-white mb-4">{event.title}</h2>

          <div className="space-y-2.5 mb-5">
            <InfoRow
              icon={<ClockIcon className="w-4 h-4" />}
              label={`${format(parseISO(event.date), "EEEE, d MMMM yyyy")} · ${event.time} – ${event.endTime}`}
            />
            {event.location && (
              <InfoRow
                icon={<MapPinIcon className="w-4 h-4" />}
                label={event.location}
              />
            )}
            <InfoRow
              icon={<UserGroupIcon className="w-4 h-4" />}
              label={
                event.maxAttendees != null
                  ? `${event.attendees} / ${event.maxAttendees} attending${
                      spotsLeft != null && spotsLeft <= 10
                        ? ` · ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`
                        : ""
                    }`
                  : `${event.attendees} attending`
              }
            />
          </div>

          {/* Organiser */}
          <div className="flex items-center gap-3 bg-gray-800/60 rounded-xl px-4 py-3 mb-5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {event.organiser[0]}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Organised by</p>
              <p className="text-sm font-semibold text-white truncate">{event.organiser}</p>
            </div>
            <Link
              href="/events/organiser"
              className="ml-auto text-xs text-violet-400 hover:text-violet-300 whitespace-nowrap"
            >
              View profile →
            </Link>
          </div>

          {/* Capacity bar */}
          {event.maxAttendees != null && (
            <div className="mb-5">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Capacity</span>
                <span>
                  {Math.round((event.attendees / event.maxAttendees) * 100)}% full
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${event.color}`}
                  style={{
                    width: `${Math.min(
                      (event.attendees / event.maxAttendees) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {rsvpDone ? (
              <div className="flex-1 flex items-center justify-center gap-2 bg-emerald-800/40 border border-emerald-700 text-emerald-300 text-sm font-medium py-2.5 rounded-xl">
                ✓ You're going!
              </div>
            ) : spotsLeft === 0 ? (
              <div className="flex-1 flex items-center justify-center bg-gray-800 text-gray-500 text-sm font-medium py-2.5 rounded-xl">
                Fully Booked
              </div>
            ) : (
              <button
                onClick={handleRSVP}
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {event.ticketType === "paid"
                  ? `Buy Ticket · £${event.price}`
                  : "RSVP — Free"}
              </button>
            )}
            <button
              onClick={handleShare}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium rounded-xl transition-colors"
            >
              {copied ? "Copied!" : "Share"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-gray-400">
      <span className="text-gray-500 mt-0.5 flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

