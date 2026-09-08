// clientGuideGenerator.ts
// Generates Client Guide .md (export-only) and short Project Instructions
// from canonical Dynamics intelligence.
//
// The generated .md is an EXPORT/DEBUG artifact, NOT a runtime dependency.
// ChatGPT Projects retrieve current intelligence at task time via the
// get-client-context Edge Function. The .md exists for human handoff and
// debugging only.
//
// The intelligence packs are stored in docs/ai-workforce/client-intelligence/.
// The generation extracts common section types that appear across all clients.

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
 * Generate a Client Guide .md (export-only) and Project Instructions
 * from a canonical intelligence pack.
 *
 * The .md is a human-readable export artifact. The Project Instructions
 * include the live retrieval path so ChatGPT Projects retrieve current
 * intelligence at task time instead of relying on a static .md snapshot.
 *
 * @param packContent - The full markdown content of the intelligence pack
 * @param clientName - The canonical client name
 * @returns Generated guide markdown (export-only) and short project instructions
 */
export function generateClientGuide(
  packContent: string,
  clientName: string,
): GeneratedGuide {
  const sections: string[] = []

  // 1. Title and intro — mark as export-only artifact
  sections.push(`# ${clientName} — CG Dynamics Client Guide`)
  sections.push('')
  sections.push('**This is an export-only artifact.** CG Dynamics is the permanent client source of truth. ChatGPT Projects retrieve current intelligence at task time via the CG Dynamics bridge — this .md file is for human handoff and debugging only.')
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
  sections.push('This .md is an export-only artifact, not a runtime dependency. For runtime work, use the CG Dynamics ChatGPT Project bridge (live retrieval at task time). Update CG Dynamics as the single source of truth.')
  sections.push('')

  const guideMarkdown = sections.join('\n')

  // Generate short Project Instructions with live retrieval path
  const projectInstructions = generateProjectInstructions(clientName)

  return { guideMarkdown, projectInstructions }
}

/**
 * Generate short ChatGPT Project Instructions with live retrieval path.
 *
 * These instructions contain durable, low-drift rules plus the canonical
 * client intelligence location. They do NOT require a static .md upload.
 * ChatGPT retrieves current intelligence at task time.
 */
function generateProjectInstructions(clientName: string): string {
  const lines = [
    `# ${clientName} — ChatGPT Project Instructions`,
    '',
    '## Your role',
    `You are the CG Production House marketing AI for ${clientName}. CG Dynamics is the permanent source of truth.`,
    '',
    '## How to retrieve current client intelligence',
    `For any task that depends on client knowledge, retrieve current canonical intelligence from CG Dynamics at task time.`,
    'Never rely on a previously uploaded .md file — the CG Dynamics record is always fresher.',
    '',
    '## Durable rules (low-drift)',
    `- Client name: ${clientName}`,
    '- Source of truth: CG Dynamics (not this Project)',
    '- Human, non-generic writing — never sound like AI',
    '- Captions add to artwork/video rather than repeat it',
    '- Max 5 hashtags, dynamically chosen for current topic/platform/search intent',
    '- Image editing preserves real people/products/branding/proportions',
    '- Never invent mutable facts; flag conflicts/gaps, never guess',
    '- Never fuzzy-match this client to another client',
    '',
    '## Task-time retrieval rules',
    '- Caption/content → fetch voice rules, caption rules, factual guardrails, dynamic SEO/hashtag guidance',
    '- Image editing → fetch visual/image rules, exact client branding/product constraints',
    '- Factual claims → fetch verified facts, provenance, freshness state',
    '- SEO/hashtags → choose 3-5 dynamically for exact topic/platform; do not reuse a saved bank',
  ]

  return lines.join('\n')
}
