// Explicit disposable SQL acceptance. No ports, volumes, image pull or hosted DB.
// Run: node --test tests/sql/clientStrategyCalendarPrivacy.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const legacy = read('../../supabase/migrations/20260801190000_client_report_safe_projection.sql')
const helper = legacy.slice(legacy.indexOf('create or replace function public.client_safe_strategy_section('), legacy.indexOf('create or replace function public.client_safe_strategy_data('))
const baseline = read('../../supabase/migrations/20261013225255_client_strategy_gold_projection.sql')
const migration = read('../../supabase/migrations/20261117150038_client_strategy_selected_calendar_privacy.sql')
const goldNames = ['objective', 'audienceAndIntent', 'coreMessage', 'formatsAndRationale', 'testAndChange', 'pillarsAndHooks', 'mustAvoid', 'channelIntegration', 'successSignals', 'nextMonthGamePlan']
const fixture = {
  calendarSelections: [
    { title: 'PRIVATE INTERNAL MEETING', date: '2026-11-02', use: false, note: 'staff only' },
    { title: 'missing flag', date: '2026-11-03' },
    { title: 'string flag', use: 'true' },
    { title: 'null flag', use: null },
    { title: 'numeric flag', use: 1 },
    { title: 'Reviewed client date', date: '2026-11-20', use: true, note: 'Approved note', eventId: 'private-source', driveId: 'private-drive' },
  ],
  goldStandard: { ...Object.fromEntries(goldNames.map(name => [name, `Exact ${name}`])), privateDraft: 'never' },
  strategyGoingForward: 'Specific client direction',
  actionPlan: { professional_video: { enabled: true, items: ['A reviewed concept'], notes: 'Public note', private: 'never' } },
  internalNotes: 'never',
}
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
const selected = [{ title: 'Reviewed client date', date: '2026-11-20', use: true, note: 'Approved note' }]

test('real PostgreSQL selected-calendar contract', { timeout: 90000 }, async t => {
  let ownedId
  const docker = (args, input) => {
    const r = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 })
    if (r.error) throw r.error
    return r
  }
  const sql = text => {
    const r = docker(['exec', '-i', ownedId, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], text)
    assert.equal(r.status, 0, r.stderr)
    return r.stdout.trim()
  }
  const project = value => JSON.parse(sql(`select public.client_safe_strategy_data(${literal(value)});`))
  try {
    const r = docker(['run', '--pull=never', '--network=none', '--tmpfs', '/var/lib/postgresql/data:rw', '--name', `cg1003-calendar-${randomUUID()}`, '--label', 'cg.test=client-strategy-calendar-privacy', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-d', 'postgres:17-alpine'])
    assert.equal(r.status, 0, r.stderr)
    ownedId = r.stdout.trim()
    assert.match(ownedId, /^[a-f0-9]{64}$/)
    let ready = false
    for (let attempt = 0; attempt < 60; attempt++) {
      // The entrypoint starts a socket-only bootstrap server before restarting.
      // TCP loopback readiness identifies the final server, not that bootstrap.
      if (docker(['exec', ownedId, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status === 0) { ready = true; break }
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    assert.equal(ready, true, 'owned isolated Postgres must become ready')
    sql(`create role anon; create role authenticated; ${helper}\n${baseline}`)
    const old = project(fixture)
    assert.equal(old.calendarSelections.length, 6, 'reproduce the previous over-broad projection')
    sql(`create table snapshot_fixture(raw jsonb,published jsonb); insert into snapshot_fixture values(${literal(fixture)},${literal(old)});`)
    const snapshotHash = sql('select md5(to_jsonb(s)::text) from snapshot_fixture s;')
    const applied = process.env.CG_CALENDAR_PRIVACY_BASELINE === '1' ? baseline : migration
    sql(applied)
    await t.test('unused, missing and non-boolean selections cannot leave the projection', () => {
      assert.deepEqual(project(fixture).calendarSelections, selected)
    })
    await t.test('malformed and all-unselected calendars project an empty array', () => {
      for (const value of [null, {}, [], 'bad']) assert.deepEqual(project({ calendarSelections: value }).calendarSelections, [])
      assert.deepEqual(project({ calendarSelections: fixture.calendarSelections.slice(0, 5) }).calendarSelections, [])
    })
    await t.test('every unrelated reviewed field and exact concept survives', () => {
      const current = project(fixture)
      const omit = ({ calendarSelections: _calendar, ...rest }) => rest
      assert.deepEqual(omit(current), omit(old))
      assert.deepEqual(Object.keys(current.goldStandard).sort(), [...goldNames].sort())
      assert.equal(JSON.stringify(current).includes('private-source'), false)
      assert.equal(JSON.stringify(current).includes('private-drive'), false)
    })
    await t.test('migration does not rewrite staff source or published snapshots', () => {
      assert.equal(sql('select md5(to_jsonb(s)::text) from snapshot_fixture s;'), snapshotHash)
    })
    await t.test('client and anonymous callers gain no direct execute authority', () => {
      for (const role of ['anon', 'authenticated']) assert.equal(sql(`select has_function_privilege('${role}','public.client_safe_strategy_data(jsonb)','execute');`), 'f')
    })
    await t.test('reapplying the definition remains deterministic without changing stored rows', () => {
      const before = project(fixture)
      sql(applied)
      assert.deepEqual(project(fixture), before)
      assert.equal(sql('select md5(to_jsonb(s)::text) from snapshot_fixture s;'), snapshotHash)
    })
  } finally {
    if (ownedId) {
      const label = docker(['inspect', '--format', '{{index .Config.Labels "cg.test"}}', ownedId])
      assert.equal(label.stdout.trim(), 'client-strategy-calendar-privacy', 'cleanup is limited to our exact owned container')
      assert.equal(docker(['rm', '-f', ownedId]).status, 0)
    }
  }
})
