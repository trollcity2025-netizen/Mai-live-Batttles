import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); const {db,profile}=await requireProfile(auth); const {battleId,giftKey}=await request.json(); if(typeof battleId!=='string'||typeof giftKey!=='string') return json({error:'Battle and gift are required'},400)
    const {data:battle,error:battleError}=await db.from('battles').select('team_a_score,team_b_score,status').eq('id',battleId).single(); if(battleError||!battle||battle.status!=='live') return json({error:'Battle is not live'},409)
    const {data:sender}=await db.from('battle_participants').select('team').eq('battle_id',battleId).eq('user_profile_id',profile.id).eq('status','active').maybeSingle()
    const otherTeam=sender ? (sender.team==='A'?'B':'A') : (Number(battle.team_a_score)<=Number(battle.team_b_score)?'A':'B')
    const {data:recipient,error:recipientError}=await db.from('battle_participants').select('user_profile_id').eq('battle_id',battleId).eq('team',otherTeam).eq('status','active').neq('user_profile_id',profile.id).order('joined_at',{ascending:true}).limit(1).maybeSingle(); if(recipientError||!recipient) return json({error:'No active participant is available to receive this gift'},409)
    const {data,error}=await db.rpc('send_battle_gift',{p_battle_id:battleId,p_sender_profile_id:profile.id,p_recipient_profile_id:recipient.user_profile_id,p_gift_key:giftKey,p_idempotency_key:crypto.randomUUID()}); if(error) throw error
    return json(data)
  }catch(error){return json({error:errorMessage(error)},400)}
})
