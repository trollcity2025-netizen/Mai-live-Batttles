import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const debugEdgeFunctionFetch: typeof fetch = async (input, init) => {
  const requestUrl = input instanceof Request ? input.url : input instanceof URL ? input.href : input
  const functionName = typeof requestUrl === 'string'
    ? requestUrl.match(/\/functions\/v1\/([^/?#]+)/)?.[1]
    : undefined

  try {
    const response = await fetch(input, init)
    if (functionName && !response.ok) {
      let error: unknown
      try {
        const payload = await response.clone().json()
        error = typeof payload?.error === 'string' ? payload.error : undefined
      } catch {
        error = undefined
      }
      console.error(`[Supabase Edge Function] ${functionName} returned an error`, {
        status: response.status,
        statusText: response.statusText,
        error,
      })
    }
    return response
  } catch (error) {
    if (functionName) {
      console.error(`[Supabase Edge Function] ${functionName} request failed`, error)
    }
    throw error
  }
}

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: { headers: { 'x-app-name': 'mai-life-wars' }, fetch: debugEdgeFunctionFetch },
    })
  : null

export type AppRole = 'user' | 'admin'

export type UserProfile = {
  id: string
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  gender: 'male' | 'female' | 'prefer_not_to_say' | null
  city: string | null
  state_code: string | null
  role: AppRole
  profile_complete: boolean
  marketing_recording_consent: boolean
}
