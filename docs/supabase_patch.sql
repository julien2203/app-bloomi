-- ============================================
-- PATCH SQL - BLOOMI APP
-- Script minimal pour aligner avec le schéma cible
-- À exécuter APRÈS avoir lancé le diagnostic
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
-- 2. COLONNES MANQUANTES
-- ============================================

-- Profiles: display_name et avatar_url
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Profiles: updated_at (si manquant)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

-- Mettre à jour les enregistrements existants
UPDATE public.profiles 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- ============================================
-- 3. CONTRAINTES CHECK
-- ============================================

-- listings.price >= 0
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

-- threads.buyer_id != seller_id
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

-- orders.buyer_id != seller_id
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

-- listing_photos: unique (listing_id, order_index)
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

-- ============================================
-- 4. FOREIGN KEYS - ON DELETE
-- ============================================

-- Fonction helper pour corriger ON DELETE
CREATE OR REPLACE FUNCTION fix_fk_on_delete(
  p_table_name text,
  p_column_name text,
  p_ref_table text,
  p_ref_column text,
  p_on_delete text
) RETURNS void AS $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Trouver le nom de la contrainte
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = p_table_name
    AND kcu.column_name = p_column_name
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;
  
  IF v_constraint_name IS NOT NULL THEN
    -- Vérifier si ON DELETE est correct
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = v_constraint_name
      AND delete_rule = p_on_delete
    ) THEN
      -- Supprimer et recréer avec le bon ON DELETE
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', p_table_name, v_constraint_name);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I_%s_fkey FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE %s',
        p_table_name, p_table_name, p_column_name, p_column_name, p_ref_table, p_ref_column, p_on_delete
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Corriger toutes les FK (CASCADE sauf orders.listing_id = RESTRICT)
SELECT fix_fk_on_delete('listings', 'seller_id', 'profiles', 'id', 'CASCADE');
SELECT fix_fk_on_delete('listing_photos', 'listing_id', 'listings', 'id', 'CASCADE');
SELECT fix_fk_on_delete('threads', 'listing_id', 'listings', 'id', 'CASCADE');
SELECT fix_fk_on_delete('threads', 'buyer_id', 'profiles', 'id', 'CASCADE');
SELECT fix_fk_on_delete('threads', 'seller_id', 'profiles', 'id', 'CASCADE');
SELECT fix_fk_on_delete('messages', 'thread_id', 'threads', 'id', 'CASCADE');
SELECT fix_fk_on_delete('messages', 'sender_id', 'profiles', 'id', 'CASCADE');
SELECT fix_fk_on_delete('orders', 'listing_id', 'listings', 'id', 'RESTRICT');
SELECT fix_fk_on_delete('orders', 'buyer_id', 'profiles', 'id', 'CASCADE');
SELECT fix_fk_on_delete('orders', 'seller_id', 'profiles', 'id', 'CASCADE');

-- Nettoyer la fonction helper
DROP FUNCTION IF EXISTS fix_fk_on_delete(text, text, text, text, text);

-- ============================================
-- 5. INDEXES ESSENTIELS
-- ============================================

-- Feed listings
CREATE INDEX IF NOT EXISTS listings_feed_idx 
ON public.listings(published_at DESC NULLS LAST, created_at DESC) 
WHERE status = 'published';

-- Threads user
CREATE INDEX IF NOT EXISTS threads_user_idx 
ON public.threads(buyer_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS threads_user_seller_idx 
ON public.threads(seller_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS threads_participants_idx 
ON public.threads(buyer_id, seller_id, last_message_at DESC NULLS LAST);

-- Messages
CREATE INDEX IF NOT EXISTS messages_thread_created_idx 
ON public.messages(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_unread_idx 
ON public.messages(thread_id, created_at DESC) 
WHERE read_at IS NULL;

-- Orders
CREATE INDEX IF NOT EXISTS orders_user_status_idx 
ON public.orders(buyer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_seller_status_idx 
ON public.orders(seller_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_participants_idx 
ON public.orders(buyer_id, seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_listing_status_idx 
ON public.orders(listing_id, status);

-- ============================================
-- 6. FUNCTIONS ET TRIGGERS
-- ============================================

-- Function updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger profiles.updated_at
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

-- Trigger listings.updated_at
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

-- Function last_message_at
CREATE OR REPLACE FUNCTION update_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger messages -> last_message_at
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
-- FIN DU PATCH
-- ============================================
-- 
-- Note: Les RLS policies doivent être appliquées séparément
-- via docs/supabase_rls_complete.sql
-- ============================================
