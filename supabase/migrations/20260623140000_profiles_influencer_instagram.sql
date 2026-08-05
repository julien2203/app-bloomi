alter table public.profiles
  add column if not exists influencer_instagram text;

comment on column public.profiles.influencer_instagram is
  'Pseudo Instagram (@) fourni lors de la demande influenceur.';
