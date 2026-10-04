import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolveBoundClientRoot } from '../supabase/functions/client-onboarding/portal-client-root.ts'
import { resolvePortalMapping } from '../supabase/functions/_shared/portal-visibility.ts'

const binding = { client_id: 'daisy', drive_id: 'drive', client_folder_item_id: 'daisy-root' }
const clients = [{ id: 'daisy-root', name: 'Daizy & Co', isFolder: true }, { id: 'foreign-root', name: 'Other', isFolder: true }]
const nested = [{ id: 'portal', name: 'A_ClientPortal_Daisy_Co', isFolder: true }]
const categories = ['Brand Identity', 'Graphic Design', 'Video'].map((name, i) => ({ id: `category-${i}`, name, isFolder: true }))

test('reproduces nested Daisy portal: global Clients scan fails; exact bound parent succeeds', () => {
  assert.equal(resolvePortalMapping('Daisy & Co', clients, categories).httpStatus, 404)
  assert.deepEqual(resolveBoundClientRoot('daisy', 'drive', binding, clients), { driveId: 'drive', itemId: 'daisy-root' })
  const result = resolvePortalMapping('Daisy & Co', nested, categories)
  assert.equal(result.rootItemId, 'portal')
  assert.equal(result.categories.length, 3)
})

test('missing, foreign-client, blank and wrong-drive bindings fail closed', () => {
  for (const mapping of [null, { ...binding, client_id: 'foreign' }, { ...binding, drive_id: 'other-drive' }, { ...binding, client_folder_item_id: ' ' }]) {
    assert.equal(resolveBoundClientRoot('daisy', 'drive', mapping, clients).httpStatus, 409)
  }
  assert.equal(resolveBoundClientRoot('', 'drive', binding, clients).httpStatus, 409)
})

test('names cannot substitute for missing durable IDs; files and duplicate IDs are rejected', () => {
  assert.equal(resolveBoundClientRoot('daisy', 'drive', binding, [{ ...clients[0], id: 'different' }]).httpStatus, 404)
  assert.equal(resolveBoundClientRoot('daisy', 'drive', binding, [{ ...clients[0], isFolder: false }]).httpStatus, 404)
  assert.equal(resolveBoundClientRoot('daisy', 'drive', binding, [clients[0], clients[0]]).httpStatus, 409)
})

test('portal and category ambiguity/missing evidence cannot become a complete mapping', () => {
  assert.equal(resolvePortalMapping('Daisy & Co', [...nested, ...nested], categories).httpStatus, 409)
  for (let index = 0; index < categories.length; index++) {
    assert.equal(resolvePortalMapping('Daisy & Co', nested, categories.filter((_, i) => i !== index)).httpStatus, 404)
    assert.equal(resolvePortalMapping('Daisy & Co', nested, [...categories, categories[index]]).httpStatus, 409)
  }
})

test('handler scopes through canonical mapping before portal discovery and any write; admin-only, no creation/publication', () => {
  const edge = readFileSync('supabase/functions/client-onboarding/index.ts', 'utf8')
  const action = edge.slice(edge.indexOf("if (action === 'staff_resolve_portal_root')"), edge.indexOf('// ── Download actions'))
  assert.match(action, /authorized.profile.role !== 'admin'/)
  assert.match(action, /\.eq\('id', clientId\)[\s\S]*\.eq\('active', true\)/)
  assert.match(action, /from\('client_onedrive_mappings'\)[\s\S]*\.eq\('client_id', clientId\)/)
  assert.match(action, /listChildren\(clientRoot.driveId, clientRoot.itemId\)/)
  assert.ok(action.indexOf('resolveBoundClientRoot(') < action.indexOf('resolvePortalMapping('))
  assert.ok(action.indexOf("if ('error' in fullMapping)") < action.indexOf('.upsert('))
  assert.match(action, /enabled: false/)
  assert.doesNotMatch(action, /ensureCanonicalChildFolder|\.delete\(|monthly_deliverables|planner_tasks/)
})
