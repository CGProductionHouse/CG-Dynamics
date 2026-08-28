// #200 — Generate the idempotent, review-gated seed for content batch #200 from
// the committed module (src/lib/marketing-library/contentBatch200.ts), so the
// SQL can never drift from the concept definitions. A test also re-checks it.
//
// Usage: node scripts/generate-content-batch-200.mjs
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const OUT = 'supabase/phase-29a-content-batch-200-behavioural-economics.sql'
const q = v => v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`
const jarr = xs => `'${JSON.stringify(xs).replace(/'/g, "''")}'::jsonb`

function sourceBlock(c) {
  const s = c.source
  return `-- Source: ${s.sourceName}
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, publication_year, source_identifier,
   trust_tier, rights_status, access_mode, full_text_storage, commercial_use, ingestion_status, notes)
select ${q(s.sourceType)}, ${q(s.sourceName)}, ${q(s.author)}, ${q(s.sourceName)}, ${s.year ?? 'null'}, ${q(s.sourceIdentifier)},
       'needs_review', 'bibliographic_only', 'internal_notes_only', false, 'unknown', 'catalogued',
       'Content batch #200 (CA reel, discovery evidence only). Bibliographic pointer — verify the exact canonical source and rights before ingestion/activation.'
where not exists (
  select 1 from public.marketing_library_sources s
  where s.source_identifier = ${q(s.sourceIdentifier)}
     or (s.source_name = ${q(s.sourceName)} and coalesce(s.author_or_organisation,'') = coalesce(${q(s.author)}, ''))
);`
}

function cardBlock(c) {
  return `-- Candidate: ${c.title}
insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id, source_type,
  knowledge_layer, confidence_level, evidence_label, relevant_industries, relevant_agents,
  principle, summary, why_it_matters, how_to_apply, examples, mistakes_to_avoid,
  agent_instructions, related_card_ids, notes, client_specific
)
select ${q(c.slug)}, ${q(c.title)}, ${q(c.category)}, ${q(c.concept)}, 'needs_review', null,
  (select id from public.marketing_library_sources where source_identifier = ${q(c.source.sourceIdentifier)} limit 1),
  ${q(c.sourceType)}, ${q(c.knowledgeLayer)}, ${q(c.confidenceLevel)}, ${q(c.evidenceLabel)},
  '[]'::jsonb, ${jarr(c.relevantAgents)},
  ${q(c.principle)}, ${q(c.summary)}, ${q(c.whyItMatters)},
  ${jarr(c.howToApply)}, '[]'::jsonb, ${jarr(c.mistakesToAvoid)}, '[]'::jsonb, '[]'::jsonb,
  'Content batch #200 (CA reel, discovery evidence only). Needs independent verification against a stronger authoritative source before activation.',
  false
on conflict (slug) do nothing;`
}

async function main() {
  const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  try {
    const mod = await server.ssrLoadModule('/src/lib/marketing-library/contentBatch200.ts')
    const candidates = mod.batchCandidatesForRegistration()
    const excluded = mod.CONTENT_BATCH_200.filter(c => c.dedupStatus !== 'new')
    const header = `-- GENERATED FILE — do not edit by hand.
-- Produced by scripts/generate-content-batch-200.mjs from
-- src/lib/marketing-library/contentBatch200.ts.
--
-- #200 — Behavioural-economics concepts captured from CA's reel screenshots,
-- registered INSIDE the existing #183/#184 architecture (skill_cards +
-- marketing_library_sources). Discovery evidence only.
--
-- Safety contract:
--   * every candidate is status 'needs_review' — nothing is active/auto-approved;
--   * client_specific = false and no active_client_id — no client is guessed;
--   * sources are bibliographic pointers (rights_status 'bibliographic_only',
--     internal_notes_only, full_text_storage false) — no full text ingested;
--   * idempotent: sources use WHERE NOT EXISTS, cards use ON CONFLICT (slug);
--   * each concept still needs INDEPENDENT verification against a stronger
--     authoritative source before activation.
--
-- Deduped out (already in the library, NOT re-registered):
${excluded.map(c => `--   * ${c.concept} — ${c.dedupNote}`).join('\n')}
--
-- Depends on phase-18a (skill_cards, marketing_library_sources) and phase-23a
-- (source rights columns). NOT APPLIED to production by this repository — review
-- in the Supabase SQL editor first (docs/pending-supabase-migrations.md).

`
    const body = candidates.map(c => `${sourceBlock(c)}\n\n${cardBlock(c)}`).join('\n\n')
    writeFileSync(OUT, header + body + '\n')
    console.log(`Wrote ${OUT}: ${candidates.length} candidates, ${excluded.length} deduped out.`)
  } finally {
    await server.close()
  }
}

main()
