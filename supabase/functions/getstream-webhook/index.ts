import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabase.ts'
import { moderateSafetyText, moderationModelName } from '../_shared/moderation.ts'

function hex(bytes: Uint8Array) { return [...bytes].map((value) => value.toString(16).padStart(2,'0')).join('') }
async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))))
}
function safeEqual(a: string, b: string) { if (a.length !== b.length) return false; let diff = 0; for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff===0 }
async function markWebhookProcessed(db: ReturnType<typeof adminClient>, eventRowId: string) {
  const { error } = await db.from('getstream_webhook_events').update({
    processed: true,
    processed_at: new Date().toISOString(),
  }).eq('id', eventRowId)
  if (error) throw error
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const raw = await request.text(); const secret = Deno.env.get('GETSTREAM_API_SECRET'); if (!secret) return json({error:'GetStream webhook secret is not configured'},503)
    const supplied = request.headers.get('x-signature') || request.headers.get('x-stream-signature') || ''
    const expected = await hmacHex(secret, raw)
    if (!supplied || !safeEqual(supplied.toLowerCase().replace(/^sha256=/,''), expected)) return json({error:'Invalid GetStream webhook signature'},401)
    const event = JSON.parse(raw); const type = String(event.type || event.event_type || 'unknown'); const eventId = String(event.id || event.event_id || event.created_at && `${type}:${event.created_at}:${event.call_cid || ''}` || '')
    if (!eventId) return json({error:'Webhook event ID is required'},400)
    const db = adminClient(); const callCid = String(event.call_cid || event.call?.cid || event.call?.id || '')
    const callId = callCid.includes(':') ? callCid.split(':').slice(1).join(':') : callCid
    const userId = String(event.user?.id || event.transcription?.user_id || event.participant?.user_id || '')
    const caption = String(event.transcription?.text || event.text || event.caption?.text || event.call?.transcription?.text || '').trim()
    const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))))
    const { data: existing } = await db.from('getstream_webhook_events').select('id,processed').eq('provider_event_id',eventId).maybeSingle()
    if (existing?.processed) return json({status:'already_processed'})
    const { data: stored, error: storeError } = await db.from('getstream_webhook_events').upsert({provider_event_id:eventId,event_type:type,call_id:callId||null,user_profile_id:userId||null,payload_hash:digest,processed:false},{onConflict:'provider_event_id'}).select('id').single()
    if (storeError) throw storeError
    const lowerType=type.toLowerCase()
    if (callId && userId && (lowerType.includes('participant_left') || lowerType.includes('session_ended'))) {
      const {data:battle}=await db.from('battles').select('id').eq('stream_call_id',callId).maybeSingle()
      if(battle) {
        const {data:session}=await db.from('stream_sessions').select('session_role').eq('battle_id',battle.id).eq('user_profile_id',userId).maybeSingle()
        if(session?.session_role==='viewer') {
          await db.from('stream_sessions').update({session_status:'left',disconnected_at:new Date().toISOString()}).eq('battle_id',battle.id).eq('user_profile_id',userId)
          const {count:viewers}=await db.from('stream_sessions').select('id',{count:'exact',head:true}).eq('battle_id',battle.id).eq('session_role','viewer').eq('session_status','joined')
          await db.from('battles').update({viewer_count:viewers||0}).eq('id',battle.id)
        }
      }
      await markWebhookProcessed(db, stored.id)
      return json({status:'acknowledged',session:'left'})
    }
    if (!lowerType.includes('transcription') || !caption || !callId || !userId) {
      await markWebhookProcessed(db, stored.id)
      return json({status:'acknowledged',moderation:'not_applicable'})
    }
    const { data: battle } = await db.from('battles').select('id,status,format').eq('stream_call_id',callId).maybeSingle()
    if (!battle || battle.status !== 'live') {
      await markWebhookProcessed(db, stored.id)
      return json({status:'acknowledged',moderation:'battle_not_live'})
    }
    const { data: participant } = await db.from('battle_participants').select('id,team,status').eq('battle_id',battle.id).eq('user_profile_id',userId).maybeSingle()
    if (!participant || participant.status !== 'active') {
      await markWebhookProcessed(db, stored.id)
      return json({status:'acknowledged',moderation:'speaker_not_active'})
    }
    const result = await moderateSafetyText(caption)
    if (!result.category) {
      await db.from('getstream_webhook_events').update({processed:true,processed_at:new Date().toISOString()}).eq('id',stored.id)
      return json({status:'processed',flagged:false})
    }
    const sourceEventKey = `voice:${eventId}`
    const { data: moderation, error: moderationError } = await db.from('moderation_events').upsert({
      battle_id:battle.id,user_profile_id:userId,category:result.category,
      summary:'Sensitive moderation details restricted to authorized review.',
      confidence:result.confidence,model_name:moderationModelName(),
      transcript_excerpt:caption.slice(0,500),speaker_attribution_confidence:0.98,
      source_event_key:sourceEventKey,enforcement_action:'account_restricted',review_status:'pending',
      retention_expires_at:new Date(Date.now()+30*24*60*60*1000).toISOString(),
    },{onConflict:'source_event_key'}).select('id,confidence').single()
    if (moderationError) throw moderationError
    const { data: action, error: actionError } = await db.rpc('apply_account_safety_offense',{
      p_profile_id:userId,p_moderation_event_id:moderation.id,p_source_event_key:sourceEventKey,
      p_category:result.category,p_confidence:moderation.confidence,
    })
    if (actionError) throw actionError
    await markWebhookProcessed(db, stored.id)
    return json({status:'processed',flagged:true,category:result.category,enforcement:action?.action})
  } catch (error) {
    const message = errorMessage(error)
    const status = message.includes('moderation') || message.includes('provider failed') ? 503 : 400
    return json({error:message},status)
  }
})
