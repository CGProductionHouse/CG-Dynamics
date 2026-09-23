import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  INSTAGRAM_FLEET_EVIDENCE,
  exactHandleMatches,
  instagramFleetEvidenceFor,
} from '../src/lib/instagramConnectionQueue.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const page = read('../src/components/integrations/InstagramConnectionQueue.tsx')
const integration = read('../src/pages/admin/MetaIntegrationPage.tsx')
const start = read('../supabase/functions/instagram-oauth-start/index.ts')
const callback = read('../supabase/functions/instagram-oauth-callback/index.ts')
const confirm = read('../supabase/functions/instagram-connection-confirm/index.ts')
const migration = read('../supabase/migrations/20260923120000_instagram_connection_review_binding.sql')

test('fleet evidence contains the exact 25 Instagram-unmapped recurring-social clients', () => {
  const expectedClients = [
    'Bloem Action Sports',
    'Bohemia Quick Stop',
    'Bouwer & Coetzee',
    'Central Canvas',
    'Daisy & Co',
    'Ehrlich Park Butchery',
    'Emmanuel Funerals',
    'Emoya Estate Driving Range',
    'Forklift Trucks',
    'Hino Trucks',
    'HMHI',
    'Human Auto',
    'Jenkor',
    'Neshora Oxygen',
    'Novus Steel',
    'Piek Group',
    'PSG Bloemfontein',
    'Red Oak',
    'Supa Quick BFN',
    'Supa Quick Centurion',
    'The Staffordshire',
    'Tobich Optics',
    'Toyota Bloemfontein',
    'We Ar Fuels',
    'WiseRide',
  ]

  assert.deepEqual(INSTAGRAM_FLEET_EVIDENCE.map(item => item.clientName), expectedClients)
  assert.equal(INSTAGRAM_FLEET_EVIDENCE.filter(item => item.verifiedHandle).length, 8)
  assert.equal(INSTAGRAM_FLEET_EVIDENCE.filter(item => !item.verifiedHandle).length, 17)
  assert.deepEqual(instagramFleetEvidenceFor('Neshora Oxygen'), {
    clientName: 'Neshora Oxygen',
    verifiedHandle: null,
    evidence: 'no_verified_account',
    reviewNote: 'No exact owner-controlled Instagram identity has been reviewed; do not guess a handle.',
  })
  assert.equal(instagramFleetEvidenceFor('First Technology Central'), null)
  assert.equal(instagramFleetEvidenceFor('Unreviewed Client'), null)
})

test('all eight reviewed exact handles are preserved without guessing unresolved identities', () => {
  const expectedHandles = new Map([
    ['Bouwer & Coetzee Attorneys', 'bouwer_coetzee_attorneys'],
    ['Emmanuel Funerals', 'emmanuelfunerals'],
    ['Emoya Estate Driving Range', 'emoyadrivingrange'],
    ['Novus Steel', 'novus_steel'],
    ['Piek Group', 'piekgroup'],
    ['Red Oak', 'official.redoak'],
    ['Toyota Bloemfontein', 'cfaomobilitytoyotabloemfontein'],
    ['We Ar Fuels', 'we_ar_fuels'],
  ])

  for (const [clientName, handle] of expectedHandles) {
    assert.equal(instagramFleetEvidenceFor(clientName)?.verifiedHandle, handle)
  }

  for (const clientName of ['Bloem Action Sports', 'Forklift Trucks', 'Hino Trucks', 'Human Auto', 'Jenkor', 'WiseRide']) {
    const evidence = instagramFleetEvidenceFor(clientName)
    assert.equal(evidence?.evidence, 'no_verified_account')
    assert.equal(evidence?.verifiedHandle, null)
    assert.match(evidence?.reviewNote ?? '', /do not (?:infer|substitute)/i)
  }

  assert.equal(instagramFleetEvidenceFor('Bouwer & Coetzee Attorneys')?.verifiedHandle, 'bouwer_coetzee_attorneys')
  assert.equal(instagramFleetEvidenceFor('Bohemia Quick Shop')?.clientName, 'Bohemia Quick Stop')
})

test('reviewed handle comparison is exact apart from provider-safe case normalization', () => {
  assert.equal(exactHandleMatches('official.redoak', 'official.redoak'), true)
  assert.equal(exactHandleMatches('Official.RedOak', 'official.redoak'), true)
  assert.equal(exactHandleMatches('official.redoak', 'official_redoak'), false)
  assert.equal(exactHandleMatches(null, 'anything'), false)
})

test('queue is confirmed-social-scope-only, excludes canonical mappings and prefers Page-linked assets', () => {
  assert.match(page, /classifySocialProviderEligibility\(client\.package_settings\)/)
  assert.match(page, /eligibility\.state === 'eligible'/)
  assert.match(page, /explicitly excluded/)
  assert.match(page, /held for package\/service confirmation/)
  assert.match(page, /asset\.instagram_account_id \|\| asset\.instagram_not_applicable/)
  assert.match(page, /pageLinkedAccount \? 'Page-linked available'/)
  assert.match(page, /do not start standalone OAuth/)
  assert.match(page, /Passwords are entered only on Instagram's own consent screen/)
  assert.match(page, /providerAssetsLoaded && !pageLinkedAccount && !pending/)
  assert.match(integration, /<InstagramConnectionQueue/)
})

test('OAuth start, callback and confirmation remain exact-client and package-eligibility guarded server-side', () => {
  assert.match(start, /\.from\('clients'\)\.select\('id, active, package_settings'\)\.eq\('id', clientId\)\.single\(\)/)
  assert.match(start, /if \(!client\?\.active\)/)
  assert.match(start, /classifySocialProviderEligibility\(client\.package_settings\)/)
  assert.match(start, /already has a canonical Instagram mapping/)
  assert.match(callback, /\.eq\('id', oauthState\.client_id\)/)
  assert.match(callback, /classifySocialProviderEligibility\(eligibleClient\.package_settings\)/)
  assert.match(confirm, /\.eq\('id', clientId\)/)
  assert.match(confirm, /classifySocialProviderEligibility\(client\.package_settings\)/)
})

test('confirmation handler requires exact immutable identity fields and active staff', () => {
  assert.match(confirm, /select\('role, is_active'\)/)
  assert.match(confirm, /\['admin', 'manager'\]/)
  assert.match(confirm, /Exact pending Instagram identity is required/)
  assert.match(confirm, /p_connection_id: connectionId/)
  assert.match(confirm, /p_client_id: clientId/)
  assert.match(confirm, /p_instagram_account_id: instagramAccountId/)
  assert.match(confirm, /p_instagram_username: instagramUsername/)
  assert.doesNotMatch(confirm, /access_token|ciphertext_base64|iv_base64/)
})

test('atomic review RPC preserves exact-client isolation and canonical mapping authority', () => {
  assert.match(migration, /security definer\nset search_path = ''/)
  assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/)
  assert.match(migration, /profile\.is_active = true/)
  assert.match(migration, /profile\.role in \('admin', 'manager'\)/)
  assert.match(migration, /clients where id = p_client_id and active = true/)
  assert.match(migration, /status <> 'pending_review'/)
  assert.match(migration, /instagram_account_id <> p_instagram_account_id/)
  assert.match(migration, /lower\(v_connection\.instagram_username\) <> pg_catalog\.lower\(p_instagram_username\)/)
  assert.match(migration, /Encrypted Instagram credential is missing/)
  assert.match(migration, /Instagram account is already assigned to another client/)
  assert.match(migration, /Client already has a canonical Instagram mapping/)
  assert.match(migration, /insert into public\.meta_client_assets/)
  assert.match(migration, /status = 'connected'/)
  assert.match(migration, /confirmed_asset_id = v_asset_id/)
  assert.match(migration, /grant execute on function public\.confirm_instagram_login_connection[\s\S]*to service_role/)
  assert.doesNotMatch(migration, /create table[^;]+(?:reports|posts|metric_facts|sync_checkpoints)/i)
})
