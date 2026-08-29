export async function dispatchMetaWorker(
  workerUrl: string,
  workerSecret: string,
  payload: Record<string, unknown>,
  timeoutMs = 2_000,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!workerSecret.trim()) return false
  try {
    const response = await fetchImpl(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': workerSecret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })
    return response.ok
  } catch {
    return false
  }
}
