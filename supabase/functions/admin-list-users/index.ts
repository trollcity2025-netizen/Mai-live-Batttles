import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authorization required' }, 401)

    const { db } = await requireAdmin(authorization)
    const { data: profiles, error } = await db
      .from('user_profiles')
      .select('id,username,display_name,role,created_at,state_code,spendable_bullets,cashable_bullets')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return json({ profiles })
  } catch (error) {
    return json({ error: errorMessage(error) }, 400)
  }
})
