/**
 * Client API pour interagir avec Supabase
 * Fonctions helper pour les opérations CRUD sur les listings, messages, etc.
 */

import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as Location from 'expo-location';
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
import { sendPushNotificationWithUserJwt } from './pushNotifications';

async function resolveFilterLabels(filters?: FeedFilters): Promise<{
  brandLabels: string[];
  sizeLabels: string[];
  colorLabels: string[];
}> {
  if (!filters) {
    return { brandLabels: [], sizeLabels: [], colorLabels: [] };
  }

  const brandIds = filters.brandIds ?? [];
  const sizeIds = filters.sizeIds ?? [];
  const colorIds = filters.colorIds ?? [];

  const [brandsRes, sizesRes, colorsRes] = await Promise.all([
    brandIds.length > 0 ? supabase.from('brands').select('id, name').in('id', brandIds as any) : Promise.resolve({ data: [], error: null } as any),
    sizeIds.length > 0 ? supabase.from('sizes').select('id, label').in('id', sizeIds as any) : Promise.resolve({ data: [], error: null } as any),
    colorIds.length > 0 ? supabase.from('colors').select('id, name').in('id', colorIds as any) : Promise.resolve({ data: [], error: null } as any)
  ]);

  return {
    brandLabels: (brandsRes.data || []).map((r: any) => String(r.name)).filter(Boolean),
    sizeLabels: (sizesRes.data || []).map((r: any) => String(r.label)).filter(Boolean),
    colorLabels: (colorsRes.data || []).map((r: any) => String(r.name)).filter(Boolean)
  };
}

// ============================================
// TYPES POUR LE FEED
// ============================================

export type FeedListing = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  likes_count?: number | null;
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
  /** Présent sur `v_feed_listings` après migration `seller_is_influencer`. */
  seller_is_influencer?: boolean | null;
  listing_city: string;
  listing_country: string;
};

async function getBlockedSellerIdsForCurrentUser(): Promise<string[]> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', user.id);

  if (error) return [];
  return (data || [])
    .map((row: any) => String(row.blocked_id ?? ''))
    .filter(Boolean);
}

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
    const blockedSellerIds = await getBlockedSellerIdsForCurrentUser();
    const { brandLabels, sizeLabels, colorLabels } = await resolveFilterLabels(filters);

    // Nearby: use RPC that filters + sorts by distance.
    if (
      filters?.nearbyKm != null &&
      Number.isFinite(filters.nearbyKm) &&
      filters.nearbyKm > 0
    ) {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const pos = await Location.getCurrentPositionAsync({});
      const { data, error } = await supabase.rpc('nearby_feed_listings', {
          p_lat: Number(pos.coords.latitude),
          p_lon: Number(pos.coords.longitude),
        p_radius_km: Number(filters.nearbyKm),
        p_limit: limit,
        p_offset: offset,
        p_section: 'feed',
        p_query: null,
          p_category: null,
          p_conditions: (filters.conditionIds.length ? filters.conditionIds : null) as any,
        p_price_min: filters.priceMin ?? null,
        p_price_max: filters.priceMax ?? null,
          p_brands: (brandLabels.length ? brandLabels : null) as any,
          p_sizes: (sizeLabels.length ? sizeLabels : null) as any,
          p_colors: (colorLabels.length ? colorLabels : null) as any,
        p_influencer_ids: null
      });
      if (error) return { data: [], error: new Error(error.message) };
      const rows = (data || []) as FeedListing[];
      const filteredRows =
        blockedSellerIds.length > 0
          ? rows.filter((row) => !blockedSellerIds.includes(String(row.seller_id)))
          : rows;
      return { data: filteredRows, error: null };
      }
    }

    // Relevance: liked listings first (by like date desc), then newest.
    if (filters?.sortBy === 'relevance') {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user?.id) {
        const { data, error } = await supabase
          .from('v_feed_listings')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return { data: [], error: new Error(error.message) };
        const rows = (data || []) as FeedListing[];
        const filteredRows =
          blockedSellerIds.length > 0
            ? rows.filter((row) => !blockedSellerIds.includes(String(row.seller_id)))
            : rows;
        return { data: filteredRows, error: null };
      }

      const { data: likesRows, error: likesErr } = await supabase
        .from('likes')
        .select('listing_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (likesErr) {
        const { data, error } = await supabase
          .from('v_feed_listings')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return { data: [], error: new Error(error.message) };
        const rows = (data || []) as FeedListing[];
        const filteredRows =
          blockedSellerIds.length > 0
            ? rows.filter((row) => !blockedSellerIds.includes(String(row.seller_id)))
            : rows;
        return { data: filteredRows, error: null };
      }

      const likedIds = (likesRows || [])
        .map((r: any) => String(r.listing_id))
        .filter(Boolean);
      if (likedIds.length === 0) {
        const { data, error } = await supabase
          .from('v_feed_listings')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return { data: [], error: new Error(error.message) };
        const rows = (data || []) as FeedListing[];
        const filteredRows =
          blockedSellerIds.length > 0
            ? rows.filter((row) => !blockedSellerIds.includes(String(row.seller_id)))
            : rows;
        return { data: filteredRows, error: null };
      }

      // Liked items matching current filters
      let likedQ = supabase.from('v_feed_listings').select('*').in('id', likedIds);
      if (filters?.conditionIds && filters.conditionIds.length > 0) likedQ = likedQ.in('condition', filters.conditionIds);
      if (filters?.priceMin != null) likedQ = likedQ.gte('price', filters.priceMin);
      if (filters?.priceMax != null) likedQ = likedQ.lte('price', filters.priceMax);
      if (brandLabels.length > 0) likedQ = likedQ.in('brand', brandLabels);
      if (sizeLabels.length > 0) likedQ = likedQ.in('size', sizeLabels);
      if (colorLabels.length > 0) likedQ = likedQ.in('color', colorLabels);

      const { data: likedData, error: likedErr } = await likedQ;
      if (likedErr) return { data: [], error: new Error(likedErr.message) };

      const likedById = new Map<string, FeedListing>();
      (likedData || []).forEach((row: any) => likedById.set(String(row.id), row as FeedListing));
      const likedOrdered = likedIds.map((id) => likedById.get(id)).filter(Boolean) as FeedListing[];

      const likedLen = likedOrdered.length;
      const likedSlice = offset < likedLen ? likedOrdered.slice(offset, offset + limit) : [];
      const remaining = Math.max(0, limit - likedSlice.length);

      if (remaining === 0) {
        return { data: likedSlice, error: null };
      }

      // Rest of feed, newest first, excluding liked
      const restOffset = Math.max(0, offset - likedLen);
      let restQ = supabase
        .from('v_feed_listings')
        .select('*')
        .order('created_at', { ascending: false })
        .range(restOffset, restOffset + remaining - 1);

      if (filters?.conditionIds && filters.conditionIds.length > 0) restQ = restQ.in('condition', filters.conditionIds);
      if (filters?.priceMin != null) restQ = restQ.gte('price', filters.priceMin);
      if (filters?.priceMax != null) restQ = restQ.lte('price', filters.priceMax);
      if (brandLabels.length > 0) restQ = restQ.in('brand', brandLabels);
      if (sizeLabels.length > 0) restQ = restQ.in('size', sizeLabels);
      if (colorLabels.length > 0) restQ = restQ.in('color', colorLabels);

      const quoted = likedIds.map((x) => `"${x}"`).join(',');
      restQ = restQ.not('id', 'in', `(${quoted})`);

      const { data: restData, error: restErr } = await restQ;
      if (restErr) return { data: [], error: new Error(restErr.message) };

      const rows = [...likedSlice, ...((restData || []) as FeedListing[])];
      const filteredRows =
        blockedSellerIds.length > 0
          ? rows.filter((row) => !blockedSellerIds.includes(String(row.seller_id)))
          : rows;
      return { data: filteredRows, error: null };
    }

    let orderColumn: 'created_at' | 'price' = 'created_at';
    let ascending = false;

    switch (filters?.sortBy) {
      case 'price_asc':
        orderColumn = 'price';
        ascending = true;
        break;
      case 'price_desc':
        orderColumn = 'price';
        ascending = false;
        break;
      case 'recent':
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

    if (filters?.conditionIds && filters.conditionIds.length > 0) {
      query = query.in('condition', filters.conditionIds);
    }
    if (filters?.priceMin != null) {
      query = query.gte('price', filters.priceMin);
    }
    if (filters?.priceMax != null) {
      query = query.lte('price', filters.priceMax);
    }
    if (brandLabels.length > 0) query = query.in('brand', brandLabels);
    if (sizeLabels.length > 0) query = query.in('size', sizeLabels);
    if (colorLabels.length > 0) query = query.in('color', colorLabels);

    const { data, error } = await query;

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    const rows = (data || []) as FeedListing[];
    const filteredRows =
      blockedSellerIds.length > 0
        ? rows.filter((row) => !blockedSellerIds.includes(String(row.seller_id)))
        : rows;
    return { data: filteredRows, error: null };
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
    const { brandLabels, sizeLabels, colorLabels } = await resolveFilterLabels(filters);
    // Base query helper pour appliquer les filtres existants
    const applyFilters = (q: any) => {
      let query = q;
      if (filters?.conditionIds && filters.conditionIds.length > 0) {
        query = query.in('condition', filters.conditionIds);
      }
      if (filters?.priceMin != null) {
        query = query.gte('price', filters.priceMin);
      }
      if (filters?.priceMax != null) {
        query = query.lte('price', filters.priceMax);
      }
      if (brandLabels.length > 0) query = query.in('brand', brandLabels);
      if (sizeLabels.length > 0) query = query.in('size', sizeLabels);
      if (colorLabels.length > 0) query = query.in('color', colorLabels);
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
  seller_is_influencer?: boolean | null;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  photos: Array<{
    id: string;
    url: string;
    order_index: number;
    created_at: string;
  }> | null;
  /** Nombre d'annonces publiées du vendeur (depuis v_listing_detail) */
  seller_published_count?: number | null;
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
 * Nombre d'annonces publiées pour un vendeur (statut published), pour affichage profil / fiche produit.
 */
export async function getPublishedListingsCountForSeller(
  sellerId: string
): Promise<{ count: number; error: Error | null }> {
  try {
    const { count, error } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .eq('status', 'published');

    if (error) {
      return { count: 0, error: new Error(error.message) };
    }
    return { count: typeof count === 'number' ? count : 0, error: null };
  } catch (err) {
    return {
      count: 0,
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
    return { data: null, error: error.message };
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
      return { data: null, error: new Error("Impossible de récupérer l'URL publique") };
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
    return { data: null, error: error.message };
  }

  return { data: data as ListingPhoto, error: null };
}

/**
 * Récupère les annonces de l'utilisateur connecté
 */
export async function getMyListings(): Promise<ApiResponse<Listing[]>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: [], error: 'Utilisateur non connecté' };
  }

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
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
    return { data: [], error: 'Utilisateur non connecté' };
  }

  const { data, error } = await supabase
    .from('v_feed_listings')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
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
    return { data: null, error: 'Utilisateur non connecté' };
  }

  const { data, error } = await supabase
    .from('listings')
    .update(payload)
    .eq('id', id)
    .eq('seller_id', user.id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Listing, error: null };
}

/** Ancien libellé (rétrocompatibilité des écrans qui proposent « Désactiver »). */
export const LISTING_DELETE_BLOCKED_BY_ORDERS_MESSAGE =
  'Impossible de supprimer cette annonce car elle est liée à des commandes. Vous pouvez la désactiver à la place.';

/** Commande encore active (pending / shipped) : pas de suppression physique. */
export const LISTING_DELETE_BLOCKED_ACTIVE_ORDERS_MESSAGE =
  'Impossible de supprimer : une commande est en cours pour cette annonce.';

export function isListingDeleteBlockedByOrders(error: string | null): boolean {
  return (
    error === LISTING_DELETE_BLOCKED_ACTIVE_ORDERS_MESSAGE ||
    error === LISTING_DELETE_BLOCKED_BY_ORDERS_MESSAGE
  );
}

/**
 * Annonces en brouillon du vendeur connecté (closet profil), format aligné sur le feed.
 */
export async function getSellerDraftListingsForCloset(sellerId: string): Promise<ApiResponse<FeedListing[]>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || user.id !== sellerId) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from('listings')
    .select(
      `
      id,
      seller_id,
      title,
      description,
      price,
      status,
      category,
      condition,
      brand,
      size,
      delivery_mode,
      city,
      country_code,
      created_at,
      published_at,
      updated_at,
      photos:listing_photos(url, order_index)
    `
    )
    .eq('seller_id', sellerId)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  const rows = (data || []) as any[];
  const out: FeedListing[] = rows.map((listing: any) => {
    const photos = (listing.photos || []) as Array<{ url: string; order_index: number }>;
    const sorted = [...photos].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const rawCover = sorted[0]?.url ?? null;
    let coverUrl: string | null = null;
    if (rawCover) {
      if (typeof rawCover === 'string' && (rawCover.startsWith('http://') || rawCover.startsWith('https://'))) {
        coverUrl = rawCover;
      } else {
        coverUrl = supabase.storage.from('listings').getPublicUrl(rawCover).data.publicUrl;
      }
    }

    return {
      id: String(listing.id),
      seller_id: String(listing.seller_id),
      title: String(listing.title ?? ''),
      description: listing.description ?? null,
      price: typeof listing.price === 'number' ? listing.price : Number(listing.price) || 0,
      status: String(listing.status ?? 'draft'),
      category: listing.category ?? null,
      condition: listing.condition ?? null,
      brand: listing.brand ?? null,
      size: listing.size ?? null,
      delivery_mode: String(listing.delivery_mode ?? 'both'),
      city: listing.city ?? null,
      country_code: listing.country_code ?? null,
      created_at: String(listing.created_at ?? ''),
      published_at: listing.published_at ?? null,
      updated_at: String(listing.updated_at ?? listing.created_at ?? ''),
      cover_photo_url: coverUrl,
      cover_photo_order: sorted[0]?.order_index ?? null,
      seller_display_name: null,
      seller_avatar_url: null,
      listing_city: listing.city != null ? String(listing.city) : '',
      listing_country: listing.country_code != null ? String(listing.country_code) : ''
    };
  });

  return { data: out, error: null };
}

/**
 * Met l'annonce en brouillon : disparaît du feed (published) tout en restant en base.
 */
export async function deactivateListingToDraft(id: string): Promise<ApiResponse<void>> {
  const res = await updateListing(id, { status: 'draft' });
  if (res.error) {
    return { data: null, error: res.error };
  }
  return { data: null, error: null };
}

/**
 * Supprime une annonce appartenant à l'utilisateur connecté.
 * Ne supprime pas listing_photos avant le listing : le CASCADE côté listing_id supprime les photos
 * avec la ligne listing, ce qui évite un listing sans images si le DELETE échoue.
 */
export async function deleteListing(id: string): Promise<ApiResponse<void>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Utilisateur non connecté' };
  }

  const { data: row, error: verifyErr } = await supabase
    .from('listings')
    .select('id')
    .eq('id', id)
    .eq('seller_id', user.id)
    .maybeSingle();

  if (verifyErr) {
    return { data: null, error: verifyErr.message };
  }
  if (!row) {
    return { data: null, error: 'Annonce introuvable ou accès refusé' };
  }

  const { count: activeOrderCount, error: ordersErr } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', id)
    .in('status', ['pending', 'shipped']);

  if (ordersErr) {
    return { data: null, error: ordersErr.message };
  }
  if (typeof activeOrderCount === 'number' && activeOrderCount > 0) {
    return { data: null, error: LISTING_DELETE_BLOCKED_ACTIVE_ORDERS_MESSAGE };
  }

  const { error: deleteErr } = await supabase
    .from('listings')
    .delete()
    .eq('id', id)
    .eq('seller_id', user.id);

  if (!deleteErr) {
    return { data: null, error: null };
  }

  const msg = deleteErr.message ?? '';
  const looksLikeFk =
    /foreign key|violates foreign key|23503|restrict/i.test(msg) ||
    (deleteErr as { code?: string }).code === '23503';

  if (looksLikeFk) {
    const { error: softErr } = await supabase
      .from('listings')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('seller_id', user.id);

    if (!softErr) {
      return { data: null, error: null };
    }
    return { data: null, error: softErr.message ?? msg };
  }

  return { data: null, error: msg };
}

// ============================================
// LIKES
// ============================================

export type LikedListingCard = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  status: string;
  category: string | null;
  condition: string | null;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  delivery_mode: string;
  city: string | null;
  country_code: string | null;
  created_at: string;
  published_at: string | null;
  updated_at: string;
  cover_photo_url: string | null;
  seller_display_name: string | null;
  seller_avatar_url: string | null;
};

export async function likeListing(listingId: string): Promise<ApiResponse<{ id: string }>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Utilisateur non connecté' };
  }

  const { data: listingRow, error: listingErr } = await supabase
    .from('listings')
    .select('seller_id')
    .eq('id', listingId)
    .maybeSingle();

  if (listingErr) {
    return { data: null, error: listingErr.message };
  }
  const sellerId = listingRow ? String((listingRow as { seller_id?: string }).seller_id ?? '').trim() : '';
  if (sellerId && sellerId === user.id) {
    return { data: null, error: 'You cannot like your own listing' };
  }

  const { data, error } = await supabase
    .from('likes')
    .insert({
      user_id: user.id,
      listing_id: listingId
    })
    .select('id')
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  if (sellerId) {
    void sendPushNotificationWithUserJwt({
      user_id: sellerId,
      title: '❤️ Ton article a été liké !',
      body: "Quelqu'un s'intéresse à ton article. C'est le moment de baisser le prix !",
      data: { listing_id: listingId }
    });
  }

  return { data: { id: (data as any).id as string }, error: null };
}

export async function unlikeListing(listingId: string): Promise<ApiResponse<{ success: true }>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Utilisateur non connecté' };
  }

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_id', listingId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: { success: true }, error: null };
}

export async function getMyLikedListings(): Promise<ApiResponse<LikedListingCard[]>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: [], error: 'Utilisateur non connecté' };
  }

  const { data, error } = await supabase
    .from('likes')
    .select(
      `
      listing:listings(
        *,
        seller:profiles!listings_seller_id_fkey(display_name, avatar_url),
        photos:listing_photos(url, order_index)
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  const rows = (data || []) as any[];
  const cards: LikedListingCard[] = rows
    .map((row) => row.listing)
    .filter(Boolean)
    .map((listing: any) => {
      const photos = (listing.photos || []) as Array<{ url: string; order_index: number }>;
      const cover = [...photos]
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0]?.url ?? null;

      return {
        id: listing.id,
        seller_id: listing.seller_id,
        title: listing.title,
        description: listing.description ?? null,
        price: listing.price,
        status: listing.status,
        category: listing.category ?? null,
        condition: listing.condition ?? null,
        brand: listing.brand ?? null,
        size: listing.size ?? null,
        color: listing.color ?? null,
        delivery_mode: listing.delivery_mode,
        city: listing.city ?? null,
        country_code: listing.country_code ?? null,
        created_at: listing.created_at,
        published_at: listing.published_at ?? null,
        updated_at: listing.updated_at,
        cover_photo_url: cover,
        seller_display_name: listing.seller?.display_name ?? null,
        seller_avatar_url: listing.seller?.avatar_url ?? null
      };
    });

  return { data: cards, error: null };
}

export async function getMyLikedListingIds(): Promise<ApiResponse<string[]>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: [], error: 'Utilisateur non connecté' };
  }

  const { data, error } = await supabase
    .from('likes')
    .select('listing_id')
    .eq('user_id', user.id);

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data || []).map((r: any) => r.listing_id as string), error: null };
}

export async function getLikesCountsForListings(
  listingIds: string[]
): Promise<ApiResponse<Record<string, number>>> {
  if (!listingIds || listingIds.length === 0) {
    return { data: {}, error: null };
  }

  const { data, error } = await supabase
    .from('likes')
    .select('listing_id')
    .in('listing_id', listingIds);

  if (error) {
    return { data: null, error: error.message };
  }

  const counts: Record<string, number> = {};
  for (const row of (data || []) as any[]) {
    const id = row.listing_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }

  return { data: counts, error: null };
}

export async function getListingLikesInfo(listingId: string): Promise<
  ApiResponse<{
    likesCount: number;
    likedByMe: boolean;
  }>
> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ count, error: countError }, likedRes] = await Promise.all([
    supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId),
    user
      ? supabase
          .from('likes')
          .select('id')
          .eq('listing_id', listingId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any)
  ]);

  if (countError) {
    return { data: null, error: countError.message };
  }

  // maybeSingle() renvoie une erreur si "multiple rows" (devrait pas arriver avec UNIQUE)
  const likedByMe = !!(likedRes as any)?.data;

  return {
    data: {
      likesCount: count ?? 0,
      likedByMe
    },
    error: null
  };
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
    return { data: [], error: 'Utilisateur non connecté' };
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
    return { data: [], error: error.message };
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
    return { data: null, error: 'Utilisateur non connecté' };
  }

  if (user.id === sellerId) {
    return { data: null, error: 'Le vendeur ne peut pas se contacter lui-même' };
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
      return { data: null, error: existingError.message };
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
      return { data: null, error: insertError.message };
    }

    return { data: created as Thread, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Erreur lors de la création du thread'
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
    return { data: [], error: error.message };
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
    return { data: null, error: 'Utilisateur non connecté' };
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      body,
      type: 'text'
    })
    .select(
      `
      *,
      sender:profiles!messages_sender_id_fkey(id, display_name, avatar_url)
    `
    )
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  // Garder l'inbox instantanée (tri basé sur threads.last_message_at)
  await supabase
    .from('threads')
    .update({ last_message_at: (data as any)?.created_at ?? new Date().toISOString() })
    .eq('id', threadId);

  return { data: data as Message, error: null };
}

export async function sendOfferMessage(params: {
  threadId: string;
  listingId: string;
  amount: number;
  currency?: string;
}): Promise<ApiResponse<Message>> {
  const { threadId, listingId, amount, currency = 'CHF' } = params;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Utilisateur non connecté' };
  }

  const fallbackBody = `Offer: ${amount.toFixed(2)} ${currency} (status: pending)`;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      body: fallbackBody,
      type: 'offer',
      offer_amount: amount,
      offer_currency: currency,
      offer_status: 'pending',
      listing_id: listingId
    })
    .select(
      `
      *,
      sender:profiles!messages_sender_id_fkey(id, display_name, avatar_url)
    `
    )
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  // Garder l'inbox instantanée (tri basé sur threads.last_message_at)
  await supabase
    .from('threads')
    .update({ last_message_at: (data as any)?.created_at ?? new Date().toISOString() })
    .eq('id', threadId);

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
    return { data: [], error: 'Utilisateur non connecté' };
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
    return { data: [], error: error.message };
  }

  return { data: (data || []) as Order[], error: null };
}
