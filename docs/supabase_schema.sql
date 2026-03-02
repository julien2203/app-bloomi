-- ============================================
-- SCHEMA SUPABASE - BLOOMI APP
-- Jalon 1: Structure MVP scalable
-- ============================================

-- ============================================
-- 1. TYPES ENUM
-- ============================================

-- Statut d'une annonce
create type listing_status as enum ('draft', 'published', 'sold', 'archived');

-- Statut d'une commande
create type order_status as enum ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');

-- Mode de livraison
create type delivery_mode as enum ('pickup', 'shipping', 'both');

-- ============================================
-- 2. TABLE PROFILES (déjà existante, mise à jour)
-- ============================================

-- Supprimer l'ancienne table si elle existe (pour migration propre)
-- drop table if exists public.profiles cascade;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text not null,
  country text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Index pour recherche par phone
create index if not exists profiles_phone_idx on public.profiles(phone);

-- ============================================
-- 3. TABLE LISTINGS (Annonces)
-- ============================================

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  price decimal(10, 2) not null check (price >= 0),
  status listing_status not null default 'draft',
  category text,
  condition text, -- 'new', 'like_new', 'good', 'fair', 'poor'
  delivery_mode delivery_mode not null default 'both',
  -- Géolocalisation (optionnel pour MVP, mais prévu pour scalabilité)
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  city text,
  country_code text, -- CH, FR, DE, IT
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz,
  sold_at timestamptz
);

-- Indexes pour listings
create index if not exists listings_seller_id_idx on public.listings(seller_id);
create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_created_at_idx on public.listings(created_at desc);
create index if not exists listings_published_at_idx on public.listings(published_at desc) where status = 'published';
create index if not exists listings_category_idx on public.listings(category) where status = 'published';
-- Index géospatial (si PostGIS disponible, sinon simple index composite)
create index if not exists listings_location_idx on public.listings(latitude, longitude) where latitude is not null and longitude is not null;

-- ============================================
-- 4. TABLE LISTING_PHOTOS (Photos des annonces)
-- ============================================

create table if not exists public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  url text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes pour listing_photos
create index if not exists listing_photos_listing_id_idx on public.listing_photos(listing_id);
create index if not exists listing_photos_order_idx on public.listing_photos(listing_id, order_index);

-- ============================================
-- 5. TABLE THREADS (Conversations entre buyer/seller)
-- ============================================

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  -- Contrainte unique : un buyer ne peut avoir qu'un seul thread par listing
  constraint threads_listing_buyer_unique unique (listing_id, buyer_id)
);

-- Indexes pour threads
create index if not exists threads_listing_id_idx on public.threads(listing_id);
create index if not exists threads_buyer_id_idx on public.threads(buyer_id);
create index if not exists threads_seller_id_idx on public.threads(seller_id);
create index if not exists threads_last_message_at_idx on public.threads(last_message_at desc nulls last);

-- ============================================
-- 6. TABLE MESSAGES (Messages dans les threads)
-- ============================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes pour messages
create index if not exists messages_thread_id_idx on public.messages(thread_id, created_at desc);
create index if not exists messages_sender_id_idx on public.messages(sender_id);

-- ============================================
-- 7. TABLE ORDERS (Commandes)
-- ============================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  status order_status not null default 'pending',
  delivery_mode delivery_mode not null,
  -- Adresse de livraison (si shipping)
  shipping_address text,
  shipping_city text,
  shipping_postal_code text,
  shipping_country text,
  -- Tracking (si shipping)
  tracking_number text,
  -- Dates
  created_at timestamptz not null default timezone('utc', now()),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

-- Indexes pour orders
create index if not exists orders_listing_id_idx on public.orders(listing_id);
create index if not exists orders_buyer_id_idx on public.orders(buyer_id);
create index if not exists orders_seller_id_idx on public.orders(seller_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

-- ============================================
-- 8. TRIGGERS
-- ============================================

-- Fonction pour mettre à jour updated_at automatiquement
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- Trigger pour profiles.updated_at
-- Note: La colonne updated_at doit exister dans la table profiles
-- Si elle n'existe pas, exécuter d'abord:
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function update_updated_at_column();

-- Trigger pour listings.updated_at
create trigger update_listings_updated_at
  before update on public.listings
  for each row
  execute function update_updated_at_column();

-- Trigger pour mettre à jour last_message_at dans threads
create or replace function update_thread_last_message_at()
returns trigger as $$
begin
  update public.threads
  set last_message_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$ language plpgsql;

create trigger update_thread_last_message_at_trigger
  after insert on public.messages
  for each row
  execute function update_thread_last_message_at();

-- ============================================
-- 9. FONCTION POUR CRÉER UN PROFILE AUTOMATIQUEMENT
-- ============================================

-- Fonction pour créer un profile lors de la création d'un user
-- Note: Cette fonction doit être appelée manuellement depuis l'app
-- ou via un trigger auth.users (si Supabase le permet)
-- Pour l'instant, on utilise ensureProfileExists dans l'app

create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Cette fonction peut être appelée depuis un trigger auth.users
  -- mais Supabase ne permet pas toujours les triggers sur auth.users
  -- On préfère créer le profile depuis l'app avec ensureProfileExists
  return new;
end;
$$ language plpgsql security definer;

-- ============================================
-- NOTES D'APPLICATION
-- ============================================
-- 
-- Pour appliquer ce schéma dans Supabase:
-- 1. Ouvrir Supabase Dashboard > SQL Editor
-- 2. Coller ce fichier complet
-- 3. Exécuter la requête
-- 4. Vérifier que toutes les tables sont créées
-- 5. Appliquer ensuite le fichier supabase_rls.sql pour les politiques RLS
--
-- IMPORTANT: Le profile est créé depuis l'app via ensureProfileExists()
-- car Supabase ne permet pas toujours les triggers sur auth.users
-- ============================================
