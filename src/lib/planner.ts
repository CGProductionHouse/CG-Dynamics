import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────

export interface PlannerBoard {
  id: string
  name: string
  slug: string
  board_type: BoardType
  visibility: BoardVisibility
  description: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface PlannerBucket {
  id: string
  board_id: string
  name: string
  bucket_type: BucketType
  sort_order: number
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface ClientPackage {
  id: string
  client_id: string
  package_name: string
  status: PackageStatus
  start_date: string
  end_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface PackageDeliverableTemplate {
  id: string
  package_id: string
  code: string
  deliverable_type: DeliverableType
  title_template: string
  count_per_month: number
  default_bucket: string | null
  default_assignee_name: string | null
  default_day_of_month: number | null
  default_weekday: number | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface MonthlyDeliverable {
  id: string
  client_id: string
  package_id: string | null
  template_id: string | null
  board_id: string | null
  bucket_id: string | null
  month: string
  code: string
  instance_number: number
  title: string
  deliverable_type: DeliverableType
  production_status: ProductionStatus
  priority: TaskPriority
  assigned_to_user_id: string | null
  assigned_to_name: string | null
  due_date: string | null
  scheduled_date: string | null
  posted_at: string | null
  internal_approved_at: string | null
  sent_to_client_at: string | null
  client_approved_at: string | null
  moved_from_deliverable_id: string | null
  replaced_by_request_id: string | null
  notes: string | null
  // Collaborative assignments — added in phase-7b.
  helper_names?: string[]
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface PlannerActivityLog {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor_user_id: string | null
  actor_name: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ── Unions ────────────────────────────────────────────────────

export type BoardType =
  | 'operations'
  | 'websites'
  | 'admin'
  | 'client_schedule'
  | 'cg_socials'
  | 'custom'

export type BoardVisibility =
  | 'public_internal'
  | 'staff'
  | 'admin_only'

export type BucketType =
  | 'default'
  | 'client_requests'
  | 'graphic_design'
  | 'video'
  | 'websites'
  | 'admin'
  | 'content_guides'
  | 'once_off'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'payroll'
  | 'checking'
  | 'client_package'
  | 'cg_socials'
  | 'other'

export type PackageStatus = 'active' | 'paused' | 'archived'

export type DeliverableType =
  | 'dp'
  | 'photo'
  | 'video'
  | 'reel'
  | 'content_run'
  | 'website_update'
  | 'monthly_report'
  | 'strategy'
  | 'admin'
  | 'other'

export type ProductionStatus =
  | 'to_do'
  | 'in_progress'
  | 'ready_internal_review'
  | 'internal_changes'
  | 'ready_client_approval'
  | 'waiting_client'
  | 'client_changes'
  | 'approved'
  | 'scheduled'
  | 'posted'
  | 'blocked'
  | 'moved'

export type TaskPriority = 'normal' | 'client_request' | 'urgent'

// ── Constants ─────────────────────────────────────────────────

export const BOARD_TYPES: BoardType[] = [
  'operations', 'websites', 'admin', 'client_schedule', 'cg_socials', 'custom',
]

export const BOARD_VISIBILITIES: BoardVisibility[] = [
  'public_internal', 'staff', 'admin_only',
]

export const BUCKET_TYPES: BucketType[] = [
  'default', 'client_requests', 'graphic_design', 'video', 'websites',
  'admin', 'content_guides', 'once_off', 'daily', 'weekly', 'monthly',
  'payroll', 'checking', 'client_package', 'cg_socials', 'other',
]

export const DELIVERABLE_TYPES: DeliverableType[] = [
  'dp', 'photo', 'video', 'reel', 'content_run',
  'website_update', 'monthly_report', 'strategy', 'admin', 'other',
]

export const PRODUCTION_STATUSES: ProductionStatus[] = [
  'to_do', 'in_progress', 'ready_internal_review', 'internal_changes',
  'ready_client_approval', 'waiting_client', 'client_changes',
  'approved', 'scheduled', 'posted', 'blocked', 'moved',
]

export const PRIORITIES: TaskPriority[] = ['normal', 'client_request', 'urgent']

export const PACKAGE_STATUSES: PackageStatus[] = ['active', 'paused', 'archived']

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  to_do: 'To do',
  in_progress: 'In progress',
  ready_internal_review: 'Ready for review',
  internal_changes: 'Internal changes',
  ready_client_approval: 'Ready for client',
  waiting_client: 'Waiting client',
  client_changes: 'Client changes',
  approved: 'Approved',
  scheduled: 'Scheduled',
  posted: 'Posted',
  blocked: 'Blocked',
  moved: 'Moved',
}

export const PACKAGE_DELIVERABLE_TYPES: DeliverableType[] = ['dp', 'photo', 'video', 'reel']

export const PACKAGE_DELIVERABLE_LABELS: Record<DeliverableType, string> = {
  dp: 'DP (Designed Poster)',
  photo: 'F (Photo)',
  video: 'Video',
  reel: 'Reel',
  content_run: 'Content Run',
  website_update: 'Website Update',
  monthly_report: 'Report',
  strategy: 'Strategy',
  admin: 'Admin',
  other: 'Other',
}

export type SimplifiedProductionStatus =
  | 'not_started'
  | 'in_progress'
  | 'ready_review'
  | 'awaiting_client'
  | 'meta_drafts'
  | 'scheduled_posted'

export const SIMPLIFIED_STATUS_LABELS: Record<SimplifiedProductionStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  ready_review: 'Ready for review',
  awaiting_client: 'Awaiting client approval',
  meta_drafts: 'Meta Drafts',
  scheduled_posted: 'Scheduled / Posted',
}

export const SIMPLIFIED_STATUS_OPTIONS: SimplifiedProductionStatus[] = [
  'not_started',
  'in_progress',
  'ready_review',
  'awaiting_client',
  'meta_drafts',
  'scheduled_posted',
]

export const SIMPLIFIED_TO_BACKEND_STATUS: Record<SimplifiedProductionStatus, ProductionStatus> = {
  not_started: 'to_do',
  in_progress: 'in_progress',
  ready_review: 'ready_internal_review',
  awaiting_client: 'ready_client_approval',
  meta_drafts: 'approved',
  scheduled_posted: 'scheduled',
}

// Normalises ANY stored status value into a SimplifiedProductionStatus so that
// filtering behaves identically across every Client Schedule view. It tolerates
// the typed enum, legacy/imported raw strings (any case, spaces or hyphens) and
// null/empty. This is the single source of truth for schedule status buckets.
//
// Critical: an unknown or unset status resolves to `not_started` (work still to
// do) rather than `in_progress`, so imported items are never hidden from the
// "Not started" / Needs Action views.
export function normalizeScheduleStatus(
  raw: ProductionStatus | string | null | undefined,
): SimplifiedProductionStatus {
  if (raw === null || raw === undefined) return 'not_started'
  const key = String(raw).trim().toLowerCase().replace(/[\s/-]+/g, '_')
  if (key === '') return 'not_started'

  if (['scheduled', 'posted', 'published', 'live', 'scheduled_posted', 'complete', 'completed', 'done'].includes(key)) {
    return 'scheduled_posted'
  }
  if (['approved', 'meta_drafts', 'meta_draft', 'draft', 'drafts', 'ready_to_schedule'].includes(key)) {
    return 'meta_drafts'
  }
  if (['ready_client_approval', 'waiting_client', 'awaiting_client', 'client_approval', 'sent_to_client', 'with_client', 'client_changes'].includes(key)) {
    return 'awaiting_client'
  }
  if (['ready_internal_review', 'ready_review', 'internal_review', 'review'].includes(key)) {
    return 'ready_review'
  }
  if (['in_progress', 'inprogress', 'doing', 'wip', 'started', 'internal_changes', 'blocked'].includes(key)) {
    return 'in_progress'
  }
  if (['to_do', 'todo', 'not_started', 'notstarted', 'new', 'backlog', 'moved', 'unstarted', 'pending', 'open'].includes(key)) {
    return 'not_started'
  }

  // Unknown / legacy value: surface as not started for review, never hide it.
  return 'not_started'
}

export function simplifyProductionStatus(status: ProductionStatus): SimplifiedProductionStatus {
  return normalizeScheduleStatus(status)
}

// Does a normalised status pass the status dropdown filter?
export function matchesScheduleStatusFilter(
  status: SimplifiedProductionStatus,
  filter: 'all' | SimplifiedProductionStatus,
): boolean {
  return filter === 'all' || status === filter
}

// Needs Action = work that still needs attention. Excludes drafts queued in
// Meta and anything scheduled/posted (history).
export function isNeedsActionStatus(status: SimplifiedProductionStatus): boolean {
  return status !== 'scheduled_posted' && status !== 'meta_drafts'
}

// Posted / History = completed scheduling state (scheduled or posted).
export function isPostedOrHistoryStatus(status: SimplifiedProductionStatus): boolean {
  return status === 'scheduled_posted'
}

// ── Client-safe presentation mapping ──────────────────────────
// Used by the client-ready content calendar (and any future client-facing
// surface). Collapses internal production statuses into calm, client-safe
// wording. Internal-only states (blocked, internal changes, review loops)
// must never leak to a client view — they all resolve to a safe bucket here.

export type ClientSafeStatus =
  | 'planned'
  | 'in_production'
  | 'for_review'
  | 'awaiting_approval'
  | 'scheduled_posted'

export const CLIENT_SAFE_STATUS_LABELS: Record<ClientSafeStatus, string> = {
  planned: 'Planned',
  in_production: 'In production',
  for_review: 'For review',
  awaiting_approval: 'Awaiting approval',
  scheduled_posted: 'Scheduled / Posted',
}

export function toClientSafeStatus(
  raw: ProductionStatus | string | null | undefined,
): ClientSafeStatus {
  switch (normalizeScheduleStatus(raw)) {
    case 'scheduled_posted':
      return 'scheduled_posted'
    // Approved work queued in Meta drafts reads as scheduled to a client.
    case 'meta_drafts':
      return 'scheduled_posted'
    case 'awaiting_client':
      return 'awaiting_approval'
    case 'ready_review':
      return 'for_review'
    case 'in_progress':
      return 'in_production'
    default:
      return 'planned'
  }
}

// Effective display schedule date shared across schedule surfaces. During the
// July 2026 Teams shadow-run the real schedule dates for imported package
// items may still live in due_date, so prefer scheduled_date and fall back to
// due_date as the legacy Teams import date. Display/read logic only.
export function getEffectiveScheduleDate(deliverable: MonthlyDeliverable): string | null {
  return deliverable.scheduled_date ?? deliverable.due_date ?? null
}

// ── Helpers ───────────────────────────────────────────────────

export function formatDeliverableCode(code: string, instance: number): string {
  return `${code}-${instance}`
}

export function monthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function monthStart(date: Date): string {
  return `${monthKey(date)}-01`
}

// ── Table names ───────────────────────────────────────────────

const BOARDS_TABLE = 'planner_boards'
const BUCKETS_TABLE = 'planner_buckets'
const PACKAGES_TABLE = 'client_packages'
const TEMPLATES_TABLE = 'package_deliverable_templates'
const DELIVERABLES_TABLE = 'monthly_deliverables'
const ACTIVITY_LOG_TABLE = 'planner_activity_log'

// ── Query helpers ─────────────────────────────────────────────

export async function listPlannerBoards() {
  return supabase
    .from(BOARDS_TABLE)
    .select('*')
    .is('archived_at', null)
    .order('sort_order')
}

export async function listPlannerBuckets(boardId: string) {
  return supabase
    .from(BUCKETS_TABLE)
    .select('*')
    .is('archived_at', null)
    .eq('board_id', boardId)
    .order('sort_order')
}

export interface ClientPackageFilters {
  clientId?: string
  status?: PackageStatus
}

export async function listClientPackages(filters?: ClientPackageFilters) {
  let query = supabase
    .from(PACKAGES_TABLE)
    .select('*')
    .is('archived_at', null)
    .order('start_date', { ascending: false })

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  return query
}

export async function listPackageDeliverableTemplates(packageId: string) {
  return supabase
    .from(TEMPLATES_TABLE)
    .select('*')
    .eq('package_id', packageId)
    .eq('active', true)
    .order('sort_order')
}

export interface DeliverableFilters {
  clientId?: string
  month?: string
  status?: ProductionStatus
  deliverableType?: DeliverableType
  assignedToName?: string
  boardId?: string
  bucketId?: string
  packageId?: string
}

export async function listMonthlyDeliverables(filters?: DeliverableFilters) {
  let query = supabase
    .from(DELIVERABLES_TABLE)
    .select('*')
    .is('archived_at', null)
    .order('month', { ascending: false })
    .order('instance_number')

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId)
  }
  if (filters?.month) {
    query = query.eq('month', filters.month)
  }
  if (filters?.status) {
    query = query.eq('production_status', filters.status)
  }
  if (filters?.deliverableType) {
    query = query.eq('deliverable_type', filters.deliverableType)
  }
  if (filters?.assignedToName) {
    query = query.eq('assigned_to_name', filters.assignedToName)
  }
  if (filters?.boardId) {
    query = query.eq('board_id', filters.boardId)
  }
  if (filters?.bucketId) {
    query = query.eq('bucket_id', filters.bucketId)
  }
  if (filters?.packageId) {
    query = query.eq('package_id', filters.packageId)
  }

  return query
}

export async function listMonthlyDeliverablesByMonth(month: string, filters?: Omit<DeliverableFilters, 'month'>) {
  return listMonthlyDeliverables({ ...filters, month })
}

export async function listMonthlyDeliverablesByYear(
  year: number,
  filters?: Omit<DeliverableFilters, 'month'>,
) {
  let query = supabase
    .from(DELIVERABLES_TABLE)
    .select('*')
    .is('archived_at', null)
    .gte('month', `${year}-01-01`)
    .lt('month', `${year + 1}-01-01`)
    .order('month')
    .order('instance_number')

  if (filters?.clientId) query = query.eq('client_id', filters.clientId)
  if (filters?.deliverableType) query = query.eq('deliverable_type', filters.deliverableType)

  return query
}

// ── Mutation helpers ──────────────────────────────────────────

export interface CreateClientPackageInput {
  client_id: string
  package_name: string
  start_date: string
  end_date?: string | null
  notes?: string | null
}

export async function createClientPackage(input: CreateClientPackageInput) {
  return supabase
    .from(PACKAGES_TABLE)
    .insert({
      client_id: input.client_id,
      package_name: input.package_name,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      notes: input.notes ?? null,
      status: 'active',
    })
    .select()
    .single()
}

export interface CreatePackageDeliverableTemplateInput {
  package_id: string
  code: string
  deliverable_type: DeliverableType
  title_template: string
  count_per_month?: number
  default_bucket?: string
  default_assignee_name?: string
  default_day_of_month?: number
  default_weekday?: number
}

export async function createPackageDeliverableTemplate(input: CreatePackageDeliverableTemplateInput) {
  return supabase
    .from(TEMPLATES_TABLE)
    .insert({
      package_id: input.package_id,
      code: input.code,
      deliverable_type: input.deliverable_type,
      title_template: input.title_template,
      count_per_month: input.count_per_month ?? 1,
      default_bucket: input.default_bucket ?? null,
      default_assignee_name: input.default_assignee_name ?? null,
      default_day_of_month: input.default_day_of_month ?? null,
      default_weekday: input.default_weekday ?? null,
    })
    .select()
    .single()
}

export interface CreateMonthlyDeliverableInput {
  client_id: string
  package_id?: string | null
  template_id?: string | null
  board_id?: string | null
  bucket_id?: string | null
  month: string
  code: string
  instance_number: number
  title: string
  deliverable_type: DeliverableType
  assigned_to_user_id?: string | null
  assigned_to_name?: string | null
  due_date?: string | null
  notes?: string | null
}

export async function createMonthlyDeliverable(input: CreateMonthlyDeliverableInput) {
  return supabase
    .from(DELIVERABLES_TABLE)
    .insert({
      client_id: input.client_id,
      package_id: input.package_id ?? null,
      template_id: input.template_id ?? null,
      board_id: input.board_id ?? null,
      bucket_id: input.bucket_id ?? null,
      month: input.month,
      code: input.code,
      instance_number: input.instance_number,
      title: input.title,
      deliverable_type: input.deliverable_type,
      assigned_to_user_id: input.assigned_to_user_id ?? null,
      assigned_to_name: input.assigned_to_name ?? null,
      due_date: input.due_date ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single()
}

export async function updateMonthlyDeliverableStatus(id: string, status: ProductionStatus) {
  const updates: Partial<MonthlyDeliverable> & { posted_at?: string | null } = { production_status: status }

  if (status === 'posted') {
    updates.posted_at = new Date().toISOString()
  }

  return supabase
    .from(DELIVERABLES_TABLE)
    .update(updates)
    .eq('id', id)
    .select()
    .single()
}

export async function updateMonthlyDeliverableSchedule(id: string, scheduledDate: string | null) {
  return supabase
    .from(DELIVERABLES_TABLE)
    .update({ scheduled_date: scheduledDate })
    .eq('id', id)
    .select()
    .single()
}

export async function updateMonthlyDeliverableCore(
  id: string,
  patch: { priority?: TaskPriority; assigned_to_name?: string | null; client_id?: string | null },
) {
  return supabase
    .from(DELIVERABLES_TABLE)
    .update(patch)
    .eq('id', id)
    .select()
    .single()
}

// Explicit, dedicated client link/unlink for a monthly deliverable. Only ever
// called from an explicit user save — never for inferred/auto matches. Passing
// null unlinks the client. An empty string is coerced to null so we never send
// an invalid UUID to Postgres.
export async function updateMonthlyDeliverableClient(id: string, clientId: string | null) {
  return supabase
    .from(DELIVERABLES_TABLE)
    .update({ client_id: clientId ? clientId : null })
    .eq('id', id)
    .select()
    .single()
}

export interface UpdatePackageDeliverableTemplateInput {
  code?: string
  deliverable_type?: DeliverableType
  title_template?: string
  count_per_month?: number
  default_bucket?: string | null
  default_assignee_name?: string | null
  default_day_of_month?: number | null
  sort_order?: number
  active?: boolean
}

export async function updatePackageDeliverableTemplate(
  id: string,
  patch: UpdatePackageDeliverableTemplateInput,
) {
  return supabase
    .from(TEMPLATES_TABLE)
    .update(patch)
    .eq('id', id)
    .select()
    .single()
}

export async function deactivatePackageDeliverableTemplate(id: string) {
  return supabase
    .from(TEMPLATES_TABLE)
    .update({ active: false })
    .eq('id', id)
    .select()
    .single()
}

export async function archiveClientPackage(id: string, endDate: string) {
  return supabase
    .from(PACKAGES_TABLE)
    .update({
      status: 'archived',
      end_date: endDate,
      archived_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
}

// ── Activity log ──────────────────────────────────────────────

export interface LogPlannerActivityInput {
  entity_type: string
  entity_id: string
  action: string
  actor_user_id?: string | null
  actor_name?: string | null
  metadata?: Record<string, unknown> | null
}

export async function logPlannerActivity(input: LogPlannerActivityInput) {
  return supabase
    .from(ACTIVITY_LOG_TABLE)
    .insert({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      action: input.action,
      actor_user_id: input.actor_user_id ?? null,
      actor_name: input.actor_name ?? null,
      metadata: input.metadata ?? null,
    })
    .select()
    .single()
}

// ── Deliverable row generation (deterministic) ────────────────

export interface GeneratedDeliverableRow {
  client_id: string
  package_id: string
  template_id: string
  month: string
  code: string
  instance_number: number
  title: string
  deliverable_type: DeliverableType
  due_date: string
  assigned_to_name?: string | null
}

export function generateDeliverableRows(
  template: PackageDeliverableTemplate,
  packageRecord: { client_id: string; id: string },
  monthStartDate: string,
): GeneratedDeliverableRow[] {
  const rows: GeneratedDeliverableRow[] = []

  for (let i = 1; i <= template.count_per_month; i++) {
    const title = template.title_template.replace('{instance}', String(i))

    let dueDate = monthStartDate
    if (template.default_day_of_month !== null) {
      const parts = monthStartDate.split('-')
      const day = Math.min(template.default_day_of_month, 28)
      dueDate = `${parts[0]}-${parts[1]}-${String(day).padStart(2, '0')}`
    }

    rows.push({
      client_id: packageRecord.client_id,
      package_id: packageRecord.id,
      template_id: template.id,
      month: monthStartDate,
      code: template.code,
      instance_number: i,
      title,
      deliverable_type: template.deliverable_type,
      due_date: dueDate,
      assigned_to_name: template.default_assignee_name,
    })
  }

  return rows
}

export interface ActivePackageRecord {
  id: string
  client_id: string
}

export interface MonthlyPackageTotals {
  total: number
  remaining: number
  byType: Record<DeliverableType, { total: number; complete: number }>
}

const COMPLETE_STATUSES: ProductionStatus[] = ['posted', 'approved', 'scheduled']

export function getMonthlyPackageTotals(deliverables: MonthlyDeliverable[]): MonthlyPackageTotals {
  const byType = DELIVERABLE_TYPES.reduce((acc, type) => {
    acc[type] = { total: 0, complete: 0 }
    return acc
  }, {} as MonthlyPackageTotals['byType'])

  let complete = 0

  for (const deliverable of deliverables) {
    byType[deliverable.deliverable_type].total += 1
    if (COMPLETE_STATUSES.includes(deliverable.production_status)) {
      byType[deliverable.deliverable_type].complete += 1
      complete += 1
    }
  }

  return {
    total: deliverables.length,
    remaining: deliverables.length - complete,
    byType,
  }
}

export async function generateMonthFromPackages(monthStartDate: string) {
  const { data: packages, error: pkgError } = await supabase
    .from(PACKAGES_TABLE)
    .select('id, client_id')
    .eq('status', 'active')
    .is('archived_at', null)

  if (pkgError) return { data: null, error: pkgError, inserted: 0, skipped: 0 }
  if (!packages || packages.length === 0) return { data: [], error: null, inserted: 0, skipped: 0 }

  const allRows: GeneratedDeliverableRow[] = []

  for (const pkg of packages) {
    const { data: templates, error: tmplError } = await supabase
      .from(TEMPLATES_TABLE)
      .select('*')
      .eq('package_id', pkg.id)
      .eq('active', true)

    if (tmplError) return { data: null, error: tmplError, inserted: 0, skipped: 0 }
    if (!templates) continue

    for (const template of templates) {
      allRows.push(...generateDeliverableRows(template, pkg, monthStartDate))
    }
  }

  if (allRows.length === 0) return { data: [], error: null, inserted: 0, skipped: 0 }

  const { data: existing, error: existingError } = await supabase
    .from(DELIVERABLES_TABLE)
    .select('package_id, template_id, instance_number')
    .eq('month', monthStartDate)
    .is('archived_at', null)

  if (existingError) return { data: null, error: existingError, inserted: 0, skipped: 0 }

  const existingKeys = new Set(
    (existing ?? []).map(row => `${row.package_id}|${row.template_id}|${row.instance_number}`),
  )
  const newRows = allRows.filter(row => !existingKeys.has(`${row.package_id}|${row.template_id}|${row.instance_number}`))
  const skipped = allRows.length - newRows.length

  if (newRows.length === 0) return { data: [], error: null, inserted: 0, skipped }

  const { data, error } = await supabase
    .from(DELIVERABLES_TABLE)
    .insert(newRows)
    .select()

  return { data, error, inserted: data?.length ?? 0, skipped }
}

export async function generateAllForMonth(monthStartDate: string) {
  return generateMonthFromPackages(monthStartDate)
}

// ── PlannerTask (from planner_tasks table, phase-6e) ─────────

export type PlannerTaskStatus =
  | 'to_do'
  | 'in_progress'
  | 'ready_internal_review'
  | 'approved'
  | 'scheduled'

export const PLANNER_TASK_STATUSES: PlannerTaskStatus[] = [
  'to_do', 'in_progress', 'ready_internal_review', 'approved', 'scheduled',
]

export const PLANNER_TASK_STATUS_LABELS: Record<PlannerTaskStatus, string> = {
  to_do: 'To do',
  in_progress: 'In progress',
  ready_internal_review: 'Ready for review',
  approved: 'Approved',
  scheduled: 'Scheduled',
}

export interface PlannerTask {
  id: string
  board_id: string | null
  bucket_id: string | null
  title: string
  client_id: string | null
  client_name: string | null
  assigned_to_name: string | null
  status: PlannerTaskStatus
  priority: TaskPriority
  start_date: string | null
  due_date: string | null
  notes: string | null
  checklist: unknown[]
  source: string
  original_plan_name: string | null
  original_bucket_name: string | null
  original_task_id: string | null
  import_hash: string
  // Collaborative assignments — added in phase-7b.
  helper_names?: string[]
  archived_at?: string | null
  archived_by_name?: string | null
  archive_reason?: string | null
  created_at: string
  updated_at: string
}

const PLANNER_TASKS_TABLE = 'planner_tasks'

export async function listPlannerTasks(boardId: string) {
  return supabase
    .from(PLANNER_TASKS_TABLE)
    .select('*')
    .eq('board_id', boardId)
    .order('created_at')
}

// Dated, non-archived planner tasks inside a date window — used by the CG
// Calendar task layer so operational work appears next to events and posts.
export async function listPlannerTasksDueBetween(startDate: string, endDateExclusive: string) {
  return supabase
    .from(PLANNER_TASKS_TABLE)
    .select('id, title, client_name, assigned_to_name, status, priority, due_date, board_id, bucket_id')
    .is('archived_at', null)
    .gte('due_date', startDate)
    .lt('due_date', endDateExclusive)
    .order('due_date')
}

export interface CalendarTaskRow {
  id: string
  title: string
  client_name: string | null
  assigned_to_name: string | null
  status: PlannerTaskStatus
  priority: TaskPriority
  due_date: string
  board_id: string | null
  bucket_id: string | null
}

export async function listClientScheduleDeliverablesForYear(year: number) {
  return listMonthlyDeliverablesByYear(year)
}

export interface CreatePlannerTaskInput {
  board_id: string
  bucket_id: string
  title: string
  assigned_to_name?: string | null
  client_id?: string | null
  client_name?: string | null
  status?: PlannerTaskStatus
  priority?: TaskPriority
  due_date?: string | null
  notes?: string | null
}

export async function createPlannerTask(input: CreatePlannerTaskInput) {
  const importHash = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return supabase
    .from(PLANNER_TASKS_TABLE)
    .insert({
      board_id: input.board_id,
      bucket_id: input.bucket_id,
      title: input.title.trim(),
      client_id: input.client_id ?? null,
      client_name: input.client_name ?? null,
      assigned_to_name: input.assigned_to_name ?? null,
      status: input.status ?? 'to_do',
      priority: input.priority ?? 'normal',
      due_date: input.due_date ?? null,
      notes: input.notes ?? null,
      source: 'manual',
      import_hash: importHash,
    })
    .select()
    .single()
}

export interface UpdatePlannerTaskInput {
  title?: string
  client_id?: string | null
  client_name?: string | null
  assigned_to_name?: string | null
  status?: PlannerTaskStatus
  priority?: TaskPriority
  due_date?: string | null
  notes?: string | null
  bucket_id?: string | null
  // phase-7b
  helper_names?: string[]
}

export async function updatePlannerTask(id: string, updates: UpdatePlannerTaskInput) {
  return supabase
    .from(PLANNER_TASKS_TABLE)
    .update(updates)
    .eq('id', id)
    .select()
    .single()
}

export async function archivePlannerTask(id: string, actorName: string | null, reason = 'Removed from active work') {
  return supabase
    .from(PLANNER_TASKS_TABLE)
    .update({
      archived_at: new Date().toISOString(),
      archived_by_name: actorName,
      archive_reason: reason,
    })
    .eq('id', id)
    .select()
    .single()
}

// ── Helper / collaborator mutations (ready after phase-7b migration) ──

export async function addPlannerHelperName(id: string, currentHelpers: string[], name: string) {
  const trimmed = name.trim()
  if (!trimmed) return { data: null, error: null }
  const names = currentHelpers.includes(trimmed) ? currentHelpers : [...currentHelpers, trimmed]
  return updatePlannerTask(id, { helper_names: names })
}

export async function removePlannerHelperName(id: string, currentHelpers: string[], name: string) {
  return updatePlannerTask(id, { helper_names: currentHelpers.filter(n => n !== name) })
}

export async function addDeliverableHelperName(id: string, currentHelpers: string[], name: string) {
  const trimmed = name.trim()
  if (!trimmed) return { data: null, error: null }
  const names = currentHelpers.includes(trimmed) ? currentHelpers : [...currentHelpers, trimmed]
  return supabase.from(DELIVERABLES_TABLE).update({ helper_names: names }).eq('id', id).select().single()
}

export async function removeDeliverableHelperName(id: string, currentHelpers: string[], name: string) {
  return supabase.from(DELIVERABLES_TABLE).update({ helper_names: currentHelpers.filter(n => n !== name) }).eq('id', id).select().single()
}
