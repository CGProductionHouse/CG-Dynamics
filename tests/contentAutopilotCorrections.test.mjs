// #450 supervisor-correction pass: the seven blockers, proven where they live.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const MIGRATION = readFileSync('supabase/migrations/20260921140000_content_autopilot_corrections.sql', 'utf8')
const BASE_MIGRATION = readFileSync('supabase/migrations/20260921090000_content_production_autopilot.sql', 'utf8')
const ONEDRIVE = readFileSync('supabase/functions/content-run-onedrive-folder/index.ts', 'utf8')
const WORKER = readFileSync('supabase/functions/background-worker/index.ts', 'utf8')
const DATA = readFileSync('src/lib/contentReadinessData.ts', 'utf8')

// ── 1. Exact Microsoft event → Content Run ──────────────────────────────────

test('the run ensure path is exact-identity and refuses everything else', () => {
  const fn = MIGRATION.slice(MIGRATION.indexOf('function public.ensure_content_run_for_calendar_event'), MIGRATION.indexOf('comment on function public.ensure_content_run_for_calendar_event'))
  assert.match(fn, /where id = p_calendar_event_id/, 'identity is the durable calendar event row')
  assert.match(fn, /where r\.calendar_event_id = v_event\.id/, 'one run per event, idempotently')
  for (const refusal of [
    /event_type is distinct from 'content_run'/,
    /v_event\.client_id is null/,
    /v_event\.status = 'cancelled'/,
  ]) assert.match(fn, refusal)
  // Nothing may match on a title, and no client may be inferred.
  assert.doesNotMatch(fn, /ilike|similar to|like '%/i)
  assert.doesNotMatch(fn, /from public\.clients/, 'the client comes from the event, never a lookup by name')
})

test('the ensure path is service-role only', () => {
  assert.match(MIGRATION, /revoke all on function public\.ensure_content_run_for_calendar_event\(uuid\) from public, anon, authenticated/)
  assert.match(MIGRATION, /grant execute on function public\.ensure_content_run_for_calendar_event\(uuid\) to service_role/)
})

// ── 2. Latent, gated generation ─────────────────────────────────────────────

test('the cycle has an executable generation path that is off until CA enables it', () => {
  const block = WORKER.slice(WORKER.indexOf("case 'content_autopilot'"), WORKER.indexOf('default:', WORKER.indexOf("case 'content_autopilot'")))
  assert.match(block, /generationEnabled/)
  assert.match(block, /Deno\.env\.get\(GENERATION_FLAG\)/, 'activation is a project secret, not a code change')
  assert.match(block, /=== 'true'/, 'it is off unless explicitly switched on')
  assert.match(block, /suggest-content-videos/, 'it reuses the existing AI Content Director')
  assert.match(block, /recordContentAutopilotPass/, 'the pass is always recorded, success or failure')
})

// ── 3. Executable per-video folder create/map ───────────────────────────────

test('the per-video folder action creates only, maps existing by durable id, and blocks on a missing short code', () => {
  const action = ONEDRIVE.slice(ONEDRIVE.indexOf("if (action === 'ensure_video_folders')"), ONEDRIVE.indexOf('// link_month_folder | create_month_folder'))
  assert.ok(action.length > 500, 'the action exists')
  assert.match(action, /BLOCKED_MISSING_SHORT_CODE/)
  assert.match(action, /buildVideoFolderName\(/, 'the canonical builder names the folder')
  assert.match(action, /client\.short_code/, 'the configured short code is the only source')
  assert.match(action, /ensureCanonicalChildFolder\(/, 'creation goes through the create-only helper')
  assert.match(action, /body\.confirmCreate !== true/, 'creation needs an explicit confirmation')
  assert.match(action, /upsert_content_guide_video_folder/, 'the durable mapping is written')
  assert.match(action, /assertSameClient\(/, 'client isolation is re-proved')
  assert.match(action, /already_mapped/, 'a mapped video is left untouched')
  assert.match(action, /legacy_mapped/, 'an existing canonical folder is mapped, not duplicated')
  // Nothing destructive is expressible.
  assert.doesNotMatch(action, /\bdeleteItem\b|\brenameItem\b|\bmoveItem\b|conflictBehavior: 'replace'/)
  assert.doesNotMatch(action, /deriveClientCode/)
})

test('the mapping write stays admin-gated with exact run/client provenance', () => {
  const fn = BASE_MIGRATION.slice(BASE_MIGRATION.indexOf('function public.upsert_content_guide_video_folder'), BASE_MIGRATION.indexOf('revoke all on function public.upsert_content_guide_video_folder'))
  assert.match(fn, /p\.role = 'admin'/)
  assert.match(fn, /guideline\.content_run_id = p_content_run_id/)
  assert.match(fn, /guideline\.client_id = p_client_id/)
  const onedriveAction = ONEDRIVE.slice(ONEDRIVE.indexOf("if (action === 'ensure_video_folders')"))
  assert.ok(ONEDRIVE.includes('if (!canManage) return jsonResponse'), 'mapping writes stay behind the admin gate')
  assert.match(onedriveAction, /p_actor_id: user\.id/)
})

// ── 4. Safe same-client linking ─────────────────────────────────────────────

test('the link helper refuses cross-client, occupied and human-set links, and never writes the schedule', () => {
  const fn = MIGRATION.slice(MIGRATION.indexOf('function public.link_content_guide_video_deliverable'), MIGRATION.indexOf('comment on function public.link_content_guide_video_deliverable'))
  assert.match(fn, /v_deliverable_client <> v_video_client/, 'cross-client is refused')
  assert.match(fn, /if v_existing is not null then\s*\n\s*return false/, 'a link a human set is never moved')
  assert.match(fn, /v_type not in \('video', 'reel'\)/)
  assert.match(fn, /other\.deliverable_id = p_deliverable_id/, 'an occupied slot is never stolen')
  // The only write is the guideline video's own deliverable_id.
  const writes = fn.match(/update public\.\w+/g) ?? []
  assert.deepEqual(writes, ['update public.content_guide_ideas'])
})

// ── 5. Browser-safe per-video folder truth ──────────────────────────────────

test('staff read folder truth through a projection that carries no Graph identifiers', () => {
  const fn = MIGRATION.slice(MIGRATION.indexOf('function public.content_run_video_folder_states'), MIGRATION.indexOf('comment on function public.content_run_video_folder_states'))
  assert.match(fn, /is_active is true/, 'active staff only')
  assert.doesNotMatch(fn, /drive_id|folder_item_id/, 'no drive or item id is returned')
  assert.match(fn, /folder_name/, 'staff still get the canonical name they read')
  assert.match(MIGRATION, /grant execute on function public\.content_run_video_folder_states\(uuid\) to authenticated, service_role/)
  // The table itself stays revoked.
  assert.match(BASE_MIGRATION, /revoke all on public\.content_guide_video_onedrive_folders from anon, authenticated/)
  // And the browser no longer selects it directly.
  assert.doesNotMatch(DATA, /from\('content_guide_video_onedrive_folders'\)/)
  assert.match(DATA, /rpc\('content_run_video_folder_states'/)
})

// ── 6. Real final-output truth ──────────────────────────────────────────────

test('the browser reads real published portal assets, minimally', () => {
  assert.match(DATA, /from\('client_portal_assets'\)/)
  const select = DATA.match(/from\('client_portal_assets'\)\s*\n?\s*\.select\('([^']*)'\)/)[1]
  assert.deepEqual(select.split(',').map(part => part.trim()).sort(), ['active', 'content_guide_idea_id'])
  assert.match(DATA, /portalAssets: portalAssetsByRun\.get/, 'the result really reaches the projection')
  assert.match(DATA, /portalAssetsReadable/, 'an unreadable portal is unverified, not "not published"')
})

// ── 7. Truthful NO_FUTURE_CONTENT_RUN ───────────────────────────────────────

test('the browser considers every active client, not only those with runs', () => {
  const fetchFn = DATA.slice(DATA.indexOf('export async function fetchContentReadiness'))
  assert.match(fetchFn, /from\('clients'\)[\s\S]{0,120}\.eq\('active', true\)/)
  assert.match(fetchFn, /activeClients\.map\(client =>\s*\n?\s*buildClientReadiness/, 'the rollup covers every active client')
  // The early return for "no runs" still reports every client rather than an empty list.
  const earlyReturn = fetchFn.slice(fetchFn.indexOf('if (!runs.length)'), fetchFn.indexOf('const runIds'))
  assert.match(earlyReturn, /activeClients\.map/)
})

test('the pass distinguishes unprocessed and failed from genuinely no future run', () => {
  const source = readFileSync('supabase/functions/_shared/contentAutopilotPass.ts', 'utf8')
  assert.match(source, /clients_without_future_run/)
  assert.match(source, /clients_preparation_failed/)
  assert.match(source, /runs_unprocessed/)
  assert.match(source, /RUNS_UNPROCESSED_THIS_PASS/)
  // The no-future-run decision is made from a full scan, not from the processed slice.
  const decision = source.slice(source.indexOf('const clientsWithUpcomingRun'), source.indexOf('return {\n    ok: true'))
  assert.match(decision, /from\('content_runs'\)[\s\S]{0,300}\.select\('client_id'\)/)
  assert.doesNotMatch(decision, /summaries/, 'it never infers absence from what this pass had time to process')
})
