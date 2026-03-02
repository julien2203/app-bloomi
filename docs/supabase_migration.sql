-- ============================================
-- MIGRATION SUPABASE - BLOOMI APP
-- Script idempotent pour compléter/solidifier le schéma existant
-- ============================================
-- 
-- Ce script peut être exécuté plusieurs fois sans erreur
-- Il ajoute uniquement ce qui manque
-- ============================================

-- ============================================
-- 1. ENUMS (création si absents)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    CREATE TYPE listing_status AS ENUM ('draft', 'published', 'sold', 'archived');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_mode') THEN
    CREATE TYPE delivery_mode AS ENUM ('pickup', 'shipping', 'both');
  END IF;
END $$;

-- ============================================
-- 2. CONTRAINTES D'INTÉGRITÉ
-- ============================================

-- Contrainte price >= 0 sur listings (si pas déjà présente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'listings_price_check' 
    AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings 
    ADD CONSTRAINT listings_price_check CHECK (price >= 0);
  END IF;
END $$;

-- Contrainte buyer_id != seller_id sur threads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'threads_buyer_seller_different' 
    AND conrelid = 'public.threads'::regclass
  ) THEN
    ALTER TABLE public.threads 
    ADD CONSTRAINT threads_buyer_seller_different CHECK (buyer_id != seller_id);
  END IF;
END $$;

-- Contrainte buyer_id != seller_id sur orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_buyer_seller_different' 
    AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders 
    ADD CONSTRAINT orders_buyer_seller_different CHECK (buyer_id != seller_id);
  END IF;
END $$;

-- Contrainte unique (listing_id, order_index) sur listing_photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'listing_photos_listing_order_unique' 
    AND conrelid = 'public.listing_photos'::regclass
  ) THEN
    ALTER TABLE public.listing_photos 
    ADD CONSTRAINT listing_photos_listing_order_unique UNIQUE (listing_id, order_index);
  END IF;
END $$;

-- Vérification et correction des ON DELETE sur foreign keys
-- listings.seller_id -> profiles (cascade)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'listings'
    AND kcu.column_name = 'seller_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF constraint_name_var IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = constraint_name_var
      AND delete_rule = 'CASCADE'
    ) THEN
      EXECUTE format('ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
      ALTER TABLE public.listings 
      ADD CONSTRAINT listings_seller_id_fkey 
      FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- threads.listing_id -> listings (cascade)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'threads'
    AND kcu.column_name = 'listing_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF constraint_name_var IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = constraint_name_var
      AND delete_rule = 'CASCADE'
    ) THEN
      EXECUTE format('ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
      ALTER TABLE public.threads 
      ADD CONSTRAINT threads_listing_id_fkey 
      FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- threads.buyer_id -> profiles (cascade)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'threads'
    AND kcu.column_name = 'buyer_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF constraint_name_var IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = constraint_name_var
      AND delete_rule = 'CASCADE'
    ) THEN
      EXECUTE format('ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
      ALTER TABLE public.threads 
      ADD CONSTRAINT threads_buyer_id_fkey 
      FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- threads.seller_id -> profiles (cascade)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'threads'
    AND kcu.column_name = 'seller_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF constraint_name_var IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = constraint_name_var
      AND delete_rule = 'CASCADE'
    ) THEN
      EXECUTE format('ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
      ALTER TABLE public.threads 
      ADD CONSTRAINT threads_seller_id_fkey 
      FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- messages.thread_id -> threads (cascade)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'messages'
    AND kcu.column_name = 'thread_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF constraint_name_var IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = constraint_name_var
      AND delete_rule = 'CASCADE'
    ) THEN
      EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
      ALTER TABLE public.messages 
      ADD CONSTRAINT messages_thread_id_fkey 
      FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- messages.sender_id -> profiles (cascade)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'messages'
    AND kcu.column_name = 'sender_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF constraint_name_var IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = constraint_name_var
      AND delete_rule = 'CASCADE'
    ) THEN
      EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
      ALTER TABLE public.messages 
      ADD CONSTRAINT messages_sender_id_fkey 
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- listing_photos.listing_id -> listings (cascade)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'listing_photos'
    AND kcu.column_name = 'listing_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF constraint_name_var IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = constraint_name_var
      AND delete_rule = 'CASCADE'
    ) THEN
      EXECUTE format('ALTER TABLE public.listing_photos DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
      ALTER TABLE public.listing_photos 
      ADD CONSTRAINT listing_photos_listing_id_fkey 
      FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- orders.listing_id -> listings (restrict - pour éviter suppression accidentelle)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'orders'
    AND kcu.column_name = 'listing_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF constraint_name_var IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = constraint_name_var
      AND delete_rule = 'RESTRICT'
    ) THEN
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
      ALTER TABLE public.orders 
      ADD CONSTRAINT orders_listing_id_fkey 
      FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

-- orders.buyer_id -> profiles (cascade)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'orders'
    AND kcu.column_name = 'buyer_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF constraint_name_var IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = constraint_name_var
      AND delete_rule = 'CASCADE'
    ) THEN
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
      ALTER TABLE public.orders 
      ADD CONSTRAINT orders_buyer_id_fkey 
      FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- orders.seller_id -> profiles (cascade)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'orders'
    AND kcu.column_name = 'seller_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF constraint_name_var IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = constraint_name_var
      AND delete_rule = 'CASCADE'
    ) THEN
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
      ALTER TABLE public.orders 
      ADD CONSTRAINT orders_seller_id_fkey 
      FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================
-- 3. INDEXES (création si absents)
-- ============================================

-- Indexes pour feed (listings publiés)
CREATE INDEX IF NOT EXISTS listings_feed_idx 
ON public.listings(published_at DESC NULLS LAST, created_at DESC) 
WHERE status = 'published';

-- Indexes pour threads (optimisation des requêtes)
CREATE INDEX IF NOT EXISTS threads_user_idx 
ON public.threads(buyer_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS threads_user_seller_idx 
ON public.threads(seller_id, last_message_at DESC NULLS LAST);

-- Index composite pour threads (buyer + seller)
CREATE INDEX IF NOT EXISTS threads_participants_idx 
ON public.threads(buyer_id, seller_id, last_message_at DESC NULLS LAST);

-- Indexes pour messages (optimisation des requêtes par thread)
CREATE INDEX IF NOT EXISTS messages_thread_created_idx 
ON public.messages(thread_id, created_at DESC);

-- Index pour messages non lus (si besoin)
CREATE INDEX IF NOT EXISTS messages_unread_idx 
ON public.messages(thread_id, created_at DESC) 
WHERE read_at IS NULL;

-- Indexes pour orders (optimisation des requêtes)
CREATE INDEX IF NOT EXISTS orders_user_status_idx 
ON public.orders(buyer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_seller_status_idx 
ON public.orders(seller_id, status, created_at DESC);

-- Index composite pour orders (buyer + seller)
CREATE INDEX IF NOT EXISTS orders_participants_idx 
ON public.orders(buyer_id, seller_id, created_at DESC);

-- Index pour orders par listing
CREATE INDEX IF NOT EXISTS orders_listing_status_idx 
ON public.orders(listing_id, status);

-- ============================================
-- 4. TRIGGERS updated_at
-- ============================================

-- Fonction pour mettre à jour updated_at (création si absente)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- S'assurer que la colonne updated_at existe dans profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

-- Mettre à jour les enregistrements existants qui auraient updated_at = NULL
UPDATE public.profiles 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Trigger pour profiles.updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Trigger pour listings.updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_listings_updated_at'
  ) THEN
    CREATE TRIGGER update_listings_updated_at
    BEFORE UPDATE ON public.listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 5. TRIGGER last_message_at (threads)
-- ============================================

-- Fonction pour mettre à jour last_message_at (création si absente)
CREATE OR REPLACE FUNCTION update_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour messages (mise à jour last_message_at)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_thread_last_message_at_trigger'
  ) THEN
    CREATE TRIGGER update_thread_last_message_at_trigger
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_last_message_at();
  END IF;
END $$;

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================
-- 
-- Vérifications à effectuer après exécution:
-- 1. SELECT * FROM pg_type WHERE typname IN ('listing_status', 'order_status', 'delivery_mode');
-- 2. SELECT conname, contype FROM pg_constraint WHERE conrelid::regclass::text LIKE 'public.%';
-- 3. SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
-- 4. SELECT tgname FROM pg_trigger WHERE tgname LIKE 'update_%';
-- ============================================
