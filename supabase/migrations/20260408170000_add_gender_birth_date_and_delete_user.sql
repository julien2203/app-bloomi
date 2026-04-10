-- Add missing profile fields
alter table public.profiles
  add column if not exists gender text;

alter table public.profiles
  add column if not exists birth_date date;

-- Allow a logged-in user to delete their own auth user row.
-- This is commonly used from the client via: supabase.rpc('delete_user')
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users
  where id = auth.uid();
end;
$$;

