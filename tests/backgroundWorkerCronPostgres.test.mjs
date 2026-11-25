import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash, createHmac, randomUUID, webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'

const container = process.env.CG_SOCIAL_QA_CONTAINER
const enabled = container === 'cg-dynamics-social-220-qa'
const database = `qa_worker_auth_${randomUUID().replaceAll('-', '')}`
const original = "select net.http_post('fixture-existing-worker')"
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const source = readFileSync('docs/ops/approvals/BACKGROUND-WORKER-AUTH-CRON-2026-11-24.sql', 'utf8')
// Only substitute the production command fingerprint for our synthetic baseline.
// Cron, Vault and HTTP fixtures below stay inside actual isolated PostgreSQL.
const packet = source.replace('a432533625dcb8db3cd10c3c7e518e69', createHash('md5').update(original).digest('hex'))
function sql(query) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq'], {
    input: query, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}
before(() => {
  if (!enabled) return
  const info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0]
  assert.equal(info.HostConfig.NetworkMode, 'none')
  assert.equal(info.Config.Labels['cg.task'], 'social-publishing-220')
  assert.deepEqual(info.HostConfig.PortBindings ?? {}, {})
  execFileSync('docker', ['exec', container, 'createdb', '-U', 'postgres', database])
  sql(`create schema cron; create schema vault; create schema net; create schema extensions;
    create extension pgcrypto with schema extensions;
    create table cron.job(jobid bigint primary key,jobname text,schedule text,active boolean,database text,username text,command text);
    create table vault.secrets(name text,decrypted_secret text);
    create view vault.decrypted_secrets as select * from vault.secrets;
    create table requests(url text,headers jsonb,body jsonb,timeout_ms integer);
    create table mutation_mode(value text);
    insert into mutation_mode values('normal');
    create function cron.alter_job(job_id bigint,command text) returns void language plpgsql as $$
    begin
      update cron.job j set command=alter_job.command where j.jobid=job_id;
      if (select value from mutation_mode)='other' then update cron.job set active=false where jobid=2; end if;
      if (select value from mutation_mode)='identity' then update cron.job set schedule='0 * * * *' where jobid=job_id; end if;
    end $$;
    create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$
    begin insert into requests values(url,headers,body,timeout_milliseconds); return 1; end $$;`)
})
function reset() {
  sql(`truncate cron.job,vault.secrets,requests; update mutation_mode set value='normal';
    insert into cron.job values(1,'cg-background-worker','* * * * *',true,'postgres','postgres',${quote(original)}),
      (2,'unrelated-job','0 9 * * *',true,'postgres','postgres','select 1');
    insert into vault.secrets values('cg_background_worker_invocation_secret',${quote('a'.repeat(64))});`)
}
const state = () => sql('select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j')

test('real PostgreSQL: coordinated worker cron capability guards and transactional preservation', { skip: !enabled }, async t => {
  for (const [label, change] of [
    ['missing key', 'truncate vault.secrets'], ['malformed key', "update vault.secrets set decrypted_secret='not-a-key'"],
    ['ambiguous key', `insert into vault.secrets values('cg_background_worker_invocation_secret',${quote('b'.repeat(64))})`],
    ['command drift', "update cron.job set command='select 2' where jobid=1"],
    ['null command', 'update cron.job set command=null where jobid=1'],
    ['null schedule', 'update cron.job set schedule=null where jobid=1'],
    ['schedule drift', "update cron.job set schedule='0 * * * *' where jobid=1"],
    ['disabled cron', 'update cron.job set active=false where jobid=1'],
    ['wrong cron identity', "update cron.job set jobname='another-worker' where jobid=1"],
  ]) await t.test(`${label} refuses without modifying any cron row or sending HTTP`, () => {
    reset(); sql(change); const before = state()
    assert.throws(() => sql(packet)); assert.equal(state(), before)
    assert.equal(sql('select count(*) from requests'), '0')
  })
  await t.test('only the exact caller command changes; real pgcrypto proof matches Node and actual worker WebCrypto', async () => {
    reset(); const before = JSON.parse(state()); sql(packet); const after = JSON.parse(state())
    assert.deepEqual(after[1], before[1]); assert.deepEqual({ ...after[0], command: original }, before[0])
    assert.equal(sql('select count(*) from requests'), '0', 'preparation must not invoke the worker')
    sql(after[0].command)
    const observed = JSON.parse(sql('select to_jsonb(r) from requests r'))
    assert.equal(observed.url, 'https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/background-worker')
    const stamp = observed.headers['X-CG-Worker-Timestamp'], key = 'a'.repeat(64)
    assert.match(stamp, /^[1-9][0-9]{9}$/)
    assert.deepEqual(observed.headers, { 'Content-Type': 'application/json', 'X-CG-Worker-Timestamp': stamp,
      'X-CG-Worker-Signature': createHmac('sha256', key).update(['cg-background-worker:v1','POST',stamp].join('\n')).digest('hex') })
    assert.doesNotMatch(after[0].command + JSON.stringify(observed), new RegExp(key), 'base key must never enter command or queued HTTP')
    const context = { exports: {}, Request, Response, TextEncoder, Uint8Array, crypto: webcrypto }
    vm.runInNewContext(ts.transpileModule(readFileSync('supabase/functions/_shared/backgroundWorkerInvocation.ts','utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context)
    const authorize = context.exports.authorizeBackgroundWorkerInvocation
    assert.equal(await authorize(new Request(observed.url,{method:'POST',headers:observed.headers}), () => key), null)
    assert.deepEqual(observed.body, {}); assert.equal(observed.timeout_ms, 30000)
    const saved = state(); assert.throws(() => sql(packet)); assert.equal(state(), saved)
    sql('truncate requests,vault.secrets'); sql(after[0].command)
    assert.equal(sql('select count(*) from requests'), '0', 'missing key must not send even an unauthenticated request')
    for (const values of [[key,key], [key,'malformed'], ['malformed'], [null]]) {
      sql('truncate requests,vault.secrets')
      for (const value of values) sql(`insert into vault.secrets values('cg_background_worker_invocation_secret',${value === null ? 'null' : quote(value)})`)
      sql(after[0].command)
      assert.equal(sql('select count(*) from requests'), '0', 'missing/malformed/ambiguous runtime key must not send HTTP')
    }
  })
  for (const mode of ['other', 'identity']) await t.test(`unexpected ${mode} mutation rolls the whole cron transaction back`, () => {
    reset(); sql(`update mutation_mode set value=${quote(mode)}`); const before = state()
    assert.throws(() => sql(packet)); assert.equal(state(), before)
    assert.equal(sql('select count(*) from requests'), '0')
  })
})
