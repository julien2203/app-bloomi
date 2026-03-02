-- ============================================
-- MIGRATION: Ajouter display_name et avatar_url à profiles
-- ============================================

-- Ajouter les colonnes si elles n'existent pas
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text;

-- ============================================
-- Vérification
-- ============================================
-- Vérifier que les colonnes existent:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' 
-- AND column_name IN ('display_name', 'avatar_url');
-- ============================================
