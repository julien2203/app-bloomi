-- Consentement marketing (case inscription) → colonne profils.
-- Source d'inscription : auth.users.raw_user_meta_data.marketing_optin

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz;

COMMENT ON COLUMN public.profiles.marketing_opt_in IS
  'Opt-in e-mails marketing (offres, nurture J+10, tips vendeur, etc.).';
COMMENT ON COLUMN public.profiles.marketing_opt_in_at IS
  'Horodatage du dernier changement d''opt-in marketing.';

-- Best-effort backfill depuis le metadata Auth (si extension accessible).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    UPDATE public.profiles p
    SET
      marketing_opt_in = true,
      marketing_opt_in_at = coalesce(p.marketing_opt_in_at, timezone('utc', now()))
    FROM auth.users u
    WHERE u.id = p.id
      AND p.marketing_opt_in = false
      AND (
        lower(coalesce(u.raw_user_meta_data->>'marketing_optin', '')) IN ('true', '1', 'yes')
        OR (u.raw_user_meta_data->'marketing_optin') = 'true'::jsonb
      );
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- Environnements sans accès auth.users : ignorer le backfill.
    NULL;
END $$;
