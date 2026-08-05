-- Désactive les boosts expirés (is_sponsored) pour garder la base cohérente.
CREATE OR REPLACE FUNCTION public.expire_sponsored_listings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.listings
  SET is_sponsored = false
  WHERE is_sponsored = true
    AND sponsored_until IS NOT NULL
    AND sponsored_until < now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_sponsored_listings() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-sponsored-listings') THEN
    PERFORM cron.unschedule('expire-sponsored-listings');
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_object THEN
    NULL;
END;
$$;

SELECT cron.schedule(
  'expire-sponsored-listings',
  '15 8 * * *',
  $$SELECT public.expire_sponsored_listings()$$
);
