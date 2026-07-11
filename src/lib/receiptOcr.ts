import { supabase } from './supabase'
import {
  buildReceiptPrompt,
  buildReceiptUrl,
  decodeReceiptPath,
  encodeReceiptPath,
  isSupportedReceiptFile,
  parseReceiptOcrResponse,
  type ReceiptOcrResponse,
  type ReceiptOcrResult,
} from './receiptOcrShared'

export type { ReceiptOcrResponse, ReceiptOcrResult }
export {
  buildReceiptPrompt,
  buildReceiptUrl,
  decodeReceiptPath,
  encodeReceiptPath,
  isSupportedReceiptFile,
  parseReceiptOcrResponse,
}

export async function analyzeReceipt(file: File, cycleId?: string): Promise<ReceiptOcrResponse> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('You must be signed in to analyze receipts.')
  }

  const formData = new FormData()
  formData.append('receipt', file)
  if (cycleId) {
    formData.append('cycleId', cycleId)
  }

  const response = await fetch('/api/receipt-ocr', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  })

  const payload = await safeJson(response)

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to analyze receipt.')
  }

  return {
    receiptUrl: typeof payload?.receiptUrl === 'string' ? payload.receiptUrl : '',
    receiptPath: typeof payload?.receiptPath === 'string' ? payload.receiptPath : '',
    ocrResults: Array.isArray(payload?.ocrResults)
      ? payload.ocrResults.map((entry: unknown) => normalizeReceiptItem(entry)).filter((entry): entry is ReceiptOcrResult => entry !== null)
      : [],
    analysisError: typeof payload?.analysisError === 'string' ? payload.analysisError : undefined,
  }
}

export async function openProtectedReceipt(receiptUrl: string) {
  const popup = window.open('', '_blank')

  if (!popup) {
    throw new Error('Your browser blocked the receipt preview popup.')
  }

  popup.opener = null
  popup.document.write('<p style="font-family: sans-serif; padding: 16px;">Loading receipt...</p>')

  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    popup.close()
    throw new Error('You must be signed in to view receipts.')
  }

  const response = await fetch(receiptUrl, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    popup.close()
    throw new Error(payload?.error || 'Failed to open receipt.')
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  popup.location.href = objectUrl
  popup.focus()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

function normalizeReceiptItem(entry: unknown): ReceiptOcrResult | null {
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

async function safeJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}
