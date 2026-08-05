-- Une seule offre en attente par acheteur et par annonce (les autres acheteurs ne sont pas bloqués).

-- Nettoyage legacy : plusieurs offres pending pour le même (listing_id, sender_id).
-- On conserve la plus récente, les autres passent en declined.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY listing_id, sender_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.messages
  WHERE type = 'offer'
    AND offer_status = 'pending'
    AND listing_id IS NOT NULL
    AND sender_id IS NOT NULL
)
UPDATE public.messages m
SET offer_status = 'declined'
FROM ranked r
WHERE m.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_pending_offer_per_buyer_listing
  ON public.messages (listing_id, sender_id)
  WHERE type = 'offer' AND offer_status = 'pending';
