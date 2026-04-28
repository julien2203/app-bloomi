begin;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  reason text not null check (reason in ('Contenu inapproprie', 'Arnaque', 'Contenu illegal', 'Autre')),
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_reporter_id on public.reports(reporter_id);
create index if not exists idx_reports_listing_id on public.reports(listing_id);
create index if not exists idx_reports_created_at on public.reports(created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Users can insert own reports" on public.reports;
create policy "Users can insert own reports"
on public.reports
for insert
to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "Users can view own reports" on public.reports;
create policy "Users can view own reports"
on public.reports
for select
to authenticated
using (reporter_id = auth.uid());

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists idx_blocked_users_blocker_id on public.blocked_users(blocker_id);
create index if not exists idx_blocked_users_blocked_id on public.blocked_users(blocked_id);

alter table public.blocked_users enable row level security;

drop policy if exists "Users can insert own blocks" on public.blocked_users;
create policy "Users can insert own blocks"
on public.blocked_users
for insert
to authenticated
with check (blocker_id = auth.uid());

drop policy if exists "Users can delete own blocks" on public.blocked_users;
create policy "Users can delete own blocks"
on public.blocked_users
for delete
to authenticated
using (blocker_id = auth.uid());

drop policy if exists "Users can view own blocks" on public.blocked_users;
create policy "Users can view own blocks"
on public.blocked_users
for select
to authenticated
using (blocker_id = auth.uid());

commit;
