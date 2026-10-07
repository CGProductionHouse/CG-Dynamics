// Presentation only: a failed/malformed read is not evidence of disconnection.
export type IntegrationConnectionState = 'loading' | 'connected' | 'disconnected' | 'unavailable'

export function observedConnectionState(connected: unknown, readAvailable: boolean): IntegrationConnectionState {
  if (!readAvailable || typeof connected !== 'boolean') return 'unavailable'
  return connected ? 'connected' : 'disconnected'
}

export function integrationConnectionLabel(state: IntegrationConnectionState): string {
  if (state === 'loading') return 'Checking...'
  if (state === 'unavailable') return 'Unavailable'
  return state === 'connected' ? 'Connected' : 'Not connected'
}
