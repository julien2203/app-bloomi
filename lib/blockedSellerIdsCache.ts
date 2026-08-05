import { supabase } from './supabase';

type BlockedCacheEntry = {
  userId: string;
  revision: number;
  ids: string[];
};

let cache: BlockedCacheEntry | null = null;
let cacheRevision = 0;

export function invalidateBlockedSellerIdsCache(): void {
  cache = null;
}

export function bumpBlockedSellerIdsCacheRevision(): void {
  cacheRevision += 1;
  cache = null;
}

/** IDs vendeurs bloqués — cache session (invalidé au block/unblock). */
export async function getBlockedSellerIdsForCurrentUser(
  knownUserId?: string | null
): Promise<string[]> {
  let userId = knownUserId?.trim() || null;
  if (!userId) {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }
  if (!userId) return [];

  if (cache?.userId === userId && cache.revision === cacheRevision) {
    return cache.ids;
  }

  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);

  if (error) return [];

  const ids = (data || [])
    .map((row: { blocked_id?: string | null }) => String(row.blocked_id ?? ''))
    .filter(Boolean);

  cache = { userId, revision: cacheRevision, ids };
  return ids;
}
