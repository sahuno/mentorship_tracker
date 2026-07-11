import { decodeReceiptPath } from '../../src/lib/receiptOcrShared'
import {
  canAccessCycle,
  createServiceClient,
  createSupabaseClient,
  jsonError,
} from '../_lib/supabaseServer'

export const config = {
  runtime: 'edge',
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

    const isAuthorized = await canAccessCycle(serviceClient, user.id, profile.role, cycle)

    if (!isAuthorized) {
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
