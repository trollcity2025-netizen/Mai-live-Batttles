-- 004: AI moderation, user reports, notification records, and privileged-action audit trail.
create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid references public.battles(id) on delete set null,
  user_profile_id uuid references public.user_profiles(id) on delete set null,
  category text not null check (category in ('threats_violence','self_harm','sexual_content','harassment','other')),
  summary text,
  confidence numeric(5,4) check (confidence between 0 and 1),
  model_name text,
  model_version text,
  transcript_excerpt text,
  event_timestamp_ms bigint,
  enforcement_action text check (enforcement_action in ('none','temporary_hold','muted','participant_removed','battle_forfeit','account_restricted','manual_review')),
  review_status text not null default 'pending' check (review_status in ('pending','reviewed','appealed','overturned','confirmed')),
  speaker_attribution_confidence numeric(5,4) check (speaker_attribution_confidence between 0 and 1),
  retention_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists moderation_events_recent_idx on public.moderation_events(created_at desc);
create index if not exists moderation_events_battle_idx on public.moderation_events(battle_id,created_at desc);

alter table public.battle_participants add constraint battle_participants_moderation_fk foreign key (moderation_event_id) references public.moderation_events(id) on delete set null;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  reported_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  battle_id uuid references public.battles(id) on delete set null,
  category text not null,
  details text,
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  reviewed_by_profile_id uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_profile_id <> reported_profile_id)
);
create index if not exists user_reports_status_idx on public.user_reports(status,created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_profile_id,created_at desc);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_profile_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_recent_idx on public.admin_audit_logs(created_at desc);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  status text not null default 'requested' check (status in ('requested','processing','completed','rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  retained_records_note text
);

alter table public.moderation_events enable row level security;
alter table public.user_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.account_deletion_requests enable row level security;
create policy "moderation admin only" on public.moderation_events for select using (public.is_lw_admin());
create policy "reports owner read or admin" on public.user_reports for select using (reporter_profile_id = public.current_user_profile_id() or public.is_lw_admin());
create policy "reports owner create" on public.user_reports for insert with check (reporter_profile_id = public.current_user_profile_id());
create policy "notification owner read" on public.notifications for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
create policy "notification owner update" on public.notifications for update using (user_profile_id = public.current_user_profile_id()) with check (user_profile_id = public.current_user_profile_id());
create policy "admin audit admin only" on public.admin_audit_logs for select using (public.is_lw_admin());
create policy "account deletion owner read" on public.account_deletion_requests for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
-- Sensitive writes are reserved for trusted Edge Functions using the service role.
