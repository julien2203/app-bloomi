-- Colonnes frais de port sur les commandes (déjà appliqué manuellement en prod — idempotent)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_fee_chf numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_promo_shipping boolean DEFAULT false;
