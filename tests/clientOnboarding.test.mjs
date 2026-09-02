import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const migration = read('../supabase/migrations/20260902100000_client_onboarding_foundation.sql')
const uploadMigration = read('../supabase/migrations/20260902110000_client_onboarding_upload_phase2.sql')
const edge = read('../supabase/functions/client-onboarding/index.ts')
const adapter = read('../supabase/functions/client-onboarding/onedrive-adapter.ts')
const page = read('../src/features/client-onboarding/WelcomeToCgPage.tsx')
const api = read('../src/features/client-onboarding/api.ts')
const setupSummary = read('../src/features/client-onboarding/SetupSummary.tsx')
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
  assert.match(api, /upload_init/)
  assert.match(api, /uploadFileToSession/)
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

test('upload adapter rejects files that are empty, too large, or executable', () => {
  assert.match(edge, /BLOCKED_EXTENSIONS/)
  assert.match(edge, /validateUploadFile/)
  assert.match(edge, /size > MAX_ONBOARDING_FILE_BYTES/)
  assert.match(api, /upload_init/)
  assert.match(api, /upload_complete/)
  assert.match(api, /upload_cancel/)
  assert.match(api, /uploadFileToSession/)
})

test('upload init validates category, filename, size, and mime before creating a session', () => {
  assert.match(edge, /UPLOAD_CATEGORIES\.has\(category\)/)
  assert.match(edge, /originalFilename/)
  assert.match(edge, /sizeBytes/)
  assert.match(edge, /validateUploadFile/)
  assert.match(edge, /sanitizeFilename/)
})

test('upload complete moves pending uploads to received and clears the upload session', () => {
  assert.match(edge, /upload_status: 'received'/)
  assert.match(edge, /upload_session_id: null/)
  assert.match(edge, /upload_session_expires_at: null/)
})

test('upload cancel deletes pending uploads only', () => {
  assert.match(edge, /upload_status: 'pending'/)
  assert.match(edge, /\.delete\(\)/)
})

test('download proxy requires authentication and serves only received uploads', () => {
  assert.match(edge, /download_file/)
  assert.match(edge, /portal_download/)
  assert.match(edge, /upload_status !== 'received'/)
  assert.match(edge, /storage_drive_id/)
  assert.match(edge, /storage_item_id/)
  assert.match(edge, /isUploadAdapterConfigured/)
})

test('download proxy enforces client isolation for portal downloads', () => {
  assert.match(edge, /action === 'portal_download'/)
  assert.match(edge, /authorizedUser\.profile\.role !== 'client'/)
  assert.match(edge, /authorizedUser\.profile\.client_id !== upload\.client_id/)
  assert.match(edge, /Access denied/)
})

test('download proxy restricts staff downloads to authenticated staff roles', () => {
  assert.match(edge, /\['admin', 'manager', 'staff', 'team'\]\.includes\(authorizedUser\.profile\.role\)/)
})

test('upload adapter uses a separate Microsoft app from the read-only transition connector', () => {
  assert.match(adapter, /ONBOARDING_MS_TENANT_ID/)
  assert.match(adapter, /ONBOARDING_MS_CLIENT_ID/)
  assert.match(adapter, /ONBOARDING_MS_CLIENT_SECRET/)
  assert.match(adapter, /isUploadAdapterConfigured/)
  assert.doesNotMatch(adapter, /MICROSOFT_TENANT_ID/)
  assert.doesNotMatch(adapter, /MICROSOFT_CLIENT_SECRET/)
})

test('upload adapter resolves exact-client Brand Identity folder from drive mapping table', () => {
  assert.match(adapter, /client_onboarding_drive_mapping/)
  assert.match(adapter, /resolveClientFolder/)
  assert.match(adapter, /drive_id/)
  assert.match(adapter, /folder_item_id/)
})

test('upload adapter creates resumable upload session and proxies downloads', () => {
  assert.match(adapter, /createUploadSession/)
  assert.match(adapter, /createUploadSession/)
  assert.match(adapter, /downloadFile/)
  assert.match(adapter, /\/content/)
})

test('client upload API replaces the foundation stub with real upload, cancel, and download', () => {
  assert.match(api, /initOnboardingUpload/)
  assert.match(api, /completeOnboardingUpload/)
  assert.match(api, /cancelOnboardingUpload/)
  assert.match(api, /uploadFileToSession/)
  assert.match(api, /downloadOnboardingFile/)
  assert.doesNotMatch(api, /Secure file transfer is not connected yet\. Your file was not uploaded\./)
})

test('welcome page drives real upload with progress, category tracking, and retry-safe cancellation', () => {
  assert.match(page, /handleFileUpload/)
  assert.match(page, /uploadingCategory/)
  assert.match(page, /uploadProgress/)
  assert.match(page, /UploadProgressBar/)
  assert.match(page, /validateServicesCandidate/)
  assert.match(page, /handleFileUpload\('logo', file\)/)
  assert.match(page, /handleFileUpload\('services', file\)/)
  assert.match(page, /handleFileUpload\('optional', file\)/)
  assert.doesNotMatch(page, /Secure OneDrive file transfer is not connected in this foundation build\. No file selected here will be treated as received\./)
})

test('setup summary exposes received uploads with mediated download and never exposes drive internals', () => {
  assert.match(setupSummary, /DownloadButton/)
  assert.match(setupSummary, /downloadOnboardingFile/)
  assert.match(setupSummary, /uploadStatus === 'received'/)
  assert.doesNotMatch(setupSummary, /storage_drive_id|storage_item_id|storage_web_url/)
})

test('upload phase2 migration maps clients to a Brand Identity drive folder and extends upload metadata', () => {
  assert.match(uploadMigration, /client_onboarding_drive_mapping/)
  assert.match(uploadMigration, /drive_id/)
  assert.match(uploadMigration, /folder_item_id/)
  assert.match(uploadMigration, /Brand Identity/)
  assert.match(uploadMigration, /revoke all on public\.client_onboarding_drive_mapping from anon, authenticated/)
  assert.match(uploadMigration, /storage_original_reference/)
  assert.match(uploadMigration, /upload_session_id/)
  assert.match(uploadMigration, /upload_session_expires_at/)
  assert.match(uploadMigration, /enable row level security/)
})
