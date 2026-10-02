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
