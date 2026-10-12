-- 015: trusted RPC execution is available to service_role only; never grant these to app users.
grant execute on function public.apply_verified_purchase(uuid,text,text) to service_role;
grant execute on function public.request_creator_cashout(uuid,bigint,text) to service_role;
grant execute on function public.finalize_battle(uuid,text,text) to service_role;
grant execute on function public.remove_moderated_participant(uuid,uuid,uuid,text) to service_role;
grant execute on function public.review_cashout_request(uuid,uuid,text,text) to service_role;
grant execute on function public.join_or_create_battle(uuid,text,text,char) to service_role;
grant execute on function public.send_battle_gift(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.join_existing_battle(uuid,uuid,char) to service_role;
grant execute on function public.settle_cashout_payout(uuid,text,text) to service_role;
