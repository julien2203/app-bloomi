-- Messages système (cartes événement chat) : le vendeur peut insérer depuis l'app
-- (offer_accepted / offer_declined). sender_id NULL ou vendeur connecté.

DROP POLICY IF EXISTS "messages_insert_system_seller" ON public.messages;
CREATE POLICY "messages_insert_system_seller"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    is_system = true
    AND type = 'system'
    AND body LIKE '@@bloomi:event:v1:%'
    AND (
      sender_id IS NULL
      OR sender_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = messages.thread_id
        AND t.seller_id = auth.uid()
    )
  );
