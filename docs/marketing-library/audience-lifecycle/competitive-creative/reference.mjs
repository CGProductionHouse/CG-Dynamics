/** #426 editorial reference helpers. No network, persistence or action authority.
 * All inputs are untrusted until a production server resolves their provenance.
 * Passing these checks is NOT evidence verification or security authorisation.
 */
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const number = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
export function validDate(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(`${x}T00:00:00Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === x;
}
export function httpsReference(x) {
  try { const u = new URL(x); return u.protocol === 'https:' && !u.username && !u.password && !!u.hostname; }
  catch { return false; }
}
const bases = ['platform_disclosed', 'direct_observation', 'vendor_estimate', 'case_report', 'cg_verified_outcome', 'inference', 'synthetic', 'unknown'];
export function assessReference(r, ctx) {
  const issues = [], notes = [];
  const out = () => ({ issues, notes, canEnterReviewedPattern: issues.length === 0,
    externalProfitVerified: false, causalConclusionAllowed: false, mediaCopyAllowed: false,
    publicationAllowed: false, executionAllowed: false });
  if (!obj(r) || !obj(ctx) || !validDate(ctx.today) || !text(ctx.clientId)) {
    issues.push('INVALID_CONTEXT_OR_RECORD'); return out();
  }
  if (!text(r.provider) || !text(r.nativeAdId) || !text(r.advertiserId) || !text(r.familyId)) issues.push('IDENTITY_INCOMPLETE');
  if (!httpsReference(r.sourceUrl)) issues.push('REFERENCE_URL_INVALID');
  if (!bases.includes(r.basis)) issues.push('BASIS_INVALID');
  if (r.scope === 'shared' ? r.clientId !== null : r.scope !== 'client' || r.clientId !== ctx.clientId) issues.push('SCOPE_MISMATCH');
  if (!validDate(r.observedAt) || !validDate(r.validUntil) || r.observedAt > ctx.today || r.validUntil < ctx.today || r.observedAt > r.validUntil) issues.push('STALE_UNDATED_OR_FUTURE');
  if (!['full_video', 'frames', 'still', 'transcript', 'case_text', 'indexed_excerpt'].includes(r.coverage)) issues.push('CONTENT_NOT_INSPECTED');
  if (r.reviewStatus !== 'active') issues.push('NOT_ACTIVE_REVIEWED');
  if (r.isSample === true || r.basis === 'synthetic') issues.push('SAMPLE_IS_NOT_MARKET_EVIDENCE');
  if (r.basis === 'unknown') issues.push('UNKNOWN_BASIS');
  if (r.basis === 'cg_verified_outcome' && (r.scope !== 'client' || !text(r.outcomeRecordRef))) issues.push('OWN_OUTCOME_CONTEXT_REQUIRED');
  if (r.basis === 'vendor_estimate') notes.push('ESTIMATE_NOT_ACCOUNTING_OR_AD_ATTRIBUTION');
  if (r.basis === 'case_report') notes.push('PUBLISHER_REPORT_NOT_INDEPENDENT_CAUSAL_PROOF');
  if (r.coverage !== 'full_video') notes.push('DO_NOT_INVENT_UNSEEN_VIDEO_OR_AUDIO');
  if (r.active === true || number(r.daysObserved)) notes.push('PRESENCE_OR_AGE_DOES_NOT_PROVE_PROFIT');
  if (r.active === false) notes.push('STOPPED_OR_MISSING_DOES_NOT_PROVE_FAILURE');
  if (r.metricUnit === 'percentile' || r.metricUnit === 'relative_curve') notes.push('RELATIVE_METRIC_NOT_CONVERSION_RATE');
  if (r.basis === 'inference') notes.push('HYPOTHESIS_NOT_OBSERVATION');
  return out();
}
/** Count independent identities, not performance or statistical confidence. */
export function summarisePattern(records, ctx) {
  if (!Array.isArray(records)) return { uniqueAds: 0, advertisers: 0, families: 0, excluded: 0, duplicateRows: 0, conflicts: 0, canClaimWinner: false };
  const groups = new Map(); let excluded = 0;
  for (const r of records) {
    if (!assessReference(r, ctx).canEnterReviewedPattern) { excluded++; continue; }
    const key = JSON.stringify([r.provider, r.nativeAdId]);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  let uniqueAds = 0, duplicateRows = 0, conflicts = 0;
  const advertisers = new Set(), families = new Set();
  for (const rows of groups.values()) {
    if (new Set(rows.map(r => JSON.stringify([r.advertiserId, r.familyId]))).size !== 1) { conflicts++; excluded += rows.length; continue; }
    const r = rows[0]; uniqueAds++; duplicateRows += rows.length - 1;
    advertisers.add(JSON.stringify([r.provider, r.advertiserId]));
    families.add(JSON.stringify([r.provider, r.advertiserId, r.familyId]));
  }
  return { uniqueAds, advertisers: advertisers.size, families: families.size, excluded, duplicateRows, conflicts,
    canClaimWinner: false, note: 'Provider-scoped identities; cross-platform brand resolution must be verified separately. Counts are not causal evidence.' };
}
/** A scenario in one declared currency. Capacity value is not guaranteed savings. */
export function toolValue(x) {
  const keys = ['tasks', 'nativeMinutes', 'toolMinutes', 'hourlyValue', 'monthlyFee', 'monthlyQaCost', 'setupCost', 'amortisationMonths'];
  if (!obj(x) || !text(x.currency) || !keys.every(k => number(x[k])) || x.amortisationMonths === 0)
    return { valid: false, capacityValue: null, netPlanningValue: null, currency: null };
  const capacityValue = x.tasks * (x.nativeMinutes - x.toolMinutes) / 60 * x.hourlyValue;
  const netPlanningValue = capacityValue - x.monthlyFee - x.monthlyQaCost - x.setupCost / x.amortisationMonths;
  if (!Number.isFinite(capacityValue) || !Number.isFinite(netPlanningValue)) return { valid: false, capacityValue: null, netPlanningValue: null, currency: null };
  return { valid: true, capacityValue, netPlanningValue, currency: x.currency,
    note: 'Synthetic or user-entered scenario; not a revenue forecast, cash saving or purchase approval.', purchaseAllowed: false };
}
/** Coverage of a defined, deduplicated benchmark only; not total market coverage. */
export function benchmarkCoverage(nativeKeys, candidateKeys) {
  if (!Array.isArray(nativeKeys) || !Array.isArray(candidateKeys) || ![...nativeKeys, ...candidateKeys].every(text)) return null;
  const a = new Set(nativeKeys), all = new Set([...nativeKeys, ...candidateKeys]);
  return all.size ? { native: a.size, union: all.size, nativeShareOfBenchmark: a.size / all.size, marketCoverageKnown: false } : null;
}
