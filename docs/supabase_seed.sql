-- ============================================
-- SEED SQL - BLOOMI APP
-- Génère des données de test pour le feed
-- ============================================
--
-- PRÉREQUIS: Un utilisateur doit exister dans auth.users
-- Si aucun utilisateur n'existe, créez-en un via l'app ou Supabase Auth
-- ============================================

-- ============================================
-- 1. RÉCUPÉRER UN USER EXISTANT
-- ============================================

DO $$
DECLARE
  v_seller_id uuid;
  v_user_phone text;
BEGIN
  -- Récupérer le premier utilisateur de auth.users
  SELECT id, phone INTO v_seller_id, v_user_phone
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;

  -- Si aucun utilisateur n'existe, lever une erreur
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Aucun utilisateur trouvé dans auth.users. Créez d''abord un utilisateur via l''app ou Supabase Auth.';
  END IF;

  -- S'assurer que le profil existe
  INSERT INTO public.profiles (id, phone, country, display_name)
  VALUES (
    v_seller_id,
    COALESCE(v_user_phone, '+41791234567'),
    'CH',
    'Seller Test'
  )
  ON CONFLICT (id) DO UPDATE
  SET display_name = COALESCE(profiles.display_name, 'Seller Test');

  -- ============================================
  -- 2. CRÉER 5 LISTINGS PUBLIÉS
  -- ============================================

  -- Listing 1: iPhone à Genève
  INSERT INTO public.listings (
    seller_id,
    title,
    description,
    price,
    status,
    category,
    condition,
    delivery_mode,
    city,
    country_code,
    published_at
  ) VALUES (
    v_seller_id,
    'iPhone 13 Pro - 256GB - Excellent état',
    'iPhone 13 Pro en excellent état, acheté il y a 6 mois. Boîtier, chargeur et écouteurs inclus. Quelques micro-rayures sur l''écran mais rien de visible en utilisation normale.',
    850.00,
    'published',
    'Electronics',
    'like_new',
    'both',
    'Genève',
    'CH',
    timezone('utc', now()) - interval '2 days'
  );

  -- Listing 2: Vélos à Lausanne
  INSERT INTO public.listings (
    seller_id,
    title,
    description,
    price,
    status,
    category,
    condition,
    delivery_mode,
    city,
    country_code,
    published_at
  ) VALUES (
    v_seller_id,
    'Vélo de ville Trek - Taille M',
    'Vélo de ville Trek en très bon état. Pneus récemment changés, freins révisés. Idéal pour la ville. Vendu car déménagement.',
    320.00,
    'published',
    'Sports',
    'good',
    'pickup',
    'Lausanne',
    'CH',
    timezone('utc', now()) - interval '1 day'
  );

  -- Listing 3: Meuble à Zurich
  INSERT INTO public.listings (
    seller_id,
    title,
    description,
    price,
    status,
    category,
    condition,
    delivery_mode,
    city,
    country_code,
    published_at
  ) VALUES (
    v_seller_id,
    'Table basse design scandinave',
    'Belle table basse en bois massif, style scandinave. Quelques traces d''usage mais très solide. Dimensions: 120x60cm.',
    180.00,
    'published',
    'Furniture',
    'good',
    'pickup',
    'Zurich',
    'CH',
    timezone('utc', now()) - interval '5 hours'
  );

  -- Listing 4: Livres à Berne
  INSERT INTO public.listings (
    seller_id,
    title,
    description,
    price,
    status,
    category,
    condition,
    delivery_mode,
    city,
    country_code,
    published_at
  ) VALUES (
    v_seller_id,
    'Collection de livres de cuisine - 15 volumes',
    'Collection complète de livres de cuisine française et italienne. Tous en excellent état, certains jamais utilisés. Parfait pour les amateurs de cuisine.',
    45.00,
    'published',
    'Books',
    'like_new',
    'both',
    'Berne',
    'CH',
    timezone('utc', now()) - interval '3 hours'
  );

  -- Listing 5: Appareil photo à Bâle
  INSERT INTO public.listings (
    seller_id,
    title,
    description,
    price,
    status,
    category,
    condition,
    delivery_mode,
    city,
    country_code,
    published_at
  ) VALUES (
    v_seller_id,
    'Canon EOS R6 - Objectif 24-70mm',
    'Appareil photo Canon EOS R6 avec objectif 24-70mm f/2.8. Acheté il y a 1 an, très peu utilisé. Complet avec boîtier, chargeur, cartes mémoire et sac. État quasi neuf.',
    2200.00,
    'published',
    'Electronics',
    'like_new',
    'both',
    'Bâle',
    'CH',
    timezone('utc', now()) - interval '1 hour'
  );

END $$;

-- ============================================
-- 3. AJOUTER 1 PHOTO PAR LISTING
-- ============================================

-- Photos avec URLs placeholder (remplacez par vos vraies URLs d'images)
INSERT INTO public.listing_photos (listing_id, url, order_index)
SELECT 
  l.id,
  'https://via.placeholder.com/800x600/cccccc/666666?text=' || REPLACE(SUBSTRING(l.title, 1, 30), ' ', '+'),
  0
FROM public.listings l
WHERE l.status = 'published'
  AND l.seller_id = (
    SELECT id FROM auth.users ORDER BY created_at LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.listing_photos lp 
    WHERE lp.listing_id = l.id
  )
ORDER BY l.published_at DESC
LIMIT 5;

-- ============================================
-- VÉRIFICATION
-- ============================================
-- Vérifier les données créées:
-- SELECT 
--   l.id,
--   l.title,
--   l.price,
--   l.city,
--   l.status,
--   COUNT(lp.id) as photo_count
-- FROM public.listings l
-- LEFT JOIN public.listing_photos lp ON l.id = lp.listing_id
-- WHERE l.status = 'published'
-- GROUP BY l.id, l.title, l.price, l.city, l.status
-- ORDER BY l.published_at DESC;
-- ============================================
