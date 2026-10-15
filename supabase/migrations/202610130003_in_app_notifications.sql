create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  actor_profile_id uuid references public.user_profiles(id) on delete set null,
  kind text not null check (kind in (
    'new_follower',
    'cashout_requested',
    'cashout_status',
    'bullet_purchase',
    'gift_received',
    'battle_invitation',
    'battle_user_joined'
  )),
  title text not null,
  body text not null,
  href text not null default '/',
  data jsonb not null default '{}'::jsonb,
  event_key text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists user_notifications_inbox_idx
  on public.user_notifications(user_profile_id, created_at desc);
create index if not exists user_notifications_unread_idx
  on public.user_notifications(user_profile_id, created_at desc)
  where read_at is null;

alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from anon, authenticated;
grant select, update (read_at) on public.user_notifications to authenticated;
create policy "users read own notifications" on public.user_notifications
  for select using (user_profile_id = public.current_user_profile_id());
create policy "users mark own notifications read" on public.user_notifications
  for update using (user_profile_id = public.current_user_profile_id())
  with check (user_profile_id = public.current_user_profile_id());

create or replace function public.create_user_notification(
  p_user_profile_id uuid,
  p_actor_profile_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_href text,
  p_data jsonb,
  p_event_key text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_notifications(
    user_profile_id, actor_profile_id, kind, title, body, href, data, event_key
  )
  values (
    p_user_profile_id, p_actor_profile_id, p_kind, p_title, p_body,
    p_href, coalesce(p_data, '{}'::jsonb), p_event_key
  )
  on conflict (event_key) do nothing;
$$;
revoke all on function public.create_user_notification(uuid,uuid,text,text,text,text,jsonb,text)
  from public, anon, authenticated;

create or replace function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
begin
  select display_name into v_actor_name
  from public.user_profiles where id = new.follower_profile_id;

  perform public.create_user_notification(
    new.followed_profile_id,
    new.follower_profile_id,
    'new_follower',
    'New follower',
    coalesce(v_actor_name, 'Someone') || ' started following you.',
    '/profile',
    jsonb_build_object('followerProfileId', new.follower_profile_id),
    'follow:' || new.follower_profile_id::text || ':' ||
      new.followed_profile_id::text || ':' ||
      to_char(new.created_at at time zone 'UTC', 'YYYYMMDDHH24MISSUS')
  );
  return new;
end;
$$;

create trigger follows_notify_new_follower
after insert on public.follows
for each row execute function public.notify_new_follower();

create or replace function public.notify_cashout_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_admin record;
begin
  select display_name into v_display_name
  from public.user_profiles where id = new.user_profile_id;

  perform public.create_user_notification(
    new.user_profile_id, null, 'cashout_requested', 'Cashout requested',
    'Your request for $' || to_char(new.amount_usd, 'FM999999990.00') ||
      ' is awaiting review.',
    '/profile',
    jsonb_build_object('cashoutRequestId', new.id, 'amountUsd', new.amount_usd),
    'cashout-requested:' || new.id::text
  );

  for v_admin in
    select id from public.user_profiles
    where role = 'admin' and account_status = 'active'
  loop
    perform public.create_user_notification(
      v_admin.id, new.user_profile_id, 'cashout_requested',
      'New cashout request',
      coalesce(v_display_name, 'A user') || ' requested $' ||
        to_char(new.amount_usd, 'FM999999990.00') || ' in cashout.',
      '/admin',
      jsonb_build_object('cashoutRequestId', new.id, 'amountUsd', new.amount_usd),
      'admin-cashout-requested:' || new.id::text || ':' || v_admin.id::text
    );
  end loop;
  return new;
end;
$$;

create trigger cashout_requests_notify_insert
after insert on public.cashout_requests
for each row execute function public.notify_cashout_requested();

create or replace function public.notify_cashout_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_label text;
begin
  if old.status is not distinct from new.status then return new; end if;
  v_status_label := case new.status
    when 'approved' then 'approved'
    when 'processing' then 'being processed'
    when 'paid' then 'paid'
    when 'rejected' then 'rejected'
    when 'failed' then 'failed'
    when 'cancelled' then 'cancelled'
    else new.status
  end;

  perform public.create_user_notification(
    new.user_profile_id, new.reviewed_by_profile_id, 'cashout_status',
    'Cashout ' || v_status_label,
    'Your cashout request for $' ||
      to_char(new.amount_usd, 'FM999999990.00') || ' is ' || v_status_label || '.',
    '/profile',
    jsonb_build_object('cashoutRequestId', new.id, 'status', new.status, 'amountUsd', new.amount_usd),
    'cashout-status:' || new.id::text || ':' || new.status
  );
  return new;
end;
$$;

create trigger cashout_requests_notify_status
after update of status on public.cashout_requests
for each row execute function public.notify_cashout_status();

create or replace function public.notify_bullet_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'credited' or new.status <> 'credited' then return new; end if;
  perform public.create_user_notification(
    new.user_profile_id, null, 'bullet_purchase', 'Bullets added',
    to_char(new.bullets, 'FM999999990') || ' Bullets were added to your wallet.',
    '/profile',
    jsonb_build_object('purchaseId', new.id, 'bullets', new.bullets, 'amountUsd', new.amount_usd),
    'bullet-purchase:' || new.id::text
  );
  return new;
end;
$$;

create trigger purchase_orders_notify_credited
after update of status on public.purchase_orders
for each row execute function public.notify_bullet_purchase();

create or replace function public.notify_gift_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
  v_gift_name text;
begin
  if new.status <> 'settled' then return new; end if;
  select display_name into v_sender_name
  from public.user_profiles where id = new.sender_profile_id;
  select display_name into v_gift_name
  from public.gift_catalog where id = new.gift_id;
  perform public.create_user_notification(
    new.recipient_profile_id, new.sender_profile_id, 'gift_received',
    'You received a gift',
    coalesce(v_sender_name, 'Someone') || ' sent you ' ||
      coalesce(v_gift_name, 'a gift') || '.',
    '/battle/' || new.battle_id::text,
    jsonb_build_object('battleId', new.battle_id, 'giftTransactionId', new.id),
    'gift-received:' || new.id::text
  );
  return new;
end;
$$;

create trigger gift_transactions_notify_recipient
after insert on public.gift_transactions
for each row execute function public.notify_gift_received();

create or replace function public.notify_battle_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter_name text;
begin
  if new.status <> 'pending' then return new; end if;
  select display_name into v_inviter_name
  from public.user_profiles where id = new.inviter_profile_id;
  perform public.create_user_notification(
    new.invitee_profile_id, new.inviter_profile_id, 'battle_invitation',
    'Battle invitation',
    coalesce(v_inviter_name, 'A user') || ' invited you to a battle.',
    '/battles',
    jsonb_build_object('battleId', new.battle_id, 'invitationId', new.id, 'team', new.team),
    'battle-invitation:' || new.id::text
  );
  return new;
end;
$$;

create trigger battle_invitations_notify_invitee
after insert on public.battle_invitations
for each row execute function public.notify_battle_invitation();

create or replace function public.notify_admin_battle_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_format text;
  v_admin record;
  v_joined_at timestamptz;
begin
  if new.status <> 'active' or
     (tg_op = 'UPDATE' and old.status = 'active') then
    return new;
  end if;

  select display_name into v_actor_name
  from public.user_profiles where id = new.user_profile_id;
  select format into v_format
  from public.battles where id = new.battle_id;
  v_joined_at := coalesce(new.joined_at, new.created_at, now());

  for v_admin in
    select id from public.user_profiles
    where role = 'admin' and account_status = 'active'
  loop
    perform public.create_user_notification(
      v_admin.id, new.user_profile_id, 'battle_user_joined',
      'User joined a battle',
      coalesce(v_actor_name, 'A user') || ' joined a ' ||
        coalesce(v_format, 'live') || ' battle.',
      '/admin',
      jsonb_build_object('battleId', new.battle_id, 'participantId', new.id),
      'battle-participant-joined:' || new.id::text || ':' ||
        to_char(v_joined_at at time zone 'UTC', 'YYYYMMDDHH24MISSUS') ||
        ':' || v_admin.id::text
    );
  end loop;
  return new;
end;
$$;

create trigger battle_participants_notify_admin_join
after insert or update of status on public.battle_participants
for each row execute function public.notify_admin_battle_join();

create or replace function public.notify_admin_viewer_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_admin record;
begin
  if new.session_role <> 'viewer' or new.session_status <> 'joined' or
     (tg_op = 'UPDATE' and old.session_status = 'joined') then
    return new;
  end if;

  select display_name into v_actor_name
  from public.user_profiles where id = new.user_profile_id;
  for v_admin in
    select id from public.user_profiles
    where role = 'admin' and account_status = 'active'
  loop
    perform public.create_user_notification(
      v_admin.id, new.user_profile_id, 'battle_user_joined',
      'Viewer joined a battle',
      coalesce(v_actor_name, 'A user') || ' joined a battle as a viewer.',
      '/admin',
      jsonb_build_object('battleId', new.battle_id, 'sessionId', new.id, 'role', 'viewer'),
      'battle-viewer-joined:' || new.id::text || ':' ||
        coalesce(new.connected_at, now())::text || ':' || v_admin.id::text
    );
  end loop;
  return new;
end;
$$;

create trigger stream_sessions_notify_admin_viewer_join
after insert or update of session_status on public.stream_sessions
for each row execute function public.notify_admin_viewer_join();

do $$
begin
  alter publication supabase_realtime add table public.user_notifications;
exception when duplicate_object then null;
end $$;
