import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const adapter = read('../supabase/functions/client-onboarding/onedrive-adapter.ts')
const edge = read('../supabase/functions/client-onboarding/index.ts')
const emailAdapter = read('../supabase/functions/client-onboarding/email-adapter.ts')
const walkthrough = read('../src/features/client-onboarding/VideoWalkthrough.tsx')
const activityFeed = read('../src/features/client-onboarding/OnboardingActivityFeed.tsx')
const manager = read('../src/features/client-onboarding/InternalOnboardingPage.tsx')
const api = read('../src/features/client-onboarding/api.ts')
const welcome = read('../src/features/client-onboarding/WelcomeToCgPage.tsx')
const perfPage = read('../src/pages/admin/ClientPerformancePage.tsx')
const types = read('../src/features/client-onboarding/types.ts')
const uploadSession = read('../src/features/client-onboarding/upload-session.ts')

// ── Graph upload session protocol ────────────────────────────────────────────
test('client uploader uses sequential ranged chunks', () => {
  assert.ok(uploadSession.includes('GRAPH_UPLOAD_CHUNK_SIZE = 10 * 1024 * 1024'))
  assert.ok(uploadSession.includes("'Content-Range'"))
  assert.ok(uploadSession.includes('file.slice(offset'))
})

test('client uploader captures final DriveItem and reports progress', () => {
  assert.ok(uploadSession.includes('UploadedDriveItem'))
  assert.ok(uploadSession.includes('onProgress?.'))
  assert.ok(api.includes('driveItemId: driveItem.id'))
})

test('adapter verifies the final item parent and size', () => {
  assert.ok(adapter.includes('parentReference?.driveId !== driveId'))
  assert.ok(adapter.includes('parentReference?.id !== folderItemId'))
  assert.ok(adapter.includes('item.size !== expectedSize'))
})

// ── Edge Function: staff_revoke ─────────────────────────────────────────────
test('edge: staff_revoke action exists', () => {
  assert.ok(edge.includes("action === 'staff_revoke'"), 'must have staff_revoke action')
  assert.ok(edge.includes('revoked_at: now'), 'must set revoked_at')
  assert.ok(edge.includes('.is(\'revoked_at\', null)'), 'must only revoke non-revoked links')
})

test('edge: staff_revoke is manager-gated', () => {
  const revokeBlock = edge.slice(edge.indexOf("action === 'staff_revoke'"), edge.indexOf("// ── Download actions"))
  assert.ok(revokeBlock.includes('Manager access required'), 'must require manager role')
})

test('edge: staff_revoke returns updated state', () => {
  const revokeBlock = edge.slice(edge.indexOf("action === 'staff_revoke'"), edge.indexOf("// ── Download actions"))
  assert.ok(revokeBlock.includes('safeState(service, current, true)'), 'must return safeState with internal fields')
})

// ── Edge Function: upload order ─────────────────────────────────────────────
test('edge: upload actions execute before auth guard', () => {
  const uploadInitPos = edge.indexOf("action === 'upload_init'")
  const uploadCompletePos = edge.indexOf("action === 'upload_complete'")
  const uploadCancelPos = edge.indexOf("action === 'upload_cancel'")
  const authGuardPos = edge.indexOf('const authorized = await getAuthorizedUser')
  assert.ok(uploadInitPos < authGuardPos, 'upload_init before auth')
  assert.ok(uploadCompletePos < authGuardPos, 'upload_complete before auth')
  assert.ok(uploadCancelPos < authGuardPos, 'upload_cancel before auth')
})

test('edge: staff upload init enforces a staff role before session lookup', () => {
  const block = edge.slice(edge.indexOf("action === 'upload_init'"), edge.indexOf('const session = isStaffInit'))
  assert.ok(block.includes("['admin', 'manager', 'staff', 'team'].includes(staffAuth.profile.role)"))
  assert.ok(block.includes('Staff access required.'))
})

test('edge: upload_complete verifies DriveItem before marking received', () => {
  const block = edge.slice(edge.indexOf("action === 'upload_complete'"), edge.indexOf("action === 'upload_cancel'"))
  assert.ok(block.includes('verifyDriveItem'), 'must call verifyDriveItem')
  assert.ok(block.includes('storage_item_id: verifiedItem.id'), 'must persist verified item id')
  assert.ok(block.includes('storage_web_url: verifiedItem.webUrl'), 'must persist webUrl')
  assert.ok(block.includes('original_filename: verifiedItem.name'), 'must persist actual Graph filename')
})

// ── Email adapter (disabled stub) ───────────────────────────────────────────
test('email adapter: isEmailConfigured checks feature flag', () => {
  assert.ok(emailAdapter.includes('isEmailConfigured'), 'must export isEmailConfigured')
  assert.ok(emailAdapter.includes('CLIENT_ONBOARDING_EMAIL_ENABLED'), 'must check feature flag')
  assert.ok(emailAdapter.includes('ONBOARDING_SMTP_HOST') || emailAdapter.includes('ONBOARDING_RESEND_API_KEY'), 'must check credentials')
})

test('email adapter: sendWelcomeEmail is a disabled stub', () => {
  assert.ok(emailAdapter.includes('sendWelcomeEmail'), 'must export sendWelcomeEmail')
  assert.ok(emailAdapter.includes('not yet implemented'), 'must document as not implemented')
})

test('email adapter: uses separate env vars from transition sync', () => {
  assert.ok(emailAdapter.includes('CLIENT_ONBOARDING_EMAIL_ENABLED'), 'must check feature flag')
  assert.ok(emailAdapter.includes('ONBOARDING_SMTP_HOST') || emailAdapter.includes('ONBOARDING_RESEND_API_KEY'), 'must document credential env vars')
})

// ── Video walkthrough ───────────────────────────────────────────────────────
test('VideoWalkthrough: component exists', () => {
  assert.ok(walkthrough.includes('export function VideoWalkthrough'), 'must be exported')
})

test('VideoWalkthrough: works without video URL', () => {
  assert.ok(walkthrough.includes('WALKTHROUGH_STEPS'), 'must have fallback steps')
  assert.ok(walkthrough.includes('Show steps'), 'must show steps button when no URL')
  assert.ok(walkthrough.includes('Upload your logo'), 'step 1 must exist')
})

test('VideoWalkthrough: shows iframe when video URL is provided', () => {
  assert.ok(walkthrough.includes('iframe'), 'must render iframe')
  assert.ok(walkthrough.includes('Watch video'), 'must show watch button with URL')
})

test('VideoWalkthrough: expandable/collapsible', () => {
  assert.ok(walkthrough.includes('Show less'), 'must have collapse button')
  assert.ok(walkthrough.includes('useState'), 'must track expanded state')
})

test('WelcomeToCgPage: imports and uses VideoWalkthrough', () => {
  assert.ok(welcome.includes('VideoWalkthrough'), 'must import VideoWalkthrough')
  assert.ok(welcome.includes('WALKTHROUGH_VIDEO_URL'), 'must read env var for video URL')
  assert.ok(welcome.includes('VITE_ONBOARDING_WALKTHROUGH_URL'), 'must use VITE_ prefix env var')
})

// ── OnboardingActivityFeed ──────────────────────────────────────────────────
test('OnboardingActivityFeed: component exists', () => {
  assert.ok(activityFeed.includes('export function OnboardingActivityFeed'), 'must be exported')
})

test('OnboardingActivityFeed: derives events from canonical state', () => {
  assert.ok(activityFeed.includes('function deriveActivityEvents'), 'must have internal derivation function')
  assert.ok(activityFeed.includes('Onboarding started'), 'must track start event')
  assert.ok(activityFeed.includes('Logo uploaded'), 'must track logo event')
  assert.ok(activityFeed.includes('Services information received'), 'must track services event')
  assert.ok(activityFeed.includes('Onboarding complete'), 'must track completion event')
})

test('OnboardingActivityFeed: tracks platform verification', () => {
  assert.ok(activityFeed.includes('access-verified'), 'must track verified access')
  assert.ok(activityFeed.includes('awaiting verification'), 'must track pending access')
})

test('OnboardingActivityFeed: tracks revoked and expired', () => {
  assert.ok(activityFeed.includes('Link revoked'), 'must track revoked event')
  assert.ok(activityFeed.includes('Link expired'), 'must track expired event')
})

test('OnboardingActivityFeed: sorts events by timestamp descending', () => {
  assert.ok(activityFeed.includes('.sort('), 'must sort events')
})

// ── InternalOnboardingPage ──────────────────────────────────────────────────
test('InternalManager: has search input', () => {
  assert.ok(manager.includes('Search clients'), 'must have search placeholder')
  assert.ok(manager.includes('search'), 'must track search state')
})

test('InternalManager: has status filter pills', () => {
  assert.ok(manager.includes('StatusFilter'), 'must define StatusFilter type')
  assert.ok(manager.includes('not_started'), 'must filter not_started')
  assert.ok(manager.includes('in_progress'), 'must filter in_progress')
  assert.ok(manager.includes('completed'), 'must filter completed')
  assert.ok(manager.includes('revoked'), 'must filter revoked')
  assert.ok(manager.includes('expired'), 'must filter expired')
})

test('InternalManager: has progress strip', () => {
  assert.ok(manager.includes('ProgressStrip'), 'must have ProgressStrip component')
  assert.ok(manager.includes('from-brand-teal to-brand-accent'), 'must render gradient progress')
})

test('InternalManager: has drill-down expansion', () => {
  assert.ok(manager.includes('expandedId'), 'must track expanded state')
  assert.ok(manager.includes('isExpanded'), 'must compute expansion')
})

test('InternalManager: has revoke button', () => {
  assert.ok(manager.includes('revokeOnboardingLink'), 'must import revoke function')
  assert.ok(manager.includes('Revoke'), 'must show revoke button')
})

test('InternalManager: shows activity feed in drill-down', () => {
  assert.ok(manager.includes('OnboardingActivityFeed'), 'must include activity feed')
})

test('InternalManager: shows additional notes in drill-down', () => {
  assert.ok(manager.includes('Additional notes'), 'must show additional notes')
})

test('InternalManager: has status counts', () => {
  assert.ok(manager.includes('statusCounts'), 'must compute status counts')
  assert.ok(manager.includes('StatusPill'), 'must have StatusPill component')
})

// ── API: revoke action ──────────────────────────────────────────────────────
test('api.ts: has revokeOnboardingLink function', () => {
  assert.ok(api.includes('revokeOnboardingLink'), 'must export revoke function')
  assert.ok(api.includes("action: 'staff_revoke'"), 'must call staff_revoke action')
})

// ── Type: StaffOnboardingSummary has revokedAt ──────────────────────────────
test('types.ts: StaffOnboardingSummary has revokedAt', () => {
  assert.ok(types.includes('revokedAt'), 'must have revokedAt field')
})

// ── ClientPerformancePage: onboarding status ────────────────────────────────
test('ClientPerformancePage: includes OnboardingStatusCard', () => {
  assert.ok(perfPage.includes('OnboardingStatusCard'), 'must have onboarding status')
  assert.ok(perfPage.includes('client_onboarding_sessions'), 'must query sessions table')
})

// ── Permission doc exists ───────────────────────────────────────────────────
test('Microsoft upload permissions doc: exists and is accurate', () => {
  const doc = readFileSync(new URL('../docs/onboarding/MICROSOFT-UPLOAD-PERMISSIONS.md', import.meta.url), 'utf8')
  assert.ok(doc.includes('Files.ReadWrite.All'), 'must document current permission')
  assert.ok(doc.includes('not folder-scoped'), 'must be honest about scope')
  assert.ok(doc.includes('Sites.Selected'), 'must document narrower alternative')
  assert.ok(doc.includes('fail-closed'), 'must document fail-closed model')
})
