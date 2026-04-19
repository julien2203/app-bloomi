import { create } from 'zustand';

type UnreadMessagesState = {
  /** Nombre de threads distincts ayant au moins un message non lu (autre que l’utilisateur). */
  unreadThreadsCount: number;
  setUnreadThreadsCount: (n: number) => void;
};

export const useUnreadMessagesStore = create<UnreadMessagesState>((set) => ({
  unreadThreadsCount: 0,
  setUnreadThreadsCount: (n) =>
    set({
      unreadThreadsCount: Math.max(0, Math.floor(Number.isFinite(n) ? n : 0))
    })
}));
