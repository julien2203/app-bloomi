-- Colonnes profil vendeur / demande influenceur (inscription seller-type).
alter table public.profiles
  add column if not exists is_influencer_request boolean not null default false,
  add column if not exists influencer_request_at timestamptz,
  add column if not exists company_name text,
  add column if not exists ide_number text,
  add column if not exists company_address text,
  add column if not exists company_social text;

comment on column public.profiles.is_influencer_request is
  'Demande influenceur en attente de validation admin (is_influencer = validé).';

comment on column public.profiles.influencer_request_at is
  'Horodatage de la demande influenceur.';

create index if not exists profiles_influencer_request_idx
  on public.profiles (is_influencer_request)
  where is_influencer_request = true;
