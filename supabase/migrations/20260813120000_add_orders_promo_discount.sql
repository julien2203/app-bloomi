-- Réduction automatique -5 CHF si prix article >= 30 CHF
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_discount_chf numeric DEFAULT 0;
