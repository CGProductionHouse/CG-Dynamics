import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let server, project
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  project = (await server.ssrLoadModule('/src/features/client-onboarding/emptyState.ts')).onboardingEmptyState
})
after(async () => { await server?.close() })
const input = { activeClients: 57, sessions: 0, filteredSessions: 0, loading: false, error: null }

test('active clients without sessions do not become an empty client inventory', () => {
  assert.deepEqual(project(input), { title: 'No onboarding sessions yet', message: 'Active clients are available, but no onboarding sessions have been created.' })
})
test('a genuinely empty active client inventory stays truthful', () => {
  assert.deepEqual(project({ ...input, activeClients: 0 }), { title: 'No active clients', message: 'No active clients available.' })
})
test('filtered-out sessions remain distinct from missing sessions', () => {
  assert.deepEqual(project({ ...input, sessions: 3 }), { title: 'No sessions found', message: 'No sessions match your filters.' })
  assert.equal(project({ ...input, sessions: 3, filteredSessions: 1 }), null)
})
test('loading and failed reads never claim an empty inventory', () => {
  assert.equal(project({ ...input, loading: true, activeClients: 0 }), null)
  assert.equal(project({ ...input, error: 'Permission denied', activeClients: 0 }), null)
})
test('page reuses the separate inventory/session projection and preserves protected link gate', () => {
  const page = readFileSync('src/features/client-onboarding/InternalOnboardingPage.tsx', 'utf8')
  assert.match(page, /onboardingEmptyState\(\{ activeClients: clients.length, sessions: sessions.length, filteredSessions: filteredSessions.length, loading, error \}\)/)
  assert.match(page, /emptyState && <EmptyState/)
  assert.match(page, /disabled=\{loading \|\| working \|\| !clientId \|\| linkReadiness\?\.canGenerate !== true\}/)
})
