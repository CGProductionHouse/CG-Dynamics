import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const overlays = ['src/lib/monthlyStrategySeed.ts', 'supabase/functions/_shared/monthlyStrategyProposal.ts'].sort()
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

function indexedFiles(files, label) {
  assert(Array.isArray(files) && files.length > 0, `${label}: files missing`)
  const indexed = new Map()
  for (const file of files) {
    assert(typeof file.name === 'string' && /^(?:src|supabase)\//.test(file.name)
      && !file.name.includes('\\') && !file.name.split('/').some(part => !part || part === '.' || part === '..'), `${label}: unsafe source path`)
    assert(/^[a-f0-9]{64}$/.test(file.sha256), `${label}: invalid source hash`)
    assert(!indexed.has(file.name), `${label}: duplicate source path`)
    indexed.set(file.name, file)
  }
  return indexed
}

async function sourceFiles(root, prefix = '') {
  const files = []
  for (const item of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${item.name}` : item.name
    const stat = await lstat(path.join(root, name))
    assert(!stat.isSymbolicLink(), `Candidate source link refused: ${name}`)
    if (stat.isDirectory()) files.push(...await sourceFiles(root, name))
    else {
      assert(stat.isFile(), `Non-file source refused: ${name}`)
      files.push(name)
    }
  }
  return files
}

/** Local read-only preflight. Passing this check never grants deployment authority. */
export async function verifyStrategyBackendRelease({ manifest, observedLive, candidateRoot, now = Date.now() }) {
  assert(manifest.project_id === 'ehtjfntukiwbgptqgbzy' && observedLive.project_id === manifest.project_id, 'Wrong production project')
  assert(manifest.function_slug === 'cg-dynamics-mcp' && observedLive.slug === manifest.function_slug, 'Wrong function')
  assert(/^[a-f0-9]{40}$/.test(manifest.source_head), 'Missing reviewed source head')
  assert(Number.isInteger(manifest.expected_live_version) && observedLive.version === manifest.expected_live_version, 'Live function version drift')
  const observationAge = now - Date.parse(observedLive.observed_at)
  assert(Number.isFinite(observationAge) && observationAge >= 0 && observationAge <= 15 * 60 * 1000, 'Fresh live source readback required (maximum 15 minutes)')
  assert(observedLive.status === 'ACTIVE', 'Live function is not active')
  assert(manifest.verify_jwt === false && observedLive.verify_jwt === false, 'Existing custom OAuth gateway contract changed')
  assert(observedLive.import_map === false, 'Unexpected live import-map configuration')
  assert(manifest.entrypoint_path === 'supabase/functions/cg-dynamics-mcp/index.ts', 'Wrong entrypoint')
  assert(same(manifest.changed_files, overlays), 'Only the two reviewed strategy overlays are allowed')

  const candidate = indexedFiles(manifest.files, 'Candidate')
  const live = indexedFiles(observedLive.files, 'Live observation')
  assert(same(candidate.keys(), live.keys()), 'Live source inventory drift')
  const root = await realpath(candidateRoot)
  assert(same(await sourceFiles(root), candidate.keys()), 'Candidate has missing or unmanifested files')
  const changed = []
  for (const [name, file] of candidate) {
    assert(file.rollback_sha256 === live.get(name).sha256, `Live source content drift: ${name}`)
    const isChanged = file.sha256 !== file.rollback_sha256
    assert(file.changed === isChanged, `Incorrect change declaration: ${name}`)
    if (isChanged) changed.push(name)
    const resolved = await realpath(path.join(root, name))
    assert(path.relative(root, resolved).split(path.sep)[0] !== '..', `Escaped candidate root: ${name}`)
    assert(sha256(await readFile(resolved)) === file.sha256, `Candidate content drift: ${name}`)
  }
  assert(same(changed, overlays), 'Unreviewed runtime change or missing strategy fix')
  return {
    state: 'LOCAL_SOURCE_PREFLIGHT_PASS_NOT_DEPLOYMENT_AUTHORITY',
    project_id: manifest.project_id,
    function_slug: manifest.function_slug,
    source_head: manifest.source_head,
    expected_live_version: manifest.expected_live_version,
    source_files: candidate.size,
    changed_files: changed.sort(),
    unchanged_files: candidate.size - changed.length,
    production_writes: 0,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const names = ['--manifest', '--observed-live', '--candidate-root']
  assert(args.length === 6 && names.every(name => args.filter(value => value === name).length === 1),
    'Usage: node scripts/ops/verify-strategy-backend-release.mjs --manifest FILE --observed-live FILE --candidate-root DIRECTORY')
  const values = Object.fromEntries(names.map(name => [name, args[args.indexOf(name) + 1]]))
  assert(Object.values(values).every(value => value && !value.startsWith('--')), 'Every option needs a value')
  const result = await verifyStrategyBackendRelease({
    manifest: JSON.parse(await readFile(values['--manifest'], 'utf8')),
    observedLive: JSON.parse(await readFile(values['--observed-live'], 'utf8')),
    candidateRoot: values['--candidate-root'],
  })
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
