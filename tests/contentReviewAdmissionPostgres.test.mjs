import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID, createHash } from 'node:crypto'
import { createServer } from 'vite'
import { facebookPostgresJourney } from './fixtures/facebookPostgresJourney.mjs'
import { publicationCodecVite } from './fixtures/publicationCodecVite.mjs'

const container = process.env.CG_SOCIAL_QA_CONTAINER
const enabled = container === 'cg-dynamics-social-220-qa'
const q = value => `'${String(value).replaceAll("'", "''")}'`

test('real PostgreSQL: actual review submission and two-party approval feed the same Facebook due queue', { skip: !enabled }, async () => {
  assert.equal(execFileSync('docker', ['inspect', '--format', '{{index .Config.Labels "cg.task"}}', container], { encoding: 'utf8' }).trim(), 'social-publishing-220')
  assert.equal(execFileSync('docker', ['inspect', '--format', '{{.HostConfig.NetworkMode}}', container], { encoding: 'utf8' }).trim(), 'none')
  const database = `qa_admit_${randomUUID().replaceAll('-', '')}`, actor = randomUUID()
  execFileSync('docker', ['exec', container, 'createdb', '-U', 'postgres', database])
  const sql = (text, role) => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq'], {
    input: (role ? `set role ${role};\n` : '') + text, encoding: 'utf8', timeout: 30000,
  }).trim()
  const authSql = (text, who = actor) => sql(`set "request.jwt.claim.sub"=${q(who)};${text}`, 'authenticated')
  const json = text => JSON.parse(sql(text) || 'null')
  sql(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
   end $$;
   create schema auth; create schema storage;
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth,storage to authenticated,service_role;
   create table profiles(id uuid primary key,role text,is_active boolean,full_name text,client_id uuid);
   create table clients(id uuid primary key,active boolean,package_settings jsonb);
   create table monthly_deliverables(id uuid primary key,client_id uuid,scheduled_date date,archived_at timestamptz,posted_at timestamptz,
    production_status text default 'not_started',microsoft_source_type text,microsoft_plan_id text,microsoft_bucket_id text,microsoft_task_id text,
    title text default 'Synthetic canonical poster',deliverable_type text default 'dp',assigned_to_user_id uuid,assigned_to_name text,
    internal_approved_at timestamptz,client_approved_at timestamptz,sent_to_client_at timestamptz);
   create table content_guide_ideas(id uuid primary key,client_id uuid,deliverable_id uuid,content_guideline_id uuid,status text,title text,script text);
   create table notifications(id uuid default gen_random_uuid(),user_id uuid,type text,title text,body text,entity_type text,entity_id uuid,link text);
   create table microsoft_sync_jobs(id uuid primary key,status text,exported_at timestamptz,created_at timestamptz,updated_at timestamptz);
   create table microsoft_sync_job_sources(id uuid primary key,job_id uuid,source_type text,source_id text,source_name text,stage text,complete boolean,
    safe_error text,pagination_cursor text,records jsonb,record_count integer,updated_at timestamptz);
   create table microsoft_sync_runs(id uuid primary key,preview_job_id uuid,status text,finished_at timestamptz,snapshot_exported_at timestamptz,source_completeness jsonb);
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
   alter table storage.objects enable row level security;
   grant insert,select on storage.objects to authenticated;
   create function is_admin() returns boolean language sql stable security definer as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) $$;
   create function is_manager() returns boolean language sql stable security definer as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','manager') and is_active) $$;
   insert into profiles(id,role,is_active,full_name) values(${q(actor)},'manager',true,'Synthetic manager');`)
  // Existing canonical admission SQL, unchanged. Never manufacture approval by UPDATE.
  sql(readFileSync('supabase/migrations/20260907150843_content_review_foundation.sql', 'utf8'))
  sql(readFileSync('supabase/migrations/20260907163000_content_review_source_guards.sql', 'utf8'))
  sql(readFileSync('supabase/migrations/20260801090000_durable_background_jobs.sql', 'utf8'))
  const legacy = readFileSync('supabase/migrations/20260801170000_backend_acceptance_hardening.sql', 'utf8')
  sql(legacy.slice(legacy.indexOf('create or replace function public.claim_next_background_job('), legacy.indexOf('drop function if exists public.update_background_job_progress(')))
  sql(readFileSync('supabase/migrations/20261115104948_social_publishing_queue.sql', 'utf8'))
  sql(readFileSync('supabase/migrations/20261116085815_social_publication_preparation_evidence.sql', 'utf8'))
  sql('grant all on all tables in schema public to service_role;')
  const server = await createServer({ configFile: false, plugins: [publicationCodecVite, { name: 'review-admission-sdk-ports', enforce: 'pre', load(id) {
    if (id.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {}'
  } }], server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  try {
    const { submitContentReview } = await server.ssrLoadModule('/src/lib/contentReviews.ts')
    const sdk = (await server.ssrLoadModule('/src/lib/supabase.ts')).supabase
    const rpcClient = () => ({ async rpc(name, args) {
      assert.ok(['authorize_social_publication', 'claim_social_publication', 'begin_social_publication', 'save_social_publication'].includes(name))
      const values = Object.values(args).map(value => q(typeof value === 'object' ? JSON.stringify(value) : value)).join(',')
      try { return { data: JSON.parse(sql(`select to_jsonb(${name}(${values}))`, 'service_role') || 'null'), error: null } }
      catch { return { data: null, error: { message: 'Synthetic SQL SDK failure' } } }
    } })
    await facebookPostgresJourney({ server, sql, q, actor, rpcClient, mediaType: 'image/jpeg', async admitReview({ ids, due, image, mediaType }) {
      const clientActor = randomUUID(), foreignActor = randomUUID(), foreignClient = randomUUID()
      sql(`insert into clients values(${q(foreignClient)},true,'{}');
        insert into profiles values(${q(clientActor)},'client',true,'Synthetic client',${q(ids.client)}),(${q(foreignActor)},'client',true,'Synthetic foreign client',${q(foreignClient)});`)
      authSql(`select save_content_creative_source(${q(ids.deliverable)},'SYNTHETIC_DESIGN','SYNTHETIC_PAGE',false);`)
      let uploads = 0, submissions = 0
      sdk.storage = { from(bucket) { assert.equal(bucket, 'content-review-snapshots'); return { async upload(path, file, options) {
        uploads++; assert.equal(options.upsert, false); assert.deepEqual(Buffer.from(await file.arrayBuffer()), image)
        authSql(`insert into storage.objects(bucket_id,name,metadata) values(${q(bucket)},${q(path)},${q(JSON.stringify({ mimetype: mediaType }))});`)
        return { data: { path }, error: null }
      } } } }
      sdk.rpc = (name, args) => ({ abortSignal() { return this }, async then(resolve, reject) { try {
        assert.equal(name, 'submit_content_review'); submissions++
        authSql(`select submit_content_review(${q(args.p_deliverable_id)},${q(args.p_asset_path)},${q(args.p_caption)},array['facebook'],${q(args.p_scheduled_at)},true);`)
        throw Error('Synthetic response lost AFTER actual transaction committed')
      } catch (error) { return reject(error) } } })
      sdk.from = table => { assert.equal(table, 'content_review_versions'); const filters = []
        const query = { select() { return query }, eq(k, v) { assert.ok(['deliverable_id','asset_path'].includes(k)); filters.push(`${k}=${q(v)}`); return query }, abortSignal() { return query },
          async maybeSingle() { return { data: JSON.parse(authSql(`select to_jsonb(r) from content_review_versions r where ${filters.join(' and ')};`) || 'null'), error: null } } }
        return query
      }
      const saved = await submitContentReview({ deliverableId: ids.deliverable, file: new File([image], 'original.jpg', { type: mediaType }),
        caption: 'Exact approved fixture caption', channels: ['facebook'], scheduledAt: due, clientRequired: true })
      assert.equal(uploads, 1); assert.equal(submissions, 1)
      const row = json(`select to_jsonb(r) from content_review_versions r where id=${q(saved)}`)
      assert.equal(row.state, 'internal_review'); assert.equal(row.client_id, ids.client)
      const intent = { key: `social-publish:v1:${JSON.stringify([ids.client, ids.deliverable, saved, 'facebook', '123'])}`, clientId: ids.client,
        deliverableId: ids.deliverable, reviewVersionId: saved, platform: 'facebook', route: 'facebook_page', connectionId: ids.connection, accountId: '123',
        assetPath: row.asset_path, assetSha256: createHash('sha256').update(image).digest('hex'), mediaType, caption: row.caption, scheduledAt: due,
        authorizationId: randomUUID(), state: 'queued', attempt: 0, providerOperationId: null, providerPostId: null }
      const refusesQueue = () => assert.throws(() => sql(`select enqueue_social_publication(${q(JSON.stringify(intent))},${q(actor)})`, 'service_role'))
      refusesQueue()
      authSql(`select decide_content_review(${q(saved)},true,null);`)
      assert.equal(json(`select to_jsonb(state) from content_review_versions where id=${q(saved)}`), 'client_review')
      refusesQueue()
      assert.throws(() => authSql(`select decide_content_review(${q(saved)},true,null);`, foreignActor))
      assert.equal(authSql('select client_content_review_queue();', foreignActor), '[]')
      authSql(`select decide_content_review(${q(saved)},true,null);`, clientActor)
      assert.equal(json(`select to_jsonb(state) from content_review_versions where id=${q(saved)}`), 'approved')
      assert.equal(json('select count(*)::int from background_jobs'), 0)
      return { reviewId: saved, assetPath: row.asset_path }
    } })
  } finally { await server.close() }
})
