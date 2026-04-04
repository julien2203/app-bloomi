-- Options de marque génériques : "Other" et "Handmade" (libellés en anglais)
-- Une ligne par (name, gender, type) pour chaque segment défini dans brand-segment.tsx
-- (vente + filtres). Exécuter sur Supabase ; en cas de doublon, adapter avec ON CONFLICT.

INSERT INTO public.brands (name, gender, type) VALUES
-- femme
('Other', 'femme', 'vetements'), ('Handmade', 'femme', 'vetements'),
('Other', 'femme', 'chaussures'), ('Handmade', 'femme', 'chaussures'),
('Other', 'femme', 'sacs'), ('Handmade', 'femme', 'sacs'),
('Other', 'femme', 'accessoires'), ('Handmade', 'femme', 'accessoires'),
-- homme
('Other', 'homme', 'vetements'), ('Handmade', 'homme', 'vetements'),
('Other', 'homme', 'chaussures'), ('Handmade', 'homme', 'chaussures'),
('Other', 'homme', 'accessoires'), ('Handmade', 'homme', 'accessoires'),
-- enfant (Kids)
('Other', 'enfant', 'vetements'), ('Handmade', 'enfant', 'vetements'),
('Other', 'enfant', 'chaussures'), ('Handmade', 'enfant', 'chaussures'),
('Other', 'enfant', 'sacs'), ('Handmade', 'enfant', 'sacs'),
('Other', 'enfant', 'accessoires'), ('Handmade', 'enfant', 'accessoires'),
-- bebe
('Other', 'bebe', 'vetements'), ('Handmade', 'bebe', 'vetements');
