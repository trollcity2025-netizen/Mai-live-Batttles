alter table public.battles drop constraint if exists battles_format_check;
alter table public.battles
  add constraint battles_format_check check (format in ('1v1','2v2','3v3','4v4','5v5','6v6'));

create or replace function public.join_or_create_battle(
  p_profile_id uuid,
  p_format text,
  p_mode text,
  p_state_code char(2) default null,
  p_cooldown_exempt boolean default false
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
  if p_format not in ('1v1','2v2','3v3','4v4','5v5','6v6') then raise exception 'Invalid format'; end if;
  if p_mode not in ('standard','fast','slow','state') then raise exception 'Invalid mode'; end if;
  if p_mode='state' and (p_state_code is null or p_state_code !~ '^[A-Z]{2}$') then
    raise exception 'State battle requires a valid state';
  end if;

  perform public.enforce_battle_no_gift_cooldown(p_profile_id,p_cooldown_exempt);

  v_total:=substring(p_format from '^[1-6]')::int*2;
  v_state:=case when p_mode='state' then p_state_code else null end;
  perform pg_advisory_xact_lock(hashtext(p_format||':'||p_mode));

  select b.* into v_battle
  from public.battles b
  where b.status='waiting'
    and b.format=p_format
    and b.mode=p_mode
    and b.created_by_profile_id<>p_profile_id
    and not exists(select 1 from public.battle_participants bp where bp.battle_id=b.id and bp.user_profile_id=p_profile_id)
    and (select count(*) from public.battle_participants bp where bp.battle_id=b.id and bp.status not in ('removed','left','disconnected'))<v_total
  order by b.created_at asc
  for update skip locked
  limit 1;

  if found then
    select count(*) into v_a from public.battle_participants
      where battle_id=v_battle.id and team='A' and status not in ('removed','left','disconnected');
    select count(*) into v_b from public.battle_participants
      where battle_id=v_battle.id and team='B' and status not in ('removed','left','disconnected');
    v_team:=case when v_a<=v_b then 'A' else 'B' end;
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

revoke all on function public.join_or_create_battle(uuid,text,text,char,boolean) from public,anon,authenticated;
grant execute on function public.join_or_create_battle(uuid,text,text,char,boolean) to service_role;
