import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { verifyStrategyBackendRelease } from '../scripts/ops/verify-strategy-backend-release.mjs'

const sha256 = value => createHash('sha256').update(value).digest('hex')
const now = Date.parse('2026-11-19T19:40:00Z')
const overlays = ['src/lib/monthlyStrategySeed.ts', 'supabase/functions/_shared/monthlyStrategyProposal.ts']
const protectedNames = ['supabase/functions/cg-dynamics-mcp/index.ts', 'supabase/functions/cg-dynamics-mcp/facebookPublicationActions.ts']

test('the committed live-based packet matches the actual reviewed source and preserves every other live module', async () => {
  const manifest = JSON.parse(await readFile(new URL('../docs/ops/client-readiness/2026-11-19-strategy-backend-release-manifest.json', import.meta.url), 'utf8'))
  assert.equal(manifest.files.length, 70)
  assert.deepEqual(manifest.files.filter(file => file.changed).map(file => file.name).sort(), overlays)
  assert.ok(protectedNames.every(name => manifest.files.some(file => file.name === name && !file.changed && file.sha256 === file.rollback_sha256)))
  for (const name of overlays) {
    const body = (await readFile(new URL(`../${name}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
    assert.equal(sha256(body), manifest.files.find(file => file.name === name).sha256, `Re-review the release after changing ${name}`)
  }
})

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cg-strategy-release-'))
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()))
    assert.ok(path.basename(root).startsWith('cg-strategy-release-'))
    await rm(root, { recursive: true, force: true })
  })
  const files = []
  for (const name of [...overlays, ...protectedNames]) {
    const changed = overlays.includes(name)
    const before = `Live source for ${name}\n`
    const after = changed ? `Reviewed strategy source for ${name}\n` : before
    await mkdir(path.dirname(path.join(root, name)), { recursive: true })
    await writeFile(path.join(root, name), after)
    files.push({ name, sha256: sha256(after), rollback_sha256: sha256(before), changed })
  }
  const manifest = { project_id: 'ehtjfntukiwbgptqgbzy', function_slug: 'cg-dynamics-mcp',
    source_head: '98fded5a634341b112f48af2b064c486f4d912fd', expected_live_version: 90,
    verify_jwt: false, entrypoint_path: protectedNames[0], changed_files: overlays, files }
  const observedLive = { project_id: manifest.project_id, slug: manifest.function_slug,
    status: 'ACTIVE', version: 90, verify_jwt: false, import_map: false,
    observed_at: '2026-11-19T19:39:00Z', files: files.map(file => ({ name: file.name, sha256: file.rollback_sha256 })) }
  return { manifest, observedLive, candidateRoot: root, now }
}

test('accepts only exact live source with the two reviewed overlays and grants no deployment authority', async t => {
  const input = await fixture(t)
  const before = await Promise.all(input.manifest.files.map(file => readFile(path.join(input.candidateRoot, file.name), 'utf8')))
  const result = await verifyStrategyBackendRelease(input)
  assert.equal(result.state, 'LOCAL_SOURCE_PREFLIGHT_PASS_NOT_DEPLOYMENT_AUTHORITY')
  assert.equal(result.production_writes, 0)
  assert.equal(result.unchanged_files, protectedNames.length)
  assert.deepEqual(result.changed_files, overlays)
  assert.deepEqual(await Promise.all(input.manifest.files.map(file => readFile(path.join(input.candidateRoot, file.name), 'utf8'))), before)
})

test('refuses a newer live deployment or stale readback', async t => {
  const input = await fixture(t)
  await assert.rejects(verifyStrategyBackendRelease({ ...input, observedLive: { ...input.observedLive, version: 91 } }), /version drift/)
  await assert.rejects(verifyStrategyBackendRelease({ ...input, now: now + 16 * 60 * 1000 }), /Fresh live source/)
  await assert.rejects(verifyStrategyBackendRelease({ ...input, observedLive: { ...input.observedLive, observed_at: null } }), /Fresh live source/)
})

test('refuses the wrong project, worker, JWT or import-map contract', async t => {
  const input = await fixture(t)
  for (const [field, value] of [['project_id', 'another-project'], ['slug', 'monthly-strategy-autopilot'], ['verify_jwt', true], ['import_map', true]]) {
    await assert.rejects(verifyStrategyBackendRelease({ ...input, observedLive: { ...input.observedLive, [field]: value } }))
  }
})

test('refuses live publication source drift even when metadata version is unchanged', async t => {
  const input = await fixture(t)
  input.observedLive.files.at(-1).sha256 = sha256('Other agent changed publishing source')
  await assert.rejects(verifyStrategyBackendRelease(input), /Live source content drift/)
})

test('refuses a changed auth/catalogue/publication module even with a matching candidate hash', async t => {
  const input = await fixture(t)
  const module = input.manifest.files.at(-1)
  await writeFile(path.join(input.candidateRoot, module.name), 'Unreviewed publication change')
  module.sha256 = sha256('Unreviewed publication change')
  module.changed = true
  await assert.rejects(verifyStrategyBackendRelease(input), /Unreviewed runtime change/)
})

test('refuses missing, extra and tampered candidate files', async t => {
  const input = await fixture(t)
  const exactFile = path.join(input.candidateRoot, overlays[0])
  const original = await readFile(exactFile)
  await writeFile(exactFile, 'Different strategy fix')
  await assert.rejects(verifyStrategyBackendRelease(input), /Candidate content drift/)
  await writeFile(exactFile, original)
  await writeFile(path.join(input.candidateRoot, 'package.json'), '{"type":"module"}')
  await assert.rejects(verifyStrategyBackendRelease(input), /unmanifested files/)
  await rm(path.join(input.candidateRoot, 'package.json'))
  await rm(exactFile)
  await assert.rejects(verifyStrategyBackendRelease(input), /missing or unmanifested/)
})

test('refuses missing or duplicate live identities and unsafe file paths', async t => {
  const input = await fixture(t)
  await assert.rejects(verifyStrategyBackendRelease({ ...input, observedLive: { ...input.observedLive, files: input.observedLive.files.slice(1) } }), /inventory drift/)
  await assert.rejects(verifyStrategyBackendRelease({ ...input, manifest: { ...input.manifest, files: [...input.manifest.files, input.manifest.files[0]] } }), /duplicate/)
  await assert.rejects(verifyStrategyBackendRelease({ ...input, manifest: { ...input.manifest, files: [{ ...input.manifest.files[0], name: 'src/../../outside.ts' }] } }), /unsafe source path/)
})
