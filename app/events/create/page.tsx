"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDaysIcon,
  MapPinIcon,
  VideoCameraIcon,
  TicketIcon,
  PlusCircleIcon,
  TrashIcon,
  PhotoIcon,
  GlobeAltIcon,
  LockClosedIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ShareIcon,
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon,
  TagIcon,
  InformationCircleIcon,
  SparklesIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import { format, addDays } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

type EventMode = "in-person" | "online" | "hybrid";
type EventVisibility = "public" | "private" | "unlisted";
type TicketType = "free" | "paid" | "donation";

interface TicketTier {
  id: string;
  name: string;
  type: TicketType;
  price: string;
  quantity: string;
  description: string;
  salesEnd: string;
}

interface FormData {
  title: string;
  tagline: string;
  category: string;
  description: string;
  mode: EventMode;
  visibility: EventVisibility;
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
  tags: string[];
  maxAttendees: string;
  requireApproval: boolean;
  showGuestList: boolean;
  tickets: TicketTier[];
  refundPolicy: string;
  termsAccepted: boolean;
}

type FormStep = "details" | "location" | "tickets" | "settings" | "preview";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Technology", "Business", "Arts & Culture", "Health & Wellness",
  "Education", "Sports & Fitness", "Food & Drink", "Music",
  "Networking", "Community", "Gaming", "Environment",
];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Paris",
  "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney",
];

const PLATFORMS = ["Zoom", "Google Meet", "Microsoft Teams", "YouTube Live", "Twitch", "Discord", "Other"];

const REFUND_POLICIES = [
  "No refunds", "1 day before event", "7 days before event",
  "14 days before event", "30 days before event", "Full refunds anytime",
];

const STEPS: { key: FormStep; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "location", label: "Location" },
  { key: "tickets", label: "Tickets" },
  { key: "settings", label: "Settings" },
  { key: "preview", label: "Preview" },
];

const TRUST_REWARD = 15;

const defaultTicket = (): TicketTier => ({
  id: Math.random().toString(36).slice(2),
  name: "General Admission",
  type: "free",
  price: "",
  quantity: "100",
  description: "",
  salesEnd: format(addDays(new Date(), 7), "yyyy-MM-dd"),
});

const defaultForm = (): FormData => ({
  title: "",
  tagline: "",
  category: "",
  description: "",
  mode: "in-person",
  visibility: "public",
  startDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
  startTime: "10:00",
  endDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
  endTime: "18:00",
  timezone: "UTC",
  venue: "",
  address: "",
  city: "",
  country: "",
  onlineLink: "",
  onlinePlatform: "Zoom",
  coverImage: "",
  tags: [],
  maxAttendees: "",
  requireApproval: false,
  showGuestList: true,
  tickets: [defaultTicket()],
  refundPolicy: "7 days before event",
  termsAccepted: false,
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function Input({
  value, onChange, placeholder, type = "text", className = "", min, max,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; className?: string; min?: string; max?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
        placeholder-gray-400 bg-white transition ${className}`}
    />
  );
}

function Select({
  value, onChange, children, className = "",
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          bg-white appearance-none transition ${className}`}
      >
        {children}
      </select>
      <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
    </div>
  );
}

function Textarea({
  value, onChange, placeholder, rows = 4,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
        placeholder-gray-400 bg-white resize-none transition"
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 cursor-pointer"
    >
      <div className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-gray-200"}`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </button>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-indigo-600">{icon}</span>
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepDetails({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t) && form.tags.length < 8) {
      set("tags", [...form.tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (t: string) => set("tags", form.tags.filter((x) => x !== t));

  return (
    <div className="space-y-5">
      <SectionCard title="Event Information" icon={<CalendarDaysIcon className="w-5 h-5" />}>
        <div>
          <Label required>Event Title</Label>
          <Input value={form.title} onChange={(v) => set("title", v)} placeholder="Give your event a memorable name" />
        </div>
        <div>
          <Label>Tagline</Label>
          <Input value={form.tagline} onChange={(v) => set("tagline", v)} placeholder="Short one-liner description" />
        </div>
        <div>
          <Label required>Category</Label>
          <Select value={form.category} onChange={(v) => set("category", v)}>
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <Label required>Description</Label>
          <Textarea
            value={form.description}
            onChange={(v) => set("description", v)}
            placeholder="Tell attendees what to expect, what to bring, and why they should come..."
            rows={6}
          />
          <p className="text-xs text-gray-400 mt-1">{form.description.length} characters</p>
        </div>
      </SectionCard>

      <SectionCard title="Cover Image" icon={<PhotoIcon className="w-5 h-5" />}>
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-300 transition cursor-pointer bg-gray-50">
          <PhotoIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">Upload cover image</p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB · Recommended 1600×900</p>
          <Input
            value={form.coverImage}
            onChange={(v) => set("coverImage", v)}
            placeholder="Or paste an image URL"
            className="mt-3"
          />
        </div>
        {form.coverImage && (
          <img
            src={form.coverImage}
            alt="Cover preview"
            className="w-full h-40 object-cover rounded-xl mt-2"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </SectionCard>

      <SectionCard title="Tags" icon={<TagIcon className="w-5 h-5" />}>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={setTagInput}
            placeholder="Add a tag (e.g. blockchain)"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition shrink-0"
          >
            Add
          </button>
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {form.tags.map((t) => (
              <span key={t} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1 rounded-full">
                #{t}
                <button type="button" onClick={() => removeTag(t)}>
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">{form.tags.length}/8 tags</p>
      </SectionCard>

      <SectionCard title="Date & Time" icon={<ClockIcon className="w-5 h-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label required>Start Date</Label>
            <Input type="date" value={form.startDate} onChange={(v) => set("startDate", v)} />
          </div>
          <div>
            <Label required>Start Time</Label>
            <Input type="time" value={form.startTime} onChange={(v) => set("startTime", v)} />
          </div>
          <div>
            <Label required>End Date</Label>
            <Input type="date" value={form.endDate} onChange={(v) => set("endDate", v)} />
          </div>
          <div>
            <Label required>End Time</Label>
            <Input type="time" value={form.endTime} onChange={(v) => set("endTime", v)} />
          </div>
        </div>
        <div>
          <Label>Timezone</Label>
          <Select value={form.timezone} onChange={(v) => set("timezone", v)}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </Select>
        </div>
      </SectionCard>
    </div>
  );
}

function StepLocation({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <SectionCard title="Event Format" icon={<MapPinIcon className="w-5 h-5" />}>
        <div className="grid grid-cols-3 gap-3">
          {(["in-person", "online", "hybrid"] as EventMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set("mode", m)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition
                ${form.mode === m
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"}`}
            >
              {m === "in-person" ? <MapPinIcon className="w-6 h-6" />
                : m === "online" ? <VideoCameraIcon className="w-6 h-6" />
                : <GlobeAltIcon className="w-6 h-6" />}
              {m === "in-person" ? "In Person" : m === "online" ? "Online" : "Hybrid"}
            </button>
          ))}
        </div>
      </SectionCard>

      {(form.mode === "in-person" || form.mode === "hybrid") && (
        <SectionCard title="Venue Details" icon={<MapPinIcon className="w-5 h-5" />}>
          <div>
            <Label required>Venue Name</Label>
            <Input value={form.venue} onChange={(v) => set("venue", v)} placeholder="e.g. The Grand Hall" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={form.address} onChange={(v) => set("address", v)} placeholder="Street address" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={(v) => set("city", v)} placeholder="City" />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={(v) => set("country", v)} placeholder="Country" />
            </div>
          </div>
          <div className="h-40 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
            <div className="text-center">
              <MapPinIcon className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-xs text-gray-400 mt-1">Map preview</p>
            </div>
          </div>
        </SectionCard>
      )}

      {(form.mode === "online" || form.mode === "hybrid") && (
        <SectionCard title="Online Details" icon={<VideoCameraIcon className="w-5 h-5" />}>
          <div>
            <Label>Platform</Label>
            <Select value={form.onlinePlatform} onChange={(v) => set("onlinePlatform", v)}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <div>
            <Label>Meeting Link</Label>
            <Input
              value={form.onlineLink}
              onChange={(v) => set("onlineLink", v)}
              placeholder="https://zoom.us/j/..."
            />
            <p className="text-xs text-gray-400 mt-1">
              This will be shown to registered attendees only
            </p>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function StepTickets({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  const updateTicket = (id: string, field: keyof TicketTier, val: string | TicketType) => {
    set("tickets", form.tickets.map((t) => t.id === id ? { ...t, [field]: val } : t));
  };

  const addTicket = () => {
    set("tickets", [...form.tickets, defaultTicket()]);
  };

  const removeTicket = (id: string) => {
    if (form.tickets.length > 1) set("tickets", form.tickets.filter((t) => t.id !== id));
  };

  const totalCapacity = form.tickets.reduce((s, t) => s + (parseInt(t.quantity) || 0), 0);
  const hasPaid = form.tickets.some((t) => t.type === "paid");

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <SparklesIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Earn Trust for Hosting</p>
          <p className="text-sm text-amber-700">
            You'll earn <span className="font-bold">₮{TRUST_REWARD}</span> Trust tokens when your event goes live.
            Paid events earn additional Trust based on attendance.
          </p>
        </div>
      </div>

      <SectionCard title="Ticket Types" icon={<TicketIcon className="w-5 h-5" />}>
        <div className="space-y-4">
          {form.tickets.map((ticket, idx) => (
            <div key={ticket.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Ticket {idx + 1}
                </span>
                {form.tickets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTicket(ticket.id)}
                    className="text-red-400 hover:text-red-600 transition"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(["free", "paid", "donation"] as TicketType[]).map((tt) => (
                  <button
                    key={tt}
                    type="button"
                    onClick={() => updateTicket(ticket.id, "type", tt)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition capitalize
                      ${ticket.type === tt
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"}`}
                  >
                    {tt}
                  </button>
                ))}
              </div>

              <div>
                <Label>Ticket Name</Label>
                <Input
                  value={ticket.name}
                  onChange={(v) => updateTicket(ticket.id, "name", v)}
                  placeholder="e.g. General Admission, VIP, Early Bird"
                />
              </div>

              {ticket.type === "paid" && (
                <div>
                  <Label required>Price (USD)</Label>
                  <div className="relative">
                    <CurrencyDollarIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="number"
                      value={ticket.price}
                      onChange={(e) => updateTicket(ticket.id, "price", e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={ticket.quantity}
                    onChange={(v) => updateTicket(ticket.id, "quantity", v)}
                    placeholder="100"
                    min="1"
                  />
                </div>
                <div>
                  <Label>Sales End</Label>
                  <Input
                    type="date"
                    value={ticket.salesEnd}
                    onChange={(v) => updateTicket(ticket.id, "salesEnd", v)}
                  />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={ticket.description}
                  onChange={(v) => updateTicket(ticket.id, "description", v)}
                  placeholder="What's included with this ticket?"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addTicket}
          className="w-full border-2 border-dashed border-indigo-300 rounded-xl py-3 text-sm font-medium
            text-indigo-600 hover:bg-indigo-50 transition flex items-center justify-center gap-2"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Add Ticket Type
        </button>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-500">Total capacity</span>
          <span className="text-sm font-semibold text-gray-800">
            <UserGroupIcon className="w-4 h-4 inline mr-1 text-gray-400" />
            {totalCapacity.toLocaleString()} attendees
          </span>
        </div>
      </SectionCard>

      {hasPaid && (
        <SectionCard title="Refund Policy" icon={<InformationCircleIcon className="w-5 h-5" />}>
          <Select value={form.refundPolicy} onChange={(v) => set("refundPolicy", v)}>
            {REFUND_POLICIES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </SectionCard>
      )}
    </div>
  );
}

function StepSettings({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <SectionCard title="Visibility" icon={<GlobeAltIcon className="w-5 h-5" />}>
        <div className="space-y-3">
          {([
            { val: "public", label: "Public", desc: "Anyone can find and attend this event", icon: <GlobeAltIcon className="w-5 h-5" /> },
            { val: "unlisted", label: "Unlisted", desc: "Only people with the link can see it", icon: <ShareIcon className="w-5 h-5" /> },
            { val: "private", label: "Private", desc: "Only invited guests can see this event", icon: <LockClosedIcon className="w-5 h-5" /> },
          ] as { val: EventVisibility; label: string; desc: string; icon: React.ReactNode }[]).map(({ val, label, desc, icon }) => (
            <button
              key={val}
              type="button"
              onClick={() => set("visibility", val)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition
                ${form.visibility === val
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-indigo-300"}`}
            >
              <span className={form.visibility === val ? "text-indigo-600" : "text-gray-400"}>{icon}</span>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${form.visibility === val ? "text-indigo-700" : "text-gray-700"}`}>{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              {form.visibility === val && <CheckCircleSolid className="w-5 h-5 text-indigo-600 shrink-0" />}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Attendee Management" icon={<UserGroupIcon className="w-5 h-5" />}>
        <div>
          <Label>Max Attendees (leave empty for unlimited)</Label>
          <Input
            type="number"
            value={form.maxAttendees}
            onChange={(v) => set("maxAttendees", v)}
            placeholder="Unlimited"
            min="1"
          />
        </div>
        <div className="space-y-4 pt-2">
          <Toggle
            checked={form.requireApproval}
            onChange={(v) => set("requireApproval", v)}
            label="Require approval for RSVPs"
          />
          <Toggle
            checked={form.showGuestList}
            onChange={(v) => set("showGuestList", v)}
            label="Show public guest list"
          />
        </div>
      </SectionCard>

      <SectionCard title="Terms & Conditions" icon={<CheckCircleIcon className="w-5 h-5" />}>
        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 h-32 overflow-y-auto border border-gray-200">
          <p className="font-semibold mb-2">Event Organiser Agreement</p>
          <p>By creating this event on FreeTrust, you agree to: provide accurate event information, honour commitments to attendees, comply with all applicable laws and regulations, not discriminate against attendees, provide refunds per your stated policy, and give FreeTrust the right to display your event publicly (if set to public). FreeTrust earns a 5% service fee on paid ticket sales. Trust tokens (₮{TRUST_REWARD}) are awarded upon event publication and are non-transferable until the event concludes.</p>
        </div>
        <Toggle
          checked={form.termsAccepted}
          onChange={(v) => set("termsAccepted", v)}
          label="I agree to the FreeTrust Event Organiser Terms"
        />
      </SectionCard>
    </div>
  );
}

function StepPreview({ form }: { form: FormData }) {
  const startStr = form.startDate
    ? format(new Date(`${form.startDate}T${form.startTime}`), "EEEE, MMMM d, yyyy · h:mm a")
    : "TBD";
  const freeTickets = form.tickets.filter((t) => t.type === "free");
  const paidTickets = form.tickets.filter((t) => t.type === "paid");
  const donationTickets = form.tickets.filter((t) => t.type === "donation");

  const lowestPaid = paidTickets.length
    ? Math.min(...paidTickets.map((t) => parseFloat(t.price) || 0))
    : null;

  const priceLabel = paidTickets.length
    ? lowestPaid === 0 ? "From $0.00" : `From $${lowestPaid?.toFixed(2)}`
    : freeTickets.length
      ? "Free"
      : donationTickets.length
        ? "Pay what you can"
        : "Free";

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircleIcon className="w-5 h-5" />
          <span className="text-sm font-semibold">Event Preview</span>
        </div>
        <p className="text-xs text-indigo-200">This is how your event will appear to attendees</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {form.coverImage ? (
          <img
            src={form.coverImage}
            alt="Cover"
            className="w-full h-48 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            <CalendarDaysIcon className="w-16 h-16 text-indigo-300" />
          </div>
        )}

        <div className="p-6 space-y-4">
          {form.category && (
            <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full">
              {form.category}
            </span>
          )}

          <h2 className="text-xl font-bold text-gray-900">
            {form.title || <span className="text-gray-400 italic">Event title</span>}
          </h2>

          {form.tagline && <p className="text-gray-600 text-sm">{form.tagline}</p>}

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>{startStr}</span>
            </div>
            <div className="flex items-center gap-2">
              {form.mode === "online"
                ? <VideoCameraIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                : <MapPinIcon className="w-4 h-4 text-indigo-500 shrink-0" />}
              <span>
                {form.mode === "online"
                  ? `Online · ${form.onlinePlatform}`
                  : form.mode === "hybrid"
                    ? `${form.venue || "Venue TBD"} + Online`
                    : form.venue || "Venue TBD"}
                {(form.mode !== "online" && form.city) && `, ${form.city}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TicketIcon className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>{priceLabel}</span>
            </div>
          </div>

          {form.description && (
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed line-clamp-4">
              {form.description}
            </p>
          )}

          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.tags.map((t) => (
                <span key={t} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">#{t}</span>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-3 rounded-xl">
              Register Now
            </button>
            <button className="px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">
              <ShareIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Ticket Types</p>
          <p className="text-2xl font-bold text-gray-800">{form.tickets.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            {freeTickets.length > 0 && `${freeTickets.length} free · `}
            {paidTickets.length > 0 && `${paidTickets.length} paid`}
          </p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4">
          <p className="text-xs text-amber-700 mb-1">Trust Reward</p>
          <p className="text-2xl font-bold text-amber-800">₮{TRUST_REWARD}</p>
          <p className="text-xs text-amber-600 mt-1">Earned on publish</p>
        </div>
      </div>

      {!form.termsAccepted && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
          <InformationCircleIcon className="w-4 h-4 shrink-0" />
          Please accept the terms in the Settings step before publishing.
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreateEventPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(defaultForm());
  const [step, setStep] = useState<FormStep>("details");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const set = useCallback((k: keyof FormData, v: unknown) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  const canNext = () => {
    if (step === "details") return !!(form.title && form.category && form.description && form.startDate);
    if (step === "location") return form.mode === "online"
      ? true
      : !!(form.venue);
    if (step === "tickets") return form.tickets.every((t) => t.name && t.quantity && (t.type !== "paid" || t.price));
    if (step === "settings") return true;
    return form.termsAccepted;
  };

  const goNext = () => {
    const next = STEPS[currentIndex + 1];
    if (next) setStep(next.key);
  };

  const goPrev = () => {
    const prev = STEPS[currentIndex - 1];
    if (prev) setStep(prev.key);
  };

  const handlePublish = async () => {
    if (!form.termsAccepted) return;
    setPublishing(true);
    await new Promise((r) => setTimeout(r, 1800));
    setPublishing(false);
    setPublished(true);
  };

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/events/abc-${Date.now()}`
    : "";

  if (published) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleSolid className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Event Published!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your event <span className="font-semibold text-gray-700">&ldquo;{form.title}&rdquo;</span> is now live.
          </p>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mb-6">
            <SparklesIcon className="w-6 h-6 text-amber-600 mx-auto mb-1" />
            <p className="text-sm font-semibold text-amber-800">You earned ₮{TRUST_REWARD} Trust!</p>
            <p className="text-xs text-amber-600">Added to your FreeTrust balance</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 mb-6 flex items-center gap-2 border border-gray-200">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate"
            />
            <button
              onClick={() => { navigator.clipboard?.writeText(shareUrl); setShareOpen(true); }}
              className="text-indigo-600 hover:text-indigo-700 shrink-0 flex items-center gap-1 text-xs font-semibold"
            >
              <ShareIcon className="w-4 h-4" />
              {shareOpen ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push("/events/manage")}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition"
            >
              Manage Event
            </button>
            <button
              onClick={() => router.push("/events")}
              className="w-full border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition"
            >
              Browse All Events
            </button>
            <button
              onClick={() => { setForm(defaultForm()); setStep("details"); setPublished(false); }}
              className="text-sm text-indigo-600 hover:underline"
            >
              Create Another Event
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-600"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Create Event</h1>
            <p className="text-xs text-gray-500">Earn ₮{TRUST_REWARD} Trust for hosting</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full font-semibold">
            <SparklesIcon className="w-4 h-4" />
            ₮{TRUST_REWARD} reward
          </div>
        </div>

        {/* Step nav */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  if (i <= currentIndex || canNext()) setStep(s.key);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition
                  ${step === s.key
                    ? "bg-indigo-600 text-white"
                    : i < currentIndex
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-400 hover:text-gray-600"}`}
              >
                {i < currentIndex && <CheckCircleIcon className="w-3.5 h-3.5" />}
                <span>{i + 1}. {s.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {step === "details" && <StepDetails form={form} set={set} />}
        {step === "location" && <StepLocation form={form} set={set} />}
        {step === "tickets" && <StepTickets form={form} set={set} />}
        {step === "settings" && <StepSettings form={form} set={set} />}
        {step === "preview" && <StepPreview form={form} />}
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={goPrev}
              className="px-5 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Back
            </button>
          )}

          {step !== "preview" ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext()}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition
                ${canNext()
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
            >
              Continue to {STEPS[currentIndex + 1]?.label ?? ""}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={!form.termsAccepted || publishing}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2
                ${form.termsAccepted && !publishing
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
            >
              {publishing ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Publishing…
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  Publish & Earn ₮{TRUST_REWARD}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

