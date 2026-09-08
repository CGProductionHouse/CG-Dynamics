// clientGuideGenerator.ts
// Generates Client Guide .md and short Project Instructions from canonical Dynamics intelligence.
//
// This is a CLIENT-SIDE generation function that reads the intelligence pack
// markdown content (passed in) and extracts the key sections.
//
// The intelligence packs are stored in docs/ai-workforce/client-intelligence/.
// The generation extracts 10 common section types that appear across all clients.

/** Sections common to all client guides. */
const COMMON_SECTIONS = [
  'voice',
  'human marketing',
  'caption',
  'poster',
  'text-on-post',
  'content idea',
  'reel',
  'video',
  'image generation',
  'image editing',
  'product',
  'service',
  'guardrail',
  'freshness',
  'social',
  'content lesson',
  'correction',
  'mistake',
  'avoid',
  'unresolved',
  'unknown',
  'never guess',
] as const

/** Extract sections from a markdown source by matching heading keywords. */
function extractSections(markdown: string, keywords: readonly string[]): string[] {
  const lines = markdown.split('\n')
  const sections: string[] = []
  let inSection = false
  let currentSection: string[] = []

  for (const line of lines) {
    const isHeading = /^#{1,3}\s/.test(line)
    if (isHeading) {
      // Save previous section if it matched
      if (inSection && currentSection.length > 0) {
        sections.push(currentSection.join('\n').trim())
        currentSection = []
      }
      // Check if this heading matches any keyword
      const headingText = line.replace(/^#{1,3}\s+/, '').toLowerCase()
      inSection = keywords.some(kw => headingText.includes(kw))
      if (inSection) {
        currentSection.push(line)
      }
    } else if (inSection) {
      currentSection.push(line)
    }
  }
  // Save last section
  if (inSection && currentSection.length > 0) {
    sections.push(currentSection.join('\n').trim())
  }

  return sections
}

/** Extract the identity/intro section (first heading + paragraphs). */
function extractIdentity(markdown: string): string {
  const lines = markdown.split('\n')
  const result: string[] = []
  let foundFirstHeading = false

  for (const line of lines) {
    if (/^#\s/.test(line) && !foundFirstHeading) {
      foundFirstHeading = true
      result.push(line)
      continue
    }
    if (foundFirstHeading) {
      if (/^#{2,}\s/.test(line)) break // Stop at next ## heading
      result.push(line)
    }
  }

  return result.join('\n').trim()
}

export interface GeneratedGuide {
  guideMarkdown: string
  projectInstructions: string
}

/**
 * Generate a Client Guide and Project Instructions from a canonical intelligence pack.
 *
 * @param packContent - The full markdown content of the intelligence pack
 * @param clientName - The canonical client name
 * @returns Generated guide markdown and short project instructions
 */
export function generateClientGuide(
  packContent: string,
  clientName: string,
): GeneratedGuide {
  const sections: string[] = []

  // 1. Title and intro
  sections.push(`# ${clientName} — CG Dynamics Client Guide`)
  sections.push('')
  sections.push('CG Dynamics is the permanent client source of truth. This document is the current ChatGPT working guide derived from that intelligence. When durable client information changes, update CG Dynamics first and then refresh this guide.')
  sections.push('')

  // 2. Extract identity section
  const identity = extractIdentity(packContent)
  if (identity) {
    sections.push(identity)
    sections.push('')
  }

  // 3. Extract common sections
  const extracted = extractSections(packContent, COMMON_SECTIONS)
  for (const section of extracted) {
    sections.push(section)
    sections.push('')
  }

  // 4. Working rule (closing)
  sections.push('## Working rule')
  sections.push('')
  sections.push('Use this guide first for everyday client work. Consult CG Dynamics for deeper provenance or historical context. Update CG Dynamics before refreshing this guide.')
  sections.push('')

  const guideMarkdown = sections.join('\n')

  // Generate short Project Instructions
  const projectInstructions = generateProjectInstructions(clientName, packContent)

  return { guideMarkdown, projectInstructions }
}

/** Generate short ChatGPT Project Instructions from the intelligence pack. */
function generateProjectInstructions(clientName: string, _packContent: string): string {
  const lines = [
    `# ${clientName} — ChatGPT Project Instructions`,
    '',
    '## Your role',
    `You are the CG Production House marketing AI for ${clientName}.`,
    'CG Dynamics is the permanent source of truth for all client intelligence.',
    '',
    '## How to work',
    `1. Read the Client Guide first — it contains the current voice, rules, guardrails and fresh facts.`,
    '2. When durable client information changes, update CG Dynamics first.',
    '3. Never present stale or superseded information as current truth.',
    '4. Never fuzzy-match this client to another client.',
    '',
    '## Key rules',
    `- Client name: ${clientName}`,
    '- Source of truth: CG Dynamics (not this Project)',
    '- Never invent prices, stock, contact details or operational facts',
    '- When unsure, say so — do not guess',
    '',
    '## Freshness',
    'Mutable facts (prices, contacts, hours, stock, specials) must be confirmed before use.',
    'If a fact cannot be confirmed, label it as unverified.',
  ]

  return lines.join('\n')
}
