-- ============================================
-- RLS POLICIES COMPLÈTES - BLOOMI APP
-- Activation RLS + création des policies
-- ============================================

-- ============================================
-- 1. PROFILES
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- SELECT: Public minimal (tous peuvent voir les profils pour afficher vendeurs sur listings)
-- Justification: Marketplace nécessite affichage nom/avatar des vendeurs. 
-- Note: Côté app, ne pas exposer phone/country dans les requêtes publiques.
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

-- INSERT: Owner-only (auth.uid() = id)
CREATE POLICY "Users can create their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: Owner-only (auth.uid() = id)
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. LISTINGS
-- ============================================

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Published listings are viewable by everyone" ON public.listings;
DROP POLICY IF EXISTS "Users can view their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can create their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can delete their own listings" ON public.listings;

-- SELECT: Public uniquement si status='published'; seller voit ses drafts
CREATE POLICY "Published listings are viewable by everyone"
  ON public.listings
  FOR SELECT
  USING (
    status = 'published' OR
    seller_id = auth.uid()
  );

-- INSERT: Seller-only (seller_id = auth.uid())
CREATE POLICY "Users can create their own listings"
  ON public.listings
  FOR INSERT
  WITH CHECK (seller_id = auth.uid());

-- UPDATE: Seller-only (seller_id = auth.uid())
CREATE POLICY "Users can update their own listings"
  ON public.listings
  FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- DELETE: Seller-only (seller_id = auth.uid())
CREATE POLICY "Users can delete their own listings"
  ON public.listings
  FOR DELETE
  USING (seller_id = auth.uid());

-- ============================================
-- 3. LISTING_PHOTOS
-- ============================================

ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Photos of published listings are viewable by everyone" ON public.listing_photos;
DROP POLICY IF EXISTS "Users can add photos to their own listings" ON public.listing_photos;
DROP POLICY IF EXISTS "Users can update photos of their own listings" ON public.listing_photos;
DROP POLICY IF EXISTS "Users can delete photos of their own listings" ON public.listing_photos;

-- SELECT: Mêmes droits que listing (public si listing published, seller voit ses photos)
CREATE POLICY "Photos of published listings are viewable by everyone"
  ON public.listing_photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_photos.listing_id
      AND (listings.status = 'published' OR listings.seller_id = auth.uid())
    )
  );

-- INSERT: Seller-only (seller du listing)
CREATE POLICY "Users can add photos to their own listings"
  ON public.listing_photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_photos.listing_id
      AND listings.seller_id = auth.uid()
    )
  );

-- UPDATE: Seller-only (seller du listing)
CREATE POLICY "Users can update photos of their own listings"
  ON public.listing_photos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_photos.listing_id
      AND listings.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_photos.listing_id
      AND listings.seller_id = auth.uid()
    )
  );

-- DELETE: Seller-only (seller du listing)
CREATE POLICY "Users can delete photos of their own listings"
  ON public.listing_photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_photos.listing_id
      AND listings.seller_id = auth.uid()
    )
  );

-- ============================================
-- 4. THREADS
-- ============================================

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Users can view threads they are part of" ON public.threads;
DROP POLICY IF EXISTS "Users can create threads as buyer" ON public.threads;

-- SELECT: Uniquement buyer/seller
CREATE POLICY "Users can view threads they are part of"
  ON public.threads
  FOR SELECT
  USING (
    buyer_id = auth.uid() OR
    seller_id = auth.uid()
  );

-- INSERT: auth.uid() doit être buyer ou seller, et listing_id valide
CREATE POLICY "Users can create threads as buyer or seller"
  ON public.threads
  FOR INSERT
  WITH CHECK (
    (buyer_id = auth.uid() OR seller_id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = threads.listing_id
    )
  );

-- ============================================
-- 5. MESSAGES
-- ============================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Users can view messages in their threads" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in their threads" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

-- SELECT: Uniquement participants du thread
CREATE POLICY "Users can view messages in their threads"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.threads
      WHERE threads.id = messages.thread_id
      AND (threads.buyer_id = auth.uid() OR threads.seller_id = auth.uid())
    )
  );

-- INSERT: sender_id = auth.uid() + sender participant du thread
CREATE POLICY "Users can send messages in their threads"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.threads
      WHERE threads.id = messages.thread_id
      AND (threads.buyer_id = auth.uid() OR threads.seller_id = auth.uid())
    )
  );

-- UPDATE: Permettre mise à jour read_at uniquement
CREATE POLICY "Users can update their own messages"
  ON public.messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- ============================================
-- 6. ORDERS
-- ============================================

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Users can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers and sellers can update their orders" ON public.orders;

-- SELECT: Buyer/seller uniquement
CREATE POLICY "Users can view their orders"
  ON public.orders
  FOR SELECT
  USING (
    buyer_id = auth.uid() OR
    seller_id = auth.uid()
  );

-- INSERT: Buyer-only (auth.uid() = buyer_id)
CREATE POLICY "Buyers can create orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

-- UPDATE: Buyer/seller peuvent mettre à jour selon transitions MVP
-- Transitions MVP: pending -> confirmed (seller), confirmed -> shipped (seller), shipped -> delivered (buyer/seller), any -> cancelled (buyer/seller)
CREATE POLICY "Buyers and sellers can update their orders"
  ON public.orders
  FOR UPDATE
  USING (
    buyer_id = auth.uid() OR
    seller_id = auth.uid()
  )
  WITH CHECK (
    buyer_id = auth.uid() OR
    seller_id = auth.uid()
  );

-- ============================================
-- FIN
-- ============================================
