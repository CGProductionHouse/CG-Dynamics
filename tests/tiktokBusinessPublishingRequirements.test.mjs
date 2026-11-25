import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'

let server, requirements, tokens
const NOW = Date.parse('2026-11-16T18:00:00Z')
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  requirements = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessPublishingRequirements.ts')
  tokens = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessTokenStorage.ts')
})
after(async () => { await server?.close() })
async function fixture() {
  const ids = { client: randomUUID(), connection: randomUUID(), authorization: randomUUID() }
  const config = { appId: '123456', appSecret: 'synthetic-app-secret', encryptionKey: Buffer.alloc(32, 7).toString('base64'), keyVersion: 'v1' }
  const target = { clientId: ids.client, connectionId: ids.connection, accountId: 'exact-business-id', route: 'tiktok_accounts', extraSecret: 'DO NOT PROJECT' }
  const grant = { id: ids.authorization, client_id: ids.client, connection_id: ids.connection, business_open_id: target.accountId,
    account_handle: 'cgproductionhouse', status: 'connected', granted_permissions: ['video.publish', 'user.info.username'], token_expires_at: new Date(NOW + 3600_000).toISOString(),
    refresh_fence: null, refresh_started_at: null, updated_at: new Date(NOW).toISOString(), publishing_eligibility: 'not_approved' }
  const tables = { clients: [{ id: ids.client, active: true }], tiktok_connections: [{ id: ids.connection, client_id: ids.client, status: 'connected', profile_deep_link: 'https://www.tiktok.com/@cgproductionhouse' }],
    tiktok_business_authorizations: [grant], tiktok_business_authorization_tokens: [{ authorization_id: ids.authorization,
      access_token: await tokens.encryptTiktokBusinessStoredToken('synthetic-access', `${ids.connection}:access`, config.encryptionKey, config.keyVersion), refresh_token: 'MUST NOT SELECT' }] }
  const f = { ids, config, target, grant, tables, db: [], http: [], clock: NOW, failures: new Set(), settings: {
    privacy_level_options: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'], comment_disabled: false, duet_disabled: true, stitch_disabled: false, max_video_post_duration_sec: 600 },
    properties: [{ property_type: 1, property_status: 1, url: 'VIDEO.EXAMPLE.COM', signature: 'PRIVATE VERIFICATION SIGNATURE', file_name: 'PRIVATE FILE' },
      { property_type: 2, property_status: 1, url: 'https://media.example.net/approved/', signature: 'PRIVATE VERIFICATION SIGNATURE' },
      { property_type: 1, property_status: 0, url: 'pending.example.com' }, { property_type: 1, property_status: 2, url: 'failed.example.com' }] }
  f.sb = { from(table) {
    let selected, signal; const filters = []
    const q = { select(columns) { selected = columns; assert.equal(columns.includes('refresh_token'), false); return q }, eq(k, v) { filters.push([k, v]); return q },
      abortSignal(s) { signal = s; return q }, async maybeSingle() {
        f.db.push({ table, selected, signal }); await f.onDb?.(table)
        const found = tables[table].filter(r => filters.every(([k, v]) => r[k] === v))
        return { error: f.failures.has(table) ? { message: 'PRIVATE synthetic-access' } : null, data: structuredClone(found.length === 1 ? found[0] : null) }
      } }
    return q
  } }
  f.options = { now: () => f.clock, async fetch(raw, init) {
    const url = new URL(raw); f.http.push({ url, init }); assert.equal(url.origin, 'https://business-api.tiktok.com'); assert.equal(init.redirect, 'error'); assert.ok(init.signal instanceof AbortSignal)
    const response = await f.onHttp?.(url.pathname); if (response) return response
    if (url.pathname.endsWith('/tt_user/token_info/get/')) return Response.json({ code: 0, data: { app_id: config.appId, creator_id: target.accountId, scope: 'video.publish,user.info.username' } })
    if (url.pathname.endsWith('/business/get/')) return Response.json({ code: 0, data: { username: 'cgproductionhouse' } })
    if (url.pathname.endsWith('/business/video/settings/')) return Response.json({ code: 0, data: f.settings })
    if (url.pathname.endsWith('/business/property/list/')) return Response.json({ code: 0, data: { url_property_info_list: f.properties } })
    throw new Error('Unexpected native path')
  } }
  return f
}
const read = f => requirements.readTikTokBusinessPublishingRequirements(f.sb, f.target, f.config, f.options)
const unavailable = p => assert.rejects(p, /^Error: TIKTOK_PUBLISHING_REQUIREMENTS_UNAVAILABLE$/)
const check = (f, r, url = 'https://video.example.com/final.mp4?private=DO_NOT_ECHO', ttl = 1800) => requirements.checkTikTokDeliveryUrlMetadata(r, f.target, url, new Date(f.clock + ttl * 1000).toISOString(), f.clock)

test('actual encrypted identity checks surround exact documented account and app property GETs', async () => {
  const f = await fixture(), r = await read(f)
  assert.equal(f.http.length, 6); assert.equal(f.db.length, 16)
  const s = f.http[2], p = f.http[3]
  assert.equal(s.url.pathname, '/open_api/v1.3/business/video/settings/'); assert.equal(s.url.searchParams.get('business_id'), f.target.accountId)
  assert.equal(s.init.headers['Access-Token'], 'synthetic-access'); assert.equal(s.init.method, 'GET'); assert.equal(s.url.searchParams.has('secret'), false)
  assert.equal(p.url.pathname, '/open_api/v1.3/business/property/list/'); assert.equal(p.init.method, 'GET')
  assert.deepEqual([...p.url.searchParams.keys()], ['app_id', 'secret']); assert.equal(p.url.searchParams.get('app_id'), f.config.appId); assert.equal(p.url.searchParams.get('secret'), f.config.appSecret)
  assert.equal(p.init.headers['Access-Token'], undefined); assert.equal(p.init.body, undefined)
  assert.deepEqual(r.settings, { privacyOptions: f.settings.privacy_level_options, commentsDisabled: false, duetsDisabled: true, stitchesDisabled: false, maxVideoDurationSeconds: 600 })
  assert.deepEqual(r.verifiedProperties, [{ type: 'domain', value: 'video.example.com' }, { type: 'prefix', value: 'https://media.example.net/approved/' }])
  assert.equal(r.canSubmit, false); assert.equal(f.grant.publishing_eligibility, 'not_approved')
  for (const value of ['synthetic-access', 'synthetic-app-secret', 'PRIVATE', 'DO NOT PROJECT', 'encryptionKey']) assert.equal(JSON.stringify(r).includes(value), false)
  assert.ok(f.http.every(r => r.init.method === 'GET' || r.url.pathname.endsWith('/tt_user/token_info/get/')))
})
test('five-minute existing media URL is rejected; exact 30-minute declaration is only metadata, never publication permission', async () => {
  const f = await fixture(), r = await read(f)
  assert.ok(check(f, r, undefined, 300).blockers.includes('TIKTOK_MEDIA_URL_LIFETIME_REQUIRED'))
  assert.ok(check(f, r, undefined, 1799).blockers.includes('TIKTOK_MEDIA_URL_LIFETIME_REQUIRED'))
  assert.deepEqual(check(f, r), { blockers: [], canSubmit: false })
  assert.equal(JSON.stringify(check(f, r)).includes('DO_NOT_ECHO'), false)
})
test('domain ownership covers subdomains but not parents, unrelated domains or a suffix trick', async () => {
  const f = await fixture(), r = await read(f)
  assert.deepEqual(check(f, r, 'https://public.video.example.com/final.mp4').blockers, [])
  for (const host of ['example.com', 'video.example.com.evil.org', 'evilvideo.example.com', 'pending.example.com', 'failed.example.com']) {
    assert.ok(check(f, r, `https://${host}/final.mp4`).blockers.includes('TIKTOK_VERIFIED_URL_PROPERTY_REQUIRED'))
  }
})
test('URL prefix requires the exact host and directory boundary, including a verified root prefix', async () => {
  const f = await fixture(); f.properties.push({ property_type: 2, property_status: 1, url: 'https://root.example.net/' }); const r = await read(f)
  for (const url of ['https://media.example.net/approved/final.mp4', 'https://media.example.net/approved/sub/final.mp4', 'https://root.example.net/final.mp4']) assert.deepEqual(check(f, r, url).blockers, [])
  for (const url of ['https://media.example.net/approved-other/final.mp4', 'https://media.example.net/other/approved/final.mp4', 'https://sub.media.example.net/approved/final.mp4']) assert.ok(check(f, r, url).blockers.includes('TIKTOK_VERIFIED_URL_PROPERTY_REQUIRED'))
})
for (const url of ['http://video.example.com/f.mp4', 'https://user:password@video.example.com/f.mp4', 'https://video.example.com:8443/f.mp4', 'https://video.example.com/f.mp4#fragment',
  'https://127.0.0.1/f.mp4', 'https://2130706433/f.mp4', 'https://[::1]/f.mp4', 'https://localhost/f.mp4', 'https://video.example.com/approved/../secret.mp4',
  'https://video.example.com/./f.mp4', 'https://video.example.com/a//f.mp4', 'https://video.example.com/a/%2e%2e/f.mp4', 'https://video.example.com/a%2ff.mp4', 'https://video.example.com/a\\f.mp4',
  'https://video.example.com/', 'https://video.example.com/line\nbreak.mp4']) test(`unsafe or unsupported delivery URL cannot pass metadata checks: ${JSON.stringify(url)}`, async () => {
    const f = await fixture(), r = await read(f); assert.ok(check(f, r, url).blockers.includes('TIKTOK_HTTPS_MEDIA_URL_REQUIRED'))
  })
test('private account is a verified setting, not an empty read or public publishing permission', async () => {
  const f = await fixture(); f.settings.privacy_level_options = ['FOLLOWER_OF_CREATOR', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY']
  const r = await read(f); assert.equal(r.settings.privacyOptions.includes('PUBLIC_TO_EVERYONE'), false)
  assert.ok(check(f, r).blockers.includes('TIKTOK_PUBLIC_VIDEO_PRIVACY_UNAVAILABLE')); assert.equal(r.canSubmit, false)
})
test('genuine empty property inventory remains empty and cannot cover any delivery URL', async () => {
  const f = await fixture(); f.properties = []; const r = await read(f)
  assert.deepEqual(r.verifiedProperties, []); assert.ok(check(f, r).blockers.includes('TIKTOK_VERIFIED_URL_PROPERTY_REQUIRED'))
})
for (const [field, value] of [['comment_disabled', null], ['duet_disabled', 'false'], ['stitch_disabled', 0], ['max_video_post_duration_sec', 0], ['max_video_post_duration_sec', 1.5],
  ['max_video_post_duration_sec', '600'], ['privacy_level_options', null], ['privacy_level_options', []], ['privacy_level_options', ['PUBLIC_TO_EVERYONE', 'PUBLIC_TO_EVERYONE']],
  ['privacy_level_options', ['UNREVIEWED']]]) test(`missing/malformed native settings fail closed: ${field}=${JSON.stringify(value)}`, async () => {
  const f = await fixture(); f.settings[field] = value; await unavailable(read(f)); assert.equal(f.http.some(r => r.url.pathname.endsWith('/property/list/')), false)
})
for (const row of [{ property_type: 1, property_status: '1', url: 'example.com' }, { property_type: 3, property_status: 1, url: 'example.com' },
  { property_type: 1, property_status: 1, url: '*.example.com' }, { property_type: 1, property_status: 1, url: '127.0.0.1' },
  { property_type: 2, property_status: 1, url: 'https://media.example.com/prefix' }, { property_type: 2, property_status: 1, url: 'https://media.example.com/prefix/?secret=value' },
  { property_type: 2, property_status: 1, url: 'https://media.example.com/prefix/%2e%2e/' }]) test(`ambiguous property data cannot become verified ownership: ${JSON.stringify(row)}`, async () => {
  const f = await fixture(); f.properties.push(row); await unavailable(read(f))
})
test('duplicate or oversized native inventories and unreviewed pagination cannot silently truncate ownership', async () => {
  for (const kind of ['duplicate', 'oversized', 'pagination', 'missing']) {
    const f = await fixture()
    if (kind === 'duplicate') f.properties.push({ ...f.properties[0], url: 'video.example.com', property_status: 0 })
    if (kind === 'oversized') f.properties = Array.from({ length: 129 }, (_, n) => ({ property_type: 1, property_status: 1, url: `host${n}.example.com` }))
    if (kind === 'pagination' || kind === 'missing') f.onHttp = p => p.endsWith('/property/list/') ? Response.json({ code: 0, data: kind === 'pagination' ? { url_property_info_list: f.properties, has_more: true } : {} }) : undefined
    await unavailable(read(f))
  }
})
test('missing app secret stops before even the canonical token store is accessed', async () => {
  const f = await fixture(); f.config.appSecret = ''; await unavailable(read(f)); assert.equal(f.db.length, 0); assert.equal(f.http.length, 0)
})
for (const mutate of [f => { f.target.clientId = randomUUID() }, f => { f.grant.status = 'disconnected' }, f => { f.grant.granted_permissions = [] }, f => { f.failures.add('tiktok_connections') }]) {
  test(`unverified exact account cannot reach the property credential: ${mutate.toString()}`, async () => {
    const f = await fixture(); mutate(f); await unavailable(read(f)); assert.equal(f.http.length, 0)
  })
}
test('revocation and rotation during native requirements reads cannot return mixed-current evidence', async () => {
  for (const kind of ['revoke', 'rotate']) {
    const f = await fixture(); f.onHttp = async path => { if (path.endsWith('/property/list/')) {
      if (kind === 'revoke') f.grant.status = 'disconnected'
      else f.tables.tiktok_business_authorization_tokens[0].access_token = await tokens.encryptTiktokBusinessStoredToken('rotated-private', `${f.ids.connection}:access`, f.config.encryptionKey, f.config.keyVersion)
    } }
    await unavailable(read(f))
  }
})
for (const response of [() => new Response('PRIVATE synthetic-app-secret', { status: 403 }), () => Response.json({ code: 40001, message: 'PRIVATE synthetic-app-secret' }),
  () => Response.json({ code: '0', data: {} }), () => new Response('broken PRIVATE synthetic-app-secret', { headers: { 'Content-Type': 'application/json' } }),
  () => new Response('x', { headers: { 'Content-Type': 'text/plain' } }), () => new Response('x', { headers: { 'Content-Type': 'application/json', 'Content-Length': '262145' } })]) {
  test(`native property HTTP/envelope/body failure is sanitized: ${response.toString().slice(0,90)}`, async () => {
    const f = await fixture(); f.onHttp = p => p.endsWith('/property/list/') ? response() : undefined; await unavailable(read(f))
  })
}
test('late settings response cannot send the app secret after the shared deadline', async () => {
  const f = await fixture(); let release
  f.options.readTimeoutMs = 500; f.onHttp = path => path.endsWith('/video/settings/') ? new Promise(resolve => { release = resolve }) : undefined
  await unavailable(read(f)); assert.ok(release); release(Response.json({ code: 0, data: f.settings })); await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(f.http.some(r => r.url.pathname.endsWith('/property/list/')), false); assert.ok(f.http.at(-1).init.signal.aborted)
})
test('abort before a read and a late SDK lookup cannot transmit any private credential', async () => {
  const f = await fixture(), c = new AbortController(); c.abort(); f.options.signal = c.signal
  await unavailable(read(f)); assert.equal(f.db.length, 0); assert.equal(f.http.length, 0)
  const late = await fixture(); let release; late.options.readTimeoutMs = 10; late.onDb = () => new Promise(resolve => { release = resolve })
  await unavailable(read(late)); release(); await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(late.http.length, 0)
})
test('facts and private configuration are pinned; target extras and all credentials stay out of output', async () => {
  const f = await fixture(); let release, ready
  const reached = new Promise(resolve => { ready = resolve }); f.onDb = () => { if (!release) { ready(); return new Promise(resolve => { release = resolve }) } }
  const pending = read(f); await reached
  f.config.appSecret = 'caller-replacement'; f.options.fetch = () => { throw new Error('caller replacement') }; release()
  const r = await pending
  assert.equal(f.http[3].url.searchParams.get('secret'), 'synthetic-app-secret'); assert.equal(Object.hasOwn(r.binding, 'extraSecret'), false)
  assert.ok(Object.isFrozen(r)); assert.ok(Object.isFrozen(r.settings)); assert.ok(Object.isFrozen(r.verifiedProperties[0]))
})
test('stale/foreign/missing requirements and timezone-less lifetime cannot pass metadata checks', async () => {
  const f = await fixture(), r = await read(f)
  for (const bad of [null, {}, { ...r, binding: {} }, { ...r, appId: '' }, { ...r, checkedAt: new Date(NOW - 60_001).toISOString() },
    { ...r, checkedAt: new Date(NOW + 1).toISOString() }, { ...r, verifiedProperties: [{ type: 'prefix', value: '' }] }]) {
    assert.ok(check(f, bad).blockers.includes('TIKTOK_FRESH_EXACT_REQUIREMENTS_REQUIRED'))
  }
  const foreign = { ...f.target, connectionId: randomUUID() }
  assert.ok(requirements.checkTikTokDeliveryUrlMetadata(r, foreign, 'https://video.example.com/f.mp4', new Date(NOW + 1800_000).toISOString(), NOW).blockers.includes('TIKTOK_FRESH_EXACT_REQUIREMENTS_REQUIRED'))
  assert.ok(requirements.checkTikTokDeliveryUrlMetadata(r, f.target, 'https://video.example.com/f.mp4', '2026-11-16T20:00:00', NOW).blockers.includes('TIKTOK_MEDIA_URL_LIFETIME_REQUIRED'))
})
