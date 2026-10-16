-- 202610160001: add pending/active matchmaking statuses to battles and widen discovery RLS.
-- battles: pending = created, waiting for opponent; active = matched, ready to stream.
alter table public.battles drop constraint if exists battles_status_check;
alter table public.battles add constraint battles_status_check check (status in ('waiting','ready','live','pending','active','completed','cancelled','forfeit','moderation_ended'));

-- Widen public discovery so pending and active rooms are discoverable.
drop policy if exists "battles public discovery" on public.battles;
create policy "battles public discovery" on public.battles for select using (status in ('waiting','ready','live','pending','active','completed') or created_by_profile_id = public.current_user_profile_id() or public.is_lw_admin());

-- Widen participant read so participants can see pending/active battles they joined.
drop policy if exists "battle participant read" on public.battle_participants;
create policy "battle participant read" on public.battle_participants for select using (user_profile_id = public.current_user_profile_id() or exists(select 1 from public.battles b where b.id = battle_id and b.status in ('waiting','ready','live','pending','active')) or public.is_lw_admin());
