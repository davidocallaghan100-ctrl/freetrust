
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Notification,
  NotificationPreferences,
  NotificationType,
} from "@/types/notifications";

export interface NotificationState {
  notifications: Notification[];
  preferences: NotificationPreferences;
  unreadCount: number;
  addNotification: (
    notification: Omit<Notification, "id" | "createdAt" | "read">
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
}

const defaultPreferences: NotificationPreferences = {
  new_message: true,
  order_placed: true,
  trust_earned: true,
  review_received: true,
  gig_liked: true,
  emailNotifications: true,
  pushNotifications: false,
  digestEmail: "daily",
};

const seedNotifications: Notification[] = [
  {
    id: "notif-1",
    type: "new_message",
    title: "New message from Alex",
    message: "Hey! I saw your gig and I'm interested. Can we discuss the scope?",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    href: "/messages",
    meta: {
      senderName: "Alex Rivera",
      senderAvatar: "https://i.pravatar.cc/40?img=12",
    },
  },
  {
    id: "notif-2",
    type: "order_placed",
    title: "New order received!",
    message: "Sarah Johnson placed an order for 'Full-Stack Web App Development'.",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    href: "/orders",
    meta: {
      orderId: "ORD-20481",
      gigTitle: "Full-Stack Web App Development",
      senderName: "Sarah Johnson",
    },
  },
  {
    id: "notif-3",
    type: "trust_earned",
    title: "Trust points earned",
    message: "You earned 25 Trust points for completing order ORD-20472 on time.",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    href: "/profile/trust",
    meta: { trustPoints: 25 },
  },
  {
    id: "notif-4",
    type: "review_received",
    title: "New review on your gig",
    message: "Marcus left a 5-star review on your 'UI/UX Design Sprint' gig.",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    href: "/gigs",
    meta: {
      senderName: "Marcus Lee",
      gigTitle: "UI/UX Design Sprint",
      rating: 5,
    },
  },
  {
    id: "notif-5",
    type: "gig_liked",
    title: "Someone liked your gig",
    message: "Your gig 'React Component Library' received a new like.",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    href: "/gigs",
    meta: { gigTitle: "React Component Library" },
  },
];

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: seedNotifications,
      preferences: defaultPreferences,
      unreadCount: seedNotifications.filter((n) => !n.read).length,

      addNotification: (notification) => {
        const { preferences } = get();
        if (!preferences[notification.type as NotificationType]) return;

        const newNotif: Notification = {
          ...notification,
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotif, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));
      },

      markAsRead: (id) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          return {
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
          };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      removeNotification: (id) => {
        set((state) => {
          const notifications = state.notifications.filter((n) => n.id !== id);
          return {
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
          };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      updatePreferences: (prefs) => {
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        }));
      },
    }),
    {
      name: "freetrust-notifications",
      partialize: (state) => ({
        notifications: state.notifications,
        preferences: state.preferences,
        unreadCount: state.unreadCount,
      }),
    }
  )
);

