import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = request.headers.get('Authorization'); if (!auth) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireProfile(auth)
    const { amountBullets, idempotencyKey } = await request.json()
    const amount = Number(amountBullets)
    if (!Number.isSafeInteger(amount) || amount < 3750) return json({ error: 'Minimum cashout is 3,750 eligible earnings Bullets.' }, 400)
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      return json({ error: 'A valid cashout idempotency key is required.' }, 400)
    }
    const { data, error } = await db.rpc('request_creator_cashout', {
      p_profile_id: profile.id,
      p_amount_bullets: amount,
      p_idempotency_key: idempotencyKey,
    })
    if (error) throw error
    return json(data)
  } catch (error) { return json({ error: errorMessage(error) }, 400) }
})
