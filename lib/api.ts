/**
 * Client API pour interagir avec Supabase
 * Fonctions helper pour les opérations CRUD sur les listings, messages, etc.
 */

import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import type {
  Listing,
  ListingInsert,
  ListingUpdate,
  ListingWithRelations,
  ListingQuery,
  ListingPhoto,
  ListingPhotoInsert,
  Thread,
  ThreadWithRelations,
  Message,
  MessageInsert,
  Order,
  OrderInsert,
  OrderUpdate,
  ApiResponse,
  PaginatedResponse
} from './types';

// ============================================
// TYPES POUR LE FEED
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

// ============================================
// LISTINGS - FEED
// ============================================

/**
 * Récupère les annonces du feed depuis la view v_feed_listings
 * Pagination simple avec limit 20, trié par created_at desc
 */
export async function getFeedListings(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ data: FeedListing[]; error: Error | null }> {
  const { limit = 20, offset = 0 } = params || {};

  try {
    const { data, error } = await supabase
      .from('v_feed_listings')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    return { data: (data || []) as FeedListing[], error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error('Erreur inconnue')
    };
  }
}

// ============================================
// LISTINGS
// ============================================

/**
 * Récupère les annonces publiées avec pagination et filtres
 */
export async function getPublishedListings(
  query: ListingQuery = {}
): Promise<PaginatedResponse<ListingWithRelations>> {
  const {
    page = 1,
    pageSize = 20,
    status = 'published',
    category,
    minPrice,
    maxPrice,
    deliveryMode,
    country,
    city,
    search,
    sortBy = 'published_at',
    sortOrder = 'desc'
  } = query;

  let queryBuilder = supabase
    .from('listings')
    .select(
      `
      *,
      seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url),
      photos:listing_photos(url, order_index)
    `,
      { count: 'exact' }
    )
    .eq('status', status)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1);

  // Filtres optionnels
  if (category) {
    queryBuilder = queryBuilder.eq('category', category);
  }
  if (minPrice !== undefined) {
    queryBuilder = queryBuilder.gte('price', minPrice);
  }
  if (maxPrice !== undefined) {
    queryBuilder = queryBuilder.lte('price', maxPrice);
  }
  if (deliveryMode) {
    queryBuilder = queryBuilder.eq('delivery_mode', deliveryMode);
  }
  if (country) {
    queryBuilder = queryBuilder.eq('country_code', country);
  }
  if (city) {
    queryBuilder = queryBuilder.ilike('city', `%${city}%`);
  }
  if (search) {
    queryBuilder = queryBuilder.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error, count } = await queryBuilder;

  if (error) {
    throw new Error(`Erreur lors de la récupération des annonces: ${error.message}`);
  }

  return {
    data: (data || []) as ListingWithRelations[],
    count: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > page * pageSize
  };
}

/**
 * Type pour le listing detail depuis v_listing_detail
 */
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
  seller_country: string | null;
  photos: Array<{
    id: string;
    url: string;
    order_index: number;
    created_at: string;
  }> | null;
};

/**
 * Récupère une annonce par son ID depuis v_listing_detail
 */
export async function getListingById(id: string): Promise<{ data: ListingDetail | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('v_listing_detail')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as ListingDetail, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Erreur inconnue')
    };
  }
}

/**
 * Récupère une annonce par son ID avec ses relations (ancienne version - gardée pour compatibilité)
 */
export async function getListingByIdWithRelations(id: string): Promise<ApiResponse<ListingWithRelations | null>> {
  const { data, error } = await supabase
    .from('listings')
    .select(
      `
      *,
      seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, country),
      photos:listing_photos(*)
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as ListingWithRelations, error: null };
}

/**
 * Crée une nouvelle annonce
 */
export async function createListing(
  payload: ListingInsert
): Promise<ApiResponse<Listing>> {
  const { data, error } = await supabase
    .from('listings')
    .insert(payload)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Listing, error: null };
}

/**
 * Upload une photo vers Supabase Storage
 * @param file - URI du fichier local ou File object
 * @param userId - ID de l'utilisateur
 * @param listingId - ID du listing
 * @param filename - Nom du fichier
 */
export async function uploadListingPhoto(
  file: { uri: string; type?: string; name?: string },
  userId: string,
  listingId: string,
  filename: string
): Promise<{ data: string | null; error: Error | null }> {
  try {
    // Lire le fichier local en base64 (compatible iOS/Android/Expo)
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
      // Certaines versions d'Expo n'exposent pas EncodingType, on fallback sur la string 'base64'
      encoding: (FileSystem as any).EncodingType?.Base64 ?? 'base64'
    });
    const arrayBuffer = decodeBase64(base64);
    const binary = new Uint8Array(arrayBuffer);
    const fileExt = (filename.split('.').pop() || 'jpg').toLowerCase();
    const filePath = `${userId}/${listingId}/${filename}`;

    // Upload vers Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('listings')
      .upload(filePath, binary, {
        // Forcer un content-type d'image valide pour React Native / navigateurs
        contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
        upsert: false
      });

    if (uploadError) {
      return { data: null, error: new Error(uploadError.message) };
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from('listings')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return { data: null, error: new Error('Impossible de récupérer l\'URL publique') };
    }

    return { data: urlData.publicUrl, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Erreur lors de l\'upload')
    };
  }
}

/**
 * Ajoute une photo à une annonce
 */
export async function addListingPhoto(
  listingId: string,
  url: string,
  orderIndex: number = 0
): Promise<ApiResponse<ListingPhoto>> {
  const { data, error } = await supabase
    .from('listing_photos')
    .insert({
      listing_id: listingId,
      url,
      order_index: orderIndex
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as ListingPhoto, error: null };
}

/**
 * Récupère les annonces de l'utilisateur connecté
 */
export async function getMyListings(): Promise<ApiResponse<Listing[]>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: [], error: new Error('Utilisateur non connecté') };
  }

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return { data: (data || []) as Listing[], error: null };
}

/**
 * Met à jour une annonce appartenant à l'utilisateur connecté
 */
export async function updateListing(
  id: string,
  payload: ListingUpdate
): Promise<ApiResponse<Listing>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('Utilisateur non connecté') };
  }

  const { data, error } = await supabase
    .from('listings')
    .update(payload)
    .eq('id', id)
    .eq('seller_id', user.id)
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as Listing, error: null };
}

/**
 * Supprime une annonce appartenant à l'utilisateur connecté
 */
export async function deleteListing(id: string): Promise<ApiResponse<void>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('Utilisateur non connecté') };
  }

  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', id)
    .eq('seller_id', user.id);

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: null, error: null };
}

// ============================================
// THREADS
// ============================================

/**
 * Récupère les threads de l'utilisateur connecté
 */
export async function getThreads(): Promise<ApiResponse<ThreadWithRelations[]>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: [], error: new Error('Utilisateur non connecté') };
  }

  const { data, error } = await supabase
    .from('threads')
    .select(
      `
      *,
      listing:listings(id, title, price, status),
      buyer:profiles!threads_buyer_id_fkey(id, display_name, avatar_url),
      seller:profiles!threads_seller_id_fkey(id, display_name, avatar_url)
    `
    )
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return { data: (data || []) as ThreadWithRelations[], error: null };
}

// ============================================
// MESSAGES
// ============================================

/**
 * Récupère les messages d'un thread
 */
export async function getMessages(threadId: string): Promise<ApiResponse<Message[]>> {
  const { data, error } = await supabase
    .from('messages')
    .select(
      `
      *,
      sender:profiles!messages_sender_id_fkey(id, display_name, avatar_url)
    `
    )
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return { data: (data || []) as Message[], error: null };
}

/**
 * Envoie un message dans un thread
 */
export async function sendMessage(
  threadId: string,
  body: string
): Promise<ApiResponse<Message>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('Utilisateur non connecté') };
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      body
    })
    .select(
      `
      *,
      sender:profiles!messages_sender_id_fkey(id, display_name, avatar_url)
    `
    )
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as Message, error: null };
}

// ============================================
// ORDERS
// ============================================

/**
 * Récupère les commandes de l'utilisateur connecté
 */
export async function getOrders(): Promise<ApiResponse<Order[]>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: [], error: new Error('Utilisateur non connecté') };
  }

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      listing:listings(id, title, price),
      buyer:profiles!orders_buyer_id_fkey(id, display_name),
      seller:profiles!orders_seller_id_fkey(id, display_name)
    `
    )
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return { data: (data || []) as Order[], error: null };
}
