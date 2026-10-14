import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, exactClientForProfile
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ exactClientForProfile } = await server.ssrLoadModule('/src/lib/clientPortalScope.ts'))
})
after(async () => { await server?.close() })

test('a profile switch never reuses the previous client, including when access disappears', () => {
  const clientA = { id: 'client-a', name: 'A' }
  const clientB = { id: 'client-b', name: 'B' }
  assert.equal(exactClientForProfile('client-a', clientA), clientA)
  assert.equal(exactClientForProfile('client-b', clientA), null)
  assert.equal(exactClientForProfile(null, clientA), null)
  assert.equal(exactClientForProfile('client-b', clientB), clientB)
})

test('the portal shell, context and child routes are gated by the exact signed-in client', () => {
  const layout = readFileSync('src/components/client/ClientPortalLayout.tsx', 'utf8')
  assert.match(layout, /const scopedClient = exactClientForProfile\(profile\?\.client_id, client\)/)
  assert.match(layout, /<ClientPortalShell client=\{scopedClient\}>/)
  assert.match(layout, /useMemo\(\(\) => \(\{ client: scopedClient \}\)/)
  assert.match(layout, /loading \|\| scopeChanging/)
  assert.match(layout, /error \|\| !scopedClient/)
})
