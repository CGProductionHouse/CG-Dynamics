import { supabase } from './supabase'

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
  assigned_to_name: string | null
  bucket: TaskBucket
  priority: TaskPriority
  status: TaskStatus
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
}

export interface TaskInput {
  title: string
  client_id?: string | null
  client_name?: string | null
  assigned_to_user_id?: string | null
  assigned_to_name?: string | null
  bucket: TaskBucket
  priority: TaskPriority
  status: TaskStatus
  due_date: string
  notes?: string | null
  source: TaskSource
  whatsapp_source_text?: string | null
}

const TABLE = 'command_centre_tasks'
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

function taskStatusFromPlanner(status: string): TaskStatus {
  if (status === 'in_progress') return 'in_progress'
  if (status === 'scheduled' || status === 'approved') return 'done'
  if (status === 'ready_internal_review') return 'in_progress'
  return 'to_do'
}

function plannerStatusFromTask(status: TaskStatus): string {
  if (status === 'in_progress') return 'in_progress'
  if (status === 'done') return 'scheduled'
  return 'to_do'
}

function plannerTaskToCommandTask(row: PlannerTaskRow, bucketName: string | undefined): CommandCentreTask {
  const bucket = cleanBucketName(bucketName || row.original_bucket_name)
  return {
    id: `${PLANNER_TASK_PREFIX}${row.id}`,
    native_id: row.id,
    data_origin: 'planner_tasks',
    title: row.title,
    client_id: row.client_id,
    client_name: row.client_name,
    assigned_to_user_id: null,
    assigned_to_name: row.assigned_to_name,
    bucket: bucket as TaskBucket,
    priority: row.priority ?? 'normal',
    status: taskStatusFromPlanner(row.status),
    due_date: row.due_date ?? row.start_date ?? todayStr(),
    notes: row.notes,
    source: row.source === 'teams_import' ? 'teams_import' : 'other',
    whatsapp_source_text: null,
    created_by: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.status === 'scheduled' || row.status === 'approved' ? row.updated_at : null,
    helper_names: row.helper_names,
  }
}

export async function listTasks() {
  const [nativeResult, plannerResult] = await Promise.all([
    supabase
    .from(TABLE)
    .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from(PLANNER_TASKS_TABLE)
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ])

  if (nativeResult.error) return nativeResult
  if (plannerResult.error) {
    if (plannerResult.error.message?.includes('does not exist') || plannerResult.error.code === '42P01') {
      return nativeResult
    }
    return { data: nativeResult.data ?? [], error: plannerResult.error }
  }

  const plannerRows = (plannerResult.data ?? []) as PlannerTaskRow[]
  const bucketIds = unique(plannerRows.map(row => row.bucket_id))
  const bucketNames = new Map<string, string>()

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
  ))

  return { data: [...importedTasks, ...nativeTasks], error: null }
}

export async function createTask(input: TaskInput) {
  return supabase
    .from(TABLE)
    .insert({
      title: input.title,
      client_id: input.client_id ?? null,
      client_name: input.client_name ?? null,
      assigned_to_user_id: input.assigned_to_user_id ?? null,
      assigned_to_name: input.assigned_to_name ?? null,
      bucket: input.bucket,
      priority: input.priority,
      status: input.status,
      due_date: input.due_date,
      notes: input.notes ?? null,
      source: input.source,
      whatsapp_source_text: input.whatsapp_source_text ?? null,
    })
    .select()
    .single()
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  if (isPlannerTaskId(id)) {
    return supabase
      .from(PLANNER_TASKS_TABLE)
      .update({ status: plannerStatusFromTask(status) })
      .eq('id', stripPlannerTaskId(id))
      .select()
      .single()
  }

  return supabase
    .from(TABLE)
    .update({ status })
    .eq('id', id)
    .select()
    .single()
}

export async function updateTask(
  id: string,
  updates: Partial<Omit<CommandCentreTask, 'id' | 'created_at' | 'created_by'>>
) {
  if (isPlannerTaskId(id)) {
    const patch: Record<string, unknown> = {}
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.client_id !== undefined) patch.client_id = updates.client_id
    if (updates.client_name !== undefined) patch.client_name = updates.client_name
    if (updates.assigned_to_name !== undefined) patch.assigned_to_name = updates.assigned_to_name
    if (updates.status !== undefined) patch.status = plannerStatusFromTask(updates.status)
    if (updates.priority !== undefined) patch.priority = updates.priority
    if (updates.due_date !== undefined) patch.due_date = updates.due_date
    if (updates.notes !== undefined) patch.notes = updates.notes
    if (updates.bucket !== undefined) patch.original_bucket_name = updates.bucket
    if (updates.helper_names !== undefined) patch.helper_names = updates.helper_names

    return supabase
      .from(PLANNER_TASKS_TABLE)
      .update(patch)
      .eq('id', stripPlannerTaskId(id))
      .select()
      .single()
  }

  return supabase
    .from(TABLE)
    .update(updates)
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
  updates: Partial<Omit<CommandCentreTask, 'id' | 'created_at' | 'created_by'>>,
): Promise<{ data: unknown; error: unknown; packageFieldsSkipped: boolean }> {
  const result = await updateTask(id, updates)
  if (result.error && isColumnMissingError(result.error) && !isPlannerTaskId(id)) {
    const safeUpdates: Partial<Omit<CommandCentreTask, 'id' | 'created_at' | 'created_by'>> = { ...updates }
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
}

export async function listActiveClients() {
  return supabase
    .from('clients')
    .select('id, name')
    .eq('active', true)
    .order('name')
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
  title: string
  bucket: TaskBucket
  priority: TaskPriority
  dueDate: string
  notes: string
}

function inferBucket(text: string): TaskBucket {
  const lower = text.toLowerCase()
  if (/\b(website|shopify|wordpress)\b/.test(lower)) return 'Websites'
  if (/\b(content guide|guideline)\b/.test(lower)) return 'Content Guides'
  if (/\b(video|reel)\b/.test(lower)) return 'Video'
  if (/\b(design|poster|menu|logo)\b/.test(lower)) return 'Graphic Design'
  if (/\b(photo|photos)\b/.test(lower)) return 'Graphic Design'
  if (/\b(schedule|calendar|post)\b/.test(lower)) return 'Client Schedules'
  if (/\b(strategy|report|campaign ideas|next month)\b/.test(lower)) return 'Admin / To Do'
  return 'Admin / To Do'
}

function inferPriority(text: string): TaskPriority {
  const lower = text.toLowerCase()
  if (/\burgent\b/.test(lower)) return 'urgent'
  if (/\b(client request|client asked)\b/.test(lower)) return 'client_request'
  return 'normal'
}

function tryMatchClient(text: string, clients: ClientOption[]): { clientId: string | null; clientName: string | null; remaining: string } {
  const sorted = [...clients].sort((a, b) => b.name.length - a.name.length)
  const lower = text.toLowerCase()
  for (const c of sorted) {
    const idx = lower.indexOf(c.name.toLowerCase())
    if (idx === -1) continue
    const before = text.slice(0, idx).trim()
    const after = text.slice(idx + c.name.length).trim()
    const remaining = (before + ' ' + after).trim().replace(/\s+/g, ' ')
    return { clientId: c.id, clientName: c.name, remaining }
  }
  return { clientId: null, clientName: null, remaining: text }
}

let importIdCounter = 0
function nextImportId() {
  return `mi-${Date.now().toString(36)}-${++importIdCounter}`
}

export function parseMorningList(input: string, clients: ClientOption[]): ParsedMorningTask[] {
  const lines = input.split('\n')
  const result: ParsedMorningTask[] = []
  let currentStaff = 'Unassigned'

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const staffMatch = line.match(/^@(.+)$/)
    if (staffMatch) {
      currentStaff = staffMatch[1].trim()
      continue
    }
    if (KNOWN_STAFF.includes(line)) {
      currentStaff = line
      continue
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/)
    if (!bulletMatch) continue

    const content = bulletMatch[1].trim()
    if (!content) continue

    let titleText = content
    let extraNotes = ''

    const { clientId, clientName, remaining } = tryMatchClient(titleText, clients)
    titleText = remaining || titleText

    if (!titleText && clientName) {
      titleText = clientName
    }

    const colonIdx = titleText.indexOf(':')
    if (colonIdx > 0) {
      extraNotes = titleText.slice(colonIdx + 1).trim()
      titleText = titleText.slice(0, colonIdx).trim()
    }

    const countPattern = /\d+\s+\w+/g
    const countMatches = titleText.match(countPattern)
    if (countMatches && countMatches.length >= 2) {
      const counts = countMatches.join(', ')
      titleText = titleText.replace(/\d+\s+\w+/g, '').trim()
      extraNotes = extraNotes ? counts + ' — ' + extraNotes : counts
    }

    titleText = titleText.replace(/\s+/g, ' ').trim()
    const bucket = inferBucket(content)
    const priority = inferPriority(content)

    result.push({
      id: nextImportId(),
      staffName: currentStaff,
      clientId,
      clientName: clientName || null,
      title: titleText || content,
      bucket,
      priority,
      dueDate: new Date().toISOString().slice(0, 10),
      notes: extraNotes || null,
    })
  }

  return result
}

export function morningEditToInput(edit: MorningTaskEdit): TaskInput {
  const isManual = edit.clientOption === '__manual__'
  const selectedClientId = isManual || !edit.clientOption ? null : edit.clientOption
  return {
    title: edit.title,
    client_id: selectedClientId,
    client_name: isManual ? edit.manualClientName.trim() || null : null,
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
