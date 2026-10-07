import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('revision review authority executes real migration, RPC, trigger, concurrent CAS and RLS locally', { skip: process.env.CG_RUN_LOCAL_DB !== '1' }, async () => {
  const docker = (args, input) => spawnSync('docker', args, { input, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 })
  const name = `cg-card-revision-${randomUUID()}`
  const started = docker(['run', '--pull=never', '--detach', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine'])
  assert.equal(started.status, 0, started.stderr)
  const id = started.stdout.trim(); assert.match(id, /^[a-f0-9]{64}$/)
  try {
    let ready = false
    for (let i = 0; i < 60; i++) {
      if (docker(['exec', id, 'pg_isready', '-U', 'postgres']).status === 0) { ready = true; break }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
    }
    assert.ok(ready)
    const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
    const old = read('../supabase/migrations/20260803090000_skill_card_review_workflow.sql')
    // Canonical historical authority; queue result shape is replaced by the new migration.
    const historical = old.slice(0, old.indexOf('-- ── Review queue'))
      + 'create function public.skill_card_review_queue() returns void language sql as $$ select null::void $$;\n'
      + old.slice(old.indexOf('-- ── Record a review decision'))
    const sql = read('./sql/433_review_revision_setup.sql')
      + read('../supabase/phase-18a-marketing-library-foundation.sql')
      + read('../supabase/phase-26a-skill-card-governance-fields.sql')
      + 'alter table public.skill_cards add column source_reference text, add column reference_state text;\n'
      + historical + read('../supabase/migrations/20260803140000_skill_card_routing_review.sql')
      + read('./sql/433_review_revision_legacy.sql')
      + read('../supabase/migrations/20261007102349_skill_card_review_revision_binding.sql')
      + read('./sql/433_review_revision_acceptance.sql')
    const result = docker(['exec', '-i', id, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], sql)
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr)
    assert.match(result.stdout, /REVISION REVIEW ACCEPTANCE PASS/)
    const current = docker(['exec', id, 'psql', '-U', 'postgres', '-Atc', "select public.skill_card_material_hash(c) from public.skill_cards c limit 1"]).stdout.trim()
    assert.match(current, /^[a-f0-9]{64}$/)
    const prefix = "begin; set role authenticated; select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);"
    // Hold the first exact human wording edit uncommitted while the stale second reviewer arrives.
    const first = spawn('docker', ['exec', '-i', id, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] })
    let output = '', errors = ''
    first.stderr.on('data', chunk => { errors += chunk })
    const locked = new Promise((resolve, reject) => {
      first.stdout.on('data', chunk => { output += chunk; if (output.includes('FIRST_REVIEW_LOCKED')) resolve() })
      first.on('error', reject); first.on('exit', code => { if (code !== 0) reject(new Error(errors)) })
    })
    const finished = new Promise(resolve => first.on('exit', code => resolve(code)))
    first.stdin.end(prefix + `select public.skill_card_record_review('40000000-0000-4000-8000-000000000001','approved','First','{"summary":"First concurrent edit"}','${current}'); select 'FIRST_REVIEW_LOCKED'; select pg_sleep(1); commit;`)
    await locked
    const second = docker(['exec', '-i', id, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], prefix + `select public.skill_card_record_review('40000000-0000-4000-8000-000000000001','approved','Second','{"summary":"Stale second edit"}','${current}'); commit;`)
    assert.equal(await finished, 0, errors)
    assert.notEqual(second.status, 0); assert.match(second.stderr, /changed.*Reload/i)
    const saved = docker(['exec', id, 'psql', '-U', 'postgres', '-Atc', 'select summary from public.skill_cards limit 1'])
    assert.equal(saved.stdout.trim(), 'First concurrent edit')
  } finally { assert.equal(docker(['rm', '--force', id]).status, 0) }
})
