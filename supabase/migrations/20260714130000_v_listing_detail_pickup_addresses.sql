-- Expose pickup address snapshot on listing detail view
DROP VIEW IF EXISTS public.v_listing_detail CASCADE;

CREATE VIEW public.v_listing_detail AS
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
  p.display_name AS seller_display_name,
  p.avatar_url AS seller_avatar_url,
  p.country AS seller_country,
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
    SELECT count(*)::int
    FROM public.listings l2
    WHERE l2.seller_id = l.seller_id
      AND l2.status = 'published'
  ) AS seller_published_count,
  COALESCE(p.is_influencer, false) AS seller_is_influencer,
  l.pickup_primary_street,
  l.pickup_primary_postal_code,
  l.pickup_primary_city,
  l.pickup_work_street,
  l.pickup_work_postal_code,
  l.pickup_work_city
FROM public.listings l
INNER JOIN public.profiles p ON l.seller_id = p.id;

GRANT SELECT ON public.v_listing_detail TO authenticated;
GRANT SELECT ON public.v_listing_detail TO anon;

CREATE OR REPLACE FUNCTION public.get_similar_listings(
  p_listing_id uuid,
  p_limit int DEFAULT 6
)
RETURNS SETOF public.v_listing_detail
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH
base_context AS (
  SELECT
    l.id,
    l.seller_id,
    l.category_id AS base_category_id,
    c.gender AS base_gender
  FROM public.listings l
  JOIN public.categories c ON c.id = l.category_id
  WHERE l.id = p_listing_id
),
strict_matches AS (
  SELECT l.id
  FROM public.listings l
  CROSS JOIN base_context bc
  JOIN public.categories cc ON cc.id = l.category_id
  WHERE l.status = 'published'
    AND l.id <> p_listing_id
    AND l.seller_id <> bc.seller_id
    AND l.category_id = bc.base_category_id
    AND cc.gender = bc.base_gender
)
SELECT vd.*
FROM strict_matches s
JOIN public.v_listing_detail vd ON vd.id = s.id
WHERE vd.status = 'published'
ORDER BY vd.created_at DESC
LIMIT greatest(coalesce(p_limit, 6), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_similar_listings(uuid, int) TO anon, authenticated;
