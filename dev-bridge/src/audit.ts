import { redactText } from './safety.js'

export type AuditEvent = {
  requestId: string
  actor: string
  tool: string
  risk: 'low' | 'normal_write' | 'high_impact'
  target?: string
  outcome: 'success' | 'denied' | 'failed'
  durationMs: number
  error?: string
}

export function audit(event: AuditEvent): void {
  console.info(JSON.stringify({
    event: 'owner_dev_bridge_tool',
    timestamp: new Date().toISOString(),
    ...event,
    error: event.error ? redactText(event.error, 500) : undefined,
  }))
}
