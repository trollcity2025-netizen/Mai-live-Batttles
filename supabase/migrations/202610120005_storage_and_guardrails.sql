-- 005: storage bucket, helper indexes, public views, and account safety defaults.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars','profile-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar owner uploads own folder" on storage.objects;
create policy "avatar owner uploads own folder" on storage.objects for insert to authenticated with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar owner updates own folder" on storage.objects;
create policy "avatar owner updates own folder" on storage.objects for update to authenticated using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar public reads" on storage.objects;
create policy "avatar public reads" on storage.objects for select using (bucket_id = 'profile-avatars');
drop policy if exists "avatar owner deletes own folder" on storage.objects;
create policy "avatar owner deletes own folder" on storage.objects for delete to authenticated using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace view public.public_fighter_profiles with (security_invoker = true) as
select id, username, display_name, avatar_url, bio, gender, city, state_code, created_at
from public.user_profiles
where profile_complete = true and account_status = 'active';

-- Keep app roles limited to exactly user/admin. This trigger blocks privilege escalation from clients.
create or replace function public.enforce_user_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_lw_admin() then
    if tg_op = 'INSERT' then new.role := 'user';
    elsif new.role is distinct from old.role then raise exception 'Only an administrator can change account roles';
    end if;
  end if;
  if new.role not in ('user','admin') then raise exception 'Invalid role'; end if;
  return new;
end;
$$;
drop trigger if exists user_profiles_enforce_role on public.user_profiles;
create trigger user_profiles_enforce_role before insert or update of role on public.user_profiles for each row execute function public.enforce_user_profile_role();
