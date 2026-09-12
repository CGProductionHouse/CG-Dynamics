// AI Content Director modes for suggest-content-videos (#224).
//
// 'ideas'   Plan an ordered set of client-specific video IDEAS (no scripts). Staff accept, edit and
//           reorder them inside the Content Run's ONE canonical guideline.
// 'develop' For the guideline's SAVED videos — their saved order and staff edits are authoritative —
//           write the script, shot plan, requirements, visual direction and CTA. Titles and order are
//           never changed here; the app never silently overwrites a field staff have already written.
//
// Pure: no network, no Deno APIs. The handler supplies context and calls the AI router.

import { ANTI_SLOP_PATTERNS, HUMAN_CREATIVE_STANDARD } from '../_shared/humanCreativeStandard.ts'

export const DIRECTOR_MODES = ['suggest', 'ideas', 'develop'] as const
export type DirectorMode = typeof DIRECTOR_MODES[number]

export const MAX_IDEAS = 12
export const MAX_DEVELOP_VIDEOS = 12
export const IDEAS_MAX_OUTPUT_TOKENS = 3000
export const DEVELOP_MAX_OUTPUT_TOKENS = 4000
export const RESEARCH_MAX_OUTPUT_TOKENS = 1200
export const CLIENT_GUIDE_MAX_CHARS = 9000

/** How each piece of reasoning is grounded. Fresh research must cite a real grounding source. */
export const EVIDENCE_KINDS = ['client_fact', 'cg_knowledge', 'fresh_research', 'inference', 'needs_confirmation'] as const
export type EvidenceKind = typeof EVIDENCE_KINDS[number]

export interface IdeaEvidence {
  kind: EvidenceKind
  note: string
  sourceUri: string | null
}

export interface VideoIdea {
  title: string
  objective: string
  audience: string
  hook: string
  angle: string
  deliverableId: string | null
  targetMonth: string | null
  evidence: IdeaEvidence[]
  needsConfirmation: string | null
}

export interface DevelopTarget {
  id: string
  position: number
  title: string
  objective: string | null
  hook: string | null
  notes: string | null
  targetMonth: string | null
  deliverableLabel: string | null
}

export interface VideoDevelopment {
  videoId: string
  script: string
  shotBreakdown: string
  requirements: string
  visualNotes: string
  cta: string
  notes: string | null
}

export interface ScheduleSlot {
  id: string
  code: string | null
  title: string | null
  month: string
  deliverableType: string
}

export interface ResearchInput {
  findings: string[]
  sources: Array<{ title: string; uri: string }>
}

// Same rule as src/lib/contentGuidelineNaming.ts: the number comes from the saved order.
const NUMBER_PREFIX = /^\s*video\s*[#:.]?\s*\d{1,3}\s*(?:[-–—:|.]\s*|$)/i

export function isDirectorMode(value: unknown): value is DirectorMode {
  return typeof value === 'string' && (DIRECTOR_MODES as readonly string[]).includes(value)
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** A short descriptive name: no "Video N -" prefix, no wrapping quotes. */
export function cleanIdeaTitle(value: unknown): string {
  return text(value, 200).replace(/^["'“”]+|["'“”]+$/g, '').replace(NUMBER_PREFIX, '').trim().slice(0, 80)
}

/** The exact-client guide, trimmed at a paragraph boundary so it fits the prompt. */
export function clientGuideExcerpt(markdown: string | null | undefined, maxChars = CLIENT_GUIDE_MAX_CHARS): string {
  const guide = (markdown ?? '').trim()
  if (guide.length <= maxChars) return guide
  const cut = guide.lastIndexOf('\n\n', maxChars)
  return `${guide.slice(0, cut > maxChars / 2 ? cut : maxChars).trim()}\n\n[Client guide truncated for length.]`
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const attempts = [raw.trim()]
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) attempts.push(fenced[1].trim())
  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  if (first > -1 && last > first) attempts.push(raw.slice(first, last + 1))
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      // try the next shape
    }
  }
  return null
}

function parseEvidence(value: unknown, researchUris: Set<string>): IdeaEvidence[] {
  if (!Array.isArray(value)) return []
  const out: IdeaEvidence[] = []
  for (const item of value.slice(0, 6)) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    const note = text(entry.note, 400)
    if (!note) continue
    let kind = (EVIDENCE_KINDS as readonly string[]).includes(entry.kind as string) ? entry.kind as EvidenceKind : 'inference'
    const uri = text(entry.sourceUri, 1000)
    const sourceUri = uri && researchUris.has(uri) ? uri : null
    // Fresh research is only fresh research when it cites a real grounding source from this session.
    if (kind === 'fresh_research' && !sourceUri) kind = 'inference'
    out.push({ kind, note, sourceUri: kind === 'fresh_research' ? sourceUri : null })
  }
  return out
}

/**
 * Keep only well-formed ideas. Deliverable links must be one of this client's schedule slots
 * (each used once), target months must be coverage months, titles are de-duplicated.
 */
export function parseIdeas(
  raw: string,
  allowed: { deliverableIds: Set<string>; months: Set<string>; researchUris: Set<string> },
): VideoIdea[] {
  const parsed = parseJsonObject(raw)
  const list = Array.isArray(parsed?.ideas) ? parsed!.ideas as unknown[] : []
  const seenTitles = new Set<string>()
  const usedDeliverables = new Set<string>()
  const ideas: VideoIdea[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const idea = item as Record<string, unknown>
    const title = cleanIdeaTitle(idea.title)
    const objective = text(idea.objective, 500)
    const hook = text(idea.hook, 400)
    if (!title || !objective || !hook) continue
    const key = title.toLowerCase()
    if (seenTitles.has(key)) continue
    seenTitles.add(key)
    const deliverable = text(idea.deliverableId, 64)
    const deliverableId = deliverable && allowed.deliverableIds.has(deliverable) && !usedDeliverables.has(deliverable) ? deliverable : null
    if (deliverableId) usedDeliverables.add(deliverableId)
    const month = text(idea.targetMonth, 7)
    ideas.push({
      title,
      objective,
      audience: text(idea.audience, 300),
      hook,
      angle: text(idea.angle, 600),
      deliverableId,
      targetMonth: allowed.months.has(month) ? month : null,
      evidence: parseEvidence(idea.evidence, allowed.researchUris),
      needsConfirmation: text(idea.needsConfirmation, 400) || null,
    })
    if (ideas.length >= MAX_IDEAS) break
  }
  return ideas
}

/** Keep only developments for the requested saved videos, one each, in the saved order. */
export function parseDevelopments(raw: string, targets: DevelopTarget[]): VideoDevelopment[] {
  const parsed = parseJsonObject(raw)
  const list = Array.isArray(parsed?.developments) ? parsed!.developments as unknown[] : []
  const byId = new Map<string, VideoDevelopment>()
  const targetIds = new Set(targets.map((target) => target.id))
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const dev = item as Record<string, unknown>
    const videoId = text(dev.videoId, 64)
    const script = text(dev.script, 6000)
    if (!targetIds.has(videoId) || byId.has(videoId) || !script) continue
    byId.set(videoId, {
      videoId,
      script,
      shotBreakdown: text(dev.shotBreakdown, 4000),
      requirements: text(dev.requirements, 2000),
      visualNotes: text(dev.visualNotes, 2000),
      cta: text(dev.cta, 400),
      notes: text(dev.notes, 600) || null,
    })
  }
  return targets.flatMap((target) => byId.get(target.id) ?? [])
}

/** Short findings from a web-grounded research answer. */
export function parseResearchFindings(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length >= 12)
    .slice(0, 8)
    .map((line) => line.slice(0, 400))
}

const SHARED_RULES = [
  'Never invent client facts: no products, prices, offers, stock, locations, people, awards, claims or social accounts that the client guide does not state.',
  'Anything you are unsure of goes in needsConfirmation (ideas) or notes (develop) — never present it as fact.',
  'Do not reference or reuse any other client.',
  'Human creative standard:',
  ...HUMAN_CREATIVE_STANDARD.map((rule) => `- ${rule}`),
  `Never use these filler patterns: ${ANTI_SLOP_PATTERNS.join('; ')}.`,
]

function researchBlock(research: ResearchInput | null): string[] {
  if (!research || research.findings.length === 0) {
    return ['## Fresh external research', '  - NOT PERFORMED for this session. Do not label anything as fresh_research.']
  }
  return [
    '## Fresh external research (web-grounded, this session) — INPUT, not truth',
    ...research.findings.map((finding) => `  - ${finding}`),
    '  Sources (cite the exact URI in sourceUri when an idea relies on one):',
    ...research.sources.map((source) => `  - ${source.title} — ${source.uri}`),
    '  Only use a trend if it fits this client and audience, suits the brand voice, is practical for CG to shoot, is not already stale, and has no music/copyright/claim risk. Saying a trend is not worth using is a valid outcome.',
  ]
}

export function buildIdeasPrompt(input: {
  clientName: string
  guideExcerpt: string
  coverageMonths: string[]
  slots: ScheduleSlot[]
  existingTitles: string[]
  historicalTitles: string[]
  marketingKnowledge: string[]
  calendar: string[]
  research: ResearchInput | null
}): { system: string; user: string } {
  const system = [
    'You are the Content Director at CG Production House, a South African video production agency, planning a real shoot for ONE exact client.',
    'Produce the video IDEAS for this Content Run — not scripts. Staff will review, edit and reorder them before scripts are written.',
    '',
    'Return ONLY a JSON object: {"ideas":[...]}. No markdown, no commentary.',
    'Each idea: {"title","objective","audience","hook","angle","deliverableId","targetMonth","evidence","needsConfirmation"}',
    '- title: a short descriptive name (3-8 words). Do NOT prefix it with "Video" or a number.',
    '- objective: what this video achieves for this client, specifically.',
    '- audience: who it is for and their buyer stage.',
    '- hook: the first spoken or on-screen line.',
    '- angle: the concrete creative approach and why it suits THIS client (not a generic category idea).',
    '- deliverableId: the id of ONE schedule slot below that this idea fills, or null. Use each slot at most once.',
    '- targetMonth: one coverage month (YYYY-MM) or null.',
    '- evidence: 1-4 items {"kind","note","sourceUri"}; kind is one of client_fact, cg_knowledge, fresh_research, inference, needs_confirmation. fresh_research REQUIRES the exact sourceUri of a listed source.',
    '- needsConfirmation: anything staff must confirm with the client before shooting, or null.',
    '',
    'Order the ideas in the recommended shoot/publish order. Prefer 3-6 strong ideas over filler; never exceed 12.',
    'Every schedule slot should normally be covered by one idea; extra ideas are allowed when they are genuinely strong.',
    ...SHARED_RULES,
  ].join('\n')
  const user = [
    `# Content Run planning: ${input.clientName}`,
    '',
    '## Exact-client guide (verified client knowledge — the ONLY source of client facts)',
    input.guideExcerpt || '  (no client guide text available)',
    '',
    `## Coverage months: ${input.coverageMonths.join(', ')}`,
    '',
    '## Client Schedule slots to fill (read-only; link by id)',
    ...(input.slots.length > 0
      ? input.slots.map((slot) => `  - id=${slot.id} | ${slot.code ?? slot.deliverableType}${slot.title ? ` | ${slot.title}` : ''} | month ${slot.month.slice(0, 7)}`)
      : ['  (no video/reel slots in the coverage window)']),
    '',
    '## Already in this guideline (do not duplicate)',
    ...(input.existingTitles.length > 0 ? input.existingTitles.map((title) => `  - ${title}`) : ['  (none)']),
    '',
    '## Previously approved or produced for this client (avoid repeating)',
    ...(input.historicalTitles.length > 0 ? input.historicalTitles.map((title) => `  - ${title}`) : ['  (none)']),
    '',
    '## Approved CG Marketing Library knowledge',
    ...(input.marketingKnowledge.length > 0 ? input.marketingKnowledge.map((line) => `  - ${line}`) : ['  (none active)']),
    '',
    '## SA calendar anchors (stable, not research)',
    ...(input.calendar.length > 0 ? input.calendar.map((line) => `  - ${line}`) : ['  (none)']),
    '',
    ...researchBlock(input.research),
    '',
    'Return the JSON now.',
  ].join('\n')
  return { system, user }
}

export function buildDevelopPrompt(input: {
  clientName: string
  guideExcerpt: string
  targets: DevelopTarget[]
  marketingKnowledge: string[]
}): { system: string; user: string } {
  const system = [
    'You are the Content Director at CG Production House writing production-ready material for a real shoot for ONE exact client.',
    'Staff have already chosen, named, edited and ordered these videos. Keep each video\'s title, objective, hook and order exactly as given; build on staff notes.',
    '',
    'Return ONLY a JSON object: {"developments":[...]}, one entry per video id given, in the given order.',
    'Each entry: {"videoId","script","shotBreakdown","requirements","visualNotes","cta","notes"}',
    '- script: the complete usable script (30-75 seconds): spoken lines plus on-screen text, opening with the given hook.',
    '- shotBreakdown: a numbered shot list in filming order (shot type, subject, action).',
    '- requirements: the exact people, products, props and location needed.',
    '- visualNotes: visual direction, framing, pace and on-screen text styling.',
    '- cta: one clear call to action consistent with the client guide.',
    '- notes: anything to confirm with the client before filming, or null.',
    ...SHARED_RULES,
  ].join('\n')
  const user = [
    `# Develop the shoot: ${input.clientName}`,
    '',
    '## Exact-client guide (the ONLY source of client facts)',
    input.guideExcerpt || '  (no client guide text available)',
    '',
    '## Approved CG Marketing Library knowledge',
    ...(input.marketingKnowledge.length > 0 ? input.marketingKnowledge.map((line) => `  - ${line}`) : ['  (none active)']),
    '',
    '## Videos to develop (saved order — do not rename or reorder)',
    ...input.targets.map((target) => [
      `### videoId=${target.id} (position ${target.position})`,
      `  title: ${target.title}`,
      `  objective: ${target.objective ?? '(not set)'}`,
      `  hook: ${target.hook ?? '(not set — write one)'}`,
      `  target month: ${target.targetMonth ?? 'unallocated'}`,
      `  schedule slot: ${target.deliverableLabel ?? 'not linked'}`,
      `  staff notes: ${target.notes ?? '(none)'}`,
    ].join('\n')),
    '',
    'Return the JSON now.',
  ].join('\n')
  return { system, user }
}

export function buildResearchPrompt(input: { clientName: string; guideExcerpt: string; coverageMonths: string[] }): { system: string; user: string } {
  return {
    system: [
      'You research what is currently relevant for short-form video content for one South African business.',
      'Use Google Search. Report only what the search results support, as 3-8 short bullet findings.',
      'Cover: current short-form formats and hooks working in this category, relevant local/seasonal moments in the given months, and notable category or competitor activity.',
      'Say plainly when a trend looks stale or unsuitable. Do not invent statistics.',
    ].join('\n'),
    user: [
      `Business: ${input.clientName}`,
      `Months being planned: ${input.coverageMonths.join(', ')}`,
      '',
      'What the business does (from its verified client guide):',
      input.guideExcerpt.slice(0, 2500),
    ].join('\n'),
  }
}
