-- Exemption manuelle des frais vendeur (toggle admin), indépendante d'influenceur / pro.
alter table public.profiles
  add column if not exists seller_fee_exempt boolean not null default false;

comment on column public.profiles.seller_fee_exempt is
  'Si true : commission vendeur à 0 % au checkout (override admin). Ne change pas seller_type / is_influencer.';

create index if not exists profiles_seller_fee_exempt_idx
  on public.profiles (seller_fee_exempt)
  where seller_fee_exempt = true;
