-- Les covers feed/messages exigent order_index = 0, mais certaines annonces
-- n'ont que des photos indexées à partir de 1 (ex. f4052c36-9409-4226-938e-ae7c95ae40cd).
-- 1) Réindexer les photos existantes (0, 1, 2… par annonce)
-- 2) Prendre la première photo triée par order_index au lieu de filtrer sur = 0

BEGIN;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY listing_id
      ORDER BY order_index ASC, created_at ASC, id ASC
    ) - 1 AS new_index
  FROM public.listing_photos
)
UPDATE public.listing_photos lp
SET order_index = ranked.new_index
FROM ranked
WHERE lp.id = ranked.id
  AND lp.order_index IS DISTINCT FROM ranked.new_index;

CREATE OR REPLACE VIEW public.v_feed_listings AS
SELECT
  l.id,
  l.seller_id,
  l.title,
  l.description,
  l.price,
  (SELECT count(*)::int FROM public.likes lk WHERE lk.listing_id = l.id) AS likes_count,
  l.status,
  l.category,
  l.condition,
  l.delivery_mode,
  l.city,
  l.country_code,
  l.created_at,
  l.published_at,
  l.updated_at,
  lp_cover.url AS cover_photo_url,
  lp_cover.order_index AS cover_photo_order,
  p.display_name AS seller_display_name,
  p.avatar_url AS seller_avatar_url,
  coalesce(l.city, '') AS listing_city,
  coalesce(l.country_code, p.country) AS listing_country,
  l.is_sponsored,
  l.sponsored_until,
  l.sponsor_type,
  l.brand,
  l.size,
  l.color,
  l.latitude,
  l.longitude,
  coalesce(p.is_influencer, false) AS seller_is_influencer,
  l.category_id,
  c.gender AS category_gender
FROM public.listings l
INNER JOIN public.profiles p ON l.seller_id = p.id
LEFT JOIN public.categories c ON c.id = l.category_id
LEFT JOIN LATERAL (
  SELECT url, order_index
  FROM public.listing_photos
  WHERE listing_id = l.id
  ORDER BY order_index ASC, created_at ASC, id ASC
  LIMIT 1
) lp_cover ON true
WHERE l.status = 'published'
ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC;

GRANT SELECT ON public.v_feed_listings TO authenticated;
GRANT SELECT ON public.v_feed_listings TO anon;

DROP VIEW IF EXISTS public.v_thread_list;

CREATE VIEW public.v_thread_list AS
SELECT
  t.id AS thread_id,
  t.listing_id,
  t.buyer_id,
  t.seller_id,
  t.created_at AS thread_created_at,
  t.last_message_at,
  t.buyer_hidden_at,
  t.seller_hidden_at,
  l.title AS listing_title,
  l.price AS listing_price,
  l.status AS listing_status,
  lp_cover.url AS listing_cover_photo_url,
  m_last.id AS last_message_id,
  m_last.body AS last_message_body,
  m_last.sender_id AS last_message_sender_id,
  m_last.created_at AS last_message_created_at,
  m_last.read_at AS last_message_read_at,
  p_sender.display_name AS last_message_sender_name,
  p_sender.avatar_url AS last_message_sender_avatar,
  p_buyer.display_name AS buyer_display_name,
  p_buyer.avatar_url AS buyer_avatar_url,
  p_seller.display_name AS seller_display_name,
  p_seller.avatar_url AS seller_avatar_url
FROM public.threads t
INNER JOIN public.listings l ON t.listing_id = l.id
LEFT JOIN LATERAL (
  SELECT url
  FROM public.listing_photos
  WHERE listing_id = l.id
  ORDER BY order_index ASC, created_at ASC, id ASC
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

GRANT SELECT ON public.v_thread_list TO authenticated;

COMMIT;
