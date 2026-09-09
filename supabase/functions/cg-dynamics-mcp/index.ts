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
import { CG_DYNAMICS_MCP_TOOLS } from './toolCatalog.ts'

const STAFF_ROLES = new Set(['admin', 'manager', 'staff', 'team'])
const MCP_PROTOCOL_VERSION = '2025-03-26'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
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

interface AuthenticatedStaff {
  supabase: ReturnType<typeof createClient>
  profileId: string
  fullName: string | null
  role: string
  isActive: boolean
}

async function authenticateStaff(request: Request): Promise<{ ok: true; staff: AuthenticatedStaff } | { ok: false; response: Response }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, response: jsonResponse({ error: 'Server configuration error.' }, 500) }
  }

  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '')
  if (!match?.[1]) {
    return { ok: false, response: jsonResponse({ error: 'Authentication required.' }, 401) }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(match[1])
  if (authError || !user) {
    return { ok: false, response: jsonResponse({ error: 'Invalid or expired token.' }, 401) }
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
    return { ok: false, response: jsonResponse({ error: 'Active staff access required.' }, 403) }
  }

  return {
    ok: true,
    staff: {
      supabase,
      profileId: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      isActive: profile.is_active,
    },
  }
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
) {
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

const handleGetMyDay: ToolHandler = async (staff) => {
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const [tasksResult, calendarResult, scheduleResult] = await Promise.all([
    staff.supabase
      .from('planner_tasks')
      .select('id, title, assigned_to_name, due_date, status, notes, client_name, client_id')
      .eq('assigned_to_name', staff.fullName)
      .is('archived_at', null)
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
      .select('id, title, deliverable_type, scheduled_date, production_status, assigned_to_name, client_name')
      .eq('assigned_to_name', staff.fullName)
      .eq('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(20),
  ])

  return {
    today,
    staff_name: staff.fullName,
    tasks: tasksResult.data ?? [],
    calendar_events: calendarResult.data ?? [],
    deliverables: scheduleResult.data ?? [],
    errors: [tasksResult.error?.message, calendarResult.error?.message, scheduleResult.error?.message].filter(Boolean),
  }
}

const handleListMyTasks: ToolHandler = async (staff, input) => {
  const query = staff.supabase
    .from('planner_tasks')
    .select('id, title, assigned_to_name, due_date, status, notes, client_name, client_id, created_at, updated_at')
    .eq('assigned_to_name', staff.fullName)
    .is('archived_at', null)
    .order('due_date', { ascending: true })
    .limit(50)

  if (input.status) query.eq('status', input.status)
  if (input.due_before) query.lte('due_date', input.due_before)

  const { data, error } = await query
  return { tasks: data ?? [], error: error?.message ?? null }
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
    .select('id, title, event_type, start_at, end_at, all_day, location, notes, assigned_to_name, status, client_name, client_id')
    .gte('start_at', input.from as string)
    .lte('start_at', (input.to as string) + 'T23:59:59')
    .order('start_at', { ascending: true })
    .limit(50)

  return { events: data ?? [], error: error?.message ?? null }
}

const handleListClientSchedule: ToolHandler = async (staff, input) => {
  const query = staff.supabase
    .from('monthly_deliverables')
    .select('id, client_id, client_name, month, deliverable_type, title, scheduled_date, due_date, production_status, assigned_to_name')
    .gte('scheduled_date', input.from as string)
    .lte('scheduled_date', input.to as string)
    .order('scheduled_date', { ascending: true })
    .limit(50)

  if (input.client_id) query.eq('client_id', input.client_id)

  const { data, error } = await query
  return { deliverables: data ?? [], error: error?.message ?? null }
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

  const [marketingResult, notesResult] = await Promise.all([
    staff.supabase
      .from('marketing_library_sources')
      .select('id, title, content_type, trust_tier')
      .eq('client_id', clientId)
      .in('trust_tier', ['approved', 'verified'])
      .limit(10),
    staff.supabase
      .from('client_notes')
      .select('id, content, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    client: { id: client.id, name: client.name },
    task_type: input.task_type,
    marketing_sources: marketingResult.data ?? [],
    recent_notes: notesResult.data ?? [],
    errors: [marketingResult.error?.message, notesResult.error?.message].filter(Boolean),
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
  if (!hasTable) return { error: 'Staff assistant workspace not yet available. Complete #305 setup first.' }

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
  })

  if (error) return { error: error.message }
  return { profile: data, message: 'Preferences updated.' }
}

// ── Tool Router ─────────────────────────────────────────────────────────────

const WRITE_TOOLS = new Set(['create_task', 'update_task', 'update_lead', 'add_lead_research', 'update_my_preferences'])

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
    })),
  })
}

async function handleToolsCall(
  id: string | number | null,
  staff: AuthenticatedStaff,
  toolName: string,
  toolInput: Record<string, unknown>,
) {
  const handler = toolHandlers[toolName]
  if (!handler) {
    return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`)
  }

  const idempotencyKey = toolInput.idempotency_key as string | undefined
  const isWrite = WRITE_TOOLS.has(toolName)

  if (isWrite && !idempotencyKey) {
    return jsonRpcError(id, -32602, 'Write tools require an idempotency_key.')
  }

  if (isWrite && idempotencyKey) {
    const inputHash = computeInputHash(toolInput as Record<string, unknown>)
    const existing = await checkIdempotency(staff.supabase, staff.profileId, toolName, idempotencyKey, inputHash)
    if (existing.duplicate) {
      return jsonRpcResponse(id, { content: [{ type: 'text', text: JSON.stringify(existing.result) }], isError: false })
    }
  }

  try {
    const result = await handler(staff, toolInput)

    if (isWrite && idempotencyKey) {
      const inputHash = computeInputHash(toolInput as Record<string, unknown>)
      const hasError = result && typeof result === 'object' && 'error' in result
      await recordIdempotency(staff.supabase, staff.profileId, toolName, idempotencyKey, inputHash, hasError ? 'error' : 'success')
    }

    const isError = result && typeof result === 'object' && 'error' in result
    return jsonRpcResponse(id, {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: !!isError,
    })
  } catch (err) {
    if (isWrite && idempotencyKey) {
      const inputHash = computeInputHash(toolInput as Record<string, unknown>)
      await recordIdempotency(staff.supabase, staff.profileId, toolName, idempotencyKey, inputHash, 'error')
    }
    return jsonRpcError(id, -32603, `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ── HTTP Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'MCP requires POST.' }, 405)
  }

  // Authenticate before parsing JSON-RPC
  const auth = await authenticateStaff(req)
  if (!auth.ok) return auth.response

  const staff = auth.staff

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonRpcError(null, -32700, 'Parse error.')
  }

  const { id, method, params } = body
  if (typeof method !== 'string') {
    return jsonRpcError(id as string | number | null ?? null, -32600, 'Invalid request.')
  }

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
      return handleToolsCall(id as string | number | null, staff, args.name, args.arguments ?? {})
    }

    case 'ping':
      return jsonRpcResponse(id as string | number | null, {})

    default:
      return jsonRpcError(id as string | number | null, -32601, `Method not found: ${method}`)
  }
})
