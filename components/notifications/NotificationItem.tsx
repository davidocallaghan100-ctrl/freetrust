
"use client";

import Link from "next/link";
import Image from "next/image";
import { useNotificationStore } from "@/lib/notifications/store";
import {
  formatRelativeTime,
  getNotificationBg,
  getNotificationColor,
  getNotificationIcon,
} from "@/lib/notifications/helpers";
import type { Notification } from "@/types/notifications";
import styles from "./NotificationItem.module.css";

interface Props {
  notification: Notification;
  onClose?: () => void;
}

export default function NotificationItem({ notification, onClose }: Props) {
  const { markAsRead, removeNotification } = useNotificationStore();

  const handleClick = () => {
    if (!notification.read) markAsRead(notification.id);
    if (onClose) onClose();
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    markAsRead(notification.id);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeNotification(notification.id);
  };

  const iconBg = getNotificationBg(notification.type);
  const iconColor = getNotificationColor(notification.type);
  const emoji = getNotificationIcon(notification.type);

  const content = (
    <div
      className={`${styles.item} ${!notification.read ? styles.unread : ""}`}
      role="listitem"
    >
      {/* Unread dot */}
      {!notification.read && <span className={styles.dot} aria-label="Unread" />}

      {/* Icon / Avatar */}
      <div className={styles.iconWrap}>
        {notification.meta?.senderAvatar ? (
          <div className={styles.avatarContainer}>
            <Image
              src={notification.meta.senderAvatar}
              alt={notification.meta.senderName ?? "User"}
              width={40}
              height={40}
              className={styles.avatar}
            />
            <span
              className={styles.emojiOverlay}
              style={{ background: iconBg, color: iconColor }}
            >
              {emoji}
            </span>
          </div>
        ) : (
          <span
            className={styles.iconCircle}
            style={{ background: iconBg, color: iconColor }}
          >
            {emoji}
          </span>
        )}
      </div>

      {/* Content */}
      <div className={styles.body}>
        <p className={styles.title}>{notification.title}</p>
        <p className={styles.message}>{notification.message}</p>

        <div className={styles.meta}>
          <span className={styles.time}>
            {formatRelativeTime(notification.createdAt)}
          </span>
          {notification.meta?.trustPoints && (
            <span className={styles.badge} style={{ background: "#fef3c7", color: "#d97706" }}>
              +{notification.meta.trustPoints} Trust
            </span>
          )}
          {notification.meta?.rating && (
            <span className={styles.badge} style={{ background: "#ede9fe", color: "#7c3aed" }}>
              {"★".repeat(notification.meta.rating)}
            </span>
          )}
          {notification.meta?.orderId && (
            <span className={styles.badge} style={{ background: "#d1fae5", color: "#059669" }}>
              #{notification.meta.orderId}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {!notification.read && (
          <button
            className={styles.actionBtn}
            onClick={handleMarkRead}
            title="Mark as read"
            aria-label="Mark as read"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        )}
        <button
          className={`${styles.actionBtn} ${styles.removeBtn}`}
          onClick={handleRemove}
          title="Remove notification"
          aria-label="Remove notification"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );

  if (notification.href) {
    return (
      <Link href={notification.href} className={styles.link} onClick={handleClick}>
        {content}
      </Link>
    );
  }

  return (
    <button className={styles.link} onClick={handleClick}>
      {content}
    </button>
  );
}

