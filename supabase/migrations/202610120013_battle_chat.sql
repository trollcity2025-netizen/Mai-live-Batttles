-- 013: authenticated, realtime battle chat.
create table if not exists public.battle_chat_messages (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now()
);
create index if not exists battle_chat_messages_battle_idx on public.battle_chat_messages(battle_id,created_at desc);
alter table public.battle_chat_messages enable row level security;
create policy "authenticated profiles read live battle chat" on public.battle_chat_messages for select using (
  exists(select 1 from public.battles b where b.id=battle_id and b.status in ('waiting','ready','live','completed'))
  and exists(select 1 from public.user_profiles p where p.user_id=auth.uid() and p.profile_complete=true and p.account_status='active')
);
create policy "active profiles send battle chat" on public.battle_chat_messages for insert with check (
  user_profile_id=public.current_user_profile_id()
  and exists(select 1 from public.battles b where b.id=battle_id and b.status='live')
  and char_length(body) between 1 and 240
);
-- Enable the table for Supabase Realtime if the publication is present.
do $$ begin
  alter publication supabase_realtime add table public.battle_chat_messages;
exception when duplicate_object then null; when undefined_object then null;
end $$;
