-- 018: distinguish creator participation from spectator RTC sessions for accurate viewer counts.
alter table public.stream_sessions add column if not exists session_role text not null default 'participant' check (session_role in ('participant','viewer'));
create index if not exists stream_sessions_viewer_count_idx on public.stream_sessions(battle_id,session_role,session_status);
