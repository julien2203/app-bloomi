-- Option couleur générique « Other » (libellé i18n : Autres / Others)
-- Resynchronise la séquence si des ids ont été insérés manuellement (évite colors_pkey duplicate).
SELECT setval(
  pg_get_serial_sequence('public.colors', 'id'),
  COALESCE((SELECT MAX(id) FROM public.colors), 1)
);

INSERT INTO public.colors (name, hex)
SELECT 'Other', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.colors WHERE lower(trim(name)) = 'other'
);
