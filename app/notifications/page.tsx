"use client";

import { useState, useEffect } from "react";
import {
  BellIcon,
  CheckIcon,
  TrashIcon,
  Cog6ToothIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  StarIcon,
  ChatBubbleLeftIcon,
  BanknotesIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { BellAlertIcon } from "@heroicons/react/24/solid";
import { formatDistanceToNow } from "date-fns";

type NotifCategory = "all" | "orders" | "community" | "reviews" | "messages" | "payments" | "system";
type NotifType = "order" | "community" | "review" | "message" | "payment" | "system";

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: Date;
  avatarUrl?: string;
  actorName?: string;
}

interface PrefState {
  orders: boolean;
  community: boolean;
  reviews: boolean;
  messages: boolean;
  payments: boolean;
  system: boolean;
  emailDigest: boolean;
  pushEnabled: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "order",
    title: "Order #FT-2041 dispatched",
    body: "Your order for \"Logo Design Package\" has been dispatched by the seller.",
    href: "/orders/FT-2041",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 8),
    actorName: "DesignPro Studio",
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=DesignPro",
  },
  {
    id: "n2",
    type: "payment",
    title: "Escrow released — ₮340",
    body: "Funds for order #FT-2039 have been released to your wallet.",
    href: "/orders/FT-2039",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 35),
    actorName: "FreeTrust Escrow",
  },
  {
    id: "n3",
    type: "review",
    title: "New 5-star review",
    body: "Alex M. left a glowing review on your \"SEO Audit\" service.",
    href: "/services/seo-audit/reviews",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    actorName: "Alex M.",
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=AlexM",
  },
  {
    id: "n4",
    type: "community",
    title: "Your post is trending 🔥",
    body: "\"Best practices for remote freelancing\" has 47 upvotes in the last hour.",
    href: "/community/post/best-practices-remote",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: "n5",
    type: "message",
    title: "New message from Sarah K.",
    body: "\"Hey! Quick question about your branding package — do you offer...",
    href: "/messages/sarah-k",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    actorName: "Sarah K.",
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=SarahK",
  },
  {
    id: "n6",
    type: "order",
    title: "Dispute opened on #FT-2035",
    body: "A buyer has opened a dispute. Please respond within 48 hours.",
    href: "/orders/FT-2035",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    actorName: "FreeTrust Support",
  },
  {
    id: "n7",
    type: "system",
    title: "You earned a Trust Badge 🏅",
    body: "Congratulations! You've reached 100 successful orders and earned the \"Century\" badge.",
    href: "/profile/badges",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
  },
  {
    id: "n8",
    type: "payment",
    title: "₮5 trust bonus credited",
    body: "You received a ₮5 trust bonus for completing your first purchase.",
    href: "/wallet",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
  },
  {
    id: "n9",
    type: "community",
    title: "New follower",
    body: "Jordan T. started following your organisation.",
    href: "/organisations/your-org/followers",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96),
    actorName: "Jordan T.",
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=JordanT",
  },
  {
    id: "n10",
    type: "review",
    title: "Respond to a 3-star review",
    body: "Marcus L. left feedback on \"Website Speed Optimisation\" — consider replying.",
    href: "/services/website-speed/reviews",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120),
    actorName: "Marcus L.",
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=MarcusL",
  },
];

const DEFAULT_PREFS: PrefState = {
  orders: true,
  community: true,
  reviews: true,
  messages: true,
  payments: true,
  system: true,
  emailDigest: true,
  pushEnabled: false,
};

const CATEGORY_MAP: Record<NotifType, NotifCategory> = {
  order: "orders",
  payment: "payments",
  review: "reviews",
  message: "messages",
  community: "community",
  system: "system",
};

const TYPE_ICON: Record<NotifType, React.ReactNode> = {
  order: <ShoppingBagIcon className="w-5 h-5" />,
  community: <UserGroupIcon className="w-5 h-5" />,
  review: <StarIcon className="w-5 h-5" />,
  message: <ChatBubbleLeftIcon className="w-5 h-5" />,
  payment: <BanknotesIcon className="w-5 h-5" />,
  system: <ExclamationCircleIcon className="w-5 h-5" />,
};

const TYPE_COLOR: Record<NotifType, string> = {
  order: "bg-blue-100 text-blue-600",
  community: "bg-purple-100 text-purple-600",
  review: "bg-yellow-100 text-yellow-600",
  message: "bg-green-100 text-green-600",
  payment: "bg-emerald-100 text-emerald-600",
  system: "bg-orange-100 text-orange-600",
};

const TABS: { key: NotifCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "orders", label: "Orders" },
  { key: "payments", label: "Payments" },
  { key: "messages", label: "Messages" },
  { key: "reviews", label: "Reviews" },
  { key: "community", label: "Community" },
  { key: "system", label: "System" },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState<NotifCategory>("all");
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<PrefState>(DEFAULT_PREFS);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (activeTab === "all") return true;
    return CATEGORY_MAP[n.type] === activeTab;
  });

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotif = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearRead = () => {
    setNotifications((prev) => prev.filter((n) => !n.read));
  };

  const savePrefs = () => {
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  const togglePref = (key: keyof PrefState) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {unreadCount > 0 ? (
              <BellAlertIcon className="w-7 h-7 text-indigo-600" />
            ) : (
              <BellIcon className="w-7 h-7 text-gray-500" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-sm text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <CheckIcon className="w-4 h-4" />
                Mark all read
              </button>
            )}
            <button
              onClick={clearRead}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
              Clear read
            </button>
            <button
              onClick={() => setShowPrefs(!showPrefs)}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                showPrefs
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Cog6ToothIcon className="w-4 h-4" />
              Preferences
            </button>
          </div>
        </div>

        {/* Preferences Panel */}
        {showPrefs && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Notification Preferences
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {(
                [
                  { key: "orders", label: "Order updates", desc: "Dispatch, delivery, disputes" },
                  { key: "payments", label: "Payment & escrow", desc: "Releases, refunds, bonuses" },
                  { key: "messages", label: "Direct messages", desc: "New messages from buyers/sellers" },
                  { key: "reviews", label: "Reviews", desc: "New ratings on your services" },
                  { key: "community", label: "Community", desc: "Followers, trending posts" },
                  { key: "system", label: "System alerts", desc: "Badges, account notices" },
                ] as { key: keyof PrefState; label: string; desc: string }[]
              ).map(({ key, label, desc }) => (
                <label
                  key={key}
                  className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 cursor-pointer transition-colors"
                >
                  <div className="mt-0.5">
                    <div
                      onClick={() => togglePref(key)}
                      className={`w-10 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors ${
                        prefs[key] ? "bg-indigo-600" : "bg-gray-300"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          prefs[key] ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Delivery</p>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => togglePref("emailDigest")}
                    className={`w-10 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors ${
                      prefs.emailDigest ? "bg-indigo-600" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        prefs.emailDigest ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email digest</p>
                    <p className="text-xs text-gray-500">Daily summary to your inbox</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => togglePref("pushEnabled")}
                    className={`w-10 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors ${
                      prefs.pushEnabled ? "bg-indigo-600" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        prefs.pushEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Push notifications</p>
                    <p className="text-xs text-gray-500">Browser push alerts (requires permission)</p>
                  </div>
                </label>
              </div>
            </div>
            <button
              onClick={savePrefs}
              className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${
                prefsSaved
                  ? "bg-green-500 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {prefsSaved ? "✓ Saved!" : "Save preferences"}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1 scrollbar-hide">
          {TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? notifications.filter((n) => !n.read).length
                : notifications.filter(
                    (n) => CATEGORY_MAP[n.type] === tab.key && !n.read
                  ).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      activeTab === tab.key
                        ? "bg-white/20 text-white"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No notifications here</p>
              <p className="text-sm text-gray-400 mt-1">
                You&apos;re all caught up in this category.
              </p>
            </div>
          )}

          {filtered.map((notif) => (
            <NotificationCard
              key={notif.id}
              notif={notif}
              onRead={markRead}
              onDelete={deleteNotif}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationCard({
  notif,
  onRead,
  onDelete,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all ${
        notif.read
          ? "bg-white border-gray-200"
          : "bg-indigo-50/60 border-indigo-200 shadow-sm"
      }`}
    >
      {/* Unread dot */}
      {!notif.read && (
        <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-indigo-500 shadow" />
      )}

      {/* Avatar or Icon */}
      <div className="shrink-0 mt-0.5">
        {notif.avatarUrl ? (
          <img
            src={notif.avatarUrl}
            alt={notif.actorName ?? ""}
            className="w-10 h-10 rounded-full object-cover bg-gray-100"
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${TYPE_COLOR[notif.type]}`}
          >
            {TYPE_ICON[notif.type]}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[notif.type]}`}
          >
            {TYPE_ICON[notif.type]}
            <span className="capitalize">{notif.type}</span>
          </span>
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
          </span>
        </div>
        <p className={`text-sm font-semibold ${notif.read ? "text-gray-700" : "text-gray-900"}`}>
          {notif.title}
        </p>
        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          <a
            href={notif.href}
            onClick={() => onRead(notif.id)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View →
          </a>
          {!notif.read && (
            <button
              onClick={() => onRead(notif.id)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(notif.id)}
        className="absolute top-3 right-7 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500"
        aria-label="Delete notification"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

