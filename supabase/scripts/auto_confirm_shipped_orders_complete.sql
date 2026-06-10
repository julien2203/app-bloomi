-- =============================================================================
-- Confirmation automatique des commandes expédiées (> 7 jours)
-- À exécuter dans Supabase SQL Editor (Dashboard → SQL → New query)
-- =============================================================================
--
-- Prérequis dashboard Supabase :
--   1. Database → Extensions → activer « pg_cron »
--   2. Database → Extensions → activer « pg_net » (appel Edge Function)
--
-- Après exécution :
--   - Déployer l'Edge Function : npx supabase functions deploy auto-confirm-orders
--   - Remplacer PROJECT_REF et SERVICE_ROLE_KEY dans le job cron ci-dessous
--     (Settings → API → Project URL + service_role secret)
--   - Optionnel : secret CRON_SECRET sur l'Edge Function + en-tête x-cron-secret
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fonction SQL : marque completed (payment_status reste pending → Stripe ensuite)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_shipped_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT id, seller_id, buyer_id, listing_id, stripe_payment_intent_id
    FROM public.orders
    WHERE status = 'shipped'
      AND shipped_at IS NOT NULL
      AND shipped_at < now() - interval '7 days'
      AND payment_status = 'pending'
  LOOP
    UPDATE public.orders
    SET status = 'completed',
        delivered_at = now(),
        confirmed_at = now()
    WHERE id = v_order.id;

    RAISE LOG 'Auto-confirmed order %', v_order.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_confirm_shipped_orders() TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 3. Supprimer d'anciens jobs (ré-exécution sans doublon)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
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

-- -----------------------------------------------------------------------------
-- 4. Job cron : marquage SQL quotidien (8h00 UTC)
-- -----------------------------------------------------------------------------
SELECT cron.schedule(
  'auto-confirm-shipped-orders',
  '0 8 * * *',
  $$SELECT public.auto_confirm_shipped_orders()$$
);

-- -----------------------------------------------------------------------------
-- 5. Job cron : transferts Stripe via Edge Function (8h05 UTC)
--    ⚠️ REMPLACER les deux valeurs ci-dessous avant d'exécuter cette section
-- -----------------------------------------------------------------------------
/*
SELECT cron.schedule(
  'invoke-auto-confirm-orders',
  '5 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://VOTRE_PROJECT_REF.supabase.co/functions/v1/auto-confirm-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer VOTRE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
*/

-- -----------------------------------------------------------------------------
-- 6. Vérifications
-- -----------------------------------------------------------------------------
-- Lister les jobs planifiés :
-- SELECT jobid, jobname, schedule, command FROM cron.job;

-- Tester la fonction SQL manuellement :
-- SELECT public.auto_confirm_shipped_orders();

-- Tester l'Edge Function (curl, remplacer URL et clé) :
-- curl -X POST 'https://VOTRE_PROJECT_REF.supabase.co/functions/v1/auto-confirm-orders' \
--   -H 'Authorization: Bearer VOTRE_SERVICE_ROLE_KEY' \
--   -H 'Content-Type: application/json' \
--   -d '{}'

-- Commandes en attente de transfert après marquage SQL :
-- SELECT id, status, payment_status, shipped_at, confirmed_at
-- FROM public.orders
-- WHERE status = 'completed' AND payment_status = 'pending';
