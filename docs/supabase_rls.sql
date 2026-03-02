-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES - BLOOMI APP
-- Jalon 1: Politiques de sécurité strictes
-- ============================================
--
-- IMPORTANT: Appliquer ce fichier APRÈS supabase_schema.sql
-- ============================================

-- ============================================
-- 1. PROFILES
-- ============================================

alter table public.profiles enable row level security;

-- Supprimer les anciennes policies si elles existent
drop policy if exists "Profiles are viewable by owner" on public.profiles;
drop policy if exists "Profiles can be inserted by owner" on public.profiles;
drop policy if exists "Profiles can be updated by owner" on public.profiles;

-- Lecture: chaque utilisateur peut lire son propre profil
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Insertion: chaque utilisateur peut créer son propre profil
create policy "Users can create their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Mise à jour: chaque utilisateur peut modifier son propre profil
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================
-- 2. LISTINGS
-- ============================================

alter table public.listings enable row level security;

-- Lecture: tout le monde peut lire les annonces publiées, le vendeur peut lire ses propres annonces
create policy "Published listings are viewable by everyone"
  on public.listings
  for select
  using (
    status = 'published' or
    seller_id = auth.uid()
  );

-- Insertion: seul le vendeur peut créer une annonce
create policy "Users can create their own listings"
  on public.listings
  for insert
  with check (seller_id = auth.uid());

-- Mise à jour: seul le vendeur peut modifier ses propres annonces
create policy "Users can update their own listings"
  on public.listings
  for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- Suppression: seul le vendeur peut supprimer ses propres annonces
create policy "Users can delete their own listings"
  on public.listings
  for delete
  using (seller_id = auth.uid());

-- ============================================
-- 3. LISTING_PHOTOS
-- ============================================

alter table public.listing_photos enable row level security;

-- Lecture: tout le monde peut voir les photos des annonces publiées, le vendeur peut voir toutes ses photos
create policy "Photos of published listings are viewable by everyone"
  on public.listing_photos
  for select
  using (
    exists (
      select 1 from public.listings
      where listings.id = listing_photos.listing_id
      and (listings.status = 'published' or listings.seller_id = auth.uid())
    )
  );

-- Insertion: seul le vendeur peut ajouter des photos à ses annonces
create policy "Users can add photos to their own listings"
  on public.listing_photos
  for insert
  with check (
    exists (
      select 1 from public.listings
      where listings.id = listing_photos.listing_id
      and listings.seller_id = auth.uid()
    )
  );

-- Mise à jour: seul le vendeur peut modifier les photos de ses annonces
create policy "Users can update photos of their own listings"
  on public.listing_photos
  for update
  using (
    exists (
      select 1 from public.listings
      where listings.id = listing_photos.listing_id
      and listings.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.listings
      where listings.id = listing_photos.listing_id
      and listings.seller_id = auth.uid()
    )
  );

-- Suppression: seul le vendeur peut supprimer les photos de ses annonces
create policy "Users can delete photos of their own listings"
  on public.listing_photos
  for delete
  using (
    exists (
      select 1 from public.listings
      where listings.id = listing_photos.listing_id
      and listings.seller_id = auth.uid()
    )
  );

-- ============================================
-- 4. THREADS
-- ============================================

alter table public.threads enable row level security;

-- Lecture: seul le buyer ou le seller peuvent lire un thread
create policy "Users can view threads they are part of"
  on public.threads
  for select
  using (
    buyer_id = auth.uid() or
    seller_id = auth.uid()
  );

-- Insertion: n'importe qui peut créer un thread (mais buyer_id doit être auth.uid())
create policy "Users can create threads as buyer"
  on public.threads
  for insert
  with check (buyer_id = auth.uid());

-- Mise à jour: pas de mise à jour directe (seul last_message_at est mis à jour via trigger)
-- Pas de policy UPDATE nécessaire

-- Suppression: pas de suppression (on archive plutôt)
-- Pas de policy DELETE nécessaire

-- ============================================
-- 5. MESSAGES
-- ============================================

alter table public.messages enable row level security;

-- Lecture: seul le buyer ou le seller du thread peuvent lire les messages
create policy "Users can view messages in their threads"
  on public.messages
  for select
  using (
    exists (
      select 1 from public.threads
      where threads.id = messages.thread_id
      and (threads.buyer_id = auth.uid() or threads.seller_id = auth.uid())
    )
  );

-- Insertion: seul le buyer ou le seller peuvent envoyer un message, et sender_id doit être auth.uid()
create policy "Users can send messages in their threads"
  on public.messages
  for insert
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.threads
      where threads.id = messages.thread_id
      and (threads.buyer_id = auth.uid() or threads.seller_id = auth.uid())
    )
  );

-- Mise à jour: seul l'expéditeur peut marquer son message comme lu (via read_at)
create policy "Users can update their own messages"
  on public.messages
  for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- Suppression: pas de suppression (on archive plutôt)
-- Pas de policy DELETE nécessaire

-- ============================================
-- 6. ORDERS
-- ============================================

alter table public.orders enable row level security;

-- Lecture: seul le buyer ou le seller peuvent lire une commande
create policy "Users can view their orders"
  on public.orders
  for select
  using (
    buyer_id = auth.uid() or
    seller_id = auth.uid()
  );

-- Insertion: seul le buyer peut créer une commande, et buyer_id doit être auth.uid()
create policy "Buyers can create orders"
  on public.orders
  for insert
  with check (buyer_id = auth.uid());

-- Mise à jour: le buyer et le seller peuvent mettre à jour une commande (changement de statut)
create policy "Buyers and sellers can update their orders"
  on public.orders
  for update
  using (
    buyer_id = auth.uid() or
    seller_id = auth.uid()
  )
  with check (
    buyer_id = auth.uid() or
    seller_id = auth.uid()
  );

-- Suppression: pas de suppression (on annule plutôt via status = 'cancelled')
-- Pas de policy DELETE nécessaire

-- ============================================
-- NOTES D'APPLICATION
-- ============================================
--
-- Pour appliquer ces politiques RLS dans Supabase:
-- 1. Ouvrir Supabase Dashboard > SQL Editor
-- 2. Coller ce fichier complet
-- 3. Exécuter la requête
-- 4. Vérifier que toutes les policies sont créées dans Authentication > Policies
--
-- IMPORTANT: Les policies RLS sont strictes par défaut
-- Si aucune policy ne correspond, l'accès est refusé
-- ============================================
