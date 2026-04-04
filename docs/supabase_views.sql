-- ============================================
-- VIEWS SQL - BLOOMI APP
-- Vues pour simplifier les requêtes côté app
-- ============================================
--
-- PRÉREQUIS: S'assurer que la table profiles a les colonnes display_name et avatar_url
-- Si elles n'existent pas, exécuter d'abord:
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
-- ============================================

-- ============================================
-- 1. V_FEED_LISTINGS
-- Listings publiés + cover photo (order_index=0) + ville/pays du vendeur
-- ============================================

CREATE OR REPLACE VIEW public.v_feed_listings AS
SELECT 
  l.id,
  l.seller_id,
  l.title,
  l.description,
  l.price,
  -- Likes count (instant display)
  (SELECT COUNT(*)::int FROM public.likes lk WHERE lk.listing_id = l.id) AS likes_count,
  l.status,
  l.category,
  l.condition,
  l.delivery_mode,
  l.city,
  l.country_code,
  l.created_at,
  l.published_at,
  l.updated_at,
  -- Cover photo (order_index=0)
  lp_cover.url AS cover_photo_url,
  lp_cover.order_index AS cover_photo_order,
  -- Seller info minimal
  p.display_name AS seller_display_name,
  p.avatar_url AS seller_avatar_url,
  -- Seller location (from profile or listing)
  COALESCE(l.city, '') AS listing_city,
  COALESCE(l.country_code, p.country) AS listing_country
FROM public.listings l
INNER JOIN public.profiles p ON l.seller_id = p.id
LEFT JOIN LATERAL (
  SELECT url, order_index
  FROM public.listing_photos
  WHERE listing_id = l.id
  AND order_index = 0
  LIMIT 1
) lp_cover ON true
WHERE l.status = 'published'
ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC;

-- Grant SELECT sur la view
GRANT SELECT ON public.v_feed_listings TO authenticated;
GRANT SELECT ON public.v_feed_listings TO anon;

-- ============================================
-- 2. V_THREAD_LIST
-- Threads user + last_message + listing title + cover photo
-- Note: Le filtre auth.uid() sera appliqué côté app via RLS
-- ============================================

CREATE OR REPLACE VIEW public.v_thread_list AS
SELECT 
  t.id AS thread_id,
  t.listing_id,
  t.buyer_id,
  t.seller_id,
  t.created_at AS thread_created_at,
  t.last_message_at,
  -- Listing info
  l.title AS listing_title,
  l.price AS listing_price,
  l.status AS listing_status,
  -- Cover photo
  lp_cover.url AS listing_cover_photo_url,
  -- Last message
  m_last.id AS last_message_id,
  m_last.body AS last_message_body,
  m_last.sender_id AS last_message_sender_id,
  m_last.created_at AS last_message_created_at,
  m_last.read_at AS last_message_read_at,
  -- Sender info (last message)
  p_sender.display_name AS last_message_sender_name,
  p_sender.avatar_url AS last_message_sender_avatar,
  -- Buyer info
  p_buyer.display_name AS buyer_display_name,
  p_buyer.avatar_url AS buyer_avatar_url,
  -- Seller info
  p_seller.display_name AS seller_display_name,
  p_seller.avatar_url AS seller_avatar_url
FROM public.threads t
INNER JOIN public.listings l ON t.listing_id = l.id
LEFT JOIN LATERAL (
  SELECT url
  FROM public.listing_photos
  WHERE listing_id = l.id
  AND order_index = 0
  LIMIT 1
) lp_cover ON true
LEFT JOIN LATERAL (
  SELECT id, body, sender_id, created_at, read_at
  FROM public.messages
  WHERE thread_id = t.id
  ORDER BY created_at DESC
  LIMIT 1
) m_last ON true
LEFT JOIN public.profiles p_sender ON m_last.sender_id = p_sender.id
LEFT JOIN public.profiles p_buyer ON t.buyer_id = p_buyer.id
LEFT JOIN public.profiles p_seller ON t.seller_id = p_seller.id;

-- Grant SELECT sur la view
GRANT SELECT ON public.v_thread_list TO authenticated;

-- ============================================
-- 3. V_LISTING_DETAIL
-- Listing + photos triées + seller profile minimal
-- ============================================

CREATE OR REPLACE VIEW public.v_listing_detail AS
SELECT 
  l.id,
  l.seller_id,
  l.title,
  l.description,
  l.price,
  l.status,
  l.category,
  l.condition,
  l.delivery_mode,
  l.latitude,
  l.longitude,
  l.city,
  l.country_code,
  l.created_at,
  l.updated_at,
  l.published_at,
  l.sold_at,
  -- Seller profile minimal
  p.display_name AS seller_display_name,
  p.avatar_url AS seller_avatar_url,
  p.country AS seller_country,
  -- Photos (JSON array trié par order_index)
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', lp.id,
          'url', lp.url,
          'order_index', lp.order_index,
          'created_at', lp.created_at
        ) ORDER BY lp.order_index
      )
      FROM public.listing_photos lp
      WHERE lp.listing_id = l.id
    ),
    '[]'::json
  ) AS photos,
  l.brand,
  l.size,
  l.color,
  (
    SELECT COUNT(*)::int
    FROM public.listings l2
    WHERE l2.seller_id = l.seller_id
      AND l2.status = 'published'
  ) AS seller_published_count
FROM public.listings l
INNER JOIN public.profiles p ON l.seller_id = p.id;

-- Grant SELECT sur la view
GRANT SELECT ON public.v_listing_detail TO authenticated;
GRANT SELECT ON public.v_listing_detail TO anon;

-- ============================================
-- NOTES
-- ============================================
-- 
-- Les views utilisent auth.uid() pour filtrer selon l'utilisateur connecté
-- RLS est automatiquement appliqué sur les tables sous-jacentes
-- 
-- Pour utiliser ces views dans Supabase:
-- - SELECT * FROM public.v_feed_listings;
-- - SELECT * FROM public.v_thread_list;
-- - SELECT * FROM public.v_listing_detail WHERE id = '...';
-- ============================================
