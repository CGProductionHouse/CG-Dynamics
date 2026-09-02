import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const migration = read('../supabase/migrations/20260902100000_client_onboarding_foundation.sql')
const edge = read('../supabase/functions/client-onboarding/index.ts')
const page = read('../src/features/client-onboarding/WelcomeToCgPage.tsx')
const api = read('../src/features/client-onboarding/api.ts')
const app = read('../src/App.tsx')

let server
let validation

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  validation = await server.ssrLoadModule('/src/features/client-onboarding/validation.ts')
})

after(async () => { await server?.close() })

function state(overrides = {}) {
  return {
    clientName: 'Example Client',
    clientLogoUrl: null,
    status: 'in_progress',
    currentStep: 1,
    startedAt: null,
    completedAt: null,
    lastActivityAt: new Date().toISOString(),
    expiresAt: null,
    vectorUnavailable: false,
    uploads: [],
    typedDescription: '',
    serviceItems: [],
    platformAccess: [],
    additionalNotes: '',
    ...overrides,
  }
}

const receivedUpload = category => ({
  id: `${category}-1`,
  category,
  originalFilename: `${category}.pdf`,
  mimeType: 'application/pdf',
  sizeBytes: 100,
  uploadStatus: 'received',
  uploadedAt: new Date().toISOString(),
})

test('magic links store only a SHA-256 token hash and support expiry and revocation', () => {
  assert.match(migration, /token_hash text not null unique check \(length\(token_hash\) = 64\)/)
  assert.match(migration, /token_expires_at timestamptz not null/)
  assert.match(migration, /revoked_at timestamptz/)
  assert.match(edge, /\.eq\('token_hash', tokenHash\)[\s\S]*?\.is\('revoked_at', null\)[\s\S]*?\.gt\('token_expires_at'/)
  assert.doesNotMatch(migration, /\btoken\s+text/)
})

test('token writes derive exact client isolation from the validated session', () => {
  const publicActions = edge.slice(edge.indexOf("if (action === 'load'"), edge.indexOf('const authorized ='))
  assert.match(publicActions, /getTokenSession\(service, request\)/)
  assert.match(edge, /client_id: session\.client_id/)
  assert.doesNotMatch(publicActions, /body\.clientId/)
})

test('onboarding tables have no anonymous or authenticated direct access', () => {
  assert.match(migration, /alter table public\.client_onboarding_sessions enable row level security/)
  assert.match(migration, /revoke all on public\.client_onboarding_sessions from anon, authenticated/)
  assert.doesNotMatch(migration, /create policy/)
})

test('autosave persists services and optional notes while the token stays out of ordinary payloads', () => {
  assert.match(page, /window\.setTimeout\(async \(\) =>/)
  assert.match(page, /const typedDescription = state\?\.typedDescription/)
  assert.match(page, /const additionalNotes = state\?\.additionalNotes/)
  assert.match(api, /'x-onboarding-token': token/)
  assert.match(api, /invoke<ClientOnboardingState>\(\{ action: 'save', patch \}, token\)/)
  assert.doesNotMatch(api, /\{ action: 'save', patch, token \}/)
  assert.doesNotMatch(api, /localStorage|sessionStorage/)
  assert.match(page, /goToStep\(currentStep: number\)[\s\S]*?typedDescription, serviceItems, additionalNotes/)
  assert.match(page, /saveRequestRef/)
})

test('refresh resume keeps the token out of the request path and browser storage', () => {
  assert.match(page, /window\.location\.hash/)
  assert.match(page, /window\.history\.state\?\.onboardingToken/)
  assert.match(page, /replaceState\(\{ \.\.\.window\.history\.state, onboardingToken: token \}, '', '\/welcome'\)/)
  const internalPage = read('../src/features/client-onboarding/InternalOnboardingPage.tsx')
  assert.match(internalPage, /\/welcome#\$\{result\.data\.token\}/)
  assert.doesNotMatch(internalPage, /\/welcome\/\$\{result\.data\.token\}/)
  assert.doesNotMatch(app, /\/welcome\/:token/)
})

test('logo remains required and vector availability does not satisfy it', () => {
  assert.equal(validation.logoRequirementSatisfied(state({ vectorUnavailable: true })), false)
  assert.equal(validation.logoRequirementSatisfied(state({ uploads: [receivedUpload('logo')] })), true)
})

test('broad safe logo formats are accepted and executable formats are rejected', () => {
  for (const extension of ['pdf', 'png', 'jpg', 'jpeg', 'svg', 'ai', 'eps', 'webp', 'tiff', 'psd', 'zip']) {
    assert.equal(validation.validateLogoCandidate({ name: `logo.${extension}`, type: '', size: 100 }), null)
  }
  for (const extension of ['exe', 'js', 'ps1', 'vbs']) {
    assert.match(validation.validateLogoCandidate({ name: `logo.${extension}`, type: '', size: 100 }), /not safe/)
  }
})

test('services can be satisfied by text, list, or an uploaded profile without duplicate entry', () => {
  assert.equal(validation.servicesRequirementSatisfied(state({ typedDescription: 'Repairs and servicing' })), true)
  assert.equal(validation.servicesRequirementSatisfied(state({ serviceItems: ['Repairs'] })), true)
  assert.equal(validation.servicesRequirementSatisfied(state({ uploads: [receivedUpload('services')] })), true)
})

test('core completion requires logo and services only', () => {
  const complete = state({ uploads: [receivedUpload('logo'), receivedUpload('services')], platformAccess: [] })
  assert.equal(validation.coreOnboardingComplete(complete), true)
  assert.equal(validation.coreOnboardingComplete(state({ uploads: [receivedUpload('logo')] })), false)
})

test('all three access choices are accepted and deferred access cannot block completion', () => {
  for (const choice of ['connect_now', 'do_later', 'not_needed']) assert.match(edge, new RegExp(choice))
  const complete = state({
    uploads: [receivedUpload('logo')],
    typedDescription: 'Consulting',
    platformAccess: [{ platform: 'facebook', clientChoice: 'do_later', connectionState: 'submitted', submittedAt: null, verifiedAt: null }],
  })
  assert.equal(validation.coreOnboardingComplete(complete), true)
  assert.doesNotMatch(edge.slice(edge.indexOf("if (action === 'complete')"), edge.indexOf("const now = new Date", edge.indexOf("if (action === 'complete')"))), /client_platform_access/)
})

test('Connect now opens instructions and only an explicit final action awaits verification', () => {
  assert.match(edge, /clientConfirmed = item\.clientConfirmed === true/)
  assert.match(edge, /clientConfirmed \? 'awaiting_verification' : 'instructions_opened'/)
  assert.doesNotMatch(edge, /item\.connectionState/)
  assert.match(page, /onChoose=\{\(platform, choice, clientConfirmed\) => void chooseAccess\(platform, choice, clientConfirmed\)\}/)
  assert.match(edge, /platform !== 'instagram'/)
  assert.match(edge, /verified_at: null,[\s\S]*?verified_by: null/)
  assert.match(migration, /\(connection_state = 'verified'\) = \(verified_at is not null and verified_by is not null\)/)
})

test('optional Tell us more never affects completion', () => {
  const complete = state({ uploads: [receivedUpload('logo')], serviceItems: ['Installation'], additionalNotes: '' })
  assert.equal(validation.coreOnboardingComplete(complete), true)
  assert.equal(validation.coreOnboardingComplete({ ...complete, additionalNotes: 'Please focus on retail.' }), true)
})

test('completed onboarding records a durable completed state', () => {
  assert.match(edge, /status: 'completed', current_step: 4, completed_at: now/)
  assert.match(page, /You're all set\./)
})

test('credential and OneDrive internals are absent from client payloads', () => {
  const safeState = edge.slice(edge.indexOf('async function safeState'), edge.indexOf('async function savePatch'))
  assert.doesNotMatch(safeState, /storage_drive_id|storage_item_id|storage_web_url|password/)
  assert.doesNotMatch(page, /type="password"|localStorage|sessionStorage/)
  assert.match(api, /Your file was not uploaded/)
})

test('link rollout fails closed until secure OneDrive upload is enabled', () => {
  const internalPage = read('../src/features/client-onboarding/InternalOnboardingPage.tsx')
  assert.match(edge, /CLIENT_ONBOARDING_UPLOADS_ENABLED/)
  assert.match(edge, /Onboarding links stay disabled until secure file transfer is connected/)
  assert.match(internalPage, /<ActionButton className="min-h-12" disabled/)
})

test('link regeneration is atomic, one-per-client, and manager data is role-gated', () => {
  assert.match(migration, /unique \(client_id\)/)
  assert.match(migration, /create or replace function public\.reissue_client_onboarding_session/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(edge, /service\.rpc\('reissue_client_onboarding_session'/)
  assert.match(edge, /if \(!\['admin', 'manager'\]\.includes\(authorized\.profile\.role\)\)/)
})

test('mobile flow uses touch targets, sticky actions, and bounded responsive layout', () => {
  assert.match(page, /min-h-12/)
  assert.match(page, /fixed inset-x-0 bottom-0/)
  assert.doesNotMatch(page, /overflow-x-auto|<table/)
})
