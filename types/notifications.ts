
export type NotificationType =
  | "new_message"
  | "order_placed"
  | "trust_earned"
  | "review_received"
  | "gig_liked";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  href?: string;
  meta?: {
    senderName?: string;
    senderAvatar?: string;
    gigTitle?: string;
    orderId?: string;
    trustPoints?: number;
    rating?: number;
  };
}

export interface NotificationPreferences {
  new_message: boolean;
  order_placed: boolean;
  trust_earned: boolean;
  review_received: boolean;
  gig_liked: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  digestEmail: "never" | "daily" | "weekly";
}

export interface NotificationStore {
  notifications: Notification[];
  preferences: NotificationPreferences;
  unreadCount: number;
}

