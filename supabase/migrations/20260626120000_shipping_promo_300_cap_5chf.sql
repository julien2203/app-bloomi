-- Promo livraison : 300 premières commandes payées, plafond 5 CHF si tarif standard > 5 CHF.
-- Lettre A+ (3,90 CHF) inchangée — sous le plafond.

CREATE OR REPLACE FUNCTION public.get_shipping_fee(p_parcel_size text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_standard_fee integer;
  v_fee integer;
  v_is_promo boolean;
  v_promo_limit constant integer := 300;
  v_promo_cap_cents constant integer := 500;
  v_promo_eligible boolean;
BEGIN
  SELECT value INTO v_count
  FROM public.platform_counters
  WHERE key = 'completed_orders_count';

  v_promo_eligible := COALESCE(v_count, 0) < v_promo_limit;

  IF p_parcel_size = 'letter_aplus' THEN
    v_standard_fee := 390;
  ELSIF p_parcel_size = 'small' THEN
    v_standard_fee := 900;
  ELSIF p_parcel_size = 'large' THEN
    v_standard_fee := 1200;
  ELSIF p_parcel_size = 'xlarge' THEN
    v_standard_fee := 2100;
  ELSE
    v_standard_fee := 900;
  END IF;

  v_fee := v_standard_fee;
  v_is_promo := false;

  IF v_promo_eligible AND v_standard_fee > v_promo_cap_cents THEN
    v_fee := v_promo_cap_cents;
    v_is_promo := true;
  END IF;

  RETURN jsonb_build_object(
    'fee_cents', v_fee,
    'is_promo', v_is_promo,
    'completed_orders_count', COALESCE(v_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shipping_fee(text) TO anon, authenticated, service_role;
