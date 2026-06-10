-- Script idempotent — safe si déjà exécuté dans Supabase SQL Editor
-- Prérequis manuels déjà en place chez vous :
--   • orders.shipping_fee_chf, orders.is_promo_shipping
--   • public.platform_counters + completed_orders_count

-- 1) Fonction (CREATE OR REPLACE = réexécutable)
CREATE OR REPLACE FUNCTION public.get_shipping_fee(p_parcel_size text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_fee integer;
  v_is_promo boolean;
BEGIN
  SELECT value INTO v_count
  FROM public.platform_counters
  WHERE key = 'completed_orders_count';

  v_is_promo := COALESCE(v_count, 0) < 100;

  IF p_parcel_size = 'small' THEN
    v_fee := CASE WHEN v_is_promo THEN 500 ELSE 900 END;
  ELSIF p_parcel_size = 'large' THEN
    v_fee := CASE WHEN v_is_promo THEN 700 ELSE 1200 END;
  ELSIF p_parcel_size = 'xlarge' THEN
    v_fee := CASE WHEN v_is_promo THEN 1800 ELSE 2100 END;
  ELSE
    v_fee := CASE WHEN v_is_promo THEN 900 ELSE 900 END;
  END IF;

  RETURN jsonb_build_object(
    'fee_cents', v_fee,
    'is_promo', v_is_promo,
    'completed_orders_count', COALESCE(v_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shipping_fee(text) TO anon, authenticated, service_role;

-- 2) Vérification rapide (compteur < 100 → promo)
SELECT get_shipping_fee('small') AS small;
SELECT get_shipping_fee('large') AS large;
SELECT get_shipping_fee('xlarge') AS xlarge;
