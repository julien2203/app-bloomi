-- Marques enfants (Kids) — gender = 'enfant' (aligné avec category-gender.tsx : Kids → enfant)
-- Types : même logique que femme (vetements, chaussures, sacs, accessoires)
-- Exécuter sur Supabase après vérification des contraintes (clé unique sur name+gender+type si besoin).
-- Les apostrophes dans les chaînes SQL sont doublées ('').

INSERT INTO public.brands (name, gender, type) VALUES
-- H&M
('H&M', 'enfant', 'vetements'), ('H&M', 'enfant', 'chaussures'), ('H&M', 'enfant', 'sacs'), ('H&M', 'enfant', 'accessoires'),
-- Zara Kids
('Zara Kids', 'enfant', 'vetements'), ('Zara Kids', 'enfant', 'chaussures'), ('Zara Kids', 'enfant', 'sacs'), ('Zara Kids', 'enfant', 'accessoires'),
-- Mango Kids
('Mango Kids', 'enfant', 'vetements'), ('Mango Kids', 'enfant', 'chaussures'), ('Mango Kids', 'enfant', 'sacs'), ('Mango Kids', 'enfant', 'accessoires'),
-- Kiabi
('Kiabi', 'enfant', 'vetements'), ('Kiabi', 'enfant', 'chaussures'), ('Kiabi', 'enfant', 'sacs'), ('Kiabi', 'enfant', 'accessoires'),
-- Primark
('Primark', 'enfant', 'vetements'), ('Primark', 'enfant', 'chaussures'), ('Primark', 'enfant', 'sacs'), ('Primark', 'enfant', 'accessoires'),
-- C&A
('C&A', 'enfant', 'vetements'), ('C&A', 'enfant', 'chaussures'), ('C&A', 'enfant', 'sacs'), ('C&A', 'enfant', 'accessoires'),
-- Name It
('Name It', 'enfant', 'vetements'), ('Name It', 'enfant', 'chaussures'), ('Name It', 'enfant', 'sacs'), ('Name It', 'enfant', 'accessoires'),
-- Sinsay
('Sinsay', 'enfant', 'vetements'), ('Sinsay', 'enfant', 'chaussures'), ('Sinsay', 'enfant', 'sacs'), ('Sinsay', 'enfant', 'accessoires'),
-- Reserved Kids
('Reserved Kids', 'enfant', 'vetements'), ('Reserved Kids', 'enfant', 'chaussures'), ('Reserved Kids', 'enfant', 'sacs'), ('Reserved Kids', 'enfant', 'accessoires'),
-- Pepco
('Pepco', 'enfant', 'vetements'), ('Pepco', 'enfant', 'chaussures'), ('Pepco', 'enfant', 'sacs'), ('Pepco', 'enfant', 'accessoires'),
-- Gémo
('Gémo', 'enfant', 'vetements'), ('Gémo', 'enfant', 'chaussures'), ('Gémo', 'enfant', 'sacs'), ('Gémo', 'enfant', 'accessoires'),
-- Tape à l'œil
('Tape à l''œil', 'enfant', 'vetements'), ('Tape à l''œil', 'enfant', 'chaussures'), ('Tape à l''œil', 'enfant', 'sacs'), ('Tape à l''œil', 'enfant', 'accessoires'),
-- Orchestra
('Orchestra', 'enfant', 'vetements'), ('Orchestra', 'enfant', 'chaussures'), ('Orchestra', 'enfant', 'sacs'), ('Orchestra', 'enfant', 'accessoires'),
-- Cache Cache Kids
('Cache Cache Kids', 'enfant', 'vetements'), ('Cache Cache Kids', 'enfant', 'chaussures'), ('Cache Cache Kids', 'enfant', 'sacs'), ('Cache Cache Kids', 'enfant', 'accessoires'),
-- Next Kids
('Next Kids', 'enfant', 'vetements'), ('Next Kids', 'enfant', 'chaussures'), ('Next Kids', 'enfant', 'sacs'), ('Next Kids', 'enfant', 'accessoires'),
-- Old Navy Kids
('Old Navy Kids', 'enfant', 'vetements'), ('Old Navy Kids', 'enfant', 'chaussures'), ('Old Navy Kids', 'enfant', 'sacs'), ('Old Navy Kids', 'enfant', 'accessoires'),
-- The Children's Place
('The Children''s Place', 'enfant', 'vetements'), ('The Children''s Place', 'enfant', 'chaussures'), ('The Children''s Place', 'enfant', 'sacs'), ('The Children''s Place', 'enfant', 'accessoires'),
-- Carter's
('Carter''s', 'enfant', 'vetements'), ('Carter''s', 'enfant', 'chaussures'), ('Carter''s', 'enfant', 'sacs'), ('Carter''s', 'enfant', 'accessoires'),
-- OshKosh B'gosh
('OshKosh B''gosh', 'enfant', 'vetements'), ('OshKosh B''gosh', 'enfant', 'chaussures'), ('OshKosh B''gosh', 'enfant', 'sacs'), ('OshKosh B''gosh', 'enfant', 'accessoires'),
-- Mothercare
('Mothercare', 'enfant', 'vetements'), ('Mothercare', 'enfant', 'chaussures'), ('Mothercare', 'enfant', 'sacs'), ('Mothercare', 'enfant', 'accessoires'),
-- Gymboree
('Gymboree', 'enfant', 'vetements'), ('Gymboree', 'enfant', 'chaussures'), ('Gymboree', 'enfant', 'sacs'), ('Gymboree', 'enfant', 'accessoires'),
-- George (Asda)
('George (Asda)', 'enfant', 'vetements'), ('George (Asda)', 'enfant', 'chaussures'), ('George (Asda)', 'enfant', 'sacs'), ('George (Asda)', 'enfant', 'accessoires'),
-- Joe Fresh
('Joe Fresh', 'enfant', 'vetements'), ('Joe Fresh', 'enfant', 'chaussures'), ('Joe Fresh', 'enfant', 'sacs'), ('Joe Fresh', 'enfant', 'accessoires'),
-- Koton Kids
('Koton Kids', 'enfant', 'vetements'), ('Koton Kids', 'enfant', 'chaussures'), ('Koton Kids', 'enfant', 'sacs'), ('Koton Kids', 'enfant', 'accessoires'),
-- Mayoral
('Mayoral', 'enfant', 'vetements'), ('Mayoral', 'enfant', 'chaussures'), ('Mayoral', 'enfant', 'sacs'), ('Mayoral', 'enfant', 'accessoires'),
-- Tuc Tuc
('Tuc Tuc', 'enfant', 'vetements'), ('Tuc Tuc', 'enfant', 'chaussures'), ('Tuc Tuc', 'enfant', 'sacs'), ('Tuc Tuc', 'enfant', 'accessoires'),
-- Blue Seven
('Blue Seven', 'enfant', 'vetements'), ('Blue Seven', 'enfant', 'chaussures'), ('Blue Seven', 'enfant', 'sacs'), ('Blue Seven', 'enfant', 'accessoires'),
-- Okaïdi
('Okaïdi', 'enfant', 'vetements'), ('Okaïdi', 'enfant', 'chaussures'), ('Okaïdi', 'enfant', 'sacs'), ('Okaïdi', 'enfant', 'accessoires'),
-- Obaïbi
('Obaïbi', 'enfant', 'vetements'), ('Obaïbi', 'enfant', 'chaussures'), ('Obaïbi', 'enfant', 'sacs'), ('Obaïbi', 'enfant', 'accessoires'),
-- Sergent Major
('Sergent Major', 'enfant', 'vetements'), ('Sergent Major', 'enfant', 'chaussures'), ('Sergent Major', 'enfant', 'sacs'), ('Sergent Major', 'enfant', 'accessoires'),
-- Vertbaudet
('Vertbaudet', 'enfant', 'vetements'), ('Vertbaudet', 'enfant', 'chaussures'), ('Vertbaudet', 'enfant', 'sacs'), ('Vertbaudet', 'enfant', 'accessoires'),
-- Petit Bateau
('Petit Bateau', 'enfant', 'vetements'), ('Petit Bateau', 'enfant', 'chaussures'), ('Petit Bateau', 'enfant', 'sacs'), ('Petit Bateau', 'enfant', 'accessoires'),
-- DPAM (Du Pareil au Même)
('DPAM (Du Pareil au Même)', 'enfant', 'vetements'), ('DPAM (Du Pareil au Même)', 'enfant', 'chaussures'), ('DPAM (Du Pareil au Même)', 'enfant', 'sacs'), ('DPAM (Du Pareil au Même)', 'enfant', 'accessoires'),
-- Cyrillus
('Cyrillus', 'enfant', 'vetements'), ('Cyrillus', 'enfant', 'chaussures'), ('Cyrillus', 'enfant', 'sacs'), ('Cyrillus', 'enfant', 'accessoires'),
-- IKKS Junior
('IKKS Junior', 'enfant', 'vetements'), ('IKKS Junior', 'enfant', 'chaussures'), ('IKKS Junior', 'enfant', 'sacs'), ('IKKS Junior', 'enfant', 'accessoires'),
-- Catimini
('Catimini', 'enfant', 'vetements'), ('Catimini', 'enfant', 'chaussures'), ('Catimini', 'enfant', 'sacs'), ('Catimini', 'enfant', 'accessoires'),
-- Absorba
('Absorba', 'enfant', 'vetements'), ('Absorba', 'enfant', 'chaussures'), ('Absorba', 'enfant', 'sacs'), ('Absorba', 'enfant', 'accessoires'),
-- 3 Pommes
('3 Pommes', 'enfant', 'vetements'), ('3 Pommes', 'enfant', 'chaussures'), ('3 Pommes', 'enfant', 'sacs'), ('3 Pommes', 'enfant', 'accessoires'),
-- Jean Bourget
('Jean Bourget', 'enfant', 'vetements'), ('Jean Bourget', 'enfant', 'chaussures'), ('Jean Bourget', 'enfant', 'sacs'), ('Jean Bourget', 'enfant', 'accessoires'),
-- Chipie
('Chipie', 'enfant', 'vetements'), ('Chipie', 'enfant', 'chaussures'), ('Chipie', 'enfant', 'sacs'), ('Chipie', 'enfant', 'accessoires'),
-- Lili Gaufrette
('Lili Gaufrette', 'enfant', 'vetements'), ('Lili Gaufrette', 'enfant', 'chaussures'), ('Lili Gaufrette', 'enfant', 'sacs'), ('Lili Gaufrette', 'enfant', 'accessoires'),
-- Petit Béguin
('Petit Béguin', 'enfant', 'vetements'), ('Petit Béguin', 'enfant', 'chaussures'), ('Petit Béguin', 'enfant', 'sacs'), ('Petit Béguin', 'enfant', 'accessoires'),
-- Monoprix Kids
('Monoprix Kids', 'enfant', 'vetements'), ('Monoprix Kids', 'enfant', 'chaussures'), ('Monoprix Kids', 'enfant', 'sacs'), ('Monoprix Kids', 'enfant', 'accessoires'),
-- Carrément Beau
('Carrément Beau', 'enfant', 'vetements'), ('Carrément Beau', 'enfant', 'chaussures'), ('Carrément Beau', 'enfant', 'sacs'), ('Carrément Beau', 'enfant', 'accessoires');
