// AWS Signature Version 4 request signing (header form), WebCrypto only — no SDK dependency.
// Pure and runtime-neutral (Deno Edge + Node tests). Verified against AWS's published
// IAM ListUsers example in tests/awsSigV4.test.mjs.

const encoder = new TextEncoder()

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  return toHex(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))
}

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as Uint8Array<ArrayBuffer>, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data)))
}

/** RFC 3986 encoding as required by SigV4 (unreserved characters left as-is). */
const uriEncode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)

export interface SigV4Credentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

export interface SigV4Request {
  method: string
  url: string
  headers: Record<string, string>
  body: string
  region: string
  service: string
  /** Defaults to now; injectable for deterministic tests. */
  now?: Date
}

export interface SignedRequest {
  headers: Record<string, string>
  canonicalRequest: string
  stringToSign: string
  signature: string
}

export async function signingKey(secret: string, date: string, region: string, service: string): Promise<Uint8Array> {
  const kDate = await hmac(encoder.encode(`AWS4${secret}`), date)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

export async function signRequest(request: SigV4Request, credentials: SigV4Credentials): Promise<SignedRequest> {
  const url = new URL(request.url)
  const now = request.now ?? new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = amzDate.slice(0, 8)
  const payloadHash = await sha256Hex(request.body)

  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(request.headers)) headers[name.toLowerCase()] = value
  headers.host = url.host
  headers['x-amz-date'] = amzDate
  if (credentials.sessionToken) headers['x-amz-security-token'] = credentials.sessionToken

  const signedHeaderNames = Object.keys(headers).sort()
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name].trim().replace(/\s+/g, ' ')}\n`)
    .join('')
  const canonicalQuery = [...url.searchParams.entries()]
    .map(([key, value]) => [uriEncode(key), uriEncode(value)])
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  const canonicalPath = url.pathname.split('/').map((segment) => uriEncode(decodeURIComponent(segment))).join('/') || '/'
  const signedHeaders = signedHeaderNames.join(';')
  const canonicalRequest = [request.method.toUpperCase(), canonicalPath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n')

  const scope = `${date}/${request.region}/${request.service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n')
  const signature = toHex(await hmac(await signingKey(credentials.secretAccessKey, date, request.region, request.service), stringToSign))

  return {
    headers: {
      ...headers,
      'x-amz-content-sha256': payloadHash,
      authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    canonicalRequest,
    stringToSign,
    signature,
  }
}
