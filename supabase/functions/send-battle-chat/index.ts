import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
import { moderateSafetyText, moderationModelName } from '../_shared/moderation.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authorization required' }, 401)

    const { db, profile } = await requireProfile(authorization)
    const { data: safetyState, error: safetyError } = await db.from('account_safety_state')
      .select('chat_restricted_until,is_banned').eq('user_profile_id', profile.id).maybeSingle()
    if (safetyError) throw safetyError
    if (safetyState?.is_banned) return json({ error: 'This account is banned from chat and battles' }, 403)
    if (safetyState?.chat_restricted_until && new Date(safetyState.chat_restricted_until).getTime() > Date.now()) {
      return json({
        error: 'Chat is temporarily disabled for this account',
        sanction: 'chat_timeout',
        restrictedUntil: safetyState.chat_restricted_until,
      }, 403)
    }
    const body = await request.json()
    const battleId = body?.battleId
    const message = body?.message
    const requestId = body?.requestId
    if (typeof battleId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(battleId)) {
      return json({ error: 'Valid battle ID required' }, 400)
    }
    if (typeof message !== 'string' || message.trim().length < 1 || message.trim().length > 240) {
      return json({ error: 'Chat messages must be 1 to 240 characters' }, 400)
    }
    if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(requestId)) {
      return json({ error: 'Valid chat request ID required' }, 400)
    }

    const text = message.trim()
    const [{ data: battle, error: battleError }, { data: participant, error: participantError }, { data: viewer, error: viewerError }] = await Promise.all([
      db.from('battles').select('id,status').eq('id', battleId).maybeSingle(),
      db.from('battle_participants').select('id').eq('battle_id', battleId).eq('user_profile_id', profile.id).eq('status', 'active').maybeSingle(),
      db.from('stream_sessions').select('id').eq('battle_id', battleId).eq('user_profile_id', profile.id).eq('session_role', 'viewer').eq('session_status', 'joined').maybeSingle(),
    ])
    if (battleError) throw battleError
    if (participantError) throw participantError
    if (viewerError) throw viewerError
    if (!battle || battle.status !== 'live') return json({ error: 'Chat is only available during a live battle' }, 409)
    if (!participant && !viewer) return json({ error: 'Join this battle before sending a chat message' }, 403)

    const { error: rateLimitError } = await db.rpc('claim_battle_chat_moderation_slot', {
      p_profile_id: profile.id,
      p_battle_id: battleId,
    })
    if (rateLimitError) {
      if (rateLimitError.message.includes('rate limit')) return json({ error: 'You are sending messages too quickly' }, 429)
      throw rateLimitError
    }

    const decision = await moderateSafetyText(text)
    if (decision.category) {
      const sourceEventKey = `chat:${requestId}`
      const { error: moderationLogError } = await db.from('moderation_events').insert({
        battle_id: battleId,
        user_profile_id: profile.id,
        category: decision.category,
        summary: 'Battle chat message blocked by automated text safety review.',
        confidence: decision.confidence,
        model_name: moderationModelName(),
        transcript_excerpt: text.slice(0, 240),
        source_event_key: sourceEventKey,
        enforcement_action: 'account_restricted',
        review_status: 'pending',
        retention_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      if (moderationLogError && !moderationLogError.message.includes('duplicate key')) throw moderationLogError
      const { data: event, error: eventError } = await db.from('moderation_events')
        .select('id,confidence').eq('source_event_key', sourceEventKey).single()
      if (eventError) throw eventError
      const { data: sanction, error: sanctionError } = await db.rpc('apply_account_safety_offense', {
        p_profile_id: profile.id,
        p_moderation_event_id: event.id,
        p_source_event_key: sourceEventKey,
        p_category: decision.category,
        p_confidence: event.confidence,
      })
      if (sanctionError) throw sanctionError
      return json({
        blocked: true,
        notice: sanction.action === 'warning'
          ? 'Message blocked. This is a safety warning; a third confirmed violation results in an account ban.'
          : sanction.action === 'chat_timeout'
            ? 'Message blocked. Chat is disabled across battles and viewing for 30 seconds.'
            : 'Message blocked. This account has been banned after three confirmed safety violations.',
        enforcement: sanction,
      })
    }

    const { data: savedMessage, error: insertError } = await db
      .from('battle_chat_messages')
      .insert({ battle_id: battleId, user_profile_id: profile.id, body: text })
      .select('id,body,created_at')
      .single()
    if (insertError) {
      if (insertError.message.includes('rate limit')) return json({ error: 'You are sending messages too quickly' }, 429)
      throw insertError
    }
    return json({ blocked: false, message: savedMessage })
  } catch (error) {
    const message = errorMessage(error)
    const status = message === 'Unauthorized' ? 401
      : message.includes('Active user profile required') || message.includes('Account safety restriction') ? 403
        : message.includes('rate limit') ? 429
          : message.includes('moderation') || message.includes('provider failed') ? 503 : 400
    return json({ error: message }, status)
  }
})
