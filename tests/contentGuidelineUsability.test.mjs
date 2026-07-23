import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Content Guideline usability: the guideline is the centre of the staff
// workflow. Pure rules load through a Vite SSR server (no Supabase import);
// wording, brief fields, run linkage and deep links are validated by parsing
// the source. No database is touched.

let server
let rules
let video

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  rules = await server.ssrLoadModule('/src/lib/contentWorkflowRules.ts')
  video = await server.ssrLoadModule('/src/lib/videoPipelineRules.ts')
})
after(async () => { await server?.close() })

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const PAGE = read('src/pages/admin/ContentWorkflowPage.tsx')
const GUIDE = read('src/pages/admin/contentGuideline.tsx')
const DATA = read('src/lib/contentWorkflow.ts')
const CAL = read('src/pages/admin/CompanyCalendarPage.tsx')

// ── 1. Visible wording uses Content Guidelines, not generic "idea" ───────────

test('visible wording uses guideline language, not generic idea wording', () => {
  assert.match(PAGE, /Content Guidelines/)
  assert.match(PAGE, /New guideline/)
  assert.match(PAGE, /No content guidelines yet/)
  assert.match(PAGE, /Select a content guideline/)
  assert.match(GUIDE, /Save guideline/)
  // The old generic wording is gone from the visible strings.
  assert.doesNotMatch(PAGE, />New idea</)
  assert.doesNotMatch(PAGE, /No ideas yet/)
  assert.doesNotMatch(PAGE, /Select an idea/)
  assert.doesNotMatch(GUIDE, /Save idea/)
})

test('the header explains plan → shoot → track', () => {
  assert.match(PAGE, /Plan the video, use the guideline during the shoot, then track editing and approvals\./)
})

// ── 2/3/4. The create form exposes and saves the full video brief ────────────

test('the guideline form exposes all full-brief fields', () => {
  for (const label of [
    'Linked Client Schedule deliverable', 'Concept title', 'Folder client code', 'Video number',
    'Objective', 'Hook / opening', 'Script / dialogue', 'Shot-by-shot breakdown',
    'On-screen text / CTA', 'People, products & props', 'Visual / filming notes', 'Internal notes',
    'Guide owner', 'Assigned editor', 'Proposed posting date',
    'Footage folder', 'Internal review', 'Client approval', 'Final export',
  ]) {
    assert.ok(GUIDE.includes(label), `form must expose "${label}"`)
  }
})

test('the guideline form saves canonical name and video fields', () => {
  assert.match(GUIDE, /canonical_name: canonical/)
  assert.match(GUIDE, /video_number:/)
  assert.match(GUIDE, /folder_client_code:/)
  assert.match(GUIDE, /script:/)
  assert.match(GUIDE, /shot_breakdown:/)
  assert.match(GUIDE, /requirements:/)
  // Canonical name uses the tested helper.
  assert.match(GUIDE, /buildCanonicalName\(/)
})

test('a linked deliverable supplies the video number (read-only)', () => {
  assert.match(GUIDE, /videoNumberFromInstance\(/)
  assert.match(GUIDE, /disabled=\{deliverableLinked\}/)
})

// ── 5. One active guideline per deliverable ──────────────────────────────────

test('one active guideline per deliverable is enforced', () => {
  const guides = [{ id: 'g1', deliverable_id: 'd1', status: 'approved' }]
  assert.equal(rules.deliverableHasActiveGuideline(guides, 'd1'), true)
  assert.equal(rules.deliverableHasActiveGuideline(guides, 'd1', 'g1'), false) // editing the same one
  assert.equal(rules.deliverableHasActiveGuideline(guides, 'd2'), false)
  assert.equal(rules.deliverableHasActiveGuideline([{ id: 'g1', deliverable_id: 'd1', status: 'archived' }], 'd1'), false)
  // The page enforces it before saving.
  assert.match(PAGE, /deliverableHasActiveGuideline\(guides, input\.deliverable_id/)
})

// ── 6. Guideline detail renders the full brief ───────────────────────────────

test('the guideline brief renders all brief sections', () => {
  for (const label of ['Objective', 'Hook / opening', 'Script / dialogue', 'Shot-by-shot breakdown', 'On-screen text / CTA', 'People, products & props', 'Visual / filming notes', 'Internal notes']) {
    assert.ok(GUIDE.includes(`label="${label}"`), `brief must render "${label}"`)
  }
  assert.match(GUIDE, /Production links/)
})

// ── 7/8/9. Linked guidelines inside Content Runs ─────────────────────────────

test('the run detail loads linked guidelines and separates them from extra shots', () => {
  assert.match(PAGE, /splitRunItems\(runItems\)/)
  assert.match(PAGE, /Videos & Content Guidelines/)
  assert.match(PAGE, /Extra shots \/ run notes/)
  assert.match(PAGE, /<GuidelineCard/)
})

test('a linked guideline card shows canonical name, production status and expands to the brief', () => {
  assert.match(GUIDE, /idea\.canonical_name/)
  assert.match(GUIDE, /VIDEO_STATUS_LABELS\[idea\.production_status\]/)
  assert.match(GUIDE, /expanded \? 'Hide brief' : 'Show brief'/)
})

test('linked guidelines are split from extra shots', () => {
  const { linked, extra } = rules.splitRunItems([
    { guide_idea_id: 'g1' },
    { guide_idea_id: null },
    { guide_idea_id: 'g2' },
  ])
  assert.equal(linked.length, 2)
  assert.equal(extra.length, 1)
})

// ── 10/13/24. Add guideline from the run ─────────────────────────────────────

test('adding a guideline from the run creates one linked run item and no calendar event', () => {
  assert.match(PAGE, /async function addGuideFromRun/)
  assert.match(PAGE, /addApprovedIdeaToRun\(selectedRun, guide, runItems\.length\)/)
  // addApprovedIdeaToRun creates exactly one run item and never a calendar event.
  const fn = DATA.slice(DATA.indexOf('export async function addApprovedIdeaToRun'), DATA.indexOf('export async function listRunItemsForGuide'))
  assert.match(fn, /addRunItem\(/)
  assert.doesNotMatch(fn, /createCompanyEvent/)
})

test('a guideline already linked to the run cannot be added again', () => {
  assert.match(PAGE, /!linkedItems\.some\(item => item\.guide_idea_id === guide\.id\)/)
})

// ── 11/12. Correct shot-list mapping with fallback ───────────────────────────

test('run-item mapping uses shot_breakdown and requirements', () => {
  const out = rules.runItemFieldsFromGuide({ shot_breakdown: 'SB', requirements: 'RQ', hook: 'H', visual_notes: 'V' })
  assert.deepEqual(out, { shot_notes: 'SB', requirements: 'RQ' })
})

test('run-item mapping falls back to hook / visual_notes only when the newer field is empty', () => {
  assert.deepEqual(rules.runItemFieldsFromGuide({ shot_breakdown: '', requirements: '', hook: 'H', visual_notes: 'V' }), { shot_notes: 'H', requirements: 'V' })
  assert.deepEqual(rules.runItemFieldsFromGuide({ hook: 'H', visual_notes: 'V' }), { shot_notes: 'H', requirements: 'V' })
  assert.deepEqual(rules.runItemFieldsFromGuide({}), { shot_notes: null, requirements: null })
  // The data layer uses the mapping helper (no longer the old hook→shot_notes copy).
  assert.match(DATA, /runItemFieldsFromGuide\(idea\)/)
})

// ── 14/15. Unlink preserves the guideline and resets status ──────────────────

test('unlinking removes only the run item and preserves the guideline', () => {
  const fn = DATA.slice(DATA.indexOf('export async function unlinkGuidelineFromRun'))
  assert.match(fn, /removeRunItem\(item\.id\)/)
  assert.doesNotMatch(fn.slice(0, fn.indexOf('}\n\n')), /archive|delete.*guide|deleteCompanyEvent/)
})

test('unlinking resets the guideline to approved when no other run references it', () => {
  const fn = DATA.slice(DATA.indexOf('export async function unlinkGuidelineFromRun'))
  assert.match(fn, /listRunItemsForGuide\(guideId\)/)
  assert.match(fn, /remaining\.data\.length === 0/)
  assert.match(fn, /updateGuideIdea\(guideId, \{ status: 'approved' \}\)/)
  // The run screen confirms before unlinking.
  assert.match(PAGE, /Yes, unlink/)
})

// ── 16/17. Extra shots de-emphasised; blank legacy shot labelled ─────────────

test('a blank legacy extra shot is detected and labelled clearly', () => {
  assert.equal(rules.isBlankExtraShot({ guide_idea_id: null, title: '', shot_notes: '', requirements: '' }), true)
  assert.equal(rules.isBlankExtraShot({ guide_idea_id: null, title: 'X' }), false)
  assert.equal(rules.isBlankExtraShot({ guide_idea_id: 'g1' }), false)
  assert.match(PAGE, /Extra shot — details not added/)
  assert.match(PAGE, /Add extra shot/)
  assert.doesNotMatch(PAGE, /Untitled shot/)
})

// ── 18. Shoot mode ───────────────────────────────────────────────────────────

test('shoot mode shows the required filming fields and prev/next controls', () => {
  const fn = GUIDE.slice(GUIDE.indexOf('export function ShootMode'))
  assert.match(fn, /label="People, products & props"/)
  assert.match(fn, /label="Script \/ dialogue"/)
  assert.match(fn, /label="Shot-by-shot breakdown"/)
  assert.match(fn, /← Previous/)
  assert.match(fn, /Next →/)
  assert.match(PAGE, /Open shoot mode/)
})

// ── 19. Mark video shot uses the existing guarded transition ─────────────────

test('mark video shot uses the guarded video transition', () => {
  const t = video.applyVideoTransition('not_shot', 'mark_shot')
  assert.equal(t.ok, true)
  assert.equal(t.next, 'shot')
  assert.equal(video.applyVideoTransition('shot', 'mark_shot').ok, false)
  assert.match(PAGE, /transitionVideo\(guide, 'mark_shot'/)
})

// ── 20/21/22. Deep links ─────────────────────────────────────────────────────

test('the guideline deep link (?tab=guides&guide=) works', () => {
  assert.match(PAGE, /searchParams\.get\('guide'\)/)
  assert.match(PAGE, /openFromGuideParam/)
})

test('the run deep link (?tab=runs&event=) still works', () => {
  assert.match(PAGE, /searchParams\.get\('event'\)/)
  assert.match(PAGE, /openFromCalendarEvent/)
})

test('the CG Calendar Open Content Run link remains intact', () => {
  assert.match(CAL, /\/admin\/content-workflow\?tab=runs&event=\$\{event\.id\}/)
})

// ── 23. Client Schedule is not mutated ───────────────────────────────────────

test('the guideline form never mutates the Client Schedule deliverable', () => {
  assert.match(GUIDE, /Nothing here mutates the Client\s*\n?\s*\/\/ Schedule deliverable/)
  // No writes to monthly_deliverables anywhere in the guideline UI or data helpers we changed.
  assert.doesNotMatch(GUIDE, /from\('monthly_deliverables'\)/)
})
