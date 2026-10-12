-- 019: align matchmaking and cashout rules with the supported launch formats.
do $$
begin
  if exists(select 1 from public.battles where format not in ('1v1','6v6')) then
    raise exception 'Existing battles use retired formats; review them before restricting supported formats';
  end if;
  if exists(select 1 from public.cashout_requests where amount_bullets < 3750) then
    raise exception 'Existing cashouts are below the new 3,750-Bullet minimum; review them before changing the constraint';
  end if;
end;
$$;

alter table public.battles drop constraint if exists battles_format_check;
alter table public.battles add constraint battles_format_check check (format in ('1v1','6v6'));
alter table public.cashout_requests drop constraint if exists cashout_requests_amount_bullets_check;
alter table public.cashout_requests add constraint cashout_requests_amount_bullets_check check (amount_bullets >= 3750);
create index if not exists battle_chat_messages_profile_created_idx
  on public.battle_chat_messages(user_profile_id, created_at desc);

create or replace function public.join_or_create_battle(
  p_profile_id uuid,
  p_format text,
  p_mode text,
  p_state_code char(2) default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_battle public.battles%rowtype;
  v_a int;
  v_b int;
  v_team text;
  v_total int;
  v_state char(2);
begin
  if not exists(select 1 from public.user_profiles where id=p_profile_id and profile_complete=true and account_status='active') then
    raise exception 'Complete active profile required';
  end if;
  if p_format not in ('1v1','6v6') then raise exception 'Invalid battle format'; end if;
  if p_mode not in ('standard','fast','slow','state') then raise exception 'Invalid battle mode'; end if;
  if p_mode='state' and (p_state_code is null or p_state_code !~ '^[A-Z]{2}$') then
    raise exception 'State battle requires a valid state';
  end if;

  v_total := case p_format when '1v1' then 2 else 12 end;
  v_state := case when p_mode='state' then p_state_code else null end;
  perform pg_advisory_xact_lock(hashtext(p_format || ':' || p_mode));

  select b.* into v_battle
  from public.battles b
  where b.status='waiting'
    and b.format=p_format
    and b.mode=p_mode
    and b.created_by_profile_id<>p_profile_id
    and not exists(select 1 from public.battle_participants bp where bp.battle_id=b.id and bp.user_profile_id=p_profile_id)
    and (select count(*) from public.battle_participants bp where bp.battle_id=b.id and bp.status not in ('removed','left','disconnected')) < v_total
  order by b.created_at asc
  for update skip locked
  limit 1;

  if found then
    select count(*) into v_a from public.battle_participants
      where battle_id=v_battle.id and team='A' and status not in ('removed','left','disconnected');
    select count(*) into v_b from public.battle_participants
      where battle_id=v_battle.id and team='B' and status not in ('removed','left','disconnected');
    v_team := case when v_a <= v_b then 'A' else 'B' end;
    insert into public.battle_participants(battle_id,user_profile_id,team,status,stream_user_id,state_code)
      values(v_battle.id,p_profile_id,v_team,'ready',p_profile_id::text,v_state);
    insert into public.battle_events(battle_id,user_profile_id,event_type,team,payload,idempotency_key)
      values(v_battle.id,p_profile_id,'participant_joined',v_team,jsonb_build_object('state_code',v_state),
        'participant-join:'||v_battle.id::text||':'||p_profile_id::text)
      on conflict(idempotency_key) do nothing;
    insert into public.stream_sessions(battle_id,user_profile_id,call_id,session_status)
      values(v_battle.id,p_profile_id,v_battle.stream_call_id,'created')
      on conflict(battle_id,user_profile_id) do nothing;
    return jsonb_build_object('battleId',v_battle.id,'callId',v_battle.stream_call_id,'format',v_battle.format,
      'mode',v_battle.mode,'stateCode',v_state,'team',v_team,'matched',true);
  end if;

  insert into public.battles(
    created_by_profile_id,format,mode,status,state_code,stream_call_id,
    displayed_duration_seconds,real_duration_seconds,clock_rate
  )
  values(
    p_profile_id,p_format,p_mode,'waiting',v_state,'lw-'||gen_random_uuid()::text,
    180,case p_mode when 'slow' then 360 else 180 end,case p_mode when 'slow' then 0.5 else 1.0 end
  )
  returning * into v_battle;

  insert into public.battle_participants(battle_id,user_profile_id,team,status,stream_user_id,state_code)
    values(v_battle.id,p_profile_id,'A','ready',p_profile_id::text,v_state);
  insert into public.battle_events(battle_id,user_profile_id,event_type,team,payload,idempotency_key)
    values(v_battle.id,p_profile_id,'created','A',
      jsonb_build_object('format',p_format,'mode',p_mode,'state_code',v_state),'battle-created:'||v_battle.id::text);
  insert into public.battle_ratings(user_profile_id) values(p_profile_id) on conflict(user_profile_id) do nothing;
  insert into public.stream_sessions(battle_id,user_profile_id,call_id,session_status)
    values(v_battle.id,p_profile_id,v_battle.stream_call_id,'created')
    on conflict(battle_id,user_profile_id) do nothing;
  return jsonb_build_object('battleId',v_battle.id,'callId',v_battle.stream_call_id,'format',v_battle.format,
    'mode',v_battle.mode,'stateCode',v_state,'team','A','matched',false);
end;
$$;

create or replace function public.request_creator_cashout(
  p_profile_id uuid,
  p_amount_bullets bigint,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_wallet public.wallets%rowtype;
  v_request public.cashout_requests%rowtype;
  v_today date;
  v_day int;
  v_next date;
begin
  if p_amount_bullets < 3750 then raise exception 'Minimum cashout is 3,750 eligible Bullets'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128 then
    raise exception 'A valid cashout idempotency key is required';
  end if;
  select * into v_request from public.cashout_requests where idempotency_key=p_idempotency_key for update;
  if found then
    if v_request.user_profile_id<>p_profile_id or v_request.amount_bullets<>p_amount_bullets then
      raise exception 'Cashout idempotency key was already used for a different request';
    end if;
    return jsonb_build_object('requestId',v_request.id,'status',v_request.status,
      'scheduledDate',v_request.scheduled_processing_date,'amountUsd',v_request.amount_usd);
  end if;

  v_today := (now() at time zone 'America/Chicago')::date;
  v_day := extract(dow from (now() at time zone 'America/Chicago'))::int;
  if v_day=1 or v_day=5 then v_next:=v_today;
  elsif v_day=0 then v_next:=v_today+1;
  elsif v_day between 2 and 4 then v_next:=v_today+(5-v_day);
  else v_next:=v_today+2;
  end if;

  insert into public.wallets(user_profile_id) values(p_profile_id) on conflict(user_profile_id) do nothing;
  select * into v_wallet from public.wallets where user_profile_id=p_profile_id for update;
  select * into v_request from public.cashout_requests where idempotency_key=p_idempotency_key for update;
  if found then
    if v_request.user_profile_id<>p_profile_id or v_request.amount_bullets<>p_amount_bullets then
      raise exception 'Cashout idempotency key was already used for a different request';
    end if;
    return jsonb_build_object('requestId',v_request.id,'status',v_request.status,
      'scheduledDate',v_request.scheduled_processing_date,'amountUsd',v_request.amount_usd);
  end if;
  if v_wallet.eligible_earnings_bullets-v_wallet.reserved_cashout_bullets<p_amount_bullets then
    raise exception 'Insufficient eligible earnings Bullets';
  end if;

  insert into public.cashout_requests(user_profile_id,amount_bullets,amount_usd,status,scheduled_processing_date,idempotency_key)
    values(p_profile_id,p_amount_bullets,round(p_amount_bullets::numeric/375,2),'pending',v_next,p_idempotency_key)
    returning * into v_request;
  update public.wallets set reserved_cashout_bullets=reserved_cashout_bullets+p_amount_bullets,updated_at=now()
    where user_profile_id=p_profile_id;
  insert into public.wallet_transactions(user_profile_id,transaction_type,bullets_delta,related_cashout_id,idempotency_key,metadata)
    values(p_profile_id,'cashout_reserve',-p_amount_bullets,v_request.id,p_idempotency_key||':reserve',
      jsonb_build_object('scheduled_date',v_next,'amount_usd',v_request.amount_usd));
  return jsonb_build_object('requestId',v_request.id,'status',v_request.status,
    'scheduledDate',v_request.scheduled_processing_date,'amountUsd',v_request.amount_usd);
end;
$$;

create or replace function public.enforce_battle_chat_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account_status text;
  v_recent_messages int;
begin
  select account_status into v_account_status from public.user_profiles
    where id=new.user_profile_id for update;
  if not found or v_account_status<>'active' then raise exception 'Active profile required to chat'; end if;
  new.body:=btrim(new.body);
  if char_length(new.body) not between 1 and 240 then raise exception 'Chat messages must be 1 to 240 characters'; end if;
  if not exists(select 1 from public.battles where id=new.battle_id and status='live') then
    raise exception 'Chat is only available during a live battle';
  end if;
  select count(*) into v_recent_messages from public.battle_chat_messages
    where user_profile_id=new.user_profile_id and created_at>now()-interval '10 seconds';
  if v_recent_messages>=5 then raise exception 'Chat rate limit exceeded'; end if;
  return new;
end;
$$;

drop trigger if exists battle_chat_rate_limit on public.battle_chat_messages;
create trigger battle_chat_rate_limit before insert on public.battle_chat_messages
  for each row execute function public.enforce_battle_chat_rate_limit();

revoke all on function public.enforce_battle_chat_rate_limit() from public, anon, authenticated;
