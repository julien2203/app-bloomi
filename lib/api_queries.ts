/**
 * Requêtes Supabase optimisées utilisant les views SQL
 * Prêtes à coller dans votre code
 */

import { supabase } from './supabase';

// ============================================
// 1. FEED PAGINÉ (v_feed_listings)
// ============================================

export async function getFeedListingsPaginated(params: {
  page?: number;
  pageSize?: number;
  category?: string;
  city?: string;
  countryCode?: string;
}) {
  const { page = 1, pageSize = 20, category, city, countryCode } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('v_feed_listings')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (category) {
    query = query.eq('category', category);
  }

  if (city) {
    query = query.ilike('listing_city', `%${city}%`);
  }

  if (countryCode) {
    query = query.eq('listing_country', countryCode);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    data: data || [],
    hasMore: (data?.length || 0) === pageSize,
    page,
    pageSize
  };
}

// ============================================
// 2. LISTING DETAIL (v_listing_detail)
// ============================================

export async function getListingDetailById(listingId: string) {
  const { data, error } = await supabase
    .from('v_listing_detail')
    .select('*')
    .eq('id', listingId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) return data;

  const photos =
    typeof data.photos === 'string' ? JSON.parse(data.photos) : data.photos;

  return { ...data, photos };
}

// ============================================
// 3. INBOX THREADS (v_thread_list)
// ============================================

function isThreadVisibleForUser(
  thread: {
    buyer_id?: string | null;
    seller_id?: string | null;
    buyer_hidden_at?: string | null;
    seller_hidden_at?: string | null;
  },
  userId: string
): boolean {
  if (thread.buyer_id === userId) {
    return !thread.buyer_hidden_at;
  }
  if (thread.seller_id === userId) {
    return !thread.seller_hidden_at;
  }
  return false;
}

/** Marque comme lus tous les messages reçus (y compris système) dans un thread. */
export async function markThreadMessagesAsRead(
  threadId: string,
  userId: string
): Promise<{ ok: boolean; updatedCount: number }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: now })
    .eq('thread_id', threadId)
    .neq('sender_id', userId)
    .is('read_at', null)
    .select('id');

  if (error) {
    return { ok: false, updatedCount: 0 };
  }
  return { ok: true, updatedCount: data?.length ?? 0 };
}

/** Threads distincts où il existe au moins un message read_at IS NULL et sender_id != utilisateur. */
export async function fetchUnreadThreadsCount(userId: string): Promise<number> {
  const { data: threads, error: threadsError } = await supabase
    .from('threads')
    .select('id, buyer_id, seller_id, buyer_hidden_at, seller_hidden_at')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

  if (threadsError) throw threadsError;

  const visibleThreadIds = (threads ?? [])
    .filter((row) => isThreadVisibleForUser(row as any, userId))
    .map((row) => String((row as { id?: string }).id ?? ''))
    .filter(Boolean);

  if (visibleThreadIds.length === 0) return 0;

  const { data, error } = await supabase
    .from('messages')
    .select('thread_id')
    .in('thread_id', visibleThreadIds)
    .is('read_at', null)
    .neq('sender_id', userId)
    .or('is_system.is.false,is_system.is.null');
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    const tid = (row as { thread_id?: string }).thread_id;
    if (tid) set.add(tid);
  }
  return set.size;
}

async function getUnreadThreadIdsForThreadList(userId: string, threadIds: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  const chunkSize = 80;
  for (let i = 0; i < threadIds.length; i += chunkSize) {
    const chunk = threadIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('messages')
      .select('thread_id')
      .in('thread_id', chunk)
      .is('read_at', null)
      .neq('sender_id', userId)
      .or('is_system.is.false,is_system.is.null');
    if (error) throw error;
    for (const row of data ?? []) {
      const tid = (row as { thread_id?: string }).thread_id;
      if (tid) result.add(tid);
    }
  }
  return result;
}

async function attachUnreadFlagsToThreads(
  threads: Array<{ thread_id: string } & Record<string, unknown>>,
  userId: string
) {
  const ids = threads.map((t) => t.thread_id).filter(Boolean);
  if (ids.length === 0) return threads;
  const unreadIds = await getUnreadThreadIdsForThreadList(userId, ids);
  return threads.map((t) => ({
    ...t,
    has_unread_from_other: unreadIds.has(t.thread_id)
  }));
}

export async function getInboxThreads(params?: {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}) {
  const { page = 1, pageSize = 50, unreadOnly = false } = params || {};
  const base = await getInboxThreadsBase({ page, pageSize, unreadOnly });
  const withUnread =
    base.userId && base.data.length > 0
      ? await attachUnreadFlagsToThreads(base.data as any, base.userId)
      : base.data;

  return {
    data: withUnread,
    hasMore: base.hasMore,
    page: base.page,
    pageSize: base.pageSize
  };
}

export async function getInboxThreadsBase(params?: {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}) {
  const { page = 1, pageSize = 50, unreadOnly = false } = params || {};
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return {
      data: [],
      hasMore: false,
      page,
      pageSize,
      userId: null
    };
  }

  const userId = user.id;

  let query = supabase
    .from('v_thread_list')
    .select('*')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .not('last_message_id', 'is', null)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('thread_created_at', { ascending: false })
    .range(from, to);

  if (unreadOnly) {
    query = query.is('last_message_read_at', null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const enrichedData = (data || [])
    .map((thread) => {
      const isBuyer = thread.buyer_id === userId;
      return {
        ...thread,
        other_participant_name: isBuyer
          ? thread.seller_display_name
          : thread.buyer_display_name,
        other_participant_avatar: isBuyer
          ? thread.seller_avatar_url
          : thread.buyer_avatar_url
      };
    })
    .filter((thread) => isThreadVisibleForUser(thread, userId));

  return {
    data: enrichedData,
    hasMore: (data?.length || 0) === pageSize,
    page,
    pageSize,
    userId
  };
}

export async function attachUnreadFlagsForInboxThreads(
  threads: ThreadListItem[],
  userId: string
): Promise<ThreadListItem[]> {
  if (!userId || threads.length === 0) return threads;
  return (await attachUnreadFlagsToThreads(threads as any, userId)) as ThreadListItem[];
}

// ============================================
// 4. MESSAGES D'UN THREAD (pagination)
// ============================================

export async function getThreadMessages(params: {
  threadId: string;
  page?: number;
  pageSize?: number;
  beforeMessageId?: string; // Pour pagination cursor-based
}) {
  const { threadId, page = 1, pageSize = 50, beforeMessageId } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('messages')
    .select(`
      id,
      thread_id,
      sender_id,
      body,
      read_at,
      created_at,
      sender:profiles!messages_sender_id_fkey (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false }) // Plus récent en premier
    .range(from, to);

  // Pagination cursor-based optionnelle
  if (beforeMessageId) {
    const { data: beforeMessage } = await supabase
      .from('messages')
      .select('created_at')
      .eq('id', beforeMessageId)
      .single();

    if (beforeMessage) {
      query = query.lt('created_at', beforeMessage.created_at);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  // Inverser l'ordre pour afficher du plus ancien au plus récent
  const sortedData = [...(data || [])].reverse();

  return {
    data: sortedData,
    hasMore: (data?.length || 0) === pageSize,
    page,
    pageSize
  };
}

// ============================================
// TYPES (optionnel, pour TypeScript strict)
// ============================================

export type FeedListing = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  status: string;
  category: string | null;
  condition: string | null;
  delivery_mode: string;
  city: string | null;
  country_code: string | null;
  created_at: string;
  published_at: string | null;
  updated_at: string;
  cover_photo_url: string | null;
  cover_photo_order: number | null;
  seller_display_name: string | null;
  seller_avatar_url: string | null;
  listing_city: string;
  listing_country: string;
};

export type ThreadListItem = {
  thread_id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  thread_created_at: string;
  last_message_at: string | null;
  listing_title: string;
  listing_price: number;
  listing_status: string;
  listing_cover_photo_url: string | null;
  last_message_id: string | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  last_message_created_at: string | null;
  last_message_read_at: string | null;
  last_message_sender_name: string | null;
  last_message_sender_avatar: string | null;
  buyer_display_name: string | null;
  buyer_avatar_url: string | null;
  seller_display_name: string | null;
  seller_avatar_url: string | null;
  buyer_hidden_at?: string | null;
  seller_hidden_at?: string | null;
  other_participant_name?: string | null;
  other_participant_avatar?: string | null;
  /** Au moins un message non lu envoyé par l’interlocuteur (read_at null, sender != moi). */
  has_unread_from_other?: boolean;
};

export type ListingDetail = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  status: string;
  category: string | null;
  condition: string | null;
  delivery_mode: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country_code: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  sold_at: string | null;
  seller_display_name: string | null;
  seller_avatar_url: string | null;
  seller_country: string;
  photos: Array<{
    id: string;
    url: string;
    order_index: number;
    created_at: string;
  }>;
};

export type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  sender: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};
