import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Reuse a single client across HMR to avoid multiple GoTrueClient instances
const globalForSupabase = globalThis as unknown as {
  __supabaseClient?: ReturnType<typeof createClient>
  __supabaseAdminClient?: ReturnType<typeof createClient>
}

export const supabase =
  globalForSupabase.__supabaseClient ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

if (!globalForSupabase.__supabaseClient) {
  globalForSupabase.__supabaseClient = supabase
}

// Service role client (only for server-side operations if needed)
// WARNING: Exposing service role key in client is a security risk - use only for development!
// In production, create a Supabase Edge Function or API endpoint
export const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY

// Admin client factory - creates client only when needed to avoid GoTrueClient conflicts
let adminClient: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (!serviceRoleKey) return null
  if (globalForSupabase.__supabaseAdminClient) return globalForSupabase.__supabaseAdminClient
  if (adminClient) return adminClient

  // Ensure a project-scoped, unique storage key to avoid collisions
  let projectScopedStorageKey = 'sb-admin'
  try {
    const host = new URL(supabaseUrl).host.replace(/\./g, '-')
    projectScopedStorageKey = `sb-admin-${host}`
  } catch (_) {}

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storageKey: projectScopedStorageKey,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      } as any,
    },
  })

  globalForSupabase.__supabaseAdminClient = adminClient
  return globalForSupabase.__supabaseAdminClient
}


