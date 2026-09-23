import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

execFileSync(process.execPath, ['scripts/build-client-strategy-dossiers.mjs'], { stdio: 'pipe' })
const index = JSON.parse(readFileSync('artifacts/client-strategy-dossiers/issue-513/index.json', 'utf8'))

test('creates exactly one isolated dossier for every active client', () => {
  assert.equal(index.active_client_count, 56)
  assert.equal(index.dossier_complete_count, 56)
  assert.equal(new Set(index.clients.map(row => row.id)).size, 56)
  assert.equal(new Set(index.clients.map(row => row.file)).size, 56)
})

test('dossiers preserve exact identity, evidence provenance, and honest gaps', () => {
  for (const client of index.clients) {
    const dossier = readFileSync(`artifacts/client-strategy-dossiers/issue-513/${client.file}`, 'utf8')
    assert.match(dossier, new RegExp(client.id))
    assert.match(dossier, /## Verified facts/)
    assert.match(dossier, /## Confirmed package/)
    assert.match(dossier, /## Actual CG history/)
    assert.match(dossier, /## Client and CG constraints/)
    assert.match(dossier, /## Research observations/)
    assert.match(dossier, /## Evidence-backed recommendations/)
    assert.match(dossier, /## Sources/)
    assert.doesNotMatch(dossier, /increase engagement|build awareness|post consistently|connect with the audience/i)
  }
})

test('unknown package capacity is never converted to zero', () => {
  const agri = readFileSync('artifacts/client-strategy-dossiers/issue-513/agri-secure.md', 'utf8')
  assert.match(agri, /No fixed content quantity is confirmed/)
  assert.doesNotMatch(agri, /Known capacity: 0/)
  const redOak = readFileSync('artifacts/client-strategy-dossiers/issue-513/red-oak.md', 'utf8')
  assert.match(redOak, /No fixed poster quantity/)
})

test('once-off and website-only clients stay outside recurring social strategy', () => {
  assert.match(readFileSync('artifacts/client-strategy-dossiers/issue-513/kundedienste.md', 'utf8'), /once-off/i)
  assert.match(readFileSync('artifacts/client-strategy-dossiers/issue-513/rusoord-farmstay.md', 'utf8'), /website-only|website service/i)
})
