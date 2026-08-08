import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const myDay = read('../src/pages/admin/MyDayPage.tsx')
const hub = read('../src/pages/admin/CgHubPage.tsx')

// ── Issue #179: Work/My Day copy and empty-state noise ───────────────────────

test('hero no longer carries a descriptive paragraph about how My Day is built', () => {
  assert.doesNotMatch(myDay, /A focused daily view built from/)
  assert.doesNotMatch(myDay, /Workforce[\s\S]{0,60}My Day/)
})

test('Overdue and Assigned sections are single compact states, not stacked copy', () => {
  assert.match(myDay, /title="Overdue work"/)
  assert.match(myDay, /title="Assigned work"/)
  assert.doesNotMatch(myDay, /Overdue work[\s\S]{0,120}Late assigned work/)
  assert.doesNotMatch(myDay, /Assigned work[\s\S]{0,160}Due today and upcoming assigned work for the next seven days/)
  assert.doesNotMatch(myDay, /EmptyPanel/, 'no oversized empty-state card remains')
  assert.match(myDay, /empty="Nothing overdue"/, 'overdue collapses to one compact line')
  assert.match(myDay, /empty="No assigned work"/, 'assigned collapses to one compact line')
})

test('ordinary staff never see internal identity-resolution wording', () => {
  assert.doesNotMatch(myDay, /check your profile name, helper names or direct task assignment/)
  assert.doesNotMatch(myDay, /name\/helper assignments can match you/)
  assert.doesNotMatch(myDay, /User-ID assignments can still match/)
  assert.doesNotMatch(myDay, /CG Calendar events table is not available yet/)
  assert.doesNotMatch(myDay, /Setup notes/)
})

test('diagnostics keep only actionable load errors', () => {
  assert.match(myDay, /Some work couldn't load/)
  assert.match(myDay, /context\.diagnostics\.errors/)
  assert.doesNotMatch(myDay, /profileNameMissing/, 'display-name advice is not shown to staff')
  assert.doesNotMatch(myDay, /companyEventsMissing/, 'database-behaviour note is not shown to staff')
})

test('kicker, plan and workday summaries drop redundant sentences', () => {
  assert.doesNotMatch(myDay, /Recommended flow/)
  assert.doesNotMatch(myDay, /suggestedNextAction/, 'no suggested-action paragraph is rendered')
  assert.match(myDay, /No scheduled work ·/, 'empty plan collapses to a single compact row')
  assert.doesNotMatch(myDay, /08:00 to 17:00, anchored by CG Calendar events/)
  assert.doesNotMatch(myDay, /My Day only shows real connected data/)
  assert.match(myDay, /Nothing scheduled in this workday\./)
})

test('hub My Day card stops repeating the empty plan sentence', () => {
  assert.doesNotMatch(hub, /context\.summary\.suggestedNextAction/)
  assert.match(hub, /nextItem && \(/) // "Next: X" is shown only when there is one
})

test('useful work, warnings and actions are preserved', () => {
  // Task rows and actions must stay.
  assert.match(myDay, /WorkItemCard/)
  assert.match(myDay, />\s*Start\s*</)
  assert.match(myDay, /Ready for review/)
  assert.match(myDay, /Open\s*</)
  // Manager-relevant review truth stays (sendToReview) untouched.
  assert.match(myDay, /ready_internal_review/)
  // Compact numeric counts remain the leading signals.
  assert.match(myDay, /<Signal label="Overdue"/)
  assert.match(myDay, /<Signal label="Due today"/)
  assert.match(myDay, /<Signal label="Upcoming"/)
  // Actionable load errors and workload warnings stay.
  assert.match(myDay, /workloadWarning/)
  assert.match(myDay, /Could not load My Day/)
  // Canonical ownership logic in the lib is untouched by the copy change.
  assert.match(read('../src/lib/workforceMyDay.ts'), /userMatches[\s\S]*assigneeUserIds\.includes\(profile\.id\)/)
})