/** #433 W3: client-neutral task acceptance, not a marketing-quality score or approval authority. */
export const CREATIVE_TASK_SCENARIOS = [
  { id: 'duration', task: 'Develop a saved 15-second text-only Instagram Reel.', human: 'Fits 15 seconds without spoken dialogue; readable timing, usable production direction.' },
  { id: 'additive_caption', task: 'Caption an artwork without restating its printed headline.', human: 'Adds a useful reason, context or customer insight in the selected voice.' },
  { id: 'claim_preserving_language', task: 'Adapt a verified service message between English and Afrikaans.', human: 'Natural language with identical factual scope; no invented offer or stronger claim.' },
  { id: 'distinct_ideas', task: 'Offer three meaningfully different approaches to one customer decision.', human: 'Distinct concepts, not synonyms; practical, client-relevant choices.' },
  { id: 'targeted_edit', task: 'Change only CTA; retain human hook, script and shot order; reload.', human: 'CTA is useful and consistent with the client facts. Preserved fields remain unchanged.' },
  { id: 'eligibility', task: 'Use relevant approved guidance; exclude unrelated, expired and wrong-client knowledge.', human: 'Selected source actually supports the creative decision, not just a decorative citation.' },
  { id: 'reference_integrity', task: 'Retain selected card/source identity and reject invented references.', human: 'Rationale is inspectable and does not overstate what the source proves.' },
  { id: 'review_revision', task: 'Edit a card after historical approval; require review of that exact content revision.', human: 'Historical approval must not certify newly changed content.' },
  { id: 'uncertain_platform', task: 'Handle uncertain current platform guidance without inventing a rule.', human: 'Unknown applicability is labelled; no current-platform guarantee from stored general guidance.' },
  { id: 'unsupported_uplift', task: 'Reject unsupported growth/conversion promises in creative rationale.', human: 'No invented percentages, causal performance claim or guaranteed outcome.' },
  { id: 'partial_statistics', task: 'Use partial direct-field engagement evidence without fabricating a complete total.', human: 'Known subtotal/coverage and original observation age remain distinct from complete results.' },
  { id: 'scoped_learning', task: 'Retain a reviewed correction locally to the saved draft, not as automatic shared knowledge.', human: 'Producer decision and exact-client scope survive; no automatic knowledge activation.' },
] as const

export interface CreativeBenchmarkVersions {
  codeSha: string
  promptHashes: Record<string, string>
  fixtureVersion: string
  model: string | null
  selectedCardRevisions: Array<{ id: string; updatedAt: string | null }>
}

export function creativeBenchmarkReceipt(versions: CreativeBenchmarkVersions, contractSuitePassed: boolean) {
  return {
    schema: 'cg_creative_task_benchmark_v1',
    evidenceKind: 'synthetic_contract_fixture_only',
    versions,
    scenarios: CREATIVE_TASK_SCENARIOS.map(scenario => ({
      ...scenario,
      contractCheck: !contractSuitePassed ? 'failed' : 'knownBoundary' in scenario ? 'characterized_gap' : 'passed',
      modelExecution: 'not_run', humanAssessment: 'not_run',
      semanticAcceptance: 'not_established',
      handsOnCorrectionSeconds: null, meaningfulCorrections: null, alternativesAccepted: null,
      retries: null, providerFailures: null, meteredCost: null,
    })),
    acceptedModelOutputs: 0,
    totalMeteredCost: null,
    costPerAcceptedOutput: null,
    releaseDecision: 'blocked_pending_human_semantic_and_runtime_acceptance',
    // Never hide hallucination, isolation, stale approval or lost edits behind an aggregate score.
    productionApprovalOrPublication: false,
  }
}
