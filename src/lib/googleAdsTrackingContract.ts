// src/lib/googleAdsTrackingContract.ts — app copy of supabase/functions/_shared/google-ads-tracking-contract.ts (kept in sync; drift-guarded by tests).
// Pure and import-free so it is unit-tested without Deno.
//
// This module NEVER mutates Google Ads. It builds a recommended Final URL suffix, validates an
// observed one, and reports readiness. Applying anything to a live account is an explicit
// CA-authorised provider gate.
//
// VERIFIED 2026-09-10 against https://support.google.com/google-ads/answer/6305348 (ValueTrack):
//   {campaignid} {adgroupid} {creative} {device} {network} {matchtype} {keyword} all exist.
//   CRITICAL: {keyword} "returns a blank value" when the ad matches without keywords — AI Max for
//   Search, Dynamic Search Ads and Performance Max. {matchtype} returns "a" for AI Max keywordless.
// Hence a single suffix must NOT be applied blindly to every campaign type: on PMax/DSA the
// keyword-derived parameters silently resolve to empty, producing misleading empty utm_term values.

export type AdsCampaignType =
  | 'SEARCH' | 'PERFORMANCE_MAX' | 'DISPLAY' | 'VIDEO' | 'SHOPPING' | 'DEMAND_GEN' | 'UNKNOWN'

export interface ValueTrackParameter {
  token: string
  /** Campaign types where this resolves to a usable value. */
  reliableFor: AdsCampaignType[]
  /** Campaign types where Google documents a blank/degraded value. */
  blankFor: AdsCampaignType[]
  note: string
}

export const VALUETRACK_PARAMETERS: Record<string, ValueTrackParameter> = {
  campaignid: {
    token: '{campaignid}',
    reliableFor: ['SEARCH', 'PERFORMANCE_MAX', 'DISPLAY', 'VIDEO', 'SHOPPING', 'DEMAND_GEN'],
    blankFor: [],
    note: 'Campaign ID. Stable across campaign types and the safest join key back to Google Ads.',
  },
  adgroupid: {
    token: '{adgroupid}',
    reliableFor: ['SEARCH', 'DISPLAY', 'VIDEO', 'SHOPPING', 'DEMAND_GEN'],
    blankFor: ['PERFORMANCE_MAX'],
    note: 'Ad group ID. Performance Max has no conventional ad groups.',
  },
  creative: {
    token: '{creative}',
    reliableFor: ['SEARCH', 'DISPLAY', 'VIDEO', 'SHOPPING', 'DEMAND_GEN'],
    blankFor: ['PERFORMANCE_MAX'],
    note: 'Unique ad ID.',
  },
  keyword: {
    token: '{keyword}',
    reliableFor: ['SEARCH'],
    blankFor: ['PERFORMANCE_MAX'],
    note: 'Google documents a BLANK value where the ad matches without keywords — AI Max for Search, '
      + 'Dynamic Search Ads and Performance Max.',
  },
  matchtype: {
    token: '{matchtype}',
    reliableFor: ['SEARCH'],
    blankFor: ['PERFORMANCE_MAX'],
    note: 'Returns "a" for AI Max keywordless matching.',
  },
  device: {
    token: '{device}',
    reliableFor: ['SEARCH', 'PERFORMANCE_MAX', 'DISPLAY', 'VIDEO', 'SHOPPING', 'DEMAND_GEN'],
    blankFor: [],
    note: 'm / t / c.',
  },
  network: {
    token: '{network}',
    reliableFor: ['SEARCH', 'PERFORMANCE_MAX', 'DISPLAY', 'VIDEO', 'SHOPPING', 'DEMAND_GEN'],
    blankFor: [],
    note: 'Click source.',
  },
}

/**
 * Recommended Final URL suffix for a campaign type.
 * Keyword-derived parameters are omitted where Google documents a blank value, so the client never
 * sees an empty utm_term that looks like missing data.
 */
export function recommendedFinalUrlSuffix(campaignType: AdsCampaignType): string {
  const parts = [
    'utm_source=google',
    'utm_medium=cpc',
    'utm_campaign={campaignid}',
  ]
  const keywordSafe = campaignType === 'SEARCH'
  if (campaignType !== 'PERFORMANCE_MAX') parts.push('utm_content={creative}')
  if (keywordSafe) parts.push('utm_term={keyword}')
  return parts.join('&')
}

export interface SuffixFinding {
  severity: 'error' | 'warning' | 'info'
  message: string
}

/**
 * Validate an observed Final URL suffix without changing it.
 * Reports parameters that will resolve blank for this campaign type, and structural problems.
 */
export function validateFinalUrlSuffix(suffix: string, campaignType: AdsCampaignType): SuffixFinding[] {
  const findings: SuffixFinding[] = []
  const value = (suffix ?? '').trim()
  if (value === '') {
    findings.push({ severity: 'info', message: 'No Final URL suffix is configured for this campaign.' })
    return findings
  }
  if (value.startsWith('?') || value.startsWith('&')) {
    findings.push({
      severity: 'error',
      message: 'A Final URL suffix must not begin with "?" or "&"; Google appends it to the landing URL.',
    })
  }
  for (const [name, param] of Object.entries(VALUETRACK_PARAMETERS)) {
    if (!value.includes(param.token)) continue
    if (param.blankFor.includes(campaignType)) {
      findings.push({
        severity: 'warning',
        message: `${param.token} resolves to a blank value on ${campaignType} campaigns. ${param.note}`,
      })
    } else if (name === 'keyword' && campaignType !== 'SEARCH') {
      findings.push({
        severity: 'warning',
        message: `${param.token} is only reliable on Search campaigns. ${param.note}`,
      })
    }
  }
  const unknownTokens = (value.match(/\{[a-z_]+\}/gi) ?? [])
    .filter(token => !Object.values(VALUETRACK_PARAMETERS).some(p => p.token === token))
  for (const token of new Set(unknownTokens)) {
    findings.push({ severity: 'info', message: `${token} is not a ValueTrack parameter recognised by this contract.` })
  }
  return findings
}

// ── Readiness reporting (read-only) ─────────────────────────────────────────

export type TrackingReadiness = 'ready' | 'attention' | 'not-ready' | 'unknown'

export interface TrackingObservation {
  /** Auto-tagging state from the Ads account, or null when it could not be read. */
  autoTaggingEnabled: boolean | null
  /** Observed Final URL suffix, or null when not readable. */
  finalUrlSuffix: string | null
  campaignType: AdsCampaignType
  /** True when a GA4 property is mapped for this exact client. */
  ga4PropertyMapped: boolean
}

export interface TrackingReport {
  readiness: TrackingReadiness
  findings: SuffixFinding[]
  /** What CA would need to authorise. Empty when nothing is required. */
  requiredGatedChanges: string[]
}

/**
 * Report the Ads↔GA4 tracking posture truthfully. Auto-tagging/GCLID is the primary mechanism;
 * the suffix is a readable cross-check, not a replacement. Nothing here mutates the account.
 */
export function assessTrackingReadiness(observation: TrackingObservation): TrackingReport {
  const findings: SuffixFinding[] = []
  const gated: string[] = []

  if (observation.autoTaggingEnabled === null) {
    findings.push({ severity: 'info', message: 'Auto-tagging state could not be read for this account.' })
  } else if (observation.autoTaggingEnabled) {
    findings.push({ severity: 'info', message: 'Auto-tagging is enabled; GCLID is the primary Ads to Analytics attribution path.' })
  } else {
    findings.push({
      severity: 'warning',
      message: 'Auto-tagging is disabled, so GCLID-based attribution is unavailable and GA4 must rely on the URL suffix.',
    })
    gated.push('Enable Google Ads auto-tagging (changes a live account setting).')
  }

  findings.push(...validateFinalUrlSuffix(observation.finalUrlSuffix ?? '', observation.campaignType))
  if (!observation.finalUrlSuffix) {
    gated.push(`Apply Final URL suffix "${recommendedFinalUrlSuffix(observation.campaignType)}" (changes live campaign tracking).`)
  }

  if (!observation.ga4PropertyMapped) {
    findings.push({ severity: 'warning', message: 'No GA4 property is mapped for this exact client.' })
    gated.push('Map an exact GA4 property and approved website domain(s) for this client.')
  }

  let readiness: TrackingReadiness = 'ready'
  if (observation.autoTaggingEnabled === null && !observation.finalUrlSuffix) readiness = 'unknown'
  else if (!observation.ga4PropertyMapped) readiness = 'not-ready'
  else if (findings.some(f => f.severity === 'error')) readiness = 'not-ready'
  else if (findings.some(f => f.severity === 'warning')) readiness = 'attention'

  return { readiness, findings, requiredGatedChanges: gated }
}
