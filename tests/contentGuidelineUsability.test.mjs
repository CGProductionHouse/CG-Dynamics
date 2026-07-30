import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const MIGRATION = read('supabase/migrations/20260725172531_content_guideline_document_model.sql')
const LINKAGE_MIGRATION = read('supabase/migrations/20260725211500_content_run_schedule_linkage.sql')
const PROPAGATION_MIGRATION = read('supabase/migrations/20260726075342_content_run_client_propagation.sql')
const WORKFLOW = read('src/pages/admin/ContentWorkflowPage.tsx')
const WORKFLOW_DATA = read('src/lib/contentWorkflow.ts')
const EDITOR = read('src/pages/admin/ContentGuidelineDocumentEditor.tsx')
const ADMIN_PAGE = read('src/pages/admin/FullContentGuidePage.tsx')
const SCHEDULE = read('src/pages/admin/ClientSchedulePage.tsx')
const CLIENT_PAGE = read('src/pages/client/ClientContentGuidesPage.tsx')
const CLIENT_DATA = read('src/lib/clientContentGuides.ts')
const CALENDAR = read('src/pages/admin/CompanyCalendarPage.tsx')

test('one canonical Content Guideline is enforced per Content Run', () => {
  assert.match(MIGRATION, /content_run_id uuid not null references public\.content_runs\(id\)/)
  assert.match(MIGRATION, /constraint content_guidelines_one_per_run unique \(content_run_id\)/)
  assert.match(MIGRATION, /on conflict \(content_run_id\) do nothing/)
  assert.match(MIGRATION, /get_or_create_content_guideline/)
})

test('guideline and run ownership must resolve to the same explicit client', () => {
  assert.match(MIGRATION, /Content Guideline and Content Run must belong to the same client/)
  assert.match(MIGRATION, /Content Run client cannot change while its Content Guideline belongs to another client/)
  assert.match(MIGRATION, /Video and Content Guideline must belong to the same client/)
  assert.match(MIGRATION, /Video deliverable and Content Guideline must belong to the same client/)
  assert.doesNotMatch(MIGRATION, /insert into public\.clients/i)
})

test('videos remain ordered children and keep their complete scripts', () => {
  assert.match(MIGRATION, /add column if not exists content_guideline_id uuid references public\.content_guidelines\(id\)/)
  assert.match(MIGRATION, /add column if not exists position integer/)
  assert.match(MIGRATION, /uniq_content_guideline_video_position/)
  assert.match(MIGRATION, /Every video needs a name and complete script before publishing/)
  assert.match(EDITOR, /Video \{index \+ 1\}/g)
  assert.match(EDITOR, /Complete script/)
  assert.match(EDITOR, /reorderGuidelineVideos/)
  assert.match(EDITOR, /updateGuidelineVideo/)
})

test('legacy grouping is deterministic, reviewable and non-destructive', () => {
  assert.match(MIGRATION, /count\(\*\)[\s\S]*?where links\.guide_idea_id = g\.id[\s\S]*?= 1/)
  assert.match(MIGRATION, /r\.client_id is not null/)
  assert.match(MIGRATION, /g\.client_id = r\.client_id/)
  assert.match(MIGRATION, /multiple_run_links/)
  assert.match(MIGRATION, /run_client_missing/)
  assert.match(MIGRATION, /client_mismatch_or_missing/)
  assert.doesNotMatch(MIGRATION, /delete from public\./i)
})

test('publication is document-level and guarded by complete video content', () => {
  assert.match(MIGRATION, /set_content_guideline_publication/)
  assert.match(MIGRATION, /client_published_at = case when p_publish then now\(\) else null end/)
  assert.match(MIGRATION, /status = case when p_publish then 'published' else 'ready' end/)
  assert.match(MIGRATION, /Published Content Guideline videos require a name and complete script/)
  assert.match(EDITOR, /Publish full guideline/)
  assert.match(EDITOR, /Unpublish document/)
  assert.doesNotMatch(EDITOR, /client_published_at.*video/)
})

test('client projection returns only own published documents and ordered safe videos', () => {
  const rpc = MIGRATION.slice(MIGRATION.indexOf('create or replace function public.client_portal_published_content_guidelines'))
  assert.match(rpc, /v_client_id := public\.my_client_id\(\)/)
  assert.match(rpc, /guideline\.client_id = v_client_id/)
  assert.match(rpc, /guideline\.client_published_at is not null/)
  assert.match(rpc, /guideline\.status = 'published'/)
  assert.match(rpc, /order by video\.position, video\.created_at/)
  for (const internal of ['internal_notes', 'assigned_to', 'editor_user_id', 'production_status', 'deliverable_id']) {
    assert.ok(!rpc.includes(`'${internal}'`), `client projection must omit ${internal}`)
  }
  assert.match(CLIENT_DATA, /client_portal_published_content_guidelines/)
  assert.match(CLIENT_PAGE, /Complete script/)
  assert.match(CLIENT_PAGE, /Video \{index \+ 1\}/g)
})

test('staff workflow and calendar resolve the same run document', () => {
  assert.match(WORKFLOW, /getGuidelineForRun\(runId\)/)
  assert.match(WORKFLOW, /ensureGuidelineForRun\(selectedRun\.id\)/)
  assert.match(WORKFLOW, /<ContentGuidelineDocumentEditor/)
  assert.match(WORKFLOW, /searchParams\.get\('event'\)/)
  assert.match(WORKFLOW, /searchParams\.get\('run'\)/)
  assert.match(CALENDAR, /\/admin\/content\?tab=runs&event=\$\{event\.id\}/)
  assert.match(ADMIN_PAGE, /ContentGuidelineDocumentEditor/)
})

test('Microsoft Outlook content runs become canonical Content Runs without duplicating CG-created runs', () => {
  assert.match(LINKAGE_MIGRATION, /new\.microsoft_event_id is null/)
  assert.match(LINKAGE_MIGRATION, /new\.event_type <> 'content_run'/)
  assert.match(LINKAGE_MIGRATION, /where calendar_event_id = new\.id/)
  assert.match(LINKAGE_MIGRATION, /insert into public\.content_runs/)
  assert.match(LINKAGE_MIGRATION, /Africa\/Johannesburg/)
  assert.match(LINKAGE_MIGRATION, /not exists \([\s\S]*run\.calendar_event_id = event\.id/)
  assert.doesNotMatch(LINKAGE_MIGRATION, /insert into public\.monthly_deliverables/i)
})

test('guideline videos link to one canonical Client Schedule deliverable', () => {
  assert.match(EDITOR, /listMonthlyDeliverablesByMonth/)
  assert.match(EDITOR, /Client Schedule video/)
  assert.match(EDITOR, /deliverable_id: newDeliverableId \|\| null/)
  assert.match(EDITOR, /deliverable_id: draft\.deliverableId \|\| null/)
  assert.match(LINKAGE_MIGRATION, /already linked to another active Content Guideline video/)
  assert.match(LINKAGE_MIGRATION, /other\.status <> 'archived'/)
})

test('staff can explicitly bootstrap same-client schedule videos and imported scripts', () => {
  assert.match(EDITOR, /Import \{scheduleCandidates\.length\} from Client Schedule/)
  assert.match(EDITOR, /guidelineScheduleCandidates/)
  assert.match(EDITOR, /importGuidelineVideosFromSchedule/)
  assert.match(WORKFLOW_DATA, /deliverable\.client_id === guideline\.client_id/)
  assert.match(WORKFLOW_DATA, /deliverable\.month >= coverageStart/)
  assert.match(WORKFLOW_DATA, /deliverable\.month <= coverageEnd/)
  assert.match(WORKFLOW_DATA, /microsoft_source_description\?\.trim\(\)/)
  assert.match(WORKFLOW_DATA, /deliverable_id: deliverable\.id/)
})

test('internal Client Schedule details expose the linked script and shoot brief on demand', () => {
  assert.match(SCHEDULE, /View script and shoot details/)
  assert.match(SCHEDULE, /linkedVideo\.script/)
  assert.match(SCHEDULE, /linkedVideo\.shot_breakdown/)
  assert.match(SCHEDULE, /linkedVideo\.requirements/)
  assert.match(SCHEDULE, /linkedVideo\.visual_notes/)
})

test('parent table is staff-only and clients use the narrow RPC', () => {
  assert.match(MIGRATION, /alter table public\.content_guidelines enable row level security/)
  assert.match(MIGRATION, /content_guidelines: staff select/)
  assert.match(MIGRATION, /content_guidelines: staff insert/)
  assert.match(MIGRATION, /content_guidelines: staff update/)
  assert.doesNotMatch(MIGRATION, /content_guidelines: client/)
  assert.match(MIGRATION, /revoke all on table public\.content_guidelines from anon/)
})
test('explicit Calendar client links propagate to every canonical Content Run', () => {
  assert.match(PROPAGATION_MIGRATION, /create or replace function public\.sync_microsoft_content_run_event/)
  assert.doesNotMatch(PROPAGATION_MIGRATION, /new\.microsoft_event_id is null/)
  assert.match(PROPAGATION_MIGRATION, /client_id = new\.client_id/)
  assert.match(PROPAGATION_MIGRATION, /where calendar_event_id = new\.id/)
  assert.match(PROPAGATION_MIGRATION, /run\.client_id is null/)
  assert.match(PROPAGATION_MIGRATION, /event\.client_id is not null/)
  assert.doesNotMatch(PROPAGATION_MIGRATION, /insert into public\.clients/i)
  assert.doesNotMatch(PROPAGATION_MIGRATION, /monthly_deliverables/i)
})
