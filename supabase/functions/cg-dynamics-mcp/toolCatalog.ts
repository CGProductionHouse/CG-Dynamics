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
] as const

export const CG_DYNAMICS_MCP_SERVER_INSTRUCTIONS =
  'Resolve every call from the bearer token to one exact active CG staff profile. Read before write when a target is ambiguous. Use only canonical Dynamics actions and RLS. Never expose SQL, raw tables, service keys, cross-client fallbacks, or destructive actions.'

