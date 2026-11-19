/** Shared deadline/cancellation for private read-only provider work. The error
 * factory is server code, never a request-supplied permission or diagnostic.
 * No retries, polling, provider URL or mutation capability lives here.
 */
export async function boundedPublishingRead<T>(run: (signal: AbortSignal) => Promise<T>, options: {
  milliseconds?: number; upstream?: AbortSignal; error(reason: 'timeout_invalid' | 'aborted' | 'timeout'): Error
}): Promise<T> {
  const milliseconds = options.milliseconds ?? 15_000
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 1 || milliseconds > 15_000) throw options.error('timeout_invalid')
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  try {
    return await Promise.race([Promise.resolve().then(() => {
      if (controller.signal.aborted) throw options.error('aborted')
      return run(controller.signal)
    }), new Promise<never>((_, reject) => {
      abort = () => { controller.abort(); reject(options.error('aborted')) }
      if (options.upstream?.aborted) { abort(); return }
      options.upstream?.addEventListener('abort', abort, { once: true })
      timer = setTimeout(() => { controller.abort(); reject(options.error('timeout')) }, milliseconds)
    })])
  } finally { clearTimeout(timer); if (abort) options.upstream?.removeEventListener('abort', abort) }
}

/** Bounded UTF8 JSON consumption for fixed provider read/inspection endpoints.
 * The surrounding deadline must span BOTH fetch and this body reader.
 */
export async function readPublishingJson(response: Response, signal: AbortSignal, options: {
  maxBytes: number; invalid(): Error; aborted(): Error
}): Promise<unknown> {
  const cancelBody = () => { if (response.body && !response.body.locked) void response.body.cancel().catch(() => {}) }
  const bad = () => { cancelBody(); throw options.invalid() }
  if (signal.aborted) { cancelBody(); throw options.aborted() }
  const declared = response.headers.get('content-length')
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1 || options.maxBytes > 1_048_576
    || !response.ok || response.redirected || (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > options.maxBytes))
    || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || !response.body) return bad()
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      const next = await reader.read()
      if (signal.aborted) throw options.aborted()
      if (next.done) break
      size += next.value.length
      if (size > options.maxBytes) return bad()
      chunks.push(next.value)
    }
  } finally { signal.removeEventListener('abort', cancel); cancel(); reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { return bad() }
}
