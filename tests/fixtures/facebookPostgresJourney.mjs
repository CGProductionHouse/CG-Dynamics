import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

// Isolated SQL integration, not a live provider acceptance. No network escapes:
// native Graph and Storage are explicit synthetic ports; SQL is real PostgreSQL.
export async function facebookPostgresJourney({ server, sql, q, actor, rpcClient, mode = 'success', mediaType = 'image/png', admitReview, mcpBridge = false, tokenExpiry = 'fixed' }) {
  assert.ok(['image/png', 'image/jpeg'].includes(mediaType))
  assert.ok(['fixed', 'explicit_zero'].includes(tokenExpiry))
  let filename = mediaType === 'image/jpeg' ? 'approved.jpg' : 'approved.png'
  const modules = await Promise.all(['facebookPublicationRuntime', 'facebookPublicationStaff', 'socialPublicationAuthorizationStore',
    'socialPublishingQueue', 'socialPublicationManagement', 'metaTokenStorage', 'facebookPublicationInspection'].map(name => server.ssrLoadModule(`/supabase/functions/_shared/${name}.ts`)))
  const [runtimeModule, staff, store, queue, management, tokens, inspection] = modules
  const ids = Object.fromEntries(['client', 'deliverable', 'review', 'connection', 'mapping', 'sourceJob', 'source', 'run', 'plan', 'bucket', 'task'].map(k => [k, randomUUID()]))
  const due = new Date(Date.now() + (admitReview ? 60_000 : 40_000)).toISOString(), date = new Date(Date.parse(due) + 7200_000).toISOString().slice(0, 10)
  const config = { graphVersion: 'v27.0', appId: '789', appSecret: 'fixture-only', projectUrl: 'https://fixture.supabase.co',
    encryptionKey: Buffer.alloc(32, 3).toString('base64'), keyVersion: 'v1' }
  const encrypted = await tokens.encryptMetaStoredToken('fixture-user-token', ids.connection, config.encryptionKey, 'v1')
  const record = { sourceType: 'planner_task', sourcePlanId: ids.plan, sourcePlanName: 'CLIENT SOCIALS FIXTURE', sourceBucketId: ids.bucket,
    sourceTaskId: ids.task, dueDate: date, percentComplete: 0, completedDate: null }
  const coverage = [{ sourceType: 'planner_plan', sourceId: ids.plan, sourceName: record.sourcePlanName, complete: true, safeError: null, recordCount: 1 }]
  sql(`create table if not exists meta_client_assets(id uuid,client_id uuid,connection_id uuid,facebook_page_id text,is_active boolean);
    create table if not exists meta_connections(id uuid,status text);
    create table if not exists meta_connection_tokens(connection_id uuid,encrypted_access_token text);
    grant all on meta_client_assets,meta_connections,meta_connection_tokens to service_role;
    insert into clients values(${q(ids.client)},true,'{}');
    insert into monthly_deliverables(id,client_id,scheduled_date,microsoft_source_type,microsoft_plan_id,microsoft_bucket_id,microsoft_task_id)
      values(${q(ids.deliverable)},${q(ids.client)},${q(date)},'planner_task',${q(ids.plan)},${q(ids.bucket)},${q(ids.task)});
    ${admitReview ? '' : `insert into content_review_versions values(${q(ids.review)},${q(ids.deliverable)},${q(ids.client)},'approved',${q(`${ids.deliverable}/${filename}`)},${q(mediaType)},'Exact approved fixture caption',array['facebook'],${q(due)});`}
    insert into meta_client_assets values(${q(ids.mapping)},${q(ids.client)},${q(ids.connection)},'123',true);
    insert into meta_connections values(${q(ids.connection)},'connected');
    insert into meta_connection_tokens values(${q(ids.connection)},${q(encrypted)});
    insert into microsoft_sync_jobs values(${q(ids.sourceJob)},'complete',now(),now(),now());
    insert into microsoft_sync_job_sources values(${q(ids.source)},${q(ids.sourceJob)},'planner_plan',${q(ids.plan)},${q(record.sourcePlanName)},'complete',true,null,null,${q(JSON.stringify([record]))},1,now());
    insert into microsoft_sync_runs values(${q(ids.run)},${q(ids.sourceJob)},'completed',now(),(select exported_at from microsoft_sync_jobs where id=${q(ids.sourceJob)}),${q(JSON.stringify(coverage))});`)
  const json = query => JSON.parse(sql(query, 'service_role') || 'null')
  assert.equal(json("select to_jsonb(exists(select 1 from pg_proc where proname='begin_instagram_publication_publish'))"), false)
  assert.equal(json("select to_jsonb(to_regclass('public.tiktok_business_authorizations') is not null)"), false)
  let signed = 0, posts = 0
  // Only fixed table/column identifiers produced by reviewed modules are used.
  const tables = new Set(['profiles', 'clients', 'content_review_versions', 'monthly_deliverables', 'meta_client_assets', 'meta_connections', 'meta_connection_tokens', 'background_jobs'])
  const image = mediaType === 'image/jpeg' ? readFileSync('tests/fixtures/publication-baseline-320.jpg') : png()
  const sb = { from(table) {
    assert.ok(tables.has(table)); const filters = []
    const rows = () => {
      const where = filters.map(([key, value]) => {
        assert.match(key, /^[a-z_]+(?:->(?:intent|>clientId|>deliverableId|>reviewVersionId))*$/)
        const expression = key.split(/(->>?)/).map((part, i) => i === 0 ? part : part.startsWith('->') ? part : q(part)).join('')
        return `${expression}=${q(value)}`
      }).join(' and ')
      return json(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select * from ${table}${where ? ` where ${where}` : ''} order by ${table === 'meta_connection_tokens' ? 'connection_id' : 'id'}) r`)
    }
    const query = { select() { return query }, eq(k, v) { filters.push([k, v]); return query }, order() { return query },
      async maybeSingle() { const data = rows(); return { data: data.length === 1 ? data[0] : null, error: data.length > 1 ? {} : null } },
      async range(first, last) { return { data: rows().slice(first, last + 1), error: null } } }
    return query
  }, storage: { from(bucket) {
    assert.equal(bucket, 'content-review-snapshots')
    return { async download(path) { assert.equal(path, `${ids.deliverable}/${filename}`); return { data: new Blob([image], { type: mediaType }), error: null } },
      async createSignedUrl(path) { signed++; return { data: { signedUrl: `${config.projectUrl}/storage/v1/object/sign/${bucket}/${path}?token=synthetic` }, error: null } } }
  } }, async rpc(name, args) {
    if (name === 'read_social_publication_schedule_evidence') {
      try { return { data: json(`select read_social_publication_schedule_evidence(${q(args.p_actor)},${q(args.p_deliverable)},${q(args.p_review)})`), error: null } }
      catch { return { data: null, error: { message: 'Synthetic SDK database error' } } }
    }
    return rpcClient().rpc(name, args)
  } }
  if (admitReview) {
    const admitted = await admitReview({ ids, due, date, image, mediaType })
    assert.match(admitted.reviewId, /^[0-9a-f-]{36}$/)
    assert.ok(admitted.assetPath.startsWith(`${ids.deliverable}/`))
    filename = admitted.assetPath.slice(ids.deliverable.length + 1)
    assert.match(filename, /^[0-9a-f-]{36}\.jpg$/)
    ids.review = admitted.reviewId
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (raw, options = {}) => {
    const url = new URL(raw); assert.equal(url.origin, 'https://graph.facebook.com')
    const path = url.pathname.replace('/v27.0', '')
    if (path === '/debug_token') return Response.json({ data: { app_id: '789', is_valid: true, type: 'USER', expires_at: tokenExpiry === 'explicit_zero' ? 0 : Math.floor(Date.now() / 1000) + 3600,
      data_access_expires_at: Math.floor(Date.now() / 1000) + 7200, scopes: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'] } })
    if (path === '/me/permissions') return Response.json({ data: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'].map(permission => ({ permission, status: 'granted' })) })
    if (path === '/me/accounts') return Response.json({ data: [{ id: '123', access_token: 'fixture-page-token', tasks: ['CREATE_CONTENT'] }] })
    if (path === '/me') return Response.json({ id: '123' })
    if (path === '/123/photos' && options.method === 'POST') { posts++; if (mode === 'timeout') throw Error('Synthetic lost response'); return Response.json({ id: '456', post_id: '123_789' }) }
    if (path === '/123_789') return Response.json({ id: '123_789', is_published: true })
    throw Error('Unexpected synthetic network request')
  }
  try {
    const release = { approved: true, clientId: ids.client, connectionId: ids.connection, accountId: '123', route: 'facebook_page' }
    const runtime = runtimeModule.facebookPublicationRuntime(sb, { server: config, release })
    const handler = staff.facebookPublicationStaffHandler({ runtime: mode === 'inspection-only' ? null : runtime,
      inspect: inspection.facebookPublicationInspector(sb, config, null),
      authenticate: async () => ({ id: actor, role: 'manager', active: true }), persistence: store.socialPublicationAuthorizationStore(sb) })
    const mcp = mcpBridge ? await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/facebookPublicationActions.ts') : null
    const environment = { SOCIAL_FACEBOOK_PHOTO_MCP_ENABLED: 'true', SOCIAL_FACEBOOK_PHOTO_CONFIRMATION_ENABLED: 'true', SOCIAL_PUBLISHING_ENABLED: 'true',
      SOCIAL_FACEBOOK_PHOTO_ENABLED: 'true', SOCIAL_FACEBOOK_PHOTO_RELEASE: JSON.stringify({clientId:ids.client,connectionId:ids.connection,accountId:'123'}),
      META_GRAPH_VERSION:config.graphVersion,META_APP_ID:config.appId,META_APP_SECRET:config.appSecret,SUPABASE_URL:config.projectUrl,
      META_TOKEN_ENCRYPTION_KEY_B64:config.encryptionKey,META_TOKEN_ENCRYPTION_KEY_VERSION:config.keyVersion }
    const callMcp = (action, input = {}) => mcp.facebookPublicationAction(sb, actor, action, {client_id:ids.client,review_id:ids.review,...input}, name=>environment[name])
    const readStatus = async () => {
      if (!mcp) return management.readPublicationManagementStatus(sb, actor, ids.review)
      const result=await callMcp('status');assert.equal(result.data_state,'available',JSON.stringify(result));assert.equal(result.nativeSchedulesChecked,false)
      return result.status
    }
    const invoke = async body => {
      if (mcp && ['preview','confirm'].includes(body.action)) {
        const result=await callMcp(body.action,body.action==='confirm'?{expected_fingerprint:body.expectedFingerprint,confirm_scheduling:body.confirmPublication,idempotency_key:'exact-durable-mcp-fixture'}:{})
        assert.equal(result.canPublish,false)
        return {status:result.data_state==='available'?200:409,body:result}
      }
      const response = await handler(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify(body) })); return { status: response.status, body: await response.json() }
    }
    if (mcp) {
      assert.equal((await callMcp('preview',{client_id:randomUUID()})).error,'EXACT_CLIENT_REVIEW_REQUIRED')
      environment.SOCIAL_FACEBOOK_PHOTO_MCP_ENABLED='false'
      assert.equal((await callMcp('preview')).error,'PUBLICATION_MCP_DISABLED')
      environment.SOCIAL_FACEBOOK_PHOTO_MCP_ENABLED='true'
      assert.equal(json(`select count(*)::int from background_jobs where payload->'intent'->>'reviewVersionId'=${q(ids.review)}`),0)
    }
    const readiness = await invoke({ action: 'inspect', reviewId: ids.review })
    assert.equal(readiness.status, 200, JSON.stringify(readiness))
    assert.equal(readiness.body.inspection.canConfirm, false); assert.equal(readiness.body.inspection.canPublish, false)
    assert.equal(readiness.body.inspection.checks.find(c => c.key === 'account').status, 'pass')
    assert.equal(readiness.body.inspection.checks.find(c => c.key === 'image').status, 'pass')
    assert.equal(readiness.body.inspection.checks.find(c => c.key === 'release').status, 'blocked')
    assert.equal(posts, 0); assert.equal(signed, 0)
    if (mode === 'inspection-only') {
      const accountModule = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/facebookPostReadiness.ts')
      const settings = { SOCIAL_FACEBOOK_PHOTO_INSPECTION_ENABLED: 'true', META_GRAPH_VERSION: config.graphVersion, META_APP_ID: config.appId,
        META_APP_SECRET: config.appSecret, SUPABASE_URL: config.projectUrl, META_TOKEN_ENCRYPTION_KEY_B64: config.encryptionKey, META_TOKEN_ENCRYPTION_KEY_VERSION: config.keyVersion }
      const account = await accountModule.readFacebookPostReadiness(sb, actor, { client_id: ids.client, account_only: true }, name => settings[name])
      assert.equal(account.data_state, 'available'); assert.equal(account.scope, 'facebook_account_readiness')
      assert.equal(account.canConfirm, false); assert.equal(account.canPublish, false)
      assert.equal(readiness.body.inspection.checks.find(c => c.key === 'teams').status, 'unavailable')
      assert.equal((await invoke({ action: 'confirm', reviewId: ids.review, expectedFingerprint: 'a'.repeat(64), confirmPublication: true })).status, 409)
      assert.equal(json('select count(*)::int from background_jobs'), 0)
      return
    }
    const p = await invoke({ action: 'preview', reviewId: ids.review })
    assert.equal(p.status, 200, JSON.stringify(p)); assert.equal(signed, 0); assert.equal(posts, 0)
    assert.equal(p.body.preview.mediaType, mediaType)
    assert.equal(json(`select count(*)::int from background_jobs where payload->'intent'->>'reviewVersionId'=${q(ids.review)}`), 0)
    const request = { action: 'confirm', reviewId: ids.review, expectedFingerprint: p.body.preview.fingerprint, confirmPublication: true }
    const confirmation = await invoke(request), repeated = await invoke(request)
    assert.equal(confirmation.status, 200, JSON.stringify(confirmation)); assert.deepEqual(repeated, confirmation)
    const jobId = confirmation.body.publication.jobId, worker = `facebook-db-${randomUUID()}`
    let status = await readStatus()
    assert.equal(status.items.length, 1); assert.equal(status.items[0].state, 'queued'); assert.equal(posts, 0)
    assert.equal(status.items[0].confirmationFingerprint, p.body.preview.fingerprint)
    if (mode === 'success' && mediaType === 'image/png' && !admitReview) {
      const frontend = await server.ssrLoadModule('/src/lib/socialPublishing.ts')
      const { supabase: browser } = await server.ssrLoadModule('/src/lib/supabase.ts')
      const descriptor = Object.getOwnPropertyDescriptor(browser, 'functions'), calls = []
      Object.defineProperty(browser, 'functions', { configurable: true, value: { invoke: async (_name, options) => {
        calls.push(options.body.action)
        if (options.body.action === 'confirm') {
          // Same real atomic SQL confirmation; deliberately lose its response.
          const saved = await invoke(options.body)
          assert.equal(saved.status, 200); assert.equal(saved.body.publication.jobId, jobId)
          return { data: null, error: Error('Synthetic response lost AFTER confirmation committed') }
        }
        assert.equal(options.body.action, 'status')
        return { data: { ok: true, status: await management.readPublicationManagementStatus(sb, actor, ids.review) }, error: null }
      } } })
      try {
        const preview = { reviewId: ids.review, clientId: ids.client, accountId: '123', platform: 'facebook',
          caption: p.body.preview.caption, mediaType, assetSha256: p.body.preview.assetSha256,
          fingerprint: p.body.preview.fingerprint, scheduledAt: p.body.preview.scheduledAt }
        assert.equal(await frontend.confirmStaffPublication(preview), null)
        assert.deepEqual(await frontend.reconcileStaffPublicationConfirmation(preview), { jobId })
        assert.deepEqual(calls, ['confirm', 'status'])
        assert.equal(json(`select count(*)::int from background_jobs where payload->'intent'->>'reviewVersionId'=${q(ids.review)}`), 1)
        assert.equal(posts, 0)
      } finally {
        if (descriptor) Object.defineProperty(browser, 'functions', descriptor)
        else delete browser.functions
      }
    }
    assert.equal(json(`select to_jsonb(claim_next_background_job(${q(worker)}))`)?.id, null, 'future job must not be claimed')
    if (mode === 'stale') sql(`update microsoft_sync_jobs set exported_at=now()-interval '10 minutes',created_at=now()-interval '10 minutes' where id=${q(ids.sourceJob)}`)
    const remaining = Date.parse(due) - Date.now()
    assert.ok(remaining > 0, 'fixture setup must finish before due time')
    await new Promise(resolve => setTimeout(resolve, remaining + 20)) // Actual due time; source/intent never rewritten.
    const intent = json(`select payload->'intent' from background_jobs where id=${q(jobId)}`)
    const run = async () => {
      assert.equal(json(`select to_jsonb(claim_next_background_job(${q(worker)}))`).id, jobId)
      return queue.runClaimedSocialPublication({ sb, jobId, key: intent.key, worker, now: new Date().toISOString(), enabled: true, bindings: runtime.workerBindings(jobId) })
    }
    const first = await run()
    if (mode === 'success') {
      assert.equal(first.publication.state, 'processing'); assert.equal(posts, 1)
      status = await readStatus()
      assert.equal(status.items[0].state, 'processing'); assert.equal(status.items[0].postUrl, null)
      // Accelerate only the local receipt-poll delay, not the approved schedule.
      sql(`update background_jobs set run_after=now() where id=${q(jobId)}`)
      assert.equal((await run()).publication.state, 'posted'); assert.equal(posts, 1)
      status = await readStatus()
      assert.equal(status.items[0].postUrl, 'https://www.facebook.com/123_789')
      assert.equal(json(`select to_jsonb(status) from background_jobs where id=${q(jobId)}`), 'succeeded')
    } else {
      assert.equal(first.publication.state, mode === 'stale' ? 'blocked' : 'unknown_outcome')
      status = await readStatus()
      assert.equal(status.items[0].state, first.publication.state)
      assert.equal(status.items[0].errorCode, mode === 'stale' ? 'FRESH_TEAMS_EVIDENCE_REQUIRED' : 'SUBMISSION_OUTCOME_UNVERIFIED')
      assert.equal(status.items[0].providerMayHaveStarted, mode !== 'stale')
      assert.equal(posts, mode === 'stale' ? 0 : 1)
      assert.equal(json(`select to_jsonb(claim_next_background_job(${q(worker)}))`)?.id, null, 'held/unknown jobs must not auto replay')
    }
    assert.equal(json(`select to_jsonb(production_status) from monthly_deliverables where id=${q(ids.deliverable)}`), admitReview ? 'approved' : 'not_started')
    for (const role of ['staff', 'client']) {
      sql(`update profiles set role=${q(role)} where id=${q(actor)}`)
      try {
        await assert.rejects(management.readPublicationManagementStatus(sb, actor, ids.review))
        if (mcp) assert.equal((await callMcp('status')).error,'ACTIVE_MANAGER_REQUIRED')
      }
      finally { sql(`update profiles set role='manager' where id=${q(actor)}`) }
    }
    assert.equal(JSON.stringify(status).includes('fixture-user-token'), false)
    if (mcp) {
      environment.SOCIAL_FACEBOOK_PHOTO_MCP_ENABLED='false'
      const recovered=await readStatus()
      assert.equal(recovered.items[0].jobId,jobId);assert.equal(recovered.items[0].state,status.items[0].state)
      assert.equal(posts,1)
    }
  } finally {
    globalThis.fetch = originalFetch
    // Keep a failed integration case from claiming another case's jobs/actor.
    sql(`update background_jobs set status='cancelled',locked_by=null,locked_at=null where payload->'intent'->>'reviewVersionId'=${q(ids.review)} and status in ('queued','running');
      update profiles set role='manager',is_active=true where id=${q(actor)};`)
  }
}

function png() {
  const chunk = (type, data) => {
    const b = Buffer.alloc(data.length + 12); b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8)
    let crc = -1; for (const v of b.subarray(4, -4)) { crc ^= v; for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1 }
    b.writeUInt32BE((crc ^ -1) >>> 0, b.length - 4); return b
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', Buffer.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 6, 0, 0, 0])), chunk('IDAT', deflateSync(Buffer.alloc(18))), chunk('IEND', Buffer.alloc(0))])
}
