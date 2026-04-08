"use client";

import { useState } from "react";
import {
  ShoppingBagIcon,
  TagIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BanknotesIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import { formatDistanceToNow, format } from "date-fns";

type OrderStatus =
  | "pending"
  | "paid"
  | "in_progress"
  | "delivered"
  | "completed"
  | "disputed"
  | "refunded"
  | "cancelled";

type OrderType = "service" | "product";

interface TimelineEvent {
  status: OrderStatus;
  label: string;
  timestamp: string | null;
  completed: boolean;
}

interface Order {
  id: string;
  type: OrderType;
  title: string;
  description: string;
  status: OrderStatus;
  amount: number;
  fee: number;
  escrowAmount: number;
  currency: string;
  counterparty: {
    name: string;
    avatar: string;
    handle: string;
  };
  createdAt: string;
  updatedAt: string;
  deliveryDue: string | null;
  stripePaymentId: string;
  timeline: TimelineEvent[];
  canRelease: boolean;
  canDispute: boolean;
  canCancel: boolean;
}

const MOCK_BUYING: Order[] = [
  {
    id: "ord_001",
    type: "service",
    title: "Full-Stack Web App Development",
    description: "Custom Next.js application with Supabase backend, auth, and Stripe integration.",
    status: "in_progress",
    amount: 1200,
    fee: 96,
    escrowAmount: 1104,
    currency: "USDT",
    counterparty: {
      name: "Alexei Petrov",
      avatar: "AP",
      handle: "@alexei.dev",
    },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    deliveryDue: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    stripePaymentId: "pi_3PxABC",
    canRelease: true,
    canDispute: true,
    canCancel: false,
    timeline: [
      { status: "pending", label: "Order placed", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "paid", label: "Payment confirmed", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 120000).toISOString(), completed: true },
      { status: "in_progress", label: "Work started", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "delivered", label: "Delivered", timestamp: null, completed: false },
      { status: "completed", label: "Escrow released", timestamp: null, completed: false },
    ],
  },
  {
    id: "ord_002",
    type: "product",
    title: "UI Component Library — Pro License",
    description: "Lifetime license for 200+ Tailwind components with Figma source files.",
    status: "completed",
    amount: 149,
    fee: 7.45,
    escrowAmount: 141.55,
    currency: "USDT",
    counterparty: {
      name: "DesignForge Studio",
      avatar: "DS",
      handle: "@designforge",
    },
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    deliveryDue: null,
    stripePaymentId: "pi_3PyDEF",
    canRelease: false,
    canDispute: false,
    canCancel: false,
    timeline: [
      { status: "pending", label: "Order placed", timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "paid", label: "Payment confirmed", timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000 + 90000).toISOString(), completed: true },
      { status: "delivered", label: "Delivered", timestamp: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "completed", label: "Escrow released", timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
    ],
  },
  {
    id: "ord_003",
    type: "service",
    title: "SEO Audit & Strategy Report",
    description: "Comprehensive SEO audit covering technical, on-page, and backlink analysis.",
    status: "disputed",
    amount: 320,
    fee: 25.6,
    escrowAmount: 294.4,
    currency: "USDT",
    counterparty: {
      name: "RankUp Agency",
      avatar: "RA",
      handle: "@rankup.seo",
    },
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    deliveryDue: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    stripePaymentId: "pi_3PzGHI",
    canRelease: false,
    canDispute: false,
    canCancel: false,
    timeline: [
      { status: "pending", label: "Order placed", timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "paid", label: "Payment confirmed", timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000 + 60000).toISOString(), completed: true },
      { status: "in_progress", label: "Work started", timestamp: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "disputed", label: "Dispute raised", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
    ],
  },
  {
    id: "ord_004",
    type: "service",
    title: "Brand Identity Package",
    description: "Logo, color palette, typography guide, and brand usage document.",
    status: "pending",
    amount: 550,
    fee: 44,
    escrowAmount: 506,
    currency: "USDT",
    counterparty: {
      name: "Mia Hoffmann",
      avatar: "MH",
      handle: "@mia.design",
    },
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    deliveryDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    stripePaymentId: "pi_3PaJKL",
    canRelease: false,
    canDispute: false,
    canCancel: true,
    timeline: [
      { status: "pending", label: "Order placed", timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), completed: true },
      { status: "paid", label: "Payment confirmed", timestamp: null, completed: false },
      { status: "in_progress", label: "Work started", timestamp: null, completed: false },
      { status: "delivered", label: "Delivered", timestamp: null, completed: false },
      { status: "completed", label: "Escrow released", timestamp: null, completed: false },
    ],
  },
];

const MOCK_SELLING: Order[] = [
  {
    id: "ord_101",
    type: "service",
    title: "Mobile App UI Design",
    description: "iOS & Android UI design for fintech app — 30 screens, Figma delivery.",
    status: "delivered",
    amount: 800,
    fee: 64,
    escrowAmount: 736,
    currency: "USDT",
    counterparty: {
      name: "Pavel Novak",
      avatar: "PN",
      handle: "@pavel.fin",
    },
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    deliveryDue: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    stripePaymentId: "pi_3PbMNO",
    canRelease: false,
    canDispute: false,
    canCancel: false,
    timeline: [
      { status: "pending", label: "Order received", timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "paid", label: "Payment confirmed", timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 + 80000).toISOString(), completed: true },
      { status: "in_progress", label: "Work started", timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "delivered", label: "Delivered", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "completed", label: "Escrow released", timestamp: null, completed: false },
    ],
  },
  {
    id: "ord_102",
    type: "product",
    title: "Notion Business OS Template",
    description: "Complete business operating system in Notion — CRM, projects, finance.",
    status: "completed",
    amount: 59,
    fee: 2.95,
    escrowAmount: 56.05,
    currency: "USDT",
    counterparty: {
      name: "Sara Lin",
      avatar: "SL",
      handle: "@sara.ops",
    },
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    deliveryDue: null,
    stripePaymentId: "pi_3PcPQR",
    canRelease: false,
    canDispute: false,
    canCancel: false,
    timeline: [
      { status: "pending", label: "Order received", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "paid", label: "Payment confirmed", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 45000).toISOString(), completed: true },
      { status: "delivered", label: "Delivered", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 60000).toISOString(), completed: true },
      { status: "completed", label: "Escrow released", timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
    ],
  },
  {
    id: "ord_103",
    type: "service",
    title: "API Integration — Stripe + Webhooks",
    description: "End-to-end Stripe checkout, webhook handler, and escrow logic implementation.",
    status: "in_progress",
    amount: 650,
    fee: 52,
    escrowAmount: 598,
    currency: "USDT",
    counterparty: {
      name: "BlockChain Ventures",
      avatar: "BV",
      handle: "@bcventures",
    },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    deliveryDue: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    stripePaymentId: "pi_3PdSTU",
    canRelease: false,
    canDispute: false,
    canCancel: false,
    timeline: [
      { status: "pending", label: "Order received", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "paid", label: "Payment confirmed", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 100000).toISOString(), completed: true },
      { status: "in_progress", label: "Work started", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "delivered", label: "Delivered", timestamp: null, completed: false },
      { status: "completed", label: "Escrow released", timestamp: null, completed: false },
    ],
  },
];

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending",
    color: "text-yellow-600",
    bg: "bg-yellow-50 border-yellow-200",
    icon: <ClockIcon className="w-4 h-4" />,
  },
  paid: {
    label: "Paid",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    icon: <BanknotesIcon className="w-4 h-4" />,
  },
  in_progress: {
    label: "In Progress",
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200",
    icon: <ArrowPathIcon className="w-4 h-4" />,
  },
  delivered: {
    label: "Delivered",
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200",
    icon: <CheckCircleIcon className="w-4 h-4" />,
  },
  completed: {
    label: "Completed",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
    icon: <CheckCircleSolid className="w-4 h-4" />,
  },
  disputed: {
    label: "Disputed",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    icon: <ExclamationTriangleIcon className="w-4 h-4" />,
  },
  refunded: {
    label: "Refunded",
    color: "text-gray-600",
    bg: "bg-gray-50 border-gray-200",
    icon: <ArrowPathIcon className="w-4 h-4" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-gray-500",
    bg: "bg-gray-50 border-gray-200",
    icon: <XCircleIcon className="w-4 h-4" />,
  },
};

type Tab = "buying" | "selling";
type FilterStatus = "all" | OrderStatus;

function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-semibold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color} ${cfg.bg}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Timeline</p>
      <div className="flex items-start gap-0">
        {events.map((ev, i) => {
          const isLast = i === events.length - 1;
          const cfg = STATUS_CONFIG[ev.status];
          return (
            <div key={ev.status} className="flex flex-col items-center flex-1 relative">
              {/* Connector line */}
              {!isLast && (
                <div className={`absolute top-3 left-1/2 w-full h-0.5 ${ev.completed ? "bg-indigo-400" : "bg-gray-200"}`} style={{ transform: "translateY(-50%)" }} />
              )}
              {/* Dot */}
              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${ev.completed ? "bg-indigo-500 border-indigo-500" : "bg-white border-gray-300"}`}>
                {ev.completed && <CheckCircleSolid className="w-3.5 h-3.5 text-white" />}
              </div>
              {/* Label */}
              <div className="mt-2 text-center px-1">
                <p className={`text-xs font-medium ${ev.completed ? "text-gray-800" : "text-gray-400"}`}>{ev.label}</p>
                {ev.timestamp && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(ev.timestamp), "MMM d")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EscrowPanel({ order, isBuying }: { order: Order; isBuying: boolean }) {
  const [releasing, setReleasing] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const handleRelease = async () => {
    if (!releaseConfirm) { setReleaseConfirm(true); return; }
    setReleasing(true);
    await new Promise(r => setTimeout(r, 1200));
    setReleasing(false);
    setReleaseConfirm(false);
    alert(`Escrow of ${order.escrowAmount} ${order.currency} released to ${order.counterparty.name}! +₮5 trust awarded.`);
  };

  const handleDispute = async () => {
    if (!showDisputeForm) { setShowDisputeForm(true); return; }
    if (!disputeReason.trim()) return;
    setDisputing(true);
    await new Promise(r => setTimeout(r, 1000));
    setDisputing(false);
    setShowDisputeForm(false);
    alert("Dispute raised. FreeTrust team will review within 24 hours.");
  };

  if (!order.canRelease && !order.canDispute) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <BanknotesIcon className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-gray-700">Escrow</span>
        <span className="ml-auto text-sm font-bold text-indigo-600">{order.escrowAmount} {order.currency}</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Funds are held securely in escrow. Release payment once you are satisfied with the delivery.
      </p>
      <div className="flex flex-col gap-2">
        {isBuying && order.canRelease && (
          <>
            {releaseConfirm ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-xs text-emerald-700 font-medium mb-2">
                  Confirm release of {order.escrowAmount} {order.currency} to {order.counterparty.name}?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRelease}
                    disabled={releasing}
                    className="flex-1 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-60"
                  >
                    {releasing ? "Releasing…" : "Yes, Release Funds"}
                  </button>
                  <button
                    onClick={() => setReleaseConfirm(false)}
                    className="flex-1 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleRelease}
                className="w-full py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircleIcon className="w-4 h-4" />
                Release Escrow
              </button>
            )}
          </>
        )}
        {isBuying && order.canDispute && (
          <>
            {showDisputeForm ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-xs font-semibold text-red-700 mb-2">Describe the issue:</p>
                <textarea
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  placeholder="Explain why you're raising a dispute…"
                  rows={3}
                  className="w-full text-xs border border-red-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleDispute}
                    disabled={disputing || !disputeReason.trim()}
                    className="flex-1 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-60"
                  >
                    {disputing ? "Submitting…" : "Submit Dispute"}
                  </button>
                  <button
                    onClick={() => { setShowDisputeForm(false); setDisputeReason(""); }}
                    className="flex-1 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleDispute}
                className="w-full py-2 text-sm font-semibold border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ExclamationTriangleIcon className="w-4 h-4" />
                Raise Dispute
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, isBuying }: { order: Order; isBuying: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status];
  const isOverdue = order.deliveryDue && new Date(order.deliveryDue) < new Date() && !["completed", "disputed", "refunded", "cancelled"].includes(order.status);

  return (
    <div className={`bg-white rounded-2xl border ${order.status === "disputed" ? "border-red-200" : "border-gray-200"} shadow-sm hover:shadow-md transition-shadow overflow-hidden`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <Avatar initials={order.counterparty.avatar} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">{order.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{isBuying ? "Seller:" : "Buyer:"} {order.counterparty.name}</span>
                  <span className="text-xs text-gray-400">{order.counterparty.handle}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={order.status} />
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.type === "service" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"}`}>
                  {order.type === "service" ? "Service" : "Product"}
                </span>
              </div>
            </div>

            {/* Amount + meta */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <div>
                <span className="text-lg font-bold text-gray-900">{order.amount}</span>
                <span className="text-sm text-gray-500 ml-1">{order.currency}</span>
              </div>
              <span className="text-xs text-gray-400">Fee: {order.fee} {order.currency}</span>
              <span className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
              </span>
              {order.deliveryDue && (
                <span className={`text-xs font-medium ${isOverdue ? "text-red-500" : "text-gray-500"}`}>
                  {isOverdue ? "⚠ Overdue · " : "Due: "}
                  {format(new Date(order.deliveryDue), "MMM d, yyyy")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mt-3 line-clamp-2">{order.description}</p>

        {/* Order ID */}
        <p className="text-xs text-gray-400 mt-2 font-mono">
          {order.id} · {order.stripePaymentId}
        </p>

        {/* Cancel quick action */}
        {order.canCancel && (
          <div className="mt-3">
            <button
              onClick={() => alert("Order cancellation request submitted.")}
              className="text-xs text-red-500 hover:text-red-700 font-medium underline underline-offset-2 transition-colors"
            >
              Cancel Order
            </button>
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-center gap-1.5 py-2 bg-gray-50 hover:bg-gray-100 border-t border-gray-100 text-xs font-medium text-gray-500 transition-colors"
      >
        {expanded ? (
          <>Hide details <ChevronUpIcon className="w-3.5 h-3.5" /></>
        ) : (
          <>View details <ChevronDownIcon className="w-3.5 h-3.5" /></>
        )}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-5 pb-5 bg-white border-t border-gray-100">
          <Timeline events={order.timeline} />
          <EscrowPanel order={order} isBuying={isBuying} />
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
        {tab === "buying" ? (
          <ShoppingBagIcon className="w-8 h-8 text-indigo-400" />
        ) : (
          <TagIcon className="w-8 h-8 text-indigo-400" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-1">No orders yet</h3>
      <p className="text-sm text-gray-500 max-w-xs">
        {tab === "buying"
          ? "When you purchase a service or product, your orders will appear here."
          : "When someone buys from you, their orders will appear here."}
      </p>
    </div>
  );
}

const ALL_STATUSES: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "in_progress", label: "In Progress" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "disputed", label: "Disputed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<Tab>("buying");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const orders = activeTab === "buying" ? MOCK_BUYING : MOCK_SELLING;

  const filtered = filterStatus === "all"
    ? orders
    : orders.filter(o => o.status === filterStatus);

  const stats = {
    total: orders.length,
    active: orders.filter(o => ["pending", "paid", "in_progress", "delivered"].includes(o.status)).length,
    completed: orders.filter(o => o.status === "completed").length,
    disputed: orders.filter(o => o.status === "disputed").length,
    escrow: orders
      .filter(o => !["completed", "cancelled", "refunded"].includes(o.status))
      .reduce((s, o) => s + o.escrowAmount, 0),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-0">
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Track your purchases and sales with escrow protection.</p>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: "Total", value: stats.total, color: "text-gray-900" },
              { label: "Active", value: stats.active, color: "text-indigo-600" },
              { label: "Completed", value: stats.completed, color: "text-emerald-600" },
              { label: "In Escrow", value: `${stats.escrow.toFixed(2)} ₮`, color: "text-violet-600" },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex mt-6 gap-0 border-b border-gray-200">
            {([
              { id: "buying" as Tab, label: "Buying", icon: <ShoppingBagIcon className="w-4 h-4" /> },
              { id: "selling" as Tab, label: "Selling", icon: <TagIcon className="w-4 h-4" /> },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setFilterStatus("all"); }}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === t.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.icon}
                {t.label}
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  activeTab === t.id ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-500"
                }`}>
                  {t.id === "buying" ? MOCK_BUYING.length : MOCK_SELLING.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex gap-2 overflow-x-auto scrollbar-none">
          {ALL_STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterStatus === s.value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.label}
              {s.value !== "all" && (
                <span className="ml-1 opacity-75">
                  ({orders.filter(o => o.status === s.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Order list */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {filtered.length === 0 ? (
          filterStatus === "all" ? (
            <EmptyState tab={activeTab} />
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500 text-sm">No {filterStatus.replace("_", " ")} orders.</p>
              <button
                onClick={() => setFilterStatus("all")}
                className="mt-3 text-sm text-indigo-600 hover:underline"
              >
                Clear filter
              </button>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map(order => (
              <OrderCard key={order.id} order={order} isBuying={activeTab === "buying"} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

