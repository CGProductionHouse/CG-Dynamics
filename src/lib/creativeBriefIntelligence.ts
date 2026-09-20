import type { SkillCardRecord } from './marketing-library/skillCardsData'
import type { MonthlyClientStrategy } from './monthlyStrategy'
import type { MonthlyDeliverable } from './planner'

export interface CreativeBriefInput {
  clientId: string
  month: string
  deliverableId: string
  deliverable: Pick<MonthlyDeliverable, 'id' | 'client_id' | 'month' | 'deliverable_type' | 'title'> | null
  strategy: Pick<MonthlyClientStrategy, 'client_id' | 'strategy_month' | 'strategy_data' | 'workflow_status'> | null
  cards: SkillCardRecord[]
  draft: { objective: string; hook: string; cta: string; shot_breakdown: string; requirements: string }
  today: string
}

export interface CreativeBriefIntelligence {
  ready: boolean
  researchAvailable: boolean
  strategyAlignment: string[]
  audienceIntent: string[]
  creativeJob: string[]
  proofToCapture: string[]
  hookDirection: string[]
  cta: string[]
  productionRequirements: string[]
  needsConfirmation: string[]
  warnings: string[]
  sources: Array<Pick<SkillCardRecord, 'id' | 'title' | 'confidence_level' | 'evidence_label' | 'safe_claim' | 'prohibited_overclaim' | 'source_reference' | 'review_expires_at'>>
}

const clean = (values: Array<string | null | undefined>) => values.map(value => value?.trim() ?? '').filter(Boolean)

export function buildCreativeBriefIntelligence(input: CreativeBriefInput): CreativeBriefIntelligence {
  const base: CreativeBriefIntelligence = {
    ready: false, researchAvailable: false, strategyAlignment: [], audienceIntent: [], creativeJob: [],
    proofToCapture: [], hookDirection: [], cta: [], productionRequirements: [], needsConfirmation: [], warnings: [], sources: [],
  }
  if (!input.clientId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month) || !input.deliverableId) {
    base.needsConfirmation.push('Select an exact client, month and linked deliverable.')
    return base
  }
  const deliverable = input.deliverable
  if (!deliverable || deliverable.id !== input.deliverableId || deliverable.client_id !== input.clientId || deliverable.month !== `${input.month}-01` || deliverable.deliverable_type !== 'video') {
    base.needsConfirmation.push('Linked deliverable identity could not be verified for this client and month.')
    return base
  }
  base.ready = true
  base.strategyAlignment.push(`Linked video: ${deliverable.title || 'Untitled deliverable'}`)
  const strategy = input.strategy?.client_id === input.clientId && input.strategy.strategy_month === `${input.month}-01` ? input.strategy : null
  if (strategy) {
    base.strategyAlignment.push(...clean(strategy.strategy_data.clientDirection).slice(0, 2))
    base.strategyAlignment.push(...clean(strategy.strategy_data.strategyDrivers).slice(0, 2))
    const videoPlan = strategy.strategy_data.actionPlan.professional_video
    if (videoPlan?.enabled) base.creativeJob.push(...clean(videoPlan.items).slice(0, 2))
    base.needsConfirmation.push(...clean(strategy.strategy_data.clientActionsRequired).slice(0, 2))
    if (strategy.workflow_status === 'draft') base.warnings.push('Monthly strategy is a staff draft, not approved or published direction.')
  } else {
    base.needsConfirmation.push('Exact client/month strategy unavailable; confirm the objective and angle.')
  }
  const cards = input.cards.filter(card => card.status === 'active' && !card.client_specific && !card.active_client_id && (!card.review_expires_at || card.review_expires_at >= input.today))
    .sort((a, b) => a.id.localeCompare(b.id)).slice(0, 3)
  base.researchAvailable = cards.length > 0
  for (const card of cards) {
    base.creativeJob.push(...clean(card.how_to_apply).slice(0, 1).map(value => `${card.title}: ${value}`))
    base.warnings.push(...clean([card.prohibited_overclaim]).map(value => `${card.title}: ${value}`))
    base.sources.push({ id: card.id, title: card.title, confidence_level: card.confidence_level, evidence_label: card.evidence_label,
      safe_claim: card.safe_claim, prohibited_overclaim: card.prohibited_overclaim, source_reference: card.source_reference, review_expires_at: card.review_expires_at })
  }
  if (!base.researchAvailable) base.needsConfirmation.push('Approved research unavailable.')
  // A strategy request note is not evidence of an audience or decision stage.
  base.hookDirection = clean([input.draft.hook])
  base.cta = clean([input.draft.cta])
  base.productionRequirements = clean([input.draft.shot_breakdown, input.draft.requirements])
  if (!base.audienceIntent.length) base.needsConfirmation.push('Audience, intent and customer decision question need confirmation.')
  if (!base.proofToCapture.length) base.needsConfirmation.push('Proof to capture and claim substantiation need confirmation.')
  if (!base.hookDirection.length) base.needsConfirmation.push('Hook direction needs confirmation.')
  if (!base.cta.length) base.needsConfirmation.push('CTA and destination need confirmation.')
  if (!base.productionRequirements.length) base.needsConfirmation.push('Shot and production requirements need confirmation.')
  return base
}
