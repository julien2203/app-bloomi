-- Default app language: French (client request)
alter table public.profiles
  alter column language set default 'fr';
