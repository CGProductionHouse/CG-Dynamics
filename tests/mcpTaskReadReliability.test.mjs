import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { after } from 'node:test'
import { createServer } from 'vite'

process.env.VITE_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= 'test-publishable-key'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(async () => { await server.close() })
const policy = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/taskReadPolicy.ts')
const index = readFileSync(new URL('../supabase/functions/cg-dynamics-mcp/index.ts', import.meta.url), 'utf8')

test('verified ownership is exact-profile, review-safe, and role agnostic for staff/team', () => {
  const task = { assignment_review_state: 'ok' }
  assert.equal(policy.isVerifiedPlannerTaskOwner(task, ['profile-a'], 'profile-a'), true)
  assert.equal(policy.canReadPlannerTask(task, ['profile-a'], 'profile-a', 'staff'), true)
  assert.equal(policy.canReadPlannerTask(task, ['profile-a'], 'profile-a', 'team'), true)
  assert.equal(policy.canReadPlannerTask(task, ['profile-a'], 'profile-b', 'staff'), false)
  assert.equal(policy.canReadPlannerTask({ assignment_review_state: 'conflict' }, ['profile-a'], 'profile-a', 'staff'), false)
})

test('admin and manager retain deliberate company-wide task read authority', () => {
  const task = { assignment_review_state: 'conflict' }
  assert.equal(policy.canReadPlannerTask(task, [], 'admin-profile', 'admin'), true)
  assert.equal(policy.canReadPlannerTask(task, [], 'manager-profile', 'manager'), true)
})

test('MCP personal task reads use canonical assignment IDs, not display-name matching', () => {
  const myDay = index.slice(index.indexOf('const handleGetMyDay'), index.indexOf('const handleListMyTasks'))
  const myTasks = index.slice(index.indexOf('const handleListMyTasks'), index.indexOf('const handleGetTask'))
  const oneTask = index.slice(index.indexOf('const handleGetTask'), index.indexOf('const handleListMyCalendar'))
  for (const source of [myDay, myTasks]) {
    assert.match(source, /listOwnedPlannerTasks/)
  }
  const taskReadHelper = index.slice(index.indexOf('async function listOwnedPlannerTasks'), index.indexOf('const handleGetMyDay'))
  assert.doesNotMatch(taskReadHelper, /eq\('assigned_to_name'/)
  assert.match(index, /from\('planner_task_assignees'\)[\s\S]*eq\('profile_id', staff\.profileId\)/)
  assert.match(index, /from\('planner_tasks_canonical'\)/)
  assert.match(oneTask, /canReadPlannerTask/)
  assert.doesNotMatch(oneTask, /assigned_to_name !== staff\.fullName/)
})

test('successful nullable error fields are not promoted to MCP errors', () => {
  assert.match(index, /function isMcpErrorResult\(result: unknown\)/)
  assert.match(index, /typeof \(result as Record<string, unknown>\)\.error === 'string'/)
  assert.equal((index.match(/isMcpErrorResult\(result\)/g) ?? []).length, 3)
  assert.doesNotMatch(index, /const (?:isError|hasError) = result && typeof result === 'object' && 'error' in result/)
})

test('personal task reads paginate and include undated active work without a silent cap', () => {
  assert.match(index, /fetchAllRows/)
  assert.match(index, /due_date\.is\.null,due_date\.lte\.\$\{tomorrow\}/)
  const helper = index.slice(index.indexOf('async function listOwnedPlannerTasks'), index.indexOf('const handleGetMyDay'))
  assert.match(helper, /\.range\(from, to\)/)
  assert.doesNotMatch(helper, /\.limit\(/)
})
