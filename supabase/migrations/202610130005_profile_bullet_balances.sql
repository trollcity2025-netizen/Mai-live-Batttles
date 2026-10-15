alter table public.user_profiles
  add column spendable_bullets bigint not null default 0
    check (spendable_bullets >= 0),
  add column cashable_bullets bigint not null default 0
    check (cashable_bullets >= 0);

update public.user_profiles as profiles
set
  spendable_bullets = wallets.spendable_bullets,
  cashable_bullets = greatest(wallets.eligible_earnings_bullets - wallets.reserved_cashout_bullets, 0)
from public.wallets as wallets
where wallets.user_profile_id = profiles.id;

create or replace function public.sync_profile_bullet_balances()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_profiles
  set
    spendable_bullets = new.spendable_bullets,
    cashable_bullets = greatest(new.eligible_earnings_bullets - new.reserved_cashout_bullets, 0),
    updated_at = now()
  where id = new.user_profile_id;

  return new;
end;
$$;

revoke all on function public.sync_profile_bullet_balances() from public, anon, authenticated;

create trigger wallets_sync_profile_bullet_balances
after insert or update of spendable_bullets, eligible_earnings_bullets, reserved_cashout_bullets
on public.wallets
for each row
execute function public.sync_profile_bullet_balances();

create or replace function public.get_my_profile_bullet_balances()
returns table (spendable_bullets bigint, cashable_bullets bigint)
language sql
stable
security definer
set search_path = public
as $$
  select profiles.spendable_bullets, profiles.cashable_bullets
  from public.user_profiles as profiles
  where profiles.user_id = auth.uid();
$$;

revoke all on function public.get_my_profile_bullet_balances() from public, anon;
grant execute on function public.get_my_profile_bullet_balances() to authenticated;

create or replace view public.admin_user_profiles
with (security_barrier = true)
as
select
  profiles.id,
  profiles.username,
  profiles.display_name,
  profiles.role,
  profiles.created_at,
  profiles.state_code,
  profiles.spendable_bullets,
  profiles.cashable_bullets
from public.user_profiles as profiles
where public.is_lw_admin();

revoke all on public.admin_user_profiles from public, anon, authenticated;
grant select on public.admin_user_profiles to authenticated;

revoke all on public.user_profiles from public, anon, authenticated;
grant select (
  id, user_id, username, display_name, avatar_path, avatar_url, bio, gender,
  city, state_code, role, profile_complete, marketing_recording_consent,
  marketing_recording_consent_at, account_status, created_at, updated_at
) on public.user_profiles to anon, authenticated;
grant insert (
  user_id, username, display_name, avatar_path, avatar_url, bio, gender,
  city, state_code, role, profile_complete, marketing_recording_consent
) on public.user_profiles to authenticated;
grant update (
  user_id, username, display_name, avatar_path, avatar_url, bio, gender,
  city, state_code, role, profile_complete, marketing_recording_consent
) on public.user_profiles to authenticated;

grant select on public.public_fighter_profiles to anon, authenticated;
