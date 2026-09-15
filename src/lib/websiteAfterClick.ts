// websiteAfterClick.ts — the ONE canonical "Website after the click" projection (#335).
//
// Both the client-facing report and Admin Preview render from this exact function. Admin Preview
// renders ClientReportView, so parity is structural rather than a convention someone must remember.
//
// This module NEVER recalculates Google Ads. Impressions and clicks are read straight off the
// already-merged Google Ads V2 dashboard (provider truth from #237 / PR #270). GA4 supplies only
// what happened on the website afterwards.

import {
  buildAdsWebsiteFunnel,
  describeClickSessionVariance,
  describePeriodAlignment,
  evaluateCtas,
  paidSessionConversionRate,
  type CtaDefinition,
  type CtaResult,
  type FunnelStage,
  type Ga4JoinStrategy,
  type PeriodAlignment,
} from './ga4Contract'
import type { GoogleAdsDashboardData } from './googleAdsDashboard'

export interface Ga4LandingPage {
  path: string
  sessions: number | null
  engagedSessions: number | null
}

/** Exactly what the ga4-website-report function returns for one client/campaign/date range. */
export interface Ga4WebsitePayload {
  available: boolean
  /** Why GA4 could not be reported. Null when available. */
  unavailableReason: string | null
  propertyId: string | null
  propertyTimeZone: string | null
  /** Last date GA4 has complete data for, when the provider supplies it. */
  dataThroughDate: string | null
  fetchedAt: string | null
  joinStrategy: Ga4JoinStrategy
  sessions: number | null
  activeUsers: number | null
  engagedSessions: number | null
  engagementRate: number | null
  keyEvents: number | null
  landingPages: Ga4LandingPage[]
  /** Event names the property actually reported in the period. */
  observedEventNames: string[]
  eventCounts: Record<string, number>
  /** Requested field names the property does not support. */
  unsupportedFields: string[]
  /** CTA evaluation returned by the provider path. When present it is used directly. */
  ctas?: CtaResult[]
}

export type WebsiteAfterClickState =
  | 'data'            // GA4 reported for this exact client/campaign/period
  | 'not-mapped'      // no GA4 property mapped for this client
  | 'unavailable'     // mapped but GA4 could not be reported
  | 'no-ads-context'  // no Google Ads period to attach website behaviour to

export interface WebsiteAfterClickProjection {
  state: WebsiteAfterClickState
  /** Shown when state is not 'data'. Never replaced by zeros. */
  message: string | null
  periodStart: string | null
  periodEnd: string | null
  funnel: FunnelStage[]
  /** Always present when both Ads clicks and GA4 sessions are shown. */
  varianceNote: string | null
  periodAlignment: PeriodAlignment
  sessions: number | null
  activeUsers: number | null
  engagedSessions: number | null
  engagementRate: number | null
  keyEvents: number | null
  /** Paid-session conversion rate, only when numerator and denominator are both valid. */
  conversionRate: number | null
  landingPages: Ga4LandingPage[]
  ctas: CtaResult[]
  joinStrategy: Ga4JoinStrategy
  propertyTimeZone: string | null
  dataThroughDate: string | null
  fetchedAt: string | null
  unsupportedFields: string[]
}

export interface WebsiteAfterClickInput {
  /** Google Ads V2 provider truth. Never recalculated here. */
  adsDashboard: GoogleAdsDashboardData | null
  ga4: Ga4WebsitePayload | null
  /** CG CTA taxonomy configured for this exact client. */
  ctaDefinitions: CtaDefinition[]
}

const EMPTY_ALIGNMENT: PeriodAlignment = {
  aligned: false,
  note: 'Provider timezone is unknown, so period alignment cannot be confirmed.',
}

function emptyProjection(
  state: WebsiteAfterClickState,
  message: string,
  ads: GoogleAdsDashboardData | null,
  ctas: CtaResult[],
): WebsiteAfterClickProjection {
  return {
    state,
    message,
    periodStart: ads?.periodStart ?? null,
    periodEnd: ads?.periodEnd ?? null,
    // Ads stages still show provider truth; only the GA4 stages go unavailable.
    funnel: buildAdsWebsiteFunnel({
      adsImpressions: ads?.impressions ?? null,
      adsClicks: ads?.clicks ?? null,
      ga4PaidSessions: null,
      ga4EngagedSessions: null,
      ga4KeyEvents: null,
      ga4Reachable: false,
      ga4UnavailableReason: message,
    }),
    varianceNote: null,
    periodAlignment: EMPTY_ALIGNMENT,
    sessions: null,
    activeUsers: null,
    engagedSessions: null,
    engagementRate: null,
    keyEvents: null,
    conversionRate: null,
    landingPages: [],
    ctas,
    joinStrategy: 'unavailable',
    propertyTimeZone: null,
    dataThroughDate: null,
    fetchedAt: null,
    unsupportedFields: [],
  }
}

/**
 * Build the canonical projection.
 *
 * Every not-available path still returns the Google Ads stages, because Ads truth does not depend
 * on GA4. No path invents a zero: a missing GA4 number stays null and carries a reason.
 */
export function buildWebsiteAfterClickProjection(
  input: WebsiteAfterClickInput,
): WebsiteAfterClickProjection {
  const ads = input.adsDashboard
  const definitions = input.ctaDefinitions ?? []

  if (!ads) {
    return emptyProjection(
      'no-ads-context',
      'There is no Google Ads reporting period to attach website behaviour to.',
      null,
      evaluateCtas({ definitions, observedEventNames: [], eventCounts: {}, ga4Reachable: false }),
    )
  }

  const ga4 = input.ga4
  if (!ga4 || !ga4.available) {
    const mapped = Boolean(ga4?.propertyId)
    return emptyProjection(
      mapped ? 'unavailable' : 'not-mapped',
      ga4?.unavailableReason
        ?? 'No Google Analytics property is connected for this client yet, so website behaviour after the ad click is not available.',
      ads,
      evaluateCtas({ definitions, observedEventNames: [], eventCounts: {}, ga4Reachable: false }),
    )
  }

  const ctas = ga4.ctas ?? evaluateCtas({
    definitions,
    observedEventNames: ga4.observedEventNames ?? [],
    eventCounts: ga4.eventCounts ?? {},
    ga4Reachable: true,
  })

  return {
    state: 'data',
    message: null,
    periodStart: ads.periodStart,
    periodEnd: ads.periodEnd,
    funnel: buildAdsWebsiteFunnel({
      adsImpressions: ads.impressions,
      adsClicks: ads.clicks,
      ga4PaidSessions: ga4.sessions,
      ga4EngagedSessions: ga4.engagedSessions,
      ga4KeyEvents: ga4.keyEvents,
      ga4Reachable: true,
      ga4UnavailableReason: null,
    }),
    varianceNote: describeClickSessionVariance(ads.clicks, ga4.sessions),
    periodAlignment: describePeriodAlignment(ads.timeZone, ga4.propertyTimeZone),
    sessions: ga4.sessions,
    activeUsers: ga4.activeUsers,
    engagedSessions: ga4.engagedSessions,
    engagementRate: ga4.engagementRate,
    keyEvents: ga4.keyEvents,
    conversionRate: paidSessionConversionRate(ga4.keyEvents, ga4.sessions),
    landingPages: ga4.landingPages ?? [],
    ctas,
    joinStrategy: ga4.joinStrategy,
    propertyTimeZone: ga4.propertyTimeZone,
    dataThroughDate: ga4.dataThroughDate,
    fetchedAt: ga4.fetchedAt,
    unsupportedFields: ga4.unsupportedFields ?? [],
  }
}

// ── display helpers (shared by client and admin so wording cannot diverge) ───

export function formatWebsiteMetric(value: number | null): string {
  return value === null ? 'Unavailable' : new Intl.NumberFormat('en-ZA').format(value)
}

export function formatWebsitePercent(value: number | null): string {
  return value === null ? 'Unavailable' : `${value.toFixed(1)}%`
}

/** GA4 supplies engagementRate as a 0..1 ratio. */
export function formatEngagementRate(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return 'Unavailable'
  return `${(rate * 100).toFixed(1)}%`
}

export function ctaStatusLabel(result: CtaResult): string {
  switch (result.availability) {
    case 'tracked': return formatWebsiteMetric(result.count)
    case 'setup_required': return 'Setup required'
    case 'not_tracked': return 'Not tracked'
    default: return 'Unavailable'
  }
}
