-- =============================================================================
-- Bloomi — Supprimer les données de test (Supabase SQL Editor)
-- =============================================================================
--
-- Où l’exécuter : Dashboard Supabase → SQL → New query → coller ce fichier
--                 → lire les options ci-dessous → décommenter UNE section → Run
--
-- ⚠️  IRRÉVERSIBLE. Faire une sauvegarde avant (Dashboard → Database → Backups).
-- ⚠️  Utiliser le rôle postgres / service (SQL Editor du projet), pas le client app.
--
-- Ce script NE supprime PAS le catalogue (categories, brands, sizes, colors, conditions).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- OPTION A — Contenu applicatif uniquement (comptes auth + profils conservés)
-- Idéal pour vider feed, annonces, messages, commandes, likes, etc.
-- -----------------------------------------------------------------------------
/*
BEGIN;

DELETE FROM public.notifications;
DELETE FROM public.messages;
DELETE FROM public.threads;
DELETE FROM public.orders;
DELETE FROM public.listing_views;
DELETE FROM public.likes;
DELETE FROM public.reports;
DELETE FROM public.blocked_users;
DELETE FROM public.reviews;
DELETE FROM public.follows;
DELETE FROM public.listing_photos;
DELETE FROM public.listings;

-- Remettre à zéro les compteurs / champs optionnels sur les profils (si colonnes présentes)
UPDATE public.profiles
SET
  cover_image = NULL,
  expo_push_token = NULL
WHERE TRUE;

COMMIT;
*/

-- -----------------------------------------------------------------------------
-- OPTION B — Même chose + supprimer TOUS les comptes utilisateurs
-- Les profils et données liées partent en cascade (FK vers auth.users / profiles).
-- -----------------------------------------------------------------------------
/*
BEGIN;

DELETE FROM public.notifications;
DELETE FROM public.messages;
DELETE FROM public.threads;
DELETE FROM public.orders;
DELETE FROM public.listing_views;
DELETE FROM public.likes;
DELETE FROM public.reports;
DELETE FROM public.blocked_users;
DELETE FROM public.reviews;
DELETE FROM public.follows;
DELETE FROM public.listing_photos;
DELETE FROM public.listings;

-- Supprime tous les utilisateurs Auth (+ profiles en cascade)
DELETE FROM auth.users;

COMMIT;
*/

-- -----------------------------------------------------------------------------
-- OPTION C — Supprimer seulement certains comptes de test (adapter le filtre)
-- -----------------------------------------------------------------------------
/*
DELETE FROM auth.users
WHERE
  email ILIKE '%+test%'
  OR email ILIKE '%@test.%'
  OR email IN ('dev@example.com', 'test@bloomi.app');
*/

-- -----------------------------------------------------------------------------
-- Vérification rapide après nettoyage (toujours exécutable)
-- -----------------------------------------------------------------------------
SELECT 'listings' AS tbl, count(*) FROM public.listings
UNION ALL SELECT 'orders', count(*) FROM public.orders
UNION ALL SELECT 'messages', count(*) FROM public.messages
UNION ALL SELECT 'threads', count(*) FROM public.threads
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'auth.users', count(*) FROM auth.users;
