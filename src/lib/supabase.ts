/**
 * Supabase client singleton for browser use.
 * Depends on: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY in .env
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function missingConfigMessage(): string {
  return 'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment environment variables.'
}

export const supabase: SupabaseClient = (() => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(missingConfigMessage())
    // Placeholder client so the app can render a login error instead of a blank page
    return createClient('https://placeholder.supabase.co', 'placeholder-key')
  }
  return createClient(supabaseUrl, supabaseAnonKey)
})()

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

export { missingConfigMessage }
