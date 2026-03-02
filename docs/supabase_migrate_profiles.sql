-- ============================================
-- MIGRATION: Ajouter updated_at à la table profiles
-- ============================================
-- 
-- Ce script corrige l'erreur "record 'new' has no field 'updated_at'"
-- en ajoutant la colonne updated_at si elle n'existe pas
-- ============================================

-- 1. Ajouter la colonne updated_at si elle n'existe pas
alter table public.profiles 
add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- 2. Mettre à jour les enregistrements existants qui auraient updated_at = NULL
update public.profiles 
set updated_at = created_at 
where updated_at is null;

-- 3. S'assurer que le trigger existe (il sera créé par supabase_schema.sql)
-- Si le trigger n'existe pas encore, le créer:
do $$
begin
  if not exists (
    select 1 from pg_trigger 
    where tgname = 'update_profiles_updated_at'
  ) then
    create trigger update_profiles_updated_at
      before update on public.profiles
      for each row
      execute function update_updated_at_column();
  end if;
end $$;

-- ============================================
-- Vérification
-- ============================================
-- Vérifier que la colonne existe:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'updated_at';
