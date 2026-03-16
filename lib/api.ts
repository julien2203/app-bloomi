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
import type { FeedFilters } from './store/feedFilters';

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
  brand?: string | null;
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
 * avec pagination et filtres optionnels
 */
export async function getFeedListings(params?: {
  limit?: number;
  offset?: number;
  filters?: FeedFilters;
}): Promise<{ data: FeedListing[]; error: Error | null }> {
  const { limit = 20, offset = 0, filters } = params || {};

  try {
    let orderColumn: 'created_at' | 'price' = 'created_at';
    let ascending = false;

    switch (filters?.sort) {
      case 'price_asc':
        orderColumn = 'price';
        ascending = true;
        break;
      case 'price_desc':
        orderColumn = 'price';
        ascending = false;
        break;
      case 'newest':
      case 'relevance':
      default:
        orderColumn = 'created_at';
        ascending = false;
        break;
    }

    let query = supabase
      .from('v_feed_listings')
      .select('*')
      .order(orderColumn, { ascending })
      .range(offset, offset + limit - 1);

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.conditions && filters.conditions.length > 0) {
      query = query.in('condition', filters.conditions);
    }
    if (filters?.priceMin !== undefined) {
      query = query.gte('price', filters.priceMin);
    }
    if (filters?.priceMax !== undefined) {
      query = query.lte('price', filters.priceMax);
    }

    const { data, error } = await query;

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

export async function getPriceBounds(filters?: FeedFilters): Promise<{
  min: number | null;
  max: number | null;
  error: Error | null;
}> {
  try {
    // Base query helper pour appliquer les filtres existants
    const applyFilters = (q: any) => {
      let query = q;
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.conditions && filters.conditions.length > 0) {
        query = query.in('condition', filters.conditions);
      }
      if (filters?.priceMin !== undefined) {
        query = query.gte('price', filters.priceMin);
      }
      if (filters?.priceMax !== undefined) {
        query = query.lte('price', filters.priceMax);
      }
      return query;
    };

    // Récupère le prix minimum
    const { data: minData, error: minError } = await applyFilters(
      supabase
        .from('listings')
        .select('price')
        .order('price', { ascending: true })
        .limit(1)
    ).maybeSingle();

    if (minError && minError.message) {
      return { min: null, max: null, error: new Error(minError.message) };
    }

    // Récupère le prix maximum
    const { data: maxData, error: maxError } = await applyFilters(
      supabase
        .from('listings')
        .select('price')
        .order('price', { ascending: false })
        .limit(1)
    ).maybeSingle();

    if (maxError && maxError.message) {
      return { min: null, max: null, error: new Error(maxError.message) };
    }

    const min = (minData as any)?.price ?? null;
    const max = (maxData as any)?.price ?? null;

    return { min, max, error: null };
  } catch (err) {
    return {
      min: null,
      max: null,
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
  brand?: string | null;
  size?: string | null;
  color?: string | null;
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

    const listing = data as ListingDetail;

    // Normaliser les URLs des photos :
    // - si `photo.url` est déjà une URL absolue (http/https), on la garde telle quelle
    // - sinon, on génère une URL publique à partir du chemin stocké
    const normalizedListing: ListingDetail = {
      ...listing,
      photos: listing.photos
        ? listing.photos.map((photo) => {
            const rawUrl = photo.url;

            if (
              typeof rawUrl === 'string' &&
              (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
            ) {
              return photo;
            }

            const { data: publicData } = supabase.storage
              .from('listings')
              .getPublicUrl(rawUrl);

            return {
              ...photo,
              url: publicData?.publicUrl ?? rawUrl
            };
          })
        : null
    };

    return { data: normalizedListing, error: null };
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
 * Récupère les annonces de l'utilisateur connecté au format FeedListing
 * (inclut cover_photo_url pour l'affichage des images dans "Mes annonces")
 */
export async function getMyListingsFeed(): Promise<ApiResponse<FeedListing[]>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: [], error: new Error('Utilisateur non connecté') };
  }

  const { data, error } = await supabase
    .from('v_feed_listings')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return { data: (data || []) as FeedListing[], error: null };
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

/**
 * Crée ou récupère un thread pour un listing donné entre l'acheteur connecté et le vendeur.
 */
export async function createOrGetThreadForListing(
  listingId: string,
  sellerId: string
): Promise<ApiResponse<Thread>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('Utilisateur non connecté') };
  }

  if (user.id === sellerId) {
    return { data: null, error: new Error('Le vendeur ne peut pas se contacter lui-même') };
  }

  try {
    // 1) Vérifier si un thread existe déjà pour ce listing + buyer
    const { data: existing, error: existingError } = await supabase
      .from('threads')
      .select('*')
      .eq('listing_id', listingId)
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      // Erreur réelle (autre que "no rows returned")
      return { data: null, error: new Error(existingError.message) };
    }

    if (existing) {
      return { data: existing as Thread, error: null };
    }

    // 2) Créer un nouveau thread
    const { data: created, error: insertError } = await supabase
      .from('threads')
      .insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: sellerId
      })
      .select('*')
      .single();

    if (insertError) {
      return { data: null, error: new Error(insertError.message) };
    }

    return { data: created as Thread, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Erreur lors de la création du thread')
    };
  }
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
