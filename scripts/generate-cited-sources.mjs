// #184 — Generate the committed cited-source manifest from the research packs.
//
// Reads the reusable research packs in docs/ai-workforce, runs the pure
// extractor (src/lib/marketing-library/citedSourceExtraction.ts) over them, and
// writes src/lib/marketing-library/citedSources.generated.ts (data only, so the
// browser bundle never parses markdown at runtime). A test re-runs the same
// extraction against the docs and asserts the committed file matches, so the
// manifest can never silently drift from the source documents.
//
// Usage: node scripts/generate-cited-sources.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createServer } from 'vite'

const DIR = 'docs/ai-workforce'
const OUT = 'src/lib/marketing-library/citedSources.generated.ts'
const SQL_OUT = 'supabase/phase-28a-marketing-library-repo-source-registration.sql'

// Reusable research packs to reconcile: industry goldmines, expansion packs,
// cross-industry source packs and the evidence library. Index/inventory/system
// docs are containers of packs, not packs of cited sources — excluded.
export function selectPackFiles(names) {
  return names
    .filter(f => f.endsWith('.md'))
    .filter(f => /GOLDMINE|SOURCE-PACK|EXPANSION|EVIDENCE-LIBRARY|SA-RUGBY|HOSPITALITY-SA|BRAND-LEADERS/.test(f))
    .filter(f => !/INVENTORY|INDEX/.test(f))
    .map(f => `${DIR}/${f}`)
    .sort()
}

const sqlStr = value => (value === null || value === undefined || value === '')
  ? 'null'
  : `'${String(value).replace(/'/g, "''")}'`

function toRow(candidate, kind) {
  const canonicalUrl = candidate.canonicalUrl ?? null
  // Reference-only, conservative rights on import: no reuse right is asserted
  // and no full text is stored; a human reviewer establishes real rights later.
  const accessMode = canonicalUrl ? 'metadata_and_link_only' : 'internal_notes_only'
  const author = candidate.author ?? candidate.sourceAttribution ?? null
  const packs = (candidate.citedIn ?? []).map(p => p.replace('docs/ai-workforce/', '')).join('; ')
  const family = candidate.family ?? kind
  const notes = `repo-registration: ${kind}; family=${family}; cited_in=${packs || 'n/a'}`
  const rightsNote = [
    candidate.rightsNote ? `Pack rights note: ${candidate.rightsNote}` : null,
    candidate.sourceAttribution ? `Attribution: ${candidate.sourceAttribution}` : null,
    'Registered reference-only (metadata + link); rights unverified pending human review.',
  ].filter(Boolean).join(' ')
  const name = (candidate.title || candidate.sourceIdentifier).slice(0, 300)
  return `  (${sqlStr(candidate.sourceType)}, ${sqlStr(name)}, ${sqlStr(author)}, ${sqlStr(candidate.title)}, ` +
    `${sqlStr(canonicalUrl)}, ${sqlStr(canonicalUrl)}, ${sqlStr(candidate.sourceIdentifier)}, 'needs_review', ` +
    `'bibliographic_only', ${sqlStr(accessMode)}, false, 'unknown', 'catalogued', 'available_for_review', ` +
    `${sqlStr(notes)}, ${sqlStr(rightsNote)})`
}

function buildSeedSql(cited, containers) {
  const rows = [
    ...cited.map(c => toRow(c, 'cited_source')),
    ...containers.map(c => toRow({ ...c, canonicalUrl: null, sourceType: 'professional_source', family: 'container' }, 'container')),
  ]
  return `-- GENERATED FILE — do not edit by hand.
-- Produced by scripts/generate-cited-sources.mjs from docs/ai-workforce.
--
-- #184 — Register the DISTINCT CITED SOURCES inside the reusable research packs
-- (campaign case studies, books, official platform docs, open-access research),
-- plus each pack as a container reference. This is NOT one flattened row per
-- markdown file: it is ${cited.length} deduped cited sources + ${containers.length} container references.
--
-- Safety contract (matches AGENTS.md / the review blockers):
--   * every row is trust_tier 'needs_review' — nothing is auto-approved;
--   * rights_status 'bibliographic_only' + reference-only access_mode — no reuse
--     right is asserted and full_text_storage is false, so no copyrighted text
--     is ingested here;
--   * source_identifier is the canonical URL (or a stable repo: path) — the
--     idempotency key, never a guessed database id;
--   * re-running is idempotent: an identifier already present is skipped, and a
--     candidate whose canonical_url already exists live is not duplicated.
--
-- NOT APPLIED to production by this repository. Review in the Supabase SQL
-- editor first (see docs/pending-supabase-migrations.md).

-- Idempotency: a partial unique index on non-null source_identifier lets the
-- INSERT ... ON CONFLICT arbiter be inferred (the ON CONFLICT predicate below
-- matches this index's WHERE clause exactly).
create unique index if not exists uniq_marketing_library_sources_source_identifier
  on public.marketing_library_sources (source_identifier)
  where source_identifier is not null;

insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, page_or_url, canonical_url,
   source_identifier, trust_tier, rights_status, access_mode, full_text_storage, commercial_use,
   ingestion_status, acquisition_status, notes, rights_review_notes)
select v.source_type, v.source_name, v.author_or_organisation, v.title, v.page_or_url, v.canonical_url,
       v.source_identifier, v.trust_tier, v.rights_status, v.access_mode, v.full_text_storage, v.commercial_use,
       v.ingestion_status, v.acquisition_status, v.notes, v.rights_review_notes
from (values
${rows.join(',\n')}
) as v(source_type, source_name, author_or_organisation, title, page_or_url, canonical_url,
       source_identifier, trust_tier, rights_status, access_mode, full_text_storage, commercial_use,
       ingestion_status, acquisition_status, notes, rights_review_notes)
where not exists (
  select 1 from public.marketing_library_sources s
  where s.source_identifier = v.source_identifier
     or (v.canonical_url is not null and s.canonical_url = v.canonical_url)
)
on conflict (source_identifier) where source_identifier is not null do nothing;
`
}

async function main() {
  const packPaths = selectPackFiles(readdirSync(DIR))
  const files = packPaths.map(path => ({ path, content: readFileSync(path, 'utf8') }))

  const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  try {
    const mod = await server.ssrLoadModule('/src/lib/marketing-library/citedSourceExtraction.ts')
    const cited = mod.extractCitedSources(files)
    const containers = mod.buildContainerReferences(files, cited)

    const banner = `// GENERATED FILE — do not edit by hand.
//
// Produced by scripts/generate-cited-sources.mjs from the research packs in
// docs/ai-workforce. Run \`node scripts/generate-cited-sources.mjs\` to refresh
// after changing a pack. tests/marketingKnowledgeWorkspace.test.mjs re-extracts
// from the same docs and fails if this file drifts.
//
// These are the distinct CITED SOURCES inside the reusable research packs
// (#184) — per-source provenance, deduped by stable identifier. Everything is
// needs_review / reference-only: nothing here is trusted, ingested or activated
// on import. Human review remains the gate.
/* eslint-disable */
import type { CitedSource, ContainerReference } from './citedSourceExtraction'
`
    const body = `
export const PACK_FILES: string[] = ${JSON.stringify(packPaths, null, 2)}

export const CITED_SOURCES: CitedSource[] = ${JSON.stringify(cited, null, 2)}

export const CONTAINER_REFERENCES: ContainerReference[] = ${JSON.stringify(containers, null, 2)}
`
    writeFileSync(OUT, banner + body)
    writeFileSync(SQL_OUT, buildSeedSql(cited, containers))
    console.log(`Wrote ${OUT} and ${SQL_OUT}: ${cited.length} cited sources, ${containers.length} container refs, from ${packPaths.length} packs.`)
  } finally {
    await server.close()
  }
}

main()
