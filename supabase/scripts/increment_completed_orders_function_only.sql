-- À exécuter dans le SQL Editor Supabase si la migration 20260602140000 n'est pas encore appliquée.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parcel_size text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_parcel_size_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_parcel_size_check
  CHECK (parcel_size IS NULL OR parcel_size IN ('letter_aplus', 'small', 'large', 'xlarge'));

CREATE OR REPLACE FUNCTION public.increment_completed_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.platform_counters
  SET value = value + 1,
      updated_at = now()
  WHERE key = 'completed_orders_count';
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_completed_orders() TO service_role;
