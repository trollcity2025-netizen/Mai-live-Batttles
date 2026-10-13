import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'

const allowedFormats = ['1v1','6v6']
const allowedModes = ['standard','fast','slow','state']
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const auth = request.headers.get('Authorization')
    if (!auth) return json({ error: 'Authorization required' }, 401)
    const { db, profile, user } = await requireProfile(auth)
    const body = await request.json()
    const format = String(body.format || '1v1')
    const mode = String(body.mode || 'standard')
    const stateCode = mode === 'state' ? String(body.stateCode || profile.state_code || '').toUpperCase() : null
    if (!allowedFormats.includes(format)) return json({ error: 'Invalid battle format' }, 400)
    if (!allowedModes.includes(mode)) return json({ error: 'Invalid battle mode' }, 400)
    if (mode === 'state' && !/^[A-Z]{2}$/.test(stateCode || '')) return json({ error: 'Choose a valid state before starting a state battle' }, 400)
    const cooldownExempt = profile.role === 'admin' || user.email?.trim().toLowerCase() === 'trollcity2025@gmail.com'
    const { data, error } = await db.rpc('join_or_create_battle', { p_profile_id: profile.id, p_format: format, p_mode: mode, p_state_code: stateCode, p_cooldown_exempt: cooldownExempt })
    if (error) throw error
    return json(data)
  } catch (error) {
    const message = errorMessage(error)
    const cooldownMatch = message.match(/^NO_GIFT_BATTLE_COOLDOWN:(.+)$/)
    if (cooldownMatch) return json({ error: `You received no gifts in your last 3 completed battles. You can start another battle after ${cooldownMatch[1]} UTC.` }, 429)
    const status = message === 'Unauthorized' ? 401
      : message.includes('Account safety restriction') ? 403 : 400
    return json({ error: message }, status)
  }
})
