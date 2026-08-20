-- =============================================================================
-- Cron : suivi La Poste (track-shipment) + confirmation / transferts
-- À exécuter dans Supabase SQL Editor (prod)
-- =============================================================================
--
-- Prérequis :
--   1. pg_cron + pg_net activés
--   2. Edge Functions déployées :
--        npx supabase functions deploy track-shipment
--        npx supabase functions deploy auto-confirm-orders
--   3. Remplacer PROJECT_REF et SERVICE_ROLE_KEY ci-dessous
--
-- Flux quotidien :
--   07:55 UTC → track-shipment (mode cron) : shipped + livré → completed
--   08:00 UTC → auto_confirm_shipped_orders() SQL (fallback 7 jours)
--   08:05 UTC → auto-confirm-orders (appelle aussi track-shipment, puis Stripe)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoke-track-shipment') THEN
    PERFORM cron.unschedule('invoke-track-shipment');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-confirm-shipped-orders') THEN
    PERFORM cron.unschedule('auto-confirm-shipped-orders');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoke-auto-confirm-orders') THEN
    PERFORM cron.unschedule('invoke-auto-confirm-orders');
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

-- 1) Suivi colis La Poste (toutes les commandes shipped) — 07:55 UTC
SELECT cron.schedule(
  'invoke-track-shipment',
  '55 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uzkrxkoussjnlyyykkul.supabase.co/functions/v1/track-shipment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY'
    ),
    body := '{"mode":"cron"}'::jsonb
  ) AS request_id;
  $$
);

-- 2) Fallback SQL 7 jours — 08:00 UTC
SELECT cron.schedule(
  'auto-confirm-shipped-orders',
  '0 8 * * *',
  $$SELECT public.auto_confirm_shipped_orders()$$
);

-- 3) Transferts Stripe (+ re-check tracking en tête de fonction) — 08:05 UTC
/*
SELECT cron.schedule(
  'invoke-auto-confirm-orders',
  '5 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uzkrxkoussjnlyyykkul.supabase.co/functions/v1/auto-confirm-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
*/

-- Vérifier :
-- SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobname;
