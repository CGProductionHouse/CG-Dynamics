// projectContext.ts — Project-scoped operating context for the communal CG Dynamics
// ChatGPT connector (Issue #319). Pure and import-free so it is unit-tested without Deno.
//
// ARCHITECTURE
// CG Production House uses ONE communal ChatGPT account with ONE OAuth connection signed
// in as the company admin. The OAuth principal is therefore NOT the staff identity.
//
//   • Connection principal — the authenticated shared company/admin Supabase user. Proves
//     the communal connector is authorised. Recorded on every call for audit.
//   • Operating context   — the explicit Staff / Client / company-admin Project context
//     supplied per call and resolved against canonical Dynamics records.
//
// Context is carried PER CALL and never cached server-side: the single connection is
// shared by every Project, so any sticky server state would leak one Project's context
// into another. Stateless per-call context is what makes Project switching safe.
//
// Admin OAuth must not make every Project omniscient. Fail closed, never infer.

export type ProjectContextKind = 'staff' | 'client' | 'company_admin'

export const PROJECT_CONTEXT_KINDS: readonly ProjectContextKind[] = ['staff', 'client', 'company_admin']

/** Raw context as supplied by the plugin/skills on each tool call. */
export interface RawProjectContext {
  context_kind?: unknown
  staff_profile_id?: unknown
  client_id?: unknown
}

export interface ParsedProjectContext {
  contextKind: ProjectContextKind
  staffProfileId: string | null
  clientId: string | null
}

export type ParseResult =
  | { ok: true; context: ParsedProjectContext }
  | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

export const MISSING_CONTEXT_ERROR =
  'Project context is required. This connector is shared by the whole CG ChatGPT account, so every call must state whose Project it is acting for. Call resolve_project_context first, then pass context={"context_kind":"staff|client|company_admin", ...} on every tool call.'

/**
 * Validate the per-call context. Exact canonical IDs only — never a free-text name, never
 * a fuzzy match, never an inferred default.
 */
export function parseProjectContext(raw: unknown): ParseResult {
  if (raw === undefined || raw === null) return { ok: false, error: MISSING_CONTEXT_ERROR }
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: MISSING_CONTEXT_ERROR }

  const value = raw as RawProjectContext
  const kind = value.context_kind
  if (typeof kind !== 'string' || !PROJECT_CONTEXT_KINDS.includes(kind as ProjectContextKind)) {
    return { ok: false, error: `context.context_kind must be one of: ${PROJECT_CONTEXT_KINDS.join(', ')}.` }
  }
  const contextKind = kind as ProjectContextKind

  if (contextKind === 'staff') {
    if (!isUuid(value.staff_profile_id)) {
      return { ok: false, error: 'A staff Project requires an exact canonical context.staff_profile_id (uuid). Names are never resolved implicitly.' }
    }
    if (value.client_id !== undefined && value.client_id !== null) {
      return { ok: false, error: 'A staff Project context must not also carry client_id. Use context_kind="client" for a client Project.' }
    }
    return { ok: true, context: { contextKind, staffProfileId: (value.staff_profile_id as string).trim(), clientId: null } }
  }

  if (contextKind === 'client') {
    if (!isUuid(value.client_id)) {
      return { ok: false, error: 'A client Project requires an exact canonical context.client_id (uuid). Client names are never fuzzy-matched.' }
    }
    if (value.staff_profile_id !== undefined && value.staff_profile_id !== null) {
      return { ok: false, error: 'A client Project context must not also carry staff_profile_id. Use context_kind="staff" for a staff Project.' }
    }
    return { ok: true, context: { contextKind, staffProfileId: null, clientId: (value.client_id as string).trim() } }
  }

  // company_admin — deliberately explicit. Never inferred from the OAuth principal's role.
  if (value.staff_profile_id !== undefined && value.staff_profile_id !== null) {
    return { ok: false, error: 'A company_admin context must not carry staff_profile_id. Use context_kind="staff" to act as one exact staff member.' }
  }
  if (value.client_id !== undefined && value.client_id !== null) {
    return { ok: false, error: 'A company_admin context must not carry client_id. Use context_kind="client" for one exact client Project.' }
  }
  return { ok: true, context: { contextKind, staffProfileId: null, clientId: null } }
}

// ── Tool policy ─────────────────────────────────────────────────────────────

/**
 * Tools whose subject is an exact staff member ("my day", "my tasks", "my leads", the
 * assistant profile, mail drafts). These are meaningless — and unsafe — in a client
 * Project, where there is no staff subject.
 */
export const STAFF_SUBJECT_TOOLS: readonly string[] = [
  'get_my_day', 'list_my_tasks', 'get_task', 'list_my_calendar', 'list_my_leads', 'get_lead',
  'create_task', 'update_task', 'update_lead', 'add_lead_research', 'get_my_profile',
  'update_my_preferences', 'get_my_assistant_bootstrap', 'get_my_recurring_tasks',
  'create_recurring_task', 'compose_mail_draft', 'log_lead_email_activity',
]

/**
 * Tools that read/act on exact-client data. Allowed in every context, but in a client
 * Project they are hard-pinned to that Project's canonical client.
 */
export const CLIENT_SCOPED_TOOLS: readonly string[] = [
  'list_client_schedule', 'get_client_context', 'get_content_run_plan',
  'get_content_run_closeout', 'verify_content_run_upload', 'close_content_run',
  'update_closeout_upload_status',
]

/**
 * Company-wide read-only audit inventories (#325). These are explicitly company_admin only:
 * a staff or client Project must never receive a cross-staff/company-wide inventory just
 * because the shared OAuth principal happens to be an admin account.
 */
export const COMPANY_ADMIN_TOOLS: readonly string[] = [
  'list_company_tasks',
  'list_company_recurring_tasks',
  // #325 coexistence execution + Morning Ops surfaces. These act company-wide (or invoke a
  // company-wide provider/reconciliation engine), so they require the explicit admin context.
  'run_microsoft_sync',
  'get_provider_health',
  'run_provider_sync',
]

/** Context-resolution helper; runs before any operating context exists. */
export const CONTEXT_BOOTSTRAP_TOOL = 'resolve_project_context'

export type ToolPolicyResult = { allowed: true } | { allowed: false; error: string }

/** Is this tool permitted under the resolved context kind? */
export function assertToolAllowedInContext(toolName: string, contextKind: ProjectContextKind): ToolPolicyResult {
  if (COMPANY_ADMIN_TOOLS.includes(toolName) && contextKind !== 'company_admin') {
    return {
      allowed: false,
      error: `${toolName} is a company-wide audit inventory and requires an explicit company_admin Project context. A staff Project must use the exact-staff tools instead.`,
    }
  }
  if (contextKind === 'client' && STAFF_SUBJECT_TOOLS.includes(toolName)) {
    return {
      allowed: false,
      error: `${toolName} acts for an exact staff member and is not available in a client Project. Switch to that staff member's Project context (context_kind="staff").`,
    }
  }
  return { allowed: true }
}

/**
 * In a client Project every client-scoped call is pinned to that exact client. A call that
 * names a different client fails closed — admin OAuth must not enable cross-client reads.
 */
export function resolveClientScopeForInput(
  contextKind: ProjectContextKind,
  effectiveClientId: string | null,
  input: Record<string, unknown>,
): { ok: true; input: Record<string, unknown> } | { ok: false; error: string } {
  if (contextKind !== 'client' || !effectiveClientId) return { ok: true, input }

  const requested = input.client_id
  if (requested !== undefined && requested !== null && String(requested).trim() !== effectiveClientId) {
    return {
      ok: false,
      error: `Cross-client request refused. This Project is scoped to client ${effectiveClientId}; it cannot read or act on client ${String(requested)}.`,
    }
  }
  return { ok: true, input: { ...input, client_id: effectiveClientId } }
}

/**
 * Guard for data resolved mid-handler (e.g. a content run's owning client). Fails closed
 * when the record belongs to a different client than the Project context.
 */
export function assertRecordClientMatchesContext(
  contextKind: ProjectContextKind,
  effectiveClientId: string | null,
  recordClientId: string | null | undefined,
  recordLabel: string,
): ToolPolicyResult {
  if (contextKind !== 'client' || !effectiveClientId) return { allowed: true }
  if (!recordClientId || String(recordClientId).trim() !== effectiveClientId) {
    return {
      allowed: false,
      error: `Cross-client request refused. This Project is scoped to client ${effectiveClientId}, but the requested ${recordLabel} belongs to a different client.`,
    }
  }
  return { allowed: true }
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface ConnectionPrincipalAudit {
  userId: string
  profileId: string
  role: string
}

export interface ContextAuditEnvelope {
  connection_principal_user_id: string
  connection_principal_profile_id: string
  connection_principal_role: string
  effective_context_kind: ProjectContextKind
  effective_staff_profile_id: string | null
  effective_client_id: string | null
}

/**
 * The dual-principal audit record required by #319: the communal connection principal AND
 * the effective Project context, on every call.
 */
export function buildAuditEnvelope(
  connection: ConnectionPrincipalAudit,
  context: ParsedProjectContext,
): ContextAuditEnvelope {
  return {
    connection_principal_user_id: connection.userId,
    connection_principal_profile_id: connection.profileId,
    connection_principal_role: connection.role,
    effective_context_kind: context.contextKind,
    effective_staff_profile_id: context.staffProfileId,
    effective_client_id: context.clientId,
  }
}
