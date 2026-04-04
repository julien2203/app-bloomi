-- À exécuter sur Supabase (SQL Editor) pour afficher instantanément le nombre d'annonces
-- publiées du vendeur sur la fiche produit (colonne seller_published_count).
-- Recrée v_listing_detail comme dans docs/supabase_views.sql (section 3).

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
    SELECT COUNT(*)::int
    FROM public.listings l2
    WHERE l2.seller_id = l.seller_id
      AND l2.status = 'published'
  ) AS seller_published_count
FROM public.listings l
INNER JOIN public.profiles p ON l.seller_id = p.id;

GRANT SELECT ON public.v_listing_detail TO authenticated;
GRANT SELECT ON public.v_listing_detail TO anon;
