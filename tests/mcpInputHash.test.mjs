import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { strategyMcpInputHash } from '../supabase/functions/cg-dynamics-mcp/monthlyStrategyWorkspace.ts'

const source = readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8')
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true)
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'computeInputHash')
const js = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText
const computeInputHash = new Function('strategyMcpInputHash', `${js}; return computeInputHash`)(strategyMcpInputHash)

function legacy(input) {
  const sorted = Object.fromEntries(Object.keys(input).filter(key => key !== 'idempotency_key').sort().map(key => [key, input[key]]))
  return btoa(JSON.stringify(sorted))
}

test('ordinary and Latin-1 inputs retain their exact existing replay fingerprints', async () => {
  for (const input of [{ title: 'Saved draft', idempotency_key: 'old', month: '2026-10' }, { script: 'Café déjà vu —'.replace('—', '-'), notes: null }, { z: { b: 2, a: 1 }, a: [] }]) {
    assert.equal(await computeInputHash(input), legacy(input))
  }
})

test('real script punctuation and non-Latin text no longer throw before the write', async () => {
  for (const script of ['“The job” — first, ask → then listen.', '日本語', 'Welkom 👋']) {
    const input = { content_guide_idea_id: 'exact-video', script, idempotency_key: 'human-key' }
    assert.throws(() => legacy(input), /Latin1|Invalid character/i)
    assert.equal(await computeInputHash(input), `utf8-sha256:${await strategyMcpInputHash(input)}`)
  }
})

test('Unicode replay ignores key/order but detects a changed script without mutating text', async () => {
  const input = { script: 'Ask — listen 👋', hook: 'Real opening', idempotency_key: 'first' }
  const before = JSON.stringify(input)
  const hash = await computeInputHash(input)
  assert.equal(hash, await computeInputHash({ idempotency_key: 'second', hook: input.hook, script: input.script }))
  assert.notEqual(hash, await computeInputHash({ ...input, script: 'A different — script' }))
  assert.equal(JSON.stringify(input), before)
  assert.match(hash, /^utf8-sha256:[a-f0-9]{64}$/)
})

test('a long Unicode script hashes fully without argument-stack limits or truncation', async () => {
  const script = '🎥'.repeat(9000)
  const a = await computeInputHash({ script })
  const b = await computeInputHash({ script: script.slice(0, -2) + '📷' })
  assert.notEqual(a, b)
  assert.match(a, /^utf8-sha256:[a-f0-9]{64}$/)
})
