const REQUEST_TIMEOUT_MS = 15000

export function withRequestTimeout<T>(
  request: PromiseLike<T>,
  timeoutMessage = 'The request took too long. Please try again.'
) {
  let timeoutId: ReturnType<typeof setTimeout>

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), REQUEST_TIMEOUT_MS)
  })

  return Promise.race([request, timeout]).finally(() => clearTimeout(timeoutId))
}
