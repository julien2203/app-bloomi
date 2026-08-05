-- Planification des e-mails différés (rappel expédition + messages non lus).
--
-- Prérequis :
--   1. Extensions pg_cron + pg_net activées (Dashboard → Database → Extensions)
--   2. Secrets Edge : RESEND_API_KEY, CRON_SECRET (optionnel mais recommandé)
--   3. Remplacer PROJECT_REF et SERVICE_ROLE_KEY ci-dessous
--
-- Vérifier les jobs :
--   SELECT jobid, jobname, schedule, command FROM cron.job;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-delayed-emails') THEN
    PERFORM cron.unschedule('process-delayed-emails');
  END IF;
END $$;

-- Toutes les heures à :15
SELECT cron.schedule(
  'process-delayed-emails',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/process-delayed-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
