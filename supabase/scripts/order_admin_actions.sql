-- Même script que bloomi-admin/scripts/supabase-order-admin-actions.sql
create table if not exists public.order_admin_actions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  admin_email text,
  action text not null,
  success boolean not null default false,
  message text,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_admin_actions_order_id_idx
  on public.order_admin_actions (order_id, created_at desc);

create index if not exists order_admin_actions_created_at_idx
  on public.order_admin_actions (created_at desc);

alter table public.order_admin_actions enable row level security;
