import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createServer } from 'vite'

// Opt-in REAL PostgreSQL. Never use a shared/project database or a network port.
const container = process.env.CG_SOCIAL_QA_CONTAINER
const enabled = container === 'cg-dynamics-social-220-qa'
const database = `qa_${randomUUID().replaceAll('-', '')}`
const actor = randomUUID()
let server, queue
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
   create table public.monthly_deliverables(id uuid primary key,client_id uuid,scheduled_date date,archived_at timestamptz,posted_at timestamptz);
   create table public.content_review_versions(id uuid primary key,deliverable_id uuid,client_id uuid,state text,asset_path text,media_type text,caption text,channels text[],scheduled_at timestamptz);
   create unique index one_current_review on public.content_review_versions(deliverable_id) where state='approved';
   create table public.tiktok_connections(id uuid primary key,client_id uuid,status text,profile_deep_link text);
   create table public.notifications(id uuid default gen_random_uuid(),user_id uuid,type text,title text,body text,entity_type text,entity_id uuid,link text);
   create function public.is_admin() returns boolean language sql as $$ select false $$;
   create function public.is_manager() returns boolean language sql as $$ select false $$;
   insert into profiles values(${q(actor)},'manager',true,'Fixture manager');
  `)
  sql(readFileSync('supabase/migrations/20260801090000_durable_background_jobs.sql', 'utf8'))
  sql("alter table background_jobs add constraint background_jobs_allowed_type check(job_type in ('meta_sync','report_prep','tiktok_analytics_refresh')); grant all on all tables in schema public to service_role;")
  const legacy = readFileSync('supabase/migrations/20260801170000_backend_acceptance_hardening.sql', 'utf8')
  sql(legacy.slice(legacy.indexOf('create or replace function public.claim_next_background_job('), legacy.indexOf('drop function if exists public.update_background_job_progress(')))
  sql(readFileSync('supabase/migrations/20261115104948_social_publishing_queue.sql', 'utf8'))
  sql(readFileSync('supabase/migrations/20261115104950_tiktok_business_oauth.sql', 'utf8'))
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  queue = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishingQueue.ts')
})
after(async () => server?.close())

function fixture() {
  const client = randomUUID(), deliverable = randomUUID(), review = randomUUID(), connection = randomUUID()
  sql(`insert into clients values(${q(client)},true,'{}'); insert into monthly_deliverables values(${q(deliverable)},${q(client)},(now() at time zone 'Africa/Johannesburg')::date,null,null);
   insert into content_review_versions values(${q(review)},${q(deliverable)},${q(client)},'approved',${q(`${deliverable}/final.jpg`)},'image/jpeg','Approved caption',array['facebook'],now()+interval '2 minutes');
   insert into tiktok_connections values(${q(connection)},${q(client)},'connected','https://www.tiktok.com/@fixture');`)
  const intent = jsonSql(`select jsonb_build_object('key',${q(`social-publish:v1:${JSON.stringify([client, deliverable, review, 'facebook', '12345'])}`)},'clientId',${q(client)},'deliverableId',${q(deliverable)},'reviewVersionId',id,
   'platform','facebook','route','facebook_page','connectionId',${q(connection)},'accountId','12345','assetPath',asset_path,'assetSha256',repeat('a',64),
   'mediaType',media_type,'caption',caption,'scheduledAt',scheduled_at,'authorizationId',${q(randomUUID())},'state','queued','attempt',0,'providerOperationId',null,'providerPostId',null)
   from content_review_versions where id=${q(review)}`)
  const enqueue = value => sql(`select enqueue_social_publication(${q(JSON.stringify(value))}::jsonb,${q(actor)})`, 'service_role')
  const job = enqueue(intent)
  // Advance synthetic source + approval consistently to due time, without waiting.
  intent.scheduledAt = sql("select to_char(now()-interval '1 minute','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')")
  sql(`update content_review_versions set scheduled_at=${q(intent.scheduledAt)} where id=${q(review)};
   update background_jobs set payload=jsonb_set(payload,'{intent}',${q(JSON.stringify(intent))}::jsonb),run_after=now() where id=${q(job)};`)
  return { client, deliverable, review, connection, intent, job, enqueue }
}
function claim(f, worker) {
  sql(`select id from claim_next_background_job(${q(worker)})`)
  return jsonSql(`select claim_social_publication(${q(f.job)},${q(worker)})`)
}
function rpcClient() {
  return { async rpc(name, a) {
    const args = name === 'claim_social_publication' ? [a.p_id, a.p_worker]
      : name === 'begin_social_publication' ? [a.p_id, a.p_worker, a.p_fence]
      : name === 'save_social_publication' ? [a.p_id, a.p_worker, a.p_fence, JSON.stringify(a.p_observation)] : null
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

test('real PostgreSQL: queue, source/role fences, crash recovery, receipts and OAuth transactions', { skip: !enabled }, async t => {
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
    sql(`update background_jobs set run_after=now() where id=${q(replacement.job)}`)
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
