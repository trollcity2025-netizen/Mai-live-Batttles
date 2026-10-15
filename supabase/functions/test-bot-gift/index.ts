import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const auth = request.headers.get('Authorization')
    if (!auth) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireAdmin(auth)
    const { battleId, giftKey } = await request.json()
    if (typeof battleId !== 'string' || !['pulse', 'boost', 'crown'].includes(giftKey)) {
      return json({ error: 'A test battle and supported gift are required' }, 400)
    }
    const { data: bot, error: botError } = await db.from('battle_participants')
      .select('user_profile_id')
      .eq('battle_id', battleId)
      .eq('team', 'B')
      .maybeSingle()
    if (botError) throw botError
    if (!bot) return json({ error: 'Admin Tester is not assigned to this test battle' }, 409)
    const { data, error } = await db.rpc('send_test_bot_gift', {
      p_battle_id: battleId,
      p_requester_profile_id: profile.id,
      p_bot_profile_id: bot.user_profile_id,
      p_gift_key: giftKey,
    })
    if (error) throw error
    return json({ ...data, senderName: 'Test Gift Bot' })
  } catch (error) {
    const message = errorMessage(error)
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400)
  }
})
