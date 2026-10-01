import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'

// Opt-in disposable LOCAL PostgreSQL only. No URLs, credentials or production DB.
const container = process.env.CG_INSTAGRAM_CALLBACK_TEST_CONTAINER
const enabled = container === 'cg-dynamics-593-test'
const database = `cg593_test_${process.pid}`
const runDocker = (args, input) => {
  const result = spawnSync('docker', ['exec', '-i', container, ...args], { input, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout.trim()
}
const sql = source => runDocker(['psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-At'], source)
const concurrentSql = source => new Promise((resolve, reject) => {
  const process = spawn('docker', ['exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At'])
  let error = ''
  process.stderr.on('data', chunk => { error += chunk })
  process.stdout.resume()
  process.on('error', reject)
  process.on('close', code => code === 0 ? resolve() : reject(new Error(error)))
  process.stdin.end(source)
})
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const clientA = '00000000-0000-4000-8000-000000000001'
const clientB = '00000000-0000-4000-8000-000000000002'
const connectionA = '00000000-0000-4000-8000-000000000011'
const connectionB = '00000000-0000-4000-8000-000000000012'
const assetA = '00000000-0000-4000-8000-000000000021'
const assetB = '00000000-0000-4000-8000-000000000022'
const actor = '00000000-0000-4000-8000-000000000031'
const app = '1383360116973315'
let created = false

before(() => {
  if (!enabled) return
  runDocker(['createdb', '-U', 'postgres', database])
  created = true
  sql(`
    do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
    end $$;
    create schema auth;
    create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role', true) $$;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key, role text, is_active boolean);
    create table public.clients(id uuid primary key, active boolean);
    create table public.meta_client_assets(id uuid primary key default gen_random_uuid(),
      client_id uuid not null references clients(id), connection_id uuid,
      facebook_page_id text, instagram_account_id text, instagram_username text,
      instagram_not_applicable boolean default false, instagram_not_applicable_reason text,
      instagram_not_applicable_updated_at timestamptz, is_active boolean default true);
    create table public.reports(id integer primary key, value text);
    create table public.posts(id integer primary key, value text);
    insert into reports values(1,'unchanged published report');
    insert into posts values(1,'unchanged historical post');
    insert into clients values('${clientA}',true),('${clientB}',true);
    insert into auth.users values('${actor}');
    insert into profiles values('${actor}','admin',true);
  `)
  for (const filename of [
    '20260922140000_instagram_login_fallback_foundation.sql',
    '20260922144059_standalone_instagram_token_encryption.sql',
    '20260923120000_instagram_connection_review_binding.sql',
    '20261001131621_instagram_provider_callbacks.sql',
  ]) sql(read(`../supabase/migrations/${filename}`))
})

after(() => { if (created) runDocker(['dropdb', '-U', 'postgres', database]) })

beforeEach(() => {
  if (!enabled) return
  sql(`
    set request.jwt.claim.role = 'service_role';
    truncate meta_instagram_callback_receipts;
    delete from meta_instagram_connection_tokens;
    update meta_client_assets set instagram_connection_id = null;
    delete from meta_instagram_connections;
    delete from meta_client_assets;
    insert into meta_client_assets(id,client_id,instagram_account_id,instagram_username)
      values('${assetA}','${clientA}','777','same_name'),('${assetB}','${clientB}','778','same_name');
    insert into meta_instagram_connections(id,client_id,connected_by,app_scoped_user_id,
      instagram_account_id,instagram_username,account_type,scopes,status,confirmed_asset_id,
      last_connected_at,instagram_app_id)
      values('${connectionA}','${clientA}','${actor}','9001','777','same_name','business',
        array['instagram_business_basic','instagram_business_manage_insights'],'connected','${assetA}','2026-01-01','${app}'),
      ('${connectionB}','${clientB}','${actor}','9002','778','same_name','creator',
        array['instagram_business_basic','instagram_business_manage_insights'],'connected','${assetB}','2026-01-01','${app}');
    update meta_client_assets set instagram_connection_id = case when id='${assetA}' then '${connectionA}'::uuid else '${connectionB}'::uuid end;
    insert into meta_instagram_connection_tokens(connection_id,ciphertext_base64,iv_base64,encryption_version,key_version)
      select id,repeat('A',24),repeat('A',16),'instagram-token-aes-256-gcm-v1','v1' from meta_instagram_connections;
  `)
})

const apply = (kind = 'deauthorize', user = '9001', key = 'a', namespace = app, issued = "floor(extract(epoch from now()))::bigint") =>
  `set request.jwt.claim.role='service_role'; select apply_instagram_provider_callback('${kind}','${namespace}','${user}',${issued},repeat('${key}',64),repeat('${key === 'a' ? 'b' : key === 'c' ? 'd' : 'f'}',64));`
const localTest = (name, fn) => test(name, { skip: !enabled && 'Set CG_INSTAGRAM_CALLBACK_TEST_CONTAINER=cg-dynamics-593-test for disposable LOCAL PostgreSQL coverage' }, fn)

localTest('SQL deauthorization removes only exact credential and revokes only same-app app-scoped connection', () => {
  sql(apply())
  assert.equal(sql(`select status from meta_instagram_connections where id='${connectionA}'`), 'revoked')
  assert.equal(sql(`select count(*) from meta_instagram_connection_tokens where connection_id='${connectionA}'`), '0')
  assert.equal(sql(`select status from meta_instagram_connections where id='${connectionB}'`), 'connected')
  assert.equal(sql(`select count(*) from meta_instagram_connection_tokens where connection_id='${connectionB}'`), '1')
  assert.equal(sql(`select instagram_connection_id from meta_client_assets where id='${assetA}'`), connectionA)
})

localTest('SQL deletion unlinks only exact standalone identity, deletes connection/token and preserves reports/posts/client state', () => {
  sql(apply('data_deletion'))
  assert.equal(sql(`select count(*) from meta_instagram_connections where client_id='${clientA}'`), '0')
  assert.equal(sql(`select count(*) from meta_client_assets where id='${assetA}' and instagram_account_id is null and instagram_connection_id is null and instagram_username is null and is_active`), '1')
  assert.equal(sql(`select instagram_account_id from meta_client_assets where id='${assetB}'`), '778')
  assert.equal(sql('select value from reports'), 'unchanged published report')
  assert.equal(sql('select value from posts'), 'unchanged historical post')
  assert.equal(sql('select count(*) from clients where active'), '2')
})

for (const kind of ['deauthorize', 'data_deletion']) localTest(`SQL ${kind} replay after reconnect does not apply again`, () => {
  sql(apply(kind))
  if (kind === 'data_deletion') {
    sql(`insert into meta_instagram_connections(id,client_id,app_scoped_user_id,instagram_account_id,instagram_username,account_type,status,instagram_app_id,last_connected_at)
      values('${connectionA}','${clientA}','9001','777','same_name','business','connected','${app}',now());`)
  } else sql(`update meta_instagram_connections set status='connected',last_connected_at=now() where id='${connectionA}'`)
  sql(`insert into meta_instagram_connection_tokens(connection_id,ciphertext_base64,iv_base64,encryption_version,key_version)
    values('${connectionA}',repeat('A',24),repeat('A',16),'instagram-token-aes-256-gcm-v1','v1')`)
  sql(apply(kind))
  assert.equal(sql(`select status from meta_instagram_connections where id='${connectionA}'`), 'connected')
  assert.equal(sql(`select count(*) from meta_instagram_connection_tokens where connection_id='${connectionA}'`), '1')
  assert.equal(sql('select count(*) from meta_instagram_callback_receipts'), '1')
})

localTest('SQL older non-receipted request cannot revoke newer consent and returns no false receipt', () => {
  sql(`update meta_instagram_connections set last_connected_at=now() where id='${connectionA}'`)
  assert.throws(() => sql(apply('data_deletion', '9001', 'a', app, '1')), /predates current connection/)
  assert.equal(sql('select count(*) from meta_instagram_callback_receipts'), '0')
  assert.equal(sql('select count(*) from meta_instagram_connection_tokens'), '2')
})

localTest('SQL exact identity absent, account-ID confusion and wrong app never select another client', () => {
  sql(apply('data_deletion', '777')) // account ID is not app-scoped ID
  sql(apply('data_deletion', '9001', 'c', 'different_numeric'.replace(/./g,'9')))
  assert.equal(sql('select count(*) from meta_instagram_connection_tokens'), '2')
  assert.equal(sql('select count(*) from meta_instagram_connections'), '2')
})

localTest('SQL historical unnamespaced identity is held, not misreported absent/deleted', () => {
  sql(`update meta_instagram_connections set instagram_app_id=null where id='${connectionA}'`)
  assert.throws(() => sql(apply('data_deletion')), /provenance requires review/)
  assert.equal(sql('select count(*) from meta_instagram_connection_tokens'), '2')
  assert.equal(sql('select count(*) from meta_instagram_callback_receipts'), '0')
})

for (const [label, change] of [
  ['cross-client binding', `update meta_client_assets set client_id='${clientB}' where id='${assetA}'`],
  ['Page-linked binding', `update meta_client_assets set facebook_page_id='fb-page' where id='${assetA}'`],
  ['changed account', `update meta_client_assets set instagram_account_id='another-account' where id='${assetA}'`],
]) localTest(`SQL ${label} rolls back all credential/connection/receipt changes`, () => {
  sql(change)
  assert.throws(() => sql(apply('data_deletion')), /Exact standalone binding/)
  assert.equal(sql('select count(*) from meta_instagram_connection_tokens'), '2')
  assert.equal(sql('select count(*) from meta_instagram_callback_receipts'), '0')
})

localTest('SQL status requires exact opaque confirmation and cannot expose deauthorization receipts', () => {
  sql(apply())
  sql(apply('data_deletion', '9002', 'c'))
  assert.equal(sql("set request.jwt.claim.role='service_role'; select instagram_data_deletion_status(repeat('b',64))"), 'SET')
  assert.equal(sql("set request.jwt.claim.role='service_role'; select instagram_data_deletion_status(repeat('d',64))"), 'SET\ncompleted')
  assert.equal(sql("set request.jwt.claim.role='service_role'; select instagram_data_deletion_status('bad')"), 'SET')
})

localTest('SQL anon/client-authenticated callers have no callback/status/unscoped persistence access or receipt table grants', () => {
  for (const role of ['anon','authenticated']) {
    assert.equal(sql(`select has_function_privilege('${role}','public.apply_instagram_provider_callback(text,text,text,bigint,text,text)','execute')`), 'f')
    assert.equal(sql(`select has_function_privilege('${role}','public.instagram_data_deletion_status(text)','execute')`), 'f')
    assert.equal(sql(`select has_table_privilege('${role}','public.meta_instagram_callback_receipts','select')`), 'f')
    assert.throws(() => sql(`set role ${role}; ${apply()}`), /permission denied/)
  }
  assert.equal(sql("select has_function_privilege('service_role','public.complete_instagram_login_connection_unscoped(uuid,uuid,text,text,text,text,text[],text,text,text,text,timestamptz)','execute')"), 'f')
  assert.throws(() => sql("set request.jwt.claim.role='authenticated'; select instagram_data_deletion_status(repeat('a',64))"), /Service role required/)
})

localTest('SQL actual canonical persistence wrapper stamps app namespace and preserves pending staff review', () => {
  sql(`update meta_client_assets set instagram_account_id=null,instagram_connection_id=null where id='${assetA}';
    delete from meta_instagram_connections where id='${connectionA}';`)
  sql(`set request.jwt.claim.role='service_role'; select complete_instagram_login_connection(
    '${clientA}','${actor}','9001','777','exact_name','business',
    array['instagram_business_basic','instagram_business_manage_insights'], repeat('A',24),repeat('A',16),
    'instagram-token-aes-256-gcm-v1','v1',now()+interval '60 days','${app}');`)
  assert.equal(sql(`select instagram_app_id || ':' || status from meta_instagram_connections where client_id='${clientA}'`), `${app}:pending_review`)
})

localTest('SQL concurrent repeated callbacks serialize and record one completed application', async () => {
  await Promise.all([concurrentSql(`begin; ${apply('data_deletion')} select pg_sleep(0.2); commit;`), concurrentSql(apply('data_deletion'))])
  assert.equal(sql('select count(*) from meta_instagram_callback_receipts'), '1')
  assert.equal(sql('select count(*) from meta_instagram_connections'), '1')
  assert.equal(sql(`select count(*) from meta_instagram_connection_tokens where connection_id='${connectionB}'`), '1')
})

localTest('SQL simultaneous deletion and deauthorization cannot resurrect access', async () => {
  await Promise.all([concurrentSql(apply('data_deletion')), concurrentSql(apply('deauthorize', '9001', 'c'))])
  assert.equal(sql('select count(*) from meta_instagram_callback_receipts'), '2')
  assert.equal(sql(`select count(*) from meta_instagram_connections where id='${connectionA}'`), '0')
  assert.equal(sql(`select count(*) from meta_instagram_connection_tokens where connection_id='${connectionA}'`), '0')
})

localTest('SQL callback racing real OAuth persistence preserves the new pending-review generation', async () => {
  sql(`update meta_client_assets set instagram_account_id=null,instagram_connection_id=null where id='${assetA}';
    update meta_instagram_connections set confirmed_asset_id=null,status='pending_review' where id='${connectionA}';`)
  const reconnect = concurrentSql(`set request.jwt.claim.role='service_role'; select complete_instagram_login_connection(
    '${clientA}','${actor}','9001','777','exact_name','business',
    array['instagram_business_basic','instagram_business_manage_insights'],repeat('A',24),repeat('A',16),
    'instagram-token-aes-256-gcm-v1','v1',now()+interval '60 days','${app}');`)
  const revoke = concurrentSql(apply()).catch(error => { assert.match(error.message, /predates current connection/) })
  await Promise.all([reconnect, revoke])
  assert.equal(sql(`select status from meta_instagram_connections where client_id='${clientA}'`), 'pending_review')
  assert.equal(sql(`select count(*) from meta_instagram_connection_tokens token join meta_instagram_connections connection on token.connection_id=connection.id where connection.client_id='${clientA}'`), '1')
})
