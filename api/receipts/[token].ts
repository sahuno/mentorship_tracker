import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types'
import { decodeReceiptPath } from '../../src/lib/receiptOcrShared'

export const config = {
  runtime: 'edge',
}

function getEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]
    if (value) {
      return value
    }
  }

  return undefined
}

function createSupabaseClient(authHeader?: string) {
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

function createServiceClient() {
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

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

function guessContentType(receiptPath: string) {
  const extension = receiptPath.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

function getReceiptCycleId(receiptPath: string) {
  const segments = receiptPath.split('/')
  if (segments.length < 3 || segments[0] !== 'receipts') {
    return null
  }

  return segments[1]
}

export default async function handler(request: Request) {
  try {
    if (request.method !== 'GET') {
      return jsonError('Method not allowed', 405)
    }

    const token = new URL(request.url).pathname.split('/').pop()
    if (!token) {
      return jsonError('Receipt token is required.', 400)
    }

    let receiptPath: string
    try {
      receiptPath = decodeReceiptPath(token)
    } catch {
      return jsonError('Invalid receipt token.', 400)
    }

    if (!receiptPath.startsWith('receipts/')) {
      return jsonError('Invalid receipt token.', 400)
    }

    const authHeader = request.headers.get('Authorization') ?? undefined
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Authentication required', 401)
    }

    const authClient = createSupabaseClient(authHeader)
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError || !user) {
      return jsonError('Authentication required', 401)
    }

    const serviceClient = createServiceClient()
    const cycleId = getReceiptCycleId(receiptPath)

    if (!cycleId) {
      return jsonError('Invalid receipt token.', 400)
    }

    const { data: cycle, error: cycleError } = await serviceClient
      .from('balance_cycles')
      .select('participant_id, program_id')
      .eq('id', cycleId)
      .single()

    if (cycleError || !cycle) {
      return jsonError('Receipt not found.', 404)
    }

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return jsonError('Access denied.', 403)
    }

    const isOwner = cycle.participant_id === user.id
    const isAdmin = profile.role === 'admin'

    let isManager = false

    if (!isOwner && !isAdmin && cycle.program_id) {
      const { data: program, error: programError } = await serviceClient
        .from('programs')
        .select('manager_id')
        .eq('id', cycle.program_id)
        .single()

      if (!programError && program) {
        isManager = program.manager_id === user.id
      }
    }

    if (!isOwner && !isAdmin && !isManager) {
      return jsonError('Access denied.', 403)
    }

    const { data: fileBlob, error: downloadError } = await serviceClient.storage
      .from('receipts')
      .download(receiptPath)

    if (downloadError || !fileBlob) {
      console.error('Failed to download receipt:', downloadError?.message)
      return jsonError('Failed to open receipt.', 500)
    }

    return new Response(await fileBlob.arrayBuffer(), {
      headers: {
        'Content-Type': guessContentType(receiptPath),
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    console.error('Unexpected receipt view error:', error)
    return jsonError('Unexpected receipt access failure.', 500)
  }
}
