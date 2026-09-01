import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { handleMcp } from './src/http.js'
import { protectedResourceMetadata } from './src/auth.js'

const port = Number(process.env.PORT ?? 3100)

createServer(async (incoming, outgoing) => {
  const origin = `http://${incoming.headers.host ?? `localhost:${port}`}`
  const request = new Request(new URL(incoming.url ?? '/', origin), {
    method: incoming.method,
    headers: incoming.headers as HeadersInit,
    body: incoming.method === 'GET' || incoming.method === 'HEAD' ? undefined : Readable.toWeb(incoming) as ReadableStream,
    duplex: 'half',
  } as RequestInit)
  let response: Response
  const path = new URL(request.url).pathname
  if (path === '/mcp') response = await handleMcp(request)
  else if (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp') response = Response.json(protectedResourceMetadata())
  else if (path === '/health') response = Response.json({ service: 'cg-dynamics-owner-dev-bridge', status: 'ok', version: '0.1.0' })
  else response = Response.json({ error: 'not_found' }, { status: 404 })

  outgoing.statusCode = response.status
  response.headers.forEach((value, key) => outgoing.setHeader(key, value))
  outgoing.end(Buffer.from(await response.arrayBuffer()))
}).listen(port, '127.0.0.1')
