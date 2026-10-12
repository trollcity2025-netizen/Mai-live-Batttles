-- 010: idempotency and observability for trusted GetStream webhook events.
create table if not exists public.getstream_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  call_id text,
  user_profile_id uuid references public.user_profiles(id) on delete set null,
  payload_hash text,
  processed boolean not null default false,
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.getstream_webhook_events enable row level security;
create policy "getstream webhook events admin only" on public.getstream_webhook_events for select using (public.is_lw_admin());
