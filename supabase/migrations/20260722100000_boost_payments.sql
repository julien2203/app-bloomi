-- Historique des paiements de mises en avant (boost articles / dressings).
CREATE TABLE IF NOT EXISTS public.boost_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id text NOT NULL UNIQUE,
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  sponsor_type text NOT NULL CHECK (sponsor_type IN ('listing', 'dressing')),
  duration_days integer NOT NULL CHECK (duration_days IN (3, 7)),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'chf',
  updated_count integer NOT NULL DEFAULT 0,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boost_payments_paid_at_idx
  ON public.boost_payments (paid_at DESC);

CREATE INDEX IF NOT EXISTS boost_payments_sponsor_type_paid_at_idx
  ON public.boost_payments (sponsor_type, paid_at DESC);

CREATE INDEX IF NOT EXISTS boost_payments_seller_id_idx
  ON public.boost_payments (seller_id);

ALTER TABLE public.boost_payments ENABLE ROW LEVEL SECURITY;

-- Lecture admin / service uniquement (pas d'accès authenticated).
DROP POLICY IF EXISTS "Service role can manage boost_payments" ON public.boost_payments;
CREATE POLICY "Service role can manage boost_payments"
  ON public.boost_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boost_payments TO service_role;
