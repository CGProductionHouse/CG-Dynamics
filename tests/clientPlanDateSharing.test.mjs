import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

let server, fetchCalendar, sharing
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  ;({ fetchClientMonthAheadWithRpc: fetchCalendar } = await server.ssrLoadModule('/src/lib/clientPortalCalendar.ts'))
  sharing = await server.ssrLoadModule('/src/lib/clientScheduleSharing.ts')
})
test('sharing selection uses actual in-month dates, with separate reversible disclosure', () => {
  const rows = [
    { id: '1', scheduled_date: '2026-11-02', client_plan_shared_date: null },
    { id: '2', scheduled_date: null, client_plan_shared_date: null },
    { id: '3', scheduled_date: '2026-12-02', client_plan_shared_date: null },
    { id: '4', scheduled_date: '2026-11-09', client_plan_shared_date: '2026-11-09' },
    { id: '5', scheduled_date: '2026-11-10', client_plan_shared_date: '2026-11-02' },
    { id: '6', scheduled_date: null, client_plan_shared_date: '2026-11-02' },
  ]
  assert.deepEqual(sharing.planSharingRows(rows, '2026-11', true).map(r => r.id), ['1', '5'])
  assert.deepEqual(sharing.planSharingRows(rows, '2026-11', false).map(r => r.id), ['4', '5', '6'])
})
after(async () => { await server?.close() })
test('explicitly shared planned dates render without claiming approval or posting', async () => {
  const result = await fetchCalendar(async name => ({ error: null, data: name.endsWith('version') ? 1 : name.endsWith('posts_v2') ? [
    { row_key: 'opaque', schedule_date: '2026-11-25', title: 'Video 1', post_type: 'video', client_safe_status: 'planned' },
  ] : [] }), 'synthetic-client', '2026-11')
  assert.equal(result.posts.length, 1)
  assert.equal(result.posts[0].status, 'planned')
  assert.equal(result.loadFailed, false)
})
test('sharing stays in the exact-client manager schedule editor, outside preview and operational calendar', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  const editor = read('../src/pages/admin/ClientSchedulePage.tsx')
  assert.match(editor, /isManagerRole\(profile\?\.role\) && clientId && selectedClient && view !== 'year' && <ClientSchedulePlanSharing/)
  for (const path of ['../src/pages/client/ClientPlanPage.tsx', '../src/pages/admin/CompanyCalendarPage.tsx']) {
    assert.doesNotMatch(read(path), /setSchedulePlanSharing|ClientSchedulePlanSharing/)
  }
  const migration = read('../supabase/migrations/20261102120810_client_plan_date_sharing.sql')
  assert.doesNotMatch(migration, /company_calendar_events|planner_tasks|due_date/)
  assert.match(migration, /security invoker/)
  assert.match(migration, /current_user <> 'postgres'/)
  assert.match(migration, /role not in \('admin', 'manager'\)/)
})
