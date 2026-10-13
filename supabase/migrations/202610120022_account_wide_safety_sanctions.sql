-- Account-wide AI safety strikes: warning, 30-second chat timeout, then account ban.
alter table public.moderation_events
  add column if not exists source_event_key text;

create unique index if not exists moderation_events_source_event_key_uidx
  on public.moderation_events(source_event_key);

create table if not exists public.account_safety_state (
  user_profile_id uuid primary key references public.user_profiles(id) on delete cascade,
  strike_count integer not null default 0 check (strike_count >= 0),
  chat_restricted_until timestamptz,
  is_banned boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not is_banned or chat_restricted_until is null)
);

create table if not exists public.account_safety_violations (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  moderation_event_id uuid references public.moderation_events(id) on delete set null,
  source_event_key text not null unique,
  category text not null check (category in ('threats_violence','self_harm','sexual_content')),
  confidence numeric(5,4) not null check (confidence between 0.9 and 1),
  strike_number smallint not null check (strike_number between 1 and 3),
  action text not null check (action in ('warning','chat_timeout','account_ban')),
  created_at timestamptz not null default now()
);
create index if not exists account_safety_violations_profile_idx
  on public.account_safety_violations(user_profile_id, created_at desc);

alter table public.account_safety_state enable row level security;
alter table public.account_safety_violations enable row level security;
drop policy if exists "account safety state owner or admin read" on public.account_safety_state;
create policy "account safety state owner or admin read" on public.account_safety_state
  for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
drop policy if exists "account safety violations owner or admin read" on public.account_safety_violations;
create policy "account safety violations owner or admin read" on public.account_safety_violations
  for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
revoke all on public.account_safety_state, public.account_safety_violations from public, anon, authenticated;
grant select on public.account_safety_state, public.account_safety_violations to authenticated;

create or replace function public.account_safety_blocks_chat(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1
    from public.user_profiles p
    left join public.account_safety_state s on s.user_profile_id = p.id
    where p.id = p_profile_id
      and p.account_status = 'active'
      and coalesce(s.is_banned, false) = false
      and (s.chat_restricted_until is null or s.chat_restricted_until <= now())
  );
$$;
revoke all on function public.account_safety_blocks_chat(uuid) from public, anon, authenticated;
grant execute on function public.account_safety_blocks_chat(uuid) to service_role;

create or replace function public.apply_account_safety_offense(
  p_profile_id uuid,
  p_moderation_event_id uuid,
  p_source_event_key text,
  p_category text,
  p_confidence numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.user_profiles%rowtype;
  v_state public.account_safety_state%rowtype;
  v_existing public.account_safety_violations%rowtype;
  v_action text;
  v_restricted_until timestamptz;
begin
  if p_category not in ('threats_violence','self_harm','sexual_content')
    or p_confidence < 0.9 or p_confidence > 1
    or p_source_event_key is null or length(p_source_event_key) not between 1 and 200 then
    raise exception 'Invalid confirmed safety offense';
  end if;
  if not exists (
    select 1 from public.moderation_events
    where id = p_moderation_event_id
      and user_profile_id = p_profile_id
      and category = p_category
      and confidence >= 0.9
  ) then raise exception 'Matching high-confidence moderation event required'; end if;

  select * into v_profile from public.user_profiles where id = p_profile_id for update;
  if not found then raise exception 'Profile not found'; end if;

  select * into v_existing from public.account_safety_violations
    where source_event_key = p_source_event_key;
  if found then
    return jsonb_build_object('strike', v_existing.strike_number, 'action', v_existing.action,
      'restrictedUntil', case when v_existing.action = 'chat_timeout' then
        (select chat_restricted_until from public.account_safety_state where user_profile_id = p_profile_id)
        else null end, 'alreadyApplied', true);
  end if;

  insert into public.account_safety_state(user_profile_id) values (p_profile_id)
    on conflict(user_profile_id) do nothing;
  select * into v_state from public.account_safety_state
    where user_profile_id = p_profile_id for update;
  if v_state.is_banned then
    return jsonb_build_object('strike', v_state.strike_count, 'action', 'account_ban',
      'restrictedUntil', null, 'alreadyApplied', true);
  end if;

  v_state.strike_count := least(v_state.strike_count + 1, 3);
  if v_state.strike_count = 1 then
    v_action := 'warning';
    v_restricted_until := null;
  elsif v_state.strike_count = 2 then
    v_action := 'chat_timeout';
    v_restricted_until := clock_timestamp() + interval '30 seconds';
  else
    v_action := 'account_ban';
    v_restricted_until := null;
  end if;

  insert into public.account_safety_violations(
    user_profile_id, moderation_event_id, source_event_key, category, confidence, strike_number, action
  ) values (
    p_profile_id, p_moderation_event_id, p_source_event_key, p_category, p_confidence, v_state.strike_count, v_action
  );
  update public.account_safety_state set
    strike_count = v_state.strike_count,
    chat_restricted_until = v_restricted_until,
    is_banned = (v_action = 'account_ban'),
    updated_at = clock_timestamp()
  where user_profile_id = p_profile_id;
  if v_action = 'account_ban' then
    update public.user_profiles set account_status = 'restricted', updated_at = clock_timestamp()
      where id = p_profile_id;
  end if;

  insert into public.notifications(user_profile_id, type, title, body, data)
  values (
    p_profile_id,
    'safety_' || v_action,
    case v_action when 'warning' then 'Safety warning' when 'chat_timeout' then 'Chat temporarily disabled' else 'Account banned' end,
    case v_action
      when 'warning' then 'A confirmed safety violation was found. Another confirmed violation will temporarily disable chat; a third will ban the account.'
      when 'chat_timeout' then 'Chat is disabled across battles and viewing for 30 seconds. A third confirmed violation will ban the account.'
      else 'This account is banned from Mai Live Wars after three confirmed safety violations.'
    end,
    jsonb_build_object('strike', v_state.strike_count, 'action', v_action, 'restrictedUntil', v_restricted_until)
  );
  insert into public.admin_audit_logs(admin_profile_id, action, target_type, target_id, reason, metadata)
  values (
    null, 'ai_safety_' || v_action, 'user_profile', p_profile_id::text, p_category,
    jsonb_build_object('moderation_event_id', p_moderation_event_id, 'strike', v_state.strike_count, 'confidence', p_confidence)
  );

  return jsonb_build_object('strike', v_state.strike_count, 'action', v_action,
    'restrictedUntil', v_restricted_until, 'alreadyApplied', false);
end;
$$;
revoke all on function public.apply_account_safety_offense(uuid,uuid,text,text,numeric) from public, anon, authenticated;
grant execute on function public.apply_account_safety_offense(uuid,uuid,text,text,numeric) to service_role;

create or replace function public.enforce_account_safety_for_battle_participant()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('invited','ready','active') and public.account_safety_blocks_chat(new.user_profile_id) then
    raise exception 'Account safety restriction prevents joining or starting a battle';
  end if;
  return new;
end;
$$;
drop trigger if exists battle_participant_account_safety_guard on public.battle_participants;
create trigger battle_participant_account_safety_guard
  before insert or update of status on public.battle_participants
  for each row execute function public.enforce_account_safety_for_battle_participant();
revoke all on function public.enforce_account_safety_for_battle_participant() from public, anon, authenticated;

create or replace function public.claim_battle_chat_moderation_slot(
  p_profile_id uuid,
  p_battle_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz;
  v_count smallint;
begin
  if public.account_safety_blocks_chat(p_profile_id) then
    raise exception 'Account safety restriction prevents chat';
  end if;
  if not exists(select 1 from public.battles where id=p_battle_id and status='live') then
    raise exception 'Chat is only available during a live battle';
  end if;
  if not exists(select 1 from public.battle_participants bp
      where bp.battle_id=p_battle_id and bp.user_profile_id=p_profile_id and bp.status='active')
    and not exists(select 1 from public.stream_sessions ss
      where ss.battle_id=p_battle_id and ss.user_profile_id=p_profile_id
        and ss.session_role='viewer' and ss.session_status='joined') then
    raise exception 'Join this battle before sending a chat message';
  end if;
  v_window := to_timestamp(floor(extract(epoch from clock_timestamp())/10)*10);
  insert into public.battle_chat_rate_windows(user_profile_id,window_started_at,request_count)
    values(p_profile_id,v_window,1)
    on conflict(user_profile_id,window_started_at)
    do update set request_count=public.battle_chat_rate_windows.request_count+1
    returning request_count into v_count;
  if v_count>5 then raise exception 'Chat moderation rate limit exceeded'; end if;
  return true;
end;
$$;
revoke all on function public.claim_battle_chat_moderation_slot(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_battle_chat_moderation_slot(uuid,uuid) to service_role;

create or replace function public.enforce_battle_chat_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_recent_messages int;
begin
  if public.account_safety_blocks_chat(new.user_profile_id) then
    raise exception 'Account safety restriction prevents chat';
  end if;
  new.body := btrim(new.body);
  if char_length(new.body) not between 1 and 240 then raise exception 'Chat messages must be 1 to 240 characters'; end if;
  if not exists(select 1 from public.battles where id=new.battle_id and status='live') then
    raise exception 'Chat is only available during a live battle';
  end if;
  if not exists(select 1 from public.battle_participants bp
      where bp.battle_id=new.battle_id and bp.user_profile_id=new.user_profile_id and bp.status='active')
    and not exists(select 1 from public.stream_sessions ss
      where ss.battle_id=new.battle_id and ss.user_profile_id=new.user_profile_id
        and ss.session_role='viewer' and ss.session_status='joined') then
    raise exception 'Join this battle before sending a chat message';
  end if;
  select count(*) into v_recent_messages from public.battle_chat_messages
    where user_profile_id=new.user_profile_id and created_at>now()-interval '10 seconds';
  if v_recent_messages>=5 then raise exception 'Chat rate limit exceeded'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_battle_chat_rate_limit() from public, anon, authenticated;
