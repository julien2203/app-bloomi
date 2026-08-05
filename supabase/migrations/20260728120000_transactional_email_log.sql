-- Journal des e-mails transactionnels (déduplication par user + template + entité).

CREATE TABLE IF NOT EXISTS public.transactional_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  entity_id text NOT NULL,
  resend_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactional_email_log_unique UNIQUE (user_id, template_key, entity_id)
);

CREATE INDEX IF NOT EXISTS transactional_email_log_user_id_idx
  ON public.transactional_email_log (user_id);

CREATE INDEX IF NOT EXISTS transactional_email_log_template_created_idx
  ON public.transactional_email_log (template_key, created_at DESC);

ALTER TABLE public.transactional_email_log ENABLE ROW LEVEL SECURITY;

-- Accès service role uniquement (pas de policy utilisateur).

COMMENT ON TABLE public.transactional_email_log IS
  'Trace des e-mails transactionnels Resend envoyés (évite les doublons).';
