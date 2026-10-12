-- 021: limit chat moderation-provider calls before sending text to OpenAI.
create table if not exists public.battle_chat_rate_windows (
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count smallint not null check (request_count > 0),
  primary key (user_profile_id, window_started_at)
);
alter table public.battle_chat_rate_windows enable row level security;

create or replace function public.claim_battle_chat_moderation_slot(
  p_profile_id uuid,
  p_battle_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz;
  v_count smallint;
begin
  if not exists(select 1 from public.user_profiles where id=p_profile_id and account_status='active') then
    raise exception 'Active profile required to chat';
  end if;
  if not exists(select 1 from public.battles where id=p_battle_id and status='live') then
    raise exception 'Chat is only available during a live battle';
  end if;
  if not exists(select 1 from public.battle_participants bp
      where bp.battle_id=p_battle_id and bp.user_profile_id=p_profile_id and bp.status='active')
    and not exists(select 1 from public.stream_sessions ss
      where ss.battle_id=p_battle_id and ss.user_profile_id=p_profile_id
        and ss.session_role='viewer' and ss.session_status='joined') then
    raise exception 'Join this battle before sending a chat message';
  end if;

  v_window := to_timestamp(floor(extract(epoch from clock_timestamp())/10)*10);
  insert into public.battle_chat_rate_windows(user_profile_id,window_started_at,request_count)
    values(p_profile_id,v_window,1)
    on conflict(user_profile_id,window_started_at)
    do update set request_count=public.battle_chat_rate_windows.request_count+1
    returning request_count into v_count;
  if v_count>5 then raise exception 'Chat moderation rate limit exceeded'; end if;
  return true;
end;
$$;

revoke all on function public.claim_battle_chat_moderation_slot(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_battle_chat_moderation_slot(uuid,uuid) to service_role;
