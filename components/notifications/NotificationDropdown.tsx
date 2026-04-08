
"use client";

import { useState } from "react";
import Link from "next/link";
import { useNotificationStore } from "@/lib/notifications/store";
import NotificationItem from "./NotificationItem";
import styles from "./NotificationDropdown.module.css";
import type { Notification, NotificationType } from "@/types/notifications";

const FILTERS: { label: string; value: "all" | NotificationType }[] = [
  { label: "All", value: "all" },
  { label: "Messages", value: "new_message" },
  { label: "Orders", value: "order_placed" },
  { label: "Trust", value: "trust_earned" },
  { label: "Reviews", value: "review_received" },
  { label: "Likes", value: "gig_liked" },
];

interface Props {
  onClose: () => void;
}

export default function NotificationDropdown({ onClose }: Props) {
  const [filter, setFilter] = useState<"all" | NotificationType>("all");
  const { notifications, unreadCount, markAllAsRead, clearAll } =
    useNotificationStore();

  const filtered =
    filter === "all"
      ? notifications
      : notifications.filter((n: Notification) => n.type === filter);

  const unreadFiltered = filtered.filter((n: Notification) => !n.read).length;

  return (
    <div className={styles.dropdown} role="dialog" aria-label="Notifications">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Notifications</h2>
          {unreadCount > 0 && (
            <span className={styles.unreadPill}>{unreadCount} new</span>
          )}
        </div>
        <div className={styles.headerActions}>
          {unreadFiltered > 0 && (
            <button
              className={styles.actionBtn}
              onClick={markAllAsRead}
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              className={`${styles.actionBtn} ${styles.clearBtn}`}
              onClick={clearAll}
              title="Clear all notifications"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className={styles.filters} role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            className={`${styles.filterTab} ${
              filter === f.value ? styles.filterTabActive : ""
            }`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className={styles.list} role="list">
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🔔</span>
            <p className={styles.emptyTitle}>No notifications</p>
            <p className={styles.emptySubtitle}>
              {filter === "all"
                ? "You're all caught up!"
                : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} notifications.`}
            </p>
          </div>
        ) : (
          filtered.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClose={onClose}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <Link
          href="/notifications"
          className={styles.viewAll}
          onClick={onClose}
        >
          View all notifications
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href="/settings/notifications"
          className={styles.settingsLink}
          onClick={onClose}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
          Preferences
        </Link>
      </div>
    </div>
  );
}

