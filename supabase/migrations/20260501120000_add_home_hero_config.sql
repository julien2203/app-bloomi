begin;

-- Flag admin sur les profils (géré depuis le back-office)
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'When true, user can manage app-wide config (e.g. feed home hero) via admin UI.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- Configuration du héro feed (une ligne active)
create table if not exists public.home_hero_config (
  id text primary key default 'default',
  headline_line_1 text not null default 'Seconde main',
  headline_line_2 text not null default 'Premier choix',
  cta_label text not null default 'Sell now',
  cta_route text not null default '/tabs/sell',
  image_path text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.home_hero_config is
  'Published home feed hero (image + copy). Managed from admin app.';

create index if not exists idx_home_hero_config_published
  on public.home_hero_config (is_published)
  where is_published = true;

alter table public.home_hero_config enable row level security;

drop policy if exists "Anyone can read published home hero" on public.home_hero_config;
create policy "Anyone can read published home hero"
on public.home_hero_config
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Admins can read all home hero configs" on public.home_hero_config;
create policy "Admins can read all home hero configs"
on public.home_hero_config
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert home hero config" on public.home_hero_config;
create policy "Admins can insert home hero config"
on public.home_hero_config
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update home hero config" on public.home_hero_config;
create policy "Admins can update home hero config"
on public.home_hero_config
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete home hero config" on public.home_hero_config;
create policy "Admins can delete home hero config"
on public.home_hero_config
for delete
to authenticated
using (public.is_admin());

insert into public.home_hero_config (
  id,
  headline_line_1,
  headline_line_2,
  cta_label,
  cta_route,
  is_published
)
values (
  'default',
  'Seconde main',
  'Premier choix',
  'Sell now',
  '/tabs/sell',
  true
)
on conflict (id) do update set
  headline_line_1 = excluded.headline_line_1,
  headline_line_2 = excluded.headline_line_2,
  cta_label = excluded.cta_label,
  cta_route = excluded.cta_route,
  is_published = excluded.is_published,
  updated_at = now();

-- Bucket Storage public pour l''image du héro
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'home-hero',
  'home-hero',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Home hero bucket public read" on storage.objects;
create policy "Home hero bucket public read"
on storage.objects
for select
to public
using (bucket_id = 'home-hero');

drop policy if exists "Home hero bucket admin insert" on storage.objects;
create policy "Home hero bucket admin insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'home-hero' and public.is_admin());

drop policy if exists "Home hero bucket admin update" on storage.objects;
create policy "Home hero bucket admin update"
on storage.objects
for update
to authenticated
using (bucket_id = 'home-hero' and public.is_admin())
with check (bucket_id = 'home-hero' and public.is_admin());

drop policy if exists "Home hero bucket admin delete" on storage.objects;
create policy "Home hero bucket admin delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'home-hero' and public.is_admin());

commit;
