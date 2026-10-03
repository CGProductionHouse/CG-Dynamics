import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { hasCompleteClientUploadMappings, onboardingLinkReadiness } from '../supabase/functions/client-onboarding/link-readiness.ts'

const ready = { role: 'admin', uploadsEnabled: true, adapterConfigured: true, hasStoredConsent: async () => true, hasClientUploadMappings: async () => true }

test('approved configured admin can explicitly generate; no permanently disabled control', async () => {
  assert.deepEqual(await onboardingLinkReadiness(ready), { canGenerate: true, state: 'ready' })
  const page = readFileSync('src/features/client-onboarding/InternalOnboardingPage.tsx', 'utf8')
  assert.match(page, /disabled=\{loading \|\| working \|\| !clientId \|\| linkReadiness\?\.canGenerate !== true\}/)
  assert.match(page, /if \(!clientId \|\| linkReadiness\?\.canGenerate !== true\) return/)
  assert.doesNotMatch(page, /disabled loading=\{working\}/)
})

test('non-admin roles never read consent or gain generate capability', async () => {
  for (const role of ['manager', 'staff', 'team', 'client', '', 'ADMIN']) {
    assert.deepEqual(await onboardingLinkReadiness({ ...ready, role, hasStoredConsent: () => { throw new Error('must not read') } }), { canGenerate: false, state: 'admin_required' })
  }
})

test('activation off and unconfigured adapter fail closed before consent read', async () => {
  const hasStoredConsent = () => { throw new Error('must not read') }
  assert.deepEqual(await onboardingLinkReadiness({ ...ready, uploadsEnabled: false, hasStoredConsent }), { canGenerate: false, state: 'activation_off' })
  assert.deepEqual(await onboardingLinkReadiness({ ...ready, adapterConfigured: false, hasStoredConsent }), { canGenerate: false, state: 'unconfigured' })
})

test('missing, unreadable or undecryptable consent stays unavailable; no fake ready', async () => {
  for (const hasStoredConsent of [async () => false, async () => { throw new Error('private provider detail') }]) {
    assert.deepEqual(await onboardingLinkReadiness({ ...ready, hasStoredConsent }), { canGenerate: false, state: 'unavailable' })
  }
})

test('identical read is deterministic and does not consume or mutate consent', async () => {
  let reads = 0
  const input = { ...ready, hasStoredConsent: async () => { reads++; return true } }
  assert.deepEqual(await onboardingLinkReadiness(input), await onboardingLinkReadiness(input))
  assert.equal(reads, 2)
})

test('absent exact-client upload destinations stay blocked even when global capability is ready', async () => {
  assert.deepEqual(await onboardingLinkReadiness({ ...ready, hasClientUploadMappings: async () => false }), { canGenerate: false, state: 'client_unavailable' })
  assert.deepEqual(await onboardingLinkReadiness({ ...ready, hasClientUploadMappings: async () => { throw new Error('schema unavailable') } }), { canGenerate: false, state: 'unavailable' })
})

test('all three exact-client upload destinations are required; foreign/missing/blank rows cannot satisfy readiness', () => {
  const rows = ['logo', 'services', 'optional'].map(upload_category => ({ client_id: 'client-a', upload_category, drive_id: 'drive', folder_item_id: upload_category }))
  assert.equal(hasCompleteClientUploadMappings('client-a', rows), true)
  assert.equal(hasCompleteClientUploadMappings('client-b', rows), false)
  assert.equal(hasCompleteClientUploadMappings('', rows), false)
  for (let index = 0; index < 3; index++) {
    assert.equal(hasCompleteClientUploadMappings('client-a', rows.filter((_, i) => i !== index)), false)
    assert.equal(hasCompleteClientUploadMappings('client-a', rows.map((row, i) => i === index ? { ...row, client_id: 'client-b' } : row)), false)
    assert.equal(hasCompleteClientUploadMappings('client-a', rows.map((row, i) => i === index ? { ...row, folder_item_id: ' ' } : row)), false)
  }
})

test('authenticated readiness and generation share the same gate before token/session creation', () => {
  const edge = readFileSync('supabase/functions/client-onboarding/index.ts', 'utf8')
  const gate = edge.slice(edge.indexOf("if (action === 'staff_link_readiness'"), edge.indexOf("if (action === 'staff_update_access'"))
  assert.ok(edge.indexOf('const authorized = await getAuthorizedUser') < edge.indexOf("if (action === 'staff_link_readiness'"))
  assert.match(gate, /\['admin', 'manager'\].includes\(authorized.profile.role\)/)
  assert.match(gate, /hasStoredConsent: async \(\) => Boolean\(\(await getStoredTokens\(\)\)\?\.refreshToken\)/)
  assert.ok(gate.indexOf("if (action === 'staff_link_readiness') return") < gate.indexOf('randomToken()'))
  assert.ok(gate.indexOf('if (!readiness.canGenerate)') < gate.indexOf('randomToken()'))
  assert.match(gate, /\.eq\('id', clientId\)\.eq\('active', true\)/)
  assert.match(gate, /\.eq\('client_id', clientId\)\.eq\('active', true\)/)
  assert.match(gate, /hasCompleteClientUploadMappings\(clientId, mappings \?\? \[\]\)/)
  assert.doesNotMatch(gate, /getValidAccessToken|saveTokens|fetch\(|console\./)
})

test('readiness returns no credentials and has no provider/DB mutation code', () => {
  const pure = readFileSync('supabase/functions/client-onboarding/link-readiness.ts', 'utf8')
  assert.doesNotMatch(pure, /fetch\(|\.from\(|\.rpc\(|console\.|refreshToken|accessToken|Deno\./)
  const page = readFileSync('src/features/client-onboarding/InternalOnboardingPage.tsx', 'utf8')
  assert.match(page, /loadOnboardingLinkReadiness\(clientId\)/)
  assert.match(page, /setLinkReadiness\(null\); setGeneratedLink\(null\); setClientId/)
  assert.match(page, /if \(active\) setLinkReadiness/)
  assert.match(page, /linkReadiness\?\.state === 'activation_off'/)
  assert.match(page, /Secure-link readiness is unavailable/)
})
