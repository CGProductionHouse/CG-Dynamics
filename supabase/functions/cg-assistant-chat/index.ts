import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getProviderDiagnostics,
  getProviderOrder,
  routeAiChat,
  type AiChatMessage,
} from './ai-router.ts'

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

interface LocalWorkContext {
  today: string
  userName: string | null
  focusCount: number
  overdueCount: number
  dueTodayCount: number
  upcomingCount: number
  connectedSources: {
    plannerTasks: number
    calendarEvents: number
    clientScheduleItems: number
  }
  nextFocusTitle: string | null
  currentTaskTitle: string | null
  nextTaskTitle: string | null
  suggestedNextAction: string
  workloadWarning: string | null
  setupNotes: string[]
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

type AssistantAction = 'chat' | 'diagnostics' | 'test_provider'

interface AuditValues {
  userId: string
  role: string
  message: string
  responseStatus: string
  restricted: boolean
  promptCategory: string
  model?: string | null
  errorMessage?: string | null
  redactPrompt?: boolean
}

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

function numberFromPayload(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

function stringOrNull(value: unknown, maxLength = 180): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : null
}

function normalizeLocalWorkContext(value: unknown): LocalWorkContext | null {
  if (!value || typeof value !== 'object') return null
  const payload = value as Record<string, unknown>
  const sources = payload.connectedSources && typeof payload.connectedSources === 'object'
    ? payload.connectedSources as Record<string, unknown>
    : {}
  const today = stringOrNull(payload.today, 20)

  if (!today) return null

  return {
    today,
    userName: stringOrNull(payload.userName),
    focusCount: numberFromPayload(payload.focusCount),
    overdueCount: numberFromPayload(payload.overdueCount),
    dueTodayCount: numberFromPayload(payload.dueTodayCount),
    upcomingCount: numberFromPayload(payload.upcomingCount),
    connectedSources: {
      plannerTasks: numberFromPayload(sources.plannerTasks),
      calendarEvents: numberFromPayload(sources.calendarEvents),
      clientScheduleItems: numberFromPayload(sources.clientScheduleItems),
    },
    nextFocusTitle: stringOrNull(payload.nextFocusTitle),
    currentTaskTitle: stringOrNull(payload.currentTaskTitle),
    nextTaskTitle: stringOrNull(payload.nextTaskTitle),
    suggestedNextAction: stringOrNull(payload.suggestedNextAction, 260) ?? 'No assigned focus work is due right now.',
    workloadWarning: stringOrNull(payload.workloadWarning, 220),
    setupNotes: Array.isArray(payload.setupNotes)
      ? payload.setupNotes.map(note => stringOrNull(note, 180)).filter((note): note is string => Boolean(note)).slice(0, 4)
      : [],
  }
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

function normalizeAction(value: unknown): AssistantAction {
  if (value === 'diagnostics') return 'diagnostics'
  if (value === 'test_provider') return 'test_provider'
  return 'chat'
}

function auditMessage(message: string, redactPrompt: boolean): string {
  if (redactPrompt) return '[restricted prompt redacted]'
  return message.slice(0, MAX_MESSAGE_CHARS)
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
    '- Server-side AI provider routing only.',
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

function buildLocalWorkResponse(context: LocalWorkContext): string {
  const lines = [
    `Today (${context.today}) from your visible My Day view:`,
    `- Focus now: ${context.focusCount}`,
    `- Overdue: ${context.overdueCount}`,
    `- Due today: ${context.dueTodayCount}`,
    `- Upcoming this week: ${context.upcomingCount}`,
  ]

  if (context.currentTaskTitle) lines.push(`- Start with: ${context.currentTaskTitle}`)
  if (context.nextTaskTitle) lines.push(`- Next: ${context.nextTaskTitle}`)
  if (context.workloadWarning) lines.push(`- Capacity note: ${context.workloadWarning}`)

  lines.push('', context.suggestedNextAction)

  if (context.setupNotes.length > 0) {
    lines.push('', 'Setup notes:', ...context.setupNotes.map(note => `- ${note}`))
  }

  return lines.join('\n')
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
  values: AuditValues
) {
  try {
    await sb.from('cg_assistant_audit_logs').insert({
      user_id: values.userId,
      role: values.role,
      message: auditMessage(values.message, Boolean(values.redactPrompt)),
      prompt_category: values.promptCategory,
      response_status: values.responseStatus,
      restricted: values.restricted,
      model: values.model ?? 'ai-router',
      tool_names: TOOL_REGISTRY.map((tool) => tool.key),
      error_message: values.errorMessage ?? null,
    })
  } catch {
    // Audit logging is best-effort until the migration has been applied.
  }
}

async function auditStatus(sb: ReturnType<typeof createClient>): Promise<'available' | 'pending'> {
  try {
    const { error } = await sb
      .from('cg_assistant_audit_logs')
      .select('id, prompt_category', { head: true, count: 'exact' })
      .limit(1)

    return error ? 'pending' : 'available'
  } catch {
    return 'pending'
  }
}

async function handleDiagnostics(sb: ReturnType<typeof createClient>) {
  const providers = getProviderDiagnostics()
  const configuredProviders = providers.filter((provider) => provider.configured).length
  const auditLogging = await auditStatus(sb)

  return jsonResponse({
    ok: true,
    diagnostics: {
      assistantStatus: configuredProviders > 0 ? 'ready' : 'setup_required',
      setupStatus:
        configuredProviders > 0
          ? 'At least one AI provider key appears configured.'
          : 'No AI provider key appears configured yet.',
      providers: providers.map((provider) => ({
        provider: provider.provider,
        model: provider.model,
        configured: provider.configured,
        keyStatus: provider.configured ? 'configured (masked)' : 'missing',
      })),
      providerOrder: getProviderOrder(),
      auditLogging,
      functionStatus: 'cg-assistant-chat reachable',
    },
  })
}

async function handleProviderTest(sb: ReturnType<typeof createClient>, userId: string, role: string) {
  const messages: AiChatMessage[] = [
    {
      role: 'system',
      content:
        'You are CG Assistant. This is an admin diagnostics check. Reply with exactly: CG Assistant online.',
    },
    { role: 'user', content: 'Reply with CG Assistant online.' },
  ]

  try {
    const result = await routeAiChat(messages)
    await auditAssistantRequest(sb, {
      userId,
      role,
      message: '[admin provider diagnostics test]',
      promptCategory: 'diagnostic_provider_test',
      responseStatus: 'provider_test_success',
      restricted: false,
      model: `${result.provider}:${result.model}`,
    })

    return jsonResponse({
      ok: true,
      result: {
        success: true,
        provider: result.provider,
        model: result.model,
        message: result.content,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown provider diagnostics error.'
    await auditAssistantRequest(sb, {
      userId,
      role,
      message: '[admin provider diagnostics test]',
      promptCategory: 'diagnostic_provider_test',
      responseStatus: 'provider_test_failed',
      restricted: false,
      model: 'ai-router',
      errorMessage: errorMessage.slice(0, 500),
    })

    return jsonResponse({
      ok: true,
      result: {
        success: false,
        error: errorMessage === 'NO_AI_PROVIDER_KEYS'
          ? 'No AI provider key is configured.'
          : 'No AI provider is currently available. Check provider keys, limits, or logs.',
      },
    })
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

  const action = normalizeAction(body.action)

  if (action !== 'chat') {
    if (!isPrivilegedRole(role)) {
      return jsonResponse({ ok: false, error: 'Admin diagnostics access required.' }, 403)
    }

    if (action === 'diagnostics') {
      return await handleDiagnostics(sb)
    }

    if (action === 'test_provider') {
      return await handleProviderTest(sb, user.id, role)
    }
  }

  const message = normalizeMessage(body.message)
  const history = normalizeHistory(body.history)
  const localWorkContext = normalizeLocalWorkContext(body.localWorkContext)

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
      promptCategory: setupAllowed ? 'restricted_setup' : 'restricted',
      model: 'local:restricted_guard',
      redactPrompt: true,
    })

    return jsonResponse({
      ok: true,
      answer,
      restricted: !setupAllowed,
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
      promptCategory: 'capabilities',
      model: 'local:capabilities',
    })

    return jsonResponse({
      ok: true,
      answer,
      tools: TOOL_REGISTRY,
    })
  }

  if (isTaskLookupRequest(message)) {
    const answer = localWorkContext ? buildLocalWorkResponse(localWorkContext) : buildTaskModulePendingResponse()

    await auditAssistantRequest(sb, {
      userId: user.id,
      role,
      message,
      responseStatus: localWorkContext ? 'local_work_context' : 'task_module_not_connected',
      restricted: false,
      promptCategory: localWorkContext ? 'local_work' : 'task_placeholder',
      model: localWorkContext ? 'local:my_day_context' : 'local:task_placeholder',
    })

    return jsonResponse({
      ok: true,
      answer,
      tools: TOOL_REGISTRY,
    })
  }

  const messages: AiChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(role) },
    ...history,
    { role: 'user', content: message },
  ]

  try {
    const result = await routeAiChat(messages)
    await auditAssistantRequest(sb, {
      userId: user.id,
      role,
      message,
      responseStatus: 'success',
      restricted: false,
      promptCategory: 'chat',
      model: `${result.provider}:${result.model}`,
    })

    return jsonResponse({
      ok: true,
      answer: result.content,
      tools: TOOL_REGISTRY,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI provider error.'
    const noKeys = errorMessage === 'NO_AI_PROVIDER_KEYS'
    const answer = noKeys
      ? 'CG Assistant is installed, but no AI provider key is configured yet. Add OpenRouter, Gemini, Groq, or OpenAI server-side keys to enable operational answers. The protected-data guardrails are already active.'
      : 'CG Assistant is online, but no AI provider is currently available. Please ask admin to check provider keys or limits.'

    await auditAssistantRequest(sb, {
      userId: user.id,
      role,
      message,
      responseStatus: noKeys ? 'setup_required' : 'provider_unavailable',
      restricted: false,
      promptCategory: 'chat',
      model: 'ai-router',
      errorMessage: errorMessage.slice(0, 500),
    })

    return jsonResponse({
      ok: true,
      answer,
      setupRequired: noKeys,
      tools: TOOL_REGISTRY,
    })
  }
})
