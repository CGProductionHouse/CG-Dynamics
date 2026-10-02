import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { strategyArtifactSandbox } from './helpers/strategyArtifactSandbox.mjs'

const readArtifact = strategyArtifactSandbox(['build-client-strategy-dossiers'])
const index = JSON.parse(readArtifact('index.json'))

test('creates exactly one isolated dossier for every active client', () => {
  assert.equal(index.active_client_count, 57)
  assert.equal(index.dossier_complete_count, 57)
  assert.equal(new Set(index.clients.map(row => row.id)).size, 57)
  assert.equal(new Set(index.clients.map(row => row.file)).size, 57)
})

test('dossiers preserve exact identity, evidence provenance, and honest gaps', () => {
  for (const client of index.clients) {
    const dossier = readArtifact(client.file)
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
  const agri = readArtifact('agri-secure.md')
  assert.match(agri, /No fixed content quantity is confirmed/)
  assert.doesNotMatch(agri, /Known capacity: 0/)
  const redOak = readArtifact('red-oak.md')
  assert.match(redOak, /No fixed poster quantity/)
})

test('once-off and website-only clients stay outside recurring social strategy', () => {
  assert.match(readArtifact('kundedienste.md'), /once-off/i)
  assert.match(readArtifact('rusoord-farmstay.md'), /website-only|website service/i)
})

test('all 52 production-ready guides enrich only their exact-client dossiers', () => {
  const runtimeGuides = index.clients.filter(client => {
    try {
      readFileSync(`artifacts/client-strategy-dossiers/issue-513/runtime-guides/${client.file}`, 'utf8')
      return true
    } catch {
      return false
    }
  })
  assert.equal(runtimeGuides.length, 52)
  assert.equal(index.strategy_ready_count, 56)
  assert.equal(index.strategy_blocked_count, 1)
  assert.deepEqual(index.clients.filter(client => client.strategy_status === 'blocked').map(client => client.name), ['Kundedienste'])
})

test('Neshora is package-grounded and uses only reviewed first-party strategy evidence', () => {
  const neshora = readArtifact('neshora-oxygen.md')
  assert.match(neshora, /1 professional videos\/month; 4 photo posts\/month; 4 design posters\/month/)
  assert.match(neshora, /21 September 2026 content shoot with 79 photo\/video assets/)
  assert.match(neshora, /nasal oxygen cannula in calm everyday\/lifestyle scenes/)
  assert.match(neshora, /Do not turn visible oxygen use into a medical-benefit or therapeutic-outcome claim/)
  assert.match(neshora, /ready for gold-strategy drafting/)
  assert.doesNotMatch(neshora, /NO_EVIDENCE_BACKED_RECOMMENDATION/)
  assert.doesNotMatch(neshora, /artifact:issue-501-recovery-pass-1-snapshot\.json#3c20fae1/)
})
