import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/pages/admin/MetaIntegrationPage.tsx', import.meta.url), 'utf8')
const start = source.indexOf('  function igOptionsForPage(')
const end = source.indexOf('\n  function pageAssetForId(', start)
assert.ok(start >= 0 && end > start, 'actual page-specific picker implementation is present')
const compiled = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText
const picker = new Function('igAccounts', 'linkedAssets', `${compiled}; return igOptionsForPage`)

test('selected Facebook Page cannot offer another client’s stored Instagram account', () => {
  const options = picker(
    [{ id: 'live-a', name: 'Live A', facebookPageId: 'page-a' }, { id: 'live-b', name: 'Live B', facebookPageId: 'page-b' }],
    [
      { facebook_page_id: 'page-a', instagram_account_id: 'stored-a', instagram_username: 'Stored A' },
      { facebook_page_id: 'page-b', instagram_account_id: 'stored-b', instagram_username: 'Stored B' },
      { facebook_page_id: null, instagram_account_id: 'unassigned', instagram_username: 'Unassigned' },
      { facebook_page_id: 'page-a', instagram_account_id: 'live-a', instagram_username: 'Duplicate A' },
    ],
  )('page-a')
  assert.deepEqual(options.map(option => option.value).sort(), ['live-a', 'stored-a'])
  assert.equal(options.find(option => option.value === 'stored-a')?.label, 'Stored A (existing)')
})

test('Instagram-only linking remains available when no Facebook Page is selected', () => {
  const options = picker(
    [{ id: 'live-a', username: 'live_a', facebookPageId: 'page-a' }],
    [{ facebook_page_id: null, instagram_account_id: 'stored-only', instagram_username: null }],
  )(null)
  assert.deepEqual(options.map(option => option.value).sort(), ['live-a', 'stored-only'])
})
