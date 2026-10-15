import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireProfile(authorization)
    const { battleId, targetProfileId } = await request.json()
    if (typeof battleId !== 'string' || typeof targetProfileId !== 'string' || targetProfileId === profile.id) {
      return json({ error: 'A battle and another user are required' }, 400)
    }
    const [{ data: battle, error: battleError }, { data: target, error: targetError }, { data: participant, error: participantError }, { data: viewer, error: viewerError }] = await Promise.all([
      db.from('battles').select('id,status').eq('id', battleId).maybeSingle(),
      db.from('user_profiles').select('id,profile_complete,account_status').eq('id', targetProfileId).maybeSingle(),
      db.from('battle_participants').select('id').eq('battle_id', battleId).eq('user_profile_id', profile.id).in('status', ['ready', 'active']).maybeSingle(),
      db.from('stream_sessions').select('id').eq('battle_id', battleId).eq('user_profile_id', profile.id).eq('session_role', 'viewer').eq('session_status', 'joined').maybeSingle(),
    ])
    if (battleError) throw battleError
    if (targetError) throw targetError
    if (participantError) throw participantError
    if (viewerError) throw viewerError
    if (!battle || !['waiting', 'ready', 'live'].includes(battle.status) || (!participant && !viewer)) {
      return json({ error: 'You must be in this active battle to message its audience' }, 403)
    }
    if (!target?.profile_complete || target.account_status !== 'active') return json({ error: 'This profile is unavailable' }, 404)

    const [{ data: targetParticipant, error: targetParticipantError }, { data: targetViewer, error: targetViewerError }, { data: blocks, error: blockError }] = await Promise.all([
      db.from('battle_participants').select('id').eq('battle_id', battleId).eq('user_profile_id', targetProfileId).in('status', ['ready', 'active']).maybeSingle(),
      db.from('stream_sessions').select('id').eq('battle_id', battleId).eq('user_profile_id', targetProfileId).eq('session_role', 'viewer').eq('session_status', 'joined').maybeSingle(),
      db.from('user_blocks').select('blocker_profile_id').or(`and(blocker_profile_id.eq.${profile.id},blocked_profile_id.eq.${targetProfileId}),and(blocker_profile_id.eq.${targetProfileId},blocked_profile_id.eq.${profile.id})`).limit(1),
    ])
    if (targetParticipantError) throw targetParticipantError
    if (targetViewerError) throw targetViewerError
    if (blockError) throw blockError
    if (!targetParticipant && !targetViewer) return json({ error: 'That user is no longer in this battle' }, 404)
    if (blocks?.length) return json({ error: 'Messaging is unavailable because one of you blocked the other' }, 403)

    const [userA, userB] = profile.id < targetProfileId ? [profile.id, targetProfileId] : [targetProfileId, profile.id]
    let { data: conversation, error: conversationError } = await db.from('direct_conversations')
      .insert({ user_a_profile_id: userA, user_b_profile_id: userB })
      .select('id').single()
    if (conversationError?.code === '23505') {
      const existing = await db.from('direct_conversations').select('id')
        .eq('user_a_profile_id', userA).eq('user_b_profile_id', userB).single()
      conversation = existing.data
      conversationError = existing.error
    }
    if (conversationError) throw conversationError
    return json({ conversationId: conversation.id })
  } catch (error) {
    const message = errorMessage(error)
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400)
  }
})
