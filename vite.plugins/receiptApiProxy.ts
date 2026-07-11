import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import receiptOcrHandler from '../api/receipt-ocr'
import receiptViewHandler from '../api/receipts/[token]'

type NodeHeaders = IncomingHttpHeaders

export function receiptApiProxy() {
  return {
    name: 'receipt-api-proxy',
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const requestUrl = getRequestUrl(req)

        if (requestUrl.pathname === '/api/receipt-ocr' && req.method === 'POST') {
          await handleNodeRequest(req, res, receiptOcrHandler)
          return
        }

        if (requestUrl.pathname.startsWith('/api/receipts/') && req.method === 'GET') {
          await handleNodeRequest(req, res, receiptViewHandler)
          return
        }

        next()
      }

      const stack = (server.middlewares as { stack?: Array<{ route: string; handle: typeof middleware }> }).stack
      if (Array.isArray(stack)) {
        stack.unshift({ route: '', handle: middleware } as { route: string; handle: typeof middleware })
        return
      }

      server.middlewares.use(middleware)
    },
  }
}

async function handleNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (request: Request) => Promise<Response>
) {
  try {
    const request = await toFetchRequest(req)
    const response = await handler(request)
    await sendFetchResponse(res, response)
  } catch (error) {
    console.error('Local API proxy error:', error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
    }
    res.end(JSON.stringify({ error: 'Failed to handle local API request.' }))
  }
}

async function toFetchRequest(req: IncomingMessage) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost:3000'}`)
  const method = req.method ?? 'GET'
  const headers = new Headers()

  appendHeaders(headers, req.headers)

  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, {
      method,
      headers,
    })
  }

  const body = await readRequestBody(req)
  return new Request(url, {
    method,
    headers,
    body,
  })
}

async function sendFetchResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })

  if (!response.body) {
    res.end()
    return
  }

  const arrayBuffer = await response.arrayBuffer()
  res.end(Buffer.from(arrayBuffer))
}

function appendHeaders(target: Headers, source: NodeHeaders) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'undefined') {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        target.append(key, item)
      }
      continue
    }

    target.set(key, value)
  }
}

async function readRequestBody(req: IncomingMessage) {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  return Buffer.concat(chunks)
}

function getRequestUrl(req: IncomingMessage) {
  return new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost:3000'}`)
}
