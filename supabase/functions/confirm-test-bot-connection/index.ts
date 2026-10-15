import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const auth = request.headers.get('Authorization')
    if (!auth) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireAdmin(auth)
    const { battleId, botProfileId } = await request.json()
    if (typeof battleId !== 'string' || typeof botProfileId !== 'string') return json({ error: 'Battle and opponent are required' }, 400)
    const { data, error } = await db.rpc('confirm_test_bot_connection', {
      p_battle_id: battleId,
      p_requester_profile_id: profile.id,
      p_bot_profile_id: botProfileId,
    })
    if (error) throw error
    return json(data)
  } catch (error) {
    const message = errorMessage(error)
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400)
  }
})
