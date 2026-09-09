import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, rows
before(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  rows = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/clientScheduleRows.ts')
})
after(async () => { await server?.close() })

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const INDEX = read('../supabase/functions/cg-dynamics-mcp/index.ts')

// Columns that genuinely exist on public.monthly_deliverables. `client_name` is NOT one of
// them — it lives on public.clients and is reached through monthly_deliverables_client_id_fkey.
const REAL_COLUMNS = new Set([
  'id', 'client_id', 'month', 'deliverable_type', 'title',
  'scheduled_date', 'due_date', 'production_status', 'assigned_to_name',
])

/** Split a select string into top-level parts, ignoring embedded relation parentheses. */
function topLevelParts(select) {
  const parts = []
  let depth = 0, current = ''
  for (const ch of select) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = '' } else { current += ch }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

// ── The exact bug this issue fixes ──────────────────────────────────────────

test('no monthly_deliverables select requests a bare client_name column', () => {
  for (const [label, select] of [
    ['CLIENT_SCHEDULE_SELECT', rows.CLIENT_SCHEDULE_SELECT],
    ['MY_DAY_DELIVERABLE_SELECT', rows.MY_DAY_DELIVERABLE_SELECT],
  ]) {
    const flat = topLevelParts(select).filter(p => !p.includes('('))
    assert.ok(!flat.includes('client_name'), `${label} must not select a nonexistent client_name column`)
  }
})

test('every selected top-level column actually exists on monthly_deliverables', () => {
  for (const [label, select] of [
    ['CLIENT_SCHEDULE_SELECT', rows.CLIENT_SCHEDULE_SELECT],
    ['MY_DAY_DELIVERABLE_SELECT', rows.MY_DAY_DELIVERABLE_SELECT],
  ]) {
    for (const part of topLevelParts(select)) {
      if (part.includes('(')) continue // embedded relation, checked below
      assert.ok(REAL_COLUMNS.has(part), `${label} selects nonexistent column "${part}"`)
    }
  }
})

test('the client name is read through the exact foreign key relation', () => {
  assert.equal(rows.MONTHLY_DELIVERABLE_CLIENT_RELATION, 'client:clients!monthly_deliverables_client_id_fkey(name)')
  assert.ok(rows.CLIENT_SCHEDULE_SELECT.includes(rows.MONTHLY_DELIVERABLE_CLIENT_RELATION))
  assert.ok(rows.MY_DAY_DELIVERABLE_SELECT.includes(rows.MONTHLY_DELIVERABLE_CLIENT_RELATION))
})

// ── Response shape is preserved for callers ─────────────────────────────────

test('flatten restores client_name and removes the nested embed', () => {
  const out = rows.flattenDeliverableClient([
    { id: 'd1', client_id: 'c1', title: 'Reel', client: { name: 'Red Oak' } },
  ])
  assert.deepEqual(out, [{ id: 'd1', client_id: 'c1', title: 'Reel', client_name: 'Red Oak' }])
  assert.ok(!('client' in out[0]), 'nested embed must not leak into the tool response')
})

test('an unresolved client yields null, never a fabricated name or a dropped row', () => {
  const out = rows.flattenDeliverableClient([
    { id: 'd1', client: null },
    { id: 'd2' },
    { id: 'd3', client: { name: null } },
  ])
  assert.equal(out.length, 3, 'rows are never silently dropped')
  assert.deepEqual(out.map(r => r.client_name), [null, null, null])
})

test('flatten tolerates an array-shaped embed and empty input', () => {
  assert.deepEqual(rows.flattenDeliverableClient([{ id: 'd1', client: [{ name: 'PSG' }] }]), [{ id: 'd1', client_name: 'PSG' }])
  assert.deepEqual(rows.flattenDeliverableClient(null), [])
  assert.deepEqual(rows.flattenDeliverableClient(undefined), [])
  assert.deepEqual(rows.flattenDeliverableClient([]), [])
})

// ── Handlers use the shared, verified selects ───────────────────────────────

test('both monthly_deliverables handlers use the shared select constants', () => {
  const selects = [...INDEX.matchAll(/\.from\('monthly_deliverables'\)\s*\n\s*\.select\(([^)]*)\)/g)].map(m => m[1].trim())
  assert.equal(selects.length, 2, 'expected exactly two monthly_deliverables selects')
  assert.deepEqual(selects.sort(), ['CLIENT_SCHEDULE_SELECT', 'MY_DAY_DELIVERABLE_SELECT'])
})

test('no inline client_name string survives against monthly_deliverables', () => {
  // A future hand-written select re-introducing the bug fails here.
  assert.doesNotMatch(INDEX, /\.from\('monthly_deliverables'\)\s*\n\s*\.select\('[^']*client_name/)
})

test('both handlers flatten before returning', () => {
  assert.match(INDEX, /deliverables: flattenDeliverableClient\(scheduleResult\.data\)/)
  assert.match(INDEX, /deliverables: flattenDeliverableClient\(data\), error: error\?\.message \?\? null/)
})

// ── Client Schedule semantics unchanged ─────────────────────────────────────

test('date range, ordering, limit, client filter and isolation are unchanged', () => {
  const handler = INDEX.slice(INDEX.indexOf('const handleListClientSchedule'), INDEX.indexOf('const handleGetClientContext'))
  assert.match(handler, /\.gte\('scheduled_date', input\.from as string\)/)
  assert.match(handler, /\.lte\('scheduled_date', input\.to as string\)/)
  assert.match(handler, /\.order\('scheduled_date', \{ ascending: true \}\)/)
  assert.match(handler, /\.limit\(50\)/)
  assert.match(handler, /if \(input\.client_id\) query\.eq\('client_id', input\.client_id\)/)
  // #319 client pinning still governs which client_id can reach the handler.
  assert.match(INDEX, /resolveClientScopeForInput\(staff\.contextKind, staff\.effectiveClientId/)
})

test('CG Calendar remains a separate authority', () => {
  const myDay = INDEX.slice(INDEX.indexOf('const handleGetMyDay'), INDEX.indexOf('const handleListMyTasks'))
  assert.match(myDay, /\.from\('company_calendar_events'\)/)
  assert.match(myDay, /\.from\('monthly_deliverables'\)/)
  // Calendar events and deliverables stay in distinct result fields — never merged.
  assert.match(myDay, /calendar_events: calendarResult\.data \?\? \[\]/)
  assert.match(myDay, /deliverables: flattenDeliverableClient\(scheduleResult\.data\)/)
})
