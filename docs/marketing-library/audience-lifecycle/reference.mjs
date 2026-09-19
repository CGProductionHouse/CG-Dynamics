/**
 * #426 reference contract. No network, persistence, authentication or execution.
 * Caller-supplied identity/evidence must be resolved by trusted server adapters
 * before production use. Passing these checks NEVER authorises an action.
 */
const text = v => typeof v === 'string' && v.trim().length > 0;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const choices = (v, list) => list.includes(v);
const finiteNonnegative = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function isDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v ?? '')) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v;
}
const current = (v, now) => object(v) && isDate(v.checkedAt) && isDate(v.validUntil)
  && v.checkedAt <= now && now <= v.validUntil && v.checkedAt <= v.validUntil;
const monthOK = v => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Filter already-approved records only. This does not approve or register. */
export function selectGrounding(records, context) {
  if (!Array.isArray(records) || !object(context) || !text(context.clientId) || !isDate(context.today)) return [];
  return records.filter(r => object(r) && r.status === 'active' && text(r.sourceIdentifier)
    && r.sourceAccess === 'full_read' && current(r, context.today)
    && (r.scope === 'shared' && r.clientId === null || r.scope === 'client' && r.clientId === context.clientId));
}

/** Bounded editorial validation, not an access-control or provider gate. */
export function validateBrief(brief, context) {
  const errors = [], warnings = [];
  const result = () => ({ errors, warnings, planningComplete: errors.length === 0,
    executionAllowed: false, publicationAllowed: false });
  if (!object(brief) || !object(context)) { errors.push('INVALID_INPUT'); return result(); }
  if (!text(context.clientId) || !monthOK(context.month) || !isDate(context.today)) errors.push('INVALID_TRUSTED_CONTEXT');
  if (!text(brief.clientId) || brief.clientId !== context.clientId) errors.push('CLIENT_MISMATCH');
  if (!monthOK(brief.month) || brief.month !== context.month) errors.push('MONTH_MISMATCH');
  for (const key of ['objective', 'message', 'proofPlan', 'cta', 'landingExperience', 'outcome', 'measurement']) {
    if (!text(brief[key])) errors.push(`MISSING_${key}`);
  }
  if (!choices(brief.channel, ['organic', 'paid', 'owned'])) errors.push('INVALID_CHANNEL');
  const a = object(brief.audience) ? brief.audience : {};
  if (!choices(a.relationship, ['cold', 'warm', 'customer', 'unknown'])) errors.push('INVALID_RELATIONSHIP');
  if (!choices(a.intent, ['discovery', 'consideration', 'ready_to_act', 'unknown'])) errors.push('INVALID_INTENT');
  if (!choices(a.basis, ['verified_fact', 'client_input', 'research_inference', 'needs_confirmation'])) errors.push('INVALID_AUDIENCE_BASIS');
  if (!choices(a.deliveryMode, ['strict', 'expanded', 'signal', 'organic_mixed', 'unknown'])) errors.push('INVALID_DELIVERY_MODE');
  if (a.relationship === 'cold') warnings.push('COLD_IS_NOT_PROOF_OF_NO_PRIOR_EXPOSURE');
  if (a.basis !== 'verified_fact') warnings.push('AUDIENCE_IS_NOT_VERIFIED');
  if (a.basis === 'verified_fact' && (!Array.isArray(a.evidenceRefs) || !a.evidenceRefs.length || !a.evidenceRefs.every(text))) errors.push('AUDIENCE_EVIDENCE_REQUIRED');
  if (a.relationship === 'customer' && a.basis === 'verified_fact' && !text(a.conversionEvidenceRef)) errors.push('CUSTOMER_CONVERSION_EVIDENCE_REQUIRED');
  if (brief.channel === 'organic' && a.deliveryMode !== 'organic_mixed') errors.push('ORGANIC_DELIVERY_IS_MIXED');
  if (a.selectionKind === 'signal' && a.deliveryMode === 'strict') errors.push('SIGNAL_IS_NOT_STRICT_TARGETING');
  if (brief.channel !== 'organic') {
    if (a.marketingUse !== 'permitted') errors.push('PERMITTED_USE_UNCONFIRMED');
    if (a.suppressionChecked !== true) errors.push('SUPPRESSION_CHECK_REQUIRED');
    if (a.suppressed !== false) errors.push('SUPPRESSED_OR_UNKNOWN');
  }
  if (brief.channel === 'paid') {
    if (!current(a.capability, context.today) || a.capability?.eligible !== true) errors.push('PROVIDER_ELIGIBILITY_UNCONFIRMED');
    if (brief.platform === 'tiktok' && a.customAudience === true && (!finiteNonnegative(a.matchedUsers) || a.matchedUsers < 1000)) errors.push('TIKTOK_CUSTOM_AUDIENCE_BELOW_1000_OR_UNKNOWN');
  }
  if (a.lifecycle === 'service_recovery' && ['upsell', 'cross_sell', 'reactivation'].includes(brief.objective)) errors.push('SERVICE_RECOVERY_REVIEW_REQUIRED');
  if (!Array.isArray(brief.deliverableIds)) errors.push('DELIVERABLE_LIST_REQUIRED');
  else {
    const inventory = Array.isArray(context.deliverables) ? context.deliverables : [];
    if (new Set(brief.deliverableIds).size !== brief.deliverableIds.length) errors.push('DUPLICATE_DELIVERABLE');
    for (const id of brief.deliverableIds) {
      const matches = inventory.filter(d => object(d) && text(id) && d.id === id);
      if (matches.length !== 1 || matches[0].clientId !== context.clientId || matches[0].month !== context.month) errors.push('DELIVERABLE_SCOPE_UNRESOLVED');
    }
  }
  if (!Array.isArray(brief.claims)) errors.push('CLAIMS_LIST_REQUIRED');
  else for (const claim of brief.claims) {
    if (!object(claim) || !choices(claim.basis, ['verified_fact', 'client_input', 'research_inference', 'needs_confirmation'])) { errors.push('INVALID_CLAIM'); continue; }
    if (claim.basis !== 'verified_fact') { warnings.push('CLAIM_REQUIRES_REVIEW'); continue; }
    if (!current(claim, context.today)) errors.push('CLAIM_STALE_OR_UNDATED');
    const approved = new Set(selectGrounding(context.sources, context).map(s => s.sourceIdentifier));
    if (!Array.isArray(claim.sourceIdentifiers) || !claim.sourceIdentifiers.length || claim.sourceIdentifiers.some(s => !approved.has(s))) errors.push('CLAIM_SOURCE_NOT_APPROVED_CURRENT_AND_SCOPED');
  }
  return result();
}

/** Arithmetic only; values in one currency and one consistent order basis. */
export function orderContribution(input) {
  const keys = ['netRevenue', 'productCost', 'fulfilmentCost', 'paymentFees', 'otherVariableCosts'];
  if (!object(input) || !keys.every(k => finiteNonnegative(input[k]))) return { contribution: null, breakEvenRevenueRoas: null };
  const contribution = input.netRevenue - input.productCost - input.fulfilmentCost - input.paymentFees - input.otherVariableCosts;
  return { contribution, breakEvenRevenueRoas: contribution > 0 ? input.netRevenue / contribution : null };
}
