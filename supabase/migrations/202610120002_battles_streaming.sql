-- 002: battle formats, modes, participant identity, event history, ratings, and stream rooms.
create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  created_by_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  format text not null check (format in ('1v1','2v2','3v3','4v4','5v5','6v6')),
  mode text not null default 'standard' check (mode in ('standard','fast','slow','state')),
  status text not null default 'waiting' check (status in ('waiting','ready','live','completed','cancelled','forfeit','moderation_ended')),
  team_a_score integer not null default 0 check (team_a_score >= 0),
  team_b_score integer not null default 0 check (team_b_score >= 0),
  viewer_count integer not null default 0 check (viewer_count >= 0),
  state_code char(2),
  stream_call_id text unique,
  displayed_duration_seconds integer not null default 180 check (displayed_duration_seconds = 180),
  real_duration_seconds integer not null default 180 check (real_duration_seconds in (90,180,360)),
  clock_rate numeric(3,1) not null default 1.0 check (clock_rate in (0.5,1.0,2.0)),
  started_at timestamptz,
  scheduled_end_at timestamptz,
  ended_at timestamptz,
  winner_team text check (winner_team in ('A','B','tie') or winner_team is null),
  result_reason text,
  rules_version text not null default '2026-10-12',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists battles_status_created_idx on public.battles(status, created_at desc);
create index if not exists battles_format_mode_idx on public.battles(format, mode, status);
create index if not exists battles_state_idx on public.battles(state_code, status) where mode = 'state';
drop trigger if exists battles_set_updated_at on public.battles;
create trigger battles_set_updated_at before update on public.battles for each row execute function public.set_updated_at();

create table if not exists public.battle_participants (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  team text not null check (team in ('A','B')),
  status text not null default 'invited' check (status in ('invited','ready','active','removed','disconnected','left','completed')),
  stream_user_id text,
  joined_at timestamptz,
  left_at timestamptz,
  removal_reason text,
  moderation_event_id uuid,
  created_at timestamptz not null default now(),
  unique (battle_id, user_profile_id)
);
create index if not exists battle_participants_profile_idx on public.battle_participants(user_profile_id, created_at desc);
create index if not exists battle_participants_battle_team_idx on public.battle_participants(battle_id, team, status);

create table if not exists public.battle_events (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_profile_id uuid references public.user_profiles(id) on delete set null,
  event_type text not null check (event_type in ('created','participant_joined','participant_left','timer_started','gift_scored','score_updated','moderation_removed','battle_completed','battle_forfeit','battle_cancelled','connection_lost','connection_restored')),
  team text check (team in ('A','B') or team is null),
  points integer not null default 0 check (points >= 0),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create index if not exists battle_events_battle_idx on public.battle_events(battle_id, created_at);

create table if not exists public.battle_ratings (
  user_profile_id uuid primary key references public.user_profiles(id) on delete cascade,
  rating integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.battle_invitations (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  inviter_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  invitee_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  team text not null check (team in ('A','B')),
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired','cancelled')),
  expires_at timestamptz not null default now() + interval '10 minutes',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (inviter_profile_id <> invitee_profile_id)
);
create index if not exists battle_invite_inbox_idx on public.battle_invitations(invitee_profile_id,status,created_at desc);

create table if not exists public.stream_sessions (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  provider text not null default 'getstream' check (provider = 'getstream'),
  call_id text not null,
  session_status text not null default 'created' check (session_status in ('created','joined','left','failed','revoked')),
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (battle_id, user_profile_id)
);

alter table public.battles enable row level security;
alter table public.battle_participants enable row level security;
alter table public.battle_events enable row level security;
alter table public.battle_ratings enable row level security;
alter table public.battle_invitations enable row level security;
alter table public.stream_sessions enable row level security;
create policy "battles public discovery" on public.battles for select using (status in ('waiting','ready','live','completed') or created_by_profile_id = public.current_user_profile_id() or public.is_lw_admin());
create policy "battle participant read" on public.battle_participants for select using (user_profile_id = public.current_user_profile_id() or exists(select 1 from public.battles b where b.id = battle_id and b.status in ('waiting','ready','live')) or public.is_lw_admin());
create policy "battle events visible to participants" on public.battle_events for select using (user_profile_id = public.current_user_profile_id() or exists(select 1 from public.battle_participants bp where bp.battle_id = battle_id and bp.user_profile_id = public.current_user_profile_id()) or public.is_lw_admin());
create policy "ratings public read" on public.battle_ratings for select using (true);
create policy "invitations participant read" on public.battle_invitations for select using (inviter_profile_id = public.current_user_profile_id() or invitee_profile_id = public.current_user_profile_id() or public.is_lw_admin());
create policy "stream session owner read" on public.stream_sessions for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
-- No client INSERT/UPDATE policies are provided for battle state, events, ratings, or stream sessions. Use trusted Edge Functions.
