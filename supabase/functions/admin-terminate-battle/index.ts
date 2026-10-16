import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); const {db,profile}=await requireAdmin(auth); const {battleId,reason}=await request.json(); if(typeof battleId!=='string') return json({error:'Battle ID required'},400)
    const {data:battle,error}=await db.from('battles').select('id,status').eq('id',battleId).single(); if(error||!battle) return json({error:'Battle not found'},404); if(!['live','waiting','ready','pending','active'].includes(battle.status)) return json({error:'Battle is already closed'},409)
    const {error:updateError}=await db.from('battles').update({status:'moderation_ended',result_reason:typeof reason==='string'?reason:'Admin safety intervention',ended_at:new Date().toISOString()}).eq('id',battleId); if(updateError) throw updateError
    await db.from('battle_participants').update({status:'completed',left_at:new Date().toISOString(),removal_reason:'admin_terminated'}).eq('battle_id',battleId).in('status',['active','ready','invited'])
    await db.from('stream_sessions').update({session_status:'left',disconnected_at:new Date().toISOString()}).eq('battle_id',battleId).in('session_status',['created','joined'])
    await db.from('battle_events').insert({battle_id:battleId,event_type:'battle_cancelled',payload:{reason:reason||'Admin safety intervention',admin_profile_id:profile.id},idempotency_key:`admin-terminate:${battleId}`})
    await db.from('admin_audit_logs').insert({admin_profile_id:profile.id,action:'battle_terminated',target_type:'battle',target_id:battleId,reason:reason||null})
    return json({status:'moderation_ended'})
  }catch(error){return json({error:errorMessage(error)},400)}
})
