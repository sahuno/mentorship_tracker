export interface ReceiptOcrResult {
  item: string
  amount: number
  date?: string
}

export interface ReceiptOcrResponse {
  receiptUrl: string
  receiptPath: string
  ocrResults: ReceiptOcrResult[]
  analysisError?: string
}

export const MAX_RECEIPT_FILE_SIZE_BYTES = 10 * 1024 * 1024

const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export function isSupportedReceiptFile(file: Pick<File, 'type' | 'size'>) {
  return ALLOWED_RECEIPT_MIME_TYPES.has(file.type) && file.size <= MAX_RECEIPT_FILE_SIZE_BYTES
}

export function buildReceiptPrompt() {
  return [
    'Analyze this receipt.',
    'Extract all distinct expense items.',
    'For each item, provide its description, total amount, and the date of the transaction.',
    "Use the receipt's main date if an individual item doesn't have a specific date.",
    'Respond with a JSON array of objects in this shape: [{item: string, amount: number, date?: string}]',
  ].join(' ')
}

export function parseReceiptOcrResponse(text: string): ReceiptOcrResult[] {
  const jsonText = extractJsonPayload(text)

  if (!jsonText) {
    return []
  }

  try {
    const parsed = JSON.parse(jsonText)
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.items)
        ? parsed.items
        : []

    return items
      .map((entry) => normalizeReceiptItem(entry))
      .filter((entry): entry is ReceiptOcrResult => entry !== null)
  } catch {
    return []
  }
}

export function encodeReceiptPath(path: string) {
  return base64UrlEncode(path)
}

export function decodeReceiptPath(token: string) {
  return base64UrlDecode(token)
}

export function buildReceiptUrl(storagePath: string) {
  return `/api/receipts/${encodeReceiptPath(storagePath)}`
}

function extractJsonPayload(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fencedMatch?.[1] ?? text

  const trimmed = candidate.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return trimmed
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    return arrayMatch[0]
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/)
  return objectMatch?.[0] ?? null
}

export function normalizeReceiptItem(entry: unknown): ReceiptOcrResult | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const candidate = entry as Record<string, unknown>
  const item = typeof candidate.item === 'string'
    ? candidate.item.trim()
    : typeof candidate.description === 'string'
      ? candidate.description.trim()
      : ''
  const amount = typeof candidate.amount === 'number'
    ? candidate.amount
    : typeof candidate.amount === 'string'
      ? Number(candidate.amount)
      : Number.NaN

  if (!item || !Number.isFinite(amount)) {
    return null
  }

  const date = typeof candidate.date === 'string' && candidate.date.trim()
    ? candidate.date.trim()
    : undefined

  return {
    item,
    amount,
    date,
  }
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const normalized = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new TextDecoder().decode(bytes)
}
