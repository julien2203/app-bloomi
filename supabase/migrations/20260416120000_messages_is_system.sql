-- Messages système (commande / expédition / réception) : pas d'expéditeur, flag is_system

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ALTER COLUMN sender_id DROP NOT NULL;

COMMENT ON COLUMN public.messages.is_system IS 'True for automated order/lifecycle messages (no sender).';
