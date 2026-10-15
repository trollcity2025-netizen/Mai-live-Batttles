-- 001: Lower cashout minimum from 3,750 to 3,500 eligible Bullets ($10)
alter table public.cashout_requests drop constraint if exists cashout_requests_amount_bullets_check;
alter table public.cashout_requests add constraint cashout_requests_amount_bullets_check check (amount_bullets >= 3500);

create or replace function public.request_creator_cashout(
  p_profile_id uuid,
  p_amount_bullets bigint,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_wallet public.wallets%rowtype;
  v_request public.cashout_requests%rowtype;
  v_today date;
  v_day int;
  v_next date;
begin
  if p_amount_bullets < 3500 then raise exception 'Minimum cashout is 3,500 eligible Bullets ($10)'; end if;
  if p_idempotency_key is null or p_idempotency_key = '' then raise exception 'A valid cashout idempotency key is required'; end if;

  select * into v_wallet from public.wallets where user_profile_id = p_profile_id for update;
  if not found then raise exception 'Wallet not found'; end if;
  if v_wallet.eligible_earnings_bullets - v_wallet.reserved_cashout_bullets < p_amount_bullets then raise exception 'Insufficient eligible earnings Bullets'; end if;

  if exists(select 1 from public.cashout_requests where idempotency_key = p_idempotency_key) then
    select * into v_request from public.cashout_requests where idempotency_key = p_idempotency_key;
    return jsonb_build_object('requestId', v_request.id, 'status', v_request.status, 'alreadyExists', true);
  end if;

  v_today := now() at time zone 'America/Chicago'::text;
  v_day := extract(isodow from v_today)::int;
  if v_day in (1, 5) then v_next := v_today;
  elsif v_day < 1 then v_next := v_today + (1 - v_day);
  elsif v_day < 5 then v_next := v_today + (5 - v_day);
  else v_next := v_today + (8 - v_day); end if;

  insert into public.cashout_requests(user_profile_id, amount_bullets, amount_usd, status, scheduled_processing_date, idempotency_key)
  values(p_profile_id, p_amount_bullets, round(p_amount_bullets::numeric / 350, 2), 'pending', v_next, p_idempotency_key)
  returning * into v_request;

  update public.wallets set reserved_cashout_bullets = reserved_cashout_bullets + p_amount_bullets, updated_at = now() where user_profile_id = p_profile_id;

  insert into public.wallet_transactions(user_profile_id, transaction_type, bullets_delta, related_cashout_id, idempotency_key, metadata)
  values(p_profile_id, 'cashout_reserve', -p_amount_bullets, v_request.id, p_idempotency_key || ':reserve', jsonb_build_object('scheduled_date', v_next, 'amount_usd', v_request.amount_usd));

  return jsonb_build_object('requestId', v_request.id, 'status', v_request.status, 'scheduledDate', v_next, 'amountUsd', v_request.amount_usd);
end $$;

revoke all on function public.request_creator_cashout(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.request_creator_cashout(uuid, bigint, text) to service_role;