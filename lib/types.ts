/**
 * Types TypeScript pour l'application Bloomi
 * Correspondent aux tables Supabase/Postgres
 */

import type { Database } from './supabase';

// ============================================
// ENUMS
// ============================================

export type ListingStatus = 'draft' | 'published' | 'sold' | 'archived';
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type DeliveryMode = 'pickup' | 'shipping' | 'both';

// ============================================
// PROFILES
// ============================================

export interface Profile {
  id: string;
  phone: string;
  country: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Omit<Profile, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;

// ============================================
// LISTINGS
// ============================================

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  status: ListingStatus;
  category: string | null;
  condition: string | null;
  delivery_mode: DeliveryMode;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country_code: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  sold_at: string | null;
}

export type ListingInsert = Omit<
  Listing,
  'id' | 'created_at' | 'updated_at' | 'published_at' | 'sold_at'
> & {
  id?: string;
};

export type ListingUpdate = Partial<
  Omit<Listing, 'id' | 'seller_id' | 'created_at' | 'updated_at'>
>;

// Listing avec relations (pour les requêtes avec joins)
export interface ListingWithRelations extends Listing {
  seller?: Profile;
  photos?: ListingPhoto[];
  _count?: {
    photos?: number;
    threads?: number;
  };
}

// ============================================
// LISTING_PHOTOS
// ============================================

export interface ListingPhoto {
  id: string;
  listing_id: string;
  url: string;
  order_index: number;
  created_at: string;
}

export type ListingPhotoInsert = Omit<ListingPhoto, 'id' | 'created_at'> & {
  id?: string;
};

export type ListingPhotoUpdate = Partial<Omit<ListingPhoto, 'id' | 'listing_id' | 'created_at'>>;

// ============================================
// THREADS
// ============================================

export interface Thread {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message_at: string | null;
  created_at: string;
}

export type ThreadInsert = Omit<Thread, 'id' | 'last_message_at' | 'created_at'> & {
  id?: string;
};

// Thread avec relations
export interface ThreadWithRelations extends Thread {
  listing?: Listing;
  buyer?: Profile;
  seller?: Profile;
  last_message?: Message;
  unread_count?: number;
}

// ============================================
// MESSAGES
// ============================================

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export type MessageInsert = Omit<Message, 'id' | 'read_at' | 'created_at'> & {
  id?: string;
};

export type MessageUpdate = Partial<Omit<Message, 'id' | 'thread_id' | 'sender_id' | 'created_at'>>;

// Message avec relations
export interface MessageWithRelations extends Message {
  sender?: Profile;
  thread?: Thread;
}

// ============================================
// ORDERS
// ============================================

export interface Order {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  delivery_mode: DeliveryMode;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  tracking_number: string | null;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}

export type OrderInsert = Omit<
  Order,
  | 'id'
  | 'created_at'
  | 'confirmed_at'
  | 'shipped_at'
  | 'delivered_at'
  | 'cancelled_at'
> & {
  id?: string;
};

export type OrderUpdate = Partial<
  Omit<Order, 'id' | 'listing_id' | 'buyer_id' | 'seller_id' | 'created_at'>
>;

// Order avec relations
export interface OrderWithRelations extends Order {
  listing?: Listing;
  buyer?: Profile;
  seller?: Profile;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// FILTERS & QUERIES
// ============================================

export interface ListingFilters {
  status?: ListingStatus;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  deliveryMode?: DeliveryMode;
  country?: string;
  city?: string;
  search?: string;
}

export interface ListingQuery extends ListingFilters {
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'price' | 'published_at';
  sortOrder?: 'asc' | 'desc';
}
