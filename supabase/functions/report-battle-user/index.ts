import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { triageUserReport } from '../_shared/moderation.ts'
import { requireProfile } from '../_shared/supabase.ts'

const allowedCategories = ['harassment', 'threats_violence', 'self_harm', 'sexual_content', 'spam', 'other']

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireProfile(authorization)
    const { battleId, targetProfileId, category, details } = await request.json()
    if (typeof battleId !== 'string' || typeof targetProfileId !== 'string' || targetProfileId === profile.id
      || typeof category !== 'string' || !allowedCategories.includes(category)
      || typeof details !== 'string' || details.trim().length < 5 || details.trim().length > 1000) {
      return json({ error: 'Choose a report reason and provide 5 to 1000 characters of details' }, 400)
    }
    const [{ data: battle, error: battleError }, { data: reporterParticipant, error: reporterParticipantError }, { data: reporterViewer, error: reporterViewerError }, { data: targetParticipant, error: targetParticipantError }, { data: targetViewer, error: targetViewerError }] = await Promise.all([
      db.from('battles').select('id,status').eq('id', battleId).maybeSingle(),
      db.from('battle_participants').select('id').eq('battle_id', battleId).eq('user_profile_id', profile.id).in('status', ['ready', 'active']).maybeSingle(),
      db.from('stream_sessions').select('id').eq('battle_id', battleId).eq('user_profile_id', profile.id).eq('session_role', 'viewer').eq('session_status', 'joined').maybeSingle(),
      db.from('battle_participants').select('id').eq('battle_id', battleId).eq('user_profile_id', targetProfileId).in('status', ['ready', 'active']).maybeSingle(),
      db.from('stream_sessions').select('id').eq('battle_id', battleId).eq('user_profile_id', targetProfileId).eq('session_role', 'viewer').eq('session_status', 'joined').maybeSingle(),
    ])
    if (battleError) throw battleError
    if (reporterParticipantError) throw reporterParticipantError
    if (reporterViewerError) throw reporterViewerError
    if (targetParticipantError) throw targetParticipantError
    if (targetViewerError) throw targetViewerError
    if (!battle || !['waiting', 'ready', 'live', 'pending', 'active'].includes(battle.status) || (!reporterParticipant && !reporterViewer)) {
      return json({ error: 'You must be in this active battle to report someone' }, 403)
    }
    if (!targetParticipant && !targetViewer) return json({ error: 'That user is no longer in this battle' }, 404)

    const { data: report, error: reportError } = await db.from('user_reports').insert({
      reporter_profile_id: profile.id,
      reported_profile_id: targetProfileId,
      battle_id: battleId,
      category,
      details: details.trim(),
      ai_triage_status: 'pending',
    }).select('id').single()
    if (reportError) throw reportError

    try {
      const triage = await triageUserReport(category, details.trim())
      const { error: triageError } = await db.from('user_reports').update({
        ai_triage_status: 'completed',
        ai_triage_category: triage.category,
        ai_triage_confidence: triage.confidence,
        ai_triage_summary: triage.summary,
      }).eq('id', report.id)
      if (triageError) throw triageError
      return json({ accepted: true, aiTriage: 'completed' })
    } catch (triageError) {
      console.error('[Report triage] AI triage failed; report remains queued for review', triageError)
      const { error: updateError } = await db.from('user_reports')
        .update({ ai_triage_status: 'unavailable', ai_triage_summary: 'AI triage unavailable; queued for moderator review.' })
        .eq('id', report.id)
      if (updateError) throw updateError
      return json({ accepted: true, aiTriage: 'unavailable' })
    }
  } catch (error) {
    const message = errorMessage(error)
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400)
  }
})
