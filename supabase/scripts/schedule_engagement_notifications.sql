-- Planification des notifications d'engagement (nurture J+10 acheteur / tips vendeur).
--
-- Prérequis :
--   1. Extensions pg_cron + pg_net activées
--   2. Secrets Edge : RESEND_API_KEY, CRON_SECRET (recommandé)
--   3. Remplacer PROJECT_REF et SERVICE_ROLE_KEY
--   4. Migration profiles.marketing_opt_in appliquée

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-engagement-notifications') THEN
    PERFORM cron.unschedule('process-engagement-notifications');
  END IF;
END $$;

-- Tous les jours à 10:30 UTC
SELECT cron.schedule(
  'process-engagement-notifications',
  '30 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/process-engagement-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
