import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, existsSync, readFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const script = resolve('scripts/qa/prepare-facebook-permission-setup-release.mjs')
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'cg-permission-setup-'))
  return { dir, input: join(dir, 'snapshot.json'), output: join(dir, 'candidate'), snapshot: {
    slug: 'cg-dynamics-mcp', version: 89, verify_jwt: false, import_map: false,
    files: Array.from({ length: 68 }, (_, i) => ({ name: `supabase/functions/_shared/synthetic${i}.ts`, content: '// synthetic\n' })),
  } }
}
function run(f, extra = []) {
  writeFileSync(f.input, JSON.stringify(f.snapshot))
  return spawnSync(process.execPath, [script, f.input, f.output, ...extra], { encoding: 'utf8', timeout: 15000 })
}
for (const [name, change, error] of [
  ['version', f => { f.snapshot.version = 90 }, /Exact reviewed v89/],
  ['authentication', f => { f.snapshot.verify_jwt = true }, /Exact reviewed v89/],
  ['file count', f => { f.snapshot.files.pop() }, /Exact reviewed v89/],
  ['duplicate path', f => { f.snapshot.files[1].name = f.snapshot.files[0].name.toUpperCase() }, /Invalid or duplicate hosted path/],
  ['path traversal', f => { f.snapshot.files[0].name = 'supabase/functions/../private.ts' }, /Invalid or duplicate hosted path/],
  ['unreviewed closure', () => {}, /Hosted v89 source drift/],
]) test(`offline permission packet refuses ${name} without writing a payload`, () => {
  const f = fixture(); change(f); const result = run(f)
  assert.notEqual(result.status, 0); assert.match(result.stderr, error)
  assert.equal(existsSync(join(f.output, 'payload.json')), false)
})

test('offline permission packet preserves existing evidence and refuses extra modes', () => {
  const f = fixture(); f.output = f.dir; writeFileSync(join(f.dir, 'payload.json'), 'KEEP')
  assert.match(run(f).stderr, /Never overwrite/)
  assert.equal(readFileSync(join(f.dir, 'payload.json'), 'utf8'), 'KEEP')
  assert.match(run(fixture(), ['--deploy']).stderr, /Supply only/)
})

test('offline permission packet cannot write into the checkout through a direct path or junction', () => {
  const f = fixture(); f.output = process.cwd(); assert.match(run(f).stderr, /Keep packets outside/)
  const other = fixture(), link = join(other.dir, 'linked-checkout')
  symlinkSync(process.cwd(), link, process.platform === 'win32' ? 'junction' : 'dir')
  other.output = join(link, 'not-written-permission-packet')
  assert.match(run(other).stderr, /Keep packets outside/)
  assert.equal(existsSync(join(process.cwd(), 'not-written-permission-packet')), false)
})
