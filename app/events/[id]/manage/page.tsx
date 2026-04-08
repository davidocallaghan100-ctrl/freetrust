"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  UserGroupIcon,
  TicketIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ShareIcon,
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  EllipsisVerticalIcon,
  BellIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";

type TicketType = {
  id: string;
  name: string;
  price: number;
  total: number;
  sold: number;
  description: string;
};

type Attendee = {
  id: string;
  name: string;
  email: string;
  phone: string;
  ticketType: string;
  ticketId: string;
  status: "confirmed" | "pending" | "cancelled" | "checked_in";
  registeredAt: string;
  amount: number;
  avatar: string;
  initials: string;
};

type Event = {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate: string;
  location: string;
  isOnline: boolean;
  meetingLink?: string;
  coverImage: string;
  status: "draft" | "published" | "cancelled" | "completed";
  ticketTypes: TicketType[];
  attendees: Attendee[];
  organiser: {
    name: string;
    avatar: string;
    trustScore: number;
    eventsHosted: number;
  };
  trustEarned: number;
  category: string;
  tags: string[];
  maxAttendees: number;
  createdAt: string;
};

const MOCK_EVENT: Event = {
  id: "evt_001",
  title: "FreeTrust Community Summit 2025",
  description:
    "Join us for our annual community summit where we bring together trust-builders, innovators, and community leaders. Learn, network, and grow your reputation in the FreeTrust ecosystem.",
  date: "2025-03-15T09:00:00",
  endDate: "2025-03-15T18:00:00",
  location: "The Hub, 123 Innovation Street, London, EC2A 4BX",
  isOnline: false,
  coverImage: "",
  status: "published",
  category: "Conference",
  tags: ["community", "networking", "trust", "innovation"],
  maxAttendees: 250,
  createdAt: "2025-01-10T10:00:00",
  trustEarned: 15,
  organiser: {
    name: "Alex Morgan",
    avatar: "",
    trustScore: 847,
    eventsHosted: 12,
  },
  ticketTypes: [
    {
      id: "tt_001",
      name: "General Admission",
      price: 0,
      total: 150,
      sold: 98,
      description: "Access to all general sessions and networking areas",
    },
    {
      id: "tt_002",
      name: "Premium Pass",
      price: 49,
      total: 75,
      sold: 61,
      description: "All general access plus VIP lounge and workshop sessions",
    },
    {
      id: "tt_003",
      name: "VIP Experience",
      price: 149,
      total: 25,
      sold: 19,
      description:
        "Full premium access plus speaker meet & greet and exclusive dinner",
    },
  ],
  attendees: [
    {
      id: "att_001",
      name: "Sarah Chen",
      email: "sarah.chen@example.com",
      phone: "+44 7700 900001",
      ticketType: "Premium Pass",
      ticketId: "TKT-2025-001",
      status: "confirmed",
      registeredAt: "2025-01-15T14:30:00",
      amount: 49,
      avatar: "",
      initials: "SC",
    },
    {
      id: "att_002",
      name: "James Wilson",
      email: "j.wilson@example.com",
      phone: "+44 7700 900002",
      ticketType: "General Admission",
      ticketId: "TKT-2025-002",
      status: "confirmed",
      registeredAt: "2025-01-16T09:15:00",
      amount: 0,
      avatar: "",
      initials: "JW",
    },
    {
      id: "att_003",
      name: "Priya Patel",
      email: "priya.p@example.com",
      phone: "+44 7700 900003",
      ticketType: "VIP Experience",
      ticketId: "TKT-2025-003",
      status: "checked_in",
      registeredAt: "2025-01-17T11:45:00",
      amount: 149,
      avatar: "",
      initials: "PP",
    },
    {
      id: "att_004",
      name: "Marcus Thompson",
      email: "m.thompson@example.com",
      phone: "+44 7700 900004",
      ticketType: "General Admission",
      ticketId: "TKT-2025-004",
      status: "pending",
      registeredAt: "2025-01-18T16:20:00",
      amount: 0,
      avatar: "",
      initials: "MT",
    },
    {
      id: "att_005",
      name: "Elena Rodriguez",
      email: "e.rodriguez@example.com",
      phone: "+44 7700 900005",
      ticketType: "Premium Pass",
      ticketId: "TKT-2025-005",
      status: "cancelled",
      registeredAt: "2025-01-19T10:00:00",
      amount: 49,
      avatar: "",
      initials: "ER",
    },
    {
      id: "att_006",
      name: "David Kim",
      email: "d.kim@example.com",
      phone: "+44 7700 900006",
      ticketType: "VIP Experience",
      ticketId: "TKT-2025-006",
      status: "confirmed",
      registeredAt: "2025-01-20T13:30:00",
      amount: 149,
      avatar: "",
      initials: "DK",
    },
    {
      id: "att_007",
      name: "Amara Osei",
      email: "a.osei@example.com",
      phone: "+44 7700 900007",
      ticketType: "General Admission",
      ticketId: "TKT-2025-007",
      status: "confirmed",
      registeredAt: "2025-01-21T08:45:00",
      amount: 0,
      avatar: "",
      initials: "AO",
    },
    {
      id: "att_008",
      name: "Tom Bradley",
      email: "t.bradley@example.com",
      phone: "+44 7700 900008",
      ticketType: "Premium Pass",
      ticketId: "TKT-2025-008",
      status: "confirmed",
      registeredAt: "2025-01-22T15:10:00",
      amount: 49,
      avatar: "",
      initials: "TB",
    },
  ],
};

type Tab = "overview" | "attendees" | "tickets" | "settings";
type StatusFilter = "all" | "confirmed" | "pending" | "cancelled" | "checked_in";

const statusColors: Record<Attendee["status"], string> = {
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  checked_in: "bg-blue-100 text-blue-700 border-blue-200",
};

const statusLabels: Record<Attendee["status"], string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  cancelled: "Cancelled",
  checked_in: "Checked In",
};

export default function ManageEventPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Event>(MOCK_EVENT);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const eventUrl = `https://freetrust.app/events/${event.id}`;

  const totalSold = event.ticketTypes.reduce((s, t) => s + t.sold, 0);
  const totalCapacity = event.ticketTypes.reduce((s, t) => s + t.total, 0);
  const totalRevenue = event.attendees
    .filter((a) => a.status !== "cancelled")
    .reduce((s, a) => s + a.amount, 0);
  const confirmedCount = event.attendees.filter((a) => a.status === "confirmed").length;
  const checkedInCount = event.attendees.filter((a) => a.status === "checked_in").length;
  const pendingCount = event.attendees.filter((a) => a.status === "pending").length;
  const cancelledCount = event.attendees.filter((a) => a.status === "cancelled").length;

  const filteredAttendees = event.attendees.filter((a) => {
    const matchSearch =
      !searchQuery ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.ticketId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Failed to copy link", "error");
    }
  };

  const handleStatusChange = (attendeeId: string, newStatus: Attendee["status"]) => {
    setEvent((prev) => ({
      ...prev,
      attendees: prev.attendees.map((a) =>
        a.id === attendeeId ? { ...a, status: newStatus } : a
      ),
    }));
    setOpenMenuId(null);
    showToast(`Attendee status updated to ${statusLabels[newStatus]}`);
  };

  const handleBulkAction = (action: "confirm" | "cancel" | "email") => {
    if (action === "email") {
      showToast(`Email sent to ${selectedAttendees.size} attendee(s)`);
      setSelectedAttendees(new Set());
      return;
    }
    const newStatus: Attendee["status"] = action === "confirm" ? "confirmed" : "cancelled";
    setEvent((prev) => ({
      ...prev,
      attendees: prev.attendees.map((a) =>
        selectedAttendees.has(a.id) ? { ...a, status: newStatus } : a
      ),
    }));
    showToast(`${selectedAttendees.size} attendee(s) ${action === "confirm" ? "confirmed" : "cancelled"}`);
    setSelectedAttendees(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedAttendees.size === filteredAttendees.length) {
      setSelectedAttendees(new Set());
    } else {
      setSelectedAttendees(new Set(filteredAttendees.map((a) => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedAttendees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Ticket Type", "Ticket ID", "Status", "Amount", "Registered"];
    const rows = filteredAttendees.map((a) => [
      a.name, a.email, a.phone, a.ticketType, a.ticketId,
      statusLabels[a.status], `£${a.amount}`,
      format(parseISO(a.registeredAt), "dd/MM/yyyy HH:mm"),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title}-attendees.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Attendee list exported");
  };

  const eventStatusColors = {
    published: "bg-emerald-100 text-emerald-700",
    draft: "bg-gray-100 text-gray-600",
    cancelled: "bg-red-100 text-red-700",
    completed: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircleIcon className="w-4 h-4" />
          ) : (
            <ExclamationTriangleIcon className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Share Event</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Share this event with your network and grow your audience.
            </p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
              <span className="flex-1 text-sm text-gray-600 truncate">{eventUrl}</span>
              <button
                onClick={handleCopy}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  copied
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Twitter / X", color: "bg-black text-white" },
                { label: "LinkedIn", color: "bg-blue-700 text-white" },
                { label: "Facebook", color: "bg-blue-600 text-white" },
                { label: "WhatsApp", color: "bg-emerald-500 text-white" },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    showToast(`Shared on ${s.label}`);
                    setShowShareModal(false);
                  }}
                  className={`${s.color} rounded-xl py-2.5 text-sm font-medium hover:opacity-90 transition-opacity`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <TrashIcon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Cancel Event?</h3>
                <p className="text-xs text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Cancelling this event will notify all {totalSold} registered attendees and issue
              refunds where applicable.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Keep Event
              </button>
              <button
                onClick={() => {
                  setEvent((prev) => ({ ...prev, status: "cancelled" }));
                  setShowDeleteModal(false);
                  showToast("Event cancelled. Attendees notified.", "error");
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Cancel Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/events"
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-gray-900 truncate max-w-xs">
                    {event.title}
                  </h1>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${eventStatusColors[event.status]}`}
                  >
                    {event.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {format(parseISO(event.date), "EEE, d MMM yyyy")} ·{" "}
                  {format(parseISO(event.date), "HH:mm")} –{" "}
                  {format(parseISO(event.endDate), "HH:mm")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShareModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ShareIcon className="w-4 h-4" />
                Share
              </button>
              <Link
                href={`/events/${event.id}/edit`}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
            {(["overview", "attendees", "tickets", "settings"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === t
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t}
                {t === "attendees" && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                    {event.attendees.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Trust Earned Banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white flex items-center justify-between">
              <div>
                <p className="text-indigo-200 text-sm font-medium">Trust Earned for Hosting</p>
                <p className="text-3xl font-bold mt-1">₮{event.trustEarned}</p>
                <p className="text-indigo-200 text-xs mt-1">
                  Awarded upon successful event completion
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <StarIcon className="w-7 h-7 text-yellow-300" />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Registrations",
                  value: totalSold,
                  sub: `of ${totalCapacity} capacity`,
                  icon: UserGroupIcon,
                  color: "text-indigo-600",
                  bg: "bg-indigo-50",
                },
                {
                  label: "Total Revenue",
                  value: `£${totalRevenue.toLocaleString()}`,
                  sub: "from paid tickets",
                  icon: CurrencyDollarIcon,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                },
                {
                  label: "Confirmed",
                  value: confirmedCount + checkedInCount,
                  sub: `${checkedInCount} checked in`,
                  icon: CheckCircleIcon,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                },
                {
                  label: "Pending / Cancelled",
                  value: pendingCount,
                  sub: `${cancelledCount} cancelled`,
                  icon: ExclamationTriangleIcon,
                  color: "text-amber-600",
                  bg: "bg-amber-50",
                },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Capacity Progress */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Capacity Overview</h3>
                <span className="text-sm text-gray-500">
                  {Math.round((totalSold / totalCapacity) * 100)}% full
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${(totalSold / totalCapacity) * 100}%` }}
                />
              </div>
              <div className="space-y-3">
                {event.ticketTypes.map((tt) => (
                  <div key={tt.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{tt.name}</span>
                        <span className="text-xs text-gray-500">
                          {tt.sold}/{tt.total}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 rounded-full"
                          style={{ width: `${(tt.sold / tt.total) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-16 text-right">
                      {tt.price === 0 ? "Free" : `£${tt.price}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Event Details</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {format(parseISO(event.date), "EEEE, d MMMM yyyy")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(parseISO(event.date), "HH:mm")} –{" "}
                        {format(parseISO(event.endDate), "HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    {event.isOnline ? (
                      <GlobeAltIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <MapPinIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {event.isOnline ? "Online Event" : event.location}
                      </p>
                      {event.meetingLink && (
                        <p className="text-xs text-indigo-600 mt-0.5 truncate">{event.meetingLink}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TicketIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{event.category}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {event.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Organiser Profile */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Organiser Profile</h3>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {event.organiser.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{event.organiser.name}</p>
                    <p className="text-xs text-gray-500">Event Organiser</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-indigo-600">₮{event.organiser.trustScore}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Trust Score</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{event.organiser.eventsHosted}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Events Hosted</p>
                  </div>
                </div>
                <Link
                  href="/profile"
                  className="mt-3 block text-center text-sm text-indigo-600 font-medium hover:text-indigo-700"
                >
                  View Full Profile →
                </Link>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Send Update",
                    icon: BellIcon,
                    color: "text-blue-600 bg-blue-50",
                    action: () => showToast("Update sent to all attendees"),
                  },
                  {
                    label: "Export List",
                    icon: ArrowDownTrayIcon,
                    color: "text-emerald-600 bg-emerald-50",
                    action: handleExportCSV,
                  },
                  {
                    label: "Share Event",
                    icon: ShareIcon,
                    color: "text-purple-600 bg-purple-50",
                    action: () => setShowShareModal(true),
                  },
                  {
                    label: "Edit Event",
                    icon: PencilIcon,
                    color: "text-amber-600 bg-amber-50",
                    action: () => router.push(`/events/${event.id}/edit`),
                  },
                ].map((a) => (
                  <button
                    key={a.label}
                    onClick={a.action}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                  >
                    <div className={`w-10 h-10 rounded-xl ${a.color} flex items-center justify-center`}>
                      <a.icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ATTENDEES TAB */}
        {activeTab === "attendees" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search attendees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                  >
                    <option value="all">All Status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="checked_in">Checked In</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedAttendees.size > 0 && (
                <div className="mt-3 flex items-center gap-2 p-3 bg-indigo-50 rounded-xl">
                  <span className="text-sm font-medium text-indigo-700">
                    {selectedAttendees.size} selected
                  </span>
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={() => handleBulkAction("confirm")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium hover:bg-emerald-200"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => handleBulkAction("email")}
                      className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200"
                    >
                      Email
                    </button>
                    <button
                      onClick={() => handleBulkAction("cancel")}
                      className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Status Summary Chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(["all", "confirmed", "checked_in", "pending", "cancelled"] as StatusFilter[]).map((s) => {
                const counts: Record<StatusFilter, number> = {
                  all: event.attendees.length,
                  confirmed: confirmedCount,
                  checked_in: checkedInCount,
                  pending: pendingCount,
                  cancelled: cancelledCount,
                };
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      statusFilter === s
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {s === "all" ? "All" : s === "checked_in" ? "Checked In" : s.charAt(0).toUpperCase() + s.slice(1)}{" "}
                    ({counts[s]})
                  </button>
                );
              })}
            </div>

            {/* Attendee List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedAttendees.size === filteredAttendees.length && filteredAttendees.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <div>Attendee</div>
                <div>Ticket</div>
                <div>Status</div>
                <div>Amount</div>
                <div>Actions</div>
              </div>

              {filteredAttendees.length === 0 ? (
                <div className="py-12 text-center">
                  <UserGroupIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No attendees found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredAttendees.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/50 transition-colors ${
                        selectedAttendees.has(a.id) ? "bg-indigo-50/30" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAttendees.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                      />
                      {/* Avatar + Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {a.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                          <p className="text-xs text-gray-500 truncate">{a.email}</p>
                          <p className="text-xs text-gray-400 md:hidden">{a.ticketId}</p>
                        </div>
                      </div>
                      {/* Ticket */}
                      <div className="hidden md:block min-w-0 flex-1">
                        <p className="text-sm text-gray-700 truncate">{a.ticketType}</p>
                        <p className="text-xs text-gray-400">{a.ticketId}</p>
                      </div>
                      {/* Status */}
                      <div className="hidden md:block flex-shrink-0">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[a.status]}`}
                        >
                          {statusLabels[a.status]}
                        </span>
                      </div>
                      {/* Amount */}
                      <div className="hidden md:block flex-shrink-0 w-16 text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {a.amount === 0 ? "Free" : `£${a.amount}`}
                        </p>
                        <p className="text-xs text-gray-400">
                          {format(parseISO(a.registeredAt), "d MMM")}
                        </p>
                      </div>
                      {/* Mobile Status */}
                      <div className="md:hidden flex-shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[a.status]}`}
                        >
                          {statusLabels[a.status]}
                        </span>
                      </div>
                      {/* Menu */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <EllipsisVerticalIcon className="w-4 h-4" />
                        </button>
                        {openMenuId === a.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 z-20 py-1 overflow-hidden">
                            <button
                              onClick={() => handleStatusChange(a.id, "confirmed")}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                              Confirm
                            </button>
                            <button
                              onClick={() => handleStatusChange(a.id, "checked_in")}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <CheckIcon className="w-4 h-4 text-blue-500" />
                              Check In
                            </button>
                            <button
                              onClick={() => {
                                showToast(`Email sent to ${a.name}`);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <EnvelopeIcon className="w-4 h-4 text-indigo-500" />
                              Send Email
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={() => handleStatusChange(a.id, "cancelled")}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <XCircleIcon className="w-4 h-4" />
                              Cancel RSVP
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredAttendees.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Showing {filteredAttendees.length} of {event.attendees.length} attendees
                  </p>
                  <p className="text-xs text-gray-500">
                    Page 1 of 1
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TICKETS TAB */}
        {activeTab === "tickets" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Ticket Types</h2>
              <button
                onClick={() => showToast("Add ticket type coming soon")}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                + Add Ticket Type
              </button>
            </div>

            {event.ticketTypes.map((tt) => {
              const pct = Math.round((tt.sold / tt.total) * 100);
              const revenue = tt.price * tt.sold;
              return (
                <div key={tt.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{tt.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{tt.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">
                        {tt.price === 0 ? "Free" : `£${tt.price}`}
                      </p>
                      <button
                        onClick={() => showToast(`Editing ${tt.name}`)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 mt-0.5"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{tt.sold}</p>
                      <p className="text-xs text-gray-500">Sold</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{tt.total - tt.sold}</p>
                      <p className="text-xs text-gray-500">Available</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-emerald-600">
                        {tt.price === 0 ? "—" : `£${revenue}`}
                      </p>
                      <p className="text-xs text-gray-500">Revenue</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500">Sales progress</span>
                      <span className="text-xs font-medium text-gray-700">{pct}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 90
                            ? "bg-red-500"
                            : pct >= 70
                            ? "bg-amber-500"
                            : "bg-indigo-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {pct >= 90 && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                        Almost sold out!
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Revenue Summary */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100">
              <h3 className="font-semibold text-gray-900 mb-4">Revenue Summary</h3>
              <div className="space-y-2">
                {event.ticketTypes
                  .filter((t) => t.price > 0)
                  .map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t.name} × {t.sold}</span>
                      <span className="font-medium text-gray-900">£{t.price * t.sold}</span>
                    </div>
                  ))}
                <div className="border-t border-emerald-200 pt-2 mt-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total Revenue</span>
                  <span className="text-xl font-bold text-emerald-600">
                    £{totalRevenue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Event Settings</h3>
              <div className="space-y-4">
                {[
                  {
                    label: "Event Status",
                    value: event.status,
                    type: "select",
                    options: ["draft", "published", "cancelled"],
                  },
                  { label: "Max Attendees", value: String(event.maxAttendees), type: "number" },
                  { label: "Event Category", value: event.category, type: "text" },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {f.label}
                    </label>
                    {f.type === "select" ? (
                      <select
                        defaultValue={f.value}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-gray-700"
                      >
                        {f.options?.map((o) => (
                          <option key={o} value={o}>
                            {o.charAt(0).toUpperCase() + o.slice(1)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type}
                        defaultValue={f.value}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => showToast("Settings saved")}
                className="mt-5 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Save Settings
              </button>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Notifications</h3>
              <div className="space-y-4">
                {[
                  { label: "New registration email", sub: "Get notified when someone registers" },
                  { label: "Daily summary", sub: "Receive a daily registration summary" },
                  { label: "Cancellation alerts", sub: "Alert when attendee cancels" },
                  { label: "Capacity warnings", sub: "Alert when 90% capacity reached" },
                ].map((n, i) => (
                  <div key={n.label} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{n.label}</p>
                      <p className="text-xs text-gray-500">{n.sub}</p>
                    </div>
                    <button
                      onClick={() => showToast(`Notification preference updated`)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        i !== 1 ? "bg-indigo-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                          i !== 1 ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm">
              <h3 className="font-semibold text-red-700 mb-1">Danger Zone</h3>
              <p className="text-sm text-gray-500 mb-4">
                These actions are permanent and cannot be undone.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Cancel This Event
                </button>
                <button
                  onClick={() => showToast("Event deleted", "error")}
                  className="w-full py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  Delete Event Permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setOpenMenuId(null)}
        />
      )}
    </div>
  );
}

