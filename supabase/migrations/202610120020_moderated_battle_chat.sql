-- 020: require battle access and server-side moderation for every chat message.
drop policy if exists "authenticated profiles read live battle chat" on public.battle_chat_messages;
create policy "battle participants and viewers read chat" on public.battle_chat_messages for select using (
  exists(select 1 from public.battles b where b.id=battle_id and b.status in ('waiting','ready','live','completed'))
  and (
    exists(select 1 from public.battle_participants bp
      where bp.battle_id=battle_chat_messages.battle_id
        and bp.user_profile_id=public.current_user_profile_id())
    or exists(select 1 from public.stream_sessions ss
      where ss.battle_id=battle_chat_messages.battle_id
        and ss.user_profile_id=public.current_user_profile_id()
        and ss.session_role='viewer')
  )
);
drop policy if exists "active profiles send battle chat" on public.battle_chat_messages;

create or replace function public.enforce_battle_chat_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account_status text;
  v_recent_messages int;
begin
  select account_status into v_account_status from public.user_profiles
    where id=new.user_profile_id for update;
  if not found or v_account_status<>'active' then raise exception 'Active profile required to chat'; end if;
  new.body:=btrim(new.body);
  if char_length(new.body) not between 1 and 240 then raise exception 'Chat messages must be 1 to 240 characters'; end if;
  if not exists(select 1 from public.battles where id=new.battle_id and status='live') then
    raise exception 'Chat is only available during a live battle';
  end if;
  if not exists(select 1 from public.battle_participants bp
      where bp.battle_id=new.battle_id and bp.user_profile_id=new.user_profile_id and bp.status='active')
    and not exists(select 1 from public.stream_sessions ss
      where ss.battle_id=new.battle_id and ss.user_profile_id=new.user_profile_id
        and ss.session_role='viewer' and ss.session_status='joined') then
    raise exception 'Join this battle before sending a chat message';
  end if;
  select count(*) into v_recent_messages from public.battle_chat_messages
    where user_profile_id=new.user_profile_id and created_at>now()-interval '10 seconds';
  if v_recent_messages>=5 then raise exception 'Chat rate limit exceeded'; end if;
  return new;
end;
$$;

revoke all on function public.enforce_battle_chat_rate_limit() from public, anon, authenticated;
