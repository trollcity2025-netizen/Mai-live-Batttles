import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); const {db,profile}=await requireProfile(auth); const {battleId}=await request.json(); if(typeof battleId!=='string') return json({error:'Battle ID required'},400)
    const {data:battle,error}=await db.from('battles').select('id,status,team_a_score,team_b_score,scheduled_end_at').eq('id',battleId).single(); if(error||!battle) return json({error:'Battle not found'},404)
    const {data:participant}=await db.from('battle_participants').select('id').eq('battle_id',battleId).eq('user_profile_id',profile.id).maybeSingle(); if(!participant&&profile.role!=='admin') return json({error:'Battle participant access required'},403)
    if(battle.status!=='live') return json({status:battle.status})
    if(!battle.scheduled_end_at||new Date(battle.scheduled_end_at).getTime()>Date.now()) return json({error:'Battle timer has not elapsed'},409)
    const winner=battle.team_a_score===battle.team_b_score?'tie':battle.team_a_score>battle.team_b_score?'A':'B'
    const {data,error:finalizeError}=await db.rpc('finalize_battle',{p_battle_id:battleId,p_winner_team:winner,p_reason:'timer_elapsed'}); if(finalizeError) throw finalizeError
    return json(data)
  }catch(error){return json({error:errorMessage(error)},400)}
})
