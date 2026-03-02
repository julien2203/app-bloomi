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

  // Parser les photos JSON si nécessaire
  if (data && typeof data.photos === 'string') {
    data.photos = JSON.parse(data.photos);
  }

  return data;
}

// ============================================
// 3. INBOX THREADS (v_thread_list)
// ============================================

export async function getInboxThreads(params?: {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}) {
  const { page = 1, pageSize = 50, unreadOnly = false } = params || {};
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // RLS filtre automatiquement selon auth.uid()
  let query = supabase
    .from('v_thread_list')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('thread_created_at', { ascending: false })
    .range(from, to);

  if (unreadOnly) {
    // Filtrer les threads avec messages non lus
    query = query.is('last_message_read_at', null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  // Enrichir avec other_participant_name/avatar selon l'utilisateur connecté
  const { data: { user } } = await supabase.auth.getUser();
  const enrichedData = (data || []).map((thread) => {
    const isBuyer = thread.buyer_id === user?.id;
    return {
      ...thread,
      other_participant_name: isBuyer 
        ? thread.seller_display_name 
        : thread.buyer_display_name,
      other_participant_avatar: isBuyer 
        ? thread.seller_avatar_url 
        : thread.buyer_avatar_url
    };
  });

  return {
    data: enrichedData,
    hasMore: (data?.length || 0) === pageSize,
    page,
    pageSize
  };
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
  const sortedData = (data || []).reverse();

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
  other_participant_name?: string | null;
  other_participant_avatar?: string | null;
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
