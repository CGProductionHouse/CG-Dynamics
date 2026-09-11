import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

// A test that starts a vite server must close it even when loading its module
// fails. Otherwise a load error — most commonly missing VITE_SUPABASE_* values,
// which src/lib/supabase.ts rejects at import time — leaves the server (and its
// esbuild service) alive, and `npm test` hangs forever instead of failing.
//
// Two patterns are safe:
//   1. a module-level `server` assigned in before() and closed in after();
//   2. a server local to before() that is closed in a `finally`.

const testsDir = new URL('./', import.meta.url)

function beforeBlocks(source) {
  const blocks = []
  let from = 0
  for (;;) {
    const start = source.indexOf('before(async', from)
    if (start === -1) return blocks
    const end = source.indexOf('\n})', start)
    blocks.push(source.slice(start, end === -1 ? undefined : end))
    from = start + 1
  }
}

export function leaksViteServer(source) {
  const text = source.replace(/\r\n/g, '\n')
  const closesInAfter = /after\([^)]*\)\s*=>\s*\{?[\s\S]{0,120}?server\??\.close\(\)/.test(text)
  return beforeBlocks(text).some(block => {
    if (!block.includes('createServer(')) return false
    if (block.includes('finally')) return false
    const localServer = /const server = await createServer\(/.test(block)
    return localServer || !closesInAfter
  })
}

test('the hygiene check recognises both safe patterns and the leaky one', () => {
  const moduleLevel = [
    'let server',
    'before(async () => {',
    '  server = await createServer({})',
    '  m = await server.ssrLoadModule("/x.ts")',
    '})',
    'after(async () => { await server?.close() })',
  ].join('\n')
  const localWithFinally = [
    'before(async () => {',
    '  const server = await createServer({})',
    '  try {',
    '    m = await server.ssrLoadModule("/x.ts")',
    '  } finally {',
    '    await server.close()',
    '  }',
    '})',
  ].join('\n')
  const leaky = [
    'before(async () => {',
    '  const server = await createServer({})',
    '  m = await server.ssrLoadModule("/x.ts")',
    '  await server.close()',
    '})',
  ].join('\n')
  assert.equal(leaksViteServer(moduleLevel), false)
  assert.equal(leaksViteServer(localWithFinally), false)
  assert.equal(leaksViteServer(leaky), true)
})

test('no test file leaks its vite server when module loading fails', () => {
  // This file holds deliberately leaky fixtures as strings, so it is not scanned.
  const self = new URL(import.meta.url).pathname.split('/').pop()
  const offenders = readdirSync(testsDir)
    .filter(name => name.endsWith('.test.mjs') && name !== self)
    .filter(name => leaksViteServer(readFileSync(new URL(name, testsDir), 'utf8')))
  assert.deepEqual(offenders, [], `close the vite server in after() or a finally block: ${offenders.join(', ')}`)
})
