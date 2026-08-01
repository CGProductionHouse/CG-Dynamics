export const MAX_VOICE_SECONDS = 300

type VoiceDebriefInvokeResult<T> = { data: T | null; error: unknown }

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'FunctionsFetchError'
}

export async function invokeVoiceDebriefRequest<T>(
  userId: string,
  invoke: (requestId: string) => Promise<VoiceDebriefInvokeResult<T>>,
): Promise<VoiceDebriefInvokeResult<T>> {
  if (!userId) throw new Error('A signed-in user is required for a voice debrief.')

  const requestId = crypto.randomUUID()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await invoke(requestId)
      if (!result.error || !isNetworkError(result.error) || attempt === 1) return result
    } catch (error) {
      if (!isNetworkError(error) || attempt === 1) throw error
    }
  }
  throw new Error('The voice debrief request could not be sent.')
}
