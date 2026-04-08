"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDaysIcon,
  MapPinIcon,
  VideoCameraIcon,
  TicketIcon,
  UserGroupIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  ClockIcon,
  InformationCircleIcon,
  ShareIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

type EventMode = "in-person" | "online" | "hybrid";
type TicketType = { id: string; name: string; price: number; free: boolean; quantity: number; description: string };
type FormStep = 1 | 2 | 3 | 4;

interface EventForm {
  title: string;
  description: string;
  category: string;
  mode: EventMode;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
  venue: string;
  address: string;
  city: string;
  country: string;
  onlineLink: string;
  onlinePlatform: string;
  coverImage: string;
  maxAttendees: string;
  tickets: TicketType[];
  tags: string[];
  tagInput: string;
  visibility: "public" | "private" | "invite-only";
  requireApproval: boolean;
  allowWaitlist: boolean;
  refundPolicy: string;
  organiserName: string;
  organiserBio: string;
  organiserWebsite: string;
  organiserImage: string;
}

const CATEGORIES = ["Conference","Workshop","Meetup","Webinar","Networking","Social","Education","Tech","Business","Health","Arts","Sports","Charity","Other"];
const TIMEZONES = ["UTC","America/New_York","America/Los_Angeles","America/Chicago","Europe/London","Europe/Paris","Europe/Berlin","Asia/Tokyo","Asia/Singapore","Australia/Sydney"];
const PLATFORMS = ["Zoom","Google Meet","Microsoft Teams","YouTube Live","Twitch","Discord","Other"];
const REFUND_POLICIES = ["No refunds","24 hours before","48 hours before","7 days before","Full refund anytime"];

const STEPS: { num: FormStep; label: string; icon: React.ReactNode }[] = [
  { num: 1, label: "Details", icon: <InformationCircleIcon className="w-4 h-4" /> },
  { num: 2, label: "Location", icon: <MapPinIcon className="w-4 h-4" /> },
  { num: 3, label: "Tickets", icon: <TicketIcon className="w-4 h-4" /> },
  { num: 4, label: "Organiser", icon: <UserGroupIcon className="w-4 h-4" /> },
];

const uid = () => Math.random().toString(36).slice(2, 9);

export default function CreateEventPage() {
  const router = useRouter();
  const [step, setStep] = useState<FormStep>(1);
  const [submitted, setSubmitted] = useState(false);
  const [trustEarned] = useState(15);

  const [form, setForm] = useState<EventForm>({
    title: "",
    description: "",
    category: "",
    mode: "in-person",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    timezone: "UTC",
    venue: "",
    address: "",
    city: "",
    country: "",
    onlineLink: "",
    onlinePlatform: "Zoom",
    coverImage: "",
    maxAttendees: "",
    tickets: [{ id: uid(), name: "General Admission", price: 0, free: true, quantity: 100, description: "" }],
    tags: [],
    tagInput: "",
    visibility: "public",
    requireApproval: false,
    allowWaitlist: false,
    refundPolicy: "No refunds",
    organiserName: "",
    organiserBio: "",
    organiserWebsite: "",
    organiserImage: "",
  });

  const set = useCallback(<K extends keyof EventForm>(key: K, val: EventForm[K]) => {
    setForm(f => ({ ...f, [key]: val }));
  }, []);

  const addTicket = () => {
    set("tickets", [...form.tickets, { id: uid(), name: "", price: 0, free: true, quantity: 50, description: "" }]);
  };

  const removeTicket = (id: string) => {
    set("tickets", form.tickets.filter(t => t.id !== id));
  };

  const updateTicket = (id: string, field: keyof TicketType, value: string | number | boolean) => {
    set("tickets", form.tickets.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addTag = () => {
    const tag = form.tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      set("tags", [...form.tags, tag]);
    }
    set("tagInput", "");
  };

  const removeTag = (tag: string) => set("tags", form.tags.filter(t => t !== tag));

  const isStep1Valid = form.title.trim() && form.category && form.startDate && form.startTime;
  const isStep2Valid = form.mode === "online"
    ? form.onlineLink.trim()
    : form.venue.trim() && form.city.trim();
  const isStep3Valid = form.tickets.length > 0 && form.tickets.every(t => t.name.trim());
  const isStep4Valid = form.organiserName.trim();

  const canNext = step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : step === 3 ? isStep3Valid : isStep4Valid;

  const handleNext = () => {
    if (step < 4 && canNext) setStep(s => (s + 1) as FormStep);
  };
  const handleBack = () => {
    if (step > 1) setStep(s => (s - 1) as FormStep);
  };

  const handleSubmit = () => {
    if (!canNext) return;
    setSubmitted(true);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/events/${uid()}`;
    if (navigator.share) {
      navigator.share({ title: form.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => alert("Event link copied to clipboard!"));
    }
  };

  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm";
  const labelCls = "block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide";
  const sectionCls = "bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4";

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-indigo-600/20 border border-indigo-500/30 mx-auto">
            <CheckCircleIcon className="w-12 h-12 text-indigo-400" />
            <span className="absolute -top-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500"></span>
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Event Created! 🎉</h1>
            <p className="text-gray-400 text-sm">{form.title} is now live and ready for attendees.</p>
          </div>
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <SparklesIcon className="w-6 h-6 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-amber-400 font-bold text-lg">+₮{trustEarned} Trust Earned</p>
              <p className="text-gray-400 text-xs">For hosting a community event on FreeTrust</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Ticket Types", val: form.tickets.length },
              { label: "Max Attendees", val: form.maxAttendees || "∞" },
              { label: "Revenue", val: form.tickets.every(t => t.free) ? "Free" : `$${form.tickets.filter(t => !t.free).reduce((a, t) => a + t.price, 0)}+` },
            ].map(({ label, val }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <p className="text-white font-bold text-lg">{val}</p>
                <p className="text-gray-500 text-xs">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-medium text-sm transition">
              <ShareIcon className="w-4 h-4" /> Share Event
            </button>
            <button onClick={() => router.push("/events")} className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-3 font-medium text-sm transition">
              <CalendarDaysIcon className="w-4 h-4" /> View Events
            </button>
          </div>
          <button onClick={() => { setSubmitted(false); setStep(1); setForm(f => ({ ...f, title: "", description: "" })); }} className="text-gray-500 hover:text-gray-300 text-sm transition">
            Create another event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-gray-900 border border-gray-700 hover:bg-gray-800 transition">
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-bold text-white text-sm">Create Event</h1>
              <p className="text-gray-500 text-xs">Step {step} of 4</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5">
            <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400 text-xs font-medium">+₮{trustEarned} on publish</span>
          </div>
        </div>
        {/* Step bar */}
        <div className="max-w-3xl mx-auto px-4 pb-4">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center flex-1">
                <button
                  onClick={() => s.num < step && setStep(s.num)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition w-full justify-center
                    ${step === s.num ? "bg-indigo-600 text-white" : s.num < step ? "bg-indigo-600/20 text-indigo-400 cursor-pointer hover:bg-indigo-600/30" : "bg-gray-900 text-gray-600 cursor-not-allowed"}`}
                >
                  {s.icon}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-2 mx-0.5 rounded-full transition-colors ${s.num < step ? "bg-indigo-500" : "bg-gray-800"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* ── STEP 1: Event Details ── */}
        {step === 1 && (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Event Details</h2>
              <p className="text-gray-400 text-sm">Basic information about your event</p>
            </div>

            {/* Cover Image */}
            <div className={sectionCls}>
              <label className={labelCls}>Cover Image</label>
              {form.coverImage ? (
                <div className="relative rounded-xl overflow-hidden h-40">
                  <img src={form.coverImage} alt="cover" className="w-full h-full object-cover" />
                  <button onClick={() => set("coverImage", "")} className="absolute top-2 right-2 bg-black/60 rounded-lg p-1.5 hover:bg-black/80 transition">
                    <TrashIcon className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-700 rounded-xl h-40 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-500/50 transition group"
                  onClick={() => set("coverImage", `https://picsum.photos/seed/${uid()}/1200/400`)}>
                  <PhotoIcon className="w-8 h-8 text-gray-600 group-hover:text-indigo-400 transition" />
                  <span className="text-gray-500 text-sm">Click to add cover image</span>
                  <span className="text-gray-600 text-xs">Recommended: 1200×400px</span>
                </div>
              )}
            </div>

            {/* Title + Category */}
            <div className={sectionCls}>
              <div>
                <label className={labelCls}>Event Title *</label>
                <input className={inputCls} placeholder="e.g. FreeTrust Community Meetup 2025" value={form.title} onChange={e => set("title", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea className={`${inputCls} min-h-[100px] resize-none`} placeholder="Tell attendees what to expect..." value={form.description} onChange={e => set("description", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Category *</label>
                  <select className={inputCls} value={form.category} onChange={e => set("category", e.target.value)}>
                    <option value="">Select…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Visibility</label>
                  <select className={inputCls} value={form.visibility} onChange={e => set("visibility", e.target.value as EventForm["visibility"])}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="invite-only">Invite Only</option>
                  </select>
                </div>
              </div>
              {/* Tags */}
              <div>
                <label className={labelCls}>Tags</label>
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="Add a tag and press Enter"
                    value={form.tagInput}
                    onChange={e => set("tagInput", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                  />
                  <button onClick={addTag} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-3 transition">
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-lg px-2 py-0.5 text-xs">
                        #{tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-white transition">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Date & Time */}
            <div className={sectionCls}>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CalendarDaysIcon className="w-4 h-4 text-indigo-400" /> Date & Time
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start Date *</label>
                  <input type="date" className={inputCls} value={form.startDate} onChange={e => set("startDate", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Start Time *</label>
                  <input type="time" className={inputCls} value={form.startTime} onChange={e => set("startTime", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>End Date</label>
                  <input type="date" className={inputCls} value={form.endDate} onChange={e => set("endDate", e.target.value)} min={form.startDate} />
                </div>
                <div>
                  <label className={labelCls}>End Time</label>
                  <input type="time" className={inputCls} value={form.endTime} onChange={e => set("endTime", e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}><ClockIcon className="w-3.5 h-3.5 inline mr-1" />Timezone</label>
                <select className={inputCls} value={form.timezone} onChange={e => set("timezone", e.target.value)}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>

            {/* Options */}
            <div className={sectionCls}>
              <h3 className="text-sm font-semibold text-white">Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Max Attendees</label>
                  <input type="number" className={inputCls} placeholder="Unlimited" value={form.maxAttendees} onChange={e => set("maxAttendees", e.target.value)} min="1" />
                </div>
                <div>
                  <label className={labelCls}>Refund Policy</label>
                  <select className={inputCls} value={form.refundPolicy} onChange={e => set("refundPolicy", e.target.value)}>
                    {REFUND_POLICIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { key: "requireApproval" as const, label: "Require approval for registrations", desc: "Manually approve each attendee" },
                  { key: "allowWaitlist" as const, label: "Enable waitlist", desc: "Allow sign-ups after capacity is reached" },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input type="checkbox" className="sr-only" checked={form[key]} onChange={e => set(key, e.target.checked)} />
                      <div className={`w-10 h-5 rounded-full transition-colors ${form[key] ? "bg-indigo-600" : "bg-gray-700"}`} />
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form[key] ? "translate-x-5" : ""}`} />
                    </div>
                    <div>
                      <p className="text-sm text-white group-hover:text-indigo-300 transition">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: Location ── */}
        {step === 2 && (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Location & Format</h2>
              <p className="text-gray-400 text-sm">Where and how your event takes place</p>
            </div>

            {/* Mode selector */}
            <div className={sectionCls}>
              <label className={labelCls}>Event Format *</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: "in-person", icon: <MapPinIcon className="w-5 h-5" />, label: "In Person" },
                  { val: "online", icon: <VideoCameraIcon className="w-5 h-5" />, label: "Online" },
                  { val: "hybrid", icon: <GlobeAltIcon className="w-5 h-5" />, label: "Hybrid" },
                ] as const).map(({ val, icon, label }) => (
                  <button
                    key={val}
                    onClick={() => set("mode", val)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition ${
                      form.mode === val
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-gray-900 border-gray-700 text-gray-400 hover:border-indigo-500/50"
                    }`}
                  >
                    {icon}
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Physical venue */}
            {(form.mode === "in-person" || form.mode === "hybrid") && (
              <div className={sectionCls}>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-indigo-400" /> Venue Details
                </h3>
                <div>
                  <label className={labelCls}>Venue Name *</label>
                  <input className={inputCls} placeholder="e.g. Central Conference Hall" value={form.venue} onChange={e => set("venue", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Street Address</label>
                  <input className={inputCls} placeholder="123 Main Street" value={form.address} onChange={e => set("address", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City *</label>
                    <input className={inputCls} placeholder="London" value={form.city} onChange={e => set("city", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Country</label>
                    <input className={inputCls} placeholder="United Kingdom" value={form.country} onChange={e => set("country", e.target.value)} />
                  </div>
                </div>
                {/* Map placeholder */}
                <div className="w-full h-32 bg-gray-800 rounded-xl flex items-center justify-center border border-gray-700">
                  <div className="text-center">
                    <MapPinIcon className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                    <p className="text-gray-600 text-xs">Map preview would appear here</p>
                  </div>
                </div>
              </div>
            )}

            {/* Online */}
            {(form.mode === "online" || form.mode === "hybrid") && (
              <div className={sectionCls}>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <VideoCameraIcon className="w-4 h-4 text-indigo-400" /> Online Details
                </h3>
                <div>
                  <label className={labelCls}>Platform</label>
                  <select className={inputCls} value={form.onlinePlatform} onChange={e => set("onlinePlatform", e.target.value)}>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Meeting Link *</label>
                  <input className={inputCls} placeholder="https://zoom.us/j/..." value={form.onlineLink} onChange={e => set("onlineLink", e.target.value)} />
                  <p className="text-gray-600 text-xs mt-1">Link will only be shared with registered attendees</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STEP 3: Tickets ── */}
        {step === 3 && (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Tickets & Pricing</h2>
              <p className="text-gray-400 text-sm">Set up ticket types for your event</p>
            </div>

            <div className="space-y-3">
              {form.tickets.map((ticket, idx) => (
                <div key={ticket.id} className={sectionCls}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ticket #{idx + 1}</span>
                    {form.tickets.length > 1 && (
                      <button onClick={() => removeTicket(ticket.id)} className="text-gray-600 hover:text-red-400 transition">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Ticket Name *</label>
                      <input className={inputCls} placeholder="e.g. General Admission" value={ticket.name} onChange={e => updateTicket(ticket.id, "name", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Quantity</label>
                      <input type="number" className={inputCls} value={ticket.quantity} onChange={e => updateTicket(ticket.id, "quantity", parseInt(e.target.value) || 0)} min="1" />
                    </div>
                    <div>
                      <label className={labelCls}>Type</label>
                      <div className="flex rounded-xl overflow-hidden border border-gray-700">
                        <button
                          onClick={() => updateTicket(ticket.id, "free", true)}
                          className={`flex-1 py-2.5 text-xs font-medium transition flex items-center justify-center gap-1 ${ticket.free ? "bg-green-600 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300"}`}
                        >
                          Free
                        </button>
                        <button
                          onClick={() => updateTicket(ticket.id, "free", false)}
                          className={`flex-1 py-2.5 text-xs font-medium transition flex items-center justify-center gap-1 ${!ticket.free ? "bg-indigo-600 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300"}`}
                        >
                          <CurrencyDollarIcon className="w-3.5 h-3.5" /> Paid
                        </button>
                      </div>
                    </div>
                    {!ticket.free && (
                      <div className="col-span-2">
                        <label className={labelCls}>Price (USD)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            className={`${inputCls} pl-7`}
                            placeholder="0.00"
                            value={ticket.price || ""}
                            onChange={e => updateTicket(ticket.id, "price", parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className={labelCls}>Description</label>
                      <input className={inputCls} placeholder="What's included with this ticket?" value={ticket.description} onChange={e => updateTicket(ticket.id, "description", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addTicket}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-700 hover:border-indigo-500/50 text-gray-500 hover:text-indigo-400 rounded-2xl py-4 text-sm font-medium transition"
            >
              <PlusIcon className="w-4 h-4" /> Add Ticket Type
            </button>

            {/* Summary */}
            {form.tickets.length > 0 && (
              <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4">
                <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-3">Ticket Summary</h4>
                <div className="space-y-2">
                  {form.tickets.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{t.name || "Unnamed"}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-xs">{t.quantity} available</span>
                        <span className={`font-medium ${t.free ? "text-green-400" : "text-indigo-300"}`}>
                          {t.free ? "Free" : `$${t.price.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STEP 4: Organiser ── */}
        {step === 4 && (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Organiser Profile</h2>
              <p className="text-gray-400 text-sm">Let attendees know who's hosting this event</p>
            </div>

            <div className={sectionCls}>
              <div className="flex items-center gap-4">
                {form.organiserImage ? (
                  <div className="relative">
                    <img src={form.organiserImage} alt="organiser" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500" />
                    <button onClick={() => set("organiserImage", "")} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 hover:bg-red-600 transition">
                      <TrashIcon className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => set("organiserImage", `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid()}`)}
                    className="w-16 h-16 rounded-full bg-gray-800 border-2 border-dashed border-gray-700 flex items-center justify-center hover:border-indigo-500/50 transition"
                  >
                    <PhotoIcon className="w-6 h-6 text-gray-600" />
                  </button>
                )}
                <div className="flex-1 space-y-3">
                  <div>
                    <label className={labelCls}>Organiser Name *</label>
                    <input className={inputCls} placeholder="Your name or organisation" value={form.organiserName} onChange={e => set("organiserName", e.target.value)} />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Bio</label>
                <textarea className={`${inputCls} min-h-[80px] resize-none`} placeholder="Tell attendees about yourself or your organisation..." value={form.organiserBio} onChange={e => set("organiserBio", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input className={inputCls} placeholder="https://yourwebsite.com" value={form.organiserWebsite} onChange={e => set("organiserWebsite", e.target.value)} />
              </div>
            </div>

            {/* Preview card */}
            {form.organiserName && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Profile Preview</p>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm flex-shrink-0 overflow-hidden">
                    {form.organiserImage
                      ? <img src={form.organiserImage} alt="" className="w-full h-full object-cover" />
                      : form.organiserName[0]?.toUpperCase()
                    }
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{form.organiserName}</p>
                    {form.organiserBio && <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{form.organiserBio}</p>}
                    {form.organiserWebsite && (
                      <a href={form.organiserWebsite} className="text-indigo-400 text-xs mt-1 inline-block hover:underline" target="_blank" rel="noreferrer">
                        {form.organiserWebsite}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Final summary */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Event Summary</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Title", val: form.title },
                  { label: "Category", val: form.category },
                  { label: "Format", val: form.mode },
                  { label: "Date", val: form.startDate && form.startTime ? `${form.startDate} at ${form.startTime}` : "—" },
                  { label: "Location", val: form.mode === "online" ? form.onlinePlatform : [form.venue, form.city].filter(Boolean).join(", ") || "—" },
                  { label: "Tickets", val: `${form.tickets.length} type${form.tickets.length !== 1 ? "s" : ""}` },
                  { label: "Visibility", val: form.visibility },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-white capitalize">{val || "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust reward */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
              <SparklesIcon className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-amber-400 text-sm font-semibold">You'll earn ₮{trustEarned} Trust for hosting this event</p>
                <p className="text-gray-500 text-xs">Trust is awarded when your event is published to the FreeTrust community</p>
              </div>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 pb-8">
          <button
            onClick={handleBack}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-medium text-sm transition
              ${step === 1 ? "border-gray-800 text-gray-700 cursor-not-allowed" : "border-gray-700 text-gray-300 hover:bg-gray-800"}`}
            disabled={step === 1}
          >
            <ChevronLeftIcon className="w-4 h-4" /> Back
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canNext}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition
                ${canNext ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}
            >
              Continue <ChevronRightIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canNext}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition
                ${canNext ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}
            >
              <CheckCircleIcon className="w-4 h-4" /> Publish Event
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

