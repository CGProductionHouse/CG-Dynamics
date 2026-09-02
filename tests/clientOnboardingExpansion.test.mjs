import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const progress = read('../src/features/client-onboarding/OnboardingProgress.tsx')
const brandLibrary = read('../src/features/client-onboarding/BrandAssetLibrary.tsx')
const timeline = read('../src/features/client-onboarding/OnboardingTimeline.tsx')
const setupPage = read('../src/features/client-onboarding/ClientSetupPage.tsx')
const perfPage = read('../src/pages/admin/ClientPerformancePage.tsx')

// ── OnboardingProgress component ──────────────────────────────────────────
test('OnboardingProgress: component exists', () => {
  assert.ok(progress.includes('export function OnboardingProgress'), 'OnboardingProgress must be exported')
  assert.ok(progress.includes('deriveSteps'), 'deriveSteps helper must exist')
})

test('OnboardingProgress: tracks 5 steps', () => {
  assert.ok(progress.includes('Welcome'), 'step 1 must be Welcome')
  assert.ok(progress.includes('Logo & brand files'), 'step 2 must be Logo & brand files')
  assert.ok(progress.includes('Services'), 'step 3 must be Services')
  assert.ok(progress.includes('Account access'), 'step 4 must be Account access')
  assert.ok(progress.includes('All set'), 'step 5 must be All set')
})

test('OnboardingProgress: shows progress bar', () => {
  assert.ok(progress.includes('progressPercent'), 'must calculate progress percent')
  assert.ok(progress.includes('h-2'), 'must render progress bar')
  assert.ok(progress.includes('bg-gradient-to-r'), 'must use gradient for progress')
})

test('OnboardingProgress: completed state shows completion message', () => {
  assert.ok(progress.includes('Onboarding complete'), 'must show completion message')
  assert.ok(progress.includes('Onboarding progress'), 'must have section title')
})

// ── BrandAssetLibrary component ───────────────────────────────────────────
test('BrandAssetLibrary: component exists', () => {
  assert.ok(brandLibrary.includes('export function BrandAssetLibrary'), 'BrandAssetLibrary must be exported')
})

test('BrandAssetLibrary: groups uploads by category', () => {
  assert.ok(brandLibrary.includes('Logo & brand'), 'must group logo uploads')
  assert.ok(brandLibrary.includes('Services'), 'must group services uploads')
  assert.ok(brandLibrary.includes('Additional files'), 'must group optional uploads')
})

test('BrandAssetLibrary: download functionality exists', () => {
  assert.ok(brandLibrary.includes('downloadOnboardingFile'), 'must use downloadOnboardingFile API')
  assert.ok(brandLibrary.includes('Download'), 'must show Download button')
})

test('BrandAssetLibrary: file icons exist', () => {
  assert.ok(brandLibrary.includes('fileIcon'), 'fileIcon helper must exist')
  assert.ok(brandLibrary.includes('Image'), 'must handle image files')
  assert.ok(brandLibrary.includes('PDF'), 'must handle PDF files')
  assert.ok(brandLibrary.includes('ZIP'), 'must handle ZIP files')
})

test('BrandAssetLibrary: file size formatting exists', () => {
  assert.ok(brandLibrary.includes('formatSize'), 'formatSize helper must exist')
  assert.ok(brandLibrary.includes('KB'), 'must format KB')
  assert.ok(brandLibrary.includes('MB'), 'must format MB')
})

// ── OnboardingTimeline component ──────────────────────────────────────────
test('OnboardingTimeline: component exists', () => {
  assert.ok(timeline.includes('export function OnboardingTimeline'), 'OnboardingTimeline must be exported')
  assert.ok(timeline.includes('deriveMilestones'), 'deriveMilestones helper must exist')
})

test('OnboardingTimeline: milestone types exist', () => {
  assert.ok(timeline.includes('Onboarding started'), 'must track onboarding started')
  assert.ok(timeline.includes('Brand files received'), 'must track brand files received')
  assert.ok(timeline.includes('Services information received'), 'must track services received')
  assert.ok(timeline.includes('Account access verified'), 'must track account access verified')
  assert.ok(timeline.includes('Onboarding complete'), 'must track onboarding complete')
})

test('OnboardingTimeline: timestamp formatting exists', () => {
  assert.ok(timeline.includes('formatTimestamp'), 'formatTimestamp helper must exist')
  assert.ok(timeline.includes('en-GB'), 'must use en-GB locale')
})

// ── ClientSetupPage integration ───────────────────────────────────────────
test('ClientSetupPage: includes all new components', () => {
  assert.ok(setupPage.includes('OnboardingProgress'), 'must import OnboardingProgress')
  assert.ok(setupPage.includes('BrandAssetLibrary'), 'must import BrandAssetLibrary')
  assert.ok(setupPage.includes('OnboardingTimeline'), 'must import OnboardingTimeline')
})

test('ClientSetupPage: renders components in correct order', () => {
  // Check JSX usage order (not import order)
  const jsxUsage = setupPage.slice(setupPage.indexOf('<OnboardingProgress'))
  const progressIdx = jsxUsage.indexOf('<OnboardingProgress')
  const summaryIdx = jsxUsage.indexOf('<SetupSummary')
  const libraryIdx = jsxUsage.indexOf('<BrandAssetLibrary')
  const timelineIdx = jsxUsage.indexOf('<OnboardingTimeline')
  assert.ok(progressIdx < summaryIdx, 'Progress must come before Summary')
  assert.ok(summaryIdx < libraryIdx, 'Summary must come before Library')
  assert.ok(libraryIdx < timelineIdx, 'Library must come before Timeline')
})

// ── ClientPerformancePage onboarding status ───────────────────────────────
test('ClientPerformancePage: includes OnboardingStatusCard', () => {
  assert.ok(perfPage.includes('OnboardingStatusCard'), 'must import OnboardingStatusCard')
  assert.ok(perfPage.includes('Client onboarding status'), 'must have onboarding status section')
})

test('ClientPerformancePage: onboarding status shows counts', () => {
  assert.ok(perfPage.includes('Completed'), 'must show completed count')
  assert.ok(perfPage.includes('In progress'), 'must show in-progress count')
  assert.ok(perfPage.includes('Not started'), 'must show not-started count')
})

test('ClientPerformancePage: links to onboarding workspace', () => {
  assert.ok(perfPage.includes('/admin/client-onboarding'), 'must link to onboarding workspace')
  assert.ok(perfPage.includes('View onboarding workspace'), 'must show link text')
})
