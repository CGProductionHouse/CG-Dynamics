import { put } from '@vercel/blob'
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

type AuditRecord = AuditEvent & {
  event: 'owner_dev_bridge_tool'
  timestamp: string
}

type PersistAudit = (pathname: string, body: string) => Promise<unknown>

function requireOidcStorage(): void {
  if (!process.env.BLOB_STORE_ID?.trim() || !process.env.VERCEL_OIDC_TOKEN?.trim()) {
    throw new Error('Durable audit storage is unavailable.')
  }
}

async function persistAudit(pathname: string, body: string): Promise<void> {
  requireOidcStorage()
  await put(pathname, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: 'application/json',
  })
}

export function requireDurableAudit(): void {
  requireOidcStorage()
}

export async function audit(event: AuditEvent, persist: PersistAudit = persistAudit): Promise<void> {
  const record: AuditRecord = {
    event: 'owner_dev_bridge_tool',
    timestamp: new Date().toISOString(),
    ...event,
    error: event.error ? redactText(event.error, 500) : undefined,
  }
  const serialized = JSON.stringify(record)
  console.info(serialized)

  const day = record.timestamp.slice(0, 10).replaceAll('-', '/')
  await persist(`owner-dev-bridge/${day}/${record.timestamp.replaceAll(':', '-')}-${event.requestId}.json`, serialized)
}
