-- Marques proposées (saisie libre sur listings.brand, hors catalogue).
-- Outils admin : lister / promouvoir / fusionner.

CREATE OR REPLACE FUNCTION public.normalize_brand_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
$$;

COMMENT ON FUNCTION public.normalize_brand_key(text) IS
  'Clé de comparaison marques (trim + lower + espaces normalisés).';

REVOKE ALL ON FUNCTION public.normalize_brand_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_brand_key(text) TO anon, authenticated, service_role;

-- Liste des marques tapées sur des annonces mais absentes du catalogue brands.
CREATE OR REPLACE FUNCTION public.admin_list_proposed_brands()
RETURNS TABLE (
  brand_key text,
  display_name text,
  listings_count bigint,
  sample_listing_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH catalog AS (
    SELECT DISTINCT public.normalize_brand_key(b.name) AS brand_key
    FROM public.brands b
    WHERE b.name IS NOT NULL
      AND btrim(b.name) <> ''
  ),
  listing_brands AS (
    SELECT
      public.normalize_brand_key(l.brand) AS brand_key,
      btrim(l.brand) AS display_name,
      l.id AS listing_id
    FROM public.listings l
    WHERE l.brand IS NOT NULL
      AND btrim(l.brand) <> ''
      AND public.normalize_brand_key(l.brand) NOT IN ('autre', 'other')
      AND public.normalize_brand_key(l.brand) NOT IN (SELECT c.brand_key FROM catalog c)
  )
  SELECT
    lb.brand_key,
    mode() WITHIN GROUP (ORDER BY lb.display_name) AS display_name,
    count(*)::bigint AS listings_count,
    (array_agg(lb.listing_id ORDER BY lb.listing_id))[1:20] AS sample_listing_ids
  FROM listing_brands lb
  GROUP BY lb.brand_key
  ORDER BY 3 DESC, 2 ASC;
END;
$$;

COMMENT ON FUNCTION public.admin_list_proposed_brands() IS
  'Admin only: marques saisies librement (hors catalogue), avec compteurs d’annonces.';

REVOKE ALL ON FUNCTION public.admin_list_proposed_brands() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_proposed_brands() TO authenticated;

-- Ajoute une marque au catalogue et normalise le texte sur les annonces concernées.
CREATE OR REPLACE FUNCTION public.admin_promote_proposed_brand(
  p_name text,
  p_gender text DEFAULT 'all',
  p_type text DEFAULT 'all',
  p_rewrite_listings boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_key text;
  v_gender text;
  v_type text;
  v_brand_id bigint;
  v_rewritten integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  IF v_name = '' OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = '22023';
  END IF;

  v_key := public.normalize_brand_key(v_name);
  IF v_key IN ('autre', 'other') THEN
    RAISE EXCEPTION 'reserved_name' USING ERRCODE = '22023';
  END IF;

  v_gender := coalesce(nullif(btrim(p_gender), ''), 'all');
  v_type := coalesce(nullif(btrim(p_type), ''), 'all');

  SELECT b.id
    INTO v_brand_id
  FROM public.brands b
  WHERE public.normalize_brand_key(b.name) = v_key
    AND coalesce(b.gender, '') = v_gender
    AND coalesce(b.type, '') = v_type
  LIMIT 1;

  IF v_brand_id IS NULL THEN
    INSERT INTO public.brands (name, gender, type)
    VALUES (v_name, v_gender, v_type)
    RETURNING id INTO v_brand_id;
  END IF;

  IF p_rewrite_listings THEN
    UPDATE public.listings l
    SET brand = v_name
    WHERE public.normalize_brand_key(l.brand) = v_key
      AND btrim(coalesce(l.brand, '')) <> v_name;
    GET DIAGNOSTICS v_rewritten = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'brand_id', v_brand_id,
    'name', v_name,
    'gender', v_gender,
    'type', v_type,
    'listings_rewritten', v_rewritten
  );
END;
$$;

COMMENT ON FUNCTION public.admin_promote_proposed_brand(text, text, text, boolean) IS
  'Admin only: crée (si besoin) une entrée brands et aligne listings.brand sur le libellé canonique.';

REVOKE ALL ON FUNCTION public.admin_promote_proposed_brand(text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_promote_proposed_brand(text, text, text, boolean) TO authenticated;

-- Fusionne une marque saisie libre (ou variante) vers une marque catalogue existante.
CREATE OR REPLACE FUNCTION public.admin_merge_brand_into(
  p_from_name text,
  p_into_brand_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_key text;
  v_into_name text;
  v_into_key text;
  v_rewritten integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_from_key := public.normalize_brand_key(p_from_name);
  v_into_name := btrim(regexp_replace(coalesce(p_into_brand_name, ''), '\s+', ' ', 'g'));
  v_into_key := public.normalize_brand_key(v_into_name);

  IF v_from_key = '' OR v_into_key = '' THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.brands b
    WHERE public.normalize_brand_key(b.name) = v_into_key
  ) THEN
    RAISE EXCEPTION 'target_brand_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Utiliser le libellé catalogue le plus fréquent / premier trouvé
  SELECT b.name
    INTO v_into_name
  FROM public.brands b
  WHERE public.normalize_brand_key(b.name) = v_into_key
  ORDER BY b.id
  LIMIT 1;

  UPDATE public.listings l
  SET brand = v_into_name
  WHERE public.normalize_brand_key(l.brand) = v_from_key;
  GET DIAGNOSTICS v_rewritten = ROW_COUNT;

  RETURN jsonb_build_object(
    'from_key', v_from_key,
    'into_name', v_into_name,
    'listings_rewritten', v_rewritten
  );
END;
$$;

COMMENT ON FUNCTION public.admin_merge_brand_into(text, text) IS
  'Admin only: réécrit listings.brand d’une variante vers une marque catalogue.';

REVOKE ALL ON FUNCTION public.admin_merge_brand_into(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_merge_brand_into(text, text) TO authenticated;
