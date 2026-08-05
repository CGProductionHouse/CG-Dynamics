import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const MIG = read('../supabase/phase-27a-microsoft-plan-source-registry.sql')
const FN = read('../supabase/functions/microsoft-transition-sync/index.ts')

// The 12 REAL July deliverables for THE STAFFORDHIRE PUB, extracted verbatim from
// docs/planner-exports/2025 CLIENTS SCHEDULE.xlsx (bucket FHoVtUr_NUykl_V_0wmaaGUAIUc9).
const STAFFY_JULY = [
  { title: 'F1 - STAFFY', code: 'F1', type: 'photo', n: 1, due: '2026-07-01' },
  { title: 'VIDEO 1 - STAFFY', code: 'Video 1', type: 'video', n: 1, due: '2026-07-02' },
  { title: 'DP1 - STAFFY', code: 'DP1', type: 'dp', n: 1, due: '2026-07-06' },
  { title: 'F2 - STAFFY', code: 'F2', type: 'photo', n: 2, due: '2026-07-08' },
  { title: 'VIDEO 2 - STAFFY', code: 'Video 2', type: 'video', n: 2, due: '2026-07-09' },
  { title: 'DP2 - STAFFY', code: 'DP2', type: 'dp', n: 2, due: '2026-07-13' },
  { title: 'F3 - STAFFY', code: 'F3', type: 'photo', n: 3, due: '2026-07-15' },
  { title: 'VIDEO 3 - STAFFY', code: 'Video 3', type: 'video', n: 3, due: '2026-07-16' },
  { title: 'DP3 - STAFFY', code: 'DP3', type: 'dp', n: 3, due: '2026-07-20' },
  { title: 'F4 - STAFFY', code: 'F4', type: 'photo', n: 4, due: '2026-07-22' },
  { title: 'VIDEO 4 - STAFFY', code: 'Video 4', type: 'video', n: 4, due: '2026-07-23' },
  { title: 'DP4 STAFFY', code: 'DP4', type: 'dp', n: 4, due: '2026-07-27' }, // no dash — tolerant parser
]

let server, prev, map
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  prev = await server.ssrLoadModule('/src/lib/microsoftImportPreview.ts')
  map = await server.ssrLoadModule('/src/lib/microsoftImportMap.ts')
})
after(async () => { await server?.close() })

// ── Plan classification ───────────────────────────────────────────────────────
test('2025 CLIENTS SCHEDULE is classified as a monthly Client Schedule source', () => {
  const m = map.resolveMicrosoftPlanMapping('2025 CLIENTS SCHEDULE')
  assert.equal(m.target, 'client_schedule')
  assert.equal(m.monthly, true)
  assert.equal(m.targetBoardSlug, 'client-schedule')
})

// ── Bucket → client resolution (directory-driven, no guessing) ──────────────
test('THE STAFFORDHIRE PUB bucket requires client review and carries no hardcoded alias', () => {
  const b = map.resolveMicrosoftBucketMapping('2025 CLIENTS SCHEDULE', 'THE STAFFORDHIRE PUB')
  assert.equal(b.requiresClientReview, true)
  assert.equal(b.targetBucket, 'THE STAFFORDHIRE PUB')
  // The mapper no longer ships client aliases in code; they live in client_aliases.
  assert.equal('clientAliases' in b, false)
  const b2 = map.resolveMicrosoftBucketMapping('2025 CLIENTS SCHEDULE', 'The Staffordhire Pub ')
  assert.equal(b2.requiresClientReview, true)
})

test('THE STAFFORDHIRE PUB resolves to The Staffy from a stored directory alias', () => {
  const ctx = {
    clients: [{ id: 'staffy', name: 'The Staffy', active: true, aliases: ['the staffordhire pub'] }],
    boards: [],
    buckets: [],
    packages: [{ id: 'pkg-staffy', clientId: 'staffy', status: 'active' }],
    templates: [{ id: 't-dp1', packageId: 'pkg-staffy', code: 'DP1', deliverableType: 'dp', active: true }],
  }
  const item = prev.previewPlannerTask({
    sourceType: 'planner_task',
    sourcePlanId: 'plan-2025',
    sourcePlanName: '2025 CLIENTS SCHEDULE',
    sourceBucketId: 'bucket-staffordhire',
    sourceBucketName: 'THE STAFFORDHIRE PUB',
    sourceTaskId: 'task-1',
    title: 'DP1 - STAFFY',
    description: null,
    startDate: '2026-07-01',
    dueDate: '2026-07-06',
    assigneeMicrosoftIds: [],
    percentComplete: 0,
    completedDate: null,
    sourceModifiedAt: '2026-07-01T08:00:00Z',
  }, ctx)
  assert.equal(item.previewStatus, 'new')
  assert.equal(item.mappedClientId, 'staffy')
  assert.equal(item.mappedClientName, 'The Staffy')
})

// ── Deliverable parsing of the REAL Staffy July titles ────────────────────────
test('every real Staffy July task parses to the correct deliverable identity', () => {
  for (const row of STAFFY_JULY) {
    const id = prev.deliverableIdentity(row.title)
    assert.equal(id.code, row.code, `code for "${row.title}"`)
    assert.equal(id.deliverable_type, row.type, `type for "${row.title}"`)
    assert.equal(id.instance_number, row.n, `instance for "${row.title}"`)
    assert.equal(id.unnumbered, false, `numbered for "${row.title}"`)
  }
})

test('the no-dash "DP4 STAFFY" still parses (tolerant parser); the July set is 4 DP + 4 F + 4 Video', () => {
  const dp4 = prev.deliverableIdentity('DP4 STAFFY')
  assert.equal(dp4.code, 'DP4')
  assert.equal(dp4.deliverable_type, 'dp')
  const byType = STAFFY_JULY.reduce((acc, r) => ((acc[r.type] = (acc[r.type] || 0) + 1), acc), {})
  assert.deepEqual(byType, { photo: 4, video: 4, dp: 4 })
  // codes are unique → no duplicate deliverable slots
  assert.equal(new Set(STAFFY_JULY.map(r => r.code)).size, 12)
})

// ── Registry + Edge Function merge (root-cause fix) ───────────────────────────
test('phase-27a registers the real plan id so it is fetched without a secret edit', () => {
  assert.match(MIG, /create table if not exists public\.microsoft_sync_plan_sources/)
  assert.match(MIG, /1ZjZPTY4W02yLFfq1V7cYmUAAitG/)          // real plan id
  assert.match(MIG, /'2025 CLIENTS SCHEDULE', 'client_schedule'/)
  assert.match(MIG, /public\.is_admin\(\)/)                    // admin-managed
})

test('the Edge Function merges active registry plans into the env manifest (dedup by id, read-only)', () => {
  assert.match(FN, /from\('microsoft_sync_plan_sources'\)/)
  assert.match(FN, /\.eq\('active', true\)/)
  assert.match(FN, /manifest\.plans\.push\(\{ id, name \}\)/)
  assert.match(FN, /seen\.has\(id\)/)
})
