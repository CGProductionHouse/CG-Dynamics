export type McpToolDependency = 'main' | '#241/#294' | '#305' | '#307' | '#313' | '#341'

export type JsonSchema = Readonly<Record<string, unknown>>

export interface CgDynamicsMcpTool {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  annotations: {
    readOnlyHint: boolean
    destructiveHint: false
    openWorldHint: false
    idempotentHint?: boolean
  }
  dependency: McpToolDependency
  canonicalContract: string
}

// Per-tool OAuth declaration required by current OpenAI Plugins auth docs ("Triggering
// authentication UI"): every tool advertises the scheme even though the whole server shares
// one policy. Scopes stay narrowed to what Supabase Auth actually issues for this connector
// (#318) — deliberately no `openid` and no `offline_access`.
export const CG_DYNAMICS_MCP_SECURITY_SCHEMES = [
  { type: 'oauth2', scopes: ['email', 'profile'] },
] as const

const uuid = { type: 'string', format: 'uuid' }
const date = { type: 'string', format: 'date' }
const idempotencyKeySchema = {
  type: 'string',
  minLength: 1,
  maxLength: 240,
  description: 'Caller-scoped idempotency key. Any non-empty string is accepted; retries with the same key and identical inputs return the original result without re-executing.',
}

/** Schema with no Project context — only the context-bootstrap tool uses this. */
const rawObjectSchema = (properties: JsonSchema, required: string[] = []): JsonSchema => ({
  type: 'object', properties, required, additionalProperties: false,
})

// #319: CG Production House shares ONE communal ChatGPT account and ONE OAuth connection
// (the company admin). The OAuth principal is therefore not the staff identity, so every
// operational call must state which Project it is acting for. Context is per call — never
// remembered server-side — so switching Projects can never reuse another Project's context.
const projectContextSchema: JsonSchema = {
  type: 'object',
  description:
    'Required. Which CG Project this call acts for. The single OAuth connection is the shared company admin account, so the effective staff/client subject must be stated explicitly on every call. Obtain the exact values from resolve_project_context and reuse them for every call in this Project.',
  properties: {
    context_kind: { enum: ['staff', 'client', 'company_admin'] },
    staff_profile_id: { ...uuid, description: 'Exact canonical staff profile id. Required when context_kind="staff".' },
    client_id: { ...uuid, description: 'Exact canonical client id. Required when context_kind="client".' },
  },
  required: ['context_kind'],
  additionalProperties: false,
}

/** Every operational tool carries the required Project context. */
const objectSchema = (properties: JsonSchema, required: string[] = []): JsonSchema => ({
  type: 'object',
  properties: { ...properties, context: projectContextSchema },
  required: [...required, 'context'],
  additionalProperties: false,
})

export const CG_DYNAMICS_MCP_TOOLS: readonly CgDynamicsMcpTool[] = [
  {
    name: 'resolve_project_context', title: 'Resolve this Project\'s context',
    description: 'Resolve the exact canonical CG Project context for this chat (one staff member, one client, or explicit company admin) and return it to carry on every later tool call. Call this first in a fresh Project chat. Accepts an exact canonical id, or an exact-equality name that matches exactly one active record — never a fuzzy or partial match.',
    inputSchema: rawObjectSchema({
      context_kind: { enum: ['staff', 'client', 'company_admin'] },
      staff_profile_id: uuid,
      staff_full_name: { type: 'string', description: 'Exact full name of an active staff profile. Exact equality only.' },
      client_id: uuid,
      client_name: { type: 'string', description: 'Exact canonical client name. Exact equality only; never fuzzy-matched.' },
    }, ['context_kind']),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'profiles + clients canonical registry (#319)',
  },
  {
    name: 'get_microsoft_sync_status', title: 'Get Microsoft sync status',
    description: 'Read the latest Microsoft to Dynamics reconciliation health, status, source completeness and freshness. Call this BEFORE relying on Dynamics task/calendar mirrors in a daily brief; never assume a scheduled job ran. Read-only: it reports state and triggers nothing.',
    inputSchema: objectSchema({ history_limit: { type: 'integer', minimum: 1, maximum: 20 }, freshness_threshold_minutes: { type: 'integer', minimum: 1 } }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'microsoft_sync_runs canonical reconciliation history (#325)',
  },
  {
    name: 'list_company_tasks', title: 'List company-wide tasks (admin audit)',
    description: 'Company-wide read-only Planner task inventory for reconciliation audit. Requires an explicit company_admin Project context. Returns active/completed/archived/source-removed states, assigned staff, and durable Microsoft plan/task identity plus sync freshness so mirrors are reconciled by ID, never by title. Performs no cleanup.',
    inputSchema: objectSchema({
      state: { enum: ['active', 'completed', 'archived', 'source_removed', 'all'] },
      assigned_to_name: { type: 'string' },
      microsoft_plan_id: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 200 },
      offset: { type: 'integer', minimum: 0 },
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'planner_tasks + phase-15a/17a Microsoft source tracking (#325)',
  },
  {
    name: 'list_company_recurring_tasks', title: 'List company-wide recurring templates (admin audit)',
    description: 'Company-wide read-only inventory of Dynamics recurring task templates with ownership and source classification, so legitimate Dynamics-only recurrence is distinguishable from Microsoft-backed recurrence. Requires an explicit company_admin Project context. Performs no cleanup.',
    inputSchema: objectSchema({
      assigned_to_name: { type: 'string' },
      include_archived: { type: 'boolean' },
      limit: { type: 'integer', minimum: 1, maximum: 200 },
      offset: { type: 'integer', minimum: 0 },
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'planner_tasks recurrence templates (#325)',
  },
  {
    name: 'run_microsoft_sync', title: 'Run Microsoft reconciliation',
    description: 'Company-admin only. Runs the EXISTING durable Microsoft reconciliation PREVIEW job (job_start then bounded job_process units), returning PASS/DEGRADED/FAIL with per-source completeness. It fetches Microsoft truth but does not claim Dynamics mirrors were applied or fresh. It cannot auto-apply Client Schedule/monthly_deliverables decisions and never changes MASTER CLIENT TO DO or protected Client Socials plans. If unfinished, call again with the returned job_id.',
    inputSchema: objectSchema({
      job_id: { type: 'string', description: 'Resume an in-flight job returned by a previous call.' },
      range_start: { type: 'string' }, range_end: { type: 'string' },
      max_steps: { type: 'integer', minimum: 1, maximum: 40 },
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'microsoft-transition-sync durable job architecture (#325)',
  },
  {
    name: 'get_provider_health', title: 'Get provider health',
    description: 'Company-admin only. Compact Morning Ops health/freshness for Meta, Google Ads and TikTok using each existing connection-status function. Read-only: no OAuth, permission, secret, account-mapping or publishing change. An unreadable provider is reported UNKNOWN, never as a confirmed empty or disconnected state.',
    inputSchema: objectSchema({
      providers: { type: 'array', items: { enum: ['meta', 'google_ads', 'tiktok'] } },
      client_id: { ...uuid, description: 'Optional exact client mapping to inspect. Required for a targeted TikTok health check; omit for company-wide TikTok mapping inventory.' },
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'meta/google-ads/tiktok connection-status functions (#325)',
  },
  {
    name: 'run_provider_sync', title: 'Run routine provider sync',
    description: 'Company-admin only. Targeted routine sync for ONE already-authorised, already-mapped provider account via its existing sync function. Refuses to run when the provider is not already connected. Never authorises an account, changes mappings or permissions, or publishes.',
    inputSchema: objectSchema({
      provider: { enum: ['meta', 'google_ads', 'tiktok'] },
      client_id: uuid,
      month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Meta completed month (YYYY-MM).' },
      start_date: date,
      end_date: date,
      period_month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'TikTok reporting month (YYYY-MM).' },
    }, ['provider', 'client_id']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'meta-sync / google-ads-sync / tiktok-sync (#325)',
  },
  {
    name: 'find_content_runs', title: 'Find Content Runs',
    description: 'Find exact Content Runs by date, date range, client, CG Calendar event or monthly deliverable, and return the linked canonical Content Guideline, ordered videos, Client Schedule linkage counts, OneDrive readiness and upload status. Lets Morning Ops and Franco EOD work without guessing a Content Run ID. Read-only; raw OneDrive drive/item identifiers and URLs are never returned.',
    inputSchema: objectSchema({
      client_id: uuid, run_date: date, from: date, to: date,
      calendar_event_id: uuid, deliverable_id: uuid,
      limit: { type: 'integer', minimum: 1, maximum: 25 },
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#313', canonicalContract: 'content_runs + content_guidelines + content_guide_ideas + content_run_onedrive_folders (#325)',
  },
  {
    name: 'link_content_run_deliverables', title: 'Link Content Run to deliverables',
    description: 'Internal Assistant-owned linkage: resolves Content Run -> its one canonical Content Guideline -> ordered videos -> exact SAME-CLIENT monthly deliverables using canonical month/video-number or a unique exact title/code match. Staff confirm only real-world shoot facts and are never asked to choose IDs. Defaults to dry_run. Cross-client, already-claimed and ambiguous candidates fail closed. Client Schedule rows are read-only.',
    inputSchema: objectSchema({
      content_run_id: uuid,
      dry_run: { type: 'boolean', description: 'Default true. Set false to apply the resolved plan.' },
      idempotency_key: idempotencyKeySchema,
    }, ['content_run_id', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#313', canonicalContract: 'content_guide_ideas.deliverable_id same-client linkage (#325)',
  },
  {
    name: 'upsert_calendar_event', title: 'Create/update/cancel a CG Calendar event',
    description: 'Dynamics side of coexistence dual-write for a normal operational meeting/event the staff member explicitly asked to create, reschedule or cancel. Matches an existing row by exact event_id or durable Outlook microsoft_event_id, never by title. Set outlook_write_succeeded=false to record PARTIAL SYNC: the Dynamics mirror is written and Microsoft freshness is deliberately not stamped. company_calendar_events stays CG Calendar truth; Client Schedule is never written here and never merged into CG Calendar.',
    inputSchema: objectSchema({
      action: { enum: ['create', 'update', 'cancel'] },
      event_id: uuid,
      microsoft_event_id: { type: 'string' }, microsoft_calendar_id: { type: 'string' },
      title: { type: 'string' },
      event_type: { enum: ['meeting', 'shoot', 'content_run', 'client_event', 'internal', 'deadline'] },
      start_at: { type: 'string' }, end_at: { type: 'string' }, all_day: { type: 'boolean' },
      location: { type: 'string' }, notes: { type: 'string' }, assigned_to_name: { type: 'string' },
      client_id: uuid, client_name: { type: 'string' },
      status: { enum: ['planned', 'confirmed', 'completed', 'cancelled'] },
      outlook_write_succeeded: { type: 'boolean', description: 'Required explicit evidence from the caller. False records PARTIAL SYNC; true requires a complete durable Outlook calendar/event identity.' },
      idempotency_key: idempotencyKeySchema,
    }, ['action', 'outlook_write_succeeded', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: 'main', canonicalContract: 'company_calendar_events CG Calendar truth + durable Outlook identity (#325)',
  },
  {
    name: 'get_my_day', title: 'Get my day',
    description: 'Read current priorities for the exact authenticated active staff profile from the canonical Work, Calendar and Client Schedule authorities.',
    inputSchema: objectSchema({}), annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'src/lib/workforceMyDay.ts#getMyDayContext',
  },
  {
    name: 'list_my_tasks', title: 'List my tasks',
    description: 'List canonical active Planner tasks assigned to the exact authenticated staff profile. Never infer an owner from a name or Project.',
    inputSchema: objectSchema({ status: { type: 'string' }, due_before: date }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'planner_tasks + canonical active-task and assignment views',
  },
  {
    name: 'get_task', title: 'Get task',
    description: 'Read one exact canonical task if current Dynamics permissions allow it.',
    inputSchema: objectSchema({ task_id: uuid }, ['task_id']),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'planner task visibility/RLS',
  },
  {
    name: 'list_my_calendar', title: 'List my calendar',
    description: 'Read relevant CG Calendar events in a bounded date range. This never includes Client Schedule deliverables by implication.',
    inputSchema: objectSchema({ from: date, to: date }, ['from', 'to']),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'src/lib/companyCalendar.ts',
  },
  {
    name: 'list_client_schedule', title: 'List Client Schedule',
    description: 'Read authorised monthly deliverables in a bounded date range from Client Schedule, which remains separate from CG Calendar.',
    inputSchema: objectSchema({ from: date, to: date, client_id: uuid }, ['from', 'to']),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'monthly_deliverables visibility/RLS',
  },
  {
    name: 'get_client_context', title: 'Get exact client context',
    description: 'Retrieve compact task-specific context for one exact authorised client and optional exact branch/entity scope; never fall back to a sibling or national brand. Also returns recorded_client_updates: durable updates recorded from this exact client Project (#341), newest first, with provenance.',
    inputSchema: objectSchema({ client_id: uuid, task_type: { enum: ['caption','content_idea','script','image_edit','factual_lookup','strategy','general'] }, scope_key: { type: 'string' }, supplied_context: { type: 'string', maxLength: 4000 } }, ['client_id','task_type']),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#241/#294', canonicalContract: 'supabase/functions/get-client-context',
  },
  {
    name: 'list_assignable_staff', title: 'List assignable CG staff',
    description: 'Read the active CG staff directory for assigning work: exact profile_id, full name and role only — never email, phone, pay or any other profile data. Use it to turn a name such as "Sydney" into one exact assignee_profile_id before create_client_followup_task or record_client_request. Reading or assigning never changes who is acting.',
    inputSchema: objectSchema({ query: { type: 'string', maxLength: 80, description: 'Optional case-insensitive name fragment.' } }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#341', canonicalContract: 'profiles (active workforce roles) — id, full_name, role only',
  },
  {
    name: 'record_client_request', title: 'Record a client request',
    description: 'Client Project only (#341). Record one real request from THIS exact client as a canonical Dynamics client request (Operations board, Client Requests bucket, priority client_request). The client always comes from the Project context, never from input. Optionally assign one exact active staff member (assignee_profile_id from list_assignable_staff); the assignee is the target, not the caller, and gains no permissions. Give a due date only when one was explicitly stated — never invent one. If the request changes the Client Schedule, pass schedule_change to create a PENDING proposal for admin approval: monthly_deliverables is never edited here. Only say "recorded" after this returns a task id.',
    inputSchema: objectSchema({
      title: { type: 'string', minLength: 1, maxLength: 240 },
      notes: { type: 'string', maxLength: 4000 },
      due_date: date,
      assignee_profile_id: uuid,
      assignee_name: { type: 'string', maxLength: 120, description: 'Exact full name; prefer assignee_profile_id.' },
      schedule_change: {
        type: 'object',
        description: 'Optional Client Schedule change the request implies. Creates a pending proposal for admin approval only.',
        properties: { deliverable_id: uuid, change: { type: 'object' }, reason: { type: 'string', maxLength: 4000 } },
        required: ['deliverable_id', 'change'],
        additionalProperties: false,
      },
      meeting_reference: { type: 'string', maxLength: 240 },
      idempotency_key: idempotencyKeySchema,
    }, ['title', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#341', canonicalContract: 'record_client_workspace_task RPC -> planner_tasks client request + client_schedule_change_requests proposal',
  },
  {
    name: 'create_client_followup_task', title: 'Create a client follow-up task',
    description: 'Client Project only (#341). Create one follow-up task for THIS exact client and assign it to one exact active CG staff member (assignee_profile_id from list_assignable_staff). The assignee is the target of the task, not the caller, and gains no permissions; this never acts as that staff member. A due date is used only when explicitly given — never invented. #325: content/package workflow follow-ups may stay Dynamics-only (microsoft_write="not_requested"). For a normal Microsoft-backed operational task, create it in Planner first, then pass microsoft_write="succeeded" with its microsoft_task_id and microsoft_plan_id so Dynamics links that same task by durable id; pass "failed" when the Planner write failed, which records PARTIAL SYNC. Never create tasks in MASTER CLIENT TO DO or Client Socials. Only say "created/assigned" after this returns a task id.',
    inputSchema: objectSchema({
      title: { type: 'string', minLength: 1, maxLength: 240 },
      notes: { type: 'string', maxLength: 4000 },
      due_date: date,
      assignee_profile_id: uuid,
      assignee_name: { type: 'string', maxLength: 120, description: 'Exact full name; prefer assignee_profile_id.' },
      microsoft_write: { enum: ['not_requested', 'succeeded', 'failed'], description: 'Required evidence of the Planner side of this follow-up.' },
      microsoft_task_id: { type: 'string' },
      microsoft_plan_id: { type: 'string' },
      microsoft_bucket_id: { type: 'string' },
      meeting_reference: { type: 'string', maxLength: 240 },
      idempotency_key: idempotencyKeySchema,
    }, ['title', 'microsoft_write', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#341', canonicalContract: 'record_client_workspace_task RPC -> planner_tasks + canonical assignee projection (#325 durable Planner linkage)',
  },
  {
    name: 'record_client_update', title: 'Record a client update',
    description: 'Client Project only (#341). Persist durable post-meeting or content-direction intelligence for THIS exact client as an append-only record with provenance — never a rewrite of the client guide. meeting_outcome also creates a canonical meeting debrief. Link the follow-up task ids created for this client. Recorded updates are returned by get_client_context under recorded_client_updates until they are reviewed into the client guide. Only say "recorded" after this returns an update id.',
    inputSchema: objectSchema({
      update_kind: { enum: ['content_direction', 'meeting_outcome', 'client_preference', 'client_fact'] },
      title: { type: 'string', minLength: 1, maxLength: 240 },
      body: { type: 'string', minLength: 1, maxLength: 8000 },
      decisions: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 500 } },
      unresolved: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 500 } },
      linked_task_ids: { type: 'array', maxItems: 20, items: uuid },
      meeting_title: { type: 'string', maxLength: 240 },
      meeting_date: date,
      calendar_event_id: uuid,
      idempotency_key: idempotencyKeySchema,
    }, ['update_kind', 'title', 'body', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#341', canonicalContract: 'record_client_workspace_update RPC -> client_context_updates (append-only) + meeting_debriefs',
  },
  {
    name: 'list_my_leads', title: 'List my leads',
    description: 'List leads owned by the exact authenticated staff profile, subject to canonical manager visibility.',
    inputSchema: objectSchema({ stage: { type: 'string' } }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#305', canonicalContract: 'business_development_leads RLS/service',
  },
  {
    name: 'get_lead', title: 'Get lead',
    description: 'Read one exact lead only when canonical owner/manager policy permits it.',
    inputSchema: objectSchema({ lead_id: uuid }, ['lead_id']),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#305', canonicalContract: 'business_development_leads RLS/service',
  },
  {
    name: 'create_task', title: 'Create task',
    description: 'Create one canonical Dynamics task through the audited CG Assistant action. The task is assigned to you unless assignee_name names another active staff member, which only a manager may do. Repeated calls require a caller-scoped idempotency key.',
    inputSchema: objectSchema({ title: { type: 'string', minLength: 1, maxLength: 240 }, assignee_name: { type: 'string' }, due_date: date, client_id: uuid, notes: { type: 'string', maxLength: 4000 }, idempotency_key: idempotencyKeySchema }, ['title','idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: 'main', canonicalContract: 'create_assistant_task RPC',
  },
  {
    name: 'update_task', title: 'Update task',
    description: 'Apply one reversible, permission-checked task action through the audited CG Assistant contract. Read the exact task first when identity is ambiguous.',
    inputSchema: objectSchema({ task_id: uuid, action: { enum: ['due','complete','reopen','block','comment'] }, due_date: date, note: { type: 'string', maxLength: 4000 }, idempotency_key: idempotencyKeySchema }, ['task_id','action','idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: 'main', canonicalContract: 'update_assistant_task RPC (reopen requires shared-contract extension)',
  },
  {
    name: 'update_lead', title: 'Update lead',
    description: 'Update one owned/managed lead state, qualification, last or next action, or follow-up date through the canonical lead service.',
    inputSchema: objectSchema({ lead_id: uuid, stage: { type: 'string' }, qualification: { type: 'string' }, last_action: { type: 'string', maxLength: 2000 }, next_action: { type: 'string', maxLength: 2000 }, follow_up_at: { type: 'string', format: 'date-time' }, idempotency_key: idempotencyKeySchema }, ['lead_id','idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#305', canonicalContract: 'update_business_development_lead_as_actor RPC (app RLS owner/manager rule)',
  },
  {
    name: 'add_lead_research', title: 'Add lead research',
    description: 'Append a bounded sourced note to one exact visible lead; never overwrite prior research.',
    inputSchema: objectSchema({ lead_id: uuid, summary: { type: 'string', minLength: 1, maxLength: 4000 }, source_url: { type: 'string', format: 'uri' }, idempotency_key: idempotencyKeySchema }, ['lead_id','summary','idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#305', canonicalContract: 'business_development_lead_research RLS/service',
  },
  {
    name: 'get_my_profile', title: 'Get my assistant profile',
    description: 'Read the exact authenticated staff member\'s durable Assistant profile: working style, preferences, recurring responsibilities, repeated corrections, and approved access scope. Never expose another staff member\'s profile.',
    inputSchema: objectSchema({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#305', canonicalContract: 'staff_assistant_profiles RLS',
  },
  {
    name: 'update_my_preferences', title: 'Update my preferences',
    description: 'Update one or more durable working-style preferences, recurring responsibilities, repeated corrections, or lead-research criteria for the exact authenticated staff member. Preserves existing values for fields not provided.',
    inputSchema: objectSchema({
      responsibilities: { type: 'array', items: { type: 'string', maxLength: 240 }, maxItems: 20 },
      recurring_duties: { type: 'array', items: { type: 'string', maxLength: 240 }, maxItems: 20 },
      working_preferences: { type: 'array', items: { type: 'string', maxLength: 240 }, maxItems: 20 },
      output_preferences: { type: 'array', items: { type: 'string', maxLength: 240 }, maxItems: 20 },
      lead_research_criteria: { type: 'array', items: { type: 'string', maxLength: 240 }, maxItems: 20 },
      repeated_corrections: { type: 'array', items: { type: 'string', maxLength: 240 }, maxItems: 20 },
      common_task_types: { type: 'array', items: { type: 'string', maxLength: 240 }, maxItems: 20 },
      idempotency_key: idempotencyKeySchema,
    }, ['idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#305', canonicalContract: 'save_my_staff_assistant_profile RPC',
  },
  {
    name: 'get_my_assistant_bootstrap', title: 'Get my assistant bootstrap',
    description: 'Self-brief for a fresh Project chat: returns the canonical shared Staff Assistant runtime policy (#325 mandatory Microsoft + Dynamics cross-reference, sync-health gate, freshness authority, dual-write/PARTIAL SYNC, active-only queue, Client Schedule protection, content/OneDrive linkage, draft-only mail, degraded-source handling) with its policy version and effective timestamp, plus this exact staff member profile deltas. This runtime policy overrides any stale Project Instruction wording. Supports staff and company_admin contexts.',
    inputSchema: objectSchema({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#305', canonicalContract: 'staff_assistant_profiles + capabilityManifest.ts',
  },
  {
    name: 'get_my_recurring_tasks', title: 'List my recurring task templates',
    description: 'List recurring task templates assigned to the exact authenticated staff profile. Templates define recurrence rules; instances are materialised automatically. Templates do not appear in normal task lists.',
    inputSchema: objectSchema({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: 'main', canonicalContract: 'planner_tasks where recurrence_rule is not null',
  },
  {
    name: 'create_recurring_task', title: 'Create recurring task template',
    description: 'Create a recurring Dynamics task template with a recurrence rule. Instances are materialised automatically within a 14-day window. The template is assigned to you unless assignee_name names another active staff member, which only a manager may do. Repeated calls require a caller-scoped idempotency key.',
    inputSchema: objectSchema({
      title: { type: 'string', minLength: 1, maxLength: 240 },
      recurrence_rule: { type: 'string', minLength: 1, maxLength: 100, description: 'RRULE subset: FREQ=DAILY|WEEKLY|MONTHLY, optional INTERVAL, BYDAY (MO..SU), BYMONTHDAY (1-28).' },
      recurrence_until: date,
      assignee_name: { type: 'string' },
      client_id: uuid,
      notes: { type: 'string', maxLength: 4000 },
      idempotency_key: idempotencyKeySchema,
    }, ['title', 'recurrence_rule', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: 'main', canonicalContract: 'create_assistant_recurring_task RPC + recurrence.ts materialisation',
  },
  {
    name: 'compose_mail_draft', title: 'Compose email draft',
    description: 'Return a governed Gmail draft payload for the connected Gmail plugin to create the real draft. Dynamics stores staff mail config, collateral references, lead linkage and provenance — never draft content. STAFF EMAIL IS DRAFT-ONLY: never send directly. After the Gmail plugin creates the draft, explicitly instruct staff to review content, verify correct CG From identity and professional signature, then send manually. Governed collateral (CG Business Profile PDF, Wedding Packages PDF) is referenced by asset key, not frozen into Project Instructions.',
    inputSchema: objectSchema({
      to_address: { type: 'string', format: 'email', description: 'Recipient email address.' },
      subject: { type: 'string', minLength: 1, maxLength: 320 },
      body: { type: 'string', minLength: 1, maxLength: 10000, description: 'Draft email body text. Signature will be appended. Staff will review and send manually via Gmail.' },
      lead_id: uuid,
      draft_id: { type: 'string', description: 'Existing Gmail draft ID to update. Omit to create a new draft.' },
      collateral: { type: 'array', items: { type: 'string', maxLength: 500 }, maxItems: 5, description: 'Governed collateral keys to attach (e.g. cg_business_profile, cg_wedding_packages). Retrieved from Google Drive by asset key, not frozen IDs.' },
      include_business_profile: { type: 'boolean', description: 'Attach current approved CG Business Profile PDF by default for new lead/outreach drafts.' },
      include_wedding_packages: { type: 'boolean', description: 'Attach current approved CG Wedding Packages PDF for wedding-related enquiries.' },
      idempotency_key: idempotencyKeySchema,
    }, ['to_address', 'subject', 'body', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#305', canonicalContract: 'staff_assistant_profiles email fields + Gmail plugin draft creation',
  },
  {
    name: 'log_lead_email_activity', title: 'Log lead email activity',
    description: 'Write back outbound or inbound lead-thread activity to canonical Dynamics lead/activity state so sales progress is shared with authorised management/team. Updates last_action, last_action_at, next_action and follow_up_at on the lead record.',
    inputSchema: objectSchema({
      lead_id: uuid,
      activity_type: { enum: ['outbound_draft', 'outbound_sent', 'inbound_received', 'follow_up_scheduled'], description: 'Type of email activity being logged.' },
      summary: { type: 'string', minLength: 1, maxLength: 2000, description: 'Brief summary of the email activity (subject, key points, outcome).' },
      thread_reference: { type: 'string', maxLength: 500, description: 'Optional mail thread/message ID for traceability.' },
      next_action: { type: 'string', maxLength: 2000, description: 'Suggested next action after this email activity.' },
      follow_up_at: { type: 'string', format: 'date-time', description: 'Suggested follow-up date/time if a response is expected.' },
      idempotency_key: idempotencyKeySchema,
    }, ['lead_id', 'activity_type', 'summary', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#305', canonicalContract: 'update_business_development_lead_as_actor RPC (owner-only) for last_action/next_action fields',
  },
  {
    name: 'get_content_run_plan', title: 'Get content run plan',
    description: 'Read the canonical planned shot list for one exact content run and client. Derives the plan from existing Content Run items and its Content Guideline videos; never asks staff to recreate the plan or falls back to another client.',
    inputSchema: objectSchema({ content_run_id: uuid }, ['content_run_id']),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#313', canonicalContract: 'content_runs + content_run_items + content_guidelines + content_guide_ideas',
  },
  {
    name: 'get_content_run_closeout', title: 'Get content run closeout',
    description: 'Read the closeout record for a specific content run. Returns planned vs captured items, missed items, field notes, upload verification status and scope changes. Used by staff to check closeout state before updating.',
    inputSchema: objectSchema({ content_run_id: uuid }, ['content_run_id']),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#313', canonicalContract: 'content_run_closeouts table + get_content_run_closeout RPC',
  },
  {
    name: 'verify_content_run_upload', title: 'Verify content run upload',
    description: 'Read-only authorised inspection of the exact durable OneDrive folder mapped to one content run and exact client. Compares observed media with the canonical closeout captured-item count: VERIFIED requires complete inspection and sufficient observed media; MISSING means none; PARTIAL means incomplete coverage, incomplete expected upload, or no canonical expected count; UNVERIFIED means the exact mapping or authorised connector could not be used. Staff self-report never upgrades this result. Raw Graph IDs, URLs and tokens are never returned.',
    inputSchema: objectSchema({ content_run_id: uuid }, ['content_run_id']),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#307', canonicalContract: 'get_content_run_onedrive_folder RPC + delegated OneDrive adapter durable-ID read helpers',
  },
  {
    name: 'close_content_run', title: 'Close content run',
    description: 'Create or update a content run closeout record. Collects planned vs captured items, missed items with reasons, cancelled items, field notes and reshoot needs. New closeouts remain UNVERIFIED and later field updates preserve prior connector evidence; the caller cannot supply upload status, evidence or a second folder reference. Use the dedicated verification/status tools for the mapped OneDrive folder.',
    inputSchema: objectSchema({
      content_run_id: uuid,
      planned_items: { type: 'array', description: 'Planned content items/shot list from content guideline. Structure: [{name, type, position}].' },
      completed_items: { type: 'array', description: 'Items actually captured during the content run. Structure: [{name, type, position, notes}].' },
      missed_items: { type: 'array', description: 'Planned items that were not captured. Structure: [{name, type, position}].' },
      missed_reasons: { type: 'array', description: 'Reasons for missed items. Structure: [{item_name, reason}].' },
      cancelled_items: { type: 'array', description: 'Items cancelled by client or no longer approved. Structure: [{name, reason}].' },
      field_notes: { type: 'string', maxLength: 4000, description: 'Useful field notes / client feedback from the content run.' },
      reshoot_needed: { type: 'boolean', description: 'Whether a reshoot is needed for any items.' },
      reshoot_notes: { type: 'string', maxLength: 2000, description: 'Details about what needs reshooting.' },
      scope_changes: { type: 'string', maxLength: 2000, description: 'Any scope/content-guideline change that should be written back to Dynamics.' },
      idempotency_key: idempotencyKeySchema,
    }, ['content_run_id', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#313', canonicalContract: 'close_content_run RPC + content_run_closeouts table',
  },
  {
    name: 'update_closeout_upload_status', title: 'Update closeout upload status',
    description: 'After explicit staff approval, re-inspect the exact durable OneDrive folder mapped to this content run and persist the resulting VERIFIED, MISSING, PARTIAL or UNVERIFIED state. The caller cannot supply or promote status/evidence; staff self-report remains UNVERIFIED.',
    inputSchema: objectSchema({
      content_run_id: uuid,
      idempotency_key: idempotencyKeySchema,
    }, ['content_run_id', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#313', canonicalContract: 'update_closeout_upload_status RPC + content_run_closeouts table',
  },
] as const

export const CG_DYNAMICS_MCP_SERVER_INSTRUCTIONS =
  'This connector is shared by the whole CG Production House ChatGPT account. The OAuth connection is the company admin account and is NOT the staff identity. In a fresh Project chat call resolve_project_context once, then pass that exact context object on every later tool call: a staff Project acts as that exact staff member, a client Project is pinned to that exact client, and broader company-admin work must be requested explicitly. Never reuse another Project\'s context, never infer identity from chat history or the connected account, and never fuzzy-match a staff or client name. Read before write when a target is ambiguous. Use only canonical Dynamics actions and RLS. In a client Project the only writes are record_client_request, create_client_followup_task and record_client_update: they are pinned to that exact client, an assignee is the target of the work and never the caller, and say created, assigned or recorded only after the tool returns the record id. Never expose SQL, raw tables, service keys, cross-client fallbacks, or destructive actions.'

