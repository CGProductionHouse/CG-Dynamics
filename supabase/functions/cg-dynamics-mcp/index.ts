// cg-dynamics-mcp — Private authenticated MCP connector for ChatGPT ↔ CG Dynamics.
//
// Streamable HTTP MCP endpoint. POST /mcp with JSON-RPC 2.0.
// Authentication: Bearer token resolved to one exact active CG staff profile.
// Never exposes SQL, raw tables, service keys, cross-client fallbacks, or destructive actions.
//
// Tool catalog: supabase/functions/cg-dynamics-mcp/toolCatalog.ts
// Idempotency: mcp_idempotency_log via mcp_check_idempotency / mcp_record_idempotency RPCs.
// Canonical services: same RPCs and tables used by CG Dynamics UI and #208 CG Assistant.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CG_DYNAMICS_MCP_TOOLS, CG_DYNAMICS_MCP_SECURITY_SCHEMES } from './toolCatalog.ts'
import { filterCapabilitiesByScope } from './capabilityManifest.ts'
import {
  inspectExactOneDriveFolder,
  unavailableOneDriveEvidence,
  validateExactContentRunFolderMapping,
  validateExactFolderMetadata,
  type OneDriveInspectionEvidence,
  type OneDriveReadAdapter,
} from './oneDriveFolderVerification.ts'
import {
  buildProtectedResourceMetadata,
  buildWwwAuthenticateChallenge,
  deriveMcpOAuthUrls,
  isProtectedResourceMetadataRequest,
  buildMcpAuthChallengeMeta,
  type McpAuthChallengeError,
} from './oauthDiscovery.ts'
import { cgDate, cgDatePlusDays, CG_TIMEZONE } from './cgTime.ts'
import {
  classifyOneDriveReadiness,
  gradeSyncRun,
  planGuidelineVideoLinks,
  summarizeProviderHealth,
} from './opsActions.ts'
import {
  buildStaffAssistantPolicy,
  STAFF_ASSISTANT_POLICY_VERSION,
  STAFF_ASSISTANT_POLICY_EFFECTIVE_AT,
} from './coexistencePolicy.ts'
import {
  buildDailyUpdateContract,
  ASSISTANT_PRESENTATION_VERSION,
} from './assistantPresentationPolicy.ts'
import {
  CALENDAR_MICROSOFT_FIELDS,
  PLANNER_MICROSOFT_FIELDS,
  summarizeSyncHealth,
  withSourceLinkage,
} from './microsoftSourceFields.ts'
import {
  CLIENT_SCHEDULE_SELECT,
  MY_DAY_DELIVERABLE_SELECT,
  flattenDeliverableClient,
} from './clientScheduleRows.ts'
import {
  assertRecordClientMatchesContext,
  assertToolAllowedInContext,
  buildAuditEnvelope,
  CONTEXT_BOOTSTRAP_TOOL,
  isUuid,
  parseProjectContext,
  resolveClientScopeForInput,
  type ContextAuditEnvelope,
  type ParsedProjectContext,
  type ProjectContextKind,
} from './projectContext.ts'

const STAFF_ROLES = new Set(['admin', 'manager', 'staff', 'team'])
const MCP_PROTOCOL_VERSION = '2025-03-26'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  // GET is allowed for the public OAuth discovery document; MCP tool calls are POST.
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  // Let browser clients read the OAuth challenge on a 401.
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
  'Content-Type': 'application/json',
}

// RFC 6750 `WWW-Authenticate` challenge headers pointing an unauthenticated caller at the
// Protected Resource Metadata document. Falls back to the plain CORS headers if the
// project origin is unavailable (never guessed).
function challengeHeaders(opts?: { error?: string; errorDescription?: string }): HeadersInit {
  const urls = deriveMcpOAuthUrls(Deno.env.get('SUPABASE_URL'))
  if (!urls) return corsHeaders
  return {
    ...corsHeaders,
    'WWW-Authenticate': buildWwwAuthenticateChallenge(urls.protectedResourceMetadataUrl, opts),
  }
}

// 401 with an OAuth Bearer challenge so ChatGPT can discover how to authenticate.
function unauthorizedResponse(message: string, opts?: { error?: string; errorDescription?: string }) {
  return new Response(JSON.stringify({ error: message }), { status: 401, headers: challengeHeaders(opts) })
}

/**
 * MCP tool error result for a rejected tool call, carrying `_meta["mcp/www_authenticate"]`
 * per current OpenAI Plugins auth docs so ChatGPT shows the account-linking UI. Contains no
 * token, key or internal detail — only the public PRM URL and a clear description.
 */
function authChallengeToolResult(challenge: { error: McpAuthChallengeError; description: string }) {
  const urls = deriveMcpOAuthUrls(Deno.env.get('SUPABASE_URL'))
  return {
    content: [{ type: 'text', text: `Authentication required. ${challenge.description}` }],
    isError: true,
    ...(urls
      ? { _meta: buildMcpAuthChallengeMeta(urls.protectedResourceMetadataUrl, challenge.error, challenge.description) }
      : {}),
  }
}

function authChallengeResponse(
  id: string | number | null,
  challenge: AuthChallenge,
  transportResponse: Response,
) {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id,
    result: authChallengeToolResult(challenge),
  }), {
    status: transportResponse.status,
    headers: transportResponse.headers,
  })
}

function jsonRpcResponse(id: string | number | null, result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), { status: 200, headers: corsHeaders })
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } }), { status: 200, headers: corsHeaders })
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders })
}

// ── Auth ────────────────────────────────────────────────────────────────────

// The communal ChatGPT account holds ONE OAuth connection, signed in as the company admin.
// That principal proves the connector is authorised — it is NOT the staff identity. See
// projectContext.ts for the connection-principal vs operating-context split (#319).
interface ConnectionPrincipal {
  userId: string
  profileId: string
  fullName: string | null
  role: string
  /**
   * The caller's validated bearer token. Retained ONLY so company-admin actions can delegate
   * to the existing durable Edge Functions (microsoft-transition-sync, provider
   * connection-status/sync) as the same authenticated admin, instead of duplicating those
   * engines here. Never logged, never returned in any tool result.
   */
  accessToken: string
}

// Handed to every tool handler. `profileId` / `fullName` / `role` are the EFFECTIVE Project
// subject (Franco in Franco's Project), never the shared OAuth principal, so existing
// handlers act for the right person unchanged. `connection` is kept alongside for audit.
interface AuthenticatedStaff {
  supabase: ReturnType<typeof createClient>
  profileId: string
  fullName: string | null
  role: string
  isActive: boolean
  contextKind: ProjectContextKind
  effectiveStaffProfileId: string | null
  effectiveClientId: string | null
  effectiveClientName: string | null
  connection: ConnectionPrincipal
}

interface AuthChallenge {
  error: McpAuthChallengeError
  description: string
}

async function authenticateStaff(request: Request): Promise<{ ok: true; connection: ConnectionPrincipal; supabase: ReturnType<typeof createClient> } | { ok: false; response: Response; challenge?: AuthChallenge }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, response: jsonResponse({ error: 'Server configuration error.' }, 500) }
  }

  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '')
  if (!match?.[1]) {
    return {
      ok: false,
      response: unauthorizedResponse('Authentication required.'),
      challenge: { error: 'invalid_token', description: 'Sign in to CG Dynamics to use this action.' },
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(match[1])
  if (authError || !user) {
    return {
      ok: false,
      response: unauthorizedResponse('Invalid or expired token.', { error: 'invalid_token', errorDescription: 'The bearer token is invalid or expired.' }),
      challenge: { error: 'invalid_token', description: 'The CG Dynamics connection has expired. Reconnect to continue.' },
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false, response: jsonResponse({ error: 'Authorization check unavailable.' }, 503) }
  }
  if (!profile || !STAFF_ROLES.has(profile.role) || profile.is_active !== true) {
    return {
      ok: false,
      response: jsonResponse({ error: 'Active staff access required.' }, 403),
      challenge: { error: 'insufficient_scope', description: 'The connected CG Dynamics account is not an active staff member.' },
    }
  }

  return {
    ok: true,
    supabase,
    connection: {
      userId: user.id,
      profileId: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      accessToken: match[1],
    },
  }
}

// ── Operating context (#319) ────────────────────────────────────────────────

const ADMIN_CONTEXT_ROLES = new Set(['admin', 'manager'])

/**
 * Resolve the per-call Project context against canonical Dynamics records. Exact IDs only,
 * active records only, fail closed. The shared admin OAuth principal never widens scope by
 * itself — a staff Project acts as that exact staff member, a client Project is pinned to
 * that exact client, and company_admin must be asked for explicitly.
 */
async function resolveOperatingContext(
  supabase: ReturnType<typeof createClient>,
  connection: ConnectionPrincipal,
  context: ParsedProjectContext,
): Promise<{ ok: true; staff: AuthenticatedStaff } | { ok: false; error: string }> {
  const base = {
    supabase,
    contextKind: context.contextKind,
    effectiveStaffProfileId: context.staffProfileId,
    effectiveClientId: context.clientId,
    effectiveClientName: null as string | null,
    connection,
  }

  if (context.contextKind === 'staff') {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', context.staffProfileId)
      .maybeSingle()
    if (error) return { ok: false, error: 'Staff context lookup unavailable.' }
    if (!profile) return { ok: false, error: 'No canonical staff profile matches that exact staff_profile_id.' }
    if (!STAFF_ROLES.has(profile.role) || profile.is_active !== true) {
      return { ok: false, error: 'That staff profile is not an active CG staff member.' }
    }
    return {
      ok: true,
      staff: { ...base, profileId: profile.id, fullName: profile.full_name, role: profile.role, isActive: true },
    }
  }

  if (context.contextKind === 'client') {
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, active')
      .eq('id', context.clientId)
      .maybeSingle()
    if (error) return { ok: false, error: 'Client context lookup unavailable.' }
    if (!client) return { ok: false, error: 'No canonical client matches that exact client_id.' }
    if (!client.active) return { ok: false, error: 'That client is not active.' }
    // A client Project has no staff subject. The communal connection principal is the
    // recorded actor for idempotency/audit; staff-subject tools are refused outright.
    return {
      ok: true,
      staff: {
        ...base,
        effectiveClientName: client.name,
        profileId: connection.profileId,
        fullName: connection.fullName,
        role: connection.role,
        isActive: true,
      },
    }
  }

  // company_admin — must be explicitly requested AND the connection principal must actually
  // hold an admin/manager role. Never inferred.
  if (!ADMIN_CONTEXT_ROLES.has(connection.role)) {
    return { ok: false, error: 'company_admin context requires the connected account to hold an admin or manager role.' }
  }
  return {
    ok: true,
    staff: { ...base, profileId: connection.profileId, fullName: connection.fullName, role: connection.role, isActive: true },
  }
}

/**
 * Bootstrap helper for a fresh Project chat: resolve an exact canonical Project context and
 * echo it back so the Project can carry it on every later call. Accepts an exact uuid, or an
 * EXACT-equality name that matches exactly one active canonical record. Never fuzzy-matches,
 * never guesses, and stores nothing server-side.
 */
async function handleResolveProjectContext(
  supabase: ReturnType<typeof createClient>,
  connection: ConnectionPrincipal,
  input: Record<string, unknown>,
) {
  const kind = input.context_kind
  if (kind === 'company_admin') {
    if (!ADMIN_CONTEXT_ROLES.has(connection.role)) {
      return { error: 'company_admin context requires the connected account to hold an admin or manager role.' }
    }
    return {
      resolved_context: { context_kind: 'company_admin' },
      display: { label: connection.fullName ?? 'CG Production House', role: connection.role },
      usage: 'Pass this exact context object on every subsequent tool call in this Project.',
    }
  }

  if (kind === 'staff') {
    let query = supabase.from('profiles').select('id, full_name, role, is_active')
    if (isUuid(input.staff_profile_id)) {
      query = query.eq('id', (input.staff_profile_id as string).trim())
    } else if (typeof input.staff_full_name === 'string' && input.staff_full_name.trim()) {
      // Exact equality only — no ILIKE, no partial, no fuzzy.
      query = query.eq('full_name', input.staff_full_name.trim())
    } else {
      return { error: 'Provide an exact staff_profile_id (uuid) or an exact staff_full_name.' }
    }
    const { data, error } = await query.eq('is_active', true).limit(5)
    if (error) return { error: 'Staff context lookup unavailable.' }
    const matches = (data ?? []).filter((p: { role: string }) => STAFF_ROLES.has(p.role))
    if (matches.length === 0) return { error: 'No exact active CG staff profile matched. Supply the exact canonical staff_profile_id.' }
    if (matches.length > 1) return { error: 'That name matched more than one active staff profile. Supply the exact canonical staff_profile_id.' }
    const profile = matches[0] as { id: string; full_name: string | null; role: string }
    return {
      resolved_context: { context_kind: 'staff', staff_profile_id: profile.id },
      display: { label: profile.full_name, role: profile.role },
      usage: 'Pass this exact context object on every subsequent tool call in this Project.',
    }
  }

  if (kind === 'client') {
    let query = supabase.from('clients').select('id, name, active')
    if (isUuid(input.client_id)) {
      query = query.eq('id', (input.client_id as string).trim())
    } else if (typeof input.client_name === 'string' && input.client_name.trim()) {
      query = query.eq('name', input.client_name.trim())
    } else {
      return { error: 'Provide an exact client_id (uuid) or an exact client_name.' }
    }
    const { data, error } = await query.eq('active', true).limit(5)
    if (error) return { error: 'Client context lookup unavailable.' }
    const matches = data ?? []
    if (matches.length === 0) return { error: 'No exact active client matched. Supply the exact canonical client_id. Client names are never fuzzy-matched.' }
    if (matches.length > 1) return { error: 'That name matched more than one active client. Supply the exact canonical client_id.' }
    const client = matches[0] as { id: string; name: string }
    return {
      resolved_context: { context_kind: 'client', client_id: client.id },
      display: { label: client.name },
      usage: 'Pass this exact context object on every subsequent tool call in this Project.',
    }
  }

  return { error: 'context_kind must be one of: staff, client, company_admin.' }
}

// ── Idempotency ─────────────────────────────────────────────────────────────

function computeInputHash(input: Record<string, unknown>): string {
  const sorted = Object.keys(input)
    .filter(k => k !== 'idempotency_key')
    .sort()
    .reduce((acc, k) => { acc[k] = input[k]; return acc }, {} as Record<string, unknown>)
  return crypto.subtle ? btoa(JSON.stringify(sorted)) : btoa(JSON.stringify(sorted))
}

async function checkIdempotency(
  sb: ReturnType<typeof createClient>,
  callerProfileId: string,
  toolName: string,
  idempotencyKey: string,
  inputHash: string,
): Promise<{ duplicate: boolean; result?: unknown }> {
  const { data } = await sb.rpc('mcp_check_idempotency', {
    p_caller_profile_id: callerProfileId,
    p_tool_name: toolName,
    p_idempotency_key: idempotencyKey,
    p_input_hash: inputHash,
  })
  if (data?.already_executed) {
    return { duplicate: true, result: data.existing_result }
  }
  return { duplicate: false }
}

async function recordIdempotency(
  sb: ReturnType<typeof createClient>,
  callerProfileId: string,
  toolName: string,
  idempotencyKey: string,
  inputHash: string,
  status: string,
  audit?: ContextAuditEnvelope,
) {
  // Preferred: record the dual principal (#319) — communal connection principal AND the
  // effective Project context. Falls back to the original signature so an environment that
  // has not yet applied the context columns still records the write.
  if (audit) {
    const { error } = await sb.rpc('mcp_record_idempotency_with_context', {
      p_caller_profile_id: callerProfileId,
      p_tool_name: toolName,
      p_idempotency_key: idempotencyKey,
      p_input_hash: inputHash,
      p_result_status: status,
      p_connection_principal_user_id: audit.connection_principal_user_id,
      p_effective_context_kind: audit.effective_context_kind,
      p_effective_staff_profile_id: audit.effective_staff_profile_id,
      p_effective_client_id: audit.effective_client_id,
    })
    if (!error) return
  }
  await sb.rpc('mcp_record_idempotency', {
    p_caller_profile_id: callerProfileId,
    p_tool_name: toolName,
    p_idempotency_key: idempotencyKey,
    p_input_hash: inputHash,
    p_result_status: status,
  })
}

// ── Table existence check ───────────────────────────────────────────────────

async function tableExists(sb: ReturnType<typeof createClient>, tableName: string): Promise<boolean> {
  const { error } = await sb
    .from(tableName)
    .select('*', { count: 'exact', head: true })
  return !error
}

// ── Tool Handlers ───────────────────────────────────────────────────────────

type ToolHandler = (
  staff: AuthenticatedStaff,
  input: Record<string, unknown>,
) => Promise<unknown>

// Every canonical Planner state except terminal `done` remains active work. In particular,
// blocked/waiting/review/scheduled work must not disappear merely to exclude completions.
const ACTIVE_TASK_STATES = [
  'to_do', 'in_progress', 'blocked', 'waiting_client',
  'ready_internal_review', 'approved', 'scheduled',
]

const handleGetMyDay: ToolHandler = async (staff) => {
  // CG operates in Africa/Johannesburg (UTC+2). Deriving the day from UTC returned the
  // PREVIOUS date between 00:00-02:00 SAST (#325/#327 defect: 00:37 SAST on 10 Sep -> 9 Sep).
  const now = new Date()
  const today = cgDate(now)
  const tomorrow = cgDatePlusDays(1, now)

  const [tasksResult, calendarResult, scheduleResult] = await Promise.all([
    staff.supabase
      .from('planner_tasks')
      .select('id, title, assigned_to_name, due_date, status, notes, client_name, client_id')
      .eq('assigned_to_name', staff.fullName)
      .is('archived_at', null)
      .is('microsoft_source_removed_at', null)
      .in('status', ACTIVE_TASK_STATES)
      .lte('due_date', tomorrow)
      .order('due_date', { ascending: true })
      .limit(20),
    staff.supabase
      .from('company_calendar_events')
      .select('id, title, event_type, start_at, end_at, client_name, status, assigned_to_name')
      .gte('start_at', today)
      .lte('start_at', tomorrow + 'T23:59:59')
      .order('start_at', { ascending: true })
      .limit(20),
    staff.supabase
      .from('monthly_deliverables')
      .select(MY_DAY_DELIVERABLE_SELECT)
      .eq('assigned_to_name', staff.fullName)
      .eq('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(20),
  ])

  return {
    today,
    timezone: CG_TIMEZONE,
    staff_name: staff.fullName,
    tasks: tasksResult.data ?? [],
    calendar_events: calendarResult.data ?? [],
    deliverables: flattenDeliverableClient(scheduleResult.data),
    errors: [tasksResult.error?.message, calendarResult.error?.message, scheduleResult.error?.message].filter(Boolean),
  }
}

const handleListMyTasks: ToolHandler = async (staff, input) => {
  let query = staff.supabase
    .from('planner_tasks')
    .select(`id, title, assigned_to_name, due_date, status, notes, client_name, client_id, created_at, updated_at, ${PLANNER_MICROSOFT_FIELDS.join(', ')}`)
    .eq('assigned_to_name', staff.fullName)
    .is('archived_at', null)
    .is('microsoft_source_removed_at', null)
    .order('due_date', { ascending: true })
    .limit(50)

  if (input.status) query = query.eq('status', input.status)
  else query = query.in('status', ACTIVE_TASK_STATES)
  if (input.due_before) query = query.lte('due_date', input.due_before)

  const { data, error } = await query
  // #325: durable Microsoft identity + freshness so the Assistant can reconcile by ID.
  return { tasks: withSourceLinkage(data, 'planner'), error: error?.message ?? null }
}

const handleGetTask: ToolHandler = async (staff, input) => {
  const taskId = input.task_id as string
  const { data, error } = await staff.supabase
    .from('planner_tasks')
    .select('id, title, assigned_to_name, due_date, status, notes, client_name, client_id, created_at, updated_at')
    .eq('id', taskId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Task not found.' }
  if (data.assigned_to_name !== staff.fullName && staff.role === 'staff') {
    return { error: 'You can only read tasks assigned to you.' }
  }
  return data
}

const handleListMyCalendar: ToolHandler = async (staff, input) => {
  const { data, error } = await staff.supabase
    .from('company_calendar_events')
    .select(`id, title, event_type, start_at, end_at, all_day, location, notes, assigned_to_name, status, client_name, client_id, linked_deliverable_id, linked_task_id, ${CALENDAR_MICROSOFT_FIELDS.join(', ')}`)
    .gte('start_at', input.from as string)
    .lte('start_at', (input.to as string) + 'T23:59:59')
    .order('start_at', { ascending: true })
    .limit(50)

  // #325: durable Outlook identity + freshness for ID-based dedupe against live Outlook.
  return { events: withSourceLinkage(data, 'calendar'), error: error?.message ?? null }
}

const handleListClientSchedule: ToolHandler = async (staff, input) => {
  const query = staff.supabase
    .from('monthly_deliverables')
    .select(CLIENT_SCHEDULE_SELECT)
    .gte('scheduled_date', input.from as string)
    .lte('scheduled_date', input.to as string)
    .order('scheduled_date', { ascending: true })
    .limit(50)

  if (input.client_id) query.eq('client_id', input.client_id)

  const { data, error } = await query
  return { deliverables: flattenDeliverableClient(data), error: error?.message ?? null }
}

/**
 * Internal Content Run discovery (#325 item 3). Finds exact Content Runs by date,
 * client, calendar event or deliverable and returns the linked canonical guideline, ordered
 * videos, Client Schedule linkage and OneDrive readiness, so Morning Ops and Franco EOD
 * never have to guess a Content Run UUID.
 *
 * Read-only. Raw OneDrive drive/item identifiers and web URLs are deliberately withheld.
 */
const handleFindContentRuns: ToolHandler = async (staff, input) => {
  let query = staff.supabase
    .from('content_runs')
    .select('id, client_id, client_name, name, run_date, start_time, location, status, calendar_event_id')
    .order('run_date', { ascending: false })
    .limit(Math.min(Math.max(Number(input.limit ?? 10), 1), 25))

  const clientId = (input.client_id as string | undefined) ?? staff.effectiveClientId ?? null
  if (clientId) query = query.eq('client_id', clientId)
  if (input.run_date) query = query.eq('run_date', input.run_date)
  if (input.from) query = query.gte('run_date', input.from)
  if (input.to) query = query.lte('run_date', input.to)
  if (input.calendar_event_id) query = query.eq('calendar_event_id', input.calendar_event_id)

  // Deliverable -> run: resolve through the guideline video that references the deliverable.
  if (input.deliverable_id) {
    const { data: ideas, error: ideaError } = await staff.supabase
      .from('content_guide_ideas')
      .select('content_guideline_id')
      .eq('deliverable_id', input.deliverable_id)
      .neq('status', 'archived')
      .limit(2)
    if (ideaError) return { error: ideaError.message }
    if ((ideas ?? []).length > 1) {
      return { error: 'More than one active guideline video references that deliverable. Exact Content Run discovery is ambiguous and was refused.' }
    }
    const guidelineId = ideas?.[0]?.content_guideline_id as string | undefined
    if (!guidelineId) {
      return { runs: [], matched_by: 'deliverable_id', note: 'No guideline video references that exact deliverable, so no Content Run could be resolved. Reported rather than guessed.' }
    }
    const { data: guideline, error: guidelineError } = await staff.supabase
      .from('content_guidelines')
      .select('content_run_id')
      .eq('id', guidelineId)
      .maybeSingle()
    if (guidelineError) return { error: guidelineError.message }
    if (!guideline?.content_run_id) {
      return { runs: [], matched_by: 'deliverable_id', note: 'The referencing guideline has no linked Content Run.' }
    }
    query = query.eq('id', guideline.content_run_id)
  }

  const { data: runs, error } = await query
  if (error) return { error: error.message }

  const detailed = await Promise.all((runs ?? []).map(async (run: Record<string, unknown>) => {
    const runId = run.id as string
    const [guidelineRes, mappingRes, closeoutRes] = await Promise.all([
      staff.supabase.from('content_guidelines').select('id, title, month, status, client_id').eq('content_run_id', runId).maybeSingle(),
      staff.supabase.from('content_run_onedrive_folders').select('drive_id, month_folder_item_id, folder_name, web_url, last_verified_at').eq('content_run_id', runId).maybeSingle(),
      staff.supabase.from('content_run_closeouts').select('upload_status').eq('content_run_id', runId).maybeSingle(),
    ])

    const detailErrors = [guidelineRes.error, mappingRes.error, closeoutRes.error].filter(Boolean)
    if (detailErrors.length > 0) {
      return {
        content_run: { id: runId, client: { id: run.client_id, name: run.client_name }, run_date: run.run_date },
        error: detailErrors.map(item => item?.message).filter(Boolean).join('; '),
      }
    }

    const guideline = guidelineRes.data as Record<string, unknown> | null
    let videos: Array<Record<string, unknown>> = []
    if (guideline?.id) {
      const { data: ideaRows, error: ideaRowsError } = await staff.supabase
        .from('content_guide_ideas')
        .select('id, title, position, status, deliverable_id, client_id')
        .eq('content_guideline_id', guideline.id)
        .order('position', { ascending: true })
      if (ideaRowsError) {
        return {
          content_run: { id: runId, client: { id: run.client_id, name: run.client_name }, run_date: run.run_date },
          error: ideaRowsError.message,
        }
      }
      videos = (ideaRows ?? []) as Array<Record<string, unknown>>
    }

    return {
      content_run: {
        id: runId,
        client: { id: run.client_id, name: run.client_name },
        name: run.name,
        run_date: run.run_date,
        start_time: run.start_time,
        location: run.location,
        status: run.status,
        calendar_event_id: run.calendar_event_id,
      },
      content_guideline: guideline
        ? { id: guideline.id, title: guideline.title, month: guideline.month, status: guideline.status }
        : null,
      videos: videos.map(v => ({
        id: v.id, title: v.title, position: v.position, status: v.status,
        linked_deliverable_id: v.deliverable_id ?? null,
      })),
      client_schedule_linkage: {
        linked_video_count: videos.filter(v => !!v.deliverable_id).length,
        unlinked_video_count: videos.filter(v => !v.deliverable_id).length,
      },
      onedrive: classifyOneDriveReadiness(mappingRes.data as Record<string, unknown> | null),
      upload_status: (closeoutRes.data as Record<string, unknown> | null)?.upload_status ?? 'unverified',
    }
  }))

  return {
    runs: detailed,
    matched_by: input.deliverable_id ? 'deliverable_id' : input.calendar_event_id ? 'calendar_event_id' : input.run_date ? 'run_date' : clientId ? 'client' : 'recent',
    note: detailed.length === 0
      ? 'No Content Run matched those exact criteria. Reported rather than guessed - never substitute a different client or date.'
      : 'One canonical Content Guideline per Content Run. Raw OneDrive identifiers and URLs are internal-only and withheld.',
  }
}

/**
 * Assistant-owned Content Guideline linkage (#325 item 4). Franco confirms only what
 * happened on the shoot; the Assistant resolves the exact linkage itself:
 * Content Run -> one canonical Content Guideline -> ordered videos -> exact same-client
 * monthly deliverables.
 *
 * `dry_run` (default) returns the plan without writing. Same-client and one-active-link
 * constraints fail closed; nothing is guessed and Franco is never asked to choose an ID.
 */
const handleLinkContentRunDeliverables: ToolHandler = async (staff, input) => {
  const runId = input.content_run_id as string
  const scopeError = await assertRunInClientScope(staff, runId)
  if (scopeError) return scopeError

  const { data: run, error: runError } = await staff.supabase
    .from('content_runs')
    .select('id, client_id, client_name, run_date')
    .eq('id', runId)
    .maybeSingle()
  if (runError) return { error: runError.message }
  if (!run) return { error: 'Content Run not found.' }
  if (!run.client_id) return { error: 'Content Run has no exact client assigned; linkage is refused.' }

  const { data: guideline, error: guidelineError } = await staff.supabase
    .from('content_guidelines')
    .select('id, title, month, coverage_start, coverage_end, client_id')
    .eq('content_run_id', runId)
    .maybeSingle()
  if (guidelineError) return { error: guidelineError.message }
  if (!guideline) {
    return { error: 'No canonical Content Guideline is linked to this Content Run. Linkage is refused rather than creating a parallel guideline.' }
  }
  if (guideline.client_id && guideline.client_id !== run.client_id) {
    return { error: 'The linked Content Guideline belongs to a different client than the Content Run. Failing closed.' }
  }

  const { data: videos, error: videosError } = await staff.supabase
    .from('content_guide_ideas')
    .select('id, title, position, month, video_number, status, deliverable_id, client_id')
    .eq('content_guideline_id', guideline.id)
    .order('position', { ascending: true })
  if (videosError) return { error: videosError.message }

  const coverageStart = (guideline.coverage_start as string | null) ?? (guideline.month as string | null)
  const coverageEnd = (guideline.coverage_end as string | null) ?? coverageStart
  let deliverablesQuery = staff.supabase
    .from('monthly_deliverables')
    .select('id, client_id, title, code, deliverable_type, month, instance_number, scheduled_date')
    .eq('client_id', run.client_id)
    .in('deliverable_type', ['video', 'reel'])
    .order('scheduled_date', { ascending: true })
    .limit(250)
  if (coverageStart) deliverablesQuery = deliverablesQuery.gte('month', coverageStart)
  if (coverageEnd) deliverablesQuery = deliverablesQuery.lte('month', coverageEnd)
  const { data: deliverables, error: deliverablesError } = await deliverablesQuery
  if (deliverablesError) return { error: deliverablesError.message }

  const candidateIds = (deliverables ?? []).map(row => row.id).filter(Boolean)
  const claimedElsewhere = new Set<string>()
  if (candidateIds.length > 0) {
    const { data: claimedRows, error: claimedError } = await staff.supabase
      .from('content_guide_ideas')
      .select('id, deliverable_id')
      .in('deliverable_id', candidateIds)
      .neq('status', 'archived')
      .neq('content_guideline_id', guideline.id)
    if (claimedError) return { error: claimedError.message }
    for (const row of claimedRows ?? []) {
      if (row.deliverable_id) claimedElsewhere.add(row.deliverable_id)
    }
  }

  const deliverableCandidates = (deliverables ?? []).map(row => ({
    ...row,
    claimed_elsewhere: claimedElsewhere.has(row.id),
  }))

  const plan = planGuidelineVideoLinks(
    (videos ?? []) as Array<Record<string, unknown>>,
    deliverableCandidates as Array<Record<string, unknown>>,
    run.client_id as string,
  )

  const dryRun = input.dry_run !== false
  const linkable = plan.filter(p => p.outcome === 'linkable')
  const blocked = plan.filter(p => p.outcome === 'blocked_cross_client' || p.outcome === 'ambiguous')

  if (dryRun) {
    return {
      dry_run: true,
      content_run: { id: runId, client: { id: run.client_id, name: run.client_name }, run_date: run.run_date },
      content_guideline: { id: guideline.id, title: guideline.title, month: guideline.month },
      plan,
      summary: { linkable: linkable.length, already_linked: plan.filter(p => p.outcome === 'already_linked').length, blocked: blocked.length, ambiguous: plan.filter(p => p.outcome === 'ambiguous').length, no_candidate: plan.filter(p => p.outcome === 'no_candidate').length },
      note: 'Plan only - nothing was written. The Assistant resolved every link itself; Franco is never asked to choose an ID. Call again with dry_run=false to apply.',
    }
  }

  if (blocked.length > 0) {
    return {
      dry_run: false, applied: 0, blocked: blocked.length, plan,
      error: 'Refusing to apply: one or more video links are cross-client or ambiguous. Resolve the data conflict explicitly first.',
    }
  }

  // Apply only the unambiguous same-client links. Idempotent: already-linked rows are
  // untouched, and each deliverable is claimed at most once by the planner.
  let applied = 0
  const failures: Array<{ video_id: string; error: string }> = []
  for (const item of linkable) {
    const { data: updatedRow, error: updateError } = await staff.supabase
      .from('content_guide_ideas')
      .update({ deliverable_id: item.deliverable_id, updated_at: new Date().toISOString() })
      .eq('id', item.video_id)
      .is('deliverable_id', null)
      .select('id')
      .maybeSingle()
    if (updateError) failures.push({ video_id: item.video_id, error: updateError.message })
    else if (updatedRow) applied += 1
    else failures.push({ video_id: item.video_id, error: 'The video changed before the link was applied. Reload and re-plan.' })
  }

  return {
    dry_run: false,
    content_run: { id: runId, client: { id: run.client_id, name: run.client_name } },
    content_guideline: { id: guideline.id },
    applied,
    failed: failures.length,
    failures,
    plan,
    note: 'Linked exact same-client monthly deliverables only. Guarded by `is deliverable_id null` so a repeat call cannot double-link. Client Schedule rows themselves were NOT modified.',
  }
}

const CALENDAR_EVENT_TYPES = ['meeting', 'shoot', 'content_run', 'client_event', 'internal', 'deadline']
const CALENDAR_STATUSES = ['planned', 'confirmed', 'completed', 'cancelled']

/**
 * Canonical CG Calendar write for coexistence dual-write (#325 item 2).
 *
 * Scope: the Dynamics side of a normal operational meeting/event the staff member explicitly
 * asked the Assistant to create, reschedule or cancel. `company_calendar_events` remains CG
 * Calendar truth. Client Schedule is NEVER written here and is never merged into CG Calendar.
 *
 * Durable Outlook identity is preserved: when `microsoft_event_id` is supplied the write is
 * matched on it (idempotent upsert-by-source-key), never by title. `PARTIAL SYNC` is
 * reported when the caller states the Outlook side did not succeed, so the pair is never
 * claimed as fully written.
 */
const handleUpsertCalendarEvent: ToolHandler = async (staff, input) => {
  const action = String(input.action ?? 'create')
  if (!['create', 'update', 'cancel'].includes(action)) {
    return { error: 'action must be one of: create, update, cancel.' }
  }

  const microsoftEventId = typeof input.microsoft_event_id === 'string' && input.microsoft_event_id.trim()
    ? input.microsoft_event_id.trim() : null
  const eventId = typeof input.event_id === 'string' && input.event_id.trim() ? input.event_id.trim() : null

  if (input.event_type && !CALENDAR_EVENT_TYPES.includes(String(input.event_type))) {
    return { error: `event_type must be one of: ${CALENDAR_EVENT_TYPES.join(', ')}.` }
  }
  if (input.status && !CALENDAR_STATUSES.includes(String(input.status))) {
    return { error: `status must be one of: ${CALENDAR_STATUSES.join(', ')}.` }
  }
  if (typeof input.outlook_write_succeeded !== 'boolean') {
    return { error: 'outlook_write_succeeded must explicitly state whether the Outlook side landed. Never infer dual-write success.' }
  }

  // Resolve the exact existing row by durable identity only - never by title.
  let existing: Record<string, unknown> | null = null
  if (eventId) {
    const { data } = await staff.supabase.from('company_calendar_events').select('id, client_id, microsoft_event_id, microsoft_calendar_id').eq('id', eventId).maybeSingle()
    existing = data as Record<string, unknown> | null
    if (!existing) return { error: 'No CG Calendar event matches that exact event_id.' }
  } else if (microsoftEventId) {
    const { data } = await staff.supabase.from('company_calendar_events').select('id, client_id, microsoft_event_id, microsoft_calendar_id').eq('microsoft_event_id', microsoftEventId).maybeSingle()
    existing = data as Record<string, unknown> | null
  }

  const existingMicrosoftEventId = typeof existing?.microsoft_event_id === 'string' ? existing.microsoft_event_id : null
  const existingMicrosoftCalendarId = typeof existing?.microsoft_calendar_id === 'string' ? existing.microsoft_calendar_id : null
  const suppliedCalendarId = typeof input.microsoft_calendar_id === 'string' && input.microsoft_calendar_id.trim()
    ? input.microsoft_calendar_id.trim() : null
  if (existing && microsoftEventId && existingMicrosoftEventId && microsoftEventId !== existingMicrosoftEventId) {
    return { error: 'event_id and microsoft_event_id resolve to different durable identities. Refusing to overwrite the existing Outlook identity.' }
  }
  if (existing && suppliedCalendarId && existingMicrosoftCalendarId && suppliedCalendarId !== existingMicrosoftCalendarId) {
    return { error: 'microsoft_calendar_id does not match the existing event identity. Refusing the cross-calendar write.' }
  }

  if ((action === 'update' || action === 'cancel') && !existing) {
    return { error: 'No existing CG Calendar event was resolved by exact id or durable Outlook event id. Refusing to match by title.' }
  }

  // Client-context pinning: a client Project cannot write another client's event.
  const targetClientId = (input.client_id as string | undefined) ?? (existing?.client_id as string | undefined) ?? null
  const scope = assertRecordClientMatchesContext(staff.contextKind, staff.effectiveClientId, targetClientId, 'calendar event')
  if (!scope.allowed) return { error: scope.error }

  const nowIso = new Date().toISOString()
  const partialSync = input.outlook_write_succeeded === false
  const effectiveMicrosoftEventId = microsoftEventId ?? existingMicrosoftEventId
  const effectiveMicrosoftCalendarId = suppliedCalendarId ?? existingMicrosoftCalendarId
  if (!partialSync && (!effectiveMicrosoftEventId || !effectiveMicrosoftCalendarId)) {
    return { error: 'A successful Outlook-side write requires both microsoft_event_id and microsoft_calendar_id (supplied now or already stored). Otherwise report outlook_write_succeeded=false.' }
  }
  if (microsoftEventId && !suppliedCalendarId && !existingMicrosoftCalendarId) {
    return { error: 'A new microsoft_event_id requires its exact microsoft_calendar_id. Partial Outlook identities are refused.' }
  }

  const writable: Record<string, unknown> = { updated_at: nowIso }
  if (input.title !== undefined) writable.title = input.title
  if (input.event_type !== undefined) writable.event_type = input.event_type
  if (input.start_at !== undefined) writable.start_at = input.start_at
  if (input.end_at !== undefined) writable.end_at = input.end_at
  if (input.all_day !== undefined) writable.all_day = input.all_day
  if (input.location !== undefined) writable.location = input.location
  if (input.notes !== undefined) writable.notes = input.notes
  if (input.assigned_to_name !== undefined) writable.assigned_to_name = input.assigned_to_name
  if (input.client_id !== undefined) writable.client_id = input.client_id
  if (input.client_name !== undefined) writable.client_name = input.client_name
  if (!partialSync && effectiveMicrosoftEventId && effectiveMicrosoftCalendarId) {
    writable.microsoft_event_id = effectiveMicrosoftEventId
    writable.microsoft_source_type = 'outlook_calendar'
    writable.microsoft_calendar_id = effectiveMicrosoftCalendarId
    // Only claim Microsoft freshness when the caller confirms the Outlook write landed.
    writable.microsoft_last_synced_at = nowIso
  }

  if (action === 'cancel') {
    writable.status = 'cancelled'
  } else if (input.status !== undefined) {
    writable.status = input.status
  }

  let resultRow: Record<string, unknown> | null
  let writeError: string | null

  if (existing) {
    const { data, error } = await staff.supabase
      .from('company_calendar_events')
      .update(writable)
      .eq('id', existing.id)
      .select('id, title, event_type, start_at, end_at, status, client_id, client_name, microsoft_event_id, microsoft_calendar_id, microsoft_last_synced_at')
      .maybeSingle()
    resultRow = data as Record<string, unknown> | null
    writeError = error?.message ?? null
  } else {
    if (!input.title || !input.start_at) {
      return { error: 'Creating a CG Calendar event requires at least title and start_at.' }
    }
    const { data, error } = await staff.supabase
      .from('company_calendar_events')
      .insert({ ...writable, created_at: nowIso })
      .select('id, title, event_type, start_at, end_at, status, client_id, client_name, microsoft_event_id, microsoft_calendar_id, microsoft_last_synced_at')
      .maybeSingle()
    resultRow = data as Record<string, unknown> | null
    writeError = error?.message ?? null
  }

  if (writeError) {
    return { verdict: 'FAIL', action, error: writeError, sync_state: 'DYNAMICS_WRITE_FAILED', note: 'The Dynamics side did not write. If the Outlook side already succeeded this is a PARTIAL SYNC - preserve the Outlook write and reconcile.' }
  }

  return {
    verdict: partialSync ? 'PARTIAL_SYNC' : 'PASS',
    action,
    event: resultRow,
    matched_by: existing ? (eventId ? 'event_id' : 'microsoft_event_id') : 'created',
    sync_state: partialSync ? 'PARTIAL SYNC' : 'BOTH_SIDES_REPORTED_OK',
    note: partialSync
      ? 'The caller reported the Outlook write did NOT succeed. The Dynamics mirror was written and Microsoft freshness was deliberately NOT stamped. Report PARTIAL SYNC and queue the Outlook side; never claim both were updated.'
      : 'CG Calendar (company_calendar_events) is the Dynamics calendar truth. Client Schedule was not touched and is never merged into CG Calendar.',
    scope_note: 'Durable Outlook identity is used for matching; title matching is refused.',
  }
}

// -- #325 coexistence actions ------------------------------------------------

/**
 * Invoke a SIBLING Edge Function as the authenticated caller. This is how the connector
 * reuses the existing durable engines (microsoft-transition-sync, provider status/sync)
 * instead of reimplementing them. The caller token is forwarded, never logged.
 */
async function invokeSiblingFunction(
  connection: ConnectionPrincipal,
  fn: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: Record<string, unknown> | null; error: string | null }> {
  const baseUrl = Deno.env.get('SUPABASE_URL')
  if (!baseUrl) return { ok: false, data: null, error: 'Server configuration error.' }
  try {
    const res = await fetch(`${baseUrl}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${connection.accessToken}`,
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      },
      body: JSON.stringify(body),
    })
    const parsed = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, data: parsed, error: (parsed as { error?: string } | null)?.error ?? `${fn} returned ${res.status}.` }
    }
    return { ok: true, data: parsed, error: null }
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Bounded work units per invocation so the Edge time budget is never exceeded. */
const MAX_SYNC_PROCESS_STEPS = 40

/**
 * Run the EXISTING durable Microsoft reconciliation (#325 item 1). Drives the canonical
 * microsoft-transition-sync job lifecycle (job_start -> bounded job_process loop ->
 * job_status) as the authenticated admin. Builds no second sync engine and holds no
 * Microsoft credentials of its own.
 *
 * Scope guard: fetches and assembles the durable Microsoft preview that the existing reviewed
 * apply path consumes. This tool does not apply any Dynamics mirror. It deliberately cannot
 * change Client Schedule/monthly_deliverables, MASTER CLIENT TO DO or protected Client Socials.
 */
const handleRunMicrosoftSync: ToolHandler = async (staff, input) => {
  const conn = staff.connection
  const resume = typeof input.job_id === 'string' && input.job_id.trim() ? input.job_id.trim() : null

  let jobId = resume
  if (!jobId) {
    if (typeof input.range_start !== 'string' || typeof input.range_end !== 'string') {
      return { verdict: 'FAIL', error: 'Starting a Microsoft reconciliation preview requires exact range_start and range_end timestamps.' }
    }
    const start = await invokeSiblingFunction(conn, 'microsoft-transition-sync', {
      action: 'job_start',
      rangeStart: input.range_start ?? undefined,
      rangeEnd: input.range_end ?? undefined,
    })
    if (!start.ok) {
      return { verdict: 'FAIL', error: start.error, reason: 'The durable reconciliation job could not be started. Flag SYNC FAILED and use the live Microsoft read.' }
    }
    jobId = (start.data?.jobId as string | undefined) ?? null
    if (!jobId) return { verdict: 'FAIL', error: 'No job id was returned.', reason: 'Flag SYNC FAILED.' }
  }

  // Bounded and idempotent: each job_process claims exactly one unit and is safe to repeat.
  let finished = false
  let steps = 0
  let lastError: string | null = null
  let sources: Array<Record<string, unknown>> = []
  let status: string | null = null

  const maxSteps = Math.min(Math.max(Number(input.max_steps ?? MAX_SYNC_PROCESS_STEPS), 1), MAX_SYNC_PROCESS_STEPS)
  while (steps < maxSteps && !finished) {
    steps += 1
    const step = await invokeSiblingFunction(conn, 'microsoft-transition-sync', { action: 'job_process', jobId })
    if (!step.ok) { lastError = step.error; break }
    finished = step.data?.finished === true
    if (Array.isArray(step.data?.sources)) sources = step.data.sources as Array<Record<string, unknown>>
  }

  const statusRes = await invokeSiblingFunction(conn, 'microsoft-transition-sync', { action: 'job_status', jobId })
  if (statusRes.ok) {
    status = (statusRes.data?.status as string | undefined) ?? null
    if (Array.isArray(statusRes.data?.sources)) sources = statusRes.data.sources as Array<Record<string, unknown>>
  } else lastError = statusRes.error

  let assembledRecordCount: number | null = null
  if (finished) {
    const resultRes = await invokeSiblingFunction(conn, 'microsoft-transition-sync', { action: 'job_result', jobId })
    if (!resultRes.ok) lastError = resultRes.error
    const snapshot = resultRes.data?.snapshot as { records?: unknown[] } | undefined
    if (Array.isArray(snapshot?.records)) assembledRecordCount = snapshot.records.length
  }

  const outcome = gradeSyncRun(
    lastError ? 'failed' : finished ? (status ?? 'complete') : (status ?? 'running'),
    sources,
  )

  return {
    job_id: jobId,
    finished,
    steps_processed: steps,
    verdict: outcome.verdict,
    reason: outcome.reason,
    coverage: {
      sources_total: outcome.sources_total,
      sources_complete: outcome.sources_complete,
      sources_failed: outcome.sources_failed,
      required_incomplete: outcome.required_incomplete,
      records_fetched: outcome.records_fetched,
    },
    sources,
    transport_error: lastError,
    preview_record_count: assembledRecordCount,
    continuation: finished ? null : { job_id: jobId, note: 'Not finished within the bounded step budget. Call again with this job_id to continue; job_process is idempotent and claims one unit at a time.' },
    scope_note: 'Fetches and assembles a durable reconciliation preview only. It does not claim planner_tasks/company_calendar_events mirrors are applied or fresh. Client Schedule/monthly_deliverables, MASTER CLIENT TO DO and protected Client Socials are untouched.',
    apply_note: 'Reviewed APPLY remains in the existing admin reconciliation path. Until an apply succeeds, get_microsoft_sync_status may correctly remain stale and staff briefs must prefer live Microsoft freshness.',
  }
}

const PROVIDER_STATUS_FUNCTIONS: Record<string, string> = {
  meta: 'meta-connection-status',
  google_ads: 'google-ads-connection-status',
  tiktok: 'tiktok-connection-status',
}

const PROVIDER_SYNC_FUNCTIONS: Record<string, string> = {
  meta: 'meta-sync',
  google_ads: 'google-ads-sync',
  tiktok: 'tiktok-sync',
}

function safeProviderEvidence(provider: string, response: Record<string, unknown> | null) {
  if (!response) return null
  if (provider === 'meta') {
    const connection = response.connection as Record<string, unknown> | undefined
    return {
      status: response.status ?? null,
      schema_ready: response.schemaReady ?? null,
      linked_assets_count: response.linkedAssetsCount ?? null,
      last_connected_at: connection?.lastConnectedAt ?? null,
      last_verified_insight: connection?.lastVerifiedInsight ?? null,
      asset_health: response.assetHealth ?? null,
    }
  }
  if (provider === 'google_ads') {
    return {
      status: response.status ?? null,
      configured: response.configured ?? null,
      linked_accounts_count: response.linkedAccountsCount ?? null,
      last_synced_at: response.lastSyncedAt ?? null,
      last_checked_at: response.lastCheckedAt ?? null,
    }
  }
  const connection = response.connection as Record<string, unknown> | undefined
  return {
    status: response.status ?? null,
    schema_ready: response.schemaReady ?? null,
    last_connected_at: connection?.lastConnectedAt ?? null,
    token_expires_at: connection?.tokenExpiresAt ?? null,
    token_expired: connection?.tokenExpired ?? null,
  }
}

/**
 * Compact Morning Ops provider health (#325 item 5). Reuses each provider EXISTING
 * connection-status function; adds no provider client, no OAuth, no permission change, no
 * account mapping and no publishing behaviour.
 */
const handleGetProviderHealth: ToolHandler = async (staff, input) => {
  const suppliedProviders = Array.isArray(input.providers) && input.providers.length
    ? input.providers as string[]
    : null
  const invalidProviders = (suppliedProviders ?? []).filter(p => !(p in PROVIDER_STATUS_FUNCTIONS))
  if (invalidProviders.length > 0) return { error: `Unsupported provider(s): ${invalidProviders.join(', ')}.` }
  const requested = suppliedProviders ?? Object.keys(PROVIDER_STATUS_FUNCTIONS)

  const results = (await Promise.all(requested.map(async provider => {
    if (provider !== 'tiktok') {
      const res = await invokeSiblingFunction(staff.connection, PROVIDER_STATUS_FUNCTIONS[provider], {})
      return [{
        ...summarizeProviderHealth(provider, res.data as Record<string, unknown> | null, res.error),
        evidence: safeProviderEvidence(provider, res.data),
      }]
    }

    const requestedClientId = typeof input.client_id === 'string' ? input.client_id : null
    let clientIds = requestedClientId ? [requestedClientId] : []
    if (!requestedClientId) {
      const { data, error } = await staff.supabase
        .from('tiktok_connections')
        .select('client_id')
        .not('client_id', 'is', null)
      if (error) return [summarizeProviderHealth('tiktok', null, error.message)]
      clientIds = [...new Set((data ?? []).map(row => row.client_id).filter((id): id is string => typeof id === 'string'))]
    }
    if (clientIds.length === 0) {
      return [{ ...summarizeProviderHealth('tiktok', { connected: false }, null), client_id: null }]
    }
    return Promise.all(clientIds.map(async clientId => {
      const res = await invokeSiblingFunction(staff.connection, PROVIDER_STATUS_FUNCTIONS.tiktok, { clientId })
      return {
        ...summarizeProviderHealth('tiktok', res.data as Record<string, unknown> | null, res.error),
        client_id: clientId,
        evidence: safeProviderEvidence('tiktok', res.data),
      }
    }))
  }))).flat()

  const degraded = results.filter(r => r.degraded)
  return {
    providers: results,
    overall: degraded.length === 0 ? 'PASS' : 'DEGRADED',
    degraded_providers: degraded.map(d => d.provider),
    note: degraded.length
      ? 'Report degraded provider coverage explicitly. An unreadable provider is UNKNOWN, never a confirmed empty or disconnected state.'
      : 'All requested providers reported a determinate connection state.',
    scope_note: 'Read-only status via each existing provider connection-status function. No OAuth, permission, secret, account-mapping or publishing change.',
  }
}

/**
 * Targeted routine sync for an already-authorised, already-mapped provider account
 * (#325 item 5). Delegates to the existing provider sync function; it cannot authorise a new
 * account, change mappings or publish.
 */
const handleRunProviderSync: ToolHandler = async (staff, input) => {
  const provider = String(input.provider ?? '')
  const fn = PROVIDER_SYNC_FUNCTIONS[provider]
  if (!fn) return { error: `provider must be one of: ${Object.keys(PROVIDER_SYNC_FUNCTIONS).join(', ')}.` }

  const clientId = typeof input.client_id === 'string' ? input.client_id : null
  if (!clientId) return { error: 'client_id is required so routine sync is pinned to one exact existing provider mapping.' }

  if (provider === 'meta') {
    const { data, error } = await staff.supabase.from('meta_client_assets').select('id').eq('client_id', clientId).eq('is_active', true).limit(1)
    if (error) return { error: error.message }
    if (!data?.length) return { provider, verdict: 'FAIL', skipped: true, reason: 'No active Meta mapping exists for that exact client. No sync or mapping change was attempted.' }
  }
  if (provider === 'google_ads') {
    const [dedicated, campaigns] = await Promise.all([
      staff.supabase.from('google_ads_account_links').select('id').eq('client_id', clientId).eq('is_active', true).limit(1),
      staff.supabase.from('google_ads_campaign_links').select('id').eq('client_id', clientId).eq('is_active', true).limit(1),
    ])
    if (dedicated.error || campaigns.error) return { error: dedicated.error?.message ?? campaigns.error?.message }
    if (!dedicated.data?.length && !campaigns.data?.length) return { provider, verdict: 'FAIL', skipped: true, reason: 'No active Google Ads account/campaign mapping exists for that exact client. No sync or mapping change was attempted.' }
  }

  const healthBody = provider === 'tiktok' ? { clientId } : {}
  const health = await invokeSiblingFunction(staff.connection, PROVIDER_STATUS_FUNCTIONS[provider], healthBody)
  const summary = summarizeProviderHealth(provider, health.data as Record<string, unknown> | null, health.error)
  if (summary.state !== 'connected') {
    return {
      provider, verdict: 'FAIL', skipped: true, health: summary,
      reason: 'Routine sync runs only for an already-authorised provider connection. No authorisation, mapping or permission change was attempted.',
    }
  }

  let body: Record<string, unknown>
  if (provider === 'meta') {
    body = { mode: 'previous_completed_month', clientId }
    if (input.month) body.month = input.month
  } else if (provider === 'google_ads') {
    if (!input.start_date || !input.end_date) return { error: 'Google Ads sync requires exact start_date and end_date.' }
    body = { clientId, startDate: input.start_date, endDate: input.end_date }
  } else {
    body = { clientId }
    if (input.period_month) body.periodMonth = input.period_month
  }
  const res = await invokeSiblingFunction(staff.connection, fn, body)

  return {
    provider,
    verdict: res.ok ? 'PASS' : 'FAIL',
    health: summary,
    result: res.data,
    ...(res.error ? { error: res.error } : {}),
    scope_note: 'Routine sync for an already-authorised and already-mapped account only. No OAuth, permission, secret, account-mapping or publishing change.',
  }
}

// ── #325 company-admin observability (read-only) ────────────────────────────

/**
 * Company-wide planner task inventory for reconciliation audit. Deliberately a DISTINCT
 * tool rather than overloading list_my_tasks, which stays scoped to one exact staff member.
 * Read-only: exposes state + durable Microsoft identity so a later dry run can classify
 * stale mirrors without title matching. Executes no cleanup.
 */
const handleListCompanyTasks: ToolHandler = async (staff, input) => {
  const state = (input.state as string | undefined) ?? 'active'
  const limit = Math.min(Math.max(Number(input.limit ?? 100), 1), 200)
  const offset = Math.max(Number(input.offset ?? 0), 0)

  let query = staff.supabase
    .from('planner_tasks')
    .select(`id, title, assigned_to_name, client_name, client_id, status, due_date, start_date, notes, source, original_plan_name, original_bucket_name, recurrence_rule, archived_at, created_at, updated_at, ${PLANNER_MICROSOFT_FIELDS.join(', ')}`, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Explicit, non-inferred state selection. Completion is never inferred from age/due date.
  if (state === 'active') {
    query = query.is('archived_at', null).is('microsoft_source_removed_at', null).in('status', ACTIVE_TASK_STATES)
  } else if (state === 'completed') {
    query = query.is('archived_at', null).not('status', 'in', `(${ACTIVE_TASK_STATES.join(',')})`)
  } else if (state === 'archived') {
    query = query.not('archived_at', 'is', null)
  } else if (state === 'source_removed') {
    query = query.not('microsoft_source_removed_at', 'is', null)
  } else if (state !== 'all') {
    return { error: 'state must be one of: active, completed, archived, source_removed, all.' }
  }

  if (input.assigned_to_name) query = query.eq('assigned_to_name', input.assigned_to_name)
  if (input.microsoft_plan_id) query = query.eq('microsoft_plan_id', input.microsoft_plan_id)

  const { data, error, count } = await query
  if (error) return { error: error.message }

  const tasks = withSourceLinkage(data, 'planner')
  const classification = { microsoft_backed: 0, dynamics_only: 0, microsoft_source_removed: 0 }
  for (const t of tasks) {
    const c = (t.source as { classification: keyof typeof classification }).classification
    classification[c] = (classification[c] ?? 0) + 1
  }

  return {
    state,
    tasks,
    counts: { returned: tasks.length, total_matching: count ?? null, by_classification: classification },
    pagination: { limit, offset, next_offset: count !== null && offset + tasks.length < count ? offset + tasks.length : null },
    audit_note: 'Read-only inventory. No cleanup, archive or suppression was performed. Reconcile by durable Microsoft IDs only.',
  }
}

/**
 * Company-wide Dynamics recurring-task template inventory with ownership + source
 * classification, so legitimate Dynamics-only recurrence is distinguishable from
 * Microsoft-backed recurrence at audit time. Read-only.
 */
const handleListCompanyRecurringTasks: ToolHandler = async (staff, input) => {
  const limit = Math.min(Math.max(Number(input.limit ?? 100), 1), 200)
  const offset = Math.max(Number(input.offset ?? 0), 0)

  let query = staff.supabase
    .from('planner_tasks')
    .select(`id, title, assigned_to_name, client_name, client_id, status, due_date, notes, source, original_plan_name, recurrence_rule, recurrence_until, archived_at, created_at, updated_at, ${PLANNER_MICROSOFT_FIELDS.join(', ')}`, { count: 'exact' })
    .not('recurrence_rule', 'is', null)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (input.include_archived !== true) query = query.is('archived_at', null)
  if (input.assigned_to_name) query = query.eq('assigned_to_name', input.assigned_to_name)

  const { data, error, count } = await query
  if (error) return { error: error.message }

  const templates = withSourceLinkage(data, 'planner')
  const dynamicsOnly = templates.filter(t => (t.source as { classification: string }).classification === 'dynamics_only')

  return {
    templates,
    counts: {
      returned: templates.length,
      total_matching: count ?? null,
      dynamics_only: dynamicsOnly.length,
      microsoft_backed: templates.length - dynamicsOnly.length,
    },
    pagination: { limit, offset, next_offset: count !== null && offset + templates.length < count ? offset + templates.length : null },
    audit_note: 'Dynamics-only recurrence is legitimate CG-native work and must remain visible even with no Microsoft counterpart.',
  }
}

/**
 * Latest Microsoft -> Dynamics reconciliation health/freshness (#325 §2). Read-only view of
 * the EXISTING canonical sync-run architecture — no second sync subsystem, and it triggers
 * nothing. The Assistant must call this before relying on Dynamics mirrors in a daily brief.
 */
const handleGetMicrosoftSyncStatus: ToolHandler = async (staff, input) => {
  const hasTable = await tableExists(staff.supabase, 'microsoft_sync_runs')
  if (!hasTable) {
    return {
      sync_health: summarizeSyncHealth(null, new Date().toISOString()),
      latest_run: null,
      error: 'Microsoft reconciliation run history is not available in this environment. Treat Dynamics mirrors as unverified.',
    }
  }

  const { data, error } = await staff.supabase
    .from('microsoft_sync_runs')
    .select('id, trigger_type, status, snapshot_exported_at, snapshot_exported_by, range_start, range_end, source_completeness, summary, safe_error, started_at, applied_at, finished_at, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(Number(input.history_limit ?? 5), 1), 20))

  if (error) return { error: error.message }

  const runs = data ?? []
  const latest = runs[0] ?? null
  const thresholdMinutes = Number(input.freshness_threshold_minutes ?? 0) || undefined
  const health = summarizeSyncHealth(latest, new Date().toISOString(), thresholdMinutes)

  return {
    sync_health: health,
    latest_run: latest,
    recent_runs: runs.map((r: Record<string, unknown>) => ({
      id: r.id, status: r.status, trigger_type: r.trigger_type,
      started_at: r.started_at, finished_at: r.finished_at, safe_error: r.safe_error,
    })),
    source_completeness: latest?.source_completeness ?? null,
    operating_rule: health.degraded
      ? 'Flag SYNC STALE / SYNC FAILED. Prefer the live Microsoft read for Microsoft-backed work and report degraded source coverage.'
      : 'Reconciliation is fresh. Still perform the live Microsoft read — a successful sync never replaces it.',
  }
}

const handleGetClientContext: ToolHandler = async (staff, input) => {
  const hasTable = await tableExists(staff.supabase, 'clients')
  if (!hasTable) return { error: 'Client intelligence tables not yet available.' }

  const clientId = input.client_id as string
  const { data: client, error: clientError } = await staff.supabase
    .from('clients')
    .select('id, name, active')
    .eq('id', clientId)
    .maybeSingle()

  if (clientError || !client) return { error: 'Client not found.' }
  if (!client.active) return { error: 'Client is not active.' }

  // Canonical exact-client knowledge is the #241/#294 client guide, keyed by exact
  // client_id with no sibling/group fallback. Previous code queried
  // marketing_library_sources (a COMPANY-WIDE library with no client_id and no
  // content_type column) and public.client_notes (which does not exist), so this tool
  // returned schema errors and silently empty context. Both are corrected here.
  const { data: guide, error: guideError } = await staff.supabase
    .from('client_guides')
    .select('id, client_id, guide_markdown, project_instructions, version, generated_at, source_pack_path, source_revision, source_observed_at, runtime_readiness, readiness_reason')
    .eq('client_id', clientId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Report coverage explicitly instead of presenting an unavailable source as empty (#325).
  const unavailable: string[] = []
  if (guideError) unavailable.push(`client_guides: ${guideError.message}`)

  const ready = Boolean(
    guide &&
    guide.client_id === clientId &&
    guide.runtime_readiness === 'ready' &&
    typeof guide.guide_markdown === 'string' &&
    guide.guide_markdown.trim().length > 0
  )
  if (!ready) {
    return {
      error: 'CLIENT CONTEXT NOT READY',
      code: 'CLIENT_CONTEXT_NOT_READY',
      client: { id: client.id, name: client.name },
      task_type: input.task_type,
      scope_key: input.scope_key ?? null,
      runtime_readiness: 'not_ready',
      reason: guideError
        ? 'Exact-client intelligence readiness could not be verified.'
        : guide?.readiness_reason ?? 'No reviewed exact-client intelligence projection is ready.',
      instruction: 'Do not generate generic client creative or borrow a sibling, group, billing or national client. Surface this readiness gap.',
      context_coverage: {
        client_guide: guideError ? 'unavailable' : 'not_ready',
        unavailable_sources: unavailable,
      },
    }
  }

  const needsCaptionContacts = ['caption', 'script', 'general'].includes(String(input.task_type))
  let contactFooter: Record<string, unknown> | null = null
  if (needsCaptionContacts) {
    let contactsQuery = staff.supabase
      .from('client_contacts')
      .select('contact_type,display_label,person_name,person_role,value,approved_for_caption,visibility,provenance_summary,last_verified_at,freshness_state,lifecycle_state,platforms,content_modes,footer_order,blocks_caption')
      .eq('client_id', clientId)
    let policyQuery = staff.supabase
      .from('client_contact_footer_policies')
      .select('requirement,format_template,review_state,provenance_summary,last_verified_at')
      .eq('client_id', clientId)
      .eq('content_mode', 'caption')
      .is('platform', null)
    const scopeKey = typeof input.scope_key === 'string' ? input.scope_key : null
    contactsQuery = scopeKey ? contactsQuery.eq('scope_key', scopeKey) : contactsQuery.is('scope_key', null)
    policyQuery = scopeKey ? policyQuery.eq('scope_key', scopeKey) : policyQuery.is('scope_key', null)
    const [contactsResult, policyResult] = await Promise.all([contactsQuery, policyQuery.maybeSingle()])
    if (contactsResult.error || policyResult.error) {
      contactFooter = {
        status: 'unavailable',
        contacts: [],
        can_generate_footer: false,
        reason: 'Exact-client contact/footer policy could not be verified.',
      }
    } else {
      const eligible = (contactsResult.data ?? [])
        .filter((contact: Record<string, unknown>) =>
          contact.approved_for_caption === true &&
          contact.visibility === 'public_marketing' &&
          contact.freshness_state === 'current_verified' &&
          contact.lifecycle_state === 'active' &&
          (!Array.isArray(contact.content_modes) || contact.content_modes.length === 0 || contact.content_modes.includes('caption')))
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.footer_order) - Number(b.footer_order))
      const held = (contactsResult.data ?? []).filter((contact: Record<string, unknown>) =>
        contact.lifecycle_state === 'active' &&
        (contact.blocks_caption === true || ['possible_change', 'stale_unverified'].includes(String(contact.freshness_state))))
      const policy = policyResult.data
      const valuesByType = new Map<string, Set<string>>()
      for (const contact of eligible) {
        const type = String(contact.contact_type)
        const values = valuesByType.get(type) ?? new Set<string>()
        values.add(String(contact.value))
        valuesByType.set(type, values)
      }
      const ambiguous = [...valuesByType.values()].some(values => values.size > 1)
      const blocked = !policy || policy.review_state !== 'current_verified' || ambiguous || held.some((contact: Record<string, unknown>) => contact.blocks_caption === true) || (policy.requirement === 'mandatory' && eligible.length === 0)
      contactFooter = {
        status: blocked ? 'not_ready' : 'ready',
        requirement: policy?.requirement ?? 'unresolved',
        format_template: blocked ? null : policy?.format_template ?? null,
        contacts: blocked ? [] : eligible.map((contact: Record<string, unknown>) => ({
          contact_type: contact.contact_type,
          display_label: contact.display_label,
          person_name: contact.person_name,
          person_role: contact.person_role,
          value: contact.value,
          provenance: contact.provenance_summary,
          last_verified_at: contact.last_verified_at,
        })),
        can_generate_footer: !blocked && policy?.requirement !== 'omitted',
        reason: !policy
          ? 'No current exact-client footer policy is recorded for this exact scope.'
          : blocked
            ? 'Exact-client footer/contact evidence is unresolved. Continue unrelated creative work, but do not invent a footer.'
            : null,
        exact_scope_only: true,
      }
    }
  }

  // Record that this exact client's live runtime was actually used. The standalone
  // get-client-context function already does this; the MCP tool did not, so a Project
  // driven through the connector left last_context_retrieved_at null even on success and
  // there was no way to tell real runtime usage from a Project answering without it.
  // Best-effort: a telemetry write must never fail the client context response.
  try {
    await staff.supabase
      .from('client_project_mappings')
      .update({ last_context_retrieved_at: new Date().toISOString() })
      .eq('client_id', clientId)
  } catch { /* telemetry only */ }

  return {
    client: { id: client.id, name: client.name },
    task_type: input.task_type,
    scope_key: input.scope_key ?? null,
    runtime_readiness: 'ready',
    client_guide: guide
      ? {
          id: guide.id,
          version: guide.version,
          generated_at: guide.generated_at,
          source_pack_path: guide.source_pack_path,
          source_revision: guide.source_revision,
          source_observed_at: guide.source_observed_at,
          guide_markdown: guide.guide_markdown,
          project_instructions: guide.project_instructions,
        }
      : null,
    contact_footer: contactFooter,
    context_coverage: {
      client_guide: guide ? 'available' : (guideError ? 'unavailable' : 'none_recorded'),
      unavailable_sources: unavailable,
      note: guide
        ? 'Exact-client guide resolved by exact client_id. No sibling, group or national fallback was used.'
        : 'No canonical client guide is recorded for this exact client. Do not substitute another client, a group/national record, or stale Project memory.',
    },
    errors: unavailable,
  }
}

const handleListMyLeads: ToolHandler = async (staff, input) => {
  const hasTable = await tableExists(staff.supabase, 'business_development_leads')
  if (!hasTable) return { error: 'Lead workspace not yet available. Complete #305 setup first.' }

  const query = staff.supabase
    .from('business_development_leads')
    .select('id, company_name, website_url, industry, location, stage, qualification, qualification_summary, last_action, next_action, follow_up_at, created_at, updated_at')
    .eq('owner_profile_id', staff.profileId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (input.stage) query.eq('stage', input.stage)

  const { data, error } = await query
  return { leads: data ?? [], error: error?.message ?? null }
}

const handleGetLead: ToolHandler = async (staff, input) => {
  const hasTable = await tableExists(staff.supabase, 'business_development_leads')
  if (!hasTable) return { error: 'Lead workspace not yet available.' }

  const leadId = input.lead_id as string
  const { data: lead, error } = await staff.supabase
    .from('business_development_leads')
    .select('id, company_name, website_url, industry, location, contact_name, contact_title, contact_email, contact_phone, stage, qualification, qualification_summary, last_action, last_action_at, next_action, follow_up_at, source_kind, source_url, confidence, do_not_contact, created_at, updated_at')
    .eq('id', leadId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!lead) return { error: 'Lead not found.' }
  if (lead.owner_profile_id !== staff.profileId && staff.role === 'staff') {
    return { error: 'You can only read your own leads.' }
  }

  const [researchResult, eventsResult] = await Promise.all([
    staff.supabase
      .from('business_development_lead_research')
      .select('id, entry_type, summary, source_url, source_title, observed_at, confidence, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20),
    staff.supabase
      .from('business_development_lead_events')
      .select('id, event_type, state_snapshot, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return {
    lead,
    research: researchResult.data ?? [],
    events: eventsResult.data ?? [],
  }
}

const handleCreateTask: ToolHandler = async (staff, input) => {
  const { data, error } = await staff.supabase.rpc('create_assistant_task', {
    p_title: input.title,
    p_assignee_name: input.assignee_name ?? staff.fullName,
    p_due_date: input.due_date ?? null,
    p_client_id: input.client_id ?? null,
    p_client_name: input.client_name ?? null,
    p_notes: input.notes ?? null,
    // The service-role connection has no auth.uid(); the RPC trusts this only for the service role.
    p_actor_profile_id: staff.profileId,
  })

  if (error) return { error: error.message }
  return { task: data, message: 'Task created.' }
}

const handleUpdateTask: ToolHandler = async (staff, input) => {
  const action = input.action as string
  const taskId = input.task_id as string

  if (action === 'reopen') {
    return { error: 'Task reopen is not yet supported through the MCP connector. Use the Dynamics UI or request the canonical reopen extension.' }
  }

  const { data, error } = await staff.supabase.rpc('update_assistant_task', {
    p_task_id: taskId,
    p_action: action,
    p_due_date: input.due_date ?? null,
    p_comment: input.note ?? null,
    // The service-role connection has no auth.uid(); the RPC trusts this only for the service role.
    p_actor_profile_id: staff.profileId,
  })

  if (error) return { error: error.message }
  return { task: data, message: `Task ${action} applied.` }
}

const handleUpdateLead: ToolHandler = async (staff, input) => {
  const hasTable = await tableExists(staff.supabase, 'business_development_leads')
  if (!hasTable) return { error: 'Lead workspace not yet available.' }

  const leadId = input.lead_id as string
  const { data: existing } = await staff.supabase
    .from('business_development_leads')
    .select('owner_profile_id')
    .eq('id', leadId)
    .maybeSingle()

  if (!existing) return { error: 'Lead not found.' }
  if (existing.owner_profile_id !== staff.profileId && staff.role === 'staff') {
    return { error: 'You can only update your own leads.' }
  }

  const updateFields: Record<string, unknown> = {}
  for (const key of ['stage', 'qualification', 'qualification_summary', 'last_action', 'next_action', 'follow_up_at', 'source_url', 'do_not_contact', 'archived_at']) {
    if (input[key] !== undefined) updateFields[key] = input[key]
  }

  const { data, error } = await staff.supabase
    .from('business_development_leads')
    .update(updateFields)
    .eq('id', leadId)
    .select()
    .single()

  if (error) return { error: error.message }
  return { lead: data, message: 'Lead updated.' }
}

const handleAddLeadResearch: ToolHandler = async (staff, input) => {
  const hasTable = await tableExists(staff.supabase, 'business_development_lead_research')
  if (!hasTable) return { error: 'Lead research workspace not yet available.' }

  const leadId = input.lead_id as string
  const { data: existing } = await staff.supabase
    .from('business_development_leads')
    .select('owner_profile_id, archived_at')
    .eq('id', leadId)
    .maybeSingle()

  if (!existing) return { error: 'Lead not found.' }
  if (existing.archived_at) return { error: 'Cannot add research to an archived lead.' }
  if (existing.owner_profile_id !== staff.profileId && staff.role === 'staff') {
    return { error: 'You can only add research to your own leads.' }
  }

  const { data, error } = await staff.supabase
    .from('business_development_lead_research')
    .insert({
      lead_id: leadId,
      created_by: staff.profileId,
      entry_type: 'observation',
      summary: input.summary,
      source_url: input.source_url ?? null,
      confidence: 'needs_review',
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { research: data, message: 'Research appended.' }
}

const handleGetMyProfile: ToolHandler = async (staff) => {
  const hasTable = await tableExists(staff.supabase, 'staff_assistant_profiles')
  if (!hasTable) {
    // The canonical policy must still reach the Project even before the staff workspace
    // exists, otherwise a fresh chat falls back to stale Project Instructions (#325).
    return {
      staff_assistant_policy: buildStaffAssistantPolicy(staff.contextKind),
      policy_meta: {
        policy_version: STAFF_ASSISTANT_POLICY_VERSION,
        effective_at: STAFF_ASSISTANT_POLICY_EFFECTIVE_AT,
        context_kind: staff.contextKind,
        retrieved_at: new Date().toISOString(),
      },
      identity: { profile_id: staff.profileId, full_name: staff.fullName, role: staff.role, is_active: staff.isActive, context_kind: staff.contextKind },
      assistant_profile: null,
      error: 'Staff assistant workspace not yet available. Complete #305 setup first.',
    }
  }

  const { data, error } = await staff.supabase
    .from('staff_assistant_profiles')
    .select('profile_id, responsibilities, recurring_duties, working_preferences, output_preferences, lead_research_criteria, repeated_corrections, common_task_types, approved_access_scope, chatgpt_project_name, chatgpt_project_url, instructions_version, instructions_refreshed_at, instructions_applied_at, profile_verified_at, created_at, updated_at')
    .eq('profile_id', staff.profileId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { profile: null, message: 'No assistant profile yet. Use update_my_preferences to create one.' }
  return { profile: data }
}

const handleUpdateMyPreferences: ToolHandler = async (staff, input) => {
  const hasTable = await tableExists(staff.supabase, 'staff_assistant_profiles')
  if (!hasTable) return { error: 'Staff assistant workspace not yet available. Complete #305 setup first.' }

  const { data: existing } = await staff.supabase
    .from('staff_assistant_profiles')
    .select('responsibilities, recurring_duties, working_preferences, output_preferences, lead_research_criteria, repeated_corrections, common_task_types')
    .eq('profile_id', staff.profileId)
    .maybeSingle()

  const merged = {
    responsibilities: input.responsibilities ?? existing?.responsibilities ?? [],
    recurring_duties: input.recurring_duties ?? existing?.recurring_duties ?? [],
    working_preferences: input.working_preferences ?? existing?.working_preferences ?? [],
    output_preferences: input.output_preferences ?? existing?.output_preferences ?? [],
    lead_research_criteria: input.lead_research_criteria ?? existing?.lead_research_criteria ?? [],
    repeated_corrections: input.repeated_corrections ?? existing?.repeated_corrections ?? [],
    common_task_types: input.common_task_types ?? existing?.common_task_types ?? [],
  }

  const { data, error } = await staff.supabase.rpc('save_my_staff_assistant_profile', {
    p_responsibilities: merged.responsibilities,
    p_recurring_duties: merged.recurring_duties,
    p_working_preferences: merged.working_preferences,
    p_output_preferences: merged.output_preferences,
    p_lead_research_criteria: merged.lead_research_criteria,
    p_repeated_corrections: merged.repeated_corrections,
    p_common_task_types: merged.common_task_types,
    p_chatgpt_project_name: existing?.chatgpt_project_name ?? null,
    p_chatgpt_project_url: existing?.chatgpt_project_url ?? null,
    p_project_instructions: '',  // will be regenerated by the RPC
    p_confirm_instructions_applied: false,
    // The service-role connection has no auth.uid(); the RPC trusts this only for the service role.
    p_actor_profile_id: staff.profileId,
  })

  if (error) return { error: error.message }
  return { profile: data, message: 'Preferences updated.' }
}

const handleGetMyAssistantBootstrap: ToolHandler = async (staff) => {
  const staffAssistantPolicy = buildStaffAssistantPolicy(staff.contextKind)
  const dailyUpdateContract = buildDailyUpdateContract(staff.fullName)
  const policyMeta = {
    policy_version: STAFF_ASSISTANT_POLICY_VERSION,
    presentation_version: ASSISTANT_PRESENTATION_VERSION,
    effective_at: STAFF_ASSISTANT_POLICY_EFFECTIVE_AT,
    context_kind: staff.contextKind,
    retrieved_at: new Date().toISOString(),
  }
  const identity = { profile_id: staff.profileId, full_name: staff.fullName, role: staff.role, is_active: staff.isActive, context_kind: staff.contextKind }

  const hasTable = await tableExists(staff.supabase, 'staff_assistant_profiles')
  if (!hasTable) return {
    staff_assistant_policy: staffAssistantPolicy,
    daily_update_contract: dailyUpdateContract,
    policy_meta: policyMeta,
    identity,
    assistant_profile: null,
    error: 'Staff assistant workspace not yet available. Complete #305 setup first.',
  }

  const { data: profile, error: profileError } = await staff.supabase
    .from('staff_assistant_profiles')
    .select('profile_id, responsibilities, recurring_duties, working_preferences, output_preferences, lead_research_criteria, repeated_corrections, common_task_types, approved_access_scope, project_instructions, instructions_version, instructions_refreshed_at, instructions_applied_at, profile_verified_at, preferred_company_from, professional_display_name, role_title, approved_work_phone, signature_text, signature_asset_reference, email_setup_status, mail_scope, approved_collateral_set')
    .eq('profile_id', staff.profileId)
    .maybeSingle()

  if (profileError) return {
    staff_assistant_policy: staffAssistantPolicy,
    daily_update_contract: dailyUpdateContract,
    policy_meta: policyMeta,
    identity,
    assistant_profile: null,
    error: `Staff profile unavailable: ${profileError.message}`,
  }

  const scopes = profile?.approved_access_scope ?? []
  const capabilities = filterCapabilitiesByScope(scopes)

  const mcpTools = CG_DYNAMICS_MCP_TOOLS.map(t => ({
    name: t.name,
    title: t.title,
    description: t.description,
    dependency: t.dependency,
    readOnly: t.annotations.readOnlyHint,
  }))

  // Mail scope and sender readiness for bootstrap
  const mailScope = profile?.mail_scope ?? 'owned_threads_only'
  const senderReady = !!(profile?.preferred_company_from && profile?.signature_text)

  return {
    // #325: the canonical shared runtime policy. This OVERRIDES any stale hand-maintained
    // ChatGPT Project Instruction wording (e.g. "Dynamics is fallback-only").
    staff_assistant_policy: staffAssistantPolicy,
    policy_meta: policyMeta,
    identity,
    assistant_profile: profile ? {
      responsibilities: profile.responsibilities,
      recurring_duties: profile.recurring_duties,
      working_preferences: profile.working_preferences,
      output_preferences: profile.output_preferences,
      lead_research_criteria: profile.lead_research_criteria,
      repeated_corrections: profile.repeated_corrections,
      common_task_types: profile.common_task_types,
      approved_access_scope: profile.approved_access_scope,
      instructions_version: profile.instructions_version,
      instructions_refreshed_at: profile.instructions_refreshed_at,
    } : null,
    mail_readiness: profile ? {
      mail_scope: mailScope,
      email_setup_status: profile.email_setup_status,
      preferred_company_from: profile.preferred_company_from,
      professional_display_name: profile.professional_display_name,
      role_title: profile.role_title,
      approved_work_phone: profile.approved_work_phone,
      signature_configured: !!profile.signature_text,
      signature_asset_reference: profile.signature_asset_reference,
      approved_collateral_set: profile.approved_collateral_set ?? [],
      sender_ready: senderReady,
      instructions: senderReady
        ? [
            'Your email sender identity and professional signature are configured.',
            'You may compose drafts using compose_mail_draft.',
            'STAFF EMAIL IS DRAFT-ONLY: never send directly.',
            'After creating a draft, review content, verify correct CG From identity, verify correct professional signature, then send manually.',
            mailScope === 'company_mail_manager'
              ? 'Your scope: company_mail_manager — you may triage and draft replies for the full authorised CG inbox.'
              : 'Your scope: owned_threads_only — email only for leads/tasks you own or materially participate in.',
          ]
        : [
            'EMAIL SETUP REQUIRED WITH CA.',
            'Your approved CG company From identity or professional signature is not yet configured.',
            'Contact CA to set up your email sender identity and professional signature before drafting emails.',
            'Drafts created without proper sender identity will be flagged for manual review.',
          ],
    } : null,
    capability_manifest: capabilities.map(cap => ({
      key: cap.key,
      label: cap.label,
      description: cap.description,
      usefulFor: cap.usefulFor,
      exampleActions: cap.exampleActions,
      operatingStandards: cap.operatingStandards,
      expectedConnectedInCompanyWorkspace: cap.expectedConnectedInCompanyWorkspace,
      sessionMissingGuidance: cap.sessionMissingGuidance,
    })),
    daily_update_contract: dailyUpdateContract,
    mcp_tools: mcpTools,
    operating_rules: [
      'CG Dynamics is the durable source of truth. Retrieve current personal operating context before operational work.',
      'All CG company capabilities in this manifest are company-standard and expected to be connected. Before claiming a capability is unavailable, inspect the tools/plugins actually available in the current ChatGPT session and try the relevant connected tool.',
      'If a company-standard capability is missing from this session, report it as a session/account issue (try reconnecting or using the correct CG workspace account). Never claim CG fundamentally cannot do the task.',
      'Distinguish company-standard (always true for CG) from available-in-this-session (runtime result). The absence of a tool in one session does not change the company-standard fact.',
      'When a request can be materially reduced by a connected tool, proactively offer or perform the work within permission rules.',
      'Use exact client IDs and canonical CG standards for file/task/client actions.',
      'Never invent ownership, deadlines, status, or a second task list.',
      'Never merge CG Calendar and Client Schedule.',
      'Never retrieve another staff member\'s private assistant profile.',
      'All writes through this MCP are audited and idempotent.',
      'Gmail remains the actual draft/thread system. Dynamics stores only staff mail config, collateral references, lead linkage, follow-up state, provenance and audit metadata — never draft content.',
      'STAFF EMAIL IS DRAFT-ONLY: never send email directly, even if the connected Gmail/mail plugin technically supports sending.',
      'After the Gmail plugin creates a draft, explicitly instruct staff to: review content, verify correct CG From identity, verify correct professional signature, then send manually.',
      'Normal staff = owned_threads_only: email only for leads/tasks you own or materially participate in. Not general inbox managers.',
      'Amonique = company_mail_manager: full authorised CG inbox triage, read, reply-draft preparation, but still requires human review + correct From + correct signature + manual send.',
      'Attach governed collateral by Drive asset key — never freeze binary IDs into Project Instructions and never use stale/superseded collateral.',
      'DAILY UPDATE CONTRACT: morning = greeting → summary → Today timeline → Work Queue → optional blocker → action prompt. Evening = closing → Done Today → Still Open → Tomorrow → Prep.',
      'PERSONALITY: derived from staff profile (working_preferences, output_preferences, repeated_corrections). Never hardcode tone across staff. Personality belongs in greeting/closing; work body stays operational.',
      'NATURAL TASK REPLIES: during coexistence, "done", "50%", "waiting on client", "move to Friday", "add note" and "follow up Monday" update the exact live Teams/Planner task first, then run_microsoft_sync refreshes Dynamics. If reconciliation is delayed, report DYNAMICS SYNC PENDING; never duplicate the Microsoft-backed task.',
      'CONTENT-RUN CLOSEOUT: When a staff member had client shoots/content runs that day, use get_content_run_plan to retrieve the canonical shot list, then collect per-client field updates, reconcile planned vs captured items, record missed/cancelled items with reasons, capture field notes, flag reshoots, verify OneDrive upload status and write approved updates to Dynamics via close_content_run. Never ask staff to recreate a plan already in Dynamics. Never mark closeout complete if upload is missing/partial/unverified.',
      'ONEDRIVE UPLOAD GATE: For every content run, use verify_content_run_upload to inspect the exact mapped client/content-run folder. If footage is missing/partial/unverified, keep the item unresolved and give the staff member the exact next action. After staff approval, use update_closeout_upload_status; it performs a fresh authorised inspection and persists only that evidence. Staff self-report alone always remains unverified.',
    ],
    message: profile
      ? `Bootstrap ready for ${staff.fullName}. This payload contains your durable profile, mail readiness, capability manifest, MCP tools and operating rules. Use it to initialise a fresh Project.`
      : `No assistant profile found for ${staff.fullName}. Use update_my_preferences to create one, then call bootstrap again.`,
  }
}

const handleGetMyRecurringTasks: ToolHandler = async (staff) => {
  const { data, error } = await staff.supabase
    .from('planner_tasks')
    .select('id, title, assigned_to_name, due_date, status, notes, client_name, client_id, recurrence_rule, recurrence_until, created_at, updated_at')
    .eq('assigned_to_name', staff.fullName)
    .not('recurrence_rule', 'is', null)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  return { templates: data ?? [], error: error?.message ?? null }
}

const handleCreateRecurringTask: ToolHandler = async (staff, input) => {
  const { data, error } = await staff.supabase.rpc('create_assistant_recurring_task', {
    p_title: input.title,
    p_recurrence_rule: input.recurrence_rule,
    p_recurrence_until: input.recurrence_until ?? null,
    p_assignee_name: input.assignee_name ?? staff.fullName,
    p_client_id: input.client_id ?? null,
    p_client_name: input.client_name ?? null,
    p_notes: input.notes ?? null,
    // The service-role connection has no auth.uid(); the RPC trusts this only for the service role.
    p_actor_profile_id: staff.profileId,
  })

  if (error) return { error: error.message }
  return { template: data, message: 'Recurring task template created. Instances will be materialised automatically within a 14-day window.' }
}

// ── Mail Draft Handler (HARD DRAFT-ONLY GATE) ───────────────────────────────
//
// compose_mail_draft does NOT create a Dynamics mail_drafts table.
// Gmail remains the actual draft/thread system. Dynamics stores only:
//   - staff mail configuration (preferred_from, signature, setup_status, scope)
//   - governed collateral references (asset keys, not frozen IDs)
//   - lead/thread linkage, follow-up state, provenance, audit metadata
//
// This handler returns a complete governed Gmail draft payload that ChatGPT
// passes to the connected Gmail plugin to create the real draft. Staff must
// then manually review, verify From/identity/signature, and send.

const GOVERNED_COLLATERAL: Record<string, { label: string; drive_asset_key: string; description: string }> = {
  cg_business_profile: {
    label: 'CG Business Profile (compressed)',
    drive_asset_key: 'collateral/cg-business-profile-latest.pdf',
    description: 'Current approved CG business profile PDF. Attach to new prospective-client lead emails and outreach by default.',
  },
  cg_wedding_packages: {
    label: 'CG Wedding Packages',
    drive_asset_key: 'collateral/cg-wedding-packages-latest.pdf',
    description: 'Current approved CG wedding packages PDF. Attach to wedding-related enquiries and responses by default.',
  },
}

const handleComposeMailDraft: ToolHandler = async (staff, input) => {
  const hasTable = await tableExists(staff.supabase, 'staff_assistant_profiles')
  if (!hasTable) return { error: 'Staff assistant workspace not yet available. Complete #305 setup first.' }

  const { data: profile, error: profileError } = await staff.supabase
    .from('staff_assistant_profiles')
    .select('profile_id, preferred_company_from, professional_display_name, role_title, approved_work_phone, signature_text, signature_asset_reference, email_setup_status, mail_scope, approved_collateral_set')
    .eq('profile_id', staff.profileId)
    .maybeSingle()

  if (profileError) return { error: profileError.message }

  if (!profile) return { error: 'No assistant profile found. Create your profile first with update_my_preferences.' }

  if (profile.email_setup_status !== 'ready') {
    return {
      error: 'EMAIL SETUP REQUIRED WITH CA',
      detail: 'Your email sender identity and professional signature are not yet configured. Contact CA to set up your approved CG company From identity and professional signature before drafting emails.',
      email_setup_status: profile.email_setup_status,
      mail_scope: profile.mail_scope,
    }
  }

  if (!profile.preferred_company_from || !profile.signature_text) {
    return {
      error: 'EMAIL SETUP REQUIRED WITH CA',
      detail: 'Your approved CG company From identity or professional signature is missing. Contact CA to configure these before drafting emails.',
      email_setup_status: profile.email_setup_status,
      missing_fields: [
        ...(!profile.preferred_company_from ? ['preferred_company_from'] : []),
        ...(!profile.signature_text ? ['signature_text'] : []),
      ],
    }
  }

  // Scope check: normal staff = owned_threads_only
  if (profile.mail_scope === 'owned_threads_only' && input.lead_id) {
    const { data: lead } = await staff.supabase
      .from('business_development_leads')
      .select('owner_profile_id, company_name, contact_name')
      .eq('id', input.lead_id)
      .maybeSingle()

    if (lead && lead.owner_profile_id !== staff.profileId) {
      return { error: 'You can only compose drafts for leads you own or are materially involved in. This lead is owned by another staff member.' }
    }
  }

  // Build governed collateral list with resolved asset references
  const collateralRefs: Array<{ key: string; label: string; drive_asset_key: string }> = []
  if (input.collateral?.length) {
    for (const ref of input.collateral) {
      const governed = GOVERNED_COLLATERAL[ref]
      if (governed) {
        collateralRefs.push({ key: ref, label: governed.label, drive_asset_key: governed.drive_asset_key })
      } else {
        collateralRefs.push({ key: ref, label: ref, drive_asset_key: ref })
      }
    }
  }
  if (input.include_business_profile && !collateralRefs.find(c => c.key === 'cg_business_profile')) {
    collateralRefs.push(GOVERNED_COLLATERAL.cg_business_profile)
  }
  if (input.include_wedding_packages && !collateralRefs.find(c => c.key === 'cg_wedding_packages')) {
    collateralRefs.push(GOVERNED_COLLATERAL.cg_wedding_packages)
  }

  // Compose the draft body with approved signature appended
  const signatureBlock = profile.signature_text
    ? `\n\n--\n${profile.signature_text}`
    : ''

  const bodyWithSignature = input.body + signatureBlock

  // Return governed Gmail draft payload — ChatGPT uses the connected Gmail
  // plugin to create the real draft. No Dynamics table write for draft content.
  return {
    gmail_draft_payload: {
      to: input.to_address,
      subject: input.subject,
      body: bodyWithSignature,
      ...(input.draft_id ? { draft_id: input.draft_id } : {}),
    },
    sender: {
      from: profile.preferred_company_from,
      display_name: profile.professional_display_name,
      role_title: profile.role_title,
      work_phone: profile.approved_work_phone,
      signature_asset_ref: profile.signature_asset_reference,
    },
    collateral_to_attach: collateralRefs.map(c => ({
      label: c.label,
      drive_asset_key: c.drive_asset_key,
      instruction: `Retrieve the current approved ${c.label} from Google Drive by governed asset key: ${c.drive_asset_key}. Attach to the Gmail draft. Never use a stale or superseded version.`,
    })),
    lead_linkage: input.lead_id ? {
      lead_id: input.lead_id,
      activity_type: 'outbound_draft',
      summary: `Draft prepared: ${input.subject}`,
      thread_reference: input.draft_id ?? null,
    } : null,
    manual_send_instructions: [
      'HARD RULE: DO NOT SEND THIS EMAIL AUTOMATICALLY.',
      '1. Use the Gmail plugin to create the draft with the payload above.',
      '2. Retrieve and attach the governed collateral from Google Drive by asset key.',
      '3. Review the draft content for accuracy and professionalism.',
      '4. In your Gmail client, verify the correct CG From identity is selected (not the raw Gmail address).',
      '5. Verify the correct professional signature/banner is visible.',
      '6. Send the email manually from Gmail.',
      'Gmail plugin send-email actions must NOT be used for CG outreach. This policy overrides connector capability.',
    ],
    provenance: {
      prepared_by_profile_id: staff.profileId,
      prepared_at: new Date().toISOString(),
      idempotency_key: input.idempotency_key,
      mail_scope: profile.mail_scope,
    },
  }
}

// ── Lead Email Activity Write-Back ──────────────────────────────────────────

const handleLogLeadEmailActivity: ToolHandler = async (staff, input) => {
  const hasTable = await tableExists(staff.supabase, 'business_development_leads')
  if (!hasTable) return { error: 'Lead management not yet available. Complete #305 setup first.' }

  const { data: lead, error: leadError } = await staff.supabase
    .from('business_development_leads')
    .select('id, owner_profile_id, last_action, last_action_at, next_action, follow_up_at')
    .eq('id', input.lead_id)
    .maybeSingle()

  if (leadError) return { error: leadError.message }
  if (!lead) return { error: 'Lead not found.' }

  // Scope check: normal staff = owned_threads_only
  if (lead.owner_profile_id !== staff.profileId) {
    return { error: 'You can only log email activity for leads you own.' }
  }

  const now = new Date().toISOString()
  const activitySummary = `[${input.activity_type}] ${input.summary}`

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    last_action: activitySummary,
    last_action_at: now,
  }

  if (input.next_action) {
    updatePayload.next_action = input.next_action
  }
  if (input.follow_up_at) {
    updatePayload.follow_up_at = input.follow_up_at
  }

  const { data: updated, error: updateError } = await staff.supabase
    .from('business_development_leads')
    .update(updatePayload)
    .eq('id', input.lead_id)
    .select('id, last_action, last_action_at, next_action, follow_up_at')
    .maybeSingle()

  if (updateError) return { error: updateError.message }

  // Append to lead research as a record of the email activity
  const { error: researchError } = await staff.supabase
    .from('business_development_lead_research')
    .insert({
      lead_id: input.lead_id,
      created_by: staff.profileId,
      entry_type: 'outreach_result',
      summary: activitySummary,
      source_url: input.thread_reference ?? null,
      source_title: `Email ${input.activity_type}`,
      observed_at: now,
      confidence: 'supported',
    })

  if (researchError) {
    // Non-fatal: activity logged to lead fields even if research append fails
    console.error('Failed to append lead research:', researchError.message)
  }

  return {
    lead_activity: updated,
    message: `Email activity (${input.activity_type}) logged to lead. ${input.next_action ? 'Next action updated.' : ''} ${input.follow_up_at ? 'Follow-up scheduled.' : ''}`,
  }
}

async function handleGetContentRunPlan(staff: AuthenticatedStaff, input: Record<string, unknown>) {
  const runId = input.content_run_id as string
  const { data: run, error: runError } = await staff.supabase
    .from('content_runs')
    .select('id, client_id, client_name, name, run_date, start_time, location, status')
    .eq('id', runId)
    .maybeSingle()

  if (runError) return { error: runError.message }
  if (!run) return { error: 'Content Run not found.' }
  if (!run.client_id) return { error: 'Content Run has no exact client assigned.' }
  // A client Project may only read its own runs, even under the shared admin connection.
  const runScope = assertRecordClientMatchesContext(staff.contextKind, staff.effectiveClientId, run.client_id as string, 'content run')
  if (!runScope.allowed) return { error: runScope.error }

  const { data: guideline, error: guidelineError } = await staff.supabase
    .from('content_guidelines')
    .select('id, content_run_id, client_id, title, month, status')
    .eq('content_run_id', runId)
    .eq('client_id', run.client_id)
    .maybeSingle()

  if (guidelineError) return { error: guidelineError.message }

  const { data: runItems, error: runItemsError } = await staff.supabase
    .from('content_run_items')
    .select('id, run_id, guide_idea_id, sort_order, title, shot_notes, requirements, completed')
    .eq('run_id', runId)
    .order('sort_order', { ascending: true })

  if (runItemsError) return { error: runItemsError.message }

  let guidelineVideos: Array<Record<string, unknown>> = []
  if (guideline) {
    const { data, error } = await staff.supabase
      .from('content_guide_ideas')
      .select('id, content_guideline_id, client_id, title, objective, platform, format, hook, script, shot_breakdown, requirements, position, status')
      .eq('content_guideline_id', guideline.id)
      .eq('client_id', run.client_id)
      .neq('status', 'archived')
      .order('position', { ascending: true })

    if (error) return { error: error.message }
    guidelineVideos = data ?? []
  }

  const videosById = new Map(guidelineVideos.map(video => [video.id, video]))
  const linkedVideoIds = new Set<string>()
  const plannedItems = (runItems ?? []).map(item => {
    const video = item.guide_idea_id ? videosById.get(item.guide_idea_id) : undefined
    if (video && typeof video.id === 'string') linkedVideoIds.add(video.id)
    return {
      source: video ? 'content_guideline_video' : 'content_run_item',
      run_item_id: item.id,
      guideline_item_id: video?.id ?? null,
      position: item.sort_order,
      name: item.title ?? video?.title ?? null,
      platform: video?.platform ?? null,
      format: video?.format ?? null,
      objective: video?.objective ?? null,
      hook: video?.hook ?? null,
      script: video?.script ?? null,
      shot_breakdown: video?.shot_breakdown ?? null,
      shot_notes: item.shot_notes,
      requirements: item.requirements ?? video?.requirements ?? null,
      completed: item.completed,
    }
  })

  for (const video of guidelineVideos) {
    if (typeof video.id !== 'string' || linkedVideoIds.has(video.id)) continue
    plannedItems.push({
      source: 'content_guideline_video',
      run_item_id: null,
      guideline_item_id: video.id,
      position: typeof video.position === 'number' ? video.position : plannedItems.length + 1,
      name: video.title ?? null,
      platform: video.platform ?? null,
      format: video.format ?? null,
      objective: video.objective ?? null,
      hook: video.hook ?? null,
      script: video.script ?? null,
      shot_breakdown: video.shot_breakdown ?? null,
      shot_notes: null,
      requirements: video.requirements ?? null,
      completed: false,
    })
  }

  plannedItems.sort((left, right) => left.position - right.position)

  return {
    content_run: run,
    content_guideline: guideline ?? null,
    planned_items: plannedItems,
    source: 'canonical Dynamics Content Run and Content Guideline records',
  }
}

async function handleGetContentRunCloseout(staff: AuthenticatedStaff, input: Record<string, unknown>) {
  const scopeError = await assertRunInClientScope(staff, input.content_run_id)
  if (scopeError) return scopeError

  const { data, error } = await staff.supabase
    .rpc('get_content_run_closeout', {
      p_actor_profile_id: staff.profileId,
      p_content_run_id: input.content_run_id,
    })

  if (error) return { error: error.message }
  return data
}

async function handleVerifyContentRunUpload(staff: AuthenticatedStaff, input: Record<string, unknown>) {
  const runId = input.content_run_id as string
  const { data: run, error: runError } = await staff.supabase
    .from('content_runs')
    .select('id, client_id, client_name, name, run_date')
    .eq('id', runId)
    .maybeSingle()

  if (runError) return { error: runError.message }
  if (!run) return { error: 'Content Run not found.' }
  if (!run.client_id) {
    return {
      content_run: { id: run.id, name: run.name, run_date: run.run_date },
      exact_client: null,
      evidence: unavailableOneDriveEvidence('content_run_has_no_exact_client'),
    }
  }
  // A client Project may only verify its own runs, even under the shared admin connection.
  const uploadScope = assertRecordClientMatchesContext(staff.contextKind, staff.effectiveClientId, run.client_id as string, 'content run')
  if (!uploadScope.allowed) return { error: uploadScope.error }

  const { data: mappingResult, error: mappingError } = await staff.supabase
    .rpc('get_content_run_onedrive_folder', { p_content_run_id: runId })

  if (mappingError) {
    return {
      content_run: { id: run.id, name: run.name, run_date: run.run_date },
      exact_client: { id: run.client_id, name: run.client_name },
      evidence: unavailableOneDriveEvidence('canonical_content_run_mapping_contract_unavailable'),
    }
  }

  const mapping = Array.isArray(mappingResult) ? mappingResult[0] : mappingResult
  const mappingValidation = validateExactContentRunFolderMapping(mapping, run.id, run.client_id)
  if (!mappingValidation.ok) {
    return {
      content_run: { id: run.id, name: run.name, run_date: run.run_date },
      exact_client: { id: run.client_id, name: run.client_name },
      evidence: unavailableOneDriveEvidence(mappingValidation.blocker),
    }
  }
  const exactMapping = mappingValidation.mapping

  const adapter = await import('../client-onboarding/onedrive-adapter.ts') as unknown as OneDriveReadAdapter
  if (!adapter.getItem || !adapter.listChildren) {
    return {
      content_run: { id: run.id, name: run.name, run_date: run.run_date },
      exact_client: { id: run.client_id, name: run.client_name },
      mapped_folder: { name: exactMapping.folder_name ?? null },
      evidence: unavailableOneDriveEvidence('delegated_onedrive_folder_reader_unavailable'),
    }
  }

  const folder = await adapter.getItem(exactMapping.drive_id, exactMapping.month_folder_item_id)
  const folderBlocker = validateExactFolderMetadata(folder, exactMapping)
  if (folderBlocker || !folder) {
    return {
      content_run: { id: run.id, name: run.name, run_date: run.run_date },
      exact_client: { id: run.client_id, name: run.client_name },
      mapped_folder: { name: exactMapping.folder_name ?? null },
      evidence: unavailableOneDriveEvidence(folderBlocker ?? 'authorised_folder_metadata_unavailable'),
    }
  }

  const { data: closeout } = await staff.supabase
    .from('content_run_closeouts')
    .select('completed_items')
    .eq('content_run_id', runId)
    .maybeSingle()
  const expectedMediaFileCount = Array.isArray(closeout?.completed_items) && closeout.completed_items.length > 0
    ? closeout.completed_items.length
    : null
  const evidence = await inspectExactOneDriveFolder(
    adapter,
    exactMapping.drive_id,
    exactMapping.month_folder_item_id,
    expectedMediaFileCount,
  )
  return {
    content_run: { id: run.id, name: run.name, run_date: run.run_date },
    exact_client: { id: run.client_id, name: run.client_name },
    mapped_folder: { name: folder.name },
    inspected_at: new Date().toISOString(),
    evidence,
    source: 'authorised delegated OneDrive inspection of the exact durable content-run folder mapping',
    persistence_note: 'Use update_closeout_upload_status only after staff approval; pass the lowercase evidence status. Staff self-report alone remains unverified.',
  }
}

/**
 * In a client Project, refuse a content run that belongs to a different client. Read-only
 * pre-check before the closeout RPCs, which take only a run id.
 */
async function assertRunInClientScope(staff: AuthenticatedStaff, runId: unknown): Promise<{ error: string } | null> {
  if (staff.contextKind !== 'client' || !staff.effectiveClientId) return null
  const { data: run, error } = await staff.supabase
    .from('content_runs')
    .select('id, client_id')
    .eq('id', runId)
    .maybeSingle()
  if (error) return { error: 'Content Run scope check unavailable.' }
  if (!run) return { error: 'Content Run not found.' }
  const scope = assertRecordClientMatchesContext(staff.contextKind, staff.effectiveClientId, run.client_id as string, 'content run')
  return scope.allowed ? null : { error: scope.error }
}

async function handleCloseContentRun(staff: AuthenticatedStaff, input: Record<string, unknown>) {
  const scopeError = await assertRunInClientScope(staff, input.content_run_id)
  if (scopeError) return scopeError

  const { data: existingCloseout } = await staff.supabase
    .from('content_run_closeouts')
    .select('upload_status, upload_evidence')
    .eq('content_run_id', input.content_run_id)
    .maybeSingle()

  const { data, error } = await staff.supabase
    .rpc('close_content_run', {
      p_actor_profile_id: staff.profileId,
      p_content_run_id: input.content_run_id,
      p_planned_items: input.planned_items ?? '[]',
      p_completed_items: input.completed_items ?? '[]',
      p_missed_items: input.missed_items ?? '[]',
      p_missed_reasons: input.missed_reasons ?? '[]',
      p_cancelled_items: input.cancelled_items ?? '[]',
      p_field_notes: input.field_notes ?? null,
      p_reshoot_needed: input.reshoot_needed ?? false,
      p_reshoot_notes: input.reshoot_notes ?? null,
      // Preserve prior connector evidence when staff update field notes, but
      // never accept a caller-supplied upload state. The dedicated status
      // action re-inspects the exact durable mapping before changing it.
      p_upload_status: existingCloseout?.upload_status ?? 'unverified',
      p_upload_evidence: existingCloseout?.upload_evidence ?? null,
      p_onedrive_folder_ref: null,
      p_scope_changes: input.scope_changes ?? null,
      p_idempotency_key: input.idempotency_key,
    })

  if (error) return { error: error.message }
  return data
}

async function handleUpdateCloseoutUploadStatus(staff: AuthenticatedStaff, input: Record<string, unknown>) {
  const verification = await handleVerifyContentRunUpload(staff, input) as {
    error?: string
    inspected_at?: string
    evidence?: OneDriveInspectionEvidence
  }
  if (verification.error) return verification
  if (!verification.evidence) {
    return { error: 'Exact-folder upload verification did not return evidence.' }
  }

  const uploadEvidence = JSON.stringify({
    source: 'authorised_exact_content_run_folder_inspection',
    inspected_at: verification.inspected_at ?? new Date().toISOString(),
    ...verification.evidence,
  })
  const { data, error } = await staff.supabase
    .rpc('update_closeout_upload_status', {
      p_actor_profile_id: staff.profileId,
      p_content_run_id: input.content_run_id,
      p_upload_status: verification.evidence.status.toLowerCase(),
      p_upload_evidence: uploadEvidence,
      p_idempotency_key: input.idempotency_key,
    })

  if (error) return { error: error.message }
  return { closeout: data, verification }
}

// ── Tool Router ─────────────────────────────────────────────────────────────

const WRITE_TOOLS = new Set(['create_task', 'update_task', 'update_lead', 'add_lead_research', 'update_my_preferences', 'create_recurring_task', 'compose_mail_draft', 'log_lead_email_activity', 'close_content_run', 'update_closeout_upload_status', 'link_content_run_deliverables', 'upsert_calendar_event'])

const toolHandlers: Record<string, ToolHandler> = {
  get_my_day: handleGetMyDay,
  list_my_tasks: handleListMyTasks,
  get_task: handleGetTask,
  list_my_calendar: handleListMyCalendar,
  list_client_schedule: handleListClientSchedule,
  get_client_context: handleGetClientContext,
  list_my_leads: handleListMyLeads,
  get_lead: handleGetLead,
  create_task: handleCreateTask,
  update_task: handleUpdateTask,
  update_lead: handleUpdateLead,
  add_lead_research: handleAddLeadResearch,
  get_my_profile: handleGetMyProfile,
  update_my_preferences: handleUpdateMyPreferences,
  get_my_assistant_bootstrap: handleGetMyAssistantBootstrap,
  get_my_recurring_tasks: handleGetMyRecurringTasks,
  list_company_tasks: handleListCompanyTasks,
  list_company_recurring_tasks: handleListCompanyRecurringTasks,
  get_microsoft_sync_status: handleGetMicrosoftSyncStatus,
  run_microsoft_sync: handleRunMicrosoftSync,
  get_provider_health: handleGetProviderHealth,
  run_provider_sync: handleRunProviderSync,
  find_content_runs: handleFindContentRuns,
  link_content_run_deliverables: handleLinkContentRunDeliverables,
  upsert_calendar_event: handleUpsertCalendarEvent,
  create_recurring_task: handleCreateRecurringTask,
  compose_mail_draft: handleComposeMailDraft,
  log_lead_email_activity: handleLogLeadEmailActivity,
  get_content_run_plan: handleGetContentRunPlan,
  get_content_run_closeout: handleGetContentRunCloseout,
  verify_content_run_upload: handleVerifyContentRunUpload,
  close_content_run: handleCloseContentRun,
  update_closeout_upload_status: handleUpdateCloseoutUploadStatus,
}

// ── MCP Server ──────────────────────────────────────────────────────────────

function handleInitialize(id: string | number | null) {
  return jsonRpcResponse(id, {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: { name: 'cg-dynamics-mcp', version: '1.0.0' },
  })
}

function handleToolsList(id: string | number | null) {
  return jsonRpcResponse(id, {
    tools: CG_DYNAMICS_MCP_TOOLS.map(tool => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      // Per-tool OAuth declaration so ChatGPT exposes each action and can trigger the
      // linking UI (current OpenAI Plugins auth docs).
      securitySchemes: CG_DYNAMICS_MCP_SECURITY_SCHEMES,
    })),
  })
}

async function handleToolsCall(
  id: string | number | null,
  supabase: ReturnType<typeof createClient>,
  connection: ConnectionPrincipal,
  toolName: string,
  rawToolInput: Record<string, unknown>,
) {
  // The context-bootstrap tool runs before any operating context exists.
  if (toolName === CONTEXT_BOOTSTRAP_TOOL) {
    const result = await handleResolveProjectContext(supabase, connection, rawToolInput)
    const isError = result && typeof result === 'object' && 'error' in result
    return jsonRpcResponse(id, { content: [{ type: 'text', text: JSON.stringify(result) }], isError: !!isError })
  }

  const handler = toolHandlers[toolName]
  if (!handler) {
    return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`)
  }

  // Every operational call must state whose Project it is acting for. One shared connection
  // serves every Project, so context is per-call and never inherited or cached (#319).
  const { context: rawContext, ...toolInputWithoutContext } = rawToolInput
  const parsed = parseProjectContext(rawContext)
  if (!parsed.ok) {
    return jsonRpcError(id, -32602, parsed.error)
  }

  const policy = assertToolAllowedInContext(toolName, parsed.context.contextKind)
  if (!policy.allowed) {
    return jsonRpcError(id, -32602, policy.error)
  }

  const resolved = await resolveOperatingContext(supabase, connection, parsed.context)
  if (!resolved.ok) {
    return jsonRpcError(id, -32602, resolved.error)
  }
  const staff = resolved.staff

  // In a client Project, pin every client-scoped call to that exact client.
  const scoped = resolveClientScopeForInput(staff.contextKind, staff.effectiveClientId, toolInputWithoutContext)
  if (!scoped.ok) {
    return jsonRpcError(id, -32602, scoped.error)
  }
  const toolInput = scoped.input

  const audit = buildAuditEnvelope(connection, parsed.context)

  const idempotencyKey = toolInput.idempotency_key as string | undefined
  const isWrite = WRITE_TOOLS.has(toolName)

  if (isWrite && !idempotencyKey) {
    return jsonRpcError(id, -32602, 'Write tools require an idempotency_key.')
  }

  if (isWrite && idempotencyKey) {
    const inputHash = computeInputHash(toolInput as Record<string, unknown>)
    const existing = await checkIdempotency(staff.supabase, staff.profileId, toolName, idempotencyKey, inputHash)
    if (existing.duplicate) {
      return jsonRpcResponse(id, { content: [{ type: 'text', text: JSON.stringify({ ...(existing.result as object), _context: audit }) }], isError: false })
    }
  }

  try {
    const result = await handler(staff, toolInput)

    if (isWrite && idempotencyKey) {
      const inputHash = computeInputHash(toolInput as Record<string, unknown>)
      const hasError = result && typeof result === 'object' && 'error' in result
      await recordIdempotency(staff.supabase, staff.profileId, toolName, idempotencyKey, inputHash, hasError ? 'error' : 'success', audit)
    }

    const isError = result && typeof result === 'object' && 'error' in result
    // Dual-principal audit on every call: communal connection principal + effective context.
    const payload = result && typeof result === 'object' && !Array.isArray(result)
      ? { ...(result as Record<string, unknown>), _context: audit }
      : { result, _context: audit }
    return jsonRpcResponse(id, {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      isError: !!isError,
    })
  } catch (err) {
    if (isWrite && idempotencyKey) {
      const inputHash = computeInputHash(toolInput as Record<string, unknown>)
      await recordIdempotency(staff.supabase, staff.profileId, toolName, idempotencyKey, inputHash, 'error', audit)
    }
    return jsonRpcError(id, -32603, `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ── HTTP Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Public OAuth discovery: RFC 9728 Protected Resource Metadata. Served WITHOUT a bearer
  // token so ChatGPT can learn which authorization server (Supabase Auth) protects this
  // MCP resource and where its Dynamic Client Registration endpoint lives. No tool access.
  const url = new URL(req.url)
  if (req.method === 'GET' && isProtectedResourceMetadataRequest(url.pathname)) {
    const urls = deriveMcpOAuthUrls(Deno.env.get('SUPABASE_URL'))
    if (!urls) return jsonResponse({ error: 'Server configuration error.' }, 500)
    return jsonResponse(buildProtectedResourceMetadata(urls), 200)
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'MCP requires POST.' }, 405)
  }

  // Authenticate before parsing JSON-RPC. The envelope is parsed once after the auth check
  // only so a rejected tools/call can preserve its request id in the MCP challenge body.
  const auth = await authenticateStaff(req)

  let body: Record<string, unknown> | null
  try {
    body = await req.json()
  } catch {
    body = null
  }

  if (!auth.ok) {
    // A rejected tools/call additionally gets the OpenAI-compatible MCP auth-challenge
    // result so ChatGPT surfaces the account-linking UI instead of a bare transport error.
    // Preserve the transport status and headers: rejected bearers remain HTTP 401 and keep
    // the canonical WWW-Authenticate challenge while the JSON-RPC body carries MCP `_meta`.
    if (auth.challenge && body && body.method === 'tools/call') {
      return authChallengeResponse(
        (body.id as string | number | null) ?? null,
        auth.challenge,
        auth.response,
      )
    }
    return auth.response
  }

  // Connection principal only — the communal admin account. The effective Project subject
  // is resolved per tool call from explicit context (#319).
  const { connection, supabase: connectionSupabase } = auth

  if (!body) {
    return jsonRpcError(null, -32700, 'Parse error.')
  }

  const { id, method, params } = body
  if (typeof method !== 'string') {
    return jsonRpcError(id as string | number | null ?? null, -32600, 'Invalid request.')
  }

  // Observability: record which method/tool was actually invoked. Names only - never
  // arguments, tokens or client data. This is what tells us whether a ChatGPT Project
  // genuinely called a client tool or only listed the catalogue.
  const invokedTool = method === 'tools/call'
    ? ((params as { name?: string } | undefined)?.name ?? 'unknown')
    : null
  console.log(`mcp method=${method}${invokedTool ? ` tool=${invokedTool}` : ''}`)

  switch (method) {
    case 'initialize':
      return handleInitialize(id as string | number | null)

    case 'notifications/initialized':
      return jsonResponse({})

    case 'tools/list':
      return handleToolsList(id as string | number | null)

    case 'tools/call': {
      const args = params as { name?: string; arguments?: Record<string, unknown> } | undefined
      if (!args?.name) {
        return jsonRpcError(id as string | number | null, -32602, 'Missing tool name.')
      }
      return handleToolsCall(id as string | number | null, connectionSupabase, connection, args.name, args.arguments ?? {})
    }

    case 'ping':
      return jsonRpcResponse(id as string | number | null, {})

    default:
      return jsonRpcError(id as string | number | null, -32601, `Method not found: ${method}`)
  }
})
