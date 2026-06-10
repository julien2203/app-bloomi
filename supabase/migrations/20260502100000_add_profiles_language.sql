-- App UI language preference (en, fr, de, it)
alter table public.profiles
  add column if not exists language text not null default 'en';

alter table public.profiles
  drop constraint if exists profiles_language_check;

alter table public.profiles
  add constraint profiles_language_check
  check (language in ('en', 'fr', 'de', 'it'));

comment on column public.profiles.language is 'Preferred app UI language';
