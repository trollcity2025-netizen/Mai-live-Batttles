alter table public.battles
  add column if not exists is_test boolean not null default false;

create or replace function public.confirm_test_bot_connection(
  p_battle_id uuid,
  p_requester_profile_id uuid,
  p_bot_profile_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_battle public.battles%rowtype;
  v_active_count int;
  v_now timestamptz := now();
begin
  select * into v_battle from public.battles where id=p_battle_id for update;
  if not found or not v_battle.is_test or v_battle.status not in ('waiting','ready','live') then
    raise exception 'Test battle is not accepting the opponent connection';
  end if;
  if v_battle.created_by_profile_id<>p_requester_profile_id then
    raise exception 'Only the test battle creator can connect its opponent';
  end if;
  if not exists(select 1 from public.battle_participants where battle_id=p_battle_id and user_profile_id=p_requester_profile_id and team='A' and status in ('ready','active')) then
    raise exception 'Test battle creator is not an active participant';
  end if;
  update public.battle_participants
    set status='active',joined_at=coalesce(joined_at,v_now)
    where battle_id=p_battle_id and user_profile_id=p_bot_profile_id and team='B' and status in ('ready','active');
  if not found then raise exception 'Admin Tester is not assigned to this test battle'; end if;
  update public.stream_sessions
    set session_status='joined',connected_at=coalesce(connected_at,v_now),disconnected_at=null
    where battle_id=p_battle_id and user_profile_id=p_bot_profile_id;
  select count(*) into v_active_count from public.battle_participants where battle_id=p_battle_id and status='active';
  if v_active_count>=2 and v_battle.status<>'live' then
    update public.battles set status='live',started_at=v_now,scheduled_end_at=v_now+interval '180 seconds',updated_at=v_now
      where id=p_battle_id and status in ('waiting','ready');
    insert into public.battle_events(battle_id,event_type,payload,idempotency_key)
      values(p_battle_id,'timer_started',jsonb_build_object('started_at',v_now,'test_battle',true),'timer-start:'||p_battle_id::text)
      on conflict(idempotency_key) do nothing;
  end if;
  return jsonb_build_object('status','connected','activeParticipants',v_active_count);
end;
$$;
revoke all on function public.confirm_test_bot_connection(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.confirm_test_bot_connection(uuid,uuid,uuid) to service_role;

create or replace function public.send_test_bot_gift(
  p_battle_id uuid,
  p_requester_profile_id uuid,
  p_bot_profile_id uuid,
  p_gift_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_battle public.battles%rowtype;
  v_gift public.gift_catalog%rowtype;
  v_recipient public.battle_participants%rowtype;
  v_event_id uuid := gen_random_uuid();
begin
  select * into v_battle from public.battles where id=p_battle_id for update;
  if not found or not v_battle.is_test or v_battle.status<>'live' then raise exception 'Test battle is not live'; end if;
  if v_battle.created_by_profile_id<>p_requester_profile_id then raise exception 'Only the test battle creator can run test gifts'; end if;
  select * into v_gift from public.gift_catalog where gift_key=p_gift_key and active=true;
  if not found then raise exception 'Gift is unavailable'; end if;
  select * into v_recipient from public.battle_participants
    where battle_id=p_battle_id and user_profile_id=p_requester_profile_id and team='A' and status='active';
  if not found then raise exception 'Test battle creator is not an active recipient'; end if;
  if not exists(select 1 from public.battle_participants where battle_id=p_battle_id and user_profile_id=p_bot_profile_id and team='B' and status='active') then
    raise exception 'Admin Tester is not active in this test battle';
  end if;

  update public.battles set team_a_score=team_a_score+v_gift.battle_points,updated_at=now() where id=p_battle_id;
  insert into public.battle_events(battle_id,user_profile_id,event_type,team,points,payload,idempotency_key)
    values(p_battle_id,p_bot_profile_id,'gift_scored','A',v_gift.battle_points,
      jsonb_build_object('gift_key',p_gift_key,'recipient_profile_id',p_requester_profile_id,'fake_bullets',v_gift.bullet_cost,'test_bot',true,'gift_event_id',v_event_id),
      'test-bot-gift:'||v_event_id::text);
  insert into public.battle_chat_messages(battle_id,user_profile_id,body)
    values(p_battle_id,p_bot_profile_id,'[TEST GIFT BOT] Sent '||v_gift.display_name||' to you for '||v_gift.bullet_cost||' fake Bullets!');
  return jsonb_build_object('status','sent','giftName',v_gift.display_name,'fakeBullets',v_gift.bullet_cost,'battlePoints',v_gift.battle_points,'team','A');
end;
$$;
revoke all on function public.send_test_bot_gift(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.send_test_bot_gift(uuid,uuid,uuid,text) to service_role;

create or replace function public.write_test_bot_chat(
  p_battle_id uuid,
  p_requester_profile_id uuid,
  p_bot_profile_id uuid,
  p_message text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(
    select 1 from public.battles b
    join public.battle_participants bp on bp.battle_id=b.id
    where b.id=p_battle_id and b.is_test and b.status='live'
      and b.created_by_profile_id=p_requester_profile_id
      and bp.user_profile_id=p_bot_profile_id and bp.team='B' and bp.status='active'
  ) then raise exception 'Test bot cannot write to this battle'; end if;
  if char_length(trim(p_message)) not between 1 and 180 then raise exception 'Invalid test bot chat message'; end if;
  insert into public.battle_chat_messages(battle_id,user_profile_id,body)
    values(p_battle_id,p_bot_profile_id,'[ADMIN TESTER BOT] '||trim(p_message));
end;
$$;
revoke all on function public.write_test_bot_chat(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.write_test_bot_chat(uuid,uuid,uuid,text) to service_role;

create or replace function public.enforce_battle_no_gift_cooldown(
  p_profile_id uuid,
  p_cooldown_exempt boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_recent_battles int;
  v_no_gift_battles int;
  v_last_ended_at timestamptz;
  v_cooldown_until timestamptz;
begin
  if p_cooldown_exempt then return; end if;
  perform pg_advisory_xact_lock(hashtext('battle-no-gift-cooldown:'||p_profile_id::text));
  with recent_battles as (
    select b.id,b.ended_at from public.battles b
    join public.battle_participants bp on bp.battle_id=b.id
    where bp.user_profile_id=p_profile_id and b.is_test=false
      and b.status in ('completed','forfeit') and b.ended_at is not null
    order by b.ended_at desc,b.id desc limit 3
  )
  select count(*)::int,
    count(*) filter (where not exists(
      select 1 from public.gift_transactions gt where gt.battle_id=recent_battles.id
        and gt.recipient_profile_id=p_profile_id and gt.status='settled'
    ))::int,
    max(ended_at)
  into v_recent_battles,v_no_gift_battles,v_last_ended_at
  from recent_battles;
  if v_recent_battles=3 and v_no_gift_battles=3 then
    v_cooldown_until:=v_last_ended_at+interval '30 minutes';
    if now()<v_cooldown_until then
      raise exception using message='NO_GIFT_BATTLE_COOLDOWN:'||to_char(v_cooldown_until at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
    end if;
  end if;
end;
$$;

create or replace function public.finalize_battle(p_battle_id uuid,p_winner_team text,p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_battle public.battles%rowtype; v_inserted int;
begin
  select * into v_battle from public.battles where id=p_battle_id for update;
  if not found then raise exception 'Battle not found'; end if;
  if exists(select 1 from public.battle_events where idempotency_key='finalize:'||p_battle_id::text) then
    return jsonb_build_object('status',v_battle.status,'alreadyFinalized',true,'winner',v_battle.winner_team);
  end if;
  if v_battle.status in ('completed','forfeit','moderation_ended','cancelled') then return jsonb_build_object('status',v_battle.status,'alreadyFinalized',true); end if;
  if p_winner_team not in ('A','B','tie') then raise exception 'Invalid winner'; end if;
  if p_reason='timer_elapsed' and (v_battle.scheduled_end_at is null or now()<v_battle.scheduled_end_at) then raise exception 'Battle timer has not elapsed'; end if;
  update public.battles set status=case when p_reason in ('moderation_forfeit','team_forfeit','participant_forfeit') then 'forfeit' else 'completed' end,
    winner_team=p_winner_team,result_reason=p_reason,ended_at=now(),updated_at=now() where id=p_battle_id;
  insert into public.battle_events(battle_id,event_type,team,payload,idempotency_key)
    values(p_battle_id,case when p_reason in ('moderation_forfeit','team_forfeit','participant_forfeit') then 'battle_forfeit' else 'battle_completed' end,
      p_winner_team,jsonb_build_object('reason',p_reason,'score_a',v_battle.team_a_score,'score_b',v_battle.team_b_score,'test_battle',v_battle.is_test),
      'finalize:'||p_battle_id::text) on conflict(idempotency_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted>0 and not v_battle.is_test then
    insert into public.battle_ratings(user_profile_id)
      select user_profile_id from public.battle_participants where battle_id=p_battle_id on conflict(user_profile_id) do nothing;
    update public.battle_ratings r set
      wins=r.wins+case when bp.team=p_winner_team and p_winner_team<>'tie' and bp.status<>'removed' then 1 else 0 end,
      losses=r.losses+case when bp.team<>p_winner_team and p_winner_team<>'tie' then 1 else 0 end,
      ties=r.ties+case when p_winner_team='tie' then 1 else 0 end,
      rating=greatest(100,r.rating+case when p_winner_team='tie' then 0 when bp.team=p_winner_team and bp.status<>'removed' then 25 else -20 end),
      streak=case when p_winner_team='tie' then 0 when bp.team=p_winner_team and bp.status<>'removed' then r.streak+1 else 0 end,
      best_streak=greatest(r.best_streak,case when p_winner_team=bp.team and bp.status<>'removed' then r.streak+1 else r.best_streak end),
      updated_at=now()
    from public.battle_participants bp where bp.battle_id=p_battle_id and bp.user_profile_id=r.user_profile_id;
  end if;
  update public.battle_participants set status='completed',left_at=coalesce(left_at,now())
    where battle_id=p_battle_id and status in ('active','ready','invited');
  return jsonb_build_object('status','finalized','winner',p_winner_team,'reason',p_reason,'testBattle',v_battle.is_test);
end;
$$;
