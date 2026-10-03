/** Briefing extraction only. A reviewed guide is not a completed strategy. */
export function extractStrategyDossierEvidence(markdown, runtimeGuide = false) {
  const sections = { facts: [], constraints: [], observations: [], recommendations: [], internalGuidance: [] }
  let bucket = runtimeGuide ? null : 'facts'
  for (const raw of markdown.split(/\r?\n/)) {
    const heading = raw.match(/^(#{1,4})\s+(.+)/)
    if (heading) {
      const title = heading[2].toLowerCase().replace(/[-_/]/g, ' ')
      if (/avoid|constraint|guardrail|must not|risk|compliance|freshness|unknown|unresolved/.test(title)) bucket = 'constraints'
      else if (/voice|language|caption|footer|contact|task.*retrieval|project instructions|handoff|source hierarchy|image.*edit|image.*generat|seo|hashtag|text on post|creative standard|working rule/.test(title)) bucket = 'internalGuidance'
      else if (/performance|observation|competitor|pattern|signal|what happened|seasonal|cultural/.test(title)) bucket = 'observations'
      else if (/recommend|strategy|opportunit|content pillar|content ideas|content.*format|content that suits|campaign|next step|plan|poster|reels?|video|creative/.test(title)) bucket = 'recommendations'
      else if (/business|brand|audience|product|service|offer|identity|history|evidence|website|social|client truth|public facts|what .* is/.test(title)) bucket = 'facts'
      else if (heading[1].length <= 2) bucket = runtimeGuide ? null : 'facts'
      continue
    }
    if (!bucket || !raw.trim() || /^\s*>/.test(raw)) continue
    const isListItem = /^\s*(?:[-*]|\d+\.)\s+/.test(raw)
    const cleaned = raw.replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
      .replace(/\[([^\]]+)]\([^\)]+\)/g, '$1').replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim()
    // Keep business-description paragraphs; never substitute later voice bullets.
    const values = isListItem ? [cleaned] : cleaned.split(/(?<=[.!?])\s+/)
    for (const value of values) {
      if (value.length < (bucket === 'constraints' ? 8 : 28) || value.length > 320 || /^(file|commit|issue|branch|status|source|date|scope|canonical client|exact client id):/i.test(value)) continue
      if (runtimeGuide && (/\.(?:md|tsx?|mjs|json)\b|github\.com\/CGProductionHouse\/CG-Dynamics\/(?:issues|pull)\//i.test(value))) continue
      // Identity isolation and wording instructions are production guidance,
      // not facts about customers, priorities or commercial opportunity.
      const target = bucket !== 'constraints' && (/^(keep .*isolated|do not |never |avoid |use natural |write like |captions? |prefer |no influencer|title\s*=|subtitle\s*=)/i.test(value) || /caption|footer|governed.*source|generation time/i.test(value))
        ? 'internalGuidance' : bucket
      if (!sections[target].includes(value) && sections[target].length < (target === 'constraints' ? 40 : 6)) sections[target].push(value)
    }
  }
  return sections
}
