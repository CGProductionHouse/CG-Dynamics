import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isDate, selectGrounding, validateBrief, orderContribution } from './reference.mjs';
const context = () => ({ clientId: 'synthetic-client-a', month: '2026-10', today: '2026-09-19', sources: [], deliverables: [] });
const brief = () => ({ clientId: 'synthetic-client-a', month: '2026-10', channel: 'organic', platform: 'meta',
  objective: 'qualified_enquiry', message: 'Explain the fit', proofPlan: 'Show the actual process', cta: 'Request details',
  landingExperience: 'Matching enquiry page', outcome: 'Qualified enquiry', measurement: 'Record qualification separately from clicks',
  audience: { relationship: 'warm', intent: 'consideration', basis: 'research_inference', deliveryMode: 'organic_mixed' },
  deliverableIds: [], claims: [] });
const source = () => ({ sourceIdentifier: 'https://example.invalid/reference', scope: 'shared', clientId: null, status: 'active',
  sourceAccess: 'full_read', checkedAt: '2026-09-19', validUntil: '2026-10-19' });
const paid = () => { const b = brief(); Object.assign(b, { channel: 'paid', platform: 'tiktok' }); Object.assign(b.audience,
  { deliveryMode: 'strict', marketingUse: 'permitted', suppressionChecked: true, suppressed: false, customAudience: true, matchedUsers: 1000,
    capability: { eligible: true, checkedAt: '2026-09-19', validUntil: '2026-09-20' } }); return b; };
const fails = (b, code, c = context()) => assert.ok(validateBrief(b, c).errors.includes(code), code);

test('synthetic organic draft can pass editorial checks but never execution or publication', () => {
  const r = validateBrief(brief(), context()); assert.equal(r.planningComplete, true);
  assert.equal(r.executionAllowed, false); assert.equal(r.publicationAllowed, false); assert.ok(r.warnings.includes('AUDIENCE_IS_NOT_VERIFIED'));
});
test('null inputs fail closed', () => assert.equal(validateBrief(null, null).planningComplete, false));
test('missing trusted client fails', () => fails(brief(), 'INVALID_TRUSTED_CONTEXT', { ...context(), clientId: '' }));
test('different client fails', () => fails({ ...brief(), clientId: 'synthetic-client-b' }, 'CLIENT_MISMATCH'));
test('different month fails', () => fails({ ...brief(), month: '2026-11' }, 'MONTH_MISMATCH'));
test('invalid calendar month fails', () => fails({ ...brief(), month: '2026-13' }, 'MONTH_MISMATCH'));
test('invalid dates rejected, leap date accepted', () => { assert.equal(isDate('2026-02-30'), false); assert.equal(isDate('2028-02-29'), true); });
for (const field of ['objective', 'message', 'proofPlan', 'cta', 'landingExperience', 'outcome', 'measurement']) test(`missing ${field} is not filled by invention`, () => fails({ ...brief(), [field]: '' }, `MISSING_${field}`));
test('organic cannot claim strict delivery', () => { const b = brief(); b.audience.deliveryMode = 'strict'; fails(b, 'ORGANIC_DELIVERY_IS_MIXED'); });
test('a signal cannot be labelled strict targeting', () => { const b = paid(); b.audience.selectionKind = 'signal'; fails(b, 'SIGNAL_IS_NOT_STRICT_TARGETING'); });
test('verified warm claim needs observation reference', () => { const b = brief(); b.audience.basis = 'verified_fact'; fails(b, 'AUDIENCE_EVIDENCE_REQUIRED'); });
test('verified customer needs conversion evidence, not just engagement', () => { const b = brief(); Object.assign(b.audience, { relationship: 'customer', basis: 'verified_fact', evidenceRefs: ['engagement'] }); fails(b, 'CUSTOMER_CONVERSION_EVIDENCE_REQUIRED'); });
test('cold never proves no prior exposure', () => { const b = brief(); b.audience.relationship = 'cold'; assert.ok(validateBrief(b, context()).warnings.includes('COLD_IS_NOT_PROOF_OF_NO_PRIOR_EXPOSURE')); });
test('customer service recovery blocks automatic upsell', () => { const b = brief(); b.objective = 'upsell'; b.audience.lifecycle = 'service_recovery'; fails(b, 'SERVICE_RECOVERY_REVIEW_REQUIRED'); });
test('suppression overrides paid eligibility', () => { const b = paid(); b.audience.suppressed = true; fails(b, 'SUPPRESSED_OR_UNKNOWN'); });
test('missing suppression check blocks', () => { const b = paid(); delete b.audience.suppressionChecked; fails(b, 'SUPPRESSION_CHECK_REQUIRED'); });
test('list ownership is not permission', () => { const b = paid(); b.audience.marketingUse = 'unknown'; fails(b, 'PERMITTED_USE_UNCONFIRMED'); });
test('999 matched TikTok users fail documented ad-group gate', () => { const b = paid(); b.audience.matchedUsers = 999; fails(b, 'TIKTOK_CUSTOM_AUDIENCE_BELOW_1000_OR_UNKNOWN'); });
test('unknown matched users are not zero or eligibility', () => { const b = paid(); b.audience.matchedUsers = null; fails(b, 'TIKTOK_CUSTOM_AUDIENCE_BELOW_1000_OR_UNKNOWN'); });
test('1000 matched users can pass planning, never authorises execution', () => { const r = validateBrief(paid(), context()); assert.equal(r.planningComplete, true); assert.equal(r.executionAllowed, false); });
test('expired provider capability blocks', () => { const b = paid(); b.audience.capability.validUntil = '2026-09-18'; fails(b, 'PROVIDER_ELIGIBILITY_UNCONFIRMED'); });
test('unknown provider capability blocks', () => { const b = paid(); delete b.audience.capability; fails(b, 'PROVIDER_ELIGIBILITY_UNCONFIRMED'); });
test('exact canonical deliverable linkage passes', () => { const b = brief(); b.deliverableIds = ['d1']; const c = context(); c.deliverables = [{ id: 'd1', clientId: c.clientId, month: c.month }]; assert.equal(validateBrief(b, c).planningComplete, true); });
test('cross-client deliverable denied', () => { const b = brief(); b.deliverableIds = ['d1']; const c = context(); c.deliverables = [{ id: 'd1', clientId: 'other', month: c.month }]; fails(b, 'DELIVERABLE_SCOPE_UNRESOLVED', c); });
test('ambiguous canonical deliverable denied', () => { const b = brief(); b.deliverableIds = ['d1']; const c = context(); const d = { id: 'd1', clientId: c.clientId, month: c.month }; c.deliverables = [d, d]; fails(b, 'DELIVERABLE_SCOPE_UNRESOLVED', c); });
test('duplicate deliverable denied', () => { const b = brief(); b.deliverableIds = ['d1', 'd1']; fails(b, 'DUPLICATE_DELIVERABLE'); });
test('active current shared source is eligible', () => assert.equal(selectGrounding([source()], context()).length, 1));
for (const status of ['draft', 'needs_review', 'reviewed', 'deprecated']) test(`${status} source cannot ground production`, () => assert.equal(selectGrounding([{ ...source(), status }], context()).length, 0));
test('client source never crosses clients', () => assert.equal(selectGrounding([{ ...source(), scope: 'client', clientId: 'other' }], context()).length, 0));
test('private client source cannot masquerade as shared', () => assert.equal(selectGrounding([{ ...source(), clientId: 'other' }], context()).length, 0));
test('future access and stale sources excluded', () => { assert.equal(selectGrounding([{ ...source(), checkedAt: '2026-09-20' }], context()).length, 0); assert.equal(selectGrounding([{ ...source(), validUntil: '2026-09-18' }], context()).length, 0); });
test('blocked source excluded even when status active', () => assert.equal(selectGrounding([{ ...source(), sourceAccess: 'blocked' }], context()).length, 0));
test('verified claim requires approved source', () => { const b = brief(); b.claims = [{ basis: 'verified_fact', checkedAt: '2026-09-19', validUntil: '2026-09-20', sourceIdentifiers: ['unapproved'] }]; fails(b, 'CLAIM_SOURCE_NOT_APPROVED_CURRENT_AND_SCOPED'); });
test('stale claim cannot be rescued by active source', () => { const b = brief(), c = context(); c.sources = [source()]; b.claims = [{ basis: 'verified_fact', checkedAt: '2026-09-01', validUntil: '2026-09-18', sourceIdentifiers: [source().sourceIdentifier] }]; fails(b, 'CLAIM_STALE_OR_UNDATED', c); });
test('missing economics remain null', () => assert.deepEqual(orderContribution({ netRevenue: 1000 }), { contribution: null, breakEvenRevenueRoas: null }));
test('synthetic contribution calculation is correct', () => assert.deepEqual(orderContribution({ netRevenue: 1000, productCost: 450, fulfilmentCost: 80, paymentFees: 30, otherVariableCosts: 40 }), { contribution: 400, breakEvenRevenueRoas: 2.5 }));
test('loss does not yield a profitable ROAS threshold', () => assert.equal(orderContribution({ netRevenue: 100, productCost: 150, fulfilmentCost: 0, paymentFees: 0, otherVariableCosts: 0 }).breakEvenRevenueRoas, null));
test('NaN and numeric strings are not fabricated economics', () => { for (const netRevenue of [NaN, Infinity, '100', -1]) assert.equal(orderContribution({ netRevenue, productCost: 0, fulfilmentCost: 0, paymentFees: 0, otherVariableCosts: 0 }).contribution, null); });
test('validator leaves input unchanged', () => { const b = brief(), c = context(), before = JSON.stringify([b, c]); validateBrief(b, c); assert.equal(JSON.stringify([b, c]), before); });
test('source pack is review-only, uniquely keyed and internally referenced', () => {
  const p = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'));
  assert.equal(p.activationAllowed, false); assert.equal(p.status, 'needs_review');
  assert.equal(new Set(p.sources.map(s => s.sourceIdentifier)).size, p.sources.length);
  assert.equal(new Set(p.candidates.map(c => c.candidateKey)).size, p.candidates.length);
  assert.ok(p.sources.every(s => s.status === 'needs_review' && s.trustTier === 'needs_review'));
  const keys = new Set(p.sources.map(s => s.key));
  assert.ok(p.candidates.every(c => c.status === 'needs_review' && c.lastReviewed === null && c.sourceKeys.every(k => keys.has(k))));
  assert.ok(p.sources.filter(s => s.sourceAccess !== 'full_read').every(s => s.finding === null));
});
