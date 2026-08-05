import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Microsoft / Outlook / Planner / schedule client resolution is now DRIVEN BY THE
// DATABASE: the MATCHER derives client forms from the ACTIVE directory and reads
// only the non-derivable spellings out of public.client_aliases. No real client
// name, alias or misspelling lives in the import runtime code here, so adding or
// correcting an alias takes effect with NO application code change or deploy.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const MAP_SRC = read('../src/lib/microsoftImportMap.ts')
const PREVIEW_SRC = read('../src/lib/microsoftImportPreview.ts')
const MATCHER_SRC = read('../src/lib/clientMatcher.ts')
const DATA_SRC = read('../src/lib/microsoftImportData.ts')

let server
let resolveMicrosoftClient
let previewPlannerTask
let previewOutlookEvent
let resolveMicrosoftBucketMapping

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ resolveMicrosoftClient, previewPlannerTask, previewOutlookEvent } = await server.ssrLoadModule('/src/lib/microsoftImportPreview.ts'))
  ;({ resolveMicrosoftBucketMapping } = await server.ssrLoadModule('/src/lib/microsoftImportMap.ts'))
})
after(async () => { await server?.close() })

// ── Fixtures ────────────────────────────────────────────────────────────────
function scheduleSource(bucket, overrides = {}) {
  return {
    sourceType: 'planner_task',
    sourcePlanId: 'plan-july',
    sourcePlanName: 'Client Socials - July 2026',
    sourceBucketId: `bucket-${bucket}`,
    sourceBucketName: bucket,
    sourceTaskId: overrides.taskId ?? `task-${bucket}`,
    title: overrides.title ?? 'DP1 - CLIENT',
    description: null,
    startDate: '2026-07-01',
    dueDate: '2026-07-10',
    assigneeMicrosoftIds: [],
    percentComplete: 0,
    completedDate: null,
    ...overrides,
  }
}

function scheduleContextFor(client, template = { id: 't-dp1', packageId: 'pkg', code: 'DP1', deliverableType: 'dp', active: true }) {
  return {
    clients: [client],
    boards: [],
    buckets: [],
    packages: [{ id: 'pkg', clientId: client.id, status: 'active' }],
    templates: [template],
  }
}

// ── 1. A stored client_aliases spelling resolves on import ──────────────────
test('Microsoft schedule import resolves a stored client_aliases spelling to the client', () => {
  const staffy = { id: 'c-staffy', name: 'The Staffy', active: true, aliases: ['the staffordhire pub'] }
  const item = previewPlannerTask(scheduleSource('THE STAFFORDHIRE PUB'), scheduleContextFor(staffy))
  assert.equal(item.previewStatus, 'new')
  assert.equal(item.mappedClientId, 'c-staffy')
  assert.equal(item.mappedClientName, 'The Staffy')
  assert.equal(item.proposedPayload.client_id, 'c-staffy')
})

// ── 2. Adding / correcting an alias needs no application code change ────────
test('an alias added or corrected takes effect with no application code change', () => {
  const source = scheduleSource('ACME WEST')
  const sameResolver = item => previewPlannerTask(source, scheduleContextFor(item))

  // "ACME WEST" is not derivable from "Highland Mills": no stored alias → the
  // SAME code leaves it unresolved rather than guessing.
  const noAlias = sameResolver({ id: 'c-hm', name: 'Highland Mills', active: true })
  assert.equal(noAlias.conflictCode, 'unresolved_client')

  // An alias added to client_aliases (data only): the same code now resolves it.
  const withAlias = sameResolver({ id: 'c-hm', name: 'Highland Mills', active: true, aliases: ['acme west'] })
  assert.equal(withAlias.previewStatus, 'new')
  assert.equal(withAlias.mappedClientName, 'Highland Mills')
  assert.equal(withAlias.mappedClientId, 'c-hm')

  // Correcting the alias in data (the true spelling replaces the mistyped one)
  // flows through the SAME code: the old spelling no longer resolves, the
  // corrected spelling does.
  const correctedContext = scheduleContextFor({ id: 'c-hm', name: 'Highland Mills', active: true, aliases: ['acm enterprises'] })
  assert.equal(previewPlannerTask(scheduleSource('ACME WEST'), correctedContext).conflictCode, 'unresolved_client')
  assert.equal(previewPlannerTask(scheduleSource('ACM ENTERPRISES'), correctedContext).mappedClientId, 'c-hm')
})

// ── 3. Inactive clients never match ─────────────────────────────────────────
test('inactive clients never match; an active same-name client does', () => {
  const inactive = { id: 'c-inactive', name: 'Acme', active: false }
  const active = { id: 'c-active', name: 'Acme', active: true }

  // Only the inactive client present → unresolved.
  assert.equal(resolveMicrosoftClient('ACME', [inactive]).status, 'unresolved')

  // Both present → the ACTIVE client resolves, never the inactive one.
  const withBoth = resolveMicrosoftClient('ACME', [inactive, active])
  assert.equal(withBoth.status, 'matched')
  assert.equal(withBoth.client.id, 'c-active')

  // End to end: an inactive-only directory leaves the schedule card unresolved.
  const item = previewPlannerTask(scheduleSource('ACME'), scheduleContextFor(inactive))
  assert.equal(item.conflictCode, 'unresolved_client')
})

// ── 4. Ambiguous aliases stay unresolved ────────────────────────────────────
test('an alias owned by more than one active client stays unresolved', () => {
  const dir = [
    { id: 'c-bfn', name: 'Supa Quick BFN', active: true },
    { id: 'c-cent', name: 'Supa Quick Centurion', active: true },
  ]
  const res = resolveMicrosoftClient('SUPA QUICK', dir)
  assert.equal(res.status, 'ambiguous')
  assert.deepEqual([...res.ambiguousBetween].sort(), ['Supa Quick BFN', 'Supa Quick Centurion'])
  assert.equal(res.client, null)

  const item = previewPlannerTask(scheduleSource('SUPA QUICK'), { ...scheduleContextFor(dir[0]), clients: dir })
  assert.equal(item.conflictCode, 'ambiguous_client_match')
  assert.match(item.conflictReason, /"SUPA QUICK"/)
  assert.equal(item.mappedClientId, null)
})

// ── 5. Unknown aliases stay unresolved ──────────────────────────────────────
test('unknown aliases remain unresolved', () => {
  const dir = [{ id: 'c-acme', name: 'Acme', active: true }]
  assert.equal(resolveMicrosoftClient('NO SUCH CLIENT', dir).status, 'unresolved')

  const item = previewPlannerTask(scheduleSource('NO SUCH CLIENT'), scheduleContextFor(dir[0]))
  assert.equal(item.conflictCode, 'unresolved_client')
  assert.match(item.conflictReason, /"NO SUCH CLIENT"/)
  assert.equal(item.mappedClientId, null)
})

// ── 6. client_id and client_name cannot diverge ─────────────────────────────
test('client_id and client_name are resolved together or not at all', () => {
  const dir = [
    { id: 'c-staffy', name: 'The Staffy', active: true, aliases: ['the staffordhire pub'] },
    { id: 'c-bfn', name: 'Supa Quick BFN', active: true },
    { id: 'c-cent', name: 'Supa Quick Centurion', active: true },
    { id: 'c-acme', name: 'Acme', active: true },
  ]
  const ctx = { ...scheduleContextFor(dir[0]), clients: dir, packages: [{ id: 'pkg', clientId: 'c-acme', status: 'active' }] }

  for (const bucket of ['THE STAFFORDHIRE PUB', 'SUPA QUICK', 'NO SUCH', 'ACME', 'Staffy']) {
    const item = previewPlannerTask(scheduleSource(bucket), ctx)
    const idPresent = item.mappedClientId !== null
    const namePresent = item.mappedClientName !== null
    assert.equal(idPresent, namePresent, `id/name must agree for "${bucket}"`)
    if (item.proposedPayload) {
      assert.equal(item.proposedPayload.client_id, item.mappedClientId, `payload id for "${bucket}"`)
      if ('client_name' in item.proposedPayload) {
        assert.equal(item.proposedPayload.client_name, item.mappedClientName, `payload name for "${bucket}"`)
      }
    }
  }

  // Direct resolver: matched implies both id and name are populated and agree.
  const matched = resolveMicrosoftClient('THE STAFFORDHIRE PUB', dir)
  assert.equal(matched.status, 'matched')
  assert.ok(matched.client.id && matched.client.name)
  assert.equal(matched.client.id, 'c-staffy')
  assert.equal(matched.client.name, 'The Staffy')
})

// ── 7. Original imported client text is preserved ───────────────────────────
test('the original imported text is preserved, never rewritten', () => {
  // Master Client To Do persists the EXACT source bucket text for audit.
  const master = previewPlannerTask({
    sourceType: 'planner_task',
    sourcePlanId: 'plan-master',
    sourcePlanName: 'MASTER CLIENT TO DO',
    sourceBucketId: 'bucket-master',
    sourceBucketName: 'EHRLICH PARK',
    sourceTaskId: 'task-master',
    title: 'Launch plan',
    description: null,
    startDate: null,
    dueDate: '2026-07-10',
    assigneeMicrosoftIds: [],
    percentComplete: 0,
    completedDate: null,
  }, { clients: [{ id: 'c-ehrlich', name: 'Ehrlich Park Butchery', active: true, aliases: ['ehrlich park'] }], boards: [{ id: 'board-ops', slug: 'operations-todo' }], buckets: [{ id: 'bucket-requests', boardId: 'board-ops', name: 'CLIENT REQUESTS' }], packages: [], templates: [] })
  assert.equal(master.previewStatus, 'new')
  assert.equal(master.proposedPayload.client_id, 'c-ehrlich')
  assert.equal(master.proposedPayload.original_plan_name, 'MASTER CLIENT TO DO')
  assert.equal(master.proposedPayload.original_bucket_name, 'EHRLICH PARK')

  // Outlook keeps the event title verbatim and warns with the exact spelling.
  const outlook = previewOutlookEvent({
    sourceType: 'outlook_event',
    sourceCalendarId: 'calendar-1',
    sourceEventId: 'event-1',
    title: 'CONTENT RUN - NOVUST STEEL',
    safeSummary: 'Original safe summary text',
    startDate: '2026-07-28T08:00:00+02:00',
    endDate: '2026-07-28T10:00:00+02:00',
    allDay: false,
    location: null,
    private: false,
    cancelled: false,
    assigneeMicrosoftIds: [],
    sourceModifiedAt: '2026-07-20T08:00:00Z',
  }, { clients: [{ id: 'c-acme', name: 'Acme', active: true }], boards: [], buckets: [], packages: [], templates: [] })
  assert.equal(outlook.proposedPayload.title, 'CONTENT RUN - NOVUST STEEL')
  assert.equal(outlook.proposedPayload.microsoft_source_description, 'Original safe summary text')
  assert.match(outlook.warnings.join(' '), /"NOVUST STEEL"/)

  // Client Schedule conflict text quotes the exact original bucket spelling.
  const scheduleConflict = previewPlannerTask(scheduleSource('THE STAFFORDHIRE PUB'), {
    clients: [{ id: 'c-acme', name: 'Acme', active: true }], boards: [], buckets: [],
    packages: [], templates: [],
  })
  assert.match(scheduleConflict.conflictReason, /"THE STAFFORDHIRE PUB"/)
})

// ── 8. No real client alias map remains in runtime code ─────────────────────
test('no hardcoded client alias map or real client name remains in runtime code', () => {
  const codeOf = src => src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const src of [MAP_SRC, PREVIEW_SRC, MATCHER_SRC]) {
    const code = codeOf(src)
    assert.ok(!code.includes('MASTER_CLIENT_ALIASES'), 'MASTER_CLIENT_ALIASES must be removed')
    assert.ok(!code.includes('CLIENT_SCHEDULE_ALIASES'), 'CLIENT_SCHEDULE_ALIASES must be removed')
    assert.ok(!code.includes('OUTLOOK_CLIENT_ALIASES'), 'OUTLOOK_CLIENT_ALIASES must be removed')
    assert.ok(!code.includes('resolveMicrosoftOutlookClientAliases'), 'the Outlook alias resolver must be removed')
  }
  const code = codeOf([MAP_SRC, PREVIEW_SRC, MATCHER_SRC].join('\n'))
  for (const name of ['Staffy', 'Staffordhire', 'Supa Quick', 'Ehrlich', 'Braize', 'Bloem Marble',
                      'Action Sport', 'Bouwer', 'Case Bloemfontein', 'Dulux', 'Econo', 'Madison',
                      'Novus Steel', 'Piek Group', 'Securiforce', 'Toyota Bloemfontein', 'RC-Polypipe']) {
    assert.ok(!code.includes(name), `runtime code must not name the client "${name}"`)
  }
})

// ── 9. Aliases are loaded from the database, not code ───────────────────────
test('the mapping context loads client_aliases from the database', () => {
  assert.match(DATA_SRC, /from\('client_aliases'\)\.select\('client_id, alias'\)/)
  assert.match(DATA_SRC, /\.eq\('active', true\)/)
  assert.match(DATA_SRC, /aliases: aliasesByClient\.get\(row\.id as string\) \?\? \[\]/)
})

// ── 10. Plan/bucket mapping stays deterministic (non-client) ────────────────
test('plan and bucket mapping still resolves without any client aliases', () => {
  const b = resolveMicrosoftBucketMapping('2025 CLIENTS SCHEDULE', 'THE STAFFORDHIRE PUB')
  assert.equal(b.requiresClientReview, true)
  assert.equal('clientAliases' in b, false)
  assert.equal(resolveMicrosoftBucketMapping('To Do', 'ONCE-OFF').targetBucket, 'ONCE-OFF')
})