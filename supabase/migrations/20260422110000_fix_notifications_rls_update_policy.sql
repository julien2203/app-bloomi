alter table if exists public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
on public.notifications
for select
using (user_id = auth.uid());

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
on public.notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
