import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

// Offline packet guard regressions; synthetic source only. Never deploys, calls
// a provider/Management API, reads credentials or overwrites an approved packet.
const script = resolve('scripts/qa/prepare-facebook-readiness-release.mjs')
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'cg-readiness-packet-'))
  return { directory, input: join(directory,'snapshot.json'), output: join(directory,'output'), snapshot: {
    slug:'cg-dynamics-mcp',version:86,verify_jwt:false,import_map:false,
    files:Array.from({length:63},(_,i)=>({name:`supabase/functions/_shared/synthetic${i}.ts`,content:'// synthetic\n'})),
  } }
}
function run(f, mode='--upgrade-v86') {
  writeFileSync(f.input,JSON.stringify(f.snapshot))
  return spawnSync(process.execPath,[script,f.input,f.output,mode],{encoding:'utf8',timeout:10000})
}
for (const [name, edit, expected] of [
  ['version', f=>{f.snapshot.version=87},/Exact reviewed hosted v86 baseline required/],
  ['auth', f=>{f.snapshot.verify_jwt=true},/Exact reviewed hosted v86 baseline required/],
  ['file count', f=>{f.snapshot.files.pop()},/Exact reviewed hosted v86 baseline required/],
  ['duplicate paths', f=>{f.snapshot.files[1].name=f.snapshot.files[0].name.replace('synthetic0.ts','SYNTHETIC0.ts')},/Invalid\/duplicate hosted file/],
  ['path escape', f=>{f.snapshot.files[0].name='supabase/functions/../private.ts'},/Invalid\/duplicate hosted file/],
  ['unreviewed source closure', ()=>{},/Hosted v86 source drift/],
]) test(`offline upgrade rejects ${name} before any payload is written`,()=>{
  const f=fixture();edit(f);const result=run(f)
  assert.notEqual(result.status,0);assert.match(result.stderr,expected);assert.equal(existsSync(join(f.output,'payload.json')),false)
})

test('packet preparation cannot write into the checkout directly or through a junction',()=>{
  const direct=fixture();direct.output=process.cwd()
  assert.match(run(direct).stderr,/Keep hosted source\/payload outside the repository/)
  const linked=fixture(), link=join(linked.directory,'repo-link')
  symlinkSync(process.cwd(),link,process.platform==='win32'?'junction':'dir')
  linked.output=join(link,'not-created-packet')
  assert.match(run(linked).stderr,/Keep hosted source\/payload outside the repository/)
  assert.equal(existsSync(join(process.cwd(),'not-created-packet')),false)
})

test('existing packet and unknown mode are rejected without overwriting evidence',()=>{
  const f=fixture();f.output=f.directory
  const sentinel=join(f.directory,'payload.json');writeFileSync(sentinel,'reviewed sentinel')
  assert.match(run(f).stderr,/Never overwrite an existing prepared or approved packet/)
  assert.equal(readFileSync(sentinel,'utf8'),'reviewed sentinel')
  const unknown=fixture();assert.match(run(unknown,'--unreviewed').stderr,/Unknown preparation mode/)
})
