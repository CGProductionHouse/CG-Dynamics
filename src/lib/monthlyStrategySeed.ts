export interface ApprovedContextUpdate {
  id: string
  title: string
  body?: string | null
  decisions?: unknown
}

export interface BaselineEvidence {
  authority: 'client_guide' | 'client_context_update' | 'monthly_deliverables'
  source_id: string
  field: 'clientDirection' | 'strategyDrivers'
  excerpt: string
}

export interface MonthlyBaselineInput {
  clientName: string
  guideId?: string | null
  readyGuideMarkdown?: string | null
  contextUpdates: ApprovedContextUpdate[]
  previousDirection: string[]
  previousDrivers: string[]
  deliverables: Array<{ id: string; deliverable_type: string }>
}

const MAX_SIGNAL_LENGTH = 180
const SAFE_GUIDE_HEADING = /(identity|positioning|audience|human marketing|marketing voice|content ideas|recurring formats|content[, /]+reels|reels? \/ video|social\/content lessons|visual direction|working rule|bottom line)/i
const UNSAFE_GUIDE_HEADING = /(contact|address|website|hashtag|freshness|unresolved|mistakes|guardrail)/i
const UNSAFE_SIGNAL = /(@|https?:\/\/|www\.|\+\d|\b\d{2,4}[ -]\d{3}[ -]\d{3,4}\b)/i
const ADMINISTRATIVE_SIGNAL = /^(canonical cg client|public trading style)\s*:/i

function cleanSignal(value: string): string {
  const cleaned = value
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:]$/, '')
  if (cleaned.length <= MAX_SIGNAL_LENGTH) return cleaned
  const bounded = cleaned.slice(0, MAX_SIGNAL_LENGTH + 1)
  return bounded.slice(0, bounded.lastIndexOf(' ')).replace(/[.;:,]$/, '')
}

function uniqueSignals(values: string[], limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const value = cleanSignal(raw)
    const key = value.toLocaleLowerCase()
    if (value.length < 12 || UNSAFE_SIGNAL.test(value) || ADMINISTRATIVE_SIGNAL.test(value) || seen.has(key)) continue
    seen.add(key)
    result.push(value)
    if (result.length === limit) break
  }
  return result
}

/**
 * Reads only bounded strategy-oriented snippets from a reviewed, runtime-ready
 * client guide. Contact, freshness, unresolved-fact and guardrail sections are
 * deliberately excluded from automatic campaign direction.
 */
export function extractReadyGuideSignals(markdown: string): string[] {
  const candidates: string[] = []
  let safeSection = false
  let unsafeSubsection = false

  for (const rawLine of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = rawLine.match(/^(#{2,4})\s+(.+)$/)
    if (heading) {
      const title = cleanSignal(heading[2])
      if (heading[1].length === 2) {
        safeSection = SAFE_GUIDE_HEADING.test(title) && !UNSAFE_GUIDE_HEADING.test(title)
        unsafeSubsection = false
      } else {
        unsafeSubsection = UNSAFE_GUIDE_HEADING.test(title)
      }
      continue
    }
    if (!safeSection || unsafeSubsection) continue

    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (/^(use|avoid|prefer|rules?|do not|never):?$/i.test(cleanSignal(line))) continue

    const isBullet = /^[-*+]\s+/.test(line)
    const isNamedStrategyFact = /^(primary audience|business|positioning|content (priority|focus)|brand voice)\s*:/i.test(cleanSignal(line))
    if (isBullet || isNamedStrategyFact) candidates.push(line)
  }

  return uniqueSignals(candidates, 4)
}

function decisionStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(decisionStrings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(decisionStrings)
  return []
}

function deliverableDriver(clientName: string, deliverables: MonthlyBaselineInput['deliverables']): string {
  const labels: Record<string, [string, string]> = {
    video: ['professional video', 'professional videos'],
    reel: ['reel', 'reels'],
    photo: ['photo post', 'photo posts'],
    dp: ['design poster', 'design posters'],
  }
  const counts = new Map<string, number>()
  for (const row of deliverables) counts.set(row.deliverable_type, (counts.get(row.deliverable_type) ?? 0) + 1)
  const parts = [...counts.entries()]
    .filter(([type]) => labels[type])
    .map(([type, count]) => `${count} ${labels[type][count === 1 ? 0 : 1]}`)

  return parts.length > 0
    ? `deliver ${clientName}'s recorded monthly mix of ${parts.join(', ')}`
    : `prepare a conservative ${clientName} draft while priority details are confirmed`
}

export function buildMonthlyBaseline(input: MonthlyBaselineInput): {
  clientDirection: string[]
  strategyDrivers: string[]
  evidence: BaselineEvidence[]
} {
  const evidence: BaselineEvidence[] = []
  const updateSignals: string[] = []
  const updateEvidenceCandidates: Array<{ sourceId: string; signal: string }> = []

  for (const update of input.contextUpdates) {
    const signals = uniqueSignals([update.body ?? '', ...decisionStrings(update.decisions), update.title], 2)
    for (const signal of signals) {
      updateSignals.push(signal)
      updateEvidenceCandidates.push({ sourceId: update.id, signal })
    }
  }

  const guideSignals = input.readyGuideMarkdown ? extractReadyGuideSignals(input.readyGuideMarkdown) : []
  const clientDirection = uniqueSignals([...updateSignals, ...input.previousDirection], 5)
  const strategyDrivers = uniqueSignals([
    ...input.previousDrivers,
    ...guideSignals.map(signal => `centre content on ${signal.charAt(0).toLocaleLowerCase()}${signal.slice(1)}`),
  ], 6)

  for (const candidate of updateEvidenceCandidates) {
    if (clientDirection.includes(candidate.signal)) {
      evidence.push({
        authority: 'client_context_update',
        source_id: candidate.sourceId,
        field: 'clientDirection',
        excerpt: candidate.signal,
      })
    }
  }

  if (input.guideId) {
    for (const signal of guideSignals) {
      const generatedDriver = `centre content on ${signal.charAt(0).toLocaleLowerCase()}${signal.slice(1)}`
      if (strategyDrivers.includes(generatedDriver)) {
        evidence.push({ authority: 'client_guide', source_id: input.guideId, field: 'strategyDrivers', excerpt: signal })
      }
    }
  }

  if (strategyDrivers.length === 0) {
    const fallback = deliverableDriver(input.clientName, input.deliverables)
    strategyDrivers.push(fallback, 'confirm client priorities before adding offer, event or campaign claims')
    if (input.deliverables.length > 0) {
      evidence.push({
        authority: 'monthly_deliverables',
        source_id: input.deliverables.map(row => row.id).join(','),
        field: 'strategyDrivers',
        excerpt: fallback,
      })
    }
  }

  return { clientDirection, strategyDrivers, evidence }
}
