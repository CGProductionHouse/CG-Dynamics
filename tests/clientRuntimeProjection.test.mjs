import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const migration = read('../supabase/migrations/20260910100000_client_runtime_projection_backfill.sql')
const standalone = read('../supabase/functions/get-client-context/index.ts')
const mcp = read('../supabase/functions/cg-dynamics-mcp/index.ts')

const projectionRows = [...migration.matchAll(/^\s*\('([0-9a-f-]{36})'::uuid, '([^']+)', '([0-9a-f]{40})', '([^']+)', '([A-Za-z0-9+/=]+)', '([A-Za-z0-9+/=]+)'\)[,;]?$/gm)]

test('projection contains every completed migrated client exactly once', () => {
  assert.equal(projectionRows.length, 52)
  assert.equal(new Set(projectionRows.map(match => match[1])).size, 52)
  assert.match(migration, /client\.id = projection\.client_id/)
  assert.match(migration, /client\.name = projection\.client_name/)
  assert.match(migration, /client\.active = true/)
  assert.doesNotMatch(migration, /\bilike\b|\blike\b/i)
})

test('projection is additive/idempotent and preserves pre-existing canonical rows', () => {
  assert.match(migration, /on conflict \(client_id\) do nothing/g)
  assert.doesNotMatch(migration, /delete from public\.(client_guides|client_project_mappings|client_contacts)/i)
  assert.doesNotMatch(migration, /on conflict[\s\S]{0,80}do update/i)
})

test('Red Oak projection preserves its normal caption contract and anti-generic rules', () => {
  const row = projectionRows.find(match => match[1] === 'cdb11a82-339e-4b46-9b09-bde1a23efeaf')
  assert.ok(row)
  const guide = Buffer.from(row[5], 'base64').toString('utf8')
  assert.match(guide, /return \*\*4 genuinely different caption options\*\*/)
  assert.match(guide, /weekend\/client-highlight captions/)
  assert.match(guide, /rugby\/match-day viewing/)
  assert.match(guide, /Do \*\*not\*\* blindly force every Red Oak caption into Afrikaans/)
  assert.match(guide, /good vibes/)
  assert.match(guide, /Captions must add to the creative rather than narrate it/)
})

test('all projected Project Instructions are mutable-free live-retrieval contracts', () => {
  for (const row of projectionRows) {
    const instructions = Buffer.from(row[6], 'base64').toString('utf8')
    assert.match(instructions, /call get_client_context with its exact client_id/)
    assert.match(instructions, /CLIENT CONTEXT NOT READY as a hard stop/)
    assert.match(instructions, /Never hardcode or guess contacts/)
    assert.doesNotMatch(instructions, /\b(?:\+?27|0)\d[\d ]{7,}\b|@[a-z0-9.-]+\.[a-z]{2,}/i)
  }
})

test('standalone and MCP runtimes fail closed without a ready exact-client guide', () => {
  for (const source of [standalone, mcp]) {
    assert.match(source, /CLIENT CONTEXT NOT READY/)
    assert.match(source, /CLIENT_CONTEXT_NOT_READY/)
    assert.match(source, /runtime_readiness/)
    assert.match(source, /\.eq\('client_id', client[_I]d\)/)
  }
  assert.match(mcp, /Do not generate generic client creative/)
})

test('caption contacts remain exact-client/exact-scope and unresolved footers do not block unrelated creative', () => {
  assert.match(mcp, /\.from\('client_contacts'\)/)
  assert.match(mcp, /\.from\('client_contact_footer_policies'\)/)
  assert.match(mcp, /contactsQuery\.eq\('scope_key', scopeKey\)/)
  assert.match(mcp, /contacts: blocked \? \[\] : eligible/)
  assert.match(mcp, /Continue unrelated creative work, but do not invent a footer/)
  assert.match(standalone, /No current exact-client footer policy is recorded for this exact scope/)
})

test('shared Wiseman Project container maps multiple isolated child client IDs', () => {
  for (const id of [
    'a60b4d07-0a30-4f1c-8d48-7bd9ea649c97',
    'e2870110-930c-4e63-b2fe-c858030f7258',
    '504113ee-fba9-4993-807e-a86066615212',
    '899c9988-8207-4e45-a8fc-a7446dfcf96b',
  ]) assert.match(migration, new RegExp(id))
  assert.match(migration, /then 'Wiseman Group'/)
  assert.match(migration, /chatgpt_project_url is not unique/)
})
