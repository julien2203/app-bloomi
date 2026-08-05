-- Complète les marques grand public manquantes (H&M femme vêtements, etc.)
-- Idempotent : n'insère pas si (name, gender, type) existe déjà.

INSERT INTO public.brands (name, gender, type)
SELECT v.name, v.gender, v.type
FROM (
  VALUES
    -- H&M : combinaisons manquantes
    ('H&M', 'femme', 'vetements'),
    ('H&M', 'femme', 'sacs'),
    ('H&M', 'femme', 'accessoires'),
    ('H&M', 'homme', 'chaussures'),
    ('H&M', 'homme', 'sacs'),
    ('H&M', 'homme', 'accessoires'),

    -- Groupe H&M : absentes du catalogue
    ('Arket', 'femme', 'vetements'),
    ('Arket', 'femme', 'chaussures'),
    ('Arket', 'femme', 'sacs'),
    ('Arket', 'femme', 'accessoires'),
    ('Arket', 'homme', 'vetements'),
    ('Arket', 'homme', 'chaussures'),
    ('Arket', 'homme', 'sacs'),
    ('Arket', 'homme', 'accessoires'),

    ('Monki', 'femme', 'vetements'),
    ('Monki', 'femme', 'chaussures'),
    ('Monki', 'femme', 'sacs'),
    ('Monki', 'femme', 'accessoires'),

    ('Weekday', 'femme', 'vetements'),
    ('Weekday', 'femme', 'chaussures'),
    ('Weekday', 'femme', 'sacs'),
    ('Weekday', 'femme', 'accessoires'),
    ('Weekday', 'homme', 'vetements'),
    ('Weekday', 'homme', 'chaussures'),
    ('Weekday', 'homme', 'sacs'),
    ('Weekday', 'homme', 'accessoires'),

    -- Autres trous repérés (femme vêtements)
    ('Primark', 'femme', 'vetements'),
    ('Uniqlo', 'femme', 'vetements')
) AS v(name, gender, type)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.brands b
  WHERE b.name = v.name
    AND b.gender = v.gender
    AND b.type = v.type
);

SELECT setval(
  'brands_id_seq',
  (SELECT COALESCE(MAX(id), 1) FROM public.brands),
  true
);
