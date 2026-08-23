import type { ConfidenceLevel, EvidenceLabel, KnowledgeLayer, RelevantAgent, SourceType } from '../../types/skillCards'

// ── Content batch #200 — behavioural-economics concepts (discovery only) ──────
//
// Captured from CA's reel screenshots and logged as issue #200. This lives
// INSIDE the existing #183/#184 Marketing/Knowledge architecture: each concept
// becomes a review-gated candidate Skill Card linked to a bibliographic source
// record — the same skill_cards + marketing_library_sources model, no parallel
// library and no separate data store.
//
// Governance (matches AGENTS.md and the reel author's instruction):
//  • the reel is DISCOVERY EVIDENCE ONLY — it never becomes production truth;
//  • every candidate enters `needs_review`; nothing is auto-approved or active;
//  • concepts are deduped against knowledge already in the library (the mere
//    exposure effect is already covered, so it is NOT re-registered here);
//  • each concept still needs INDEPENDENT verification against a stronger
//    authoritative source before activation — the source records below are
//    bibliographic pointers (metadata only), not verified full-text ingestions,
//    so no canonical URL/DOI is asserted here;
//  • no client is guessed; every candidate is client_specific = false.

export type DedupStatus = 'new' | 'already_in_library'
export type VerificationStatus = 'needs_independent_verification'

export interface BatchSource {
  /** Stable, non-guessed identifier for idempotent registration. */
  sourceIdentifier: string
  sourceName: string
  /** Author/organisation where a seminal work is well established, else null. */
  author: string | null
  /** Publication year of the seminal work where established, else null. */
  year: number | null
  sourceType: SourceType
}

export interface BatchConcept {
  slug: string
  title: string
  concept: string
  category: string
  knowledgeLayer: KnowledgeLayer
  sourceType: SourceType
  evidenceLabel: EvidenceLabel
  confidenceLevel: ConfidenceLevel
  principle: string
  summary: string
  whyItMatters: string
  howToApply: string[]
  mistakesToAvoid: string[]
  relevantAgents: RelevantAgent[]
  source: BatchSource
  dedupStatus: DedupStatus
  /** Why a concept is treated as already-in-library (dedup rationale). */
  dedupNote: string | null
  verificationStatus: VerificationStatus
}

export const BATCH_ID = 200
export const DISCOVERY_SOURCE = 'CA reel screenshots (content batch #200)'
export const TREAT_AS = 'discovery_evidence_only' as const

export const CONTENT_BATCH_200: BatchConcept[] = [
  {
    slug: 'be-zeigarnik-effect',
    title: 'Zeigarnik effect — open loops hold attention',
    concept: 'Zeigarnik effect',
    category: 'Behavioural economics',
    knowledgeLayer: 'universal_principle',
    sourceType: 'research_paper',
    evidenceLabel: 'proven_principle',
    confidenceLevel: 'medium',
    principle: 'People remember interrupted or unfinished tasks better than completed ones.',
    summary: 'An unresolved "open loop" sustains attention and recall until it is closed, which is why teasers, cliffhangers and progress bars keep audiences engaged.',
    whyItMatters: 'Short-form hooks and multi-step funnels can use an open loop to hold attention — but only when the payoff genuinely resolves it.',
    howToApply: ['Open a reel with a question or tension the content later resolves.', 'Show progress toward a goal (steps left) to pull people to completion.'],
    mistakesToAvoid: ['Do not open a loop the content never closes — it reads as clickbait.', 'Do not treat attention held as proof of persuasion, recall or sales.'],
    relevantAgents: ['copywriting_agent', 'creative_director_agent', 'social_media_strategist'],
    source: { sourceIdentifier: 'concept:zeigarnik-effect', sourceName: 'Zeigarnik, B. (1927), On finished and unfinished tasks (Über das Behalten erledigter und unerledigter Handlungen), Psychologische Forschung.', author: 'Bluma Zeigarnik', year: 1927, sourceType: 'research_paper' },
    dedupStatus: 'new', dedupNote: null, verificationStatus: 'needs_independent_verification',
  },
  {
    slug: 'be-charm-pricing',
    title: 'Charm pricing — price endings affect demand',
    concept: 'Charm pricing',
    category: 'Pricing psychology',
    knowledgeLayer: 'universal_principle',
    sourceType: 'research_paper',
    evidenceLabel: 'market_observation',
    confidenceLevel: 'medium',
    principle: 'Prices ending in 9 (or just-below-round) can lift demand versus a rounded price.',
    summary: 'Left-digit and "9-ending" effects can increase sales, but the size and direction depend on category, framing and whether price signals quality.',
    whyItMatters: 'Offer and landing-page pricing should test charm pricing rather than assume it always wins, especially for premium positioning.',
    howToApply: ['Test a 9-ending against a round price for the same offer before concluding.', 'Weigh charm pricing against premium/quality signalling for the brand.'],
    mistakesToAvoid: ['Do not present charm pricing as a guaranteed uplift in every category.', 'Do not use it where a rounded price better signals premium quality.'],
    relevantAgents: ['marketing_strategist', 'copywriting_agent', 'paid_ads_agent'],
    source: { sourceIdentifier: 'concept:charm-pricing', sourceName: 'Anderson, E. T. & Simester, D. I. (2003), Effects of $9 Price Endings on Retail Sales, Quantitative Marketing and Economics.', author: 'Eric T. Anderson; Duncan I. Simester', year: 2003, sourceType: 'research_paper' },
    dedupStatus: 'new', dedupNote: null, verificationStatus: 'needs_independent_verification',
  },
  {
    slug: 'be-marginal-roas',
    title: 'Marginal ROAS — the next rand, not the average',
    concept: 'Marginal ROAS',
    category: 'Media economics',
    knowledgeLayer: 'universal_principle',
    sourceType: 'professional_source',
    evidenceLabel: 'market_observation',
    confidenceLevel: 'medium',
    principle: 'Scaling decisions should use the return on the NEXT unit of spend, not the blended average ROAS.',
    summary: 'Ad channels show diminishing returns, so average ROAS overstates the value of incremental budget; marginal ROAS is what matters when deciding to scale.',
    whyItMatters: 'Budget-scaling recommendations that cite only average ROAS can push spend past the point where each extra rand loses money.',
    howToApply: ['When advising a budget increase, reason about incremental return, not blended ROAS.', 'Flag diminishing returns and saturation rather than extrapolating average ROAS.'],
    mistakesToAvoid: ['Do not present average ROAS as the return on additional spend.', 'Do not treat a healthy blended ROAS as proof that scaling is profitable.'],
    relevantAgents: ['paid_ads_agent', 'marketing_strategist', 'client_report_agent'],
    source: { sourceIdentifier: 'concept:marginal-roas', sourceName: 'Marginal return on ad spend / diminishing returns in marketing-mix analysis (managerial economics concept — attach an authoritative reference at review).', author: null, year: null, sourceType: 'professional_source' },
    dedupStatus: 'new', dedupNote: null, verificationStatus: 'needs_independent_verification',
  },
  {
    slug: 'be-post-purchase-dissonance',
    title: 'Post-purchase dissonance — reassurance after the sale',
    concept: 'Post-purchase dissonance',
    category: 'Behavioural economics',
    knowledgeLayer: 'universal_principle',
    sourceType: 'book',
    evidenceLabel: 'proven_principle',
    confidenceLevel: 'medium',
    principle: 'Buyers experience doubt after a purchase and seek reassurance that they chose well.',
    summary: 'Derived from cognitive dissonance theory: post-purchase communication (onboarding, confirmation, proof) can reduce regret, returns and churn.',
    whyItMatters: 'Lifecycle and CRM messaging should reassure recent buyers, not just chase the next sale.',
    howToApply: ['Add reassurance to confirmation and onboarding messages (proof, next steps, support).', 'Reinforce the reasons the buyer chose well shortly after purchase.'],
    mistakesToAvoid: ['Do not go silent immediately after the sale.', 'Do not overpromise pre-sale in ways that amplify post-purchase regret.'],
    relevantAgents: ['marketing_strategist', 'copywriting_agent', 'client_report_agent'],
    source: { sourceIdentifier: 'concept:post-purchase-dissonance', sourceName: 'Festinger, L. (1957), A Theory of Cognitive Dissonance, Stanford University Press.', author: 'Leon Festinger', year: 1957, sourceType: 'book' },
    dedupStatus: 'new', dedupNote: null, verificationStatus: 'needs_independent_verification',
  },
  {
    slug: 'be-contribution-margin',
    title: 'Contribution margin — what a sale actually contributes',
    concept: 'Contribution margin',
    category: 'Unit economics',
    knowledgeLayer: 'universal_principle',
    sourceType: 'professional_source',
    evidenceLabel: 'market_observation',
    confidenceLevel: 'medium',
    principle: 'Contribution margin is price minus variable cost — what each sale contributes to fixed costs and profit.',
    summary: 'Marketing profitability (and a defensible CAC/ROAS target) should be judged against contribution margin, not revenue, so campaigns are not called profitable when they are not.',
    whyItMatters: 'Report and strategy recommendations that optimise revenue or ROAS without contribution margin can recommend unprofitable growth.',
    howToApply: ['Frame acceptable acquisition cost against contribution margin, not revenue.', 'State when margin data is missing rather than assuming profitability.'],
    mistakesToAvoid: ['Do not equate revenue growth with profit.', 'Do not set a ROAS/CAC target without knowing the contribution margin.'],
    relevantAgents: ['marketing_strategist', 'client_report_agent', 'paid_ads_agent'],
    source: { sourceIdentifier: 'concept:contribution-margin', sourceName: 'Contribution margin (managerial/marketing accounting concept — attach an authoritative textbook reference at review).', author: null, year: null, sourceType: 'professional_source' },
    dedupStatus: 'new', dedupNote: null, verificationStatus: 'needs_independent_verification',
  },
  {
    slug: 'be-peak-end-rule',
    title: 'Peak-end rule — people judge experiences by peak and end',
    concept: 'Peak-end rule',
    category: 'Behavioural economics',
    knowledgeLayer: 'universal_principle',
    sourceType: 'research_paper',
    evidenceLabel: 'proven_principle',
    confidenceLevel: 'medium',
    principle: 'People remember an experience largely by its most intense moment and its ending, not its average.',
    summary: 'Designing a strong peak and a strong finish (to a video, an event or an onboarding flow) shapes how the whole experience is remembered.',
    whyItMatters: 'Content and customer-journey design should engineer a deliberate peak and ending rather than spreading effort evenly.',
    howToApply: ['Give short-form content a clear peak moment and a deliberate ending.', 'Design the end of onboarding/events to leave a strong final impression.'],
    mistakesToAvoid: ['Do not let content trail off at the end.', 'Do not assume a good average experience is remembered as good.'],
    relevantAgents: ['creative_director_agent', 'copywriting_agent', 'social_media_strategist'],
    source: { sourceIdentifier: 'concept:peak-end-rule', sourceName: 'Kahneman, D., Fredrickson, B. L., Schreiber, C. A. & Redelmeier, D. A. (1993), When More Pain Is Preferred to Less: Adding a Better End, Psychological Science.', author: 'Daniel Kahneman et al.', year: 1993, sourceType: 'research_paper' },
    dedupStatus: 'new', dedupNote: null, verificationStatus: 'needs_independent_verification',
  },
  {
    slug: 'be-mere-exposure-effect',
    title: 'Mere exposure effect (already in library — not re-registered)',
    concept: 'Mere exposure effect',
    category: 'Behavioural economics',
    knowledgeLayer: 'universal_principle',
    sourceType: 'research_paper',
    evidenceLabel: 'proven_principle',
    confidenceLevel: 'medium',
    principle: 'Repeated exposure can increase familiarity and preference — but only under meaningful processing.',
    summary: 'Already represented in the Advertising Evidence Library (Yagi & Inoue 2018; de Zilva et al. 2013) with rights and limitations captured, so this batch does not create a duplicate.',
    whyItMatters: 'Deduping against existing evidence prevents a second, weaker record of a concept the library already holds.',
    howToApply: [],
    mistakesToAvoid: [],
    relevantAgents: ['creative_director_agent', 'marketing_strategist'],
    source: { sourceIdentifier: 'concept:mere-exposure-effect', sourceName: 'Advertising Evidence Library — mere exposure records (existing).', author: null, year: null, sourceType: 'research_paper' },
    dedupStatus: 'already_in_library',
    dedupNote: 'Covered by docs/ai-workforce/ADVERTISING-EVIDENCE-LIBRARY.md evidence records 1–2 and the registered cited sources; not re-registered.',
    verificationStatus: 'needs_independent_verification',
  },
  {
    slug: 'be-choice-overload',
    title: 'Choice overload — too many options can reduce action',
    concept: 'Choice overload / paralysis',
    category: 'Behavioural economics',
    knowledgeLayer: 'universal_principle',
    sourceType: 'research_paper',
    evidenceLabel: 'market_observation',
    confidenceLevel: 'medium',
    principle: 'Adding options can reduce the likelihood of any choice being made, under some conditions.',
    summary: 'Choice overload is real but context-dependent (the effect varies with expertise, preference clarity and how options are presented), so simplification should be tested, not assumed.',
    whyItMatters: 'Offer sets, menus and landing-page CTAs may convert better when simplified — but the effect is conditional.',
    howToApply: ['Reduce or structure options where audiences show hesitation.', 'Test a simplified option set rather than assuming fewer always wins.'],
    mistakesToAvoid: ['Do not state that fewer options always increase conversion.', 'Do not remove genuinely valued choice in the name of simplicity.'],
    relevantAgents: ['marketing_strategist', 'copywriting_agent', 'paid_ads_agent'],
    source: { sourceIdentifier: 'concept:choice-overload', sourceName: 'Iyengar, S. S. & Lepper, M. R. (2000), When Choice is Demotivating: Can One Desire Too Much of a Good Thing?, Journal of Personality and Social Psychology.', author: 'Sheena S. Iyengar; Mark R. Lepper', year: 2000, sourceType: 'research_paper' },
    dedupStatus: 'new', dedupNote: null, verificationStatus: 'needs_independent_verification',
  },
  {
    slug: 'be-loss-aversion',
    title: 'Loss aversion — losses loom larger than gains',
    concept: 'Loss aversion',
    category: 'Behavioural economics',
    knowledgeLayer: 'universal_principle',
    sourceType: 'research_paper',
    evidenceLabel: 'proven_principle',
    confidenceLevel: 'medium',
    principle: 'People weigh potential losses more heavily than equivalent gains.',
    summary: 'From prospect theory: framing an offer around what is lost by inaction can be more motivating than the equivalent gain — used honestly, without manufactured fear.',
    whyItMatters: 'Copy and offer framing can ethically use loss framing, but must avoid manipulation or false scarcity.',
    howToApply: ['Where truthful, frame the cost of inaction alongside the benefit of acting.', 'Use genuine deadlines/limits, never fabricated scarcity.'],
    mistakesToAvoid: ['Do not manufacture fake scarcity or fear.', 'Do not rely on loss framing where it misrepresents the offer.'],
    relevantAgents: ['copywriting_agent', 'marketing_strategist', 'paid_ads_agent'],
    source: { sourceIdentifier: 'concept:loss-aversion', sourceName: 'Kahneman, D. & Tversky, A. (1979), Prospect Theory: An Analysis of Decision under Risk, Econometrica.', author: 'Daniel Kahneman; Amos Tversky', year: 1979, sourceType: 'research_paper' },
    dedupStatus: 'new', dedupNote: null, verificationStatus: 'needs_independent_verification',
  },
]

// Concepts eligible for reviewed registration: the new ones only. Anything
// already represented in the library is excluded so the batch never duplicates
// existing knowledge.
export function batchCandidatesForRegistration(): BatchConcept[] {
  return CONTENT_BATCH_200.filter(c => c.dedupStatus === 'new')
}
