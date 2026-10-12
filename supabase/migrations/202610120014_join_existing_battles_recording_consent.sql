-- 014: join existing queue rooms, allow spectators, and maintain separate recording-consent history.
create table if not exists public.marketing_recording_consents (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  consent_granted boolean not null,
  consent_version text not null default '2026-10-12',
  source text not null default 'profile_settings' check (source in ('signup','profile_settings','battle_gate')),
  recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists marketing_recording_consents_profile_idx on public.marketing_recording_consents(user_profile_id,recorded_at desc);
alter table public.marketing_recording_consents enable row level security;
create policy "recording consent owner read" on public.marketing_recording_consents for select using (user_profile_id=public.current_user_profile_id() or public.is_lw_admin());
create policy "recording consent owner insert" on public.marketing_recording_consents for insert with check (user_profile_id=public.current_user_profile_id());

create or replace function public.join_existing_battle(p_profile_id uuid,p_battle_id uuid,p_state_code char(2) default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_battle public.battles%rowtype; v_total int; v_a int; v_b int; v_team text; v_state char(2);
begin
  if not exists(select 1 from public.user_profiles where id=p_profile_id and profile_complete=true and account_status='active') then raise exception 'Complete active profile required'; end if;
  select * into v_battle from public.battles where id=p_battle_id for update;
  if not found then raise exception 'Battle not found'; end if;
  if exists(select 1 from public.battle_participants where battle_id=p_battle_id and user_profile_id=p_profile_id and status in ('active','ready')) then
    return jsonb_build_object('battleId',v_battle.id,'callId',v_battle.stream_call_id,'format',v_battle.format,'mode',v_battle.mode,'stateCode',p_state_code,'viewer',false,'alreadyParticipant',true);
  end if;
  if v_battle.status='live' then return jsonb_build_object('battleId',v_battle.id,'callId',v_battle.stream_call_id,'format',v_battle.format,'mode',v_battle.mode,'stateCode',p_state_code,'viewer',true); end if;
  if v_battle.status<>'waiting' then raise exception 'Battle is not accepting participants'; end if;
  v_total:=case v_battle.format when '1v1' then 2 when '2v2' then 4 when '3v3' then 6 when '4v4' then 8 when '5v5' then 10 else 12 end;
  select count(*) into v_a from public.battle_participants where battle_id=p_battle_id and team='A' and status not in ('removed','left','disconnected');
  select count(*) into v_b from public.battle_participants where battle_id=p_battle_id and team='B' and status not in ('removed','left','disconnected');
  if v_a+v_b>=v_total then raise exception 'Battle is full'; end if;
  v_team:=case when v_a<=v_b then 'A' else 'B' end;
  v_state:=case when v_battle.mode='state' then p_state_code else null end;
  insert into public.battle_participants(battle_id,user_profile_id,team,status,stream_user_id,state_code) values(p_battle_id,p_profile_id,v_team,'ready',p_profile_id::text,v_state);
  insert into public.stream_sessions(battle_id,user_profile_id,call_id,session_status) values(p_battle_id,p_profile_id,v_battle.stream_call_id,'created') on conflict(battle_id,user_profile_id) do nothing;
  insert into public.battle_events(battle_id,user_profile_id,event_type,team,payload,idempotency_key) values(p_battle_id,p_profile_id,'participant_joined',v_team,jsonb_build_object('state_code',v_state),'participant-join:'||p_battle_id::text||':'||p_profile_id::text) on conflict(idempotency_key) do nothing;
  return jsonb_build_object('battleId',v_battle.id,'callId',v_battle.stream_call_id,'format',v_battle.format,'mode',v_battle.mode,'stateCode',v_state,'team',v_team,'viewer',false,'matched',true);
end; $$;
revoke all on function public.join_existing_battle(uuid,uuid,char) from public, anon, authenticated;
