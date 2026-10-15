import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'

function base64url(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  bytes.forEach((byte) => binary += String.fromCharCode(byte))
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function signToken(userId: string, secret: string) {
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ user_id: userId, iat: now, exp: now + 60 * 60 }))}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned)))
  return `${unsigned}.${base64url(signature)}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const auth = request.headers.get('Authorization')
    if (!auth) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireAdmin(auth)
    const { battleId } = await request.json()
    if (typeof battleId !== 'string') return json({ error: 'Battle ID is required' }, 400)
    const { data: battle, error: battleError } = await db.from('battles').select('id,status,is_test,stream_call_id,created_by_profile_id').eq('id', battleId).maybeSingle()
    if (battleError) throw battleError
    if (!battle || !battle.is_test || battle.created_by_profile_id !== profile.id || !['waiting', 'ready', 'live'].includes(battle.status)) {
      return json({ error: 'You cannot start an Admin Tester session for this battle' }, 403)
    }
    const { data: botParticipant, error: participantError } = await db.from('battle_participants')
      .select('user_profile_id,user_profiles(display_name,avatar_url)')
      .eq('battle_id', battleId)
      .eq('team', 'B')
      .maybeSingle()
    if (participantError) throw participantError
    if (!botParticipant) return json({ error: 'Admin Tester is not assigned to this test battle' }, 409)
    const apiKey = Deno.env.get('GETSTREAM_API_KEY')
    const secret = Deno.env.get('GETSTREAM_API_SECRET')
    if (!apiKey || !secret) return json({ error: 'GetStream server credentials are not configured' }, 503)
    const user = Array.isArray(botParticipant.user_profiles) ? botParticipant.user_profiles[0] : botParticipant.user_profiles
    return json({
      token: await signToken(botParticipant.user_profile_id, secret),
      apiKey,
      callId: battle.stream_call_id,
      userId: botParticipant.user_profile_id,
      displayName: user?.display_name || 'Admin Tester',
      avatarUrl: user?.avatar_url || null,
    })
  } catch (error) {
    const message = errorMessage(error)
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400)
  }
})
