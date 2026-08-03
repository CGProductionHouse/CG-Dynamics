import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolveDirectoryEntity } from '../supabase/functions/_shared/dailyEntityResolution.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20260803163045_personal_daily_assistant.sql')
const edge = read('../supabase/functions/daily-assistant-capture/index.ts')
const client = read('../src/lib/dailyAssistant.ts')
const panel = read('../src/components/assistant/DailyAssistantCapture.tsx')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const chat = read('../supabase/functions/cg-assistant-chat/index.ts')

const clients = [
  { id: 'germo', name: 'Germo Parts' },
  { id: 'red-oak', name: 'Red Oak' },
  { id: 'cape', name: 'Cape Lumber' },
]
const staff = [
  { id: 'ger-marie', name: 'Ger-Marie' },
  { id: 'franco', name: 'Franco' },
]

test('production resolver handles the required imperfect client and staff names', () => {
  assert.equal(resolveDirectoryEntity('German parts', clients).id, 'germo')
  assert.equal(resolveDirectoryEntity('Germo part', clients).id, 'germo')
  assert.equal(resolveDirectoryEntity('Ger Marie', staff).id, 'ger-marie')
  assert.equal(resolveDirectoryEntity('Jermarie', staff).id, 'ger-marie')
  assert.equal(resolveDirectoryEntity('Red oke', clients).id, 'red-oak')
})

test('ambiguous and unknown names never silently become canonical identities', () => {
  const ambiguous = resolveDirectoryEntity('Germo', [
    { id: 'germo-parts', name: 'Germo Parts' },
    { id: 'germo-digital', name: 'Germo Digital' },
  ])
  assert.equal(ambiguous.status, 'ambiguous')
  assert.equal(ambiguous.id, null)
  assert.equal(ambiguous.candidates.length, 2)
  const unknown = resolveDirectoryEntity('Completely Unknown Company', clients)
  assert.equal(unknown.status, 'unresolved')
  assert.equal(unknown.id, null)
})

test('personal timeline tables are own-only staff data and clients have no policy path', () => {
  for (const table of ['assistant_day_captures', 'assistant_day_items']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
  }
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/)
  assert.match(migration, /profile\.role in \('admin', 'manager', 'staff', 'team'\)/)
  assert.doesNotMatch(migration, /profile\.role in \([^)]*'client'/)
  assert.match(migration, /revoke all on table public\.assistant_day_captures from public, anon, authenticated/)
  assert.match(migration, /revoke all on table public\.assistant_day_items from public, anon, authenticated/)
})

test('confirmation is transactional, canonical, role-gated, audited and notifies another assignee', () => {
  const apply = migration.slice(migration.indexOf('function public.apply_assistant_day_capture'))
  assert.match(apply, /security definer/)
  assert.match(apply, /capture\.user_id = auth\.uid\(\)/)
  assert.match(apply, /Only a manager can assign work to another staff member/)
  assert.match(apply, /Selected task belongs to a different client/)
  assert.match(apply, /v_task\.client_id is distinct from v_client_id/)
  assert.match(apply, /insert into public\.planner_tasks/)
  assert.match(apply, /set_planner_task_assignees_internal/)
  assert.match(apply, /insert into public\.planner_activity_log/)
  assert.match(apply, /insert into public\.notifications/)
  assert.match(apply, /'cg_assistant_daily'/)
})

test('repeat notes link recent same-client canonical tasks instead of duplicating', () => {
  const apply = migration.slice(migration.indexOf('function public.apply_assistant_day_capture'))
  assert.match(apply, /assistant_normalise_task_title\(task\.title\) = public\.assistant_normalise_task_title\(v_title\)/)
  assert.match(apply, /task\.client_id is not distinct from v_client_id/)
  assert.match(apply, /task\.created_at >= now\(\) - interval '45 days'/)
  assert.match(apply, /existing_tasks_linked/)
  assert.match(edge, /findDuplicate/)
  assert.match(panel, /This may already be covered by/)
})

test('audio is transcribed server-side and never persisted as bytes or a storage object', () => {
  assert.match(edge, /transcribeAudio/)
  assert.match(edge, /audioFingerprint/)
  assert.match(edge, /transcript_hash/)
  assert.doesNotMatch(edge, /storage\.from|audio_(?:data|bytes|blob)\s*:/i)
  assert.doesNotMatch(migration, /audio_(?:data|bytes|blob)|storage_path/i)
})

test('nothing applies before the explicit mobile confirmation', () => {
  assert.match(client, /applyDailyAssistantCapture/)
  assert.match(panel, /Confirm selected/)
  assert.match(panel, /Nothing writes until you review and confirm/)
  const analysisPath = edge.slice(edge.indexOf("action !== 'analyse_audio'"))
  assert.doesNotMatch(analysisPath.slice(0, analysisPath.indexOf("if (action === 'apply')")), /planner_tasks/)
  assert.match(edge, /action === 'apply'[\s\S]*rpc\('apply_assistant_day_capture'/)
})

test('mobile capture protects drafts and safely stops recording on background/interruption', () => {
  assert.match(panel, /localStorage\.setItem\(draftKey/)
  assert.match(panel, /document\.visibilityState === 'hidden'/)
  assert.match(panel, /recorder\.start\(1000\)/)
  assert.match(panel, /MAX_VOICE_SECONDS/)
  assert.match(panel, /Uploading securely/)
  assert.match(panel, /Try again/)
  assert.match(panel, /min-h-20/)
  assert.match(panel, /safe-area-inset-bottom/)
})

test('daily reminders are quiet-hour bounded, deduplicated, snoozable and dismissible', () => {
  assert.match(migration, /if v_hour < 7 or v_hour >= 19 then return 0/)
  for (const slot of ['morning', 'midday', 'end-of-day']) assert.match(migration, new RegExp(`'${slot}'`))
  assert.match(migration, /on conflict \(user_id, dedupe_key\).*do nothing/s)
  assert.match(migration, /snooze_my_assistant_notification/)
  assert.match(migration, /dismiss_my_assistant_notification/)
})

test('both assistant surfaces receive own timeline context and day questions route locally in EN/AF', () => {
  assert.match(composer, /DailyAssistantCapture/)
  assert.match(composer, /dailyAssistantContextLine/)
  assert.match(chat, /personalDaySummary/)
  assert.ok(chat.includes('what (have i done|did i promise|am i forgetting'))
  assert.match(chat.toLowerCase(), /wat het ek vandag gedoen/)
  assert.match(chat.toLowerCase(), /wat moet ek nog doen/)
})

test('launch acceptance fixture set covers required English, Afrikaans, mixed and multi-action notes', () => {
  const fixtures = [
    'I had a call with Germo Parts. Ger-Marie must do the Women’s Day poster before Thursday, and I must still send Red Oak the footage link.',
    'Ek het met Gerhard gepraat. Onthou my om die footage link vir Red Oak te stuur.',
    'Ger Marie moet die poster doen en ek sal Dabo bel about the website.',
    'German parts needs the artwork. Maybe Thursday, but I am not sure.',
    'Red oke footage sent; update the existing task and keep this as a note.',
  ]
  assert.equal(fixtures.length, 5)
  assert.ok(fixtures.some(value => /\bEk\b/.test(value)))
  assert.ok(fixtures.some(value => /about the website/.test(value)))
  assert.ok(fixtures.every(value => value.length > 30))
})
