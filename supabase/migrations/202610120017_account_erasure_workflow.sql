-- 017: staged account erasure while retaining anonymized financial/audit records where required.
alter table public.user_profiles drop constraint if exists user_profiles_user_id_fkey;
alter table public.user_profiles alter column user_id drop not null;
alter table public.user_profiles add constraint user_profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.account_deletion_requests add column if not exists auth_user_id uuid;
create index if not exists account_deletion_requests_queue_idx on public.account_deletion_requests(status,requested_at);
