// Local-only codec qualification. Explicit pinned TEMP package path required.
// No install/deploy/credential access, production registration or network calls.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'

if (!process.argv[2]) throw new Error('Pass the verified task TEMP jpeg-js package directory.')
const directory = resolve(process.argv[2]), manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
assert.equal(manifest.name, 'jpeg-js'); assert.equal(manifest.version, '0.4.4')
assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0)
const archive = readFileSync(join(dirname(directory), 'jpeg-js-0.4.4.tgz'))
assert.equal(createHash('sha512').update(archive).digest('base64'), 'WZzeDOEtTOBK4Mdsar0IqEU5sMr3vSV2RqkAIzUEV2BHnUfKGyswWFPFwK5EeDo93K3FohSHbLAjj0s1Wzd+dg==')
const codec = createRequire(import.meta.url)(join(directory, 'index.js'))
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
try {
  const { verifyPublicationJpeg, PUBLICATION_JPEG_DECODE_OPTIONS } = await server.ssrLoadModule('/supabase/functions/_shared/publicationJpeg.ts')
  const runtimeModule = await server.ssrLoadModule('/supabase/functions/_shared/instagramPublicationRuntime.ts')
  const adapter = {}, imports = { 'npm:jpeg-js@0.4.4': codec, './instagramPublicationRuntime.ts': runtimeModule }
  // Execute the actual adapter against the actual qualified CommonJS package;
  // Vite's ESM runner cannot inline its `require` calls. This is Node acceptance,
  // not a claim of native Deno npm resolution or hosted Edge CPU acceptance.
  const adapterSource = ts.transpileModule(readFileSync('supabase/functions/_shared/instagramPublicationCodec.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(adapterSource, { exports: adapter, require(id) {
    if (!(id in imports)) throw new Error('Unexpected private adapter import.')
    return imports[id]
  } })
  const { decodeInstagramPublicationJpeg: decode, instagramPublicationCodecRuntime } = adapter
  const original = readFileSync('tests/fixtures/publication-baseline-320.jpg'), target = { route: 'instagram_login', accountId: '123' }
  const snapshot = b => ({ bytes: Uint8Array.from(b), byteLength: b.length, mediaType: 'image/jpeg', assetSha256: createHash('sha256').update(b).digest('hex') })
  assert.equal((await verifyPublicationJpeg(snapshot(original), target, decode)).width, 320)
  const pixels = decode(original, PUBLICATION_JPEG_DECODE_OPTIONS).data
  assert.ok(pixels[0] > 200 && pixels[1] < 120 && pixels[2] < 80 && pixels[3] === 255)
  const start = original.indexOf(Buffer.from([255, 218])); assert.ok(start > 0)
  const entropy = start + 2 + original.readUInt16BE(start + 2)
  const corrupt = Buffer.concat([original.subarray(0, entropy), Buffer.from([0, 255, 217])])
  let reachedCodec = false
  await assert.rejects(verifyPublicationJpeg(snapshot(corrupt), target, (b, options) => { reachedCodec = true; return decode(b, options) }))
  assert.equal(reachedCodec, true) // Header/signature alone would have passed.
  let databaseCalls = 0
  const sb = { from() { databaseCalls++; throw new Error('No database reads during composition.') } }
  const runtime = instagramPublicationCodecRuntime(sb, {
    server: { projectUrl: 'https://fixture.invalid' },
    release: { approved: true, route: 'instagram_login', clientId: '11111111-1111-4111-8111-111111111111',
      connectionId: '22222222-2222-4222-8222-222222222222', accountId: '123' },
  })
  assert.equal(typeof runtime.readCandidate, 'function')
  assert.equal(typeof runtime.targetForReview, 'function')
  assert.equal(typeof runtime.workerBindings('33333333-3333-4333-8333-333333333333').publishReadyContainer, 'function')
  assert.equal(databaseCalls, 0)
  assert.throws(() => instagramPublicationCodecRuntime(sb, {
    server: { projectUrl: 'https://fixture.invalid' }, release: { route: 'facebook_page' },
  }), /Exact Instagram publication release unavailable/)
  const raw = new Uint8Array(1440 * 1800 * 4)
  for (let p = 0; p < raw.length; p += 4) { raw[p] = 239; raw[p + 1] = 80; raw[p + 2] = 40; raw[p + 3] = 255 }
  const max = codec.encode({ width: 1440, height: 1800, data: raw }, 85).data
  const began = performance.now(), result = await verifyPublicationJpeg(snapshot(max), target, decode)
  assert.equal(result.height, 1800)
  const solidDecodeMs = Math.round(performance.now() - began)
  let state = 1234567
  for (let p = 0; p < raw.length; p += 4) {
    for (let c = 0; c < 3; c++) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; raw[p + c] = state & 255 }
  }
  const detail = codec.encode({ width: 1440, height: 1800, data: raw }, 75).data
  const detailBegan = performance.now()
  assert.equal((await verifyPublicationJpeg(snapshot(detail), target, decode)).height, 1800)
  console.log(JSON.stringify({ passed: true, codec: 'jpeg-js@0.4.4', realDecodeCases: 5, maximumProfile: '1440x1800',
    solidDecodeMs, detailedDecodeMs: Math.round(performance.now() - detailBegan), detailedBytes: detail.length,
    originalFixtureUnchanged: original.equals(readFileSync('tests/fixtures/publication-baseline-320.jpg')),
    approvedDependencyPin: JSON.parse(readFileSync('package.json', 'utf8')).dependencies['jpeg-js'],
    actualPrivateAdapter: true, runtimeComposition: true, databaseCalls, providerCalls: 0 }))
} finally { await server.close() }
