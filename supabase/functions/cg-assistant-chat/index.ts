import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASSISTANT_MODEL = 'gpt-4o-mini'
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'
const MAX_MESSAGE_CHARS = 2000
const MAX_HISTORY_MESSAGES = 8

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

interface AssistantToolStatus {
  key: string
  name: string
  status: 'planned' | 'protected' | 'available'
  description: string
}

const TOOL_REGISTRY: AssistantToolStatus[] = [
  {
    key: 'tasks',
    name: 'Tasks',
    status: 'planned',
    description: 'Future connection for assigned work, due dates, and visible project task context.',
  },
  {
    key: 'clients',
    name: 'Clients',
    status: 'planned',
    description: 'Future connection for safe client/project summaries already visible to the signed-in staff member.',
  },
  {
    key: 'calendar',
    name: 'Calendar',
    status: 'planned',
    description: 'Future connection for public company schedule items and production planning.',
  },
  {
    key: 'meta',
    name: 'Meta Business',
    status: 'planned',
    description: 'Future connection for approved social/reporting context without exposing credentials.',
  },
  {
    key: 'cg-hours',
    name: 'CG Hours',
    status: 'planned',
    description: 'Future connection for time and workload signals where role permissions allow it.',
  },
  {
    key: 'approvals',
    name: 'Approvals',
    status: 'planned',
    description: 'Future connection for manager/admin approval queues and non-financial status summaries.',
  },
]

const STAFF_ROLES = ['owner', 'admin', 'manager', 'staff', 'team']

const RESTRICTED_PATTERNS = [
  /\bsalar(?:y|ies)\b/i,
  /\bpayroll\b/i,
  /\bbank(?:ing)?\b/i,
  /\bbank details?\b/i,
  /\bxero\b/i,
  /\baccounting\b/i,
  /\bprofit\b/i,
  /\bloss\b/i,
  /\bp\/l\b/i,
  /\brevenue\b/i,
  /\binvoice totals?\b/i,
  /\binvoices?\b.*\btotals?\b/i,
  /\btax\b/i,
  /\bid numbers?\b/i,
  /\bidentity numbers?\b/i,
  /\bpersonal hr\b/i,
  /\bprivate hr details?\b/i,
  /\bhr details?\b/i,
  /\bowner notes?\b/i,
  /\bconfidential finance\b/i,
  /\bprivate hr\b/i,
  /\bwages?\b/i,
  /\bcompensation\b/i,
]

const CAPABILITIES_PATTERNS = [
  /\bwhat can you help\b/i,
  /\bwhat are you able\b/i,
  /\bwhat is connected\b/i,
  /\bwhat's connected\b/i,
  /\bwhat is not connected\b/i,
  /\bwhat isn't connected\b/i,
  /\bnot connected yet\b/i,
  /\bcapabilities\b/i,
]

const TASK_LOOKUP_PATTERNS = [
  /\bmy tasks?\b/i,
  /\bassigned tasks?\b/i,
  /\bsummar(?:y|ise|ize).*tasks?\b/i,
  /\bwhat is urgent\b/i,
  /\bwhat's urgent\b/i,
  /\bfocus on today\b/i,
  /\btoday's priorities\b/i,
  /\btask module\b/i,
]

const SETUP_QUESTION_PATTERNS = [
  /\bhow (do|would|can) (we|i)\b/i,
  /\bsetup\b/i,
  /\bset up\b/i,
  /\bconfigure\b/i,
  /\bconnect\b/i,
  /\bintegrat(?:e|ion)\b/i,
  /\bfuture\b/i,
  /\bguardrails?\b/i,
  /\bpermissions?\b/i,
]

function normalizeMessage(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, MAX_MESSAGE_CHARS)
}

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false
      const maybe = item as Record<string, unknown>
      return (
        (maybe.role === 'user' || maybe.role === 'assistant') &&
        typeof maybe.content === 'string' &&
        maybe.content.trim().length > 0
      )
    })
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
}

function isRestrictedRequest(message: string): boolean {
  return RESTRICTED_PATTERNS.some((pattern) => pattern.test(message))
}

function isCapabilitiesQuestion(message: string): boolean {
  return CAPABILITIES_PATTERNS.some((pattern) => pattern.test(message))
}

function isTaskLookupRequest(message: string): boolean {
  return TASK_LOOKUP_PATTERNS.some((pattern) => pattern.test(message))
}

function isSetupQuestion(message: string): boolean {
  return SETUP_QUESTION_PATTERNS.some((pattern) => pattern.test(message))
}

function isPrivilegedRole(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

function getTaskLookupPlaceholder() {
  return {
    connected: false,
    message: 'Task module not connected yet.',
  }
}

function buildCapabilitiesResponse(role: string): string {
  const notConnected = TOOL_REGISTRY.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n')

  return [
    'CG Assistant can help with practical operational work right now:',
    '- Draft client updates, task notes, captions, internal checklists, and planning outlines.',
    '- Explain what is connected, what is pending, and how to structure future safe integrations.',
    '- Help prioritise when you provide the context directly in the chat.',
    '',
    'Connected right now:',
    '- Role checks and protected-data filtering.',
    '- Server-side OpenAI requests only.',
    '- Best-effort audit logging when the audit migration has been run.',
    '',
    'Not connected yet:',
    notConnected,
    '',
    `Your access tier: ${accessSummary(role)}`,
  ].join('\n')
}

function buildTaskModulePendingResponse(): string {
  const taskStatus = getTaskLookupPlaceholder()

  return [
    taskStatus.message,
    '',
    'I cannot see live assigned tasks, deadlines, or calendar items yet. If you paste the task list here, I can help sort it into:',
    '- urgent today',
    '- waiting on someone else',
    '- client-facing updates',
    '- quick wins',
    '- items to escalate',
    '',
    'Future connection placeholder: tasks will need role checks before lookup so staff only see task/project context already visible to them.',
  ].join('\n')
}

function buildRestrictedResponse(role: string, setupAllowed: boolean): string {
  if (setupAllowed) {
    return [
      'For owner/admin setup planning: CG Assistant can later support finance or admin integrations only through server-side tools, strict role checks, audit logs, and explicit field allow-lists.',
      '',
      'This version does not connect Xero, payroll, bank, tax, revenue, invoice totals, profit/loss, owner notes, ID numbers, or private HR data, so I cannot answer with real values. I can help draft the access rules or implementation plan safely.',
    ].join('\n')
  }

  if (isPrivilegedRole(role)) {
    return 'I do not have live finance, payroll, bank, Xero, tax, revenue, invoice total, profit/loss, owner-note, ID number, or private HR data connected, so I will not guess or summarise it. I can help with safe setup planning or non-financial operational work.'
  }

  return 'I cannot access or discuss salary, payroll, Xero, bank, profit/loss, revenue, invoice totals, tax, ID numbers, personal HR details, owner notes, or confidential finance information for staff or manager users. I can help reshape this into an operational request, planning note, client update, or non-financial summary.'
}

function accessSummary(role: string): string {
  if (role === 'owner' || role === 'admin') {
    return 'Owner/admin: general future setup planning is allowed, but this version does not connect finance, payroll, Xero, bank, revenue, invoice totals, tax, owner-note, ID number, or private HR data.'
  }

  if (role === 'manager') {
    return 'Manager: team workload, task status, approvals, and non-financial operational summaries when those tools are connected. Finance, payroll, tax, revenue, invoice totals, and private HR details are blocked.'
  }

  return 'Staff: own tasks, public schedule items, already-visible client/project task info, and general operational help when those tools are connected.'
}

function buildSystemPrompt(role: string): string {
  const tools = TOOL_REGISTRY.map((tool) => `${tool.name}: ${tool.status}`).join(', ')

  return [
    'You are CG Assistant inside CG Dynamics.',
    'Be practical, short, operational, and clear.',
    `User role: ${role}. ${accessSummary(role)}`,
    `Tool registry: ${tools}. No live operational tools are connected in this first version.`,
    'If asked for live tasks, calendar items, client task details, approvals, Meta, or CG Hours data, say the integration is not connected yet and offer a useful checklist, draft, or workflow.',
    'Never reveal, infer, summarise, or guess salaries, payroll, bank details, Xero/accounting values, profit/loss, revenue, invoice totals, tax, owner notes, ID numbers, confidential finance, or private HR/payroll fields.',
    'Do not hallucinate data. If no data was provided or connected, say so.',
    'Answer as CG Assistant.',
  ].join(' ')
}

async function auditAssistantRequest(
  sb: ReturnType<typeof createClient>,
  values: {
    userId: string
    role: string
    message: string
    responseStatus: string
    restricted: boolean
    model?: string | null
    errorMessage?: string | null
  }
) {
  try {
    await sb.from('cg_assistant_audit_logs').insert({
      user_id: values.userId,
      role: values.role,
      message: values.message.slice(0, MAX_MESSAGE_CHARS),
      response_status: values.responseStatus,
      restricted: values.restricted,
      model: values.model ?? ASSISTANT_MODEL,
      tool_names: TOOL_REGISTRY.map((tool) => tool.key),
      error_message: values.errorMessage ?? null,
    })
  } catch {
    // Audit logging is best-effort until the migration has been applied.
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user }, error: authError } = await sb.auth.getUser(token)

  if (authError || !user) {
    return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = typeof profile?.role === 'string' ? profile.role : 'staff'

  if (!STAFF_ROLES.includes(role)) {
    return jsonResponse({ ok: false, error: 'Staff access required.' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400)
  }

  const message = normalizeMessage(body.message)
  const history = normalizeHistory(body.history)

  if (!message) {
    return jsonResponse({ ok: false, error: 'Message is required.' }, 400)
  }

  if (isRestrictedRequest(message)) {
    const setupAllowed = isPrivilegedRole(role) && isSetupQuestion(message)
    const answer = buildRestrictedResponse(role, setupAllowed)

    await auditAssistantRequest(sb, {
      userId: user.id,
      role,
      message,
      responseStatus: setupAllowed ? 'restricted_setup_guidance' : 'restricted',
      restricted: !setupAllowed,
      model: ASSISTANT_MODEL,
    })

    return jsonResponse({
      ok: true,
      answer,
      restricted: !setupAllowed,
      model: ASSISTANT_MODEL,
      tools: TOOL_REGISTRY,
    })
  }

  if (isCapabilitiesQuestion(message)) {
    const answer = buildCapabilitiesResponse(role)

    await auditAssistantRequest(sb, {
      userId: user.id,
      role,
      message,
      responseStatus: 'capabilities',
      restricted: false,
      model: ASSISTANT_MODEL,
    })

    return jsonResponse({
      ok: true,
      answer,
      model: ASSISTANT_MODEL,
      tools: TOOL_REGISTRY,
    })
  }

  if (isTaskLookupRequest(message)) {
    const answer = buildTaskModulePendingResponse()

    await auditAssistantRequest(sb, {
      userId: user.id,
      role,
      message,
      responseStatus: 'task_module_not_connected',
      restricted: false,
      model: ASSISTANT_MODEL,
    })

    return jsonResponse({
      ok: true,
      answer,
      model: ASSISTANT_MODEL,
      tools: TOOL_REGISTRY,
    })
  }

  const openAiKey = Deno.env.get('OPENAI_API_KEY')

  if (!openAiKey) {
    const answer =
      'CG Assistant is installed, but the server is missing OPENAI_API_KEY. Once the Supabase Edge Function secret is set, I will be able to answer operational questions. The protected-data guardrails are already active.'

    await auditAssistantRequest(sb, {
      userId: user.id,
      role,
      message,
      responseStatus: 'setup_required',
      restricted: false,
      model: ASSISTANT_MODEL,
    })

    return jsonResponse({
      ok: true,
      answer,
      setupRequired: true,
      model: ASSISTANT_MODEL,
      tools: TOOL_REGISTRY,
    })
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(role) },
    ...history,
    { role: 'user', content: message },
  ]

  const openAiResponse = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ASSISTANT_MODEL,
      temperature: 0.2,
      max_tokens: 500,
      messages,
    }),
  })

  if (!openAiResponse.ok) {
    const errorText = await openAiResponse.text()
    await auditAssistantRequest(sb, {
      userId: user.id,
      role,
      message,
      responseStatus: 'openai_error',
      restricted: false,
      model: ASSISTANT_MODEL,
      errorMessage: errorText.slice(0, 500),
    })

    return jsonResponse({
      ok: false,
      answer: 'CG Assistant could not generate a response right now. Please try again shortly.',
      error: 'OpenAI request failed.',
      model: ASSISTANT_MODEL,
      tools: TOOL_REGISTRY,
    }, 502)
  }

  const result = await openAiResponse.json()
  const answer =
    typeof result?.choices?.[0]?.message?.content === 'string'
      ? result.choices[0].message.content.trim()
      : 'CG Assistant could not format a response. Please try again.'

  await auditAssistantRequest(sb, {
    userId: user.id,
    role,
    message,
    responseStatus: 'success',
    restricted: false,
    model: ASSISTANT_MODEL,
  })

  return jsonResponse({
    ok: true,
    answer,
    model: ASSISTANT_MODEL,
    tools: TOOL_REGISTRY,
  })
})
