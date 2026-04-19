-- Colonne distincte de is_influencer_request : true = compte influenceur validé (badge dans l’app).
-- Les demandes d’inscription mettent seulement is_influencer_request ; la validation manuelle/admin met is_influencer.

alter table public.profiles
  add column if not exists is_influencer boolean not null default false;

comment on column public.profiles.is_influencer is
  'Influenceur validé (UI badge). Ne pas confondre avec is_influencer_request (demande en cours).';
