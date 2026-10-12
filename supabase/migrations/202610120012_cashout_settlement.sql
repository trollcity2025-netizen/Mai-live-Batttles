-- 012: idempotent PayPal payout settlement and Bullet reservation release.
create or replace function public.settle_cashout_payout(p_cashout_id uuid,p_outcome text,p_provider_reference text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.cashout_requests%rowtype; v_wallet public.wallets%rowtype; v_inserted int;
begin
  if p_outcome not in ('paid','failed') then raise exception 'Invalid payout outcome'; end if;
  select * into v_request from public.cashout_requests where id=p_cashout_id for update;
  if not found then raise exception 'Cashout request not found'; end if;
  if v_request.status=p_outcome then return jsonb_build_object('status',p_outcome,'alreadySettled',true); end if;
  if v_request.status not in ('processing','approved') then raise exception 'Cashout is not awaiting payout settlement'; end if;
  select * into v_wallet from public.wallets where user_profile_id=v_request.user_profile_id for update;
  if p_outcome='paid' then
    update public.wallets set eligible_earnings_bullets=greatest(0,eligible_earnings_bullets-v_request.amount_bullets),reserved_cashout_bullets=greatest(0,reserved_cashout_bullets-v_request.amount_bullets),updated_at=now() where user_profile_id=v_request.user_profile_id;
    update public.cashout_requests set status='paid',paid_at=now(),updated_at=now() where id=p_cashout_id;
    insert into public.wallet_transactions(user_profile_id,transaction_type,bullets_delta,balance_after,related_cashout_id,idempotency_key,provider_reference,metadata)
    values(v_request.user_profile_id,'cashout_paid',-v_request.amount_bullets,greatest(0,v_wallet.eligible_earnings_bullets-v_request.amount_bullets),p_cashout_id,'cashout-settle:'||p_cashout_id::text||':paid',p_provider_reference,jsonb_build_object('amount_usd',v_request.amount_usd,'balance_bucket','eligible_earnings')) on conflict(idempotency_key) do nothing;
  else
    update public.wallets set reserved_cashout_bullets=greatest(0,reserved_cashout_bullets-v_request.amount_bullets),updated_at=now() where user_profile_id=v_request.user_profile_id;
    update public.cashout_requests set status='failed',updated_at=now() where id=p_cashout_id;
    insert into public.wallet_transactions(user_profile_id,transaction_type,bullets_delta,balance_after,related_cashout_id,idempotency_key,provider_reference,metadata)
    values(v_request.user_profile_id,'cashout_release',v_request.amount_bullets,v_wallet.eligible_earnings_bullets,p_cashout_id,'cashout-settle:'||p_cashout_id::text||':failed',p_provider_reference,jsonb_build_object('reason','PayPal payout failed','balance_bucket','eligible_earnings')) on conflict(idempotency_key) do nothing;
  end if;
  return jsonb_build_object('status',p_outcome,'requestId',p_cashout_id);
end; $$;
revoke all on function public.settle_cashout_payout(uuid,text,text) from public, anon, authenticated;
