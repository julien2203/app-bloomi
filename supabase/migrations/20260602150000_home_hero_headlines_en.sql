-- Titres du héro feed : version anglaise en plus du français (headline_line_1/2).
-- L'admin mobile/back-office peut remplir les deux langues indépendamment.

alter table public.home_hero_config
  add column if not exists headline_line_1_en text,
  add column if not exists headline_line_2_en text;

comment on column public.home_hero_config.headline_line_1 is
  'Titre ligne 1 (français), édité depuis l''admin.';
comment on column public.home_hero_config.headline_line_2 is
  'Titre ligne 2 (français), édité depuis l''admin.';
comment on column public.home_hero_config.headline_line_1_en is
  'Titre ligne 1 (anglais). Si vide, l''app utilise le libellé par défaut anglais.';
comment on column public.home_hero_config.headline_line_2_en is
  'Titre ligne 2 (anglais). Si vide, l''app utilise le libellé par défaut anglais.';

update public.home_hero_config
set
  headline_line_1_en = coalesce(nullif(trim(headline_line_1_en), ''), 'Second hand'),
  headline_line_2_en = coalesce(nullif(trim(headline_line_2_en), ''), 'First choice')
where id = 'default';
