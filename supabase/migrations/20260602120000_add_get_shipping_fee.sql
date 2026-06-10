-- Compteur plateforme pour la promo livraison (< 100 commandes complétées)
CREATE TABLE IF NOT EXISTS public.platform_counters (
  key text PRIMARY KEY,
  value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_counters
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.platform_counters (key, value)
VALUES ('completed_orders_count', 0)
ON CONFLICT (key) DO NOTHING;

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
