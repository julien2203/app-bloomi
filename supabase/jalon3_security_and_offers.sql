-- Jalon 3: sécurité (RLS) + offres structurées (messages)

-- =========================
-- 1) Colonnes "offer" dans messages
-- =========================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS offer_amount numeric,
  ADD COLUMN IF NOT EXISTS offer_currency text,
  ADD COLUMN IF NOT EXISTS offer_status text,
  ADD COLUMN IF NOT EXISTS listing_id uuid;

-- Optionnel: lier listing_id si vous voulez une FK
-- (à activer uniquement si la table listings existe bien en public et que vous voulez la contrainte)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_listing_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_listing_id_fkey
      FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Contraintes simples (optionnel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_offer_status_check'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_offer_status_check
      CHECK (offer_status IS NULL OR offer_status IN ('pending','accepted','declined'));
  END IF;
END $$;

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_messages_thread_created_at
  ON public.messages (thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_threads_buyer
  ON public.threads (buyer_id);

CREATE INDEX IF NOT EXISTS idx_threads_seller
  ON public.threads (seller_id);

-- =========================
-- 2) RLS: threads
-- =========================
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_select_participants" ON public.threads;
CREATE POLICY "threads_select_participants"
  ON public.threads
  FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "threads_insert_buyer" ON public.threads;
CREATE POLICY "threads_insert_buyer"
  ON public.threads
  FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND buyer_id <> seller_id
  );

DROP POLICY IF EXISTS "threads_update_participants" ON public.threads;
CREATE POLICY "threads_update_participants"
  ON public.threads
  FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- =========================
-- 3) RLS: messages
-- =========================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participants" ON public.messages;
CREATE POLICY "messages_select_participants"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = messages.thread_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_insert_participants_sender" ON public.messages;
CREATE POLICY "messages_insert_participants_sender"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = messages.thread_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_update_participants" ON public.messages;
CREATE POLICY "messages_update_participants"
  ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = messages.thread_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = messages.thread_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

-- =========================
-- 4) RLS: profiles (update uniquement sur soi)
-- =========================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

