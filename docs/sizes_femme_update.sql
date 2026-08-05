-- Tailles femme (vêtements) : TU + 3XL, 4XL, 5XL et plus
--
-- Contexte : les tailles femme vêtements s'arrêtaient à XXL (48).
-- Ce script ajoute les grandes tailles et TU (taille unique).
--
-- À exécuter dans le SQL Editor Supabase (prod/staging) ou via :
--   supabase db push
--
-- Idempotent : relançable sans doublon.
-- Les annonces stockent `listings.size` en texte (= label), pas size_id.

BEGIN;

INSERT INTO public.sizes (label, gender, type, sort_order)
SELECT v.label, v.gender, v.type, v.sort_order
FROM (
  VALUES
    ('3XL (50)', 'femme', 'vetements', 8),
    ('4XL (52)', 'femme', 'vetements', 9),
    ('5XL et plus', 'femme', 'vetements', 10),
    ('TU', 'femme', 'vetements', 11)
) AS v(label, gender, type, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sizes s
  WHERE s.label = v.label
    AND s.gender = v.gender
    AND s.type = v.type
);

COMMIT;

-- Vérification :
-- SELECT id, label, gender, type, sort_order
-- FROM public.sizes
-- WHERE gender = 'femme' AND type = 'vetements'
-- ORDER BY sort_order;
