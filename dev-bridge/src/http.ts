import { createMcpHandler } from '@modelcontextprotocol/server'
import { authenticate, unauthorizedResponse } from './auth.js'
import { getPublicUrl } from './config.js'
import { createOwnerDevServer } from './tools.js'

const MAX_BODY_BYTES = 1_000_000
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 30
const calls = new Map<string, number[]>()

function requestAllowed(subject: string): boolean {
  const now = Date.now()
  const recent = (calls.get(subject) ?? []).filter(timestamp => timestamp > now - RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) return false
  recent.push(now)
  calls.set(subject, recent)
  return true
}

function requestHeadersAllowed(request: Request): boolean {
  const publicUrl = getPublicUrl()
  const expectedHost = new URL(publicUrl).host
  const previewHost = process.env.VERCEL_URL?.trim()
  const host = request.headers.get('host')
  if (host && host !== expectedHost && host !== previewHost && !/^localhost(?::\d+)?$/.test(host) && !/^127\.0\.0\.1(?::\d+)?$/.test(host)) return false
  const origin = request.headers.get('origin')
  if (!origin) return true
  return new Set([publicUrl, 'https://chatgpt.com', 'https://chat.openai.com']).has(origin.replace(/\/$/, ''))
}

async function withBoundedBody(request: Request): Promise<Request | null> {
  if (!request.body) return request
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  const headers = new Headers(request.headers)
  headers.set('content-length', String(total))
  return new Request(request.url, { method: request.method, headers, body })
}

export async function handleMcp(request: Request): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'POST' } })
  if (!requestHeadersAllowed(request)) return Response.json({ error: 'forbidden_origin' }, { status: 403 })
  const length = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return Response.json({ error: 'request_too_large' }, { status: 413 })
  const boundedRequest = await withBoundedBody(request)
  if (!boundedRequest) return Response.json({ error: 'request_too_large' }, { status: 413 })

  const identity = await authenticate(boundedRequest)
  if (!identity) return unauthorizedResponse()
  if (!requestAllowed(identity.subject)) return Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '60' } })

  const handler = createMcpHandler(() => createOwnerDevServer(identity), { responseMode: 'json' })
  try {
    return await handler.fetch(boundedRequest)
  } finally {
    await handler.close()
  }
}
