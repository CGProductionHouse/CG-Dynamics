import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createServer } from 'vite'
import { facebookPostgresJourney } from './fixtures/facebookPostgresJourney.mjs'

// Opt-in REAL PostgreSQL. Never use a shared/project database or a network port.
const container = process.env.CG_SOCIAL_QA_CONTAINER
const enabled = container === 'cg-dynamics-social-220-qa'
const database = `qa_${randomUUID().replaceAll('-', '')}`
const actor = randomUUID()
let server, queue, authorization, authorizationStore, instagram
const q = value => `'${String(value).replaceAll("'", "''")}'`
function sql(text, role) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq'], {
    input: (role ? `set role ${role};\n` : '') + text, encoding: 'utf8', timeout: 30000,
  }).trim()
}
const jsonSql = text => JSON.parse(sql(text) || 'null')
function parallelSql(text) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq'])
    let out = '', error = ''; p.stdout.on('data', v => { out += v }); p.stderr.on('data', v => { error += v })
    p.on('error', reject); p.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(error))); p.stdin.end(text)
  })
}
before(async () => {
  if (!enabled) return
  assert.equal(execFileSync('docker', ['inspect', '--format', '{{index .Config.Labels "cg.task"}}', container], { encoding: 'utf8' }).trim(), 'social-publishing-220')
  assert.equal(execFileSync('docker', ['inspect', '--format', '{{.HostConfig.NetworkMode}}', container], { encoding: 'utf8' }).trim(), 'none')
  execFileSync('docker', ['exec', container, 'createdb', '-U', 'postgres', database])
  sql(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
   end $$;
   create schema auth; create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated,service_role;
   create table public.profiles(id uuid primary key,role text,is_active boolean,full_name text);
   create table public.clients(id uuid primary key,active boolean,package_settings jsonb);
   create table public.monthly_deliverables(id uuid primary key,client_id uuid,scheduled_date date,archived_at timestamptz,posted_at timestamptz,production_status text default 'not_started',
    microsoft_source_type text,microsoft_plan_id text,microsoft_bucket_id text,microsoft_task_id text);
   create table public.content_review_versions(id uuid primary key,deliverable_id uuid,client_id uuid,state text,asset_path text,media_type text,caption text,channels text[],scheduled_at timestamptz);
   create unique index one_current_review on public.content_review_versions(deliverable_id) where state='approved';
   create table public.tiktok_connections(id uuid primary key,client_id uuid,status text,profile_deep_link text);
   create table public.notifications(id uuid default gen_random_uuid(),user_id uuid,type text,title text,body text,entity_type text,entity_id uuid,link text);
   create table public.microsoft_sync_jobs(id uuid primary key,status text,exported_at timestamptz,created_at timestamptz,updated_at timestamptz);
   create table public.microsoft_sync_job_sources(id uuid primary key,job_id uuid,source_type text,source_id text,source_name text,stage text,complete boolean,
    safe_error text,pagination_cursor text,records jsonb,record_count integer,updated_at timestamptz);
   create table public.microsoft_sync_runs(id uuid primary key,preview_job_id uuid,status text,finished_at timestamptz,snapshot_exported_at timestamptz,source_completeness jsonb);
   create function public.is_admin() returns boolean language sql as $$ select false $$;
   create function public.is_manager() returns boolean language sql as $$ select false $$;
   insert into profiles values(${q(actor)},'manager',true,'Fixture manager');
  `)
  sql(readFileSync('supabase/migrations/20260801090000_durable_background_jobs.sql', 'utf8'))
  sql("alter table background_jobs add constraint background_jobs_allowed_type check(job_type in ('meta_sync','report_prep','tiktok_analytics_refresh')); grant all on all tables in schema public to service_role;")
  const legacy = readFileSync('supabase/migrations/20260801170000_backend_acceptance_hardening.sql', 'utf8')
  sql(legacy.slice(legacy.indexOf('create or replace function public.claim_next_background_job('), legacy.indexOf('drop function if exists public.update_background_job_progress(')))
  sql(readFileSync('supabase/migrations/20261115104948_social_publishing_queue.sql', 'utf8'))
  sql(readFileSync('supabase/migrations/20261116085815_social_publication_preparation_evidence.sql', 'utf8'))
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  queue = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishingQueue.ts')
  authorization = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorization.ts')
  authorizationStore = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorizationStore.ts')
  instagram = await server.ssrLoadModule('/supabase/functions/_shared/instagramPublishing.ts')
})
after(async () => server?.close())

function fixture({ authorized = true, advance = true } = {}) {
  const client = randomUUID(), deliverable = randomUUID(), review = randomUUID(), connection = randomUUID()
  sql(`insert into clients values(${q(client)},true,'{}'); insert into monthly_deliverables(id,client_id,scheduled_date,archived_at,posted_at) values(${q(deliverable)},${q(client)},(now() at time zone 'Africa/Johannesburg')::date,null,null);
   insert into content_review_versions values(${q(review)},${q(deliverable)},${q(client)},'approved',${q(`${deliverable}/final.jpg`)},'image/jpeg','Approved caption',array['facebook'],now()+interval '2 minutes');
   insert into tiktok_connections values(${q(connection)},${q(client)},'connected','https://www.tiktok.com/@fixture');`)
  const intent = jsonSql(`select jsonb_build_object('key',${q(`social-publish:v1:${JSON.stringify([client, deliverable, review, 'facebook', '12345'])}`)},'clientId',${q(client)},'deliverableId',${q(deliverable)},'reviewVersionId',id,
   'platform','facebook','route','facebook_page','connectionId',${q(connection)},'accountId','12345','assetPath',asset_path,'assetSha256',repeat('a',64),
   'mediaType',media_type,'caption',caption,'scheduledAt',scheduled_at,'authorizationId',${q(randomUUID())},'state','queued','attempt',0,'providerOperationId',null,'providerPostId',null)
   from content_review_versions where id=${q(review)}`)
  const enqueue = value => sql(`select enqueue_social_publication(${q(JSON.stringify(value))}::jsonb,${q(actor)})`, 'service_role')
  const job = enqueue(intent)
  const authorize = (value, by = actor, evidenceChanges = {}) => {
    const fingerprint = sql(`select social_publication_fingerprint(${q(JSON.stringify(value))})`)
    const evidence = { intentFingerprint: fingerprint, checkedAt: new Date().toISOString(), teamsRecordId: 'fixture-task', teamsRevision: 'fixture-revision', mediaProfile: 'fixture-facebook-photo', ...evidenceChanges }
    return jsonSql(`select authorize_social_publication(${q(JSON.stringify(value))},${q(by)},${q(fingerprint)},${q(JSON.stringify(evidence))})`)
  }
  if (authorized) authorize(intent)
  // Advance synthetic source + approval consistently to due time, without waiting.
  // Shift the synthetic confirmation as well; production source is never edited.
  if (advance) {
  intent.scheduledAt = sql("select to_char(now()-interval '1 minute','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')")
  sql(`update content_review_versions set scheduled_at=${q(intent.scheduledAt)} where id=${q(review)};
   update background_jobs set payload=jsonb_set(payload,'{intent}',${q(JSON.stringify(intent))}::jsonb),run_after=now(),
    publication=case when publication->'authorization' is null then publication else jsonb_set(jsonb_set(publication,
    '{authorization,fingerprint}',to_jsonb(social_publication_fingerprint(${q(JSON.stringify(intent))}))),
    '{authorization,evidence,intentFingerprint}',to_jsonb(social_publication_fingerprint(${q(JSON.stringify(intent))}))) end where id=${q(job)};`)
  }
  return { client, deliverable, review, connection, intent, job, enqueue, authorize }
}
function claim(f, worker) {
  sql(`select id from claim_next_background_job(${q(worker)})`)
  return jsonSql(`select claim_social_publication(${q(f.job)},${q(worker)})`)
}
function rpcClient() {
  return { async rpc(name, a) {
    const args = name === 'claim_social_publication' ? [a.p_id, a.p_worker]
      : name === 'begin_social_publication' ? [a.p_id, a.p_worker, a.p_fence]
      : name === 'begin_instagram_publication_publish' ? [a.p_id, a.p_worker, a.p_fence, a.p_container_id]
      : name === 'save_social_publication' ? [a.p_id, a.p_worker, a.p_fence, JSON.stringify(a.p_observation)] : null
    if (name === 'authorize_social_publication') return { data: jsonSql(`select authorize_social_publication(${q(JSON.stringify(a.p_intent))},${q(a.p_actor)},${q(a.p_fingerprint)},${q(JSON.stringify(a.p_evidence))})`), error: null }
    if (name === 'revoke_social_publication') return { data: jsonSql(`select revoke_social_publication(${q(a.p_id)},${q(a.p_client)},${q(a.p_actor)})`), error: null }
    if (!args) throw new Error('Unexpected fixture RPC')
    return { data: jsonSql(`select to_jsonb(${name}(${args.map(q).join(',')}))`), error: null }
  } }
}
function context(f) {
  return { review: { id: f.review, deliverable_id: f.deliverable, client_id: f.client, state: 'approved', asset_path: f.intent.assetPath, media_type: f.intent.mediaType, caption: f.intent.caption, channels: ['facebook'], scheduled_at: f.intent.scheduledAt },
    deliverable: { id: f.deliverable, client_id: f.client, scheduled_date: new Date(Date.parse(f.intent.scheduledAt) + 7200000).toISOString().slice(0, 10), archived_at: null, posted_at: null },
    binding: { clientId: f.client, connectionId: f.connection, accountId: '12345', route: 'facebook_page', active: true, grantedScopes: ['pages_manage_posts', 'pages_read_engagement'], tokenValidUntil: new Date(Date.now() + 3600000).toISOString(), appAccessVerified: true, accountPublishingVerified: true, mediaContractVerified: true },
    authorization: { id: f.intent.authorizationId, reviewVersionId: f.review, clientId: f.client, connectionId: f.connection, accountId: '12345', route: 'facebook_page', scheduledAt: f.intent.scheduledAt, assetSha256: f.intent.assetSha256 },
    assetSha256: f.intent.assetSha256, teamsScheduleVerified: true, rolloutApproved: true }
}

function capturedScheduleFixture() {
  const f = fixture({ advance: false }), job = randomUUID(), source = randomUUID(), run = randomUUID(), plan = randomUUID(), bucket = randomUUID(), task = randomUUID()
  const record = { sourceType: 'planner_task', sourcePlanId: plan, sourcePlanName: 'CLIENT SOCIALS FIXTURE', sourceBucketId: bucket,
    sourceTaskId: task, title: 'PRIVATE TITLE', description: 'PRIVATE NOTES', percentComplete: 0, completedDate: null,
    dueDate: sql(`select scheduled_date from monthly_deliverables where id=${q(f.deliverable)}`) }
  const coverage = [{ sourceType: 'planner_plan', sourceId: plan, sourceName: record.sourcePlanName, complete: true, safeError: null, recordCount: 1 }]
  sql(`update monthly_deliverables set microsoft_source_type='planner_task',microsoft_plan_id=${q(plan)},microsoft_bucket_id=${q(bucket)},microsoft_task_id=${q(task)} where id=${q(f.deliverable)};
   insert into microsoft_sync_jobs values(${q(job)},'complete',now()-interval '1 minute',now()-interval '2 minutes',now()-interval '1 minute');
   insert into microsoft_sync_job_sources values(${q(source)},${q(job)},'planner_plan',${q(plan)},${q(record.sourcePlanName)},'complete',true,null,null,${q(JSON.stringify([record]))},1,now()-interval '1 minute');
   insert into microsoft_sync_runs values(${q(run)},${q(job)},'completed',now()-interval '30 seconds',now()-interval '1 minute',${q(JSON.stringify(coverage))});
   update microsoft_sync_runs set snapshot_exported_at=(select exported_at from microsoft_sync_jobs where id=${q(job)}) where id=${q(run)};`)
  const read = () => JSON.parse(sql(`select read_social_publication_schedule_evidence(${q(actor)},${q(f.deliverable)},${q(f.review)})`, 'service_role'))
  return { ...f, sourceJob: job, source, run, plan, bucket, task, record, coverage, read }
}

function instagramFixture() {
  const f = fixture()
  Object.assign(f.intent, { platform: 'instagram', route: 'instagram_login', key: `social-publish:v1:${JSON.stringify([f.client, f.deliverable, f.review, 'instagram', '12345'])}` })
  sql(`update content_review_versions set channels=array['instagram'] where id=${q(f.review)};
   update background_jobs set idempotency_key=${q(f.intent.key)},payload=jsonb_set(payload,'{intent}',${q(JSON.stringify(f.intent))}::jsonb),
    publication=jsonb_set(publication,'{authorization,fingerprint}',to_jsonb(social_publication_fingerprint(${q(JSON.stringify(f.intent))}))) where id=${q(f.job)};`)
  const current = context(f)
  current.review.channels = ['instagram']; current.binding.route = 'instagram_login'
  current.binding.grantedScopes = ['instagram_business_basic', 'instagram_business_content_publish']; current.authorization.route = 'instagram_login'
  return { ...f, current }
}
function readyInstagramFixture() {
  const f = instagramFixture(), worker = `ig-ready-${randomUUID()}`, receipt = claim(f, worker)
  assert.equal(jsonSql(`select to_jsonb(begin_social_publication(${q(f.job)},${q(worker)},${q(receipt.fence)}))`), true)
  for (const phase of ['container_processing', 'container_ready']) {
    const lease = phase === 'container_processing' ? receipt : (sql(`update background_jobs set run_after=now() where id=${q(f.job)}`), claim(f, worker))
    assert.equal(jsonSql(`select to_jsonb(save_social_publication(${q(f.job)},${q(worker)},${q(lease.fence)},${q(JSON.stringify({ state: 'processing', operationId: '456', instagramPhase: phase }))}))`), true)
  }
  sql(`update background_jobs set run_after=now() where id=${q(f.job)}`)
  return { ...f, worker, receipt: claim(f, worker) }
}

test('real PostgreSQL: queue, source/role fences, crash recovery, receipts and OAuth transactions', { skip: !enabled }, async t => {
  for (const mode of ['success', 'stale', 'timeout']) await t.test(`Facebook connected SQL journey: ${mode}`, async () => {
    await facebookPostgresJourney({ server, sql, q, actor, rpcClient, mode })
  })
  // Facebook must work with ONLY its queue + captured-source migrations.
  // Rehearse the two later-platform migrations afterwards, on the same database.
  sql(readFileSync('supabase/migrations/20261115104950_tiktok_business_oauth.sql', 'utf8'))
  sql(readFileSync('supabase/migrations/20261116102019_instagram_publication_steps.sql', 'utf8'))
  await t.test('Instagram uses four persisted claims, two distinct mutations and an owner-verified final receipt', async () => {
    const f = instagramFixture(), worker = `ig-flow-${randomUUID()}`, calls = []; let published = false
    const transport = { approvedMediaUrl: async () => 'https://fixture.invalid/approved.jpg', async request(method, path) {
      calls.push([method, path])
      if (path.endsWith('/content_publishing_limit')) return { data: [{ quota_usage: 0, config: { quota_total: 50, quota_duration: 86400 } }] }
      if (method === 'POST' && path === '/12345/media') return { id: '456' }
      if (path === '/456') return { id: '456', status_code: published ? 'PUBLISHED' : 'FINISHED' }
      if (method === 'POST' && path === '/12345/media_publish') { published = true; return { id: '789' } }
      if (path === '/789') return { id: '789', owner: { id: '12345' }, media_type: 'IMAGE' }
      throw new Error('Unexpected Instagram fixture request')
    } }
    const bindings = { readCurrent: async () => f.current, submit: i => instagram.createInstagramPhotoContainer(i, transport),
      reconcile: (i, p) => instagram.readInstagramPhotoStatus(i, transport, p), publishReadyContainer: i => instagram.publishInstagramPhotoContainer(i, transport) }
    const run = async () => {
      sql(`update background_jobs set run_after=now() where id=${q(f.job)}; select id from claim_next_background_job(${q(worker)})`)
      return queue.runClaimedSocialPublication({ sb: rpcClient(), jobId: f.job, key: f.intent.key, worker, now: new Date().toISOString(), enabled: true, bindings })
    }
    assert.equal((await run()).publication.instagramPhase, 'container_processing')
    assert.equal(calls.filter(c => c[0] === 'POST').length, 1)
    assert.equal((await run()).publication.instagramPhase, 'container_ready')
    assert.equal(calls.filter(c => c[0] === 'POST').length, 1) // Ready saved before publish.
    assert.equal((await run()).publication.instagramPhase, 'verifying')
    assert.equal(calls.filter(c => c[0] === 'POST').length, 2)
    assert.equal((await run()).publication.state, 'posted')
    assert.equal(calls.filter(c => c[0] === 'POST').length, 2)
    const job = jsonSql(`select row_to_json(j) from background_jobs j where id=${q(f.job)}`)
    assert.equal(job.status, 'succeeded'); assert.equal(job.publication.instagram.publishAttempted, true)
    assert.equal(job.publication.observation.operationId, '456'); assert.equal(job.publication.observation.postId, '789')
    assert.equal(job.publication.authorization.id, f.intent.authorizationId)
  })

  await t.test('Instagram publish barrier is one-way under concurrency and lost-response recovery', async () => {
    const f = readyInstagramFixture(), args = `${q(f.job)},${q(f.worker)},${q(f.receipt.fence)},'456'`
    const results = await Promise.all([parallelSql(`select begin_instagram_publication_publish(${args})`), parallelSql(`select begin_instagram_publication_publish(${args})`)])
    assert.deepEqual(results.sort(), ['f', 't'])
    sql(`update background_jobs set locked_at=now()-interval '6 minutes' where id=${q(f.job)}`)
    const recovered = claim(f, 'ig-recovery')
    assert.equal(recovered.instagram.publishAttempted, true); assert.equal(recovered.instagram.phase, 'publishing')
    assert.equal(jsonSql(`select to_jsonb(begin_instagram_publication_publish(${q(f.job)},'ig-recovery',${q(recovered.fence)},'456'))`), false)
    // A late response is evidence, not authority to replay the second POST.
    assert.equal(jsonSql(`select to_jsonb(save_social_publication(${q(f.job)},${q(f.worker)},${q(f.receipt.fence)},${q(JSON.stringify({ state: 'processing', operationId: '456', postId: '789', instagramPhase: 'verifying' }))}))`), false)
    const row = jsonSql(`select publication from background_jobs where id=${q(f.job)}`)
    assert.equal(row.instagram.publishAttempted, true); assert.equal(row.late_observation.postId, '789')
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })

  await t.test('Instagram second step rechecks scope, source, active actor, revocation, lease, age and read budget', () => {
    for (const change of [
      f => `update profiles set is_active=false where id=${q(actor)}`,
      f => `update background_jobs set publication=jsonb_set(publication,'{authorization,revokedAt}',to_jsonb(now())) where id=${q(f.job)}`,
      f => `update content_review_versions set caption='changed' where id=${q(f.review)}`,
      f => `update monthly_deliverables set production_status='scheduled' where id=${q(f.deliverable)}`,
      f => `update background_jobs set publication=jsonb_set(publication,'{started_at}',to_jsonb(now()-interval '6 minutes')) where id=${q(f.job)}`,
      f => `update background_jobs set publication=jsonb_set(publication,'{instagram,statusReads}','5') where id=${q(f.job)}`,
      f => `update background_jobs set locked_at=now()-interval '6 minutes' where id=${q(f.job)}`,
    ]) {
      const f = readyInstagramFixture(); sql(change(f))
      try { assert.equal(jsonSql(`select to_jsonb(begin_instagram_publication_publish(${q(f.job)},${q(f.worker)},${q(f.receipt.fence)},'456'))`), false) }
      catch (error) { if (!/Current exact approved publication source required/.test(String(error))) throw error }
      assert.equal(jsonSql(`select publication->'instagram'->'publishAttempted' from background_jobs where id=${q(f.job)}`), false)
      sql(`update profiles set is_active=true where id=${q(actor)}; update background_jobs set status='cancelled' where id=${q(f.job)}`)
    }
  })

  await t.test('Instagram phase/receipt identities cannot skip the barrier, change container or expose service RPCs to users', () => {
    const f = readyInstagramFixture()
    for (const observation of [
      { state: 'posted', operationId: '456', postId: '789' }, { state: 'processing', operationId: '999', instagramPhase: 'container_ready' },
      { state: 'processing', operationId: '456', postId: '789', instagramPhase: 'verifying' },
    ]) assert.throws(() => sql(`select save_social_publication(${q(f.job)},${q(f.worker)},${q(f.receipt.fence)},${q(JSON.stringify(observation))})`))
    assert.equal(jsonSql(`select to_jsonb(begin_instagram_publication_publish(${q(f.job)},${q(f.worker)},${q(f.receipt.fence)},'999'))`), false)
    for (const role of ['anon', 'authenticated']) for (const name of ['claim_social_publication', 'claim_social_publication_lease_v1']) {
      assert.throws(() => sql(`select ${name}(${q(f.job)},${q(f.worker)})`, role), /permission denied/)
    }
    for (const role of ['anon', 'authenticated']) assert.throws(() => sql(`select begin_instagram_publication_publish(${q(f.job)},${q(f.worker)},${q(f.receipt.fence)},'456')`, role), /permission denied/)
    for (const signature of ['claim_social_publication(uuid,text)', 'claim_social_publication_lease_v1(uuid,text)',
      'save_social_publication(uuid,text,text,jsonb)', 'save_social_publication_receipt_v1(uuid,text,text,jsonb)', 'begin_instagram_publication_publish(uuid,text,text,text)']) {
      for (const role of ['anon', 'authenticated']) assert.equal(sql(`select has_function_privilege(${q(role)},${q(signature)},'execute')`), 'f')
      assert.equal(sql(`select prosecdef from pg_proc where oid=${q(signature)}::regprocedure`), 'f')
    }
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('captured-source preflight reads one exact fresh task proof without exposing text or writing capture/schedule state', () => {
    const f = capturedScheduleFixture(), before = sql(`select row_to_json(s) from microsoft_sync_job_sources s where id=${q(f.source)}`)
    const proof = f.read()
    assert.equal(proof.contract, 'social_publication_schedule_evidence_v1'); assert.equal(proof.clientId, f.client)
    assert.equal(proof.recordId, f.task); assert.match(proof.revision, /^[a-f0-9]{64}$/)
    assert.equal(JSON.stringify(proof).includes('PRIVATE'), false)
    assert.equal(sql(`select row_to_json(s) from microsoft_sync_job_sources s where id=${q(f.source)}`), before)
    assert.equal(sql(`select production_status from monthly_deliverables where id=${q(f.deliverable)}`), 'not_started')
    for (const role of ['anon', 'authenticated']) assert.throws(() => sql(`select read_social_publication_schedule_evidence(${q(actor)},${q(f.deliverable)},${q(f.review)})`, role), /permission denied/)
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('stale/incomplete/changed/duplicated captured instruction cannot ground publication', () => {
    for (const change of [
      f => `update microsoft_sync_jobs set exported_at=now()-interval '6 minutes' where id=${q(f.sourceJob)}`,
      f => `update microsoft_sync_jobs set created_at=now()-interval '6 minutes' where id=${q(f.sourceJob)}`,
      f => `update microsoft_sync_job_sources set updated_at=now()-interval '6 minutes' where id=${q(f.source)}`,
      f => `update microsoft_sync_job_sources set complete=false where id=${q(f.source)}`,
      f => `update microsoft_sync_runs set source_completeness='[]' where id=${q(f.run)}`,
      f => `update microsoft_sync_job_sources set records=${q(JSON.stringify([{ ...f.record, dueDate: '2000-01-01' }]))} where id=${q(f.source)}`,
      f => `update microsoft_sync_job_sources set records=${q(JSON.stringify([{ ...f.record, percentComplete: 100 }]))} where id=${q(f.source)}`,
      f => `update microsoft_sync_job_sources set records=${q(JSON.stringify([f.record, f.record]))},record_count=2 where id=${q(f.source)};
       update microsoft_sync_runs set source_completeness=${q(JSON.stringify([{ ...f.coverage[0], recordCount: 2 }]))} where id=${q(f.run)}`,
      f => `update monthly_deliverables set microsoft_task_id=${q(randomUUID())} where id=${q(f.deliverable)}`,
      f => `update monthly_deliverables set production_status='scheduled' where id=${q(f.deliverable)}`,
      f => `update content_review_versions set client_id=${q(randomUUID())} where id=${q(f.review)}`,
      f => `insert into monthly_deliverables(id,client_id,microsoft_plan_id,microsoft_task_id) values(gen_random_uuid(),${q(f.client)},${q(f.plan)},${q(f.task)})`,
    ]) {
      const f = capturedScheduleFixture(); sql(change(f)); assert.throws(f.read)
      sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
    }
  })
  await t.test('new incomplete capture supersedes older success; explicit source identity is required', () => {
    const f = capturedScheduleFixture(), newer = randomUUID()
    sql(`insert into microsoft_sync_jobs values(${q(newer)},'running',null,now(),now());
     insert into microsoft_sync_job_sources select gen_random_uuid(),${q(newer)},source_type,source_id,source_name,'fetching_tasks',false,null,null,'[]',0,now() from microsoft_sync_job_sources where id=${q(f.source)};`)
    assert.throws(f.read, /Fresh complete/)
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('marking the canonical item scheduled manually blocks a new provider mutation even without posted_at', () => {
    const f = fixture(), row = claim(f, 'manual-schedule')
    sql(`update monthly_deliverables set production_status='scheduled' where id=${q(f.deliverable)}`)
    assert.throws(() => sql(`select begin_social_publication(${q(f.job)},'manual-schedule',${q(row.fence)})`), /approved publication source/)
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('publication rows are hidden from former requesters who become client/staff/inactive; generic job visibility stays intact', () => {
    const f = fixture({ advance: false })
    sql('grant select on background_jobs,profiles to authenticated')
    const legacy = sql(`insert into background_jobs(job_type,requested_by,run_after) values('meta_sync',${q(actor)},'infinity') returning id`)
    const count = id => sql(`set request.jwt.claim.sub=${q(actor)}; select count(*) from background_jobs where id=${q(id)}`, 'authenticated')
    try {
      assert.equal(count(f.job), '1')
      for (const [role, active] of [['client', true], ['staff', true], ['manager', false]]) {
        sql(`update profiles set role=${q(role)},is_active=${active} where id=${q(actor)}`)
        assert.equal(count(f.job), '0', `Publication leaked to ${role}/${active}`)
        assert.equal(count(legacy), '1', 'Unrelated job visibility changed')
      }
    } finally {
      sql(`update profiles set role='manager',is_active=true where id=${q(actor)};
       update background_jobs set status='cancelled' where id in (${q(f.job)},${q(legacy)})`)
    }
  })
  await t.test('preview/confirm core uses atomic authorization RPC, duplicate confirmation keeps the original receipt', async () => {
    const f = fixture({ authorized: false, advance: false }), writes = socialCount()
    function socialCount() { return sql("select count(*) from background_jobs where job_type='social_publish'") }
    const ports = { ...authorizationStore.socialPublicationAuthorizationStore(rpcClient()),
      authenticate: async () => ({ id: actor, role: 'manager', active: true }),
      readCandidate: async () => ({ context: context(f), evidence: { intentFingerprint: await authorization.socialPublicationFingerprint(f.intent),
        checkedAt: new Date().toISOString(), teamsRecordId: 'fixture-task', teamsRevision: 'fixture-revision', mediaProfile: 'fixture-facebook-photo' } }) }
    const handler = authorization.socialPublicationAuthorizationHandler(ports, true)
    const target = { clientId: f.client, deliverableId: f.deliverable, reviewVersionId: f.review, connectionId: f.connection, accountId: '12345', route: 'facebook_page' }
    const request = body => new Request('https://fixture.invalid/authorization', { method: 'POST', body: JSON.stringify(body) })
    const previewResponse = await handler(request({ action: 'preview', target })), preview = await previewResponse.json()
    assert.equal(previewResponse.status, 200); assert.equal(socialCount(), writes)
    assert.equal(sql(`select publication->'authorization' is null from background_jobs where id=${q(f.job)}`), 't')
    const body = { action: 'confirm', target, expectedFingerprint: preview.preview.fingerprint, confirmPublication: true }
    const first = await handler(request(body)), firstBody = await first.json()
    assert.equal(first.status, 200); assert.equal(firstBody.publication.jobId, f.job)
    const saved = sql(`select publication->'authorization' from background_jobs where id=${q(f.job)}`)
    assert.equal((await handler(request(body))).status, 200)
    assert.equal(sql(`select publication->'authorization' from background_jobs where id=${q(f.job)}`), saved)
    assert.equal(socialCount(), writes)
    assert.equal(firstBody.publication.authorizationId, f.intent.authorizationId)
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  for (const route of ['instagram_login', 'instagram_facebook_login']) await t.test(`${route} exact confirmation uses the same atomic queue and original receipt in real PostgreSQL`, async () => {
    const f = fixture({ authorized: false, advance: false })
    Object.assign(f.intent, { platform: 'instagram', route, key: `social-publish:v1:${JSON.stringify([f.client, f.deliverable, f.review, 'instagram', '12345'])}` })
    sql(`update content_review_versions set channels=array['instagram'] where id=${q(f.review)};
      update background_jobs set idempotency_key=${q(f.intent.key)},payload=jsonb_set(payload,'{intent}',${q(JSON.stringify(f.intent))}::jsonb) where id=${q(f.job)}`)
    const current = context(f)
    current.review.channels = ['instagram']; current.binding.route = route; current.authorization = null
    current.binding.grantedScopes = route === 'instagram_login' ? ['instagram_business_basic', 'instagram_business_content_publish']
      : ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement']
    const count = sql("select count(*) from background_jobs where job_type='social_publish'")
    const handler = authorization.socialPublicationAuthorizationHandler({ ...authorizationStore.socialPublicationAuthorizationStore(rpcClient()),
      authenticate: async () => ({ id: actor, role: 'manager', active: true }), readCandidate: async () => ({ context: current,
        evidence: { intentFingerprint: await authorization.socialPublicationFingerprint(f.intent), checkedAt: new Date().toISOString(),
          teamsRecordId: 'fixture-task', teamsRevision: 'fixture-revision', mediaProfile: 'instagram_baseline_jpeg_v1' } }) }, true)
    const target = { clientId: f.client, deliverableId: f.deliverable, reviewVersionId: f.review, connectionId: f.connection, accountId: '12345', route }
    const request = body => new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify(body) })
    const preview = await handler(request({ action: 'preview', target })), body = await preview.json()
    assert.equal(preview.status, 200)
    assert.equal(sql(`select publication->'authorization' is null from background_jobs where id=${q(f.job)}`), 't')
    const confirm = { action: 'confirm', target, expectedFingerprint: body.preview.fingerprint, confirmPublication: true }
    const first = await handler(request(confirm)), result = await first.json()
    assert.equal(first.status, 200); assert.equal(result.publication.jobId, f.job)
    const saved = sql(`select publication->'authorization' from background_jobs where id=${q(f.job)}`)
    assert.equal((await handler(request(confirm))).status, 200)
    assert.equal(sql(`select publication->'authorization' from background_jobs where id=${q(f.job)}`), saved)
    assert.equal(sql("select count(*) from background_jobs where job_type='social_publish'"), count)
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('UTF-8 fingerprint matches SQL exactly and changes with each approved material field', async () => {
    const f = fixture({ advance: false }), i = { ...f.intent, caption: 'Café : café\nR99 🛠️ / \\"' }
    const expected = await authorization.socialPublicationFingerprint(i)
    assert.equal(sql(`select social_publication_fingerprint(${q(JSON.stringify(i))})`), expected)
    for (const field of ['clientId', 'deliverableId', 'reviewVersionId', 'platform', 'route', 'connectionId', 'accountId', 'assetPath', 'assetSha256', 'mediaType', 'caption', 'scheduledAt']) {
      const next = { ...i, [field]: i[field] + ':changed' }
      assert.notEqual(await authorization.socialPublicationFingerprint(next), expected)
    }
    assert.equal(await authorization.socialPublicationFingerprint({ ...i, authorizationId: randomUUID(), key: 'different-click', attempt: 8 }), expected)
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('raw queue insertion is never sufficient authority to begin a provider mutation', () => {
    const f = fixture({ authorized: false }), row = claim(f, 'unconfirmed')
    assert.equal(sql(`select begin_social_publication(${q(f.job)},'unconfirmed',${q(row.fence)})`), 'f')
    assert.equal(sql(`select publication->>'started_at' is null from background_jobs where id=${q(f.job)}`), 't')
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('confirmation requires fresh exact server evidence and privileged execution; invalid evidence leaves no grant', () => {
    const f = fixture({ authorized: false, advance: false })
    for (const evidence of [{ checkedAt: '2000-01-01T00:00:00Z' }, { checkedAt: 'infinity' },
      { checkedAt: new Date(Date.now() + 60_000).toISOString() }, { intentFingerprint: 'b'.repeat(64) },
      { teamsRecordId: '' }, { teamsRevision: null }, { mediaProfile: '' }, { providerToken: 'fixture-not-a-token' }]) {
      assert.throws(() => f.authorize(f.intent, actor, evidence), /publication (confirmation|preflight)/)
    }
    assert.throws(() => f.authorize(f.intent, randomUUID()), /Active manager/)
    for (const role of ['anon', 'authenticated']) {
      assert.throws(() => sql(`select authorize_social_publication(${q(JSON.stringify(f.intent))},${q(actor)},repeat('a',64),'{}')`, role), /permission denied/)
      assert.throws(() => sql(`select revoke_social_publication(${q(f.job)},${q(f.client)},${q(actor)})`, role), /permission denied/)
    }
    assert.equal(sql(`select publication->'authorization' is null from background_jobs where id=${q(f.job)}`), 't')
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('parallel confirmations keep one authorization and do not retarget an existing publication', async () => {
    const f = fixture({ authorized: false, advance: false }), other = randomUUID()
    sql(`insert into profiles values(${q(other)},'manager',true,'Another fixture manager')`)
    const fp = sql(`select social_publication_fingerprint(${q(JSON.stringify(f.intent))})`)
    const evidence = { intentFingerprint: fp, checkedAt: new Date().toISOString(), teamsRecordId: 'task', teamsRevision: 'rev', mediaProfile: 'photo' }
    const command = by => `select authorize_social_publication(${q(JSON.stringify({ ...f.intent, authorizationId: randomUUID() }))},${q(by)},${q(fp)},${q(JSON.stringify(evidence))})`
    const receipts = (await Promise.all([parallelSql(command(actor)), parallelSql(command(other))])).map(JSON.parse)
    assert.deepEqual(receipts[0], receipts[1]); assert.equal(receipts[0].jobId, f.job)
    const original = sql(`select publication->'authorization' from background_jobs where id=${q(f.job)}`)
    assert.throws(() => f.authorize({ ...f.intent, connectionId: randomUUID() }), /Existing publication differs/)
    assert.equal(sql(`select publication->'authorization' from background_jobs where id=${q(f.job)}`), original)
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('revocation stops a queued/claimed job, is idempotent and cannot mutate another client', () => {
    const f = fixture(), row = claim(f, 'withdrawn')
    assert.equal(jsonSql(`select revoke_social_publication(${q(f.job)},${q(randomUUID())},${q(actor)})`), null)
    assert.equal(sql(`select status from background_jobs where id=${q(f.job)}`), 'running')
    const first = jsonSql(`select revoke_social_publication(${q(f.job)},${q(f.client)},${q(actor)})`)
    assert.equal(first.state, 'cancelled'); assert.equal(first.providerMayHaveStarted, false)
    const saved = sql(`select publication->'authorization' from background_jobs where id=${q(f.job)}`)
    assert.deepEqual(jsonSql(`select revoke_social_publication(${q(f.job)},${q(f.client)},${q(actor)})`), first)
    assert.equal(sql(`select publication->'authorization' from background_jobs where id=${q(f.job)}`), saved)
    assert.equal(sql(`select begin_social_publication(${q(f.job)},'withdrawn',${q(row.fence)})`), 'f')
  })
  await t.test('revocation after durable begin retains in-flight truth and permits receipt reconciliation', () => {
    const f = fixture(), row = claim(f, 'already-started')
    assert.equal(sql(`select begin_social_publication(${q(f.job)},'already-started',${q(row.fence)})`), 't')
    const revoked = jsonSql(`select revoke_social_publication(${q(f.job)},${q(f.client)},${q(actor)})`)
    assert.equal(revoked.state, 'submitting'); assert.equal(revoked.providerMayHaveStarted, true)
    assert.equal(sql(`select save_social_publication(${q(f.job)},'already-started',${q(row.fence)},'{"state":"posted","postId":"12345_789"}')`), 't')
    assert.equal(sql(`select publication->>'state' from background_jobs where id=${q(f.job)}`), 'posted')
    assert.equal(sql(`select publication->'authorization'->>'revokedAt' is not null from background_jobs where id=${q(f.job)}`), 't')
  })
  await t.test('changed recorded confirmation fingerprint blocks a valid claimed intent', () => {
    const f = fixture(), row = claim(f, 'tampered-confirmation')
    sql(`update background_jobs set publication=jsonb_set(publication,'{authorization,fingerprint}',to_jsonb(repeat('b',64))) where id=${q(f.job)}`)
    assert.equal(sql(`select begin_social_publication(${q(f.job)},'tampered-confirmation',${q(row.fence)})`), 'f')
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('repeated clicks/reconnections keep one job, generic job types survive, foreign source and client/staff roles denied', () => {
    const f = fixture()
    // Re-enqueue while source is future (then restore due fixture).
    sql(`update content_review_versions set scheduled_at=now()+interval '2 minutes' where id=${q(f.review)}`)
    const current = { ...f.intent, scheduledAt: sql(`select scheduled_at from content_review_versions where id=${q(f.review)}`), key: 'new-click', connectionId: randomUUID() }
    assert.equal(f.enqueue(current), f.job)
    assert.equal(sql(`select count(*) from background_jobs where payload->'intent'->>'reviewVersionId'=${q(f.review)}`), '1')
    sql("insert into background_jobs(job_type) values('tiktok_analytics_refresh')")
    assert.throws(() => f.enqueue({ ...current, clientId: randomUUID() }), /approved publication source/)
    for (const change of [{ platform: undefined }, { platform: null }, { route: 'tiktok_accounts' }]) assert.throws(() => f.enqueue({ ...current, ...change }), /approved publication source/)
    for (const role of ['anon', 'authenticated']) assert.throws(() => sql(`select enqueue_social_publication(${q(JSON.stringify(current))},${q(actor)})`, role), /permission denied/)
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)} or job_type='tiktok_analytics_refresh'`)
  })
  await t.test('claim fences rotate, wrong worker and stale fence cannot start, changed approval blocks mutation', () => {
    const f = fixture(), first = claim(f, 'worker-a')
    assert.equal(jsonSql(`select claim_social_publication(${q(f.job)},'worker-b')`), null)
    const second = jsonSql(`select claim_social_publication(${q(f.job)},'worker-a')`)
    assert.notEqual(first.fence, second.fence)
    assert.equal(sql(`select begin_social_publication(${q(f.job)},'worker-a',${q(first.fence)})`), 'f')
    sql(`update content_review_versions set state='changes_requested' where id=${q(f.review)}`)
    assert.throws(() => sql(`select begin_social_publication(${q(f.job)},'worker-a',${q(second.fence)})`), /approved publication source/)
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('real executor persists submission before provider and one concurrent worker wins', async () => {
    const f = fixture(); claim(f, 'worker-c'); let submits = 0
    const input = { sb: rpcClient(), jobId: f.job, key: f.intent.key, worker: 'worker-c', now: new Date().toISOString(), enabled: true,
      bindings: { readCurrent: async () => context(f), submit: async () => { submits++; assert.equal(sql(`select publication->>'state' from background_jobs where id=${q(f.job)}`), 'submitting'); return { state: 'posted', postId: '12345_777' } }, reconcile: async () => { throw new Error('unexpected') } } }
    await queue.runClaimedSocialPublication(input)
    assert.equal(submits, 1); assert.equal(sql(`select status from background_jobs where id=${q(f.job)}`), 'succeeded')
    await assert.rejects(queue.runClaimedSocialPublication(input), /lease unavailable/)
    assert.equal(submits, 1)
  })
  await t.test('revoked actor and changed client source block a claimed future publication', () => {
    const f = fixture(), row = claim(f, 'revoked-actor')
    sql(`update profiles set is_active=false where id=${q(actor)}`)
    assert.equal(sql(`select begin_social_publication(${q(f.job)},'revoked-actor',${q(row.fence)})`), 'f')
    sql(`update profiles set is_active=true where id=${q(actor)};update clients set active=false where id=${q(f.client)}`)
    assert.throws(() => sql(`select begin_social_publication(${q(f.job)},'revoked-actor',${q(row.fence)})`), /approved publication source/)
    sql(`update clients set active=true where id=${q(f.client)};update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('generic expired-lease recovery preserves submitting barrier and cannot repeat accepted mutation', async () => {
    const f = fixture(), first = claim(f, 'crashed')
    assert.equal(sql(`select begin_social_publication(${q(f.job)},'crashed',${q(first.fence)})`), 't')
    sql(`update background_jobs set locked_at=now()-interval '6 minutes' where id=${q(f.job)}`)
    claim(f, 'recovery'); let submits = 0
    const result = await queue.runClaimedSocialPublication({ sb: rpcClient(), jobId: f.job, key: f.intent.key, worker: 'recovery', now: new Date().toISOString(), enabled: true,
      bindings: { readCurrent: async () => context(f), submit: async () => { submits++; }, reconcile: async () => { throw new Error('no receipt') } } })
    assert.equal(submits, 0); assert.equal(result.publication.state, 'unknown_outcome')
    assert.equal(sql(`select publication->>'state' from background_jobs where id=${q(f.job)}`), 'unknown_outcome')
  })
  await t.test('cross-version guard serializes concurrent starts and blocks replacement after ambiguous acceptance', async () => {
    const f = fixture(), first = claim(f, 'version-one')
    const start = `select begin_social_publication(${q(f.job)},'version-one',${q(first.fence)})`
    const results = await Promise.all([parallelSql(`begin;${start};select pg_sleep(0.15);commit;`), parallelSql(start)])
    assert.equal(results.filter(v => v.split('\n')[0] === 't').length, 1)
    const newer = randomUUID()
    sql(`update content_review_versions set state='superseded' where id=${q(f.review)};
      insert into content_review_versions select ${q(newer)},deliverable_id,client_id,'approved',asset_path||'.v2',media_type,caption,channels,now()+interval '2 minutes' from content_review_versions where id=${q(f.review)}`)
    const intent = { ...f.intent, key: `version-two-${newer}`, reviewVersionId: newer, assetPath: f.intent.assetPath + '.v2', scheduledAt: sql(`select scheduled_at from content_review_versions where id=${q(newer)}`) }
    const replacement = { ...f, job: f.enqueue(intent) }
    f.authorize(intent)
    intent.scheduledAt = sql("select to_char(now()-interval '1 minute','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')")
    sql(`update content_review_versions set scheduled_at=${q(intent.scheduledAt)} where id=${q(newer)};
      update background_jobs set payload=jsonb_set(payload,'{intent}',${q(JSON.stringify(intent))}::jsonb),
       publication=jsonb_set(publication,'{authorization,fingerprint}',to_jsonb(social_publication_fingerprint(${q(JSON.stringify(intent))}))),run_after=now() where id=${q(replacement.job)}`)
    const second = claim(replacement, 'version-two')
    assert.equal(sql(`select begin_social_publication(${q(replacement.job)},'version-two',${q(second.fence)})`), 'f')
    sql(`update background_jobs set status='cancelled' where id in (${q(f.job)},${q(replacement.job)})`)
  })
  await t.test('late provider receipt survives lost lease and is reconciled without a second POST', async () => {
    const f = fixture(), original = claim(f, 'late-original')
    assert.equal(sql(`select begin_social_publication(${q(f.job)},'late-original',${q(original.fence)})`), 't')
    sql(`update background_jobs set locked_at=now()-interval '6 minutes' where id=${q(f.job)}`)
    claim(f, 'late-recovery')
    assert.equal(sql(`select save_social_publication(${q(f.job)},'late-original',${q(original.fence)},'{"state":"posted","postId":"12345_999"}')`), 'f')
    assert.equal(sql(`select publication->>'state' from background_jobs where id=${q(f.job)}`), 'submitting')
    let posts = 0
    const result = await queue.runClaimedSocialPublication({ sb: rpcClient(), jobId: f.job, key: f.intent.key, worker: 'late-recovery', now: new Date().toISOString(), enabled: true,
      bindings: { readCurrent: async () => context(f), submit: async () => { posts++; }, reconcile: async intent => { assert.equal(intent.providerPostId, '12345_999'); return { state: 'posted', postId: '12345_999' } } } })
    assert.equal(posts, 0); assert.equal(result.publication.state, 'posted')
    assert.equal(sql(`select status from background_jobs where id=${q(f.job)}`), 'succeeded')
  })
  await t.test('OAuth state is consumed once, expired state refused, credentials private and metadata/credentials atomic', () => {
    const f = fixture(), state = randomUUID(), hash = 'b'.repeat(64)
    sql(`insert into tiktok_business_oauth_states(id,state_hash,client_id,connection_id,requested_by,expected_handle,expires_at) values(${q(state)},${q(hash)},${q(f.client)},${q(f.connection)},${q(actor)},'fixture',now()+interval '5 minutes')`)
    assert.ok(jsonSql(`select consume_tiktok_business_oauth_state(${q(hash)})`).id)
    assert.equal(jsonSql(`select consume_tiktok_business_oauth_state(${q(hash)})`), null)
    const finish = access => `select complete_tiktok_business_oauth(${q(state)},'business-open-id','fixture','Fixture',array['video.publish'],${q(access)},'cg-tiktok-business-token:v1:encrypted-fixture',now()+interval '1 day',now()+interval '1 year')`
    assert.throws(() => sql(finish('plaintext-forbidden'), 'service_role'), /check constraint/)
    assert.equal(sql(`select count(*) from tiktok_business_authorizations where client_id=${q(f.client)}`), '0')
    assert.ok(sql(finish('cg-tiktok-business-token:v1:encrypted-fixture'), 'service_role'))
    assert.throws(() => sql(`update tiktok_connections set client_id=${q(randomUUID())} where id=${q(f.connection)}`), /cannot be reassigned/)
    assert.throws(() => sql(finish('cg-tiktok-business-token:v1:encrypted-fixture'), 'service_role'), /exact TikTok authorization/)
    for (const role of ['anon', 'authenticated']) {
      assert.throws(() => sql('select * from tiktok_business_authorization_tokens', role), /permission denied/)
      assert.throws(() => sql('select refresh_fence from tiktok_business_authorizations', role), /permission denied/)
      assert.throws(() => sql("select consume_tiktok_business_oauth_state('untrusted')", role), /permission denied/)
    }
    sql(`update background_jobs set status='cancelled' where id=${q(f.job)}`)
  })
  await t.test('refresh lease prevents concurrent rotation, and fresh OAuth fences out an older refresh receipt', () => {
    const a = jsonSql('select to_jsonb(a) from tiktok_business_authorizations a limit 1')
    sql(`update tiktok_business_authorizations set token_expires_at=now()-interval '1 minute' where id=${q(a.id)}`)
    const lease = jsonSql(`select claim_tiktok_business_refresh(${q(a.id)})`)
    assert.ok(lease.fence)
    assert.equal(jsonSql(`select claim_tiktok_business_refresh(${q(a.id)})`), null)
    const state = randomUUID()
    sql(`insert into tiktok_business_oauth_states(id,state_hash,client_id,connection_id,requested_by,expected_handle,expires_at,used_at)
      values(${q(state)},repeat('c',64),${q(a.client_id)},${q(a.connection_id)},${q(actor)},'fixture',now()+interval '5 minutes',now());
      select complete_tiktok_business_oauth(${q(state)},'business-open-id','fixture','Fixture',array['video.publish'],
       'cg-tiktok-business-token:v1:new-oauth-fixture','cg-tiktok-business-token:v1:new-oauth-fixture',now()+interval '1 day',now()+interval '1 year');`)
    assert.equal(sql(`select save_tiktok_business_refresh(${q(a.id)},${q(lease.fence)},'business-open-id','cg-tiktok-business-token:v1:old-refresh-fixture','cg-tiktok-business-token:v1:old-refresh-fixture',array['video.publish'],now()+interval '1 day',now()+interval '1 year')`), 'f')
    sql(`select fail_tiktok_business_refresh(${q(a.id)},${q(lease.fence)})`)
    assert.equal(sql(`select status from tiktok_business_authorizations where id=${q(a.id)}`), 'connected')
    assert.match(sql(`select access_token from tiktok_business_authorization_tokens where authorization_id=${q(a.id)}`), /new-oauth-fixture/)
    sql(`update tiktok_business_authorizations set token_expires_at=now()-interval '1 minute' where id=${q(a.id)}`)
    assert.ok(jsonSql(`select claim_tiktok_business_refresh(${q(a.id)})`).fence)
    sql(`update tiktok_business_authorizations set refresh_started_at=now()-interval '3 minutes' where id=${q(a.id)}`)
    assert.equal(jsonSql(`select claim_tiktok_business_refresh(${q(a.id)})`), null)
    assert.equal(sql(`select status from tiktok_business_authorizations where id=${q(a.id)}`), 'needs_reauth')
  })
})
