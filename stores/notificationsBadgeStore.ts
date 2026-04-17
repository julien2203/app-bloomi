import { create } from 'zustand';

type NotificationsBadgeState = {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  decrementUnread: (by?: number) => void;
  incrementUnread: (by?: number) => void;
};

export const useNotificationsBadgeStore = create<NotificationsBadgeState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)) }),
  decrementUnread: (by = 1) => {
    const delta = typeof by === 'number' && by > 0 ? Math.floor(by) : 1;
    set((s) => ({ unreadCount: Math.max(0, s.unreadCount - delta) }));
  },
  incrementUnread: (by = 1) => {
    const delta = typeof by === 'number' && by > 0 ? Math.floor(by) : 1;
    set((s) => ({ unreadCount: s.unreadCount + delta }));
  }
}));
