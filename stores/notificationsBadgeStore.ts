import { create } from 'zustand';
import { syncAppIconBadge } from '../lib/appIconBadge';

type NotificationsBadgeState = {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  decrementUnread: (by?: number) => void;
  incrementUnread: (by?: number) => void;
};

function normalizeCount(n: number): number {
  return Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
}

function applyUnreadCount(next: number): number {
  const n = normalizeCount(next);
  void syncAppIconBadge(n);
  return n;
}

export const useNotificationsBadgeStore = create<NotificationsBadgeState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: applyUnreadCount(n) }),
  decrementUnread: (by = 1) => {
    const delta = typeof by === 'number' && by > 0 ? Math.floor(by) : 1;
    set((s) => ({ unreadCount: applyUnreadCount(s.unreadCount - delta) }));
  },
  incrementUnread: (by = 1) => {
    const delta = typeof by === 'number' && by > 0 ? Math.floor(by) : 1;
    set((s) => ({ unreadCount: applyUnreadCount(s.unreadCount + delta) }));
  }
}));
