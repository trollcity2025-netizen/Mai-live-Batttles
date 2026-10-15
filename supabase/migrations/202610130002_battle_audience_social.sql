create table if not exists public.user_blocks (
  blocker_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  blocked_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_profile_id, blocked_profile_id),
  check (blocker_profile_id <> blocked_profile_id)
);

alter table public.user_blocks enable row level security;
create policy "users read own blocks" on public.user_blocks
  for select using (blocker_profile_id = public.current_user_profile_id());
create policy "users create own blocks" on public.user_blocks
  for insert with check (blocker_profile_id = public.current_user_profile_id());
create policy "users remove own blocks" on public.user_blocks
  for delete using (blocker_profile_id = public.current_user_profile_id());

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  user_b_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_a_profile_id, user_b_profile_id),
  check (user_a_profile_id < user_b_profile_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages(conversation_id, created_at desc);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

create policy "conversation participants read" on public.direct_conversations
  for select using (
    public.current_user_profile_id() in (user_a_profile_id, user_b_profile_id)
  );
create policy "unblocked conversation messages read" on public.direct_messages
  for select using (
    exists (
      select 1 from public.direct_conversations c
      where c.id = conversation_id
        and public.current_user_profile_id() in (c.user_a_profile_id, c.user_b_profile_id)
        and not exists (
          select 1 from public.user_blocks b
          where (b.blocker_profile_id = c.user_a_profile_id and b.blocked_profile_id = c.user_b_profile_id)
             or (b.blocker_profile_id = c.user_b_profile_id and b.blocked_profile_id = c.user_a_profile_id)
        )
    )
  );
create policy "unblocked conversation participants send messages" on public.direct_messages
  for insert with check (
    sender_profile_id = public.current_user_profile_id()
    and exists (
      select 1 from public.direct_conversations c
      where c.id = conversation_id
        and public.current_user_profile_id() in (c.user_a_profile_id, c.user_b_profile_id)
        and not exists (
          select 1 from public.user_blocks b
          where (b.blocker_profile_id = c.user_a_profile_id and b.blocked_profile_id = c.user_b_profile_id)
             or (b.blocker_profile_id = c.user_b_profile_id and b.blocked_profile_id = c.user_a_profile_id)
        )
    )
  );

alter table public.user_reports
  add column if not exists ai_triage_status text not null default 'pending'
    check (ai_triage_status in ('pending','completed','unavailable')),
  add column if not exists ai_triage_category text,
  add column if not exists ai_triage_confidence numeric(5,4)
    check (ai_triage_confidence between 0 and 1),
  add column if not exists ai_triage_summary text;

do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end $$;
