create or replace view public.admin_user_profiles
with (security_invoker = true)
as
select
  profiles.id,
  profiles.username,
  profiles.display_name,
  profiles.role,
  profiles.created_at,
  profiles.state_code,
  wallets.spendable_bullets
from public.user_profiles as profiles
left join public.wallets as wallets
  on wallets.user_profile_id = profiles.id
where public.is_lw_admin();

revoke all on public.admin_user_profiles from public, anon, authenticated;
grant select on public.admin_user_profiles to authenticated;
