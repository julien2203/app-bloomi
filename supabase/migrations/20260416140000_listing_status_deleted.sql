-- Statut « deleted » : retrait du flux sans DELETE physique quand une FK bloque encore.

DO $$
BEGIN
  ALTER TYPE public.listing_status ADD VALUE 'deleted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
