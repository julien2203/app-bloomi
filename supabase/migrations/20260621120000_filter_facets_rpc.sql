-- Agrégats pour les facettes filtres (marque, taille, couleur) — évite de charger toutes les annonces côté client.

CREATE OR REPLACE FUNCTION public.get_listing_brand_counts(
  p_category_ids bigint[] DEFAULT NULL
)
RETURNS TABLE(brand text, listing_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    trim(l.brand) AS brand,
    count(*)::bigint AS listing_count
  FROM public.listings l
  WHERE l.status = 'published'
    AND l.brand IS NOT NULL
    AND btrim(l.brand) <> ''
    AND (
      p_category_ids IS NULL
      OR cardinality(p_category_ids) = 0
      OR l.category_id = ANY (p_category_ids)
    )
  GROUP BY trim(l.brand);
$$;

CREATE OR REPLACE FUNCTION public.get_listing_empty_brand_count(
  p_category_ids bigint[] DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.listings l
  WHERE l.status = 'published'
    AND (l.brand IS NULL OR btrim(l.brand) = '')
    AND (
      p_category_ids IS NULL
      OR cardinality(p_category_ids) = 0
      OR l.category_id = ANY (p_category_ids)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_listing_size_counts(
  p_category_ids bigint[] DEFAULT NULL
)
RETURNS TABLE(size_label text, listing_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    trim(l.size) AS size_label,
    count(*)::bigint AS listing_count
  FROM public.listings l
  WHERE l.status = 'published'
    AND l.size IS NOT NULL
    AND btrim(l.size) <> ''
    AND (
      p_category_ids IS NULL
      OR cardinality(p_category_ids) = 0
      OR l.category_id = ANY (p_category_ids)
    )
  GROUP BY trim(l.size);
$$;

CREATE OR REPLACE FUNCTION public.get_listing_color_counts(
  p_category_ids bigint[] DEFAULT NULL
)
RETURNS TABLE(color_name text, listing_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    trim(part) AS color_name,
    count(*)::bigint AS listing_count
  FROM public.listings l
  CROSS JOIN LATERAL unnest(
    string_to_array(coalesce(l.color, ''), ',')
  ) AS part
  WHERE l.status = 'published'
    AND btrim(part) <> ''
    AND (
      p_category_ids IS NULL
      OR cardinality(p_category_ids) = 0
      OR l.category_id = ANY (p_category_ids)
    )
  GROUP BY trim(part);
$$;

GRANT EXECUTE ON FUNCTION public.get_listing_brand_counts(bigint[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_empty_brand_count(bigint[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_size_counts(bigint[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_color_counts(bigint[]) TO anon, authenticated;
