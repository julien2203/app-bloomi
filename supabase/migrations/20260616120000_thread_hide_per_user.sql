-- Masquage de conversation par participant (supprimer pour moi).

ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS buyer_hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_hidden_at timestamptz;

COMMENT ON COLUMN public.threads.buyer_hidden_at IS
  'Quand défini, la conversation est masquée dans l''inbox de l''acheteur.';
COMMENT ON COLUMN public.threads.seller_hidden_at IS
  'Quand défini, la conversation est masquée dans l''inbox du vendeur.';

-- CREATE OR REPLACE échoue si l'ordre/nom des colonnes change (ex. listinf_title en prod).
DROP VIEW IF EXISTS public.v_thread_list;

CREATE VIEW public.v_thread_list AS
SELECT
  t.id AS thread_id,
  t.listing_id,
  t.buyer_id,
  t.seller_id,
  t.created_at AS thread_created_at,
  t.last_message_at,
  t.buyer_hidden_at,
  t.seller_hidden_at,
  l.title AS listing_title,
  l.price AS listing_price,
  l.status AS listing_status,
  lp_cover.url AS listing_cover_photo_url,
  m_last.id AS last_message_id,
  m_last.body AS last_message_body,
  m_last.sender_id AS last_message_sender_id,
  m_last.created_at AS last_message_created_at,
  m_last.read_at AS last_message_read_at,
  p_sender.display_name AS last_message_sender_name,
  p_sender.avatar_url AS last_message_sender_avatar,
  p_buyer.display_name AS buyer_display_name,
  p_buyer.avatar_url AS buyer_avatar_url,
  p_seller.display_name AS seller_display_name,
  p_seller.avatar_url AS seller_avatar_url
FROM public.threads t
INNER JOIN public.listings l ON t.listing_id = l.id
LEFT JOIN LATERAL (
  SELECT url
  FROM public.listing_photos
  WHERE listing_id = l.id
    AND order_index = 0
  LIMIT 1
) lp_cover ON true
LEFT JOIN LATERAL (
  SELECT id, body, sender_id, created_at, read_at
  FROM public.messages
  WHERE thread_id = t.id
  ORDER BY created_at DESC
  LIMIT 1
) m_last ON true
LEFT JOIN public.profiles p_sender ON m_last.sender_id = p_sender.id
LEFT JOIN public.profiles p_buyer ON t.buyer_id = p_buyer.id
LEFT JOIN public.profiles p_seller ON t.seller_id = p_seller.id;

GRANT SELECT ON public.v_thread_list TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_thread_hidden_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.threads
  SET
    buyer_hidden_at = NULL,
    seller_hidden_at = NULL
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_messages_clear_thread_hidden ON public.messages;
CREATE TRIGGER tr_messages_clear_thread_hidden
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_thread_hidden_on_new_message();
