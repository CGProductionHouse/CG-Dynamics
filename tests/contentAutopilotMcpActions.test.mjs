// #450 Phase 4: the Assistant's narrow content actions, and their safety boundaries.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let server, actions, ap, catalog, context, serverSource
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  actions = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/contentGuidelineActions.ts')
  ap = await server.ssrLoadModule('/src/lib/contentAutopilot.ts')
  catalog = readFileSync('supabase/functions/cg-dynamics-mcp/toolCatalog.ts', 'utf8')
  context = readFileSync('supabase/functions/cg-dynamics-mcp/projectContext.ts', 'utf8')
  serverSource = readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8')
})
after(async () => { await server?.close() })

const A = '42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa'
const B = 'cdb11a82-339e-4b46-9b09-bde1a23efeaf'
const C = '6b1f4a5e-2c3d-4e5f-9a8b-7c6d5e4f3a2b'

test('every #450 action is exposed, contexted and correctly classified', () => {
  const writes = serverSource.match(/const WRITE_TOOLS = new Set\(\[([\s\S]*?)\]\)/)[1]
  const readOnly = new Set(['list_content_guideline_videos', 'get_content_video_readiness'])
  for (const tool of actions.CONTENT_GUIDELINE_TOOLS) {
    assert.ok(catalog.includes(`name: '${tool}'`), `${tool} is in the catalog`)
    assert.ok(context.includes(`'${tool}'`), `${tool} is classified for Project context`)
    assert.match(serverSource, new RegExp(`\\n  ${tool}: handle`), `${tool} is routed`)
    assert.equal(writes.includes(`'${tool}'`), !readOnly.has(tool), `${tool} write classification`)
  }
})

test('content actions are client-scoped, never company-wide or staff-subject', () => {
  const clientScoped = context.slice(context.indexOf('CLIENT_SCOPED_TOOLS'), context.indexOf('COMPANY_ADMIN_TOOLS'))
  for (const tool of actions.CONTENT_GUIDELINE_TOOLS) assert.ok(clientScoped.includes(`'${tool}'`), tool)
  const admin = context.slice(context.indexOf('COMPANY_ADMIN_TOOLS'), context.indexOf('CLIENT_WORKSPACE_ACTIONS'))
  const staffSubject = context.slice(context.indexOf('STAFF_SUBJECT_TOOLS'), context.indexOf('CLIENT_SCOPED_TOOLS'))
  for (const tool of actions.CONTENT_GUIDELINE_TOOLS) {
    assert.ok(!admin.includes(`'${tool}'`), `${tool} is not a company-wide inventory`)
    assert.ok(!staffSubject.includes(`'${tool}'`), `${tool} has no staff subject`)
  }
})

test('an edit may only touch declared video fields', () => {
  const ok = actions.validateVideoPatch({ title: '  Fresh produce walkthrough ', hook: 'Open on the crate.' })
  assert.deepEqual(ok.value, { title: 'Fresh produce walkthrough', hook: 'Open on the crate.' })
  assert.match(actions.validateVideoPatch({ client_id: B }).error, /dedicated reorder, link or production action/)
  assert.match(actions.validateVideoPatch({ position: 2 }).error, /cannot be set here/)
  assert.match(actions.validateVideoPatch({ deliverable_id: B }).error, /cannot be set here/)
  assert.match(actions.validateVideoPatch({ onedrive_final_url: 'https://example.com' }).error, /not an editable video field/)
  assert.match(actions.validateVideoPatch({ title: '   ' }).error, /must keep a title/)
  assert.match(actions.validateVideoPatch({ script: 'x'.repeat(20001) }).error, /longer than 20000/)
  assert.match(actions.validateVideoPatch({}).error, /No editable field/)
})

test('a month is normalised and a bad month is refused, not guessed', () => {
  assert.equal(actions.validateVideoPatch({ month: '2026-11' }).value.month, '2026-11-01')
  assert.equal(actions.validateVideoPatch({ month: '' }).value.month, null)
  assert.match(actions.validateVideoPatch({ month: 'November' }).error, /YYYY-MM/)
})

test('reorder must be the exact saved set, each video once', () => {
  const saved = [A, B, C]
  assert.deepEqual(actions.validateReorder([C, A, B], saved).value, [C, A, B])
  assert.match(actions.validateReorder([A, A, B], saved).error, /only once/)
  assert.match(actions.validateReorder([A, B], saved).error, /every video in this guideline exactly once/)
  assert.match(actions.validateReorder([A, B, '11111111-1111-4111-8111-111111111111'], saved).error, /does not belong to this guideline/)
  assert.match(actions.validateReorder([], saved).error, /new order/)
  assert.match(actions.validateReorder(['not-a-uuid'], saved).error, /exact UUID/)
})

test('a video can only link to a real same-client video slot', () => {
  const deliverable = { id: B, client_id: A, month: '2026-09-01', deliverable_type: 'video' }
  assert.equal(actions.validateDeliverableLink({ videoClientId: A, deliverable, unlink: false }).value, 'link')
  assert.equal(actions.validateDeliverableLink({ videoClientId: A, deliverable: null, unlink: true }).value, 'unlink')
  assert.match(actions.validateDeliverableLink({ videoClientId: A, deliverable: { ...deliverable, client_id: C }, unlink: false }).error, /its own client/)
  assert.match(actions.validateDeliverableLink({ videoClientId: A, deliverable: { ...deliverable, deliverable_type: 'design_post' }, unlink: false }).error, /video or reel/)
  assert.match(actions.validateDeliverableLink({ videoClientId: A, deliverable: null, unlink: false }).error, /was not found/)
})

test('the Assistant projection carries no OneDrive id or URL', () => {
  const shaped = actions.shapeVideoForAssistant({
    video: { id: A, title: 'Fresh produce walkthrough', script: 'Script pending.', production_status: 'shot', editor_name: 'Thabo', deliverable_id: null },
    position: 2,
    folderName: '2026_09_ECONO_VIDEO_02',
    folderState: 'mapped', folderBlocked: null, raw: 'VERIFIED',
    readiness: { readiness: 'READY_TO_EDIT', reason: 'Raw footage is verified.', next_action: 'Assign an editor.' },
    finalOutputState: 'not_published',
  })
  assert.equal(shaped.name, 'Video 02 - Fresh produce walkthrough')
  assert.equal(shaped.has_script, false, 'a placeholder script is not a script')
  assert.equal(shaped.allocated, false)
  assert.equal(shaped.editor, 'Thabo')
  const serialised = JSON.stringify(shaped)
  assert.doesNotMatch(serialised, /drive_id|item_id|itemId|driveId|https?:\/\//)
})

test('the Edge copy of the readiness rules does not drift from the app', () => {
  const folders = [
    { state: 'mapped', blocked: null },
    { state: 'ready_to_create', blocked: null },
    { state: 'blocked', blocked: 'BLOCKED_MISSING_SHORT_CODE' },
    { state: 'blocked', blocked: 'BLOCKED_MISSING_ONEDRIVE_MAPPING' },
  ]
  const statuses = ['not_shot', 'shot', 'ready_to_edit', 'editing', 'internal_review', 'sent_to_client', 'client_approved']
  const uploads = [null, 'verified', 'missing', 'partial', 'unverified']
  let compared = 0
  for (const folder of folders) {
    for (const closeout of uploads) {
      for (const readable of [true, false]) {
        const edge = actions.deriveRawEvidence({ folderState: folder.state, providerReadable: readable, closeoutUploadStatus: closeout })
        const app = ap.deriveRawEvidence({ folderState: folder.state, providerReadable: readable, closeoutUploadStatus: closeout })
        assert.equal(edge, app, `raw ${folder.state}/${closeout}/${readable}`)
        for (const status of statuses) {
          const edgeAnswer = actions.deriveEditReadiness({ folderState: folder.state, folderBlocked: folder.blocked, raw: edge, productionStatus: status })
          const appAnswer = ap.deriveEditReadiness({
            folder: { folderName: null, path: null, itemId: null, driveId: null, state: folder.state, blocked: folder.blocked },
            raw: app, productionStatus: status,
          })
          assert.equal(edgeAnswer.readiness, appAnswer.readiness, `${folder.state}/${status}/${closeout}`)
          assert.equal(edgeAnswer.reason, appAnswer.reason)
          assert.equal(edgeAnswer.next_action, appAnswer.nextAction)
          compared += 1
        }
      }
    }
  }
  assert.ok(compared > 250, 'the whole matrix was compared')
})

test('the handlers cannot write the Client Schedule or publish a guideline', () => {
  const start = serverSource.indexOf('// ── #450 Content preparation actions')
  const handlers = serverSource.slice(start, serverSource.indexOf('// ── Tool Router', start))
  assert.ok(start > 0, 'the #450 handler block exists')
  // The only monthly_deliverables touch is a read to verify same-client provenance.
  const deliverableCalls = handlers.match(/from\('monthly_deliverables'\)[\s\S]{0,120}/g) ?? []
  assert.equal(deliverableCalls.length, 1)
  assert.match(deliverableCalls[0], /\.select\(/)
  assert.doesNotMatch(handlers, /from\('monthly_deliverables'\)\s*\n?\s*\.(insert|update|delete|upsert)/)
  assert.doesNotMatch(handlers, /set_content_guideline_publication|client_published_at/, 'nothing here publishes')
  assert.doesNotMatch(handlers, /\.delete\(/, 'nothing here deletes')
  // Every write re-proves the client before touching a row.
  for (const guard of ['assertRecordClientMatchesContext', "eq('client_id'"]) {
    assert.ok(handlers.includes(guard), guard)
  }
})

test('generation blocks instead of inventing content', () => {
  const start = serverSource.indexOf('const handleGenerateContentGuidelineDrafts')
  const handler = serverSource.slice(start, serverSource.indexOf('// ── Tool Router', start))
  assert.match(handler, /GENERATION_BLOCKED/)
  assert.match(handler, /GUIDELINE_APPROVED/, 'an approved guideline is never regenerated')
  assert.match(handler, /suggest-content-videos/, 'it reuses the existing Content Director')
  assert.doesNotMatch(handler, /Script pending/, 'no placeholder content is written')
})
