import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
let server, describeGoogleAdsStatus
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  ;({ describeGoogleAdsStatus } = await server.ssrLoadModule('/supabase/functions/cg-assistant-chat/googleAdsStatus.ts'))
})
after(async () => { await server.close() })
test('missing diagnostics does not claim disconnected', () => {
  assert.match(describeGoogleAdsStatus(null), /could not be checked/)
  assert.doesNotMatch(describeGoogleAdsStatus(null), /not connected/)
})
test('no configured account remains distinct from a provider failure', () => {
  assert.match(describeGoogleAdsStatus({ accountCount: 0, lastSyncedAt: null }), /no active accounts/)
})
test('saved account and successful sync never imply live provider health', () => {
  const result = describeGoogleAdsStatus({ accountCount: 2, lastSyncedAt: '2026-09-01T10:00:00Z' })
  assert.match(result, /2 active saved accounts/)
  assert.match(result, /2026-09-01/)
  assert.match(result, /does not verify/)
})
test('invalid or absent sync date does not invent successful sync', () => {
  assert.match(describeGoogleAdsStatus({ accountCount: 1, lastSyncedAt: 'invalid' }), /no successful sync/)
})