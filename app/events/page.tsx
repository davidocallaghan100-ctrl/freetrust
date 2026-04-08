"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPinIcon, CalendarIcon, UserGroupIcon, WifiIcon, PlusIcon } from "@heroicons/react/24/outline";
import { format, isToday, isThisWeek } from "date-fns";

type EventMode = "online" | "in-person";

interface Event {
  id: string;
  title: string;
  date: Date;
  location: string;
  mode: EventMode;
  price: number | null;
  rsvpCount: number;
  description: string;
  imageColor: string;
}

const MOCK_EVENTS: Event[] = [
  {
    id: "1",
    title: "Next.js 14 Deep Dive Workshop",
    date: new Date(),
    location: "San Francisco, CA",
    mode: "in-person",
    price: 49,
    rsvpCount: 128,
    description: "Explore the latest features in Next.js 14 including server actions and partial prerendering.",
    imageColor: "from-violet-500 to-purple-700",
  },
  {
    id: "2",
    title: "Open Source Contributor Meetup",
    date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    location: "Online",
    mode: "online",
    price: null,
    rsvpCount: 312,
    description: "Connect with open source maintainers and learn how to make your first meaningful PR.",
    imageColor: "from-emerald-400 to-teal-600",
  },
  {
    id: "3",
    title: "TypeScript Advanced Patterns",
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    location: "Online",
    mode: "online",
    price: 19,
    rsvpCount: 74,
    description: "Master conditional types, mapped types, and template literal types in TypeScript.",
    imageColor: "from-blue-400 to-indigo-600",
  },
  {
    id: "4",
    title: "Design Systems Summit 2025",
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    location: "New York, NY",
    mode: "in-person",
    price: 149,
    rsvpCount: 540,
    description: "A full-day summit exploring design tokens, component libraries, and cross-team collaboration.",
    imageColor: "from-pink-400 to-rose-600",
  },
  {
    id: "5",
    title: "Zustand & React State Patterns",
    date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    location: "Online",
    mode: "online",
    price: null,
    rsvpCount: 197,
    description: "Learn how to structure global state with Zustand for large-scale React applications.",
    imageColor: "from-amber-400 to-orange-600",
  },
  {
    id: "6",
    title: "AI-Assisted Development Hackathon",
    date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    location: "Austin, TX",
    mode: "in-person",
    price: null,
    rsvpCount: 88,
    description: "48-hour hackathon focused on building developer tooling powered by large language models.",
    imageColor: "from-cyan-400 to-sky-600",
  },
];

type Filter = "all" | "today" | "this-week" | "online" | "in-person";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "this-week" },
  { label: "Online", value: "online" },
  { label: "In Person", value: "in-person" },
];

function applyFilter(events: Event[], filter: Filter): Event[] {
  switch (filter) {
    case "today":
      return events.filter((e) => isToday(e.date));
    case "this-week":
      return events.filter((e) => isThisWeek(e.date, { weekStartsOn: 1 }));
    case "online":
      return events.filter((e) => e.mode === "online");
    case "in-person":
      return events.filter((e) => e.mode === "in-person");
    default:
      return events;
  }
}

function ModeBadge({ mode }: { mode: EventMode }) {
  return mode === "online" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">
      <WifiIcon className="h-3 w-3" />
      Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20">
      <MapPinIcon className="h-3 w-3" />
      In Person
    </span>
  );
}

function PriceBadge({ price }: { price: number | null }) {
  return price === null ? (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
      Free
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-500/20">
      ${price}
    </span>
  );
}

function EventCard({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      {/* Banner */}
      <div className={`h-28 bg-gradient-to-br ${event.imageColor} relative`}>
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <CalendarIcon className="h-20 w-20 text-white" />
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <ModeBadge mode={event.mode} />
          <PriceBadge price={event.price} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h2 className="line-clamp-2 text-base font-semibold text-slate-900 group-hover:text-violet-600 transition-colors leading-snug">
          {event.title}
        </h2>
        <p className="line-clamp-2 text-sm text-slate-500 leading-relaxed">
          {event.description}
        </p>

        <div className="mt-auto flex flex-col gap-1.5 pt-2 border-t border-slate-100">
          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <span>
              {isToday(event.date)
                ? `Today · ${format(event.date, "h:mm a")}`
                : format(event.date, "EEE, MMM d · h:mm a")}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPinIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">{event.location}</span>
          </div>

          {/* RSVP */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <UserGroupIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <span>
              <span className="font-medium text-slate-800">{event.rsvpCount.toLocaleString()}</span> going
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function EventsPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  const filtered = applyFilter(MOCK_EVENTS, activeFilter);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Events</h1>
            <p className="text-sm text-slate-500 mt-0.5">Discover and join events near you</p>
          </div>
          <Link
            href="/events/create"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Create Event</span>
            <span className="sm:hidden">Create</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filter Bar */}
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
                activeFilter === f.value
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Count */}
        <p className="mb-5 text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "event" : "events"}
          {activeFilter !== "all" && (
            <span>
              {" "}for{" "}
              <span className="font-semibold text-violet-600">
                {FILTERS.find((f) => f.value === activeFilter)?.label}
              </span>
            </span>
          )}
        </p>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <CalendarIcon className="mb-3 h-12 w-12 text-slate-300" />
            <p className="text-base font-semibold text-slate-700">No events found</p>
            <p className="mt-1 text-sm text-slate-400">Try a different filter or create a new event.</p>
            <Link
              href="/events/create"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Create Event
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

