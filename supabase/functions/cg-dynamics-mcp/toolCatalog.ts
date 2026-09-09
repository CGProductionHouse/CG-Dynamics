export type McpToolDependency = 'main' | '#241/#294' | '#305'

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

const objectSchema = (properties: JsonSchema, required: string[] = []): JsonSchema => ({
  type: 'object', properties, required, additionalProperties: false,
})
const uuid = { type: 'string', format: 'uuid' }
const date = { type: 'string', format: 'date' }

export const CG_DYNAMICS_MCP_TOOLS: readonly CgDynamicsMcpTool[] = [
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
    description: 'Retrieve compact task-specific context for one exact authorised client and optional exact branch/entity scope; never fall back to a sibling or national brand.',
    inputSchema: objectSchema({ client_id: uuid, task_type: { enum: ['caption','content_idea','script','image_edit','factual_lookup','strategy','general'] }, scope_key: { type: 'string' }, supplied_context: { type: 'string', maxLength: 4000 } }, ['client_id','task_type']),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    dependency: '#241/#294', canonicalContract: 'supabase/functions/get-client-context',
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
    description: 'Create one canonical Dynamics task through the audited CG Assistant action. Repeated calls require a caller-scoped idempotency key.',
    inputSchema: objectSchema({ title: { type: 'string', minLength: 1, maxLength: 240 }, assignee_name: { type: 'string' }, due_date: date, client_id: uuid, notes: { type: 'string', maxLength: 4000 }, idempotency_key: uuid }, ['title','idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: 'main', canonicalContract: 'create_assistant_task RPC',
  },
  {
    name: 'update_task', title: 'Update task',
    description: 'Apply one reversible, permission-checked task action through the audited CG Assistant contract. Read the exact task first when identity is ambiguous.',
    inputSchema: objectSchema({ task_id: uuid, action: { enum: ['due','complete','reopen','block','comment'] }, due_date: date, note: { type: 'string', maxLength: 4000 }, idempotency_key: uuid }, ['task_id','action','idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: 'main', canonicalContract: 'update_assistant_task RPC (reopen requires shared-contract extension)',
  },
  {
    name: 'update_lead', title: 'Update lead',
    description: 'Update one owned/managed lead state, qualification, last or next action, or follow-up date through the canonical lead service.',
    inputSchema: objectSchema({ lead_id: uuid, stage: { type: 'string' }, qualification: { type: 'string' }, last_action: { type: 'string', maxLength: 2000 }, next_action: { type: 'string', maxLength: 2000 }, follow_up_at: { type: 'string', format: 'date-time' }, idempotency_key: uuid }, ['lead_id','idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#305', canonicalContract: 'business_development_leads RLS/service',
  },
  {
    name: 'add_lead_research', title: 'Add lead research',
    description: 'Append a bounded sourced note to one exact visible lead; never overwrite prior research.',
    inputSchema: objectSchema({ lead_id: uuid, summary: { type: 'string', minLength: 1, maxLength: 4000 }, source_url: { type: 'string', format: 'uri' }, idempotency_key: uuid }, ['lead_id','summary','idempotency_key']),
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
      idempotency_key: uuid,
    }, ['idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#305', canonicalContract: 'save_my_staff_assistant_profile RPC',
  },
  {
    name: 'get_my_assistant_bootstrap', title: 'Get my assistant bootstrap',
    description: 'Retrieve the exact staff member\'s complete operating bootstrap: identity, durable profile, capability manifest, MCP tools and operating standards. Use this to self-brief a fresh ChatGPT Project from canonical Dynamics. Never expose another staff member\'s bootstrap.',
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
    description: 'Create a recurring Dynamics task template with a recurrence rule. Instances are materialised automatically within a 14-day window. Repeated calls require a caller-scoped idempotency key.',
    inputSchema: objectSchema({
      title: { type: 'string', minLength: 1, maxLength: 240 },
      recurrence_rule: { type: 'string', minLength: 1, maxLength: 100, description: 'RRULE subset: FREQ=DAILY|WEEKLY|MONTHLY, optional INTERVAL, BYDAY (MO..SU), BYMONTHDAY (1-28).' },
      recurrence_until: date,
      assignee_name: { type: 'string' },
      client_id: uuid,
      notes: { type: 'string', maxLength: 4000 },
      idempotency_key: uuid,
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
      idempotency_key: uuid,
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
      idempotency_key: uuid,
    }, ['lead_id', 'activity_type', 'summary', 'idempotency_key']),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    dependency: '#305', canonicalContract: 'business_development_leads last_action/next_action fields',
  },
] as const

export const CG_DYNAMICS_MCP_SERVER_INSTRUCTIONS =
  'Resolve every call from the bearer token to one exact active CG staff profile. Read before write when a target is ambiguous. Use only canonical Dynamics actions and RLS. Never expose SQL, raw tables, service keys, cross-client fallbacks, or destructive actions.'

