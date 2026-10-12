-- 006: trusted transactional RPCs. Edge Functions call these with the service-role key.
create or replace function public.apply_verified_purchase(
  p_purchase_id uuid,
  p_provider_capture_id text,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_purchase public.purchase_orders%rowtype; v_wallet public.wallets%rowtype;
begin
  select * into v_purchase from public.purchase_orders where id = p_purchase_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if v_purchase.status = 'credited' then return jsonb_build_object('status','already_credited'); end if;
  if v_purchase.status not in ('created','approved','captured') then raise exception 'Purchase is not eligible for credit'; end if;
  if exists(select 1 from public.purchase_orders where provider_capture_id = p_provider_capture_id and id <> p_purchase_id) then raise exception 'Capture already used'; end if;
  insert into public.wallets(user_profile_id) values(v_purchase.user_profile_id) on conflict(user_profile_id) do nothing;
  select * into v_wallet from public.wallets where user_profile_id = v_purchase.user_profile_id for update;
  update public.wallets set spendable_bullets = spendable_bullets + v_purchase.bullets, purchased_bullets_lifetime = purchased_bullets_lifetime + v_purchase.bullets, updated_at = now() where user_profile_id = v_purchase.user_profile_id;
  insert into public.wallet_transactions(user_profile_id,transaction_type,bullets_delta,balance_after,related_purchase_id,idempotency_key,provider_reference,metadata)
  values(v_purchase.user_profile_id,'purchase_credit',v_purchase.bullets,v_wallet.spendable_bullets + v_purchase.bullets,p_purchase_id,p_idempotency_key,p_provider_capture_id,jsonb_build_object('provider',v_purchase.provider,'amount_usd',v_purchase.amount_usd));
  update public.purchase_orders set status='credited',provider_capture_id=p_provider_capture_id,captured_at=coalesce(captured_at,now()),credited_at=now() where id=p_purchase_id;
  return jsonb_build_object('status','credited','bullets',v_purchase.bullets);
end; $$;
revoke all on function public.apply_verified_purchase(uuid,text,text) from public, anon, authenticated;

create or replace function public.request_creator_cashout(p_profile_id uuid, p_amount_bullets bigint, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_wallet public.wallets%rowtype; v_request public.cashout_requests%rowtype; v_today date; v_day int; v_next date;
begin
  if p_amount_bullets < 3500 then raise exception 'Minimum cashout is 3500 eligible Bullets'; end if;
  v_today := (now() at time zone 'America/Chicago')::date;
  v_day := extract(dow from (now() at time zone 'America/Chicago'))::int;
  if v_day = 1 or v_day = 5 then v_next := v_today;
  elsif v_day = 0 then v_next := v_today + 1;
  elsif v_day between 2 and 4 then v_next := v_today + (5-v_day);
  else v_next := v_today + 2;
  end if;
  insert into public.wallets(user_profile_id) values(p_profile_id) on conflict(user_profile_id) do nothing;
  select * into v_wallet from public.wallets where user_profile_id=p_profile_id for update;
  if v_wallet.eligible_earnings_bullets - v_wallet.reserved_cashout_bullets < p_amount_bullets then raise exception 'Insufficient eligible earnings Bullets'; end if;
  if exists(select 1 from public.cashout_requests where idempotency_key=p_idempotency_key) then
    select * into v_request from public.cashout_requests where idempotency_key=p_idempotency_key;
    return jsonb_build_object('requestId',v_request.id,'status',v_request.status,'scheduledDate',v_request.scheduled_processing_date);
  end if;
  -- Earnings cashout conversion is distinct from the purchase conversion: 350 eligible Bullets = $1.
  insert into public.cashout_requests(user_profile_id,amount_bullets,amount_usd,status,scheduled_processing_date,idempotency_key)
  values(p_profile_id,p_amount_bullets,round(p_amount_bullets::numeric/350,2),'pending',v_next,p_idempotency_key) returning * into v_request;
  update public.wallets set reserved_cashout_bullets=reserved_cashout_bullets+p_amount_bullets,updated_at=now() where user_profile_id=p_profile_id;
  insert into public.wallet_transactions(user_profile_id,transaction_type,bullets_delta,related_cashout_id,idempotency_key,metadata)
  values(p_profile_id,'cashout_reserve',-p_amount_bullets,v_request.id,p_idempotency_key||':reserve',jsonb_build_object('scheduled_date',v_next,'amount_usd',v_request.amount_usd));
  return jsonb_build_object('requestId',v_request.id,'status',v_request.status,'scheduledDate',v_request.scheduled_processing_date,'amountUsd',v_request.amount_usd);
end; $$;
revoke all on function public.request_creator_cashout(uuid,bigint,text) from public, anon, authenticated;

create or replace function public.finalize_battle(p_battle_id uuid, p_winner_team text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_battle public.battles%rowtype;
begin
  select * into v_battle from public.battles where id=p_battle_id for update;
  if not found then raise exception 'Battle not found'; end if;
  if v_battle.status in ('completed','forfeit','moderation_ended','cancelled') then return jsonb_build_object('status',v_battle.status,'alreadyFinalized',true); end if;
  if p_winner_team not in ('A','B','tie') then raise exception 'Invalid winner'; end if;
  update public.battles set status=case when p_reason='moderation_forfeit' then 'forfeit' else 'completed' end,winner_team=p_winner_team,result_reason=p_reason,ended_at=now(),updated_at=now() where id=p_battle_id;
  insert into public.battle_events(battle_id,event_type,team,payload,idempotency_key) values(p_battle_id,case when p_reason='moderation_forfeit' then 'battle_forfeit' else 'battle_completed' end,p_winner_team,jsonb_build_object('reason',p_reason), 'finalize:'||p_battle_id::text) on conflict(idempotency_key) do nothing;
  update public.battle_participants set status='completed',left_at=coalesce(left_at,now()) where battle_id=p_battle_id and status in ('active','ready','invited');
  return jsonb_build_object('status','finalized','winner',p_winner_team);
end; $$;
revoke all on function public.finalize_battle(uuid,text,text) from public, anon, authenticated;

create or replace function public.remove_moderated_participant(p_battle_id uuid, p_profile_id uuid, p_moderation_event_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_battle public.battles%rowtype; v_active_a int; v_active_b int; v_offender_team text; v_winner text;
begin
  select * into v_battle from public.battles where id=p_battle_id for update;
  if not found then raise exception 'Battle not found'; end if;
  if v_battle.status <> 'live' then raise exception 'Battle is not live'; end if;
  select team into v_offender_team from public.battle_participants where battle_id=p_battle_id and user_profile_id=p_profile_id for update;
  if v_offender_team is null then raise exception 'Participant not found in battle'; end if;
  update public.battle_participants set status='removed',left_at=now(),removal_reason=p_reason,moderation_event_id=p_moderation_event_id where battle_id=p_battle_id and user_profile_id=p_profile_id;
  insert into public.battle_events(battle_id,user_profile_id,event_type,team,payload,idempotency_key) values(p_battle_id,p_profile_id,'moderation_removed',v_offender_team,jsonb_build_object('reason',p_reason,'moderation_event_id',p_moderation_event_id),'moderation-remove:'||p_moderation_event_id::text) on conflict(idempotency_key) do nothing;
  select count(*) into v_active_a from public.battle_participants where battle_id=p_battle_id and team='A' and status in ('active','ready');
  select count(*) into v_active_b from public.battle_participants where battle_id=p_battle_id and team='B' and status in ('active','ready');
  if v_battle.format='1v1' then
    v_winner := case when v_offender_team='A' then 'B' else 'A' end;
    perform public.finalize_battle(p_battle_id,v_winner,'moderation_forfeit');
    return jsonb_build_object('action','removed_and_forfeit','winner',v_winner);
  elsif v_active_a=0 and v_active_b=0 then
    perform public.finalize_battle(p_battle_id,'tie','all_participants_removed');
    return jsonb_build_object('action','removed_and_tie');
  elsif v_active_a=0 then
    perform public.finalize_battle(p_battle_id,'B','team_forfeit');
    return jsonb_build_object('action','removed_and_team_forfeit','winner','B');
  elsif v_active_b=0 then
    perform public.finalize_battle(p_battle_id,'A','team_forfeit');
    return jsonb_build_object('action','removed_and_team_forfeit','winner','A');
  end if;
  return jsonb_build_object('action','participant_removed_battle_continues');
end; $$;
revoke all on function public.remove_moderated_participant(uuid,uuid,uuid,text) from public, anon, authenticated;
