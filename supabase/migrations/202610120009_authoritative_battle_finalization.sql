-- 009: idempotent authoritative result finalization and competitive rating updates.
create or replace function public.finalize_battle(p_battle_id uuid, p_winner_team text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_battle public.battles%rowtype; v_inserted int;
begin
  select * into v_battle from public.battles where id=p_battle_id for update;
  if not found then raise exception 'Battle not found'; end if;
  if exists(select 1 from public.battle_events where idempotency_key='finalize:'||p_battle_id::text) then
    return jsonb_build_object('status',v_battle.status,'alreadyFinalized',true,'winner',v_battle.winner_team);
  end if;
  if v_battle.status in ('completed','forfeit','moderation_ended','cancelled') then return jsonb_build_object('status',v_battle.status,'alreadyFinalized',true); end if;
  if p_winner_team not in ('A','B','tie') then raise exception 'Invalid winner'; end if;
  if p_reason='timer_elapsed' and (v_battle.scheduled_end_at is null or now()<v_battle.scheduled_end_at) then raise exception 'Battle timer has not elapsed'; end if;
  update public.battles set status=case when p_reason in ('moderation_forfeit','team_forfeit','participant_forfeit') then 'forfeit' else 'completed' end,winner_team=p_winner_team,result_reason=p_reason,ended_at=now(),updated_at=now() where id=p_battle_id;
  insert into public.battle_events(battle_id,event_type,team,payload,idempotency_key) values(p_battle_id,case when p_reason in ('moderation_forfeit','team_forfeit','participant_forfeit') then 'battle_forfeit' else 'battle_completed' end,p_winner_team,jsonb_build_object('reason',p_reason,'score_a',v_battle.team_a_score,'score_b',v_battle.team_b_score),'finalize:'||p_battle_id::text) on conflict(idempotency_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    insert into public.battle_ratings(user_profile_id) select user_profile_id from public.battle_participants where battle_id=p_battle_id on conflict(user_profile_id) do nothing;
    update public.battle_ratings r set
      wins = r.wins + case when bp.team=p_winner_team and p_winner_team<>'tie' and bp.status<>'removed' then 1 else 0 end,
      losses = r.losses + case when bp.team<>p_winner_team and p_winner_team<>'tie' then 1 else 0 end,
      ties = r.ties + case when p_winner_team='tie' then 1 else 0 end,
      rating = greatest(100, r.rating + case when p_winner_team='tie' then 0 when bp.team=p_winner_team and bp.status<>'removed' then 25 else -20 end),
      streak = case when p_winner_team='tie' then 0 when bp.team=p_winner_team and bp.status<>'removed' then r.streak+1 else 0 end,
      best_streak = greatest(r.best_streak, case when p_winner_team=bp.team and bp.status<>'removed' then r.streak+1 else r.best_streak end),
      updated_at=now()
    from public.battle_participants bp where bp.battle_id=p_battle_id and bp.user_profile_id=r.user_profile_id;
  end if;
  update public.battle_participants set status='completed',left_at=coalesce(left_at,now()) where battle_id=p_battle_id and status in ('active','ready','invited');
  return jsonb_build_object('status','finalized','winner',p_winner_team,'reason',p_reason);
end; $$;
revoke all on function public.finalize_battle(uuid,text,text) from public, anon, authenticated;
