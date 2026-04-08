
import type { NotificationType } from "@/types/notifications";

export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    new_message: "💬",
    order_placed: "🛒",
    trust_earned: "⭐",
    review_received: "🌟",
    gig_liked: "❤️",
  };
  return icons[type];
}

export function getNotificationColor(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    new_message: "#6366f1",
    order_placed: "#10b981",
    trust_earned: "#f59e0b",
    review_received: "#8b5cf6",
    gig_liked: "#ef4444",
  };
  return colors[type];
}

export function getNotificationBg(type: NotificationType): string {
  const bgs: Record<NotificationType, string> = {
    new_message: "#eef2ff",
    order_placed: "#d1fae5",
    trust_earned: "#fef3c7",
    review_received: "#ede9fe",
    gig_liked: "#fee2e2",
  };
  return bgs[type];
}

export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getTypeLabel(type: NotificationType): string {
  const labels: Record<NotificationType, string> = {
    new_message: "Messages",
    order_placed: "Orders",
    trust_earned: "Trust",
    review_received: "Reviews",
    gig_liked: "Likes",
  };
  return labels[type];
}

