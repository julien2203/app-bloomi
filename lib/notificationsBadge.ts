import { supabase } from './supabase';
import { useNotificationsBadgeStore } from '../stores/notificationsBadgeStore';

/** Recalcule le badge cloche (notifications in-app non lues). */
export async function refreshNotificationsBadge(userId: string | null | undefined): Promise<number> {
  if (!userId) {
    useNotificationsBadgeStore.getState().setUnreadCount(0);
    return 0;
  }
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) throw error;
    const n = count ?? 0;
    useNotificationsBadgeStore.getState().setUnreadCount(n);
    return n;
  } catch {
    return useNotificationsBadgeStore.getState().unreadCount;
  }
}
