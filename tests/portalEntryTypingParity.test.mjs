import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const root = 'supabase/functions/client-onboarding/'
const emit = source => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true,
} }).outputText

for (const [file, restore] of [
  ['index.ts', source => source.replaceAll('category!.', 'category.').replace('session.token_expires_at as string | null', 'session.token_expires_at')],
  ['portal-library-stream.ts', source => source.replace('value: string | null | undefined', 'value: string | null')],
  ['onedrive-token-store.ts', source => source.replace('ReturnType<typeof Uint8Array.from>', 'Uint8Array')],
]) {
  test(`portal entry typing repair preserves runtime JavaScript: ${file}`, () => {
    const source = readFileSync(root + file, 'utf8')
    assert.notEqual(source, restore(source), 'fixture must exercise the actual typing change')
    assert.equal(emit(source), emit(restore(source)))
  })
}

test('actual portal short-circuit boundary denies missing/wrong-client categories before non-null field reads', () => {
  const source = readFileSync(root + 'index.ts', 'utf8')
  const expression = source.match(/const exactBoundary = ([\s\S]*?)\n  if \(!exactBoundary\)/)[1].replaceAll('category!.', 'category.')
  const check = new Function('library', 'asset', 'category', 'categoryName', 'validPeriod', 'isCanonicalPortalRoot', 'PORTAL_CATEGORY_LABELS', `return Boolean(${expression})`)
  const library = { enabled: true, last_verified_at: '2026-10-07', client_id: 'client-a', drive_id: 'drive-a', id: 'library-a', root_folder_name: 'PORTAL' }
  const asset = { client_id: 'client-a', drive_id: 'drive-a', parent_folder_item_id: 'folder-a' }
  const category = { client_id: 'client-a', library_id: 'library-a', drive_id: 'drive-a', folder_item_id: 'folder-a', last_verified_at: '2026-10-07', folder_name: 'Video' }
  const run = value => check(library, asset, value, 'video', true, name => name === 'PORTAL', { video: 'Video' })
  assert.equal(run(null), false)
  assert.equal(run(undefined), false)
  assert.equal(run({ ...category, client_id: 'client-b' }), false)
  assert.equal(run(category), true)
  assert.equal(check({ ...library, enabled: false }, asset, category, 'video', true, () => true, { video: 'Video' }), false)
})
