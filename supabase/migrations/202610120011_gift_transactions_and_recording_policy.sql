-- 011: transactional gift scoring, creator earning ledger, and battle recording safeguards.
alter table public.battles add column if not exists promotional_recording_status text not null default 'off' check (promotional_recording_status in ('off','eligible','recording','completed','blocked'));
alter table public.battles add column if not exists promotional_recording_asset_path text;

create or replace function public.send_battle_gift(
  p_battle_id uuid,
  p_sender_profile_id uuid,
  p_recipient_profile_id uuid,
  p_gift_key text,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_battle public.battles%rowtype; v_gift public.gift_catalog%rowtype; v_sender_profile public.user_profiles%rowtype; v_recipient public.battle_participants%rowtype; v_wallet public.wallets%rowtype; v_new_balance bigint;
begin
  if exists(select 1 from public.gift_transactions where idempotency_key=p_idempotency_key) then
    return jsonb_build_object('status','already_processed');
  end if;
  select * into v_battle from public.battles where id=p_battle_id for update;
  if not found or v_battle.status<>'live' then raise exception 'Battle is not live'; end if;
  select * into v_gift from public.gift_catalog where gift_key=p_gift_key and active=true;
  if not found then raise exception 'Gift is unavailable'; end if;
  select * into v_sender_profile from public.user_profiles where id=p_sender_profile_id and account_status='active';
  if not found then raise exception 'Sender profile is not active'; end if;
  select * into v_recipient from public.battle_participants where battle_id=p_battle_id and user_profile_id=p_recipient_profile_id and status='active';
  if not found then raise exception 'Recipient is not an active participant'; end if;
  if p_sender_profile_id=v_recipient.user_profile_id then raise exception 'Self-gifting is not allowed'; end if;
  insert into public.wallets(user_profile_id) values(p_sender_profile_id) on conflict(user_profile_id) do nothing;
  select * into v_wallet from public.wallets where user_profile_id=p_sender_profile_id for update;
  if v_wallet.spendable_bullets < v_gift.bullet_cost then raise exception 'Insufficient Bullets'; end if;
  v_new_balance := v_wallet.spendable_bullets-v_gift.bullet_cost;
  update public.wallets set spendable_bullets=v_new_balance,updated_at=now() where user_profile_id=p_sender_profile_id;
  insert into public.gift_transactions(battle_id,sender_profile_id,recipient_profile_id,gift_id,bullet_cost,battle_points,status,idempotency_key)
  values(p_battle_id,p_sender_profile_id,p_recipient_profile_id,v_gift.id,v_gift.bullet_cost,v_gift.battle_points,'settled',p_idempotency_key);
  insert into public.wallet_transactions(user_profile_id,transaction_type,bullets_delta,balance_after,related_gift_transaction_id,idempotency_key,metadata)
  values(p_sender_profile_id,'gift_spend',-v_gift.bullet_cost,v_new_balance,(select id from public.gift_transactions where idempotency_key=p_idempotency_key),p_idempotency_key||':spend',jsonb_build_object('battle_id',p_battle_id,'gift_key',p_gift_key,'balance_bucket','spendable'));
  update public.battles set team_a_score=team_a_score+case when v_recipient.team='A' then v_gift.battle_points else 0 end,team_b_score=team_b_score+case when v_recipient.team='B' then v_gift.battle_points else 0 end,updated_at=now() where id=p_battle_id;
  insert into public.battle_events(battle_id,user_profile_id,event_type,team,points,payload,idempotency_key)
  values(p_battle_id,p_sender_profile_id,'gift_scored',v_recipient.team,v_gift.battle_points,jsonb_build_object('gift_key',p_gift_key,'recipient_profile_id',p_recipient_profile_id),'gift-score:'||p_idempotency_key) on conflict(idempotency_key) do nothing;
  insert into public.wallets(user_profile_id) values(p_recipient_profile_id) on conflict(user_profile_id) do nothing;
  update public.wallets set eligible_earnings_bullets=eligible_earnings_bullets+v_gift.battle_points,updated_at=now() where user_profile_id=p_recipient_profile_id;
  insert into public.creator_earnings(user_profile_id,battle_id,gift_transaction_id,gross_bullets,fee_bullets,net_eligible_bullets,status,idempotency_key)
  values(p_recipient_profile_id,p_battle_id,(select id from public.gift_transactions where idempotency_key=p_idempotency_key),v_gift.battle_points,0,v_gift.battle_points,'eligible','creator-earning:'||p_idempotency_key);
  insert into public.wallet_transactions(user_profile_id,transaction_type,bullets_delta,balance_after,related_gift_transaction_id,idempotency_key,metadata)
  values(p_recipient_profile_id,'creator_earning',v_gift.battle_points,(select eligible_earnings_bullets from public.wallets where user_profile_id=p_recipient_profile_id),(select id from public.gift_transactions where idempotency_key=p_idempotency_key),p_idempotency_key||':earning',jsonb_build_object('battle_id',p_battle_id,'balance_bucket','eligible_earnings'));
  return jsonb_build_object('status','settled','bulletCost',v_gift.bullet_cost,'battlePoints',v_gift.battle_points,'team',v_recipient.team,'spendableBalance',v_new_balance);
end; $$;
revoke all on function public.send_battle_gift(uuid,uuid,uuid,text,text) from public, anon, authenticated;

update public.bullet_packages set active=true where package_key in ('starter-125','battle-500','creator-1250','arena-2500','vault-6500');
update public.bullet_packages set active=false,requires_admin_confirmation=true where package_key='executive-31500';
