// ga4-contract.ts — GA4 Data API reporting contract for the Google Ads "website after the click"
// view (#335). Pure and import-free so it is unit-tested without Deno, matching google-ads-policy.ts.
//
// WHY A CONTRACT MODULE
// Google Ads clicks and GA4 sessions are DIFFERENT metrics from DIFFERENT providers with different
// attribution windows, timezones and de-duplication rules. This module exists to stop the UI (or a
// future contributor) quietly treating them as one number. Every rule that could produce a
// misleading client-facing figure lives here and is covered by tests.
//
// SCHEMA VERIFICATION (2026-09-10)
// Verified directly against the official GA4 Data API schema reference
// (https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema):
//   dimensions  sessionCampaignId, sessionCampaignName, landingPage, eventName, linkUrl
// NOT confirmed in that reference at time of writing: session-scoped Google Ads dimensions
// (e.g. sessionGoogleAdsCampaignId) and the session source/medium trio.
//
// Rather than hardcode names that may not exist for a given property, EVERY field is validated at
// request time against the property's own `getMetadata` response. GA4 property schemas legitimately
// differ (custom dimensions, custom metrics and key events are per-property), so runtime validation
// is the correct design regardless of what the reference lists. Unsupported fields degrade to
// "unavailable" — never to a fabricated zero, and never to an invalid API request.

/** How a field's API name was established. Documentation-verified names are still runtime-checked. */
export type Ga4FieldConfidence = 'doc-verified' | 'runtime-only'

export interface Ga4Field {
  /** Exact GA4 Data API name, as sent in the request. */
  apiName: string
  confidence: Ga4FieldConfidence
  /** Why this field is requested, for provenance surfaces. */
  purpose: string
}

export const GA4_DIMENSIONS: Record<string, Ga4Field> = {
  date: { apiName: 'date', confidence: 'runtime-only', purpose: 'Reporting period alignment' },
  landingPage: { apiName: 'landingPage', confidence: 'doc-verified', purpose: 'Landing page behaviour' },
  sessionCampaignId: { apiName: 'sessionCampaignId', confidence: 'doc-verified', purpose: 'Exact campaign attribution' },
  sessionCampaignName: { apiName: 'sessionCampaignName', confidence: 'doc-verified', purpose: 'Campaign label' },
  sessionSource: { apiName: 'sessionSource', confidence: 'runtime-only', purpose: 'Paid-traffic isolation' },
  sessionMedium: { apiName: 'sessionMedium', confidence: 'runtime-only', purpose: 'Paid-traffic isolation' },
  sessionSourceMedium: { apiName: 'sessionSourceMedium', confidence: 'runtime-only', purpose: 'Paid-traffic isolation' },
  sessionGoogleAdsCampaignId: { apiName: 'sessionGoogleAdsCampaignId', confidence: 'runtime-only', purpose: 'Strongest Ads join' },
  eventName: { apiName: 'eventName', confidence: 'doc-verified', purpose: 'Event and key-event reporting' },
  linkUrl: { apiName: 'linkUrl', confidence: 'doc-verified', purpose: 'Outbound link clicks' },
}

export const GA4_METRICS: Record<string, Ga4Field> = {
  sessions: { apiName: 'sessions', confidence: 'runtime-only', purpose: 'Paid sessions' },
  activeUsers: { apiName: 'activeUsers', confidence: 'runtime-only', purpose: 'People reached' },
  totalUsers: { apiName: 'totalUsers', confidence: 'runtime-only', purpose: 'People reached' },
  engagedSessions: { apiName: 'engagedSessions', confidence: 'runtime-only', purpose: 'Engagement' },
  engagementRate: { apiName: 'engagementRate', confidence: 'runtime-only', purpose: 'Engagement' },
  eventCount: { apiName: 'eventCount', confidence: 'runtime-only', purpose: 'Event volume' },
  keyEvents: { apiName: 'keyEvents', confidence: 'runtime-only', purpose: 'Verified enquiries' },
}

/** Shape of the fields we care about from the Data API `getMetadata` response. */
export interface Ga4Metadata {
  dimensions: string[]
  metrics: string[]
}

export interface Ga4SelectionResult {
  supported: string[]
  unsupported: string[]
}

/**
 * Validate requested API names against the property's own metadata.
 * Fails closed: an unknown name is reported unsupported rather than sent to the API.
 */
export function validateGa4Selection(requested: string[], available: string[]): Ga4SelectionResult {
  const have = new Set(available)
  const supported: string[] = []
  const unsupported: string[] = []
  for (const name of requested) {
    if (typeof name !== 'string' || name.trim() === '') continue
    ;(have.has(name) ? supported : unsupported).push(name)
  }
  return { supported, unsupported }
}

// ── Ads ↔ GA4 join strategy ─────────────────────────────────────────────────

export type Ga4JoinStrategy = 'google-ads-campaign-id' | 'session-campaign-id' | 'unavailable'

export interface Ga4JoinDecision {
  strategy: Ga4JoinStrategy
  /** Dimensions that must be requested for this strategy. */
  dimensions: string[]
  /** Human-readable reason, surfaced in provenance. */
  reason: string
}

/**
 * Choose the strongest available join between an exact Google Ads campaign and GA4 sessions.
 *
 * Preference order:
 *  1. sessionGoogleAdsCampaignId — unambiguous Ads campaign identity (auto-tagging/GCLID path).
 *  2. sessionCampaignId — populated with the Ads campaign id for auto-tagged traffic, and with the
 *     utm_campaign value otherwise, so it MUST be paired with a paid source/medium filter.
 *  3. Nothing usable — report unavailable rather than guessing at campaign identity.
 */
export function resolveGa4JoinStrategy(metadata: Ga4Metadata): Ga4JoinDecision {
  const dims = new Set(metadata.dimensions ?? [])
  if (dims.has(GA4_DIMENSIONS.sessionGoogleAdsCampaignId.apiName)) {
    return {
      strategy: 'google-ads-campaign-id',
      dimensions: [GA4_DIMENSIONS.sessionGoogleAdsCampaignId.apiName],
      reason: 'Property exposes the Google Ads campaign dimension; sessions join on exact Ads campaign id.',
    }
  }
  if (dims.has(GA4_DIMENSIONS.sessionCampaignId.apiName)) {
    const paired = [GA4_DIMENSIONS.sessionCampaignId.apiName]
    if (dims.has(GA4_DIMENSIONS.sessionSourceMedium.apiName)) {
      paired.push(GA4_DIMENSIONS.sessionSourceMedium.apiName)
    } else if (dims.has(GA4_DIMENSIONS.sessionSource.apiName) && dims.has(GA4_DIMENSIONS.sessionMedium.apiName)) {
      paired.push(GA4_DIMENSIONS.sessionSource.apiName, GA4_DIMENSIONS.sessionMedium.apiName)
    } else {
      return {
        strategy: 'unavailable',
        dimensions: [],
        reason: 'Campaign id is available but paid source/medium is not, so paid traffic cannot be isolated safely.',
      }
    }
    return {
      strategy: 'session-campaign-id',
      dimensions: paired,
      reason: 'Google Ads campaign dimension unavailable; joining on campaign id constrained to google/cpc sessions.',
    }
  }
  return {
    strategy: 'unavailable',
    dimensions: [],
    reason: 'Property exposes no usable session campaign dimension.',
  }
}

/** Paid-traffic predicate. Deliberately strict: organic google traffic must never be counted as paid. */
export function isGooglePaidSession(source: string | null, medium: string | null): boolean {
  const s = (source ?? '').trim().toLowerCase()
  const m = (medium ?? '').trim().toLowerCase()
  if (s !== 'google') return false
  return m === 'cpc' || m === 'ppc' || m === 'paid'
}

// ── CTA / key-event truth ───────────────────────────────────────────────────

/**
 * Availability of a commercially important CTA.
 *  tracked        — a verified GA4 event exists for it and returned a count (including a real 0).
 *  not_tracked    — the site emits no such event; showing 0 would be a lie.
 *  setup_required — the event is expected by the client's taxonomy but absent from the property.
 *  unavailable    — GA4 could not be queried for it at all (access/schema/error).
 */
export type CtaAvailability = 'tracked' | 'not_tracked' | 'setup_required' | 'unavailable'

export interface CtaDefinition {
  /** CG taxonomy key, e.g. 'whatsapp_click'. */
  key: string
  label: string
  /** GA4 event names that satisfy this CTA, in priority order. */
  eventNames: string[]
  /** True when the client's onboarding says this action matters commercially. */
  expected: boolean
}

export interface CtaResult {
  key: string
  label: string
  availability: CtaAvailability
  /** Only ever set when availability === 'tracked'. Never defaulted to 0. */
  count: number | null
  matchedEventName: string | null
}

export interface CtaEvaluationInput {
  definitions: CtaDefinition[]
  /** Event names the property actually reported in the period. */
  observedEventNames: string[]
  /** Event counts keyed by GA4 event name. */
  eventCounts: Record<string, number>
  /** False when GA4 could not be queried at all. */
  ga4Reachable: boolean
}

/**
 * The CTA truth rule from #335: GA4 Enhanced Measurement records OUTBOUND link clicks, which does
 * not prove that WhatsApp / phone / email / form CTAs are instrumented. A CTA is only ever reported
 * as a number when a verified event for it actually exists.
 */
export function evaluateCtas(input: CtaEvaluationInput): CtaResult[] {
  const observed = new Set(input.observedEventNames ?? [])
  return (input.definitions ?? []).map(def => {
    const base = { key: def.key, label: def.label }
    if (!input.ga4Reachable) {
      return { ...base, availability: 'unavailable' as const, count: null, matchedEventName: null }
    }
    const matched = (def.eventNames ?? []).find(name => observed.has(name)) ?? null
    if (matched === null) {
      // Expected by the client's taxonomy but missing => actionable setup gap, not zero activity.
      return {
        ...base,
        availability: def.expected ? ('setup_required' as const) : ('not_tracked' as const),
        count: null,
        matchedEventName: null,
      }
    }
    const raw = input.eventCounts?.[matched]
    const count = typeof raw === 'number' && Number.isFinite(raw) ? raw : null
    // A tracked event legitimately reporting 0 is truthful; a missing count is not.
    return {
      ...base,
      availability: count === null ? ('unavailable' as const) : ('tracked' as const),
      count,
      matchedEventName: matched,
    }
  })
}

// ── Funnel assembly ─────────────────────────────────────────────────────────

export type FunnelStageProvider = 'google-ads' | 'ga4'

export interface FunnelStage {
  key: string
  label: string
  provider: FunnelStageProvider
  value: number | null
  /** Present when the stage cannot be shown as a number. */
  unavailableReason: string | null
}

export interface FunnelInput {
  adsImpressions: number | null
  adsClicks: number | null
  ga4PaidSessions: number | null
  ga4EngagedSessions: number | null
  ga4KeyEvents: number | null
  ga4Reachable: boolean
  ga4UnavailableReason: string | null
}

/**
 * Build the compact funnel. Every stage keeps its own provider label so the UI can never present
 * Ads clicks and GA4 sessions as the same measurement. Stages are NOT forced to decrease
 * monotonically — sessions legitimately exceed clicks (multi-session visitors, cross-device) and
 * legitimately fall below them (bounced redirects, consent, ad-blockers, tagging gaps).
 */
export function buildAdsWebsiteFunnel(input: FunnelInput): FunnelStage[] {
  const ga4Stage = (key: string, label: string, value: number | null): FunnelStage => ({
    key,
    label,
    provider: 'ga4',
    value: input.ga4Reachable ? value : null,
    unavailableReason: input.ga4Reachable
      ? (value === null ? 'Not supplied by this GA4 property for the selected period.' : null)
      : (input.ga4UnavailableReason ?? 'GA4 is not connected for this client.'),
  })

  return [
    {
      key: 'ads_impressions',
      label: 'Ad impressions',
      provider: 'google-ads',
      value: input.adsImpressions,
      unavailableReason: input.adsImpressions === null ? 'Not reported by Google Ads for this period.' : null,
    },
    {
      key: 'ads_clicks',
      label: 'Ad clicks',
      provider: 'google-ads',
      value: input.adsClicks,
      unavailableReason: input.adsClicks === null ? 'Not reported by Google Ads for this period.' : null,
    },
    ga4Stage('ga4_paid_sessions', 'Website sessions from these ads', input.ga4PaidSessions),
    ga4Stage('ga4_engaged_sessions', 'Engaged sessions', input.ga4EngagedSessions),
    ga4Stage('ga4_key_events', 'Verified enquiries / key actions', input.ga4KeyEvents),
  ]
}

/**
 * Ads clicks and GA4 sessions must never be presented as reconciling 1:1. This returns the honest
 * explanation to show alongside the funnel, or null when there is nothing to compare.
 */
export function describeClickSessionVariance(
  adsClicks: number | null,
  ga4PaidSessions: number | null,
): string | null {
  if (adsClicks === null || ga4PaidSessions === null) return null
  if (adsClicks === 0 && ga4PaidSessions === 0) return null
  return 'Google Ads clicks and GA4 sessions are measured differently by each provider and are not '
    + 'expected to match. Clicks are counted by Google Ads at the ad; sessions are counted by GA4 on '
    + 'the website after the page loads, and are affected by consent, redirects, tagging and repeat visits.'
}

// ── Conversion rate ─────────────────────────────────────────────────────────

/**
 * Conversion rate is only valid when numerator and denominator come from the SAME provider and the
 * same attributed population. Ads conversions over GA4 sessions (or vice versa) is a category error.
 */
export function paidSessionConversionRate(
  keyEvents: number | null,
  paidSessions: number | null,
): number | null {
  if (keyEvents === null || paidSessions === null) return null
  if (!Number.isFinite(keyEvents) || !Number.isFinite(paidSessions)) return null
  if (paidSessions <= 0) return null
  if (keyEvents < 0) return null
  return (keyEvents / paidSessions) * 100
}

// ── Timezone / date semantics ───────────────────────────────────────────────

export interface PeriodAlignment {
  aligned: boolean
  note: string | null
}

/**
 * Google Ads reports in the Ads account timezone; GA4 reports in the property timezone. When they
 * differ, the same calendar range is not the same window of real time, and the UI must say so
 * rather than implying an exact comparison.
 */
export function describePeriodAlignment(
  adsTimeZone: string | null,
  ga4TimeZone: string | null,
): PeriodAlignment {
  if (!adsTimeZone || !ga4TimeZone) {
    return { aligned: false, note: 'Provider timezone is unknown, so period alignment cannot be confirmed.' }
  }
  if (adsTimeZone === ga4TimeZone) return { aligned: true, note: null }
  return {
    aligned: false,
    note: `Google Ads reports in ${adsTimeZone} and GA4 reports in ${ga4TimeZone}, so daily totals `
      + 'near the period boundary can differ between the two providers.',
  }
}
