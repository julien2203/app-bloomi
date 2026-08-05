/**
 * Client API pour interagir avec Supabase
 * Fonctions helper pour les opérations CRUD sur les listings, messages, etc.
 */

import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as Location from 'expo-location';
import {
  buildListingStorageFilename,
  LISTING_CARD_JPEG_QUALITY,
  LISTING_CARD_MAX_EDGE_PX,
  prepareListingPhotoForUpload,
  temporaryListingPhotoOrderIndex,
  toListingCardStorageFilename
} from './listingPhotoUtils';
import { deliveryModeIncludesPickup } from './deliveryMode';
import { listingHasPublicPickupCity } from './pickupAddress';
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
  PaginatedResponse,
  ParcelSize
} from './types';
import type { FeedFilters } from './store/feedFilters';
import { expandConditionFilterValues } from './conditionI18n';
import { sendPushNotificationWithUserJwt } from './pushNotifications';
import { SUPABASE_URL } from './env';
import { getBuyerListingOfferGate } from './listingOffers';
import {
  getBlockedSellerIdsForCurrentUser,
  invalidateBlockedSellerIdsCache
} from './blockedSellerIdsCache';

export { getBlockedSellerIdsForCurrentUser, invalidateBlockedSellerIdsCache };

async function readLocalImageBinary(uri: string): Promise<Uint8Array> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: (FileSystem as any).EncodingType?.Base64 ?? 'base64'
    });
    return new Uint8Array(decodeBase64(base64));
  } catch {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Unable to read file (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

async function resolveFilterLabels(filters?: FeedFilters): Promise<{
  brandLabels: string[];
  sizeLabels: string[];
  colorLabels: string[];
  includeOtherBrand: boolean;
}> {
  if (!filters) {
    return { brandLabels: [], sizeLabels: [], colorLabels: [], includeOtherBrand: false };
  }

  const rawBrandIds = filters.brandIds ?? [];
  const includeOtherBrand = rawBrandIds.includes('__other__');
  const brandIds = rawBrandIds.filter((id) => id !== '__other__');
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
    colorLabels: (colorsRes.data || []).map((r: any) => String(r.name)).filter(Boolean),
    includeOtherBrand
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
  category_id?: number | null;
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

function applyFeedListingFilters(
  query: any,
  filters: FeedFilters | undefined,
  labels: { brandLabels: string[]; sizeLabels: string[]; colorLabels: string[]; includeOtherBrand: boolean }
) {
  let q = query;
  if (filters?.categoryIds && filters.categoryIds.length > 0) {
    q = q.in('category_id', filters.categoryIds.map((id) => Number(id)));
  }
  if (filters?.conditionIds && filters.conditionIds.length > 0) {
    const conditions = expandConditionFilterValues(filters.conditionIds);
    if (conditions.length > 0) q = q.in('condition', conditions);
  }
  if (filters?.priceMin != null) q = q.gte('price', filters.priceMin);
  if (filters?.priceMax != null) q = q.lte('price', filters.priceMax);
  if (labels.brandLabels.length > 0 && labels.includeOtherBrand) {
    const escaped = labels.brandLabels.map((label) => `"${String(label).replace(/"/g, '\\"')}"`).join(',');
    q = q.or(`brand.in.(${escaped}),brand.is.null,brand.eq.""`);
  } else if (labels.brandLabels.length > 0) {
    q = q.in('brand', labels.brandLabels);
  } else if (labels.includeOtherBrand) {
    q = q.or('brand.is.null,brand.eq.""');
  }
  if (labels.sizeLabels.length > 0) q = q.in('size', labels.sizeLabels);
  if (labels.colorLabels.length > 0) q = q.in('color', labels.colorLabels);
  return q;
}

export type MemberSearchRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  is_influencer: boolean | null;
};

const MEMBER_SEARCH_PAGE_SIZE = 20;

/** Recherche membres par `display_name` ou `company_name` (tous les profils). */
export async function searchMemberProfiles(params: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<MemberSearchRow[]>> {
  const trimmed = String(params.query ?? '').trim();
  if (!trimmed) {
    return { data: [], error: null };
  }

  const limit = Math.min(Math.max(params.limit ?? MEMBER_SEARCH_PAGE_SIZE, 1), 50);
  const offset = Math.max(params.offset ?? 0, 0);
  const escaped = trimmed.replace(/"/g, '""');
  const pattern = `"*${escaped}*"`;
  const orFilter = `display_name.ilike.${pattern},company_name.ilike.${pattern}`;

  const blockedIds = await getBlockedSellerIdsForCurrentUser();
  const blocked = new Set(blockedIds);

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, company_name, is_influencer')
    .or(orFilter)
    .order('display_name', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { data: [], error: error.message };
  }

  const rows = ((data || []) as MemberSearchRow[]).filter((row) => !blocked.has(String(row.id)));
  return { data: rows, error: null };
}

export type BlockedUserRow = {
  blocked_id: string;
  blocked_at: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function getBlockedUsersForCurrentUser(): Promise<
  ApiResponse<BlockedUserRow[]>
> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { data: [], error: 'User not signed in' };
  }

  const { data: blocks, error: blocksError } = await supabase
    .from('blocked_users')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  if (blocksError) {
    return { data: [], error: blocksError.message };
  }

  const rows = (blocks || []) as Array<{ blocked_id: string; created_at: string }>;
  if (rows.length === 0) {
    return { data: [], error: null };
  }

  const blockedIds = rows.map((r) => String(r.blocked_id)).filter(Boolean);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', blockedIds);

  if (profilesError) {
    return { data: [], error: profilesError.message };
  }

  const profileById = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  for (const p of (profiles || []) as any[]) {
    profileById.set(String(p.id), {
      display_name: (p.display_name as string | null) ?? null,
      avatar_url: (p.avatar_url as string | null) ?? null
    });
  }

  const result: BlockedUserRow[] = rows.map((row) => {
    const id = String(row.blocked_id);
    const profile = profileById.get(id);
    return {
      blocked_id: id,
      blocked_at: row.created_at,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null
    };
  });

  return { data: result, error: null };
}

export async function unblockUser(blockedId: string): Promise<ApiResponse<{ success: true }>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { data: null, error: 'User not signed in' };
  }

  const id = String(blockedId ?? '').trim();
  if (!id) {
    return { data: null, error: 'Invalid user id' };
  }

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', id);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: { success: true }, error: null };
}

/** Client-side filter when blocked seller IDs are known (feed, search, favorites). */
export function excludeBlockedSellers<T extends { seller_id?: string | null }>(
  rows: T[],
  blockedIds: string[]
): T[] {
  if (!blockedIds.length) return rows;
  const blocked = new Set(blockedIds);
  return rows.filter((row) => !blocked.has(String(row.seller_id ?? '')));
}

/** Copie défensive des lignes feed avant mise en state (évite les mutations partagées). */
export function cloneFeedListings<T extends FeedListing>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row }));
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
  /** Évite un second appel getUser/blocked_users si déjà résolu par l'appelant. */
  blockedSellerIds?: string[];
}): Promise<{ data: FeedListing[]; error: Error | null }> {
  const { limit = 20, offset = 0, filters, blockedSellerIds: blockedSellerIdsParam } = params || {};

  try {
    const blockedSellerIds =
      blockedSellerIdsParam ?? (await getBlockedSellerIdsForCurrentUser());
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
          p_conditions: (filters.conditionIds.length
            ? expandConditionFilterValues(filters.conditionIds)
            : null) as any,
        p_price_min: filters.priceMin ?? null,
        p_price_max: filters.priceMax ?? null,
          p_brands: (brandLabels.length ? brandLabels : null) as any,
          p_sizes: (sizeLabels.length ? sizeLabels : null) as any,
          p_colors: (colorLabels.length ? colorLabels : null) as any,
        p_influencer_ids: null
      });
      if (error) return { data: [], error: new Error(error.message) };
      const rows = (data || []) as FeedListing[];
      const categoryFilteredRows =
        filters?.categoryIds && filters.categoryIds.length > 0
          ? rows.filter((row) =>
              filters.categoryIds.some((id) => Number((row as any).category_id) === Number(id))
            )
          : rows;
      const filteredRows =
        blockedSellerIds.length > 0
          ? categoryFilteredRows.filter((row) => !blockedSellerIds.includes(String(row.seller_id)))
          : categoryFilteredRows;
      return { data: filteredRows, error: null };
      }
    }

    // Relevance: liked listings first (by like date desc), then newest.
    if (filters?.sortBy === 'relevance') {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user?.id) {
        let baseQuery = supabase
          .from('v_feed_listings')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        baseQuery = applyFeedListingFilters(
          baseQuery,
          filters,
          { brandLabels, sizeLabels, colorLabels }
        );
        const { data: rowsData, error: rowsError } = await baseQuery;
        if (rowsError) return { data: [], error: new Error(rowsError.message) };
        const rows = (rowsData || []) as FeedListing[];
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
        let baseQuery = supabase
          .from('v_feed_listings')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        baseQuery = applyFeedListingFilters(
          baseQuery,
          filters,
          { brandLabels, sizeLabels, colorLabels }
        );
        const { data: rowsData, error: rowsError } = await baseQuery;
        if (rowsError) return { data: [], error: new Error(rowsError.message) };
        const rows = (rowsData || []) as FeedListing[];
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
        let baseQuery = supabase
          .from('v_feed_listings')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        baseQuery = applyFeedListingFilters(baseQuery, filters, { brandLabels, sizeLabels, colorLabels });
        const { data, error } = await baseQuery;
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
      likedQ = applyFeedListingFilters(likedQ, filters, { brandLabels, sizeLabels, colorLabels });

      const { data: likedData, error: likedErr } = await likedQ;
      if (likedErr) return { data: [], error: new Error(likedErr.message) };

      const likedById = new Map<string, FeedListing>();
      (likedData || []).forEach((row: any) => likedById.set(String(row.id), row as FeedListing));
      const likedOrdered = likedIds.map((id) => likedById.get(id)).filter(Boolean) as FeedListing[];

      const likedLen = likedOrdered.length;
      const likedSlice = offset < likedLen ? likedOrdered.slice(offset, offset + limit) : [];
      const remaining = Math.max(0, limit - likedSlice.length);

      if (remaining === 0) {
        const data =
          blockedSellerIds.length > 0
            ? likedSlice.filter((row) => !blockedSellerIds.includes(String(row.seller_id)))
            : likedSlice;
        return { data, error: null };
      }

      // Rest of feed, newest first, excluding liked
      const restOffset = Math.max(0, offset - likedLen);
      let restQ = supabase
        .from('v_feed_listings')
        .select('*')
        .order('created_at', { ascending: false })
        .range(restOffset, restOffset + remaining - 1);
      restQ = applyFeedListingFilters(restQ, filters, { brandLabels, sizeLabels, colorLabels });

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
    query = applyFeedListingFilters(query, filters, { brandLabels, sizeLabels, colorLabels });

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
      error: err instanceof Error ? err : new Error('Unknown error')
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
      if (filters?.categoryIds && filters.categoryIds.length > 0) {
        query = query.in('category_id', filters.categoryIds.map((id) => Number(id)));
      }
      if (filters?.conditionIds && filters.conditionIds.length > 0) {
        const conditions = expandConditionFilterValues(filters.conditionIds);
        if (conditions.length > 0) query = query.in('condition', conditions);
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
      error: err instanceof Error ? err : new Error('Unknown error')
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
    throw new Error(`Error while fetching listings: ${error.message}`);
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
  category_id?: number | null;
  category_slug?: string | null;
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
  parcel_size?: ParcelSize | null;
  pickup_primary_street?: string | null;
  pickup_primary_postal_code?: string | null;
  pickup_primary_city?: string | null;
  pickup_work_street?: string | null;
  pickup_work_postal_code?: string | null;
  pickup_work_city?: string | null;
  photos: Array<{
    id: string;
    url: string;
    order_index: number;
    created_at: string;
  }> | null;
  /** Nombre d'annonces publiées du vendeur (depuis v_listing_detail) */
  seller_published_count?: number | null;
};

/** Copie défensive d'une fiche produit avant mise en state. */
export function cloneListingDetail(listing: ListingDetail): ListingDetail {
  return {
    ...listing,
    photos: listing.photos ? listing.photos.map((photo) => ({ ...photo })) : null
  };
}

/**
 * Récupère une annonce par son ID depuis v_listing_detail
 */
function coerceListingPrice(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const parsed = Number(String(raw ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function coerceParcelSize(raw: unknown): ListingDetail['parcel_size'] {
  const value = String(raw ?? '').toLowerCase();
  if (
    value === 'letter_aplus' ||
    value === 'small' ||
    value === 'large' ||
    value === 'xlarge'
  ) {
    return value;
  }
  return null;
}

function normalizeListingPhotos(raw: unknown): NonNullable<ListingDetail['photos']> | null {
  if (raw == null) return null;

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) return null;

  type PhotoRow = NonNullable<ListingDetail['photos']>[number];
  return (parsed as PhotoRow[])
    .map((photo) => ({ ...photo }))
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

function normalizeListingPhotoUrl(rawUrl: string): string {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }

  const { data: publicData } = supabase.storage.from('listings').getPublicUrl(rawUrl);
  return publicData?.publicUrl ?? rawUrl;
}

export async function getListingById(id: string): Promise<{ data: ListingDetail | null; error: Error | null }> {
  try {
    const [{ data, error }, { data: listingRow }] = await Promise.all([
      supabase.from('v_listing_detail').select('*').eq('id', id).single(),
      supabase
        .from('listings')
        .select('category_id, parcel_size, pickup_primary_city, pickup_work_city')
        .eq('id', id)
        .maybeSingle()
    ]);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const categoryId =
      listingRow?.category_id != null ? Number(listingRow.category_id) : null;

    let categorySlug: string | null = null;
    if (categoryId != null) {
      const { data: categoryRow } = await supabase
        .from('categories')
        .select('slug')
        .eq('id', categoryId)
        .maybeSingle();
      categorySlug = categoryRow?.slug ? String(categoryRow.slug) : null;
    }

    const listing = data as ListingDetail;
    const parsedPhotos = normalizeListingPhotos(listing.photos);

    const normalizedListing: ListingDetail = {
      ...listing,
      price: coerceListingPrice(listing.price),
      category_id: categoryId ?? listing.category_id ?? null,
      category_slug: categorySlug,
      parcel_size: coerceParcelSize(listingRow?.parcel_size ?? listing.parcel_size),
      // Fiche publique : jamais de rue / NPA (confidentialité)
      pickup_primary_street: null,
      pickup_primary_postal_code: null,
      pickup_primary_city: listingRow?.pickup_primary_city ?? listing.pickup_primary_city ?? null,
      pickup_work_street: null,
      pickup_work_postal_code: null,
      pickup_work_city: listingRow?.pickup_work_city ?? listing.pickup_work_city ?? null,
      photos: parsedPhotos
        ? parsedPhotos.map((photo) => ({
            ...photo,
            url: normalizeListingPhotoUrl(String(photo.url ?? ''))
          }))
        : null
    };

    if (
      deliveryModeIncludesPickup(normalizedListing.delivery_mode) &&
      !listingHasPublicPickupCity(normalizedListing) &&
      normalizedListing.seller_id
    ) {
      const { data: sellerCities } = await supabase
        .from('profiles')
        .select('city, work_city')
        .eq('id', normalizedListing.seller_id)
        .maybeSingle();
      if (sellerCities) {
        normalizedListing.pickup_primary_city =
          String(sellerCities.city ?? '').trim() || null;
        normalizedListing.pickup_work_city =
          String(sellerCities.work_city ?? '').trim() || null;
      }
    }

    return { data: normalizedListing, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unknown error')
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
      error: err instanceof Error ? err : new Error('Unknown error')
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
  const normalizedPayload: ListingInsert = { ...payload };

  if (
    (normalizedPayload as any).category_id == null &&
    typeof normalizedPayload.category === 'string' &&
    normalizedPayload.category.trim().length > 0
  ) {
    const resolvedCategoryId = await resolveCategoryIdByLabel(normalizedPayload.category);
    if (resolvedCategoryId != null) {
      (normalizedPayload as any).category_id = resolvedCategoryId;
    }
  }

  const { data, error } = await supabase
    .from('listings')
    .insert(normalizedPayload as any)
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
  file: { uri: string; type?: string; name?: string; width?: number; height?: number },
  userId: string,
  listingId: string,
  filename: string
): Promise<{ data: string | null; error: Error | null }> {
  try {
    const preparedFull = await prepareListingPhotoForUpload(file);
    const binary = await readLocalImageBinary(preparedFull.uri);

    // Always JPEG after prepareListingPhotoForUpload (keeps Storage + CDN simple).
    const safeFilename = String(filename || preparedFull.name || `photo-${Date.now()}.jpg`)
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.[^.]+$/, '.jpg');
    const contentType = 'image/jpeg';

    const uploadToPath = async (storageFilename: string, body: Uint8Array, upsert = false) => {
      const filePath = `${userId}/${listingId}/${storageFilename}`;
      const { error: uploadError } = await supabase.storage.from('listings').upload(filePath, body, {
        contentType,
        upsert,
        cacheControl: '31536000'
      });
      return { filePath, uploadError };
    };

    let { filePath, uploadError } = await uploadToPath(safeFilename, binary);

    if (uploadError && /already exists|duplicate|409/i.test(uploadError.message ?? '')) {
      const retryFilename = buildListingStorageFilename(0, safeFilename)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.[^.]+$/, '.jpg');
      ({ filePath, uploadError } = await uploadToPath(retryFilename, binary));
    }

    if (uploadError) {
      return { data: null, error: new Error(uploadError.message) };
    }

    // Best-effort card sibling for feed/grids (no transform billing).
    try {
      const preparedCard = await prepareListingPhotoForUpload(
        {
          uri: preparedFull.uri,
          type: 'image/jpeg',
          name: preparedFull.name,
          width: preparedFull.width,
          height: preparedFull.height
        },
        {
          maxEdgePx: LISTING_CARD_MAX_EDGE_PX,
          quality: LISTING_CARD_JPEG_QUALITY
        }
      );
      const cardBinary = await readLocalImageBinary(preparedCard.uri);
      const cardFilename = toListingCardStorageFilename(filePath.split('/').pop() || safeFilename);
      const cardPath = `${userId}/${listingId}/${cardFilename}`;
      await supabase.storage.from('listings').upload(cardPath, cardBinary, {
        contentType,
        upsert: true,
        cacheControl: '31536000'
      });
    } catch {
      // Full upload already succeeded; feed will fall back to full until backfill.
    }

    const { data: urlData } = supabase.storage.from('listings').getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return { data: null, error: new Error('Unable to retrieve the public URL') };
    }

    return { data: urlData.publicUrl, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Upload error')
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

export type ListingPhotoUploadInput = {
  uri: string;
  type?: string;
  name?: string;
  width?: number;
  height?: number;
};

export type UploadListingPhotosResult = {
  uploadedCount: number;
  failedCount: number;
  errors: string[];
};

/**
 * Upload et enregistre toutes les photos d'une annonce (publication ou édition).
 * Utilise des noms de fichiers uniques et vérifie chaque insertion en BDD.
 */
export async function uploadAndAttachListingPhotos(
  photos: ListingPhotoUploadInput[],
  userId: string,
  listingId: string
): Promise<UploadListingPhotosResult> {
  const errors: string[] = [];
  let uploadedCount = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]!;
    const filename = buildListingStorageFilename(i, photo.name);

    const { data: photoUrl, error: uploadError } = await uploadListingPhoto(
      photo,
      userId,
      listingId,
      filename
    );

    if (uploadError || !photoUrl) {
      errors.push(
        uploadError?.message ??
          `Photo ${i + 1}: upload failed`
      );
      continue;
    }

    const { error: addError } = await addListingPhoto(
      listingId,
      photoUrl,
      uploadedCount
    );

    if (addError) {
      errors.push(
        typeof addError === 'string'
          ? addError
          : `Photo ${i + 1}: unable to save`
      );
      continue;
    }

    uploadedCount += 1;
  }

  return {
    uploadedCount,
    failedCount: Math.max(0, photos.length - uploadedCount),
    errors
  };
}

/**
 * Supprime une photo d'une annonce appartenant à l'utilisateur connecté.
 */
export async function deleteListingPhoto(
  photoId: string,
  listingId: string
): Promise<ApiResponse<null>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'User not signed in' };
  }

  const { error } = await supabase
    .from('listing_photos')
    .delete()
    .eq('id', photoId)
    .eq('listing_id', listingId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

/**
 * Réordonne les photos d'une annonce selon l'ordre fourni.
 * Deux passes (indices temporaires puis finaux) pour respecter UNIQUE(listing_id, order_index).
 */
export async function reorderListingPhotos(
  listingId: string,
  orderedPhotoIds: string[]
): Promise<ApiResponse<null>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'User not signed in' };
  }

  if (orderedPhotoIds.length === 0) {
    return { data: null, error: null };
  }

  for (let i = 0; i < orderedPhotoIds.length; i++) {
    const photoId = orderedPhotoIds[i];
    const { error } = await supabase
      .from('listing_photos')
      .update({ order_index: temporaryListingPhotoOrderIndex(i) })
      .eq('id', photoId)
      .eq('listing_id', listingId);

    if (error) {
      return { data: null, error: error.message };
    }
  }

  for (let i = 0; i < orderedPhotoIds.length; i++) {
    const photoId = orderedPhotoIds[i];
    const { error } = await supabase
      .from('listing_photos')
      .update({ order_index: i })
      .eq('id', photoId)
      .eq('listing_id', listingId);

    if (error) {
      return { data: null, error: error.message };
    }
  }

  return { data: null, error: null };
}

/**
 * Récupère les annonces de l'utilisateur connecté
 */
export async function getMyListings(): Promise<ApiResponse<Listing[]>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: [], error: 'User not signed in' };
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
    return { data: [], error: 'User not signed in' };
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
 * Annonces publiées d'un vendeur pour le dressing (closet profil), avec pagination.
 */
export async function getSellerClosetListings(
  sellerId: string,
  params?: { offset?: number; limit?: number }
): Promise<ApiResponse<FeedListing[]>> {
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 20;

  const { data, error } = await supabase
    .from('v_feed_listings')
    .select('*')
    .eq('seller_id', sellerId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data || []) as FeedListing[], error: null };
}

const SELLER_CLOSET_PAGE_SIZE = 20;

/**
 * Toutes les annonces publiées d'un vendeur (pagination interne), pour affichage complet du dressing.
 */
export async function getAllSellerClosetListings(
  sellerId: string,
  options?: { excludeListingId?: string }
): Promise<ApiResponse<FeedListing[]>> {
  let offset = 0;
  const all: FeedListing[] = [];

  while (true) {
    const { data, error } = await getSellerClosetListings(sellerId, {
      offset,
      limit: SELLER_CLOSET_PAGE_SIZE
    });

    if (error) {
      return { data: [], error };
    }

    const rows = data ?? [];
    all.push(...rows);

    if (rows.length < SELLER_CLOSET_PAGE_SIZE) {
      break;
    }

    offset += rows.length;
  }

  const excludeId = options?.excludeListingId;
  if (excludeId) {
    return { data: all.filter((listing) => listing.id !== excludeId), error: null };
  }

  return { data: all, error: null };
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
    return { data: null, error: 'User not signed in' };
  }

  const normalizedPayload: ListingUpdate = { ...payload };

  if (
    (normalizedPayload as any).category_id == null &&
    typeof normalizedPayload.category === 'string' &&
    normalizedPayload.category.trim().length > 0
  ) {
    const resolvedCategoryId = await resolveCategoryIdByLabel(normalizedPayload.category);
    if (resolvedCategoryId != null) {
      (normalizedPayload as any).category_id = resolvedCategoryId;
    }
  }

  const { data, error } = await supabase
    .from('listings')
    .update(normalizedPayload as any)
    .eq('id', id)
    .eq('seller_id', user.id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Listing, error: null };
}

async function resolveCategoryIdByLabel(categoryLabel: string): Promise<number | null> {
  const normalized = categoryLabel.trim();
  if (!normalized) return null;

  const { data: slugMatch } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', normalized)
    .limit(1)
    .maybeSingle();

  if (slugMatch?.id != null) {
    return Number(slugMatch.id);
  }

  const { data: nameMatch } = await supabase
    .from('categories')
    .select('id')
    .eq('name', normalized)
    .limit(1)
    .maybeSingle();

  if (nameMatch?.id != null) {
    return Number(nameMatch.id);
  }

  return null;
}

/** Ancien libellé (rétrocompatibilité des écrans qui proposent « Désactiver »). */
export const LISTING_DELETE_BLOCKED_BY_ORDERS_MESSAGE =
  'This listing cannot be deleted because it is linked to orders. You can deactivate it instead.';

/** Commande encore active (pending / shipped) : pas de suppression physique. */
export const LISTING_DELETE_BLOCKED_ACTIVE_ORDERS_MESSAGE =
  'Cannot delete: an order is still in progress for this listing.';

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
    return { data: null, error: 'User not signed in' };
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
    return { data: null, error: 'Listing not found or access denied' };
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
    return { data: null, error: 'User not signed in' };
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
      titleKey: 'push.likeListing.title',
      bodyKey: 'push.likeListing.body',
      notification_type: 'favorite_items',
      data: { listing_id: listingId }
    });

    const { count: likesCount } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId);

    if (likesCount === 5) {
      void sendPushNotificationWithUserJwt({
        user_id: sellerId,
        titleKey: 'push.likesHot.title',
        bodyKey: 'push.likesHot.body',
        notification_type: 'favorite_items',
        data: { listing_id: listingId, likes_milestone: 5 }
      });
    }

    if (likesCount != null && likesCount >= 2) {
      const { data: otherLikers } = await supabase
        .from('likes')
        .select('user_id')
        .eq('listing_id', listingId)
        .neq('user_id', user.id);

      for (const row of otherLikers ?? []) {
        const likerId = String((row as { user_id?: string }).user_id ?? '').trim();
        if (!likerId || likerId === sellerId) continue;

        if (likesCount === 2) {
          void sendPushNotificationWithUserJwt({
            user_id: likerId,
            titleKey: 'push.urgencySomeoneElse.title',
            bodyKey: 'push.urgencySomeoneElse.body',
            notification_type: 'favorite_items',
            data: { listing_id: listingId }
          });
        }
        if (likesCount === 3) {
          void sendPushNotificationWithUserJwt({
            user_id: likerId,
            titleKey: 'push.urgencySellingFast.title',
            bodyKey: 'push.urgencySellingFast.body',
            notification_type: 'favorite_items',
            data: { listing_id: listingId }
          });
        }
      }
    }
  }

  return { data: { id: (data as any).id as string }, error: null };
}

export async function unlikeListing(listingId: string): Promise<ApiResponse<{ success: true }>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'User not signed in' };
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
    return { data: [], error: 'User not signed in' };
  }

  const blockedIds = await getBlockedSellerIdsForCurrentUser();

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

  return { data: excludeBlockedSellers(cards, blockedIds), error: null };
}

export async function getMyLikedListingIds(): Promise<ApiResponse<string[]>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: [], error: 'User not signed in' };
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
    return { data: [], error: 'User not signed in' };
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
 * Récupère le thread d'une commande (listing + acheteur), s'il existe.
 */
export async function getExistingThreadForOrder(
  listingId: string,
  buyerId: string
): Promise<ApiResponse<Thread | null>> {
  try {
    const { data: existing, error } = await supabase
      .from('threads')
      .select('*')
      .eq('listing_id', listingId)
      .eq('buyer_id', buyerId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return { data: null, error: error.message };
    }

    return { data: (existing as Thread | null) ?? null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Error loading conversation'
    };
  }
}

/**
 * Récupère un thread existant pour un listing (sans en créer).
 */
export async function getExistingThreadForListing(
  listingId: string
): Promise<ApiResponse<Thread | null>> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'User not signed in' };
  }

  try {
    const { data: existing, error } = await supabase
      .from('threads')
      .select('*')
      .eq('listing_id', listingId)
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return { data: null, error: error.message };
    }

    return { data: (existing as Thread | null) ?? null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Error loading conversation'
    };
  }
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
    return { data: null, error: 'User not signed in' };
  }

  if (user.id === sellerId) {
    return { data: null, error: 'Sellers cannot message themselves' };
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
      error: err instanceof Error ? err.message : 'Error creating conversation'
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
    return { data: null, error: 'User not signed in' };
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
    return { data: null, error: 'User not signed in' };
  }

  const { data: offerGate, error: offerGateError } = await getBuyerListingOfferGate(listingId);
  if (offerGateError) {
    return { data: null, error: offerGateError };
  }
  if (offerGate && !offerGate.canOffer) {
    return {
      data: null,
      error: offerGate.reason === 'pending' ? 'OFFER_ALREADY_PENDING' : 'OFFER_ALREADY_ACCEPTED'
    };
  }

  const fallbackBody = `Offer: ${amount.toFixed(2)} ${currency} (status: pending)`;

  // Évite les doublons si l'utilisateur appuie deux fois vite (race avant disabled UI).
  const dedupeSince = new Date(Date.now() - 10_000).toISOString();
  const { data: recentDuplicate, error: dedupeError } = await supabase
    .from('messages')
    .select(
      `
      *,
      sender:profiles!messages_sender_id_fkey(id, display_name, avatar_url)
    `
    )
    .eq('thread_id', threadId)
    .eq('sender_id', user.id)
    .eq('type', 'offer')
    .eq('offer_amount', amount)
    .eq('offer_status', 'pending')
    .gte('created_at', dedupeSince)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dedupeError) {
    return { data: null, error: dedupeError.message };
  }
  if (recentDuplicate) {
    return { data: recentDuplicate as Message, error: null };
  }

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

  const { data: listingRow } = await supabase
    .from('listings')
    .select('seller_id')
    .eq('id', listingId)
    .maybeSingle();
  const offerSellerId = listingRow
    ? String((listingRow as { seller_id?: string }).seller_id ?? '').trim()
    : '';
  if (offerSellerId && offerSellerId !== user.id) {
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        await fetch(`${SUPABASE_URL}/functions/v1/notify-new-offer`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            thread_id: threadId,
            listing_id: listingId,
            message_id: (data as Message).id,
            amount
          })
        });
      } catch {
        // silent
      }
    })();
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
    return { data: [], error: 'User not signed in' };
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
