-- Men's sizes (homme): clothing, pants/jeans, dress shirts (neck), shoes
-- Types: vetements, pantalons, chemises, chaussures (pantalons/chemises = nouveaux)
-- Libellés en anglais. sort_order unique par ligne pour ce genre (1..39).
--
-- Idempotent: supprime les anciennes lignes homme pour ces types puis réinsère.
-- Attention: les IDs changent — si des listings ou filtres référencent d'anciens
-- size_id, migrer ou accepter le reset. Les annonces utilisent surtout `size` (texte).
--
-- À exécuter après sauvegarde de la base.
--
-- La contrainte sizes_type_check n'inclut souvent que vetements / chaussures / all.
-- Il faut l'étendre pour pantalons et chemises (sinon erreur 23514).

BEGIN;

ALTER TABLE public.sizes DROP CONSTRAINT IF EXISTS sizes_type_check;

ALTER TABLE public.sizes ADD CONSTRAINT sizes_type_check CHECK (
  type = ANY (
    ARRAY[
      'vetements',
      'chaussures',
      'sacs',
      'accessoires',
      'pantalons',
      'chemises',
      'all'
    ]::text[]
  )
);

DELETE FROM public.sizes
WHERE gender = 'homme'
  AND type IN ('vetements', 'chaussures', 'pantalons', 'chemises');

INSERT INTO public.sizes (label, gender, type, sort_order) VALUES
-- Men's clothing
('XS (44)', 'homme', 'vetements', 1),
('S (46)', 'homme', 'vetements', 2),
('M (48)', 'homme', 'vetements', 3),
('L (50)', 'homme', 'vetements', 4),
('XL (52)', 'homme', 'vetements', 5),
('XXL (54)', 'homme', 'vetements', 6),
('3XL (56)', 'homme', 'vetements', 7),
('4XL (58)', 'homme', 'vetements', 8),
-- Men's pants / jeans
('W28 (XS / 38)', 'homme', 'pantalons', 9),
('W29 (S / 40)', 'homme', 'pantalons', 10),
('W30 (S / 40-42)', 'homme', 'pantalons', 11),
('W31 (M / 42)', 'homme', 'pantalons', 12),
('W32 (M / 42-44)', 'homme', 'pantalons', 13),
('W33 (L / 44)', 'homme', 'pantalons', 14),
('W34 (L / 44-46)', 'homme', 'pantalons', 15),
('W36 (XL / 46)', 'homme', 'pantalons', 16),
('W38 (XXL / 48)', 'homme', 'pantalons', 17),
('W40 (3XL / 50)', 'homme', 'pantalons', 18),
('W42 (4XL / 52)', 'homme', 'pantalons', 19),
-- Men's shirts (collar)
('37 (S)', 'homme', 'chemises', 20),
('38 (S/M)', 'homme', 'chemises', 21),
('39 (M)', 'homme', 'chemises', 22),
('40 (M/L)', 'homme', 'chemises', 23),
('41 (L)', 'homme', 'chemises', 24),
('42 (L/XL)', 'homme', 'chemises', 25),
('43 (XL)', 'homme', 'chemises', 26),
('44 (XXL)', 'homme', 'chemises', 27),
-- Men's shoes (EU, same style as women / kids in this project)
('EU 39', 'homme', 'chaussures', 28),
('EU 40', 'homme', 'chaussures', 29),
('EU 41', 'homme', 'chaussures', 30),
('EU 42', 'homme', 'chaussures', 31),
('EU 43', 'homme', 'chaussures', 32),
('EU 44', 'homme', 'chaussures', 33),
('EU 45', 'homme', 'chaussures', 34),
('EU 46', 'homme', 'chaussures', 35),
('EU 47', 'homme', 'chaussures', 36),
('EU 48', 'homme', 'chaussures', 37),
('EU 49', 'homme', 'chaussures', 38),
('EU 50', 'homme', 'chaussures', 39);

COMMIT;
