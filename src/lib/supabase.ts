import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: { headers: { 'x-app-name': 'mai-life-wars' } },
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
