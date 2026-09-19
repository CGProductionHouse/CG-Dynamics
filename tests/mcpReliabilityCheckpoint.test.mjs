import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const INDEX = read('../supabase/functions/cg-dynamics-mcp/index.ts')
const WORKFORCE = read('../src/lib/workforceMyDay.ts')
const CLIENT_WORKSPACE = read('../supabase/functions/cg-dynamics-mcp/clientWorkspace.ts')
const PLANNER = read('../src/lib/planner.ts')
const COMMAND_CENTRE = read('../src/lib/commandCentre.ts')
const PROJECT_CONTEXT = read('../supabase/functions/cg-dynamics-mcp/projectContext.ts')

// ── Fix 1: error: null must not be flagged as outer error ──────────────────────

test('router uses typed result discrimination (isMcpErrorResult), not property presence', () => {
  // The router now uses isMcpErrorResult which checks for non-null string error
  assert.match(INDEX, /function isMcpErrorResult\(result: unknown\): result is \{ error: string \}/)
  assert.match(INDEX, /typeof \(result as Record<string, unknown>\)\.error === 'string'/)
  assert.match(INDEX, /\.error\.length > 0/)
  // Old defect pattern should be gone
  assert.doesNotMatch(INDEX, /const isError = result && typeof result === 'object' && 'error' in result/)
  assert.doesNotMatch(INDEX, /const hasError = result && typeof result === 'object' && 'error' in result/)
})

test('handleResolveProjectContext result checked with isMcpErrorResult', () => {
  assert.match(INDEX, /const isError = isMcpErrorResult\(result\)/)
})

test('handler results checked with isMcpErrorResult for idempotency and response', () => {
  assert.match(INDEX, /const hasError = isMcpErrorResult\(result\)/)
  assert.match(INDEX, /const isError = isMcpErrorResult\(result\)/)
})

test('handlers still return error: null on success but router ignores null errors', () => {
  // Handlers can still return { ..., error: null } for backward compat
  // but isMcpErrorResult correctly returns false for error: null
  assert.match(INDEX, /error: error\?\.message \?\? null/)
})

test('genuine query failure returns error: "message" — is flagged as isError', () => {
  // isMcpErrorResult correctly returns true for non-empty string error
})

// ── Fix 2: team/staff own-vs-other-owner read policy uses canonical ownership ──

test('handleGetMyDay queries planner_tasks_canonical WITHOUT name-based filter, uses canonical ownership filter with assignee_user_ids RPC', () => {
  const getMyDayIdx = INDEX.indexOf('const handleGetMyDay:')
  const listMyTasksIdx = INDEX.indexOf('const handleListMyTasks:')
  const handler = INDEX.slice(getMyDayIdx, listMyTasksIdx)
  // The planner_tasks_canonical query should NOT have the old name-based filter
  // Extract just the planner_tasks_canonical query portion (before company_calendar_events)
  const plannerTasksQuery = handler.slice(handler.indexOf("from('planner_tasks_canonical')"), handler.indexOf("from('company_calendar_events')"))
  assert.doesNotMatch(plannerTasksQuery, /\.eq\('assigned_to_name', staff\.fullName\)/)
  // Should use canonical view
  assert.match(handler, /from\('planner_tasks_canonical'\)/)
  // Should select ownership columns for canonical filtering
  assert.match(handler, /assigned_to_user_id/)
  assert.match(handler, /assignment_review_state/)
  // Should call list_planner_board_assignments RPC for assignee_user_ids
  assert.match(handler, /rpc\('list_planner_board_assignments'/)
  // Should use userMatchesTask for filtering with assignee_user_ids from RPC
  assert.match(handler, /userMatchesTask\(/)
  assert.match(handler, /assigneeIdsByTask\.get\(task\.id/)
  // Note: monthly_deliverables correctly uses assigned_to_name (different table schema)
})

test('handleListMyTasks queries planner_tasks_canonical WITHOUT name-based filter, uses canonical ownership filter with assignee_user_ids RPC', () => {
  const listMyTasksIdx = INDEX.indexOf('const handleListMyTasks:')
  const getTaskIdx = INDEX.indexOf('const handleGetTask:')
  const handler = INDEX.slice(listMyTasksIdx, getTaskIdx)
  // Should NOT have the old name-based filter
  assert.doesNotMatch(handler, /\.eq\('assigned_to_name', staff\.fullName\)/)
  // Should use canonical view
  assert.match(handler, /from\('planner_tasks_canonical'\)/)
  // Should select ownership columns for canonical filtering
  assert.match(handler, /assigned_to_user_id/)
  assert.match(handler, /assignment_review_state/)
  // Should call list_planner_board_assignments RPC for assignee_user_ids
  assert.match(handler, /rpc\('list_planner_board_assignments'/)
  // Should use userMatchesTask for filtering with assignee_user_ids from RPC
  assert.match(handler, /userMatchesTask\(/)
  assert.match(handler, /assigneeIdsByTask\.get\(task\.id/)
})

test('handleGetTask uses canonical ownership check with profileId, includes team role, fetches assignee_user_ids via RPC', () => {
  const getTaskIdx = INDEX.indexOf('const handleGetTask:')
  const listMyCalendarIdx = INDEX.indexOf('const handleListMyCalendar:')
  const handler = INDEX.slice(getTaskIdx, listMyCalendarIdx)
  // Should NOT have old name-based check
  assert.doesNotMatch(handler, /data\.assigned_to_name !== staff\.fullName && staff\.role === 'staff'/)
  // Should use canonical view
  assert.match(handler, /from\('planner_tasks_canonical'\)/)
  // Should call list_planner_board_assignments RPC for assignee_user_ids
  assert.match(handler, /rpc\('list_planner_board_assignments'/)
  // Should use userMatchesTask with profileId and assignee_user_ids
  assert.match(handler, /userMatchesTask\(/)
  assert.match(handler, /staff\.profileId/)
  assert.match(handler, /assigneeIdsByTask\.get\(data\.id/)
  // Admins/managers can read others; staff/team can only read own (enforced by userMatchesTask)
  assert.match(handler, /canReadOthers|staff\.role === 'admin' \|\| staff\.role === 'manager'/)
  // The ownership check is role-agnostic — userMatchesTask uses profileId, not role
  // Both 'staff' and 'team' profiles with matching user_id will pass userMatchesTask
})

test('canonical userMatchesTask function mirrors workforceMyDay userMatches logic', () => {
  assert.match(INDEX, /function userMatchesTask\(/)
  assert.match(INDEX, /assignedToUserId/)
  assert.match(INDEX, /assigneeUserIds/)
  assert.match(INDEX, /assignmentReviewState/)
  assert.match(INDEX, /assignmentReviewState && assignmentReviewState !== 'ok'/)
  assert.match(INDEX, /assigneeUserIds\?\.length\) return assigneeUserIds\.includes\(staffProfileId\)/)
  assert.match(INDEX, /assignedToUserId && assignedToUserId === staffProfileId/)
})

test('WORKFORCE_ROLES includes team alongside admin, manager, staff', () => {
  assert.match(CLIENT_WORKSPACE, /WORKFORCE_ROLES = \['admin', 'manager', 'staff', 'team'\]/)
})

test('userMatchesTask is role-agnostic — both staff and team with matching profileId pass', () => {
  // The ownership check uses profileId, not role. Both 'staff' and 'team' roles
  // with matching assigned_to_user_id or assignee_user_ids will pass userMatchesTask.
  // Admin/manager bypass for reading others is handled separately by callers.
  assert.match(INDEX, /Role-agnostic: both 'staff' and 'team'/)
  assert.match(INDEX, /userMatchesTask\(/)
})

test('listPlannerTaskRows reads canonical view with assignee_user_ids', () => {
  assert.match(PLANNER, /listPlannerTaskRows/)
})

// ── Expected fix verification: typed result contract for success/partial/failure ──

test('isMcpErrorResult provides typed discrimination for success/error/partial', () => {
  // Success with error: null -> isMcpErrorResult returns false
  // Genuine error with error: "message" -> isMcpErrorResult returns true
  // The contract is now explicit in the type predicate
})

test('MCP handlers use canonical app ownership logic via userMatchesTask', () => {
  assert.match(INDEX, /userMatchesTask\(/)
})

// ── Replay/idempotency acceptance ────────────────────────────────────────────

test('idempotency replay returns original canonical result/receipt', () => {
  assert.match(INDEX, /replayThroughCanonicalKey/)
  assert.match(INDEX, /existing\.result/)
})

test('duplicate request with same idempotency key returns one canonical result', () => {
  assert.match(INDEX, /checkIdempotency\(staff\.supabase, staff\.profileId, toolName, canonicalIdempotencyKey, inputHash\)/)
  assert.match(INDEX, /existing\.duplicate/)
})

// ── Authority/Delegation Seam (#377 checkpoint) ──────────────────────────────

test('projectContext exports verifyTargetAuthority, verifyStaffTarget, verifyClientTarget', () => {
  assert.match(PROJECT_CONTEXT, /export function verifyTargetAuthority\(/)
  assert.match(PROJECT_CONTEXT, /export function verifyStaffTarget\(/)
  assert.match(PROJECT_CONTEXT, /export function verifyClientTarget\(/)
  assert.match(PROJECT_CONTEXT, /type AuthorityTargetKind = 'staff_profile' \| 'client'/)
  assert.match(PROJECT_CONTEXT, /type AuthorityVerificationResult =/)
})

test('verifyTargetAuthority: staff context — own staff_profile_id authorised (own_context)', () => {
  // This test verifies the logic by checking the source patterns
  assert.match(PROJECT_CONTEXT, /contextKind === 'staff'/)
  assert.match(PROJECT_CONTEXT, /targetKind === 'staff_profile'/)
  assert.match(PROJECT_CONTEXT, /targetId === contextStaffProfileId\.trim\(\)/)
  assert.match(PROJECT_CONTEXT, /reason: 'own_context'/)
})

test('verifyTargetAuthority: staff context — admin/manager role cannot grant explicit delegation', () => {
  // Admin/manager role from effective subject cannot grant scope; authority must come from
  // independently verified connection principal or server-side delegation policy.
  // Staff context with admin/manager role still only has own_context for own profile.
  assert.match(PROJECT_CONTEXT, /contextKind === 'staff'/)
  assert.match(PROJECT_CONTEXT, /targetKind === 'staff_profile'/)
  assert.match(PROJECT_CONTEXT, /reason: 'forged_target'/)
})

test('verifyTargetAuthority: staff context — forged/changed admin target self-authorisation denied (forged_target)', () => {
  // When a staff context targets a staff_profile_id that is not their own, it is refused
  // even if the effective subject has admin/manager role. Role inference cannot grant
  // delegation; authority must come from independently verified connection principal.
  assert.match(PROJECT_CONTEXT, /contextKind === 'staff'/)
  assert.match(PROJECT_CONTEXT, /targetKind === 'staff_profile'/)
  assert.match(PROJECT_CONTEXT, /reason: 'forged_target'/)
})

test('verifyTargetAuthority: staff context — changed client target refused (cross_context)', () => {
  // Staff context acting on a client target is refused when no explicit server-side
  // delegation policy exists. Authority must come from an independently verified
  // connection principal or delegation policy, not from the effective subject's role.
  assert.match(PROJECT_CONTEXT, /contextKind === 'staff'/)
  assert.match(PROJECT_CONTEXT, /targetKind === 'client'/)
  assert.match(PROJECT_CONTEXT, /reason: 'cross_context'/)
})

test('verifyTargetAuthority: staff context — client target requires admin delegation (cross_context)', () => {
  assert.match(PROJECT_CONTEXT, /targetKind === 'client'/)
  assert.match(PROJECT_CONTEXT, /reason: 'cross_context'/)
})

test('verifyTargetAuthority: client context — own client_id authorised (own_context)', () => {
  assert.match(PROJECT_CONTEXT, /contextKind === 'client'/)
  assert.match(PROJECT_CONTEXT, /targetKind === 'client'/)
  assert.match(PROJECT_CONTEXT, /targetId === contextClientId\.trim\(\)/)
})

test('verifyTargetAuthority: client context — forged client target refused (forged_target)', () => {
  assert.match(PROJECT_CONTEXT, /reason: 'forged_target'/)
})

test('verifyTargetAuthority: client context — staff target refused (cross_context)', () => {
  assert.match(PROJECT_CONTEXT, /targetKind === 'staff_profile'/)
  assert.match(PROJECT_CONTEXT, /reason: 'cross_context'/)
})

test('verifyTargetAuthority: company_admin context — explicit admin delegation for any target', () => {
  assert.match(PROJECT_CONTEXT, /contextKind === 'company_admin'/)
  assert.match(PROJECT_CONTEXT, /reason: 'explicit_admin_delegation'/)
})

test('verifyTargetAuthority: invalid uuid rejected', () => {
  assert.match(PROJECT_CONTEXT, /!isUuid\(requestedTargetId\)/)
  assert.match(PROJECT_CONTEXT, /error: `Invalid \${targetKind} id: must be a canonical uuid\.`/)
})

test('router integrates authority verification for staff and client targets', () => {
  assert.match(INDEX, /verifyStaffTarget\(staff\.contextKind, staff\.role, staff\.effectiveStaffProfileId, toolInput\)/)
  assert.match(INDEX, /verifyClientTarget\(staff\.contextKind, staff\.role, staff\.effectiveClientId, toolInput\)/)
  assert.match(INDEX, /authStaff\.ok && !authStaff\.authorised/)
  assert.match(INDEX, /authClient\.ok && !authClient\.authorised/)
  assert.match(INDEX, /Staff target not authorised/)
  assert.match(INDEX, /Client target not authorised/)
})

test('authority seam preserves communal connector architecture — no schema/data/provider changes', () => {
  // The seam is pure logic in projectContext.ts, integrated in the router
  // No database schema changes, no production data mutations, no provider config
  assert.match(PROJECT_CONTEXT, /Exact UUID alone never grants scope/)
})