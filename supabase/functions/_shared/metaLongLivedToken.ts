interface MetaCodeExchange {
  graphBaseUrl: string; appId: string; appSecret: string; redirectUri: string; code: string
}
interface ExchangePorts { fetch?: typeof fetch; now?: () => number }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const credential = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 16_384 && !/\s/.test(v)

/** Server-only, consent-callback operation. The code exchange and documented
 * fb_exchange_token grant are different requests. Never persist the short token,
 * refresh existing connections here, retry either request, or expose provider URLs.
 * https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/
 */
export async function exchangeMetaCodeForLongLivedToken(input: MetaCodeExchange, ports: ExchangePorts = {}): Promise<{ accessToken: string; expiresAt: string }> {
  const config = Object.freeze({ ...input }), fetcher = ports.fetch ?? fetch, now = ports.now ?? Date.now
  function fail(): never { throw new Error('Meta long-lived token exchange is unavailable.') }
  try {
    const callback = new URL(config.redirectUri)
    if (!/^https:\/\/graph\.facebook\.com\/v\d+\.\d+$/.test(config.graphBaseUrl) || !/^\d+$/.test(config.appId)
      || !credential(config.appSecret) || !credential(config.code) || callback.protocol !== 'https:'
      || callback.username || callback.password || callback.hash) fail()
    async function request(method: 'GET' | 'POST', params: URLSearchParams) {
      const url = new URL(`${config.graphBaseUrl}/oauth/access_token`)
      if (method === 'GET') url.search = params.toString()
      const response = await fetcher(url.href, { method, redirect: 'error', signal: AbortSignal.timeout(12_000),
        headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : { Accept: 'application/json' },
        body: method === 'POST' ? params.toString() : undefined })
      if (!response.ok) fail()
      const body: unknown = await response.json()
      if (!object(body) || body.error || !credential(body.access_token)) fail()
      return body
    }
    const short = await request('POST', new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret,
      redirect_uri: config.redirectUri, code: config.code }))
    // The provider's expires_in is relative to issuance; start before the request
    // so transport/body delays can never make the stored lifetime longer.
    const issuedAt = now()
    if (!Number.isFinite(issuedAt)) fail()
    const long = await request('GET', new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: config.appId,
      client_secret: config.appSecret, fb_exchange_token: short.access_token as string }))
    const lifetime = typeof long.expires_in === 'number' ? long.expires_in
      : typeof long.expires_in === 'string' && /^[1-9]\d*$/.test(long.expires_in) ? Number(long.expires_in) : NaN
    const expires = issuedAt + lifetime * 1000, completedAt = now()
    if (typeof long.token_type !== 'string' || long.token_type.toLowerCase() !== 'bearer'
      || !Number.isSafeInteger(lifetime) || lifetime <= 0 || !Number.isFinite(completedAt) || completedAt < issuedAt
      || !Number.isFinite(expires) || expires > 8_640_000_000_000_000 || expires <= completedAt + 120_000) fail()
    return { accessToken: long.access_token as string, expiresAt: new Date(expires).toISOString() }
  } catch {
    // Even transport/JSON exceptions can contain the credential-bearing URL.
    // Return only this fixed message, without a cause, status body or token.
    return fail()
  }
}
