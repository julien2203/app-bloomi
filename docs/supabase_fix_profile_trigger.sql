-- ============================================
-- FIX: Corriger le trigger updated_at pour profiles
-- ============================================
-- 
-- Problème: Le trigger essaie d'accéder à updated_at qui n'existe peut-être pas
-- Solution: Ajouter la colonne si elle n'existe pas, puis recréer le trigger
-- ============================================

-- 1. Ajouter la colonne updated_at si elle n'existe pas
alter table public.profiles 
add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- 2. Supprimer l'ancien trigger s'il existe
drop trigger if exists update_profiles_updated_at on public.profiles;

-- 3. Recréer le trigger avec vérification
create or replace function update_profiles_updated_at()
returns trigger as $$
begin
  -- Vérifier si la colonne existe avant de la mettre à jour
  if tg_table_name = 'profiles' then
    new.updated_at = timezone('utc', now());
  end if;
  return new;
end;
$$ language plpgsql;

-- 4. Recréer le trigger
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function update_profiles_updated_at();

-- ============================================
-- Alternative plus simple: Trigger simplifié
-- ============================================

-- Si la solution ci-dessus ne fonctionne pas, utiliser cette version simplifiée:
-- 
-- drop trigger if exists update_profiles_updated_at on public.profiles;
-- 
-- create trigger update_profiles_updated_at
--   before update on public.profiles
--   for each row
--   execute function update_updated_at_column();
--
-- Mais d'abord s'assurer que la colonne existe avec:
-- alter table public.profiles add column if not exists updated_at timestamptz not null default timezone('utc', now());
