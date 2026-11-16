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
