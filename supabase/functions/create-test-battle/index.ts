import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { adminClient, requireAdmin } from '../_shared/supabase.ts'

const adminTesterEmail = 'trollcity2025@gmail.com'
type AdminDatabase = ReturnType<typeof adminClient>

async function findAuthUserByEmail(db: AdminDatabase, email: string) {
  const perPage = 1000
  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const user = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === email)
    if (user) return user
    if (data.users.length < perPage) return null
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const auth = request.headers.get('Authorization')
    if (!auth) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireAdmin(auth)
    const apiKey = Deno.env.get('GETSTREAM_API_KEY')
    const apiSecret = Deno.env.get('GETSTREAM_API_SECRET')
    if (!apiKey || !apiSecret) return json({ error: 'GetStream server credentials are not configured' }, 503)
    if (!profile.profile_complete || profile.account_status !== 'active') return json({ error: 'An active, complete admin profile is required' }, 403)

    let botAuthUser = await findAuthUserByEmail(db, adminTesterEmail)
    let botProfile: { id: string; display_name: string; avatar_url: string | null; profile_complete: boolean; account_status: string } | null = null
    if (botAuthUser) {
      const { data, error } = await db.from('user_profiles')
        .select('id,display_name,avatar_url,profile_complete,account_status')
        .eq('user_id', botAuthUser.id)
        .maybeSingle()
      if (error) throw error
      botProfile = data
    }
    if (!botAuthUser) {
      const { data, error } = await db.auth.admin.createUser({
        email: adminTesterEmail,
        password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
        email_confirm: true,
        user_metadata: { display_name: 'Admin Tester', username: 'mai_admin_tester' },
      })
      if (error && error.code !== 'email_exists') throw error
      botAuthUser = data.user || await findAuthUserByEmail(db, adminTesterEmail)
      if (!botAuthUser) throw new Error('Admin Tester auth account creation did not return a user.')
    }
    if (!botProfile) {
      const { data, error } = await db.from('user_profiles').insert({
        user_id: botAuthUser.id,
        username: 'mai_admin_tester',
        display_name: 'Admin Tester',
        avatar_url: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=mai-admin-tester',
        bio: 'Automated test-battle opponent. Does not sign in or use real Bullets.',
        profile_complete: true,
        marketing_recording_consent: false,
        role: 'user',
      }).select('id,display_name,avatar_url,profile_complete,account_status').single()
      if (error) {
        const { data: existingProfile, error: lookupError } = await db.from('user_profiles')
          .select('id,display_name,avatar_url,profile_complete,account_status')
          .eq('user_id', botAuthUser.id)
          .maybeSingle()
        if (lookupError) throw lookupError
        if (!existingProfile) throw error
        botProfile = existingProfile
      } else {
        botProfile = data
      }
    }
    if (!botProfile.profile_complete || botProfile.account_status !== 'active') {
      return json({ error: 'The Admin Tester account exists but needs an active, completed profile.' }, 503)
    }
    if (botProfile.id === profile.id) return json({ error: 'Sign in with a different account to test against Admin Tester.' }, 400)

    const battleId = crypto.randomUUID()
    const callId = `lw-test-${battleId}`
    const { error: battleError } = await db.from('battles').insert({
      id: battleId,
      created_by_profile_id: profile.id,
      format: '1v1',
      mode: 'standard',
      status: 'waiting',
      stream_call_id: callId,
      displayed_duration_seconds: 180,
      real_duration_seconds: 180,
      clock_rate: 1,
      is_test: true,
    })
    if (battleError) throw battleError

    const { error: participantsError } = await db.from('battle_participants').insert([
      { battle_id: battleId, user_profile_id: profile.id, team: 'A', status: 'ready', stream_user_id: profile.id },
      { battle_id: battleId, user_profile_id: botProfile.id, team: 'B', status: 'ready', stream_user_id: botProfile.id },
    ])
    if (participantsError) {
      await db.from('battles').delete().eq('id', battleId)
      throw participantsError
    }
    const { error: sessionsError } = await db.from('stream_sessions').insert([
      { battle_id: battleId, user_profile_id: profile.id, call_id: callId, session_status: 'created' },
      { battle_id: battleId, user_profile_id: botProfile.id, call_id: callId, session_status: 'created' },
    ])
    if (sessionsError) {
      await db.from('battles').delete().eq('id', battleId)
      throw sessionsError
    }
    const { error: eventError } = await db.from('battle_events').insert({
      battle_id: battleId,
      user_profile_id: profile.id,
      event_type: 'created',
      team: 'A',
      payload: { format: '1v1', mode: 'standard', is_test: true, opponent_profile_id: botProfile.id },
      idempotency_key: `test-battle-created:${battleId}`,
    })
    if (eventError) {
      await db.from('battles').delete().eq('id', battleId)
      throw eventError
    }
    return json({ battleId, callId, format: '1v1', mode: 'standard', testBattle: true })
  } catch (error) {
    const message = errorMessage(error)
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400)
  }
})
