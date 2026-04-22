"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  MapPinIcon,
  VideoCameraIcon,
  TicketIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
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

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: EventMode;
  ticketType: TicketType;
  price?: number;
  location?: string;
  meetingUrl?: string;
  attendees: number;
  maxAttendees: number;
  organiser: string;
  organiserAvatar: string;
  category: string;
  color: string;
  description: string;
}


const CATEGORY_COLORS: Record<string, string> = {
  Technology: "bg-violet-100 text-violet-700",
  Community: "bg-emerald-100 text-emerald-700",
  Finance: "bg-blue-100 text-blue-700",
  Education: "bg-amber-100 text-amber-700",
  Networking: "bg-pink-100 text-pink-700",
  Art: "bg-rose-100 text-rose-700",
  Governance: "bg-indigo-100 text-indigo-700",
};

type ViewMode = "month" | "week" | "list";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [rsvpedEvents, setRsvpedEvents] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<"all" | EventMode>("all");
  const [filterTicket, setFilterTicket] = useState<"all" | TicketType>("all");
  const [shareToast, setShareToast] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase
          .from("events")
          .select("*")
          .order("starts_at", { ascending: true });
        if (data && data.length > 0) {
          setEvents(data.map((e: Record<string, unknown>) => ({
            id: e.id as string,
            title: e.title as string,
            date: format(new Date(e.starts_at as string), "yyyy-MM-dd"),
            startTime: format(new Date(e.starts_at as string), "HH:mm"),
            endTime: e.ends_at ? format(new Date(e.ends_at as string), "HH:mm") : "",
            mode: (e.is_online ? "online" : "in-person") as EventMode,
            ticketType: ((e.ticket_price as number) > 0 ? "paid" : "free") as TicketType,
            price: (e.ticket_price as number) || undefined,
            location: (e.venue_name ?? e.venue_address ?? e.location_label) as string | undefined,
            meetingUrl: e.meeting_url as string | undefined,
            attendees: (e.attendee_count as number) ?? 0,
            maxAttendees: (e.max_attendees as number) ?? 100,
            organiser: (e.organiser_name as string) ?? "FreeTrust Member",
            organiserAvatar: ((e.organiser_name as string) ?? "FT").split(" ").map((w: string) => w[0]).join("").slice(0, 2),
            category: (e.category as string) ?? "General",
            color: "bg-blue-500",
            description: (e.description as string) ?? "",
          })));
        }
      } catch { /* use empty state */ }
    };
    fetchEvents();
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    let d = calStart;
    while (d <= calEnd) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [calStart, calEnd]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterMode !== "all" && e.mode !== filterMode) return false;
      if (filterTicket !== "all" && e.ticketType !== filterTicket) return false;
      return true;
    });
  }, [events, filterMode, filterTicket]);

  const getEventsForDay = (day: Date) =>
    filteredEvents.filter((e) => isSameDay(parseISO(e.date), day));

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    return filteredEvents
      .filter((e) => parseISO(e.date) >= today)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [filteredEvents]);

  const handleRsvp = (eventId: string) => {
    setRsvpedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const handleShare = (event: CalendarEvent) => {
    navigator.clipboard
      .writeText(`https://freetrust.app/events/${event.id}`)
      .catch(() => {});
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  const pct = (a: number, b: number) => Math.round((a / b) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <CalendarDaysIcon className="w-6 h-6 text-violet-600" />
              <h1 className="text-xl font-bold text-gray-900">Events Calendar</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Trust badge */}
              <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                <span className="text-amber-600 text-sm font-semibold">₮15</span>
                <span className="text-amber-500 text-xs">per event hosted</span>
              </div>
              <Link
                href="/events/create"
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Create Event</span>
                <span className="sm:hidden">New</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters + View Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode filter */}
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
              {(["all", "online", "in-person"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilterMode(m)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    filterMode === m
                      ? "bg-violet-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {m === "all" ? "All" : m === "online" ? "Online" : "In-Person"}
                </button>
              ))}
            </div>
            {/* Ticket filter */}
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
              {(["all", "free", "paid"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTicket(t)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
                    filterTicket === t
                      ? "bg-violet-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t === "all" ? "Any Price" : t}
                </button>
              ))}
            </div>
          </div>
          {/* View mode */}
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
            {(["month", "week", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  viewMode === v
                    ? "bg-violet-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Calendar or List */}
          <div className="lg:col-span-2">
            {viewMode === "list" ? (
              <ListView
                events={upcomingEvents}
                rsvpedEvents={rsvpedEvents}
                onRsvp={handleRsvp}
                onShare={handleShare}
                onSelect={setSelectedEvent}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Calendar Nav */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <button
                    onClick={() =>
                      setCurrentDate(
                        viewMode === "month"
                          ? subMonths(currentDate, 1)
                          : addDays(currentDate, -7)
                      )
                    }
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="text-center">
                    <h2 className="text-base font-semibold text-gray-900">
                      {viewMode === "month"
                        ? format(currentDate, "MMMM yyyy")
                        : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM")} – ${format(
                            endOfWeek(currentDate, { weekStartsOn: 1 }),
                            "d MMM yyyy"
                          )}`}
                    </h2>
                  </div>
                  <button
                    onClick={() =>
                      setCurrentDate(
                        viewMode === "month"
                          ? addMonths(currentDate, 1)
                          : addDays(currentDate, 7)
                      )
                    }
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div
                      key={d}
                      className="py-2 text-center text-xs font-medium text-gray-500"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Month Grid */}
                {viewMode === "month" && (
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day, idx) => {
                      const dayEvents = getEventsForDay(day);
                      const isSelected = selectedDate
                        ? isSameDay(day, selectedDate)
                        : false;
                      const inMonth = isSameMonth(day, currentDate);
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedDate(day)}
                          className={`min-h-[80px] p-1.5 border-b border-r border-gray-100 cursor-pointer transition-colors ${
                            inMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50"
                          } ${isSelected ? "ring-2 ring-inset ring-violet-400" : ""}`}
                        >
                          <div
                            className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${
                              isToday(day)
                                ? "bg-violet-600 text-white"
                                : inMonth
                                ? "text-gray-900"
                                : "text-gray-400"
                            }`}
                          >
                            {format(day, "d")}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 2).map((e) => (
                              <div
                                key={e.id}
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setSelectedEvent(e);
                                }}
                                className={`${e.color} text-white text-[10px] font-medium px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-90 transition-opacity`}
                              >
                                {e.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-[10px] text-gray-500 pl-1">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Week Grid */}
                {viewMode === "week" && (
                  <WeekView
                    currentDate={currentDate}
                    filteredEvents={filteredEvents}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    onSelectEvent={setSelectedEvent}
                  />
                )}
              </div>
            )}

            {/* Selected day events (only in month/week view) */}
            {viewMode !== "list" && selectedDate && selectedDayEvents.length > 0 && (
              <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {isToday(selectedDate)
                      ? "Today"
                      : format(selectedDate, "EEEE, d MMMM")}
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      {selectedDayEvents.length} event
                      {selectedDayEvents.length !== 1 ? "s" : ""}
                    </span>
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {selectedDayEvents.map((e) => (
                    <DayEventRow
                      key={e.id}
                      event={e}
                      rsvped={rsvpedEvents.has(e.id)}
                      onRsvp={handleRsvp}
                      onShare={handleShare}
                      onSelect={setSelectedEvent}
                    />
                  ))}
                </div>
              </div>
            )}
            {viewMode !== "list" && selectedDate && selectedDayEvents.length === 0 && (
              <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-6 text-center">
                <CalendarDaysIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  No events on {format(selectedDate, "d MMMM")}
                </p>
                <Link
                  href="/events/create"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium"
                >
                  <PlusIcon className="w-4 h-4" />
                  Create one
                </Link>
              </div>
            )}
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-5">
            {/* Stats */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">This Month</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Total Events",
                    value: filteredEvents.filter((e) =>
                      isSameMonth(parseISO(e.date), currentDate)
                    ).length,
                    color: "text-violet-600",
                  },
                  {
                    label: "Attending",
                    value: filteredEvents.filter(
                      (e) =>
                        rsvpedEvents.has(e.id) &&
                        isSameMonth(parseISO(e.date), currentDate)
                    ).length,
                    color: "text-emerald-600",
                  },
                  {
                    label: "Online",
                    value: filteredEvents.filter(
                      (e) =>
                        e.mode === "online" &&
                        isSameMonth(parseISO(e.date), currentDate)
                    ).length,
                    color: "text-blue-600",
                  },
                  {
                    label: "Free",
                    value: filteredEvents.filter(
                      (e) =>
                        e.ticketType === "free" &&
                        isSameMonth(parseISO(e.date), currentDate)
                    ).length,
                    color: "text-amber-600",
                  },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Events */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Upcoming</h3>
                <span className="text-xs text-gray-500">{upcomingEvents.length} events</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
                {upcomingEvents.slice(0, 8).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    className="w-full px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div
                      className={`${e.color} w-1 self-stretch rounded-full flex-shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {e.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">
                          {format(parseISO(e.date), "d MMM")} · {e.startTime}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            e.ticketType === "free"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {e.ticketType === "free" ? "Free" : `£${e.price}`}
                        </span>
                      </div>
                    </div>
                    {rsvpedEvents.has(e.id) && (
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                    )}
                  </button>
                ))}
              </div>
              {upcomingEvents.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-gray-500">No upcoming events</p>
                </div>
              )}
            </div>

            {/* Host CTA */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-base">Host an Event</h3>
                <div className="bg-white/20 rounded-full px-2.5 py-1 text-xs font-semibold">
                  Earn ₮15
                </div>
              </div>
              <p className="text-sm text-white/80 mb-4">
                Share your knowledge, grow your trust score, and connect with the
                community.
              </p>
              <Link
                href="/events/create"
                className="flex items-center justify-center gap-2 bg-white text-violet-700 font-medium text-sm px-4 py-2.5 rounded-xl hover:bg-violet-50 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Create Event
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          rsvped={rsvpedEvents.has(selectedEvent.id)}
          onRsvp={handleRsvp}
          onShare={handleShare}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Share Toast */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Link copied to clipboard!
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function DayEventRow({
  event,
  rsvped,
  onRsvp,
  onShare,
  onSelect,
}: {
  event: CalendarEvent;
  rsvped: boolean;
  onRsvp: (id: string) => void;
  onShare: (e: CalendarEvent) => void;
  onSelect: (e: CalendarEvent) => void;
}) {
  return (
    <div className="px-5 py-3 flex items-start gap-3">
      <div className={`${event.color} w-1 self-stretch rounded-full flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <button
          onClick={() => onSelect(event)}
          className="text-sm font-medium text-gray-900 hover:text-violet-700 truncate block w-full text-left"
        >
          {event.title}
        </button>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <ClockIcon className="w-3.5 h-3.5" />
            {event.startTime} – {event.endTime}
          </span>
          {event.mode === "online" ? (
            <span className="flex items-center gap-1 text-xs text-blue-600">
              <VideoCameraIcon className="w-3.5 h-3.5" />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-600">
              <MapPinIcon className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{event.location}</span>
            </span>
          )}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              event.ticketType === "free"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {event.ticketType === "free" ? "Free" : `£${event.price}`}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onShare(event)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Share"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
        <button
          onClick={() => onRsvp(event.id)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            rsvped
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "bg-violet-600 text-white hover:bg-violet-700"
          }`}
        >
          {rsvped ? "✓ Going" : "RSVP"}
        </button>
      </div>
    </div>
  );
}

function ListViewRow({
  event,
  rsvped,
  onRsvp,
  onShare,
  onSelect,
}: {
  event: CalendarEvent;
  rsvped: boolean;
  onRsvp: (id: string) => void;
  onShare: (e: CalendarEvent) => void;
  onSelect: (e: CalendarEvent) => void;
}) {
  const pct = Math.round((event.attendees / event.maxAttendees) * 100);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Date badge */}
        <div className={`${event.color} rounded-xl px-3 py-2 text-white text-center flex-shrink-0 min-w-[52px]`}>
          <div className="text-xs font-medium opacity-80">
            {format(parseISO(event.date), "MMM")}
          </div>
          <div className="text-xl font-bold leading-none">
            {format(parseISO(event.date), "d")}
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={() => onSelect(event)}
              className="text-base font-semibold text-gray-900 hover:text-violet-700 text-left transition-colors"
            >
              {event.title}
            </button>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => onShare(event)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button
                onClick={() => onRsvp(event.id)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  rsvped
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-violet-600 text-white hover:bg-violet-700"
                }`}
              >
                {rsvped ? "✓ Going" : "RSVP"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5" />
              {event.startTime} – {event.endTime}
            </span>
            {event.mode === "online" ? (
              <span className="flex items-center gap-1 text-blue-600">
                <VideoCameraIcon className="w-3.5 h-3.5" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <MapPinIcon className="w-3.5 h-3.5" />
                {event.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <UserGroupIcon className="w-3.5 h-3.5" />
              {event.attendees > 0 ? `${event.attendees}/${event.maxAttendees}` : 'Be first!'}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full font-medium ${
                event.ticketType === "free"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {event.ticketType === "free" ? "Free" : `£${event.price}`}
            </span>
          </div>
          {/* Capacity bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
              <div
                className={`${event.color} h-1.5 rounded-full transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{pct}% full</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListView({
  events,
  rsvpedEvents,
  onRsvp,
  onShare,
  onSelect,
}: {
  events: CalendarEvent[];
  rsvpedEvents: Set<string>;
  onRsvp: (id: string) => void;
  onShare: (e: CalendarEvent) => void;
  onSelect: (e: CalendarEvent) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => {
      const k = format(parseISO(e.date), "EEEE, d MMMM yyyy");
      if (!map[k]) map[k] = [];
      map[k].push(e);
    });
    return map;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <CalendarDaysIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No events match your filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, dayEvents]) => (
        <div key={date}>
          <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
            <span className="flex-1 h-px bg-gray-200" />
            {date}
            <span className="flex-1 h-px bg-gray-200" />
          </h3>
          <div className="space-y-3">
            {dayEvents.map((e) => (
              <ListViewRow
                key={e.id}
                event={e}
                rsvped={rsvpedEvents.has(e.id)}
                onRsvp={onRsvp}
                onShare={onShare}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeekView({
  currentDate,
  filteredEvents,
  selectedDate,
  onSelectDate,
  onSelectEvent,
}: {
  currentDate: Date;
  filteredEvents: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  onSelectEvent: (e: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid grid-cols-7">
      {days.map((day, idx) => {
        const dayEvents = filteredEvents.filter((e) =>
          isSameDay(parseISO(e.date), day)
        );
        const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
        return (
          <div
            key={idx}
            onClick={() => onSelectDate(day)}
            className={`min-h-[120px] p-2 border-r border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
              isSelected ? "ring-2 ring-inset ring-violet-400" : ""
            }`}
          >
            <div
              className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium mb-2 ${
                isToday(day) ? "bg-violet-600 text-white" : "text-gray-900"
              }`}
            >
              {format(day, "d")}
            </div>
            <div className="space-y-1">
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectEvent(e);
                  }}
                  className={`${e.color} text-white text-[10px] font-medium px-1.5 py-1 rounded cursor-pointer hover:opacity-90`}
                >
                  <div className="truncate">{e.title}</div>
                  <div className="opacity-80">{e.startTime}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventModal({
  event,
  rsvped,
  onRsvp,
  onShare,
  onClose,
}: {
  event: CalendarEvent;
  rsvped: boolean;
  onRsvp: (id: string) => void;
  onShare: (e: CalendarEvent) => void;
  onClose: () => void;
}) {
  const pct = Math.round((event.attendees / event.maxAttendees) * 100);
  const spotsLeft = event.maxAttendees - event.attendees;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header strip */}
        <div className={`${event.color} px-6 py-5 text-white`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium bg-white/20 backdrop-blur-sm`}
                >
                  {event.category}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-white/20">
                  {event.mode === "online" ? "Online" : "In-Person"}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    event.ticketType === "free"
                      ? "bg-emerald-500/80"
                      : "bg-amber-500/80"
                  }`}
                >
                  {event.ticketType === "free" ? "Free" : `£${event.price}`}
                </span>
              </div>
              <h2 className="text-xl font-bold leading-snug">{event.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Event details grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Date & Time</div>
              <div className="text-sm font-semibold text-gray-900">
                {format(parseISO(event.date), "d MMMM yyyy")}
              </div>
              <div className="text-sm text-gray-700">
                {event.startTime} – {event.endTime}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Location</div>
              {event.mode === "online" ? (
                <>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                    <VideoCameraIcon className="w-4 h-4" />
                    Online Event
                  </div>
                  {event.meetingUrl && (
                    <a
                      href={event.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                    >
                      Join link
                    </a>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <MapPinIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    In-Person
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">{event.location}</div>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1.5">About</h4>
            <p className="text-sm text-gray-600 leading-relaxed">{event.description}</p>
          </div>

          {/* Attendees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <UserGroupIcon className="w-4 h-4 text-gray-500" />
                Attendees
              </h4>
              <span className="text-xs text-gray-500">
                {event.attendees > 0 ? `${event.attendees} / ${event.maxAttendees}` : '✨ Be the first!'}
              </span>
            </div>
            <div className="bg-gray-100 rounded-full h-2 mb-1.5">
              <div
                className={`${event.color} h-2 rounded-full transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{pct}% full</span>
              <span
                className={
                  spotsLeft <= 5 ? "text-red-500 font-medium" : "text-emerald-600"
                }
              >
                {spotsLeft} spots left
              </span>
            </div>
          </div>

          {/* Organiser */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <div
              className={`${event.color} w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
            >
              {event.organiserAvatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500">Organised by</div>
              <div className="text-sm font-semibold text-gray-900">{event.organiser}</div>
            </div>
            <Link
              href={`/profile/${event.organiser.toLowerCase().replace(" ", "-")}`}
              className="text-xs text-violet-600 hover:text-violet-700 font-medium flex-shrink-0"
            >
              View Profile →
            </Link>
          </div>

          {/* Ticket info */}
          {event.ticketType === "paid" && event.price && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <TicketIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Paid Event — £{event.price} per ticket
                </div>
                <div className="text-xs text-gray-600">
                  Secure checkout after RSVP confirmation
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={() => onShare(event)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
          <button
            onClick={() => onRsvp(event.id)}
            disabled={!rsvped && spotsLeft === 0}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              rsvped
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : spotsLeft === 0
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : event.ticketType === "paid"
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "bg-violet-600 hover:bg-violet-700 text-white"
            }`}
          >
            {rsvped
              ? "✓ You're Going — Cancel RSVP"
              : spotsLeft === 0
              ? "Sold Out"
              : event.ticketType === "paid"
              ? `Get Ticket — £${event.price}`
              : "RSVP — Free"}
          </button>
        </div>
      </div>
    </div>
  );
}

