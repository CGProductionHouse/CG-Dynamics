import { supabase } from './supabase'
import { matchClient, clientSelection } from './clientMatcher'
import { isMissingPlannerAssignmentRpcError, listPlannerBoardAssignments, listPlannerTaskRows, PLANNER_TASK_STATUS_LABELS } from './planner'

export type TaskBucket =
  | 'Client Requests'
  | 'Graphic Design'
  | 'Video'
  | 'Websites'
  | 'Admin / To Do'
  | 'Content Guides'
  | 'Once-off'
  | 'Daily'
  | 'Weekly'
  | 'Monthly'
  | 'Recurring'
  | 'CG Socials'
  | 'Client Schedules'

export type TaskPriority = 'normal' | 'client_request' | 'urgent'

export type TaskStatus =
  | 'to_do'
  | 'in_progress'
  | 'done'
  | 'blocked'
  | 'waiting_client'
  | 'moved_to_tomorrow'

export type TaskSource = 'manual' | 'whatsapp_paste' | 'morning_list' | 'teams_import' | 'other'

export type PackageAction = 'use_slot' | 'addon' | 'move_work'

export interface CommandCentreTask {
  id: string
  native_id?: string
  data_origin?: 'command_centre' | 'planner_tasks'
  title: string
  client_id: string | null
  client_name: string | null
  assigned_to_user_id: string | null
  assignee_user_ids?: string[]
  assigned_to_name: string | null
  /** PR 1: 'ok' | 'unresolved' | 'conflict'. The ownership authority reads this. */
  assignment_review_state?: string | null
  /** PR 2: non-null means this row is superseded and must never be shown. */
  superseded_by_task_id?: string | null
  /** Durable Planner evidence, shown in the manager conflict section. */
  microsoft_task_id?: string | null
  bucket: TaskBucket
  priority: TaskPriority
  status: TaskStatus
  /** Raw Planner workflow status preserved for display (e.g. 'approved',
   *  'scheduled', 'ready_internal_review'). The coarse `status` above keeps the
   *  task ACTIVE; this field keeps the truthful Planner label visible on cards,
   *  history, filters and Assistant context. Only set for planner rows.
   */
  planner_status?: string
  due_date: string
  notes: string | null
  source: TaskSource
  whatsapp_source_text: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  // Package linking fields — added to DB in phase-6 (deliverable_id)
  // and phase-7a (package_action, quote_needed, admin_package_note).
  // Optional until migrations are applied.
  deliverable_id?: string | null
  package_action?: PackageAction | null
  quote_needed?: boolean
  admin_package_note?: string | null
  // Collaborative assignments — added in phase-7b.
  // Optional until migration is applied.
  helper_names?: string[]
  unresolved_assignee_names?: string[]
}

// Client request workflow states — mapped onto task status + request metadata
export type RequestState =
  | 'captured'
  | 'assigned'
  | 'in_progress'
  | 'ready_to_send'
  | 'sent_to_client'
  | 'waiting_client'
  | 'approved'
  | 'changes_requested'
  | 'scheduled'
  | 'closed'

export type TaskUpdateFields = Pick<CommandCentreTask,
  | 'title'
  | 'notes'
  | 'client_id'
  | 'client_name'
  | 'bucket'
  | 'assigned_to_user_id'
  | 'assigned_to_name'
  | 'helper_names'
  | 'priority'
  | 'due_date'
  | 'status'
  | 'deliverable_id'
  | 'package_action'
  | 'quote_needed'
  | 'admin_package_note'
>

const ALLOWED_UPDATE_FIELDS: (keyof TaskUpdateFields)[] = [
  'title', 'notes', 'client_id', 'client_name', 'bucket',
  'assigned_to_user_id', 'assigned_to_name', 'helper_names',
  'priority', 'due_date', 'status',
  'deliverable_id', 'package_action', 'quote_needed', 'admin_package_note',
]

export interface TaskInput {
  title: string
  client_id?: string | null
  client_name?: string | null
  assigned_to_user_id?: string | null
  assigned_to_name?: string | null
  bucket?: TaskBucket
  priority?: TaskPriority
  status?: TaskStatus
  due_date?: string | null
  notes?: string | null
  source?: TaskSource
  whatsapp_source_text?: string | null
}

const TABLE = 'command_centre_tasks'
// Operational reads reach planner tasks through listPlannerTaskRows, which
// reads the canonical view — so a superseded legacy copy can never appear here
// beside its authoritative Planner-backed record (PR 2). This constant remains
// for the archive/status WRITES below, which must target the base table.
const PLANNER_TASKS_TABLE = 'planner_tasks'
const PLANNER_BUCKETS_TABLE = 'planner_buckets'

type PlannerTaskRow = {
  id: string
  board_id: string | null
  bucket_id: string | null
  title: string
  client_id: string | null
  client_name: string | null
  assigned_to_name: string | null
  status: string
  priority: TaskPriority
  start_date: string | null
  due_date: string | null
  notes: string | null
  source: string | null
  original_plan_name: string | null
  original_bucket_name: string | null
  created_at: string
  updated_at: string
  helper_names?: string[]
  unresolved_assignee_names?: string[]
  // PR 1 review state and PR 2 supersession pointer. Ownership decisions read
  // these, never the free-text assignee columns above.
  assignment_review_state?: string | null
  superseded_by_task_id?: string | null
  microsoft_task_id?: string | null
  archived_at?: string | null
  archived_by_name?: string | null
  archive_reason?: string | null
  recurrence_rule?: string | null
}

type PlannerBucketRow = {
  id: string
  name: string
}

const PLANNER_TASK_PREFIX = 'planner:'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]))
}

function isPlannerTaskId(id: string) {
  return id.startsWith(PLANNER_TASK_PREFIX)
}

function stripPlannerTaskId(id: string) {
  return id.replace(PLANNER_TASK_PREFIX, '')
}

function cleanBucketName(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Admin / To Do'
  if (/^[A-Za-z0-9_-]{16,}$/.test(raw) && !/\s/.test(raw)) return 'Admin / To Do'

  const normalised = raw.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (normalised.includes('clientrequest')) return 'Client Requests'
  if (normalised.includes('graphicdesign')) return 'Graphic Design'
  if (normalised.includes('website')) return 'Websites'
  if (normalised === 'daily') return 'Daily'
  if (normalised === 'weekly') return 'Weekly'
  if (normalised === 'monthly') return 'Monthly'
  if (normalised.includes('admin') || normalised.includes('todo')) return 'Admin / To Do'
  if (normalised.includes('onceoff')) return 'Once-off'
  if (normalised.includes('video')) return 'Video'
  if (normalised.includes('contentguide')) return 'Content Guides'
  return raw
}

// Maps a stored planner status onto the ops TaskStatus surface. Operational
// completion is decided by src/lib/taskLifecycle: only 'done' (or legacy
// 'completed') counts. 'approved' and 'scheduled' are content scheduling
// states and stay ACTIVE for work; the old shortcut that smuggled them through
// 'done' is what kept finished-feeling tasks alive on boards (issue #176).
function taskStatusFromPlanner(status: string): TaskStatus {
  if (status === 'in_progress') return 'in_progress'
  if (status === 'blocked') return 'blocked'
  if (status === 'waiting_client') return 'waiting_client'
  if (status === 'done' || status === 'completed') return 'done'
  if (status === 'approved' || status === 'scheduled' || status === 'ready_internal_review') return 'in_progress'
  if (status === 'moved_to_tomorrow') return 'moved_to_tomorrow'
  return 'to_do'
}

function plannerStatusFromTask(status: TaskStatus): string | null {
  if (status === 'in_progress') return 'in_progress'
  if (status === 'blocked') return 'blocked'
  if (status === 'waiting_client') return 'waiting_client'
  if (status === 'done') return 'done'
  if (status === 'moved_to_tomorrow') return null
  return 'to_do'
}

function unsupportedPlannerStatusError(status: TaskStatus) {
  return { data: null, error: { message: `${OPS_STATUS_LABELS[status]} is not supported for Planner tasks.` } }
}

const OPS_STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
  waiting_client: 'Waiting client',
  moved_to_tomorrow: 'Moved to tomorrow',
}

// Display-only resolver. The coarse `status` keeps the task ACTIVE (approved /
// scheduled / ready_internal_review all project to an active bucket) but that
// would mislabel the card as "In progress". The raw `planner_status` field
// carries the truthful Planner label, so visible surfaces render it here.
export function taskStatusDisplayLabel(task: { status: TaskStatus; data_origin?: string; planner_status?: string }): string {
  if (task.data_origin === 'planner_tasks' && task.planner_status) {
    const override = PLANNER_TASK_STATUS_LABELS[task.planner_status as keyof typeof PLANNER_TASK_STATUS_LABELS]
    if (override) return override
  }
  return OPS_STATUS_LABELS[task.status] ?? task.status
}

function plannerTaskToCommandTask(
  row: PlannerTaskRow,
  bucketName: string | undefined,
  assigneeUserIds: string[],
): CommandCentreTask {
  const bucket = cleanBucketName(bucketName || row.original_bucket_name)
  return {
    id: `${PLANNER_TASK_PREFIX}${row.id}`,
    native_id: row.id,
    data_origin: 'planner_tasks',
    title: row.title,
    client_id: row.client_id,
    client_name: row.client_name,
    assigned_to_user_id: assigneeUserIds[0] ?? null,
    assignee_user_ids: assigneeUserIds,
    assigned_to_name: row.assigned_to_name,
    bucket: bucket as TaskBucket,
    priority: row.priority ?? 'normal',
    status: taskStatusFromPlanner(row.status),
    planner_status: row.status,
    due_date: row.due_date ?? row.start_date ?? '',
    notes: row.notes,
    source: row.source === 'teams_import' ? 'teams_import' : 'other',
    whatsapp_source_text: null,
    created_by: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // planner_tasks has no completed_at column. Completion evidence for planner
    // rows lives only in the status transition, so the adapter must never
    // fabricate a completion timestamp or a 'done' from scheduling states.
    completed_at: null,
    helper_names: row.helper_names,
    unresolved_assignee_names: row.unresolved_assignee_names ?? [],
    assignment_review_state: row.assignment_review_state ?? 'ok',
    superseded_by_task_id: row.superseded_by_task_id ?? null,
    microsoft_task_id: row.microsoft_task_id ?? null,
  }
}

export interface ListTaskOptions {
  activeOnly?: boolean
}

export async function listTasks(options: ListTaskOptions = {}) {
  let nativeQuery = supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (options.activeOnly) {
    nativeQuery = nativeQuery.not('status', 'in', '(done,completed)')
  }

  const [nativeResult, plannerResult, assignmentResult] = await Promise.all([
    nativeQuery,
    listPlannerTaskRows({ order: 'due', activeOnly: options.activeOnly }),
    listPlannerBoardAssignments(),
  ])

  if (nativeResult.error) return nativeResult
  if (plannerResult.error) {
    if (plannerResult.error.message?.includes('does not exist') || plannerResult.error.code === '42P01') {
      return nativeResult
    }
    return { data: nativeResult.data ?? [], error: plannerResult.error }
  }
  if (assignmentResult.error && !isMissingPlannerAssignmentRpcError(assignmentResult.error)) {
    return { data: nativeResult.data ?? [], error: assignmentResult.error }
  }

  const plannerRows = ((plannerResult.data ?? []) as PlannerTaskRow[])
    .filter(row => !row.archived_at && !row.recurrence_rule)
  const bucketIds = unique(plannerRows.map(row => row.bucket_id))
  const bucketNames = new Map<string, string>()
  const assigneeIdsByTask = new Map<string, string[]>()

  if (!assignmentResult.error) {
    for (const assignment of assignmentResult.data ?? []) {
      const current = assigneeIdsByTask.get(assignment.task_id) ?? []
      current.push(assignment.profile_id)
      assigneeIdsByTask.set(assignment.task_id, current)
    }
  }

  if (bucketIds.length > 0) {
    const { data: buckets } = await supabase
      .from(PLANNER_BUCKETS_TABLE)
      .select('id, name')
      .in('id', bucketIds)

    for (const bucket of (buckets ?? []) as PlannerBucketRow[]) {
      bucketNames.set(bucket.id, bucket.name)
    }
  }

  const nativeTasks = ((nativeResult.data ?? []) as CommandCentreTask[]).map(task => ({
    ...task,
    native_id: task.id,
    data_origin: 'command_centre' as const,
  }))
  const importedTasks = plannerRows.map(row => plannerTaskToCommandTask(
    row,
    row.bucket_id ? bucketNames.get(row.bucket_id) : undefined,
    assigneeIdsByTask.get(row.id) ?? [],
  ))

  return { data: [...importedTasks, ...nativeTasks], error: null }
}

export async function createTask(input: TaskInput) {
  const today = new Date().toISOString().slice(0, 10)
  return supabase
    .from(TABLE)
    .insert({
      title: input.title,
      client_id: input.client_id ?? null,
      client_name: input.client_name ?? null,
      assigned_to_user_id: input.assigned_to_user_id ?? null,
      assigned_to_name: input.assigned_to_name ?? null,
      bucket: input.bucket ?? 'Once-off',
      priority: input.priority ?? 'normal',
      status: input.status ?? 'to_do',
      due_date: input.due_date ?? today,
      notes: input.notes ?? null,
      source: input.source ?? 'manual',
      whatsapp_source_text: input.whatsapp_source_text ?? null,
    })
    .select()
    .single()
}

export async function archiveImportedPlannerTask(id: string, actorName: string | null, reason = 'Removed from active work') {
  if (!isPlannerTaskId(id)) {
    return { data: null, error: { message: 'Only imported Planner tasks can be archived here.' } }
  }
  return supabase
    .from(PLANNER_TASKS_TABLE)
    .update({
      archived_at: new Date().toISOString(),
      archived_by_name: actorName,
      archive_reason: reason,
    })
    .eq('id', stripPlannerTaskId(id))
    .select()
    .single()
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  if (isPlannerTaskId(id)) {
    const taskId = stripPlannerTaskId(id)
    const mappedStatus = plannerStatusFromTask(status)
    if (!mappedStatus) return unsupportedPlannerStatusError(status)
    return supabase.rpc('update_planner_task_status', { p_task_id: taskId, p_status: mappedStatus })
  }

  const rpcResult = await supabase.rpc('update_command_centre_task_status', { p_task_id: id, p_status: status })
  if (!rpcResult.error || rpcResult.error.code !== 'PGRST202') return rpcResult
  return supabase.from(TABLE).update({ status }).eq('id', id).select().single()
}

export async function updateTask(
  id: string,
  updates: Partial<TaskUpdateFields>
) {
  const patch: Record<string, unknown> = {}
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in updates && updates[field] !== undefined) {
      patch[field] = updates[field]
    }
  }

  if (isPlannerTaskId(id)) {
    delete patch.assigned_to_user_id
    delete patch.assigned_to_name
    delete patch.helper_names
    let requestedStatus: TaskStatus | null = null
    if (patch.bucket !== undefined) {
      patch.original_bucket_name = patch.bucket
      delete patch.bucket
    }
    if (patch.status !== undefined) {
      const status = patch.status as TaskStatus
      const mappedStatus = plannerStatusFromTask(status)
      if (!mappedStatus) return unsupportedPlannerStatusError(status)
      requestedStatus = status
      delete patch.status
    }

    if (requestedStatus && Object.keys(patch).length > 0) {
      return { data: null, error: { message: 'Save other Planner changes before changing its status.' } }
    }

    if (requestedStatus) return updateTaskStatus(id, requestedStatus)
    return supabase
      .from(PLANNER_TASKS_TABLE)
      .update(patch)
      .eq('id', stripPlannerTaskId(id))
      .select()
      .single()
  }

  return supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select()
    .single()
}

const MIGRATION_FIELDS_7A = ['package_action', 'quote_needed', 'admin_package_note'] as const

function isColumnMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string }
  return e.code === '42703'
}

export async function updateTaskSafe(
  id: string,
  updates: Partial<TaskUpdateFields & { package_action?: PackageAction | null; quote_needed?: boolean; admin_package_note?: string | null }>,
): Promise<{ data: unknown; error: unknown; packageFieldsSkipped: boolean }> {
  const result = await updateTask(id, updates)
  if (result.error && isColumnMissingError(result.error) && !isPlannerTaskId(id)) {
    const safeUpdates: Partial<TaskUpdateFields> = { ...updates }
    for (const field of MIGRATION_FIELDS_7A) {
      delete (safeUpdates as Record<string, unknown>)[field]
    }
    const retry = await updateTask(id, safeUpdates)
    return { data: retry.data, error: retry.error, packageFieldsSkipped: true }
  }
  return { data: result.data, error: result.error, packageFieldsSkipped: false }
}

export async function deleteTask(id: string) {
  if (isPlannerTaskId(id)) {
    return { data: null, error: { message: 'Imported Planner tasks cannot be deleted from Daily Tasks.' } }
  }
  return supabase.from(TABLE).delete().eq('id', id)
}

// Ready for use after phase-7b migration adds helper_names column.
export async function addTaskHelperName(id: string, currentHelpers: string[], name: string) {
  const trimmed = name.trim()
  if (!trimmed) return { data: null, error: null }
  const names = currentHelpers.includes(trimmed) ? currentHelpers : [...currentHelpers, trimmed]
  return updateTask(id, { helper_names: names })
}

export async function removeTaskHelperName(id: string, currentHelpers: string[], name: string) {
  return updateTask(id, { helper_names: currentHelpers.filter(n => n !== name) })
}

export interface ClientOption {
  id: string
  name: string
  /** Non-derivable spellings from client_aliases. Derivable forms are computed. */
  aliases?: string[]
}

/**
 * The active client directory — the ONLY authority for client recognition.
 *
 * Stored aliases come along so the matcher can resolve spellings it cannot
 * derive (an external system's typo). Everything else — tokens, shortened
 * names, punctuation variants — is computed, so a new client needs no code.
 */
export async function listActiveClients() {
  const [clientsResult, aliasResult] = await Promise.all([
    supabase.from('clients').select('id, name').eq('active', true).order('name'),
    supabase.from('client_aliases').select('client_id, alias'),
  ])
  if (clientsResult.error || !clientsResult.data) return clientsResult

  const aliasesByClient = new Map<string, string[]>()
  for (const row of (aliasResult.data ?? []) as Array<{ client_id: string; alias: string }>) {
    aliasesByClient.set(row.client_id, [...(aliasesByClient.get(row.client_id) ?? []), row.alias])
  }

  return {
    ...clientsResult,
    data: clientsResult.data.map(client => ({
      ...client,
      aliases: aliasesByClient.get(client.id) ?? [],
    })),
  }
}

export const BUCKETS: TaskBucket[] = [
  'Daily',
  'Weekly',
  'Monthly',
  'Client Requests',
  'Graphic Design',
  'Websites',
  'Admin / To Do',
  'Once-off',
  'Video',
  'Content Guides',
  'Recurring',
  'CG Socials',
  'Client Schedules',
]

export const PRIORITIES: TaskPriority[] = ['normal', 'client_request', 'urgent']

export const STATUSES: TaskStatus[] = [
  'to_do',
  'in_progress',
  'done',
  'blocked',
  'waiting_client',
  'moved_to_tomorrow',
]

export interface ParsedMorningTask {
  id: string
  staffName: string
  clientId: string | null
  clientName: string | null
  // Two states only. A 'suggested' state is deliberately absent: it is what
  // allowed a badge to name a client while the actual field stayed empty.
  clientConfidence: 'confident' | 'needs_review'
  reviewReasons: string[]
  originalText: string
  title: string
  bucket: TaskBucket
  priority: TaskPriority
  dueDate: string
  notes: string | null
}

export interface MorningTaskEdit {
  id: string
  clientOption: '' | '__manual__' | string // client ID, '__manual__', or empty
  manualClientName: string
  clientName: string | null
  title: string
  bucket: TaskBucket
  priority: TaskPriority
  dueDate: string
  notes: string
}

/**
 * Morning List client matching.
 *
 * Delegates to the shared, directory-driven matcher. This file previously held
 * a CLIENT_ALIASES map naming twelve real clients, so a new client could not be
 * recognised without a code change. Nothing here names a client now.
 */
function tryMatchClient(text: string, clients: ClientOption[]) {
  const match = matchClient(text, clients.map(client => ({
    id: client.id,
    name: client.name,
    // listActiveClients only returns active clients; the flag keeps the shared
    // matcher's inactive-client guard meaningful if that ever changes.
    active: true,
    aliases: client.aliases,
  })))
  const selection = clientSelection(match)
  return {
    clientId: selection.clientId,
    clientName: selection.clientName,
    // 'confident' when a client was actually selected; the badge and the field
    // read the SAME selection object, so they cannot disagree.
    confidence: selection.showSuggestion ? 'confident' as const : 'needs_review' as const,
    remaining: match.remaining,
    reason: match.reason,
    ambiguousBetween: match.ambiguousBetween,
  }
}

function inferBucket(text: string, sectionBucket: TaskBucket | null): { bucket: TaskBucket; confident: boolean } {
  const lower = text.toLowerCase()
  if (/\b(website|web|landing page|google site|shopify|wordpress)\b/.test(lower)) return { bucket: 'Websites', confident: true }
  if (/\b(content guide|content plan|posting guide|caption guide|guideline)\b/.test(lower)) return { bucket: 'Content Guides', confident: true }
  if (/\b(video|bts|reel|liedjie|liedjue|audio|music|content run|edit|shoot)\b/.test(lower)) return { bucket: 'Video', confident: true }
  if (/\b(designed poster|poster|posters|design|designs|photo|photos|menu|profile|logo)\b/.test(lower)) return { bucket: 'Graphic Design', confident: true }
  if (/\b(changes|change|requests|request|client asked|meeting changes)\b/.test(lower)) return { bucket: 'Client Requests', confident: true }
  if (sectionBucket) return { bucket: sectionBucket, confident: true }
  if (/\b(strategy|report|campaign ideas|next month|admin)\b/.test(lower)) return { bucket: 'Admin / To Do', confident: true }
  return { bucket: 'Admin / To Do', confident: false }
}

function inferPriority(text: string, bucket: TaskBucket): TaskPriority {
  const lower = text.toLowerCase()
  if (/\b(urgent|asap)\b/.test(lower)) return 'urgent'
  if (bucket === 'Client Requests') return 'client_request'
  if (/\b(client request|client asked|changes|change|requests|request)\b/.test(lower)) return 'client_request'
  return 'normal'
}

function extractNotes(text: string) {
  const notes: string[] = []
  let title = text.replace(/\(([^)]+)\)/g, (_, note: string) => {
    notes.push(note.trim())
    return ' '
  })
  const parts = title.split(/\.\s+/)
  if (parts.length > 1) {
    title = parts.shift() ?? title
    notes.push(parts.join('. ').trim())
  }
  return { title: title.replace(/\s+/g, ' ').trim(), notes: notes.filter(Boolean) }
}

function titleCaseFirst(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : ''
}

function cleanTitle(text: string, clientName: string | null, sectionBucket: TaskBucket | null) {
  let cleaned = text.replace(/\b(asap|urgent)\b/gi, ' ').replace(/\s+/g, ' ').trim()
  const countMatches = Array.from(cleaned.matchAll(/\b(\d+)\s+(designed\s+posters|posters|poster|photos|photo)\b/gi))
  const counts = countMatches.map(match => `${match[1]} ${match[2].toLowerCase().replace('designed ', '')}`)
  if (counts.length > 0) cleaned = cleaned.replace(/\b(\d+)\s+(designed\s+posters|posters|poster|photos|photo)\b/gi, ' ')
  cleaned = cleaned.replace(/\b(vir|for)\b/gi, ' ').replace(/\s+/g, ' ').trim()
  if (counts.length > 0 && (!cleaned || !/\b(change|changes|request|content|guide|video|run|poster|design|photo)\b/i.test(cleaned))) return counts.join(', ')
  if (!cleaned && sectionBucket === 'Client Requests' && clientName) return 'Client request'
  if (!cleaned && clientName) return 'Confirm task details'
  if (!cleaned) return 'Confirm task details'
  return titleCaseFirst(cleaned)
}

let importIdCounter = 0
function nextImportId() {
  return `mi-${Date.now().toString(36)}-${++importIdCounter}`
}

export function parseMorningList(input: string, clients: ClientOption[]): ParsedMorningTask[] {
  const lines = input.split('\n')
  const result: ParsedMorningTask[] = []
  let currentStaff = 'Unassigned'
  let sectionBucket: TaskBucket | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const staffMatch = line.match(/^@(.+)$/)
    if (staffMatch) {
      currentStaff = staffMatch[1].replace(/\s*\([^)]*\)\s*/g, '').trim()
      sectionBucket = null
      continue
    }
    if (KNOWN_STAFF.includes(line)) {
      currentStaff = line
      sectionBucket = null
      continue
    }

    const header = line.replace(/:$/, '').trim().toLowerCase()
    if (header === 'all client requests' || header === 'client requests') {
      sectionBucket = 'Client Requests'
      continue
    }
    if (header === 'normal list' || header === 'normal') {
      sectionBucket = null
      continue
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/)
    if (!bulletMatch) continue

    const content = bulletMatch[1].trim()
    if (!content) continue

    const originalText = content
    const reviewReasons: string[] = []
    const extracted = extractNotes(content)
    let titleText = extracted.title
    const extraNotes = [...extracted.notes]

    const clientMatch = tryMatchClient(titleText, clients)
    const { clientId, clientName, confidence, remaining } = clientMatch
    titleText = remaining || titleText

    // A client is either confidently selected or left for the operator. There
    // is no in-between state that could show a badge without setting the field.
    if (confidence === 'needs_review') {
      reviewReasons.push(clientMatch.ambiguousBetween.length > 0
        ? `Choose the client: ${clientMatch.ambiguousBetween.join(' or ')}`
        : 'No confident client match')
    }

    const bucketResult = inferBucket(content, sectionBucket)
    if (!bucketResult.confident) reviewReasons.push('Bucket needs review')

    const title = cleanTitle(titleText, clientName, sectionBucket)
    if (title === 'Confirm task details') reviewReasons.push('Task details need review')

    const priority = inferPriority(content, bucketResult.bucket)
    const notes = [
      ...extraNotes,
      `Original WhatsApp: ${originalText}`,
    ].filter(Boolean).join('\n')

    result.push({
      id: nextImportId(),
      staffName: currentStaff,
      clientId,
      clientName: clientName || null,
      clientConfidence: confidence,
      reviewReasons,
      originalText,
      title,
      bucket: bucketResult.bucket,
      priority,
      dueDate: todayStr(),
      notes: notes || null,
    })
  }

  return result
}

/**
 * Build the saved payload from ONE selection source.
 *
 * client_id and client_name are derived together. Previously client_id came
 * from `clientOption` while client_name came from a separate `clientName`
 * field, so a stale name could be saved with no id — the preview and the saved
 * task disagreeing. A directory client now always carries BOTH or NEITHER;
 * only an explicit manual entry may set a name without an id.
 */
export function morningEditToInput(edit: MorningTaskEdit, clients: ClientOption[] = []): TaskInput {
  const isManual = edit.clientOption === '__manual__'
  const selectedClientId = isManual || !edit.clientOption ? null : edit.clientOption
  // The name is looked up from the id wherever possible, so it cannot drift.
  const resolvedName = selectedClientId
    ? (clients.find(c => c.id === selectedClientId)?.name ?? edit.clientName ?? null)
    : null
  return {
    title: edit.title,
    client_id: selectedClientId,
    client_name: isManual ? edit.manualClientName.trim() || null : resolvedName,
    assigned_to_name: null,
    bucket: edit.bucket,
    priority: edit.priority,
    status: 'to_do',
    due_date: edit.dueDate,
    notes: edit.notes?.trim() || null,
    source: 'morning_list',
  }
}

export const KNOWN_STAFF = ['Sydney', 'Ger-Marie', 'Franco', 'KG', 'Amonique', 'CA']

// ── Duplicate detection ──────────────────────────────────────────────────────

function normaliseRequestText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

export function findDuplicateRequests(
  tasks: CommandCentreTask[],
  clientId: string | null,
  notes: string,
  withinHours = 48,
): CommandCentreTask[] {
  if (!clientId) return []
  const normalised = normaliseRequestText(notes)
  if (!normalised) return []
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000
  return tasks.filter(t => {
    if (t.client_id !== clientId) return false
    if (new Date(t.created_at).getTime() < cutoff) return false
    const tn = normaliseRequestText(t.notes ?? '')
    if (!tn) return false
    const longer = normalised.length >= tn.length ? normalised : tn
    const shorter = normalised.length >= tn.length ? tn : normalised
    return longer.includes(shorter) || shorter.length > 10 && longer.includes(shorter.slice(0, 40))
  })
}

// ── Approval message formatting ──────────────────────────────────────────────

export function formatApprovalMessage(task: CommandCentreTask): string {
  const lines = [
    `*Request:* ${task.title}`,
  ]
  if (task.client_name) lines.push(`*Client:* ${task.client_name}`)
  if (task.notes) lines.push(`*Details:* ${task.notes.slice(0, 500)}`)
  if (task.due_date) lines.push(`*Due:* ${task.due_date}`)
  if (task.package_action) {
    const label = task.package_action === 'use_slot' ? 'Use existing package slot' :
      task.package_action === 'addon' ? 'Add-on (outside package)' : 'Move work'
    lines.push(`*Package action:* ${label}`)
  }
  lines.push('', 'Please review and approve. — CG Dynamics')
  return lines.join('\n')
}

export function formatApprovedMessage(task: CommandCentreTask): string {
  return `✅ Approved: ${task.title}${task.client_name ? ` (${task.client_name})` : ''}`
}

export function formatChangesRequestedMessage(task: CommandCentreTask, note?: string): string {
  const lines = ['✏️ Changes requested']
  if (note) lines.push(`*Note:* ${note}`)
  lines.push(`*Request:* ${task.title}${task.client_name ? ` (${task.client_name})` : ''}`)
  return lines.join('\n')
}

// ── Request display helpers ──────────────────────────────────────────────────

export function requestStateFromTask(task: CommandCentreTask): RequestState {
  if (task.status === 'done' || task.status === 'blocked') return 'closed'
  if (task.status === 'waiting_client') {
    if (task.package_action) return 'waiting_client'
    return 'sent_to_client'
  }
  if (task.status === 'in_progress') return 'in_progress'
  // A task that is already approved or scheduled keeps that state even after it
  // is assigned — assignment is a step within approval, not a step past it.
  if (task.package_action && task.deliverable_id) return 'scheduled'
  if (task.package_action) return 'approved'
  if (task.assigned_to_user_id || task.assigned_to_name) return 'assigned'
  return 'captured'
}

export function requestStateLabel(state: RequestState): string {
  const labels: Record<RequestState, string> = {
    captured: 'Captured',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    ready_to_send: 'Ready to Send',
    sent_to_client: 'Sent to Client',
    waiting_client: 'Waiting for Client',
    approved: 'Approved',
    changes_requested: 'Changes Requested',
    scheduled: 'Scheduled',
    closed: 'Closed',
  }
  return labels[state]
}

export const PACKAGE_ACTIONS: Array<{ value: PackageAction | ''; label: string }> = [
  { value: '', label: 'Unclassified' },
  { value: 'use_slot', label: 'Use package slot' },
  { value: 'addon', label: 'Add-on (outside package)' },
  { value: 'move_work', label: 'Move work' },
]
