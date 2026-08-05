-- RLS messages : alignement repo ↔ prod + renforcement read_at + nettoyage doublons.
-- Ne crée PAS messages_update_participants (trop permissif).

-- Lecture / envoi (jalon3 — idempotent)
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

-- Marquage lu : participant, uniquement sur messages reçus (pas les siens)
DROP POLICY IF EXISTS "messages_update_read_at_participants" ON public.messages;
CREATE POLICY "messages_update_read_at_participants"
  ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = messages.thread_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    AND (messages.sender_id IS DISTINCT FROM auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = messages.thread_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    AND (messages.sender_id IS DISTINCT FROM auth.uid())
    AND read_at IS NOT NULL
  );

-- Acceptation / refus d'offre : vendeur uniquement
DROP POLICY IF EXISTS "messages_update_offer_status_seller_only" ON public.messages;
CREATE POLICY "messages_update_offer_status_seller_only"
  ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = messages.thread_id
        AND t.seller_id = auth.uid()
    )
    AND type = 'offer'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = messages.thread_id
        AND t.seller_id = auth.uid()
    )
    AND type = 'offer'
    AND offer_status IN ('pending', 'accepted', 'declined')
  );

-- Doublons legacy (équivalents jalon3 ci-dessus)
DROP POLICY IF EXISTS "Users can view messages in their threads" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in their threads" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

-- Policy trop large si jamais appliquée manuellement
DROP POLICY IF EXISTS "messages_update_participants" ON public.messages;
