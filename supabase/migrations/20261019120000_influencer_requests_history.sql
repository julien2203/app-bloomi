-- Historique des demandes influenceur (en attente / acceptées / refusées).
create table if not exists public.influencer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'refused')),
  instagram text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint influencer_requests_decided_chk check (
    (status = 'pending' and decided_at is null)
    or (status in ('accepted', 'refused') and decided_at is not null)
  )
);

comment on table public.influencer_requests is
  'Historique des demandes influenceur (une ligne par demande / décision).';

create index if not exists influencer_requests_status_requested_idx
  on public.influencer_requests (status, requested_at desc);

create index if not exists influencer_requests_user_id_idx
  on public.influencer_requests (user_id, requested_at desc);

create unique index if not exists influencer_requests_one_pending_per_user_idx
  on public.influencer_requests (user_id)
  where status = 'pending';

alter table public.influencer_requests enable row level security;

-- Lecture / écriture réservées au service_role (admin). Pas de policy publique.

create or replace function public.profiles_track_influencer_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_request boolean := false;
begin
  if tg_op = 'UPDATE' then
    was_request := coalesce(old.is_influencer_request, false);
  end if;

  -- Nouvelle demande (insert avec flag, ou false → true) : ouvre une ligne pending.
  if coalesce(new.is_influencer_request, false) and not was_request then
    insert into public.influencer_requests (user_id, status, instagram, requested_at)
    values (
      new.id,
      'pending',
      nullif(trim(new.influencer_instagram), ''),
      coalesce(new.influencer_request_at, now())
    )
    on conflict (user_id) where (status = 'pending')
    do update set
      instagram = excluded.instagram,
      requested_at = excluded.requested_at,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_track_influencer_request on public.profiles;
create trigger profiles_track_influencer_request
  after insert or update of is_influencer_request, influencer_instagram, influencer_request_at
  on public.profiles
  for each row
  execute function public.profiles_track_influencer_request();

-- Backfill : demandes en attente actuelles
insert into public.influencer_requests (user_id, status, instagram, requested_at)
select
  p.id,
  'pending',
  nullif(trim(p.influencer_instagram), ''),
  coalesce(p.influencer_request_at, p.created_at, now())
from public.profiles p
where p.is_influencer_request = true
on conflict (user_id) where (status = 'pending') do nothing;

-- Backfill : influenceurs déjà validés (sans pending)
insert into public.influencer_requests (user_id, status, instagram, requested_at, decided_at)
select
  p.id,
  'accepted',
  nullif(trim(p.influencer_instagram), ''),
  coalesce(p.influencer_request_at, p.created_at, now()),
  coalesce(p.updated_at, now())
from public.profiles p
where p.is_influencer = true
  and p.is_influencer_request = false
  and not exists (
    select 1
    from public.influencer_requests r
    where r.user_id = p.id
      and r.status = 'accepted'
  );
