import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

let server, findClientNameConflict, clientSaveFailureMessage, parseBulkClientNames
before(async () => {
  server = await createServer({ logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  ;({ findClientNameConflict, clientSaveFailureMessage, parseBulkClientNames } = await server.ssrLoadModule('/src/lib/clientRegistrySafety.ts'))
})
after(async () => { await server?.close() })

test('exact name collisions block re-creation including archived clients', () => {
  const existing = { id: 'retained-id', name: ' Red Oak ', active: false }
  assert.equal(findClientNameConflict([existing], 'red oak'), existing)
  assert.equal(findClientNameConflict([existing], 'Red Oak', existing.id), undefined)
  assert.deepEqual(existing, { id: 'retained-id', name: ' Red Oak ', active: false })
})

test('similar historical names are not auto-merged or treated as exact identity', () => {
  const clients = [{ id: 'a', name: 'Madisons' }, { id: 'b', name: 'Local Meat Deli' }]
  assert.equal(findClientNameConflict(clients, 'Madison Wear'), undefined)
  assert.equal(findClientNameConflict(clients, 'Local Deli'), undefined)
  assert.equal(findClientNameConflict(clients, 'Red Oak Rugby Club'), undefined)
})

test('bulk add uses the same normalized-name reservation for active and archived rows', () => {
  assert.deepEqual(parseBulkClientNames('red oak\n MADISONS \nMadison Wear\nmadison wear', [
    { name: ' Red Oak ', active: true }, { name: ' Madisons ', active: false },
  ]), { toAdd: ['Madison Wear'], toSkip: ['red oak'], toRestoreInstead: ['MADISONS'], inListDupes: ['madison wear'] })
})

test('concurrent database collision gets actionable truthful feedback; other errors stay errors', () => {
  assert.match(clientSaveFailureMessage({ code: '23505' }, 'Failed'), /Edit or restore/)
  assert.equal(clientSaveFailureMessage({ code: '42501' }, 'Failed'), 'Failed')
  assert.equal(clientSaveFailureMessage(null, 'Failed'), 'Failed')
})

test('client management has archive/restore only, no incomplete delete safety check', async () => {
  const page = await readFile('src/pages/admin/ClientsList.tsx', 'utf8')
  const db = await readFile('src/lib/db/clients.ts', 'utf8')
  assert.doesNotMatch(page, /deleteClient|clientHasData|openDeleteConfirm|onDelete|Delete permanently/)
  assert.doesNotMatch(db, /\.delete\(|clientHasData/)
  assert.match(db, /updateClient\(id, \{ active: false \}\)/)
  assert.match(db, /updateClient\(id, \{ active: true \}\)/)
  assert.match(page, /CG Hours status is unchanged/)
})

test('additive database guard covers races and archived names without touching history or role reads', async () => {
  const sql = await readFile('supabase/migrations/20261003085222_client_registry_identity_history_guard.sql', 'utf8')
  assert.match(sql, /create unique index clients_exact_name_unique\s+on public\.clients \(lower\(btrim\(name\)\)\)/)
  assert.match(sql, /revoke delete on public\.clients from public, anon, authenticated/)
  assert.doesNotMatch(sql, /where active|delete from|update public|insert into|drop |grant |time_entries|timesheet_rows/i)
})
