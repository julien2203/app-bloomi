alter table if exists public.notifications enable row level security;

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
on public.notifications
for delete
using (user_id = auth.uid());
