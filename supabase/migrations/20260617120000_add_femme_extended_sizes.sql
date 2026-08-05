-- Tailles femme (vêtements) : TU + grandes tailles 3XL, 4XL, 5XL et plus
-- Idempotent : n'insère que les lignes absentes (label + gender + type).

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
