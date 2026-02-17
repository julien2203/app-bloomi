-- Table des profils applicatifs
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  country text,
  created_at timestamptz not null default timezone('utc', now())
);

-- Activer RLS
alter table public.profiles enable row level security;

-- Politique de lecture : chaque utilisateur ne peut lire que son profil
create policy "Profiles are viewable by owner"
on public.profiles
for select
using (auth.uid() = id);

-- Politique d'insertion : chaque utilisateur ne peut insérer que son propre profil
create policy "Profiles can be inserted by owner"
on public.profiles
for insert
with check (auth.uid() = id);

-- Politique de mise à jour : chaque utilisateur ne peut modifier que son profil
create policy "Profiles can be updated by owner"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

