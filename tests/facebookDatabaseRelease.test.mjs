import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { prepareFacebookDatabaseRelease } from '../scripts/qa/prepare-facebook-database-release.mjs'

test('offline Facebook packet pins only the existing two sources and records their original versions atomically', () => {
  const packet = prepareFacebookDatabaseRelease()
  assert.equal(packet.status, 'PREPARED_NOT_AUTHORIZED_NOT_APPLIED')
  assert.equal(packet.project_id, 'ehtjfntukiwbgptqgbzy')
  assert.deepEqual(packet.migrations.map(m => m.version), ['20261115104948', '20261116085815'])
  for (const migration of packet.migrations) {
    const source = readFileSync(migration.file, 'utf8').replaceAll('\r\n', '\n')
    assert.equal(createHash('sha256').update(source).digest('hex'), migration.source_sha256)
    assert.equal(createHash('sha256').update(migration.query).digest('hex'), migration.query_sha256)
    assert.match(migration.query, /set local lock_timeout = '3s'/)
    assert.match(migration.query, /Migration already recorded/)
    assert.match(migration.query, /insert into supabase_migrations.schema_migrations/)
    assert.ok(migration.query.indexOf('insert into supabase_migrations.schema_migrations') < migration.query.lastIndexOf('commit;'))
    assert.ok(migration.query.includes(Buffer.from(source).toString('hex')))
  }
  assert.match(packet.migrations[1].query, /Exact prior Facebook migration receipt required/)
})

test('changed or substituted migration text is refused before producing a release packet', () => {
  const root = mkdtempSync(join(tmpdir(), 'cg-facebook-release-pin-'))
  mkdirSync(join(root, 'supabase/migrations'), { recursive: true })
  const packet = prepareFacebookDatabaseRelease()
  for (const migration of packet.migrations) writeFileSync(join(root, migration.file), readFileSync(migration.file))
  writeFileSync(join(root, packet.migrations[1].file), 'begin; select 1; commit;')
  assert.throws(() => prepareFacebookDatabaseRelease(root), /Reviewed migration source changed/)
})
