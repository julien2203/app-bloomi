import { fetchUnreadThreadsCount } from './api_queries';
import { useUnreadMessagesStore } from '../stores/unreadMessagesStore';

/** Recalcule le badge Messages (threads avec au moins un message non lu de l’interlocuteur). */
export async function refreshUnreadThreadsBadge(userId: string | null | undefined): Promise<number> {
  if (!userId) {
    useUnreadMessagesStore.getState().setUnreadThreadsCount(0);
    return 0;
  }
  try {
    const n = await fetchUnreadThreadsCount(userId);
    useUnreadMessagesStore.getState().setUnreadThreadsCount(n);
    return n;
  } catch {
    return useUnreadMessagesStore.getState().unreadThreadsCount;
  }
}
