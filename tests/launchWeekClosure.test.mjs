import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const microsoftPage = readFileSync(
  new URL('../src/pages/admin/MicrosoftImportPage.tsx', import.meta.url),
  'utf8',
)

test('Microsoft launch copy reflects the active verified mirror without claiming transition retirement', () => {
  assert.match(microsoftPage, /Automatic Microsoft collection and the last verified Dynamics mirror are active\./)
  assert.match(microsoftPage, /Manual preview and[\s\S]*apply remain reviewable and auditable\./)
  assert.match(microsoftPage, /Do not retire Microsoft Planner until CA completes the separate[\s\S]*transition decision\./)
  assert.doesNotMatch(microsoftPage, /Final live package parity verification is still pending\./)
})
