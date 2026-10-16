import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { fetchAllPages } from '../src/lib/paginatedQuery.ts'

const source = readFileSync(new URL('../src/pages/admin/ReportsManagement.tsx', import.meta.url), 'utf8')
const start = source.indexOf('  async function classifySources(')
const end = source.indexOf('\n  useEffect(', start)
assert.ok(start >= 0 && end > start)
const compiled = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

async function classify(rowsByTable, errorTable) {
  const calls = []
  let result
  const sb = { from(table) {
    return {
      select() { return this }, order() { return this },
      range(from, to) { calls.push({ table, from, to }); return this.read(from, to) },
      read(from, to) { return Promise.resolve(table === errorTable
        ? { data: null, error: { message: 'read failed' } }
        : { data: rowsByTable[table].slice(from, to + 1), error: null }) },
      then(resolve, reject) { return this.read(0, 999).then(resolve, reject) },
    }
  } }
  const run = new Function('supabase', 'fetchAllPages', 'setSourceById', `${compiled}; return classifySources`)(sb, fetchAllPages, value => { result = value })
  await run([{ id: 'new-report' }, { id: 'manual-report' }])
  return { result, calls }
}

test('actual report-source loader reaches mapped posts beyond the first 1000 rows', async () => {
  const older = Array.from({ length: 1000 }, (_, i) => ({ id: `old-${i}`, report_id: 'old-report', post_id: `old-post-${i}` }))
  const { result, calls } = await classify({
    meta_content_mappings: [...older, { id: 'new-mapping', report_id: 'new-report', post_id: 'new-post' }],
    posts: [...older.map(row => ({ id: row.post_id, report_id: row.report_id })), { id: 'new-post', report_id: 'new-report' }],
  })
  assert.equal(result.get('new-report'), 'meta')
  assert.equal(result.get('manual-report'), 'manual')
  assert.equal(calls.filter(call => call.from === 1000).length, 2)
})

test('partial/error reads do not silently classify sources as manual', async () => {
  for (const errorTable of ['meta_content_mappings', 'posts']) {
    const { result } = await classify({ meta_content_mappings: [], posts: [] }, errorTable)
    assert.equal(result.has('new-report'), false)
  }
})

test('source lookup failure has an unavailable badge, not a manual-fallback claim', () => {
  const start = source.indexOf('function getSourceVariant(')
  const end = source.indexOf('\nfunction nextActionText(', start)
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const getVariant = new Function(`${code}; return getSourceVariant`)()
  assert.equal(getVariant({ id: 'new-report' }, new Map()), 'none')
  assert.match(source, /customLabel=\{sourceVariant === 'none' \? 'Source unavailable' : undefined\}/)
})
