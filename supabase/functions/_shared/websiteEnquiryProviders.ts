// Issue #405: provider selection for the delivery worker. Fail-closed: any missing or
// invalid value returns `disabled` with the exact gate name; nothing is claimed.

import { resolveDeliveryConfig } from './websiteEnquiryDelivery.ts'
import { resolveSesConfig, type SesConfig } from './websiteEnquirySes.ts'

export type ProviderConfig =
  | { state: 'disabled'; reason: string }
  | { state: 'ready'; provider: 'resend'; from: string; apiKey: string; supportsIdempotentReplay: true }
  | ({ state: 'ready'; supportsIdempotentReplay: false } & SesConfig)

export function resolveProviderConfig(env: (name: string) => string | undefined): ProviderConfig {
  if (env('WEBSITE_ENQUIRY_EMAIL_PROVIDER') !== 'ses') {
    const resend = resolveDeliveryConfig(env)
    return resend.state === 'ready' ? { ...resend, supportsIdempotentReplay: true } : resend
  }
  // SES shares the enable flag and approved-sender rules; reuse them via the Resend checks
  // with the provider name substituted, so gates and messages stay identical.
  const base = resolveDeliveryConfig((name) => {
    if (name === 'WEBSITE_ENQUIRY_EMAIL_PROVIDER') return 'resend'
    if (name === 'WEBSITE_ENQUIRY_RESEND_API_KEY') return 'unused-for-ses'
    return env(name)
  })
  if (base.state === 'disabled') return base
  const ses = resolveSesConfig(env)
  if (!ses.ok) return { state: 'disabled', reason: ses.reason }
  // SES has no idempotency key: ambiguous sends are never auto-replayed.
  return { state: 'ready', supportsIdempotentReplay: false, from: base.from, ...ses.config }
}

// Optional acceptance/rollout gate. When WEBSITE_ENQUIRY_EMAIL_RECIPIENT_ALLOWLIST is set (a
// comma-separated list of exact addresses), the worker sends only to those recipients: it claims
// nothing while any due job is addressed elsewhere, and never sends a claimed job addressed
// elsewhere. Unset or blank = normal routing. Malformed = hold everything (fail closed).
export type RecipientGate =
  | { mode: 'open' }
  | { mode: 'allowlist'; allowed: ReadonlySet<string> }
  | { mode: 'invalid' }

const ALLOWLIST_EMAIL = /^[^\s@<>",]+@[^\s@<>",]+\.[^\s@<>",]+$/

export function resolveRecipientGate(env: (name: string) => string | undefined): RecipientGate {
  const raw = env('WEBSITE_ENQUIRY_EMAIL_RECIPIENT_ALLOWLIST')
  if (raw === undefined || raw.trim() === '') return { mode: 'open' }
  const entries = raw.split(',').map((entry) => entry.trim().toLowerCase())
  if (entries.some((entry) => !ALLOWLIST_EMAIL.test(entry)) || entries.length > 20) return { mode: 'invalid' }
  return { mode: 'allowlist', allowed: new Set(entries) }
}

export function recipientAllowed(gate: RecipientGate, recipient: string | null | undefined): boolean {
  if (gate.mode === 'open') return true
  if (gate.mode === 'invalid' || typeof recipient !== 'string') return false
  return gate.allowed.has(recipient.trim().toLowerCase())
}
