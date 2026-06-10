-- Confirmation automatique des commandes expédiées depuis plus de 7 jours
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

-- pg_cron : nécessite l'extension activée dans le dashboard Supabase (Database → Extensions)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Déplanifie les jobs existants (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-confirm-shipped-orders') THEN
    PERFORM cron.unschedule('auto-confirm-shipped-orders');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoke-auto-confirm-orders') THEN
    PERFORM cron.unschedule('invoke-auto-confirm-orders');
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_object THEN
    NULL;
END;
$$;

-- Marque les commandes éligibles chaque jour à 8h UTC
SELECT cron.schedule(
  'auto-confirm-shipped-orders',
  '0 8 * * *',
  $$SELECT public.auto_confirm_shipped_orders()$$
);

-- pg_net + job HTTP : voir supabase/scripts/auto_confirm_shipped_orders_complete.sql
-- (section 5 — remplacer PROJECT_REF et SERVICE_ROLE_KEY)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
