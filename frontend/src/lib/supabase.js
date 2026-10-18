import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nixakeaiibzhesdwtelw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Supabase Passkeys are experimental. Password login stays available as a fallback.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { experimental: { passkey: true } },
})
