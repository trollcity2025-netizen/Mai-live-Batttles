import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { moderateSafetyText } from '../_shared/moderation.ts'
import { requireProfile } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireProfile(authorization)
    const { conversationId, body } = await request.json()
    if (typeof conversationId !== 'string' || typeof body !== 'string' || body.trim().length < 1 || body.trim().length > 1000) {
      return json({ error: 'Message must be between 1 and 1000 characters' }, 400)
    }
    const { data: conversation, error: conversationError } = await db.from('direct_conversations')
      .select('id,user_a_profile_id,user_b_profile_id')
      .eq('id', conversationId)
      .maybeSingle()
    if (conversationError) throw conversationError
    if (!conversation || ![conversation.user_a_profile_id, conversation.user_b_profile_id].includes(profile.id)) {
      return json({ error: 'Conversation not found' }, 404)
    }
    const { data: blocks, error: blockError } = await db.from('user_blocks').select('blocker_profile_id')
      .or(`and(blocker_profile_id.eq.${conversation.user_a_profile_id},blocked_profile_id.eq.${conversation.user_b_profile_id}),and(blocker_profile_id.eq.${conversation.user_b_profile_id},blocked_profile_id.eq.${conversation.user_a_profile_id})`)
      .limit(1)
    if (blockError) throw blockError
    if (blocks?.length) return json({ error: 'Messaging is unavailable because one of you blocked the other' }, 403)

    const decision = await moderateSafetyText(body.trim())
    if (decision.category) return json({ error: 'This message was blocked by the safety filter' }, 400)
    const { data: message, error: insertError } = await db.from('direct_messages')
      .insert({ conversation_id: conversationId, sender_profile_id: profile.id, body: body.trim() })
      .select('id,conversation_id,sender_profile_id,body,created_at').single()
    if (insertError) throw insertError
    await db.from('direct_conversations').update({ updated_at: message.created_at }).eq('id', conversationId)
    return json({ message })
  } catch (error) {
    const message = errorMessage(error)
    const status = message === 'Unauthorized' ? 401
      : message.includes('Account safety restriction') ? 403
        : message.includes('provider failed') || message.includes('not configured') ? 503 : 400
    return json({ error: message }, status)
  }
})
