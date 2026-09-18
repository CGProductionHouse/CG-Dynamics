export type EnsureClientInput = {
  hoursClientId: string
  exactName: string
  requestId: string
}

export type ParseResult =
  | { ok: true; value: EnsureClientInput }
  | { ok: false; code: 'invalid_request' | 'invalid_hours_client_id' | 'invalid_request_id' | 'invalid_name' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseEnsureClientInput(input: unknown): ParseResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, code: 'invalid_request' }
  const source = input as Record<string, unknown>
  if (typeof source.hoursClientId !== 'string' || !UUID.test(source.hoursClientId)) {
    return { ok: false, code: 'invalid_hours_client_id' }
  }
  if (typeof source.requestId !== 'string' || !UUID.test(source.requestId)) {
    return { ok: false, code: 'invalid_request_id' }
  }
  if (typeof source.exactName !== 'string') return { ok: false, code: 'invalid_name' }
  const exactName = source.exactName.trim()
  if (!exactName || exactName.length > 200) return { ok: false, code: 'invalid_name' }
  return {
    ok: true,
    value: {
      hoursClientId: source.hoursClientId.toLowerCase(),
      requestId: source.requestId.toLowerCase(),
      exactName,
    },
  }
}

export async function secretsMatch(provided: string | null, expected: string | undefined): Promise<boolean> {
  if (!provided || !expected || expected.length < 32) return false
  const encoder = new TextEncoder()
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const left = new Uint8Array(providedHash)
  const right = new Uint8Array(expectedHash)
  let difference = left.length ^ right.length
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return difference === 0
}
