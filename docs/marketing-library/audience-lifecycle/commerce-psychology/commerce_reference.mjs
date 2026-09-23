/** #426 research reference only. Pure functions; no network, stores or authority.
 * Inputs and review flags are supplied by callers, not independently verified.
 * No output can authorise a campaign, price change, publication or data write.
 */
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = v => typeof v === 'string' && v.trim().length > 0;
const money = n => Math.round((n + Number.EPSILON) * 100) / 100;
function number(v, key, { max = Infinity, integer = false, min = 0 } = {}) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) throw new TypeError(`INVALID_${key}`);
  return v;
}
function month(v) { return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v); }

/** Monetary scenario on one ex-VAT basis. Allowance must not duplicate other costs.
 * Fee is modelled on charged goods + shipping, not a provider-specific fee rule.
 */
export function offerEconomics(x) {
  if (!object(x) || !/^[A-Z]{3}$/.test(x.currency ?? '') || x.priceBasis !== 'ex_vat_scenario') throw new TypeError('INVALID_CURRENCY_OR_BASIS');
  number(x.quantity, 'quantity', { integer: true, min: 1 });
  number(x.discountRate, 'discountRate', { max: 1 });
  number(x.feeRate, 'feeRate', { max: 1 });
  for (const key of ['unitPrice', 'unitCost', 'packaging', 'delivery', 'shippingCollected', 'feeFixed', 'afterSaleAllowance']) number(x[key], key);
  const goodsRevenue = x.unitPrice * x.quantity * (1 - x.discountRate);
  const chargedRevenue = goodsRevenue + x.shippingCollected;
  const paymentFee = chargedRevenue * x.feeRate + x.feeFixed;
  const contribution = chargedRevenue - x.unitCost * x.quantity - x.packaging - x.delivery - paymentFee - x.afterSaleAllowance;
  if (![goodsRevenue, chargedRevenue, paymentFee, contribution].every(Number.isFinite)) throw new RangeError('NUMERIC_OVERFLOW');
  return { currency: x.currency, priceBasis: x.priceBasis, quantity: x.quantity,
    goodsRevenue: money(goodsRevenue), chargedRevenue: money(chargedRevenue), paymentFee: money(paymentFee),
    contribution: money(contribution), contributionPerUnit: money(contribution / x.quantity),
    firstOrderBreakEvenRevenueRoas: contribution > 0 ? chargedRevenue / contribution : null,
    scenarioOnly: true, executionAllowed: false };
}

/** Unconditional offer probabilities; all eligible visitors, including no purchase.
 * Models mutually exclusive first orders in a stated period, not repeat-order LTV.
 */
export function trafficEconomics(offers, eligibleVisitors, mediaSpend) {
  if (!Array.isArray(offers) || offers.length === 0) throw new TypeError('OFFERS_REQUIRED');
  number(eligibleVisitors, 'eligibleVisitors', { integer: true, min: 1 });
  number(mediaSpend, 'mediaSpend');
  const ids = new Set(); let probability = 0, revenue = 0, contribution = 0;
  let currency, priceBasis;
  for (const row of offers) {
    if (!object(row) || !text(row.id) || ids.has(row.id)) throw new TypeError('INVALID_OR_DUPLICATE_OFFER');
    ids.add(row.id); number(row.probability, 'probability', { max: 1 });
    const e = offerEconomics(row.offer);
    if (currency && (currency !== e.currency || priceBasis !== e.priceBasis)) throw new TypeError('MIXED_MONEY_BASIS');
    currency = e.currency; priceBasis = e.priceBasis;
    probability += row.probability;
    revenue += row.probability * e.chargedRevenue;
    contribution += row.probability * e.contribution;
  }
  if (probability > 1 + 1e-12) throw new TypeError('PROBABILITIES_EXCEED_ONE');
  return { currency, eligibleVisitors, purchaseProbability: Math.min(probability, 1),
    noPurchaseProbability: Math.max(0, 1 - probability), expectedOrders: eligibleVisitors * probability,
    averageOrderValue: probability > 0 ? money(revenue / probability) : null,
    revenue: money(revenue * eligibleVisitors), contributionBeforeMedia: money(contribution * eligibleVisitors),
    contributionAfterMedia: money(contribution * eligibleVisitors - mediaSpend),
    contributionPerEligibleVisitor: (contribution * eligibleVisitors - mediaSpend) / eligibleVisitors,
    revenueToMediaRatio: mediaSpend > 0 ? revenue * eligibleVisitors / mediaSpend : null,
    scenarioOnly: true, executionAllowed: false };
}

/** Analysis readiness, not a statistical estimator, root-cause diagnosis or auth.
 * CI, method, maturity and checks must come from an independently reviewed adapter.
 */
export function analysisGate(packet, scope) {
  const result = (status, reasons) => ({ status, reasons, executionAllowed: false,
    publicationAllowed: false, causalityProven: false });
  if (!object(packet) || !object(scope) || !text(scope.clientId) || !month(scope.month) || !text(scope.metric) || !text(scope.unit)) return result('invalid_input', ['INVALID_EXPECTED_SCOPE']);
  if (packet.clientId !== scope.clientId || packet.month !== scope.month || packet.metric !== scope.metric || packet.unit !== scope.unit) return result('scope_blocked', ['EXACT_SCOPE_MISMATCH']);
  if (!text(packet.snapshotId) || !text(packet.snapshotRevision) || !text(packet.population) || packet.dataComplete !== true || packet.dataCurrent !== true || packet.deduplicated !== true || packet.comparable !== true) return result('data_issue', ['DATA_NOT_VERIFIED']);
  if (packet.outcomesMature !== true) return result('await_outcomes', ['OUTCOME_WINDOW_INCOMPLETE']);
  if (!['randomised', 'observational'].includes(packet.design)) return result('invalid_input', ['UNKNOWN_DESIGN']);
  if (packet.design === 'observational') return result('observation_only', ['NO_RANDOMISED_CAUSAL_COMPARISON']);
  if (packet.assignmentLogged !== true || packet.allocationCheck !== 'passed' || packet.preRegistered !== true || packet.interferenceReviewed !== true) return result('invalid_experiment', ['DESIGN_OR_ALLOCATION_NOT_VERIFIED']);
  if (packet.guardrails !== 'passed') return result('hold_guardrail', ['GUARDRAIL_NOT_PASSED']);
  if (packet.analysisReviewed !== true || !text(packet.analysisVersion) || !text(packet.intervalMethod) || !text(packet.outcomeWindow)) return result('needs_analysis_review', ['ANALYSIS_NOT_REVIEWED']);
  const { lower, upper, minimumPracticalEffect, intervalLevel } = packet;
  if (![lower, upper, minimumPracticalEffect, intervalLevel].every(v => typeof v === 'number' && Number.isFinite(v)) || lower > upper || minimumPracticalEffect < 0 || intervalLevel <= 0 || intervalLevel >= 1) return result('invalid_input', ['INVALID_INTERVAL_OR_THRESHOLD']);
  if (lower > minimumPracticalEffect) return result('review_positive', ['LOWER_BOUND_EXCEEDS_PRESPECIFIED_PRACTICAL_EFFECT']);
  if (upper < 0) return result('review_negative', ['UPPER_BOUND_BELOW_ZERO']);
  return result('inconclusive', ['NO_CLEAR_PRACTICAL_DECISION']);
}

/** Synthetic recurring billing model, not accounting recognition or a forecast.
 * Existing customers churn before arrivals; new customers pay a full month.
 */
export function recurringScenario(x) {
  if (!object(x)) throw new TypeError('INVALID_SCENARIO');
  number(x.monthlyPrice, 'monthlyPrice'); number(x.newCustomersEachMonth, 'newCustomersEachMonth', { integer: true });
  number(x.months, 'months', { integer: true, min: 1, max: 120 }); number(x.monthlyChurn, 'monthlyChurn', { max: 1 });
  let active = 0, cumulative = 0; const rows = [];
  for (let m = 1; m <= x.months; m++) {
    active = active * (1 - x.monthlyChurn) + x.newCustomersEachMonth;
    const billed = active * x.monthlyPrice; cumulative += billed;
    if (![active, billed, cumulative].every(Number.isFinite)) throw new RangeError('NUMERIC_OVERFLOW');
    rows.push({ month: m, expectedActive: active, billed: money(billed) });
  }
  return { rows, expectedActiveAtEnd: active, billedDuringPeriod: money(cumulative),
    exitMonthlyRecurringRevenue: money(active * x.monthlyPrice), annualisedExitRunRate: money(active * x.monthlyPrice * 12),
    scenarioOnly: true, forecast: false, profitCalculated: false };
}
