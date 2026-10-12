import { createClient } from 'npm:@supabase/supabase-js@2'

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing Supabase server secrets')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
export function userClient(authHeader: string) {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !key) throw new Error('Missing Supabase API configuration')
  return createClient(url, key, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } })
}
export async function requireProfile(authHeader: string) {
  const userDb = userClient(authHeader)
  const { data: authData, error: authError } = await userDb.auth.getUser()
  if (authError || !authData.user) throw new Error('Unauthorized')
  const db = adminClient()
  const { data: profile, error } = await db.from('user_profiles').select('*').eq('user_id', authData.user.id).single()
  if (error || !profile || profile.account_status !== 'active') throw new Error('Active user profile required')
  return { db, user: authData.user, profile }
}
export async function requireAdmin(authHeader: string) {
  const context = await requireProfile(authHeader)
  if (context.profile.role !== 'admin') throw new Error('Administrator access required')
  return context
}
