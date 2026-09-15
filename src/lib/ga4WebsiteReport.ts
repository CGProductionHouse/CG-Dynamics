// ga4WebsiteReport.ts — app-side loader for the ga4-website-report Edge Function (#335).
//
// Both staff (Admin Preview) and clients call the same function. The Edge Function enforces
// exact-client access: admin/manager or the client that owns the requested client_id.
//
// This module is pure read-only: no Google, Supabase or analytics writes.

import { supabase } from './supabase'
import type { CtaResult, Ga4JoinStrategy } from './ga4Contract'
import type { Ga4LandingPage, Ga4WebsitePayload } from './websiteAfterClick'
import type { GoogleAdsDashboardData } from './googleAdsDashboard'

export type { Ga4WebsitePayload } from './websiteAfterClick'

interface Ga4ReportArgs {
  clientId: string
  campaignId: string
  startDate: string
  endDate: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseLandingPages(value: unknown): Ga4LandingPage[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): Ga4LandingPage | null => {
      if (!isRecord(item)) return null
      const path = string(item.path)
      if (!path) return null
      return { path, sessions: nullableNumber(item.sessions), engagedSessions: nullableNumber(item.engagedSessions) }
    })
    .filter((item): item is Ga4LandingPage => item !== null)
}

function parseEventCounts(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}
  const result: Record<string, number> = {}
  for (const [key, val] of Object.entries(value)) {
    const count = nullableNumber(val)
    if (count !== null) result[key] = count
  }
  return result
}

function parseCtas(value: unknown): CtaResult[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value
    .map((item): CtaResult | null => {
      if (!isRecord(item)) return null
      const key = string(item.key)
      const label = string(item.label)
      if (!key || !label) return null
      const availability = string(item.availability)
      if (!['tracked', 'not_tracked', 'setup_required', 'unavailable'].includes(availability)) return null
      return {
        key,
        label,
        availability: availability as CtaResult['availability'],
        count: nullableNumber(item.count),
        matchedEventName: nullableString(item.matchedEventName),
      }
    })
    .filter((item): item is CtaResult => item !== null)
}

function parseGa4WebsitePayload(value: unknown): Ga4WebsitePayload | null {
  if (!isRecord(value)) return null
  const root = isRecord(value.payload) ? value.payload : value
  if (!isRecord(root)) return null
  const available = root.available === true
  const joinStrategy = string(root.joinStrategy) as Ga4JoinStrategy
  return {
    available,
    unavailableReason: nullableString(root.unavailableReason),
    propertyId: nullableString(root.propertyId),
    propertyTimeZone: nullableString(root.propertyTimeZone),
    dataThroughDate: nullableString(root.dataThroughDate),
    fetchedAt: nullableString(root.fetchedAt),
    joinStrategy: ['google-ads-campaign-id', 'session-campaign-id', 'unavailable'].includes(joinStrategy)
      ? joinStrategy
      : 'unavailable',
    sessions: nullableNumber(root.sessions),
    activeUsers: nullableNumber(root.activeUsers),
    engagedSessions: nullableNumber(root.engagedSessions),
    engagementRate: nullableNumber(root.engagementRate),
    keyEvents: nullableNumber(root.keyEvents),
    landingPages: parseLandingPages(root.landingPages),
    observedEventNames: Array.isArray(root.observedEventNames)
      ? root.observedEventNames.map(string).filter(Boolean)
      : [],
    eventCounts: parseEventCounts(root.eventCounts),
    unsupportedFields: Array.isArray(root.unsupportedFields)
      ? root.unsupportedFields.map(string).filter(Boolean)
      : [],
    ctas: parseCtas(root.ctas),
  }
}

/**
 * Load the GA4 "website after the click" payload for one exact client/campaign/date range.
 *
 * Returns null on transport or authorization failure. Returns an `available: false` payload
 * when the mapping or GA4 credentials are missing, so the UI can explain why honestly.
 */
export async function loadGa4WebsiteReport(args: Ga4ReportArgs): Promise<Ga4WebsitePayload | null> {
  if (!args.clientId || !args.campaignId || !args.startDate || !args.endDate) return null
  try {
    const { data, error } = await supabase.functions.invoke<unknown>('ga4-website-report', {
      body: {
        clientId: args.clientId,
        campaignId: args.campaignId,
        startDate: args.startDate,
        endDate: args.endDate,
      },
    })
    if (error) return null
    return parseGa4WebsitePayload(data)
  } catch {
    return null
  }
}

function sumNumbers(values: (number | null)[]): number | null {
  let total = 0
  let hasValue = false
  for (const value of values) {
    if (value !== null && Number.isFinite(value)) {
      total += value
      hasValue = true
    }
  }
  return hasValue ? total : null
}

function weightedEngagementRate(payloads: Ga4WebsitePayload[]): number | null {
  let weighted = 0
  let sessions = 0
  let hasValue = false
  for (const p of payloads) {
    if (
      p.available
      && p.engagementRate !== null
      && p.sessions !== null
      && Number.isFinite(p.engagementRate)
      && Number.isFinite(p.sessions)
    ) {
      weighted += p.engagementRate * p.sessions
      sessions += p.sessions
      hasValue = true
    }
  }
  return hasValue && sessions > 0 ? weighted / sessions : null
}

function mergeLandingPages(payloads: Ga4WebsitePayload[]): Ga4LandingPage[] {
  const byPath = new Map<string, Ga4LandingPage>()
  for (const p of payloads) {
    if (!p.available) continue
    for (const page of p.landingPages) {
      const existing = byPath.get(page.path)
      if (existing) {
        byPath.set(page.path, {
          path: page.path,
          sessions: sumNumbers([existing.sessions, page.sessions]),
          engagedSessions: sumNumbers([existing.engagedSessions, page.engagedSessions]),
        })
      } else {
        byPath.set(page.path, { ...page })
      }
    }
  }
  return [...byPath.values()]
}

function mergeEventCounts(payloads: Ga4WebsitePayload[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const p of payloads) {
    if (!p.available) continue
    for (const [name, count] of Object.entries(p.eventCounts)) {
      totals[name] = (totals[name] ?? 0) + count
    }
  }
  return totals
}

function mergeObservedEventNames(payloads: Ga4WebsitePayload[]): string[] {
  const names = new Set<string>()
  for (const p of payloads) {
    if (!p.available) continue
    for (const name of p.observedEventNames) names.add(name)
  }
  return [...names]
}

// Avoid importing iterator helpers that may not exist in all targets.
const byMap = { values: <T>(map: Map<string, T>): T[] => Array.from(map.values()) }

function mergeCtas(payloads: Ga4WebsitePayload[]): CtaResult[] {
  const byKey = new Map<string, CtaResult>()
  for (const p of payloads) {
    if (!p.available || !p.ctas) continue
    for (const cta of p.ctas) {
      const existing = byKey.get(cta.key)
      if (!existing) {
        byKey.set(cta.key, { ...cta })
        continue
      }
      // Tracked wins; sum counts across campaigns. Setup-required beats not-tracked.
      if (existing.availability === 'tracked' || cta.availability === 'tracked') {
        const count =
          existing.availability === 'tracked' && cta.availability === 'tracked'
            ? (existing.count ?? 0) + (cta.count ?? 0)
            : existing.availability === 'tracked'
              ? existing.count
              : cta.count
        byKey.set(cta.key, {
          ...cta,
          availability: 'tracked',
          count: count ?? null,
          matchedEventName: existing.matchedEventName ?? cta.matchedEventName,
        })
      } else if (cta.availability === 'setup_required' && existing.availability !== 'setup_required') {
        byKey.set(cta.key, { ...cta })
      }
    }
  }
  return byMap.values(byKey)
}

/**
 * Load GA4 website data for every campaign in a Google Ads dashboard and merge the results.
 *
 * The dashboard is provider-native aggregated Google Ads truth; this produces the corresponding
 * merged GA4 view. A single-campaign client simply returns that one payload.
 */
export async function loadGa4WebsiteReportForDashboard(
  clientId: string,
  dashboard: GoogleAdsDashboardData,
): Promise<Ga4WebsitePayload | null> {
  if (!dashboard.campaigns.length) return null
  const payloads = (
    await Promise.all(
      dashboard.campaigns.map(campaign =>
        loadGa4WebsiteReport({
          clientId,
          campaignId: campaign.campaignId,
          startDate: dashboard.periodStart,
          endDate: dashboard.periodEnd,
        }),
      ),
    )
  ).filter((p): p is Ga4WebsitePayload => p !== null)
  if (payloads.length === 0) return null
  if (payloads.length === 1) return payloads[0]

  const available = payloads.some(p => p.available)
  const first = payloads[0]
  const anyAvailable = payloads.find(p => p.available)
  const representative = anyAvailable ?? first

  return {
    available,
    unavailableReason: available
      ? null
      : (representative.unavailableReason ?? 'Google Analytics data is not available for these campaigns.'),
    propertyId: representative.propertyId,
    propertyTimeZone: representative.propertyTimeZone,
    dataThroughDate: representative.dataThroughDate,
    fetchedAt: representative.fetchedAt,
    joinStrategy: representative.joinStrategy,
    sessions: sumNumbers(payloads.map(p => p.sessions)),
    activeUsers: sumNumbers(payloads.map(p => p.activeUsers)),
    engagedSessions: sumNumbers(payloads.map(p => p.engagedSessions)),
    engagementRate: weightedEngagementRate(payloads),
    keyEvents: sumNumbers(payloads.map(p => p.keyEvents)),
    landingPages: mergeLandingPages(payloads),
    observedEventNames: mergeObservedEventNames(payloads),
    eventCounts: mergeEventCounts(payloads),
    unsupportedFields: [...new Set(payloads.flatMap(p => p.unsupportedFields))],
    ctas: mergeCtas(payloads),
  }
}
