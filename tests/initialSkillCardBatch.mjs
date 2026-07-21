import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const SQL_PATH = path.resolve('supabase/phase-18d-initial-skill-card-batch.sql')

test('Phase 18d migration file exists', () => {
  assert.ok(fs.existsSync(SQL_PATH), 'Migration file not found')
})

test('Phase 18d batch contains exactly five cards', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')

  const cardBlocks = sql
    .split(/(?=insert into public\.skill_cards\s*\()/gi)
    .filter(b => /^\s*insert into public\.skill_cards\s*\(/i.test(b))

  assert.equal(cardBlocks.length, 5, `Expected 5 skill card inserts, found ${cardBlocks.length}`)
})

test('every slug is unique', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')
  const slugs = extractSlugs(sql)
  assert.equal(slugs.length, 5, `Expected 5 slugs, found ${slugs.length}`)
  const uniqueSlugs = new Set(slugs)
  assert.equal(uniqueSlugs.size, 5, 'Duplicate slugs found')
})

test('every card is needs_review and no card is active', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')
  const cardBlocks = sql
    .split(/(?=insert into public\.skill_cards\s*\()/gi)
    .filter(b => /^\s*insert into public\.skill_cards\s*\(/i.test(b))

  assert.equal(cardBlocks.length, 5)
  for (const block of cardBlocks) {
    const valuesMatch = block.match(/select\s+([\s\S]+?)\s+from public\.marketing_library_sources/i)
    assert.ok(valuesMatch, 'Could not find SELECT values in card block')
    const values = valuesMatch[1]

    assert.ok(values.includes("'needs_review'"), `Card block missing needs_review:\n${values.slice(0, 200)}`)
    assert.ok(!values.includes("'active'"), `Card block incorrectly uses active:\n${values.slice(0, 200)}`)
    assert.ok(!values.includes("'reviewed'"), `Card block incorrectly uses reviewed:\n${values.slice(0, 200)}`)
    assert.ok(!values.includes("'draft'"), `Card block incorrectly uses draft:\n${values.slice(0, 200)}`)
    assert.ok(!values.includes("'deprecated'"), `Card block incorrectly uses deprecated:\n${values.slice(0, 200)}`)
  }
})

test('every card has low confidence and hypothesis evidence', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')
  const cardBlocks = sql
    .split(/(?=insert into public\.skill_cards\s*\()/gi)
    .filter(b => /^\s*insert into public\.skill_cards\s*\(/i.test(b))

  assert.equal(cardBlocks.length, 5)
  for (const block of cardBlocks) {
    const valuesMatch = block.match(/select\s+([\s\S]+?)\s+from public\.marketing_library_sources/i)
    assert.ok(valuesMatch, 'Could not find SELECT values in card block')
    const values = valuesMatch[1]
    assert.ok(values.includes("'low'"), `Card block missing low confidence:\n${values.slice(0, 200)}`)
    assert.ok(values.includes("'hypothesis'"), `Card block missing hypothesis evidence:\n${values.slice(0, 200)}`)
  }
})

test('every card has universal_principle knowledge layer', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')
  const cardBlocks = sql
    .split(/(?=insert into public\.skill_cards\s*\()/gi)
    .filter(b => /^\s*insert into public\.skill_cards\s*\(/i.test(b))

  assert.equal(cardBlocks.length, 5)
  for (const block of cardBlocks) {
    const valuesMatch = block.match(/select\s+([\s\S]+?)\s+from public\.marketing_library_sources/i)
    assert.ok(valuesMatch, 'Could not find SELECT values in card block')
    assert.ok(valuesMatch[1].includes("'universal_principle'"),
      `Card block missing universal_principle:\n${valuesMatch[1].slice(0, 200)}`)
  }
})

test('all cards link to the same source via subquery', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')
  const cardBlocks = sql
    .split(/(?=insert into public\.skill_cards\s*\()/gi)
    .filter(b => /^\s*insert into public\.skill_cards\s*\(/i.test(b))

  assert.equal(cardBlocks.length, 5)
  for (const block of cardBlocks) {
    assert.ok(
      block.includes(`mls.source_name = 'Scientific Advertising'`),
      `Card block does not reference Scientific Advertising:\n${block.slice(0, 200)}`
    )
  }
})

test('no card has a non-null last_reviewed', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')
  const cardBlocks = sql
    .split(/(?=insert into public\.skill_cards\s*\()/gi)
    .filter(b => /^\s*insert into public\.skill_cards\s*\(/i.test(b))

  for (const block of cardBlocks) {
    const valuesMatch = block.match(/select\s+([\s\S]+?)\s+from public\.marketing_library_sources/i)
    assert.ok(valuesMatch, 'Could not find SELECT values in card block')
    assert.ok(valuesMatch[1].includes(', null,'),
      `Expected null last_reviewed:\n${valuesMatch[1].slice(0, 300)}`)
  }
})

test('no fabricated chapter or page reference', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')

  const cardBlocks = sql
    .split(/(?=insert into public\.skill_cards\s*\()/gi)
    .filter(b => /^\s*insert into public\.skill_cards\s*\(/i.test(b))

  for (const block of cardBlocks) {
    assert.ok(!/\bchapter\s+\d+/i.test(block), `Found fabricated chapter number:\n${block.slice(0, 200)}`)
    assert.ok(!/\bpage\s+\d+/i.test(block), `Found fabricated page number:\n${block.slice(0, 200)}`)
  }
})

test('notes confirm manual verification is required', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')
  const cardBlocks = sql
    .split(/(?=insert into public\.skill_cards\s*\()/gi)
    .filter(b => /^\s*insert into public\.skill_cards\s*\(/i.test(b))

  assert.equal(cardBlocks.length, 5)
  for (const block of cardBlocks) {
    assert.ok(
      block.includes('Manual chapter/page verification is still required'),
      `Card block missing verification requirement:\n${block.slice(0, 300)}`
    )
  }
})

test('no claims of specific chapter or page number', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')

  assert.ok(!/\bChapter\s+\d+/i.test(sql), 'Found specific chapter claim')
  assert.ok(!/\bp\.\s*\d+/i.test(sql), 'Found page reference (e.g. p. 42)')
})

test('source insert has no chapter_or_section or page_or_url', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')

  assert.ok(!sql.includes('chapter_or_section'), 'Source INSERT sets chapter_or_section')
  assert.ok(!sql.includes('page_or_url'), 'Source INSERT sets page_or_url')
})

test('source uses tier_1_primary trust tier', () => {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')

  assert.ok(sql.includes("'tier_1_primary'"), 'Source trust tier is not tier_1_primary')
})

// --- helpers ---

function extractSlugs(sql) {
  const cardBlocks = sql
    .split(/(?=insert into public\.skill_cards\s*\()/gi)
    .filter(b => /^\s*insert into public\.skill_cards\s*\(/i.test(b))

  return cardBlocks.map(block => {
    const match = block.match(/slug[^)]*\)\s*\n?\s*select\s*\n?\s*'([^']+)'/i)
    return match ? match[1] : null
  }).filter(Boolean)
}
