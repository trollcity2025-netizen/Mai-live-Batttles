import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'

function log(context: Record<string, unknown>) {
  try { console.error('[confirm-battle-connection]', JSON.stringify(context)) } catch { /* structured logging best-effort */ }
}

Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  const startTime = Date.now()
  try {
    const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401)
    const {db,profile}=await requireProfile(auth)
    const {roomId,profileId}=await request.json()
    if(profileId!==profile.id||typeof roomId!=='string') { log({event:'profile_mismatch',profileId}); return json({error:'Profile mismatch'},403) }
    log({event:'request',battleId:roomId,profileId})

    const {data:battle,error:battleError}=await db.from('battles').select('id,status,format,real_duration_seconds,stream_call_id').eq('id',roomId).single()
    if(battleError||!battle) { log({event:'battle_not_found',battleId:roomId,error:battleError?.message}); return json({error:'Battle not found'},404) }
    if(!['waiting','ready','live'].includes(battle.status)) { log({event:'battle_ineligible_status',battleId:roomId,status:battle.status}); return json({error:'Battle is not accepting a connection confirmation'},404) }

    const {data:participant,error:participantError}=await db.from('battle_participants').select('id,status,stream_user_id').eq('battle_id',battle.id).eq('user_profile_id',profile.id).maybeSingle()
    if(participantError||!participant||!['ready','active'].includes(participant.status)) { log({event:'participant_not_ready',battleId:roomId,profileId,status:participant?.status}); return json({error:'Only a queued participant can confirm a broadcast connection'},403) }

    const now=new Date()
    const alreadyActive = participant.status === 'active'
    const participantUpdate: Record<string,string>={status:'active'}; if(!alreadyActive) participantUpdate.joined_at=now.toISOString()
    const {error:updateParticipantError}=await db.from('battle_participants').update(participantUpdate).eq('id',participant.id)
    if(updateParticipantError) { log({event:'participant_update_failed',battleId:roomId,profileId,error:updateParticipantError.message}); throw updateParticipantError }

    const {error:sessionError}=await db.from('stream_sessions').update({session_status:'joined',connected_at:alreadyActive ? (participant as any).joined_at || now.toISOString() : now.toISOString(),disconnected_at:null}).eq('battle_id',battle.id).eq('user_profile_id',profile.id)
    if(sessionError) { log({event:'session_update_failed',battleId:roomId,profileId,error:sessionError.message}); throw sessionError }

    const {count:activeCount}=await db.from('battle_participants').select('id',{count:'exact',head:true}).eq('battle_id',battle.id).eq('status','active')
    const {count:joinedSessionCount}=await db.from('stream_sessions').select('id',{count:'exact',head:true}).eq('battle_id',battle.id).eq('session_status','joined')
    const expectedCount=Number(battle.format[0])*2
    const connectedCount = Math.min(Number(activeCount||0), Number(joinedSessionCount||0))

    log({event:'confirmation_result',battleId:roomId,profileId,activeCount,joinedSessionCount,connectedCount,expectedCount,alreadyActive,battleStatus:battle.status})

    if((connectedCount||0)>=expectedCount&&battle.status!=='live') {
      const endAt=new Date(now.getTime()+Number(battle.real_duration_seconds)*1000)
      const {data:started,error:startError}=await db.from('battles').update({status:'live',started_at:now.toISOString(),scheduled_end_at:endAt.toISOString()}).eq('id',battle.id).in('status',['waiting','ready']).select('id').maybeSingle()
      if(startError) { log({event:'live_transition_failed',battleId:roomId,error:startError.message}); throw startError }
      if(started) {
        await db.from('battle_events').insert({battle_id:battle.id,event_type:'timer_started',payload:{started_at:now.toISOString(),scheduled_end_at:endAt.toISOString(),connectedCount,expectedCount},idempotency_key:`timer-start:${battle.id}`})
        log({event:'battle_live',battleId:roomId,startedAt:now.toISOString(),connectedCount,expectedCount,elapsedMs:Date.now()-startTime})
      } else {
        log({event:'battle_already_live',battleId:roomId})
      }
    } else if ((connectedCount||0)>=expectedCount && battle.status === 'live') {
      log({event:'battle_already_live_skip',battleId:roomId,connectedCount,expectedCount})
    } else {
      log({event:'waiting_for_more',battleId:roomId,connectedCount,expectedCount})
    }

    return json({status:'connected',battleStatus:battle.status,activeParticipants:activeCount||0,joinedSessions:joinedSessionCount||0,connectedCount,requiredParticipants:expectedCount,alreadyActive})
  }catch(error){const message=errorMessage(error);log({event:'error',error:message});return json({error:message},400)}
})
