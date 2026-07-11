import {
  buildReceiptPrompt,
  buildReceiptUrl,
  isSupportedReceiptFile,
  parseReceiptOcrResponse,
} from '../src/lib/receiptOcrShared'
import {
  canAccessCycle,
  createServiceClient,
  createSupabaseClient,
  getEnvValue,
  jsonError,
} from './_lib/supabaseServer'

export const config = {
  runtime: 'edge',
}

const OCR_RATE_LIMIT_WINDOW_MS = 60_000
const OCR_RATE_LIMIT_MAX_REQUESTS = 6

type RateLimitEntry = {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function guessExtension(mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'bin'
  }
}

function requireString(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function getRequestIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

function getRateLimitKey(userId: string, request: Request) {
  return `${userId}:${getRequestIp(request)}`
}

function enforceRateLimit(userId: string, request: Request) {
  const key = getRateLimitKey(userId, request)
  const now = Date.now()
  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + OCR_RATE_LIMIT_WINDOW_MS,
    })
    return
  }

  if (existing.count >= OCR_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    throw new Response(
      JSON.stringify({ error: 'Too many receipt OCR requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfterSeconds),
        },
      }
    )
  }

  existing.count += 1
  rateLimitStore.set(key, existing)
}

export default async function handler(request: Request) {
  try {
    if (request.method !== 'POST') {
      return jsonError('Method not allowed', 405)
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

    enforceRateLimit(user.id, request)

    const formData = await request.formData()
    const file = formData.get('receipt')
    const cycleId = requireString(formData.get('cycleId'))

    if (!(file instanceof File)) {
      return jsonError('A receipt image is required.', 400)
    }

    if (!isSupportedReceiptFile(file)) {
      return jsonError('Unsupported file type or file is too large.', 400)
    }

    if (!cycleId) {
      return jsonError('Receipt cycle is required.', 400)
    }

    const serviceClient = createServiceClient()
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return jsonError('Access denied.', 403)
    }

    const { data: cycle, error: cycleError } = await serviceClient
      .from('balance_cycles')
      .select('participant_id, program_id')
      .eq('id', cycleId)
      .single()

    if (cycleError || !cycle) {
      return jsonError('Receipt cycle not found.', 404)
    }

    const isAuthorized = await canAccessCycle(serviceClient, user.id, profile.role, cycle)

    if (!isAuthorized) {
      return jsonError('Access denied.', 403)
    }

    const fileExtension = guessExtension(file.type)
    const receiptPath = `receipts/${cycleId}/${crypto.randomUUID()}.${fileExtension}`
    const fileBuffer = await file.arrayBuffer()
    const uploadPayload = new Uint8Array(fileBuffer)

    const { error: uploadError } = await serviceClient.storage
      .from('receipts')
      .upload(receiptPath, uploadPayload, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Receipt upload failed:', uploadError.message)
      return jsonError('Failed to upload receipt.', 500)
    }

    const receiptUrl = buildReceiptUrl(receiptPath)
    const geminiApiKey = getEnvValue('GEMINI_API_KEY')
    let ocrResults = []
    let analysisError: string | undefined

    if (!geminiApiKey) {
      analysisError = 'Receipt uploaded, but OCR is not configured.'
    } else {
      try {
        const prompt = buildReceiptPrompt()
        const base64Data = arrayBufferToBase64(fileBuffer)

        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType: file.type,
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
              },
            }),
          }
        )

        if (!geminiResponse.ok) {
          const payload = await geminiResponse.json().catch(() => null)
          throw new Error(payload?.error?.message || `Gemini request failed with status ${geminiResponse.status}`)
        }

        const payload = await geminiResponse.json()
        const text = payload?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text || '')
          .join('') || ''

        ocrResults = parseReceiptOcrResponse(text)

        if (ocrResults.length === 0) {
          analysisError = 'No expenses could be extracted from the receipt. Please enter details manually.'
        }
      } catch (error) {
        console.error('Receipt OCR failed:', error instanceof Error ? error.message : error)
        analysisError = 'Failed to analyze receipt. The image was uploaded, but OCR did not complete.'
      }
    }

    return Response.json({
      receiptUrl,
      receiptPath,
      ocrResults,
      analysisError,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    console.error('Unexpected receipt OCR error:', error)
    return jsonError('Unexpected receipt OCR failure.', 500)
  }
}
