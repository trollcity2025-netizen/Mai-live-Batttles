-- 001: Mai Live Wars identity, profile, consent, and account foundations.
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_path text,
  avatar_url text,
  bio text,
  gender text check (gender in ('male', 'female', 'prefer_not_to_say')),
  city text,
  state_code char(2),
  role text not null default 'user' check (role in ('user', 'admin')),
  profile_complete boolean not null default false,
  marketing_recording_consent boolean not null default false,
  marketing_recording_consent_at timestamptz,
  account_status text not null default 'active' check (account_status in ('active', 'restricted', 'deletion_requested', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_username_length check (char_length(username) between 3 and 20),
  constraint user_profiles_display_name_length check (char_length(display_name) between 1 and 40)
);
create unique index if not exists user_profiles_username_lower_uidx on public.user_profiles (lower(username));
create index if not exists user_profiles_state_idx on public.user_profiles (state_code);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();

create or replace function public.current_user_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.user_profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_lw_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin' and account_status = 'active');
$$;

alter table public.user_profiles enable row level security;
drop policy if exists "profiles public readable" on public.user_profiles;
create policy "profiles public readable" on public.user_profiles for select using (profile_complete = true or user_id = auth.uid() or public.is_lw_admin());
drop policy if exists "profile owner insert" on public.user_profiles;
create policy "profile owner insert" on public.user_profiles for insert with check (user_id = auth.uid() and role = 'user');
drop policy if exists "profile owner update" on public.user_profiles;
create policy "profile owner update" on public.user_profiles for update using (user_id = auth.uid() or public.is_lw_admin()) with check ((user_id = auth.uid() and role = 'user') or public.is_lw_admin());

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  community_guidelines_version text not null,
  accepted_at timestamptz not null default now(),
  marketing_recording_consent boolean not null default false,
  recording_consent_version text,
  recording_consent_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists consent_records_profile_idx on public.consent_records(user_profile_id, created_at desc);
alter table public.consent_records enable row level security;
create policy "consent records owner read" on public.consent_records for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
create policy "consent records owner insert" on public.consent_records for insert with check (user_profile_id = public.current_user_profile_id());

create table if not exists public.follows (
  follower_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  followed_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_profile_id, followed_profile_id),
  check (follower_profile_id <> followed_profile_id)
);
alter table public.follows enable row level security;
create policy "follows visible" on public.follows for select using (true);
create policy "follows owner manages" on public.follows for insert with check (follower_profile_id = public.current_user_profile_id());
create policy "follows owner deletes" on public.follows for delete using (follower_profile_id = public.current_user_profile_id());
