-- Type vendeur explicite (particulier, entreprise, raison individuelle).
alter table public.profiles
  add column if not exists seller_type text;

alter table public.profiles
  drop constraint if exists profiles_seller_type_check;

alter table public.profiles
  add constraint profiles_seller_type_check
  check (seller_type is null or seller_type in ('individual', 'pro', 'sole_proprietorship'));

comment on column public.profiles.seller_type is
  'Type vendeur choisi à l''inscription : individual, pro (entreprise), sole_proprietorship (raison individuelle).';
