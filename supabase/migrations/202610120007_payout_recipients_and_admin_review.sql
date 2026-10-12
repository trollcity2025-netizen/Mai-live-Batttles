-- 007: verified PayPal destination and transactional administrator cashout review.
create table if not exists public.payout_recipients (
  user_profile_id uuid primary key references public.user_profiles(id) on delete restrict,
  paypal_email text not null,
  verified boolean not null default false,
  verification_provider_ref text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payout_recipients enable row level security;
create policy "payout destination owner read" on public.payout_recipients for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
-- No client writes: verification and changes must go through a trusted function.

create or replace function public.review_cashout_request(p_cashout_id uuid, p_admin_profile_id uuid, p_action text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.cashout_requests%rowtype;
begin
  if p_action not in ('approve','reject') then raise exception 'Invalid review action'; end if;
  if not exists(select 1 from public.user_profiles where id=p_admin_profile_id and role='admin' and account_status='active') then raise exception 'Administrator required'; end if;
  select * into v_request from public.cashout_requests where id=p_cashout_id for update;
  if not found then raise exception 'Cashout request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'Only pending requests can be reviewed'; end if;
  if p_action='approve' then
    update public.cashout_requests set status='approved',reviewed_by_profile_id=p_admin_profile_id,reviewed_at=now(),rejection_reason=null where id=p_cashout_id;
  else
    update public.cashout_requests set status='rejected',reviewed_by_profile_id=p_admin_profile_id,reviewed_at=now(),rejection_reason=left(coalesce(p_reason,'Rejected by administrator'),500) where id=p_cashout_id;
    update public.wallets set reserved_cashout_bullets=greatest(0,reserved_cashout_bullets-v_request.amount_bullets),updated_at=now() where user_profile_id=v_request.user_profile_id;
    insert into public.wallet_transactions(user_profile_id,transaction_type,bullets_delta,related_cashout_id,idempotency_key,metadata)
    values(v_request.user_profile_id,'cashout_release',v_request.amount_bullets,p_cashout_id,'cashout-release:'||p_cashout_id::text,jsonb_build_object('reason',coalesce(p_reason,'rejected')))
    on conflict(idempotency_key) do nothing;
  end if;
  insert into public.admin_audit_logs(admin_profile_id,action,target_type,target_id,reason,metadata)
  values(p_admin_profile_id,'cashout_'||p_action,'cashout_request',p_cashout_id::text,p_reason,jsonb_build_object('amount_bullets',v_request.amount_bullets,'amount_usd',v_request.amount_usd));
  return jsonb_build_object('requestId',p_cashout_id,'status',case when p_action='approve' then 'approved' else 'rejected' end);
end; $$;
revoke all on function public.review_cashout_request(uuid,uuid,text,text) from public, anon, authenticated;
