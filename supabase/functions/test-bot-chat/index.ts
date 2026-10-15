import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'

const messages = [
  'Good luck! Let’s have a clean round.',
  'Nice setup — ready when you are.',
  'Good battle. Keep the energy up!',
  'That camera angle looks great.',
  'Let’s see what this arena can do.',
]

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const auth = request.headers.get('Authorization')
    if (!auth) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireAdmin(auth)
    const { battleId } = await request.json()
    if (typeof battleId !== 'string') return json({ error: 'Battle ID is required' }, 400)
    const { data: bot, error: botError } = await db.from('battle_participants')
      .select('user_profile_id')
      .eq('battle_id', battleId)
      .eq('team', 'B')
      .maybeSingle()
    if (botError) throw botError
    if (!bot) return json({ error: 'Admin Tester is not assigned to this test battle' }, 409)
    const message = messages[Math.floor(Math.random() * messages.length)]
    const { error } = await db.rpc('write_test_bot_chat', {
      p_battle_id: battleId,
      p_requester_profile_id: profile.id,
      p_bot_profile_id: bot.user_profile_id,
      p_message: message,
    })
    if (error) throw error
    return json({ status: 'sent', senderName: 'Admin Tester', message })
  } catch (error) {
    const message = errorMessage(error)
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400)
  }
})
