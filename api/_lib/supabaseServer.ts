import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types'

/**
 * Shared Supabase server helpers for Vercel EDGE-runtime functions.
 *
 * These utilities are intentionally free of Node-only APIs so they can run in
 * the edge runtime. They were extracted verbatim from api/receipt-ocr.ts and
 * api/receipts/[token].ts to remove duplication — behavior is unchanged.
 */

export type ServiceClient = SupabaseClient<Database>

/**
 * Read the first defined value from a list of environment variable keys.
 */
export function getEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]
    if (value) {
      return value
    }
  }

  return undefined
}

/**
 * Create an auth-scoped Supabase client (anon key + optional bearer token).
 */
export function createSupabaseClient(authHeader?: string) {
  const supabaseUrl = getEnvValue('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = getEnvValue('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase server configuration is missing.')
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  })
}

/**
 * Create a service-role Supabase client (bypasses RLS).
 */
export function createServiceClient() {
  const supabaseUrl = getEnvValue('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
  const supabaseServiceKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase service configuration is missing.')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

/**
 * Build a JSON error response.
 */
export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

/**
 * Determine whether a user may access a balance cycle's receipts.
 *
 * Authorization matches the (previously duplicated) per-handler logic exactly:
 * a user is authorized if they are the cycle's participant, an admin, or the
 * manager of the cycle's program. The program lookup only runs when the user is
 * neither participant nor admin and the cycle has a program_id, and a failed or
 * empty program lookup leaves the user unauthorized — identical to both callers.
 */
export async function canAccessCycle(
  serviceClient: ServiceClient,
  userId: string,
  userRole: string,
  cycle: { participant_id: string | null; program_id: string | null }
): Promise<boolean> {
  let isAuthorized = cycle.participant_id === userId || userRole === 'admin'

  if (!isAuthorized && cycle.program_id) {
    const { data: program, error: programError } = await serviceClient
      .from('programs')
      .select('manager_id')
      .eq('id', cycle.program_id)
      .single()

    if (!programError && program) {
      isAuthorized = program.manager_id === userId
    }
  }

  return isAuthorized
}
