import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try {
    const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401)
    const {db,profile}=await requireProfile(auth); const {roomId,profileId}=await request.json()
    if(profileId!==profile.id||typeof roomId!=='string') return json({error:'Profile mismatch'},403)
    const {data:battle,error:battleError}=await db.from('battles').select('id,status,format,real_duration_seconds,stream_call_id').eq('id',roomId).single()
    if(battleError||!battle||!['waiting','ready','live'].includes(battle.status)) return json({error:'Battle is not accepting a connection confirmation'},404)
    const {data:participant,error:participantError}=await db.from('battle_participants').select('id,status').eq('battle_id',battle.id).eq('user_profile_id',profile.id).maybeSingle()
    if(participantError||!participant||!['ready','active'].includes(participant.status)) return json({error:'Only a queued participant can confirm a broadcast connection'},403)
    const now=new Date()
    const participantUpdate: Record<string,string>={status:'active'}; if(participant.status!=='active') participantUpdate.joined_at=now.toISOString()
    const {error:updateParticipantError}=await db.from('battle_participants').update(participantUpdate).eq('id',participant.id)
    if(updateParticipantError) throw updateParticipantError
    const {error:sessionError}=await db.from('stream_sessions').update({session_status:'joined',connected_at:now.toISOString()}).eq('battle_id',battle.id).eq('user_profile_id',profile.id)
    if(sessionError) throw sessionError
    const {count:activeCount}=await db.from('battle_participants').select('id',{count:'exact',head:true}).eq('battle_id',battle.id).eq('status','active')
    const expectedCount=Number(battle.format[0])*2
    if((activeCount||0)>=expectedCount&&battle.status!=='live') {
      const endAt=new Date(now.getTime()+Number(battle.real_duration_seconds)*1000)
      const {data:started,error:startError}=await db.from('battles').update({status:'live',started_at:now.toISOString(),scheduled_end_at:endAt.toISOString()}).eq('id',battle.id).in('status',['waiting','ready']).select('id').maybeSingle()
      if(startError) throw startError
      if(started) await db.from('battle_events').insert({battle_id:battle.id,event_type:'timer_started',payload:{started_at:now.toISOString(),scheduled_end_at:endAt.toISOString()},idempotency_key:`timer-start:${battle.id}`})
    }
    return json({status:'connected',battleStatus:battle.status,activeParticipants:activeCount||0,requiredParticipants:expectedCount})
  }catch(error){return json({error:errorMessage(error)},400)}
})
