import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'

function base64url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let binary = ''
  bytes.forEach((byte) => binary += String.fromCharCode(byte))
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
async function signStreamToken(userId: string, secret: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({ user_id: userId, iat: now, exp: now + 60 * 60 }))
  const unsigned = `${header}.${payload}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned)))
  return `${unsigned}.${base64url(signature)}`
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = request.headers.get('Authorization')
    if (!auth) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireProfile(auth)
    const { roomId, profileId } = await request.json()
    if (profileId !== profile.id || typeof roomId !== 'string') return json({ error: 'Profile mismatch' }, 403)
    const { data: battle, error: battleError } = await db.from('battles').select('id,status,stream_call_id,format,real_duration_seconds,created_by_profile_id').eq('id', roomId).maybeSingle()
    if (battleError || !battle || !['waiting','ready','live','pending','active'].includes(battle.status)) return json({ error: 'Battle is not available' }, 404)
    const { data: participant, error: participantError } = await db.from('battle_participants').select('id,status').eq('battle_id', battle.id).eq('user_profile_id', profile.id).maybeSingle()
    if (participantError) throw participantError
    const viewer = !participant
    if (viewer && battle.status !== 'live') return json({ error: 'Only an active participant can enter a waiting battle' }, 403)
    if (participant && !['invited','ready','active'].includes(participant.status)) return json({ error: 'Your participant status does not allow entry' }, 403)
    const apiKey = Deno.env.get('GETSTREAM_API_KEY')
    const apiSecret = Deno.env.get('GETSTREAM_API_SECRET')
    if (!apiKey || !apiSecret) return json({ error: 'GetStream server credentials are not configured' }, 503)
    const token = await signStreamToken(profile.id, apiSecret)
    if (viewer) {
      await db.from('stream_sessions').upsert({ battle_id: battle.id, user_profile_id: profile.id, call_id: battle.stream_call_id, session_status: 'joined', session_role: 'viewer', connected_at: new Date().toISOString(), disconnected_at: null }, { onConflict: 'battle_id,user_profile_id' })
      const { count: viewers } = await db.from('stream_sessions').select('id', { count: 'exact', head: true }).eq('battle_id', battle.id).eq('session_role', 'viewer').eq('session_status', 'joined')
      await db.from('battles').update({ viewer_count: viewers || 0 }).eq('id', battle.id)
    }
    return json({ token, userId: profile.id, apiKey, callId: battle.stream_call_id, viewer, shouldStartTranscription: !viewer && battle.created_by_profile_id === profile.id })
  } catch (error) { return json({ error: errorMessage(error) }, 400) }
})
