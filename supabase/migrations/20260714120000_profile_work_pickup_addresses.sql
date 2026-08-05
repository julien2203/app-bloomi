-- Adresse de travail optionnelle sur le profil vendeur (2e lieu de remise en main propre)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS work_street text,
  ADD COLUMN IF NOT EXISTS work_postal_code text,
  ADD COLUMN IF NOT EXISTS work_city text,
  ADD COLUMN IF NOT EXISTS work_country text;

-- Snapshot des adresses de remise en main propre au moment de la publication
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS pickup_primary_street text,
  ADD COLUMN IF NOT EXISTS pickup_primary_postal_code text,
  ADD COLUMN IF NOT EXISTS pickup_primary_city text,
  ADD COLUMN IF NOT EXISTS pickup_work_street text,
  ADD COLUMN IF NOT EXISTS pickup_work_postal_code text,
  ADD COLUMN IF NOT EXISTS pickup_work_city text;
