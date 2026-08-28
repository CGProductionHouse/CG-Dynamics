import type { SourceType } from '../../types/skillCards'
import type { SourceTrustTier } from './skillCardsData'

// ── #184 Cited-source extraction (pure) ──────────────────────────────────────
//
// The reusable research packs in `docs/ai-workforce/` are CONTAINERS: each one
// cites many distinct external sources (campaign case studies, books, official
// platform docs, open-access research). Registration must capture those
// UNDERLYING cited sources with their own provenance — not one flattened row per
// markdown file. This module extracts them deterministically from the pack text
// so the app inventory, the generated manifest and the seed migration all derive
// from the same parse (a test re-runs it against the docs to guard drift).
//
// Honoured rules:
//  • every extracted source traces to real citation lines in a real pack file
//    (no fabricated sources, no invented rights);
//  • the stable identifier is the canonical URL when present, else
//    `repo:<path>#<slug>` — never a guessed database id;
//  • rights text is captured VERBATIM into review notes; nothing asserts reuse
//    rights or trust on import (rights_status stays conservative, trust stays
//    needs_review, and the container is registered as a reference too).

export type CitedSourceFamily =
  | 'campaign_case' | 'book' | 'research_paper' | 'official_documentation'
  | 'professional_source' | 'container'

export interface RepoFile {
  /** Repository-relative path, e.g. `docs/ai-workforce/AGRICULTURE-…md`. */
  path: string
  content: string
}

export interface CitedSource {
  /** Canonical URL when present, else `repo:<path>#<slug>`. Dedupe key. */
  sourceIdentifier: string
  title: string
  author: string | null
  canonicalUrl: string | null
  /** `Source:` attribution line (publisher / archive) when present. */
  sourceAttribution: string | null
  /** Verbatim rights text from the pack, kept for human review. */
  rightsNote: string | null
  family: CitedSourceFamily
  sourceType: SourceType
  trustTier: SourceTrustTier
  /** Pack file paths that cite this source (container provenance). */
  citedIn: string[]
}

const URL_RE = /(https?:\/\/[^\s)]+)/i
const HEADING_RE = /^(#{2,4})\s+(.+?)\s*$/
const NUM_ITEM_RE = /^(\d+)\.\s+(.+?)\s*$/
const FIELD_RES: Record<'source' | 'canonical' | 'url' | 'rights' | 'bareUrl', RegExp> = {
  source: /^\s*-?\s*sources?:\s*(.*)$/i,
  canonical: /^\s*-?\s*canonical (?:source|url|record):\s*(.*)$/i,
  url: /^\s*-?\s*(?:url|official landing page|publisher):\s*(.*)$/i,
  rights: /^\s*-?\s*rights(?: state| handling)?:\s*(.*)$/i,
  bareUrl: /^\s*-\s*(https?:\/\/\S+)$/i,
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}

function stripLeadingNumber(text: string): string {
  return text.replace(/^\d+\.\s+/, '').trim()
}

// Generic imperative/section headings that are never a source title. A trailing
// section-level `Sources:` list can otherwise attach to the last sub-heading
// (e.g. an "Avoid" do/don't list), which is not a distinct cited source.
const NON_SOURCE_HEADING_RE = /^(avoid|do|don't|dos and don'ts|do's and don'ts|marketing uses|what to avoid|examples?|notes?|use cases?|summary|overview|scope|purpose)$/i

function normaliseUrl(url: string): string {
  return url.trim().replace(/[.,;)]+$/, '')
}

// Split a "Title — Author" book heading. Handles em dash and hyphen-dash forms.
function splitBook(heading: string): { title: string; author: string | null } {
  const m = heading.split(/\s+[—–-]{1,2}\s+/)
  if (m.length >= 2) return { title: m[0].trim(), author: m.slice(1).join(' — ').trim() }
  return { title: heading.trim(), author: null }
}

function classify(url: string | null, inBooksSection: boolean, sourceAttribution: string | null):
  { family: CitedSourceFamily; sourceType: SourceType } {
  if (inBooksSection) return { family: 'book', sourceType: 'book' }
  const host = url ? (url.match(/^https?:\/\/([^/]+)/i)?.[1] ?? '').toLowerCase() : ''
  if (/ncbi\.nlm\.nih\.gov|plos|frontiersin|doi\.org|researchgate|sciencedirect|springer|nih\.gov/.test(host)) {
    return { family: 'research_paper', sourceType: 'research_paper' }
  }
  if (/support\.google\.com|developers\.|business\.facebook|facebook\.com\/business|help\.|\.gov(\.|\/|$)|openstax\.org/.test(url ?? '')) {
    return { family: 'official_documentation', sourceType: 'official_documentation' }
  }
  const attribution = (sourceAttribution ?? '').toLowerCase()
  if (/warc|ads of the world|case stud|campaign|effectiveness|think with google|agency/.test(attribution) || url) {
    return { family: 'campaign_case', sourceType: 'professional_source' }
  }
  return { family: 'professional_source', sourceType: 'professional_source' }
}

// An H2 section whose headings are cited sources (campaign cases, evidence
// records, inspected/official/priority sources, books). Prose/technique
// sections (hook taxonomies, script patterns, buyer groups) never match, so a
// stray URL inside them is not mistaken for a source.
const SOURCE_SECTION_RE = /books|human sources|campaign|evidence|case stud|proven|lessons|inspected|priority|official|research target|directly|brand leaders|sources?\b|reference/i

interface Block { heading: string; lines: string[]; inBooksSection: boolean; inSourceSection: boolean }

function collectBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let current: Block | null = null
  let inBooksSection = false
  let inSourceSection = false
  for (const line of lines) {
    const heading = HEADING_RE.exec(line)
    if (heading) {
      const level = heading[1].length
      const text = heading[2].trim()
      if (level === 2) {
        // New H2 section: close any open block, update section context.
        if (current) { blocks.push(current); current = null }
        inBooksSection = /books|human sources/i.test(text)
        inSourceSection = SOURCE_SECTION_RE.test(text)
        // An H2 "Evidence record N — …" is itself a source anchor.
        if (/^evidence record\b/i.test(text)) current = { heading: text, lines: [], inBooksSection, inSourceSection }
        continue
      }
      // H3/H4 → new anchor.
      if (current) blocks.push(current)
      current = { heading: text, lines: [], inBooksSection, inSourceSection }
      continue
    }
    const numItem = NUM_ITEM_RE.exec(line)
    if (numItem) {
      if (current) blocks.push(current)
      current = { heading: numItem[2].trim(), lines: [], inBooksSection, inSourceSection }
      continue
    }
    if (current) current.lines.push(line)
  }
  if (current) blocks.push(current)
  return blocks
}

// Extract distinct cited sources from a single pack file.
function extractFromFile(file: RepoFile): CitedSource[] {
  const out: CitedSource[] = []
  for (const block of collectBlocks(file.content)) {
    let canonicalUrl: string | null = null
    let sourceAttribution: string | null = null
    let rightsNote: string | null = null
    // Structured provenance = a labelled field (Source/Canonical/URL/Rights),
    // as opposed to a bare URL that merely appears somewhere in the block.
    let hasStructuredField = false
    const anyLabel = (line: string) =>
      Object.values(FIELD_RES).some(re => re !== FIELD_RES.bareUrl && re.test(line))
    // Some packs (notably the evidence library) put a field's value on the LINE
    // AFTER the label. Resolve a label's value from the inline text, else the
    // first following non-empty line that is not itself another label.
    const valueFor = (inline: string, i: number): string => {
      if (inline.trim()) return inline.trim()
      for (let j = i + 1; j < block.lines.length; j++) {
        const l = block.lines[j]
        if (!l.trim()) continue
        return anyLabel(l) ? '' : l.trim()
      }
      return ''
    }
    for (let i = 0; i < block.lines.length; i++) {
      const raw = block.lines[i]
      const canonical = FIELD_RES.canonical.exec(raw)
      if (canonical) { hasStructuredField = true; const v = valueFor(canonical[1], i); const u = URL_RE.exec(v); if (u && !canonicalUrl) canonicalUrl = normaliseUrl(u[1]); else if (!sourceAttribution && v) sourceAttribution = v; continue }
      const srcm = FIELD_RES.source.exec(raw)
      if (srcm) { hasStructuredField = true; const v = valueFor(srcm[1], i); const u = URL_RE.exec(v); if (u && !canonicalUrl) canonicalUrl = normaliseUrl(u[1]); if (!sourceAttribution && v && !u) sourceAttribution = v; continue }
      const url = FIELD_RES.url.exec(raw)
      if (url) { hasStructuredField = true; const v = valueFor(url[1], i); const u = URL_RE.exec(v); if (u && !canonicalUrl) canonicalUrl = normaliseUrl(u[1]); continue }
      const rights = FIELD_RES.rights.exec(raw)
      if (rights) { hasStructuredField = true; const v = valueFor(rights[1], i); if (!rightsNote && v) rightsNote = v; continue }
      const bare = FIELD_RES.bareUrl.exec(raw)
      if (bare && !canonicalUrl) { canonicalUrl = normaliseUrl(bare[1]); continue }
    }
    // A cited source must be either: a labelled-provenance block; a Books/
    // human-sources heading; or a URL-bearing heading inside a source section.
    // A bare URL sitting in a prose/technique section is NOT a source.
    const isCitedSource = hasStructuredField || block.inBooksSection || (block.inSourceSection && Boolean(canonicalUrl))
    if (!isCitedSource) continue
    const headingText = stripLeadingNumber(block.heading)
    if (NON_SOURCE_HEADING_RE.test(headingText)) continue
    const { title, author } = block.inBooksSection ? splitBook(headingText) : { title: headingText, author: null }
    let { family, sourceType } = classify(canonicalUrl, block.inBooksSection, sourceAttribution)
    // A "Books and human sources" entry with no author that names interviews /
    // recordings / observations is an internal source, not a published book.
    if (block.inBooksSection && !author && /interview|recording|observation|call/i.test(title)) {
      family = 'professional_source'; sourceType = 'staff_observation'
    }
    const sourceIdentifier = canonicalUrl ?? `repo:${file.path}#${slug(headingText)}`
    out.push({
      sourceIdentifier, title, author, canonicalUrl, sourceAttribution, rightsNote,
      family, sourceType, trustTier: 'needs_review', citedIn: [file.path],
    })
  }
  return out
}

// Extract + dedupe distinct cited sources across every supplied pack. When the
// same source (by identifier) is cited by several packs, the citing paths are
// merged so container provenance is preserved. Output is stably sorted so the
// generated manifest and seed are deterministic.
export function extractCitedSources(files: RepoFile[]): CitedSource[] {
  const byId = new Map<string, CitedSource>()
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    for (const source of extractFromFile(file)) {
      const existing = byId.get(source.sourceIdentifier)
      if (existing) {
        if (!existing.citedIn.includes(source.citedIn[0])) existing.citedIn.push(source.citedIn[0])
        existing.rightsNote ??= source.rightsNote
        existing.sourceAttribution ??= source.sourceAttribution
        continue
      }
      byId.set(source.sourceIdentifier, { ...source, citedIn: [...source.citedIn] })
    }
  }
  return [...byId.values()].sort((a, b) => a.sourceIdentifier.localeCompare(b.sourceIdentifier))
}

// A pack file registered as a container reference (allowed alongside — never
// instead of — its underlying cited sources).
export interface ContainerReference {
  sourceIdentifier: string
  path: string
  title: string
  citedSourceCount: number
}

export function buildContainerReferences(files: RepoFile[], cited: CitedSource[]): ContainerReference[] {
  return [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(file => {
      const firstHeading = file.content.split('\n').map(l => HEADING_RE.exec(l)).find(m => m && m[1].length === 1)
      const title = (file.content.match(/^#\s+(.+)$/m)?.[1] ?? file.path.split('/').pop() ?? file.path).trim()
      void firstHeading
      return {
        sourceIdentifier: `repo:${file.path}`,
        path: file.path,
        title,
        citedSourceCount: cited.filter(c => c.citedIn.includes(file.path)).length,
      }
    })
}
