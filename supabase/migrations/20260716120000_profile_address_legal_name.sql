-- Nom civil pour étiquettes La Poste (expéditeur / destinataire)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_first_name text,
  ADD COLUMN IF NOT EXISTS address_last_name text;

COMMENT ON COLUMN public.profiles.address_first_name IS
  'Prénom pour adresses d''expédition / étiquettes La Poste';
COMMENT ON COLUMN public.profiles.address_last_name IS
  'Nom de famille pour adresses d''expédition / étiquettes La Poste';

-- Snapshot destinataire au moment de la commande
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_first_name text,
  ADD COLUMN IF NOT EXISTS shipping_last_name text;
