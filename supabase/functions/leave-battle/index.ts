import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try {
    const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401)
    const {db,profile}=await requireProfile(auth); const {battleId}=await request.json(); if(typeof battleId!=='string') return json({error:'Battle ID required'},400)
    const {data:battle,error:battleError}=await db.from('battles').select('id,status,format,created_by_profile_id').eq('id',battleId).single(); if(battleError||!battle) return json({error:'Battle not found'},404)
    const {data:participant}=await db.from('battle_participants').select('id,team,status').eq('battle_id',battleId).eq('user_profile_id',profile.id).maybeSingle()
    if(!participant) { await db.from('stream_sessions').update({session_status:'left',disconnected_at:new Date().toISOString()}).eq('battle_id',battleId).eq('user_profile_id',profile.id).eq('session_role','viewer'); const {count:viewers}=await db.from('stream_sessions').select('id',{count:'exact',head:true}).eq('battle_id',battleId).eq('session_role','viewer').eq('session_status','joined'); await db.from('battles').update({viewer_count:viewers||0}).eq('id',battleId); return json({status:'viewer_left'}) }
    if(['completed','forfeit','moderation_ended','cancelled'].includes(battle.status)) return json({status:battle.status})
    await db.from('battle_participants').update({status:'left',left_at:new Date().toISOString(),removal_reason:'voluntary_leave'}).eq('id',participant.id)
    await db.from('stream_sessions').update({session_status:'left',disconnected_at:new Date().toISOString()}).eq('battle_id',battleId).eq('user_profile_id',profile.id)
    const {error:eventError}=await db.from('battle_events').insert({battle_id:battleId,user_profile_id:profile.id,event_type:'participant_left',team:participant.team,payload:{reason:'voluntary_leave'},idempotency_key:`participant-left:${battleId}:${profile.id}`}); if(eventError&&eventError.code!=='23505') throw eventError
    if(battle.status==='waiting') {
      const {count}=await db.from('battle_participants').select('id',{count:'exact',head:true}).eq('battle_id',battleId).in('status',['active','ready'])
      if(!count) await db.from('battles').update({status:'cancelled',result_reason:'all_participants_left',ended_at:new Date().toISOString()}).eq('id',battleId).eq('status','waiting')
      return json({status:'left_waiting_battle'})
    }
    const {count:activeA}=await db.from('battle_participants').select('id',{count:'exact',head:true}).eq('battle_id',battleId).eq('team','A').in('status',['active','ready'])
    const {count:activeB}=await db.from('battle_participants').select('id',{count:'exact',head:true}).eq('battle_id',battleId).eq('team','B').in('status',['active','ready'])
    if(!activeA&&!activeB) { const {error}=await db.rpc('finalize_battle',{p_battle_id:battleId,p_winner_team:'tie',p_reason:'all_participants_left'}); if(error) throw error; return json({status:'left_battle_tied'}) }
    if(!activeA) { const {error}=await db.rpc('finalize_battle',{p_battle_id:battleId,p_winner_team:'B',p_reason:'participant_forfeit'}); if(error) throw error; return json({status:'left_battle_forfeit',winner:'B'}) }
    if(!activeB) { const {error}=await db.rpc('finalize_battle',{p_battle_id:battleId,p_winner_team:'A',p_reason:'participant_forfeit'}); if(error) throw error; return json({status:'left_battle_forfeit',winner:'A'}) }
    return json({status:'participant_left_battle_continues'})
  }catch(error){return json({error:errorMessage(error)},400)}
})
