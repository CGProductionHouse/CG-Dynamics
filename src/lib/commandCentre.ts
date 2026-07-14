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

function taskStatusFromPlanner(status: string): TaskStatus {
  if (status === 'in_progress') return 'in_progress'
  if (status === 'blocked') return 'blocked'
  if (status === 'waiting_client') return 'waiting_client'
  if (status === 'scheduled' || status === 'approved' || status === 'done') return 'done'
  if (status === 'ready_internal_review') return 'in_progress'
  return 'to_do'
}

function plannerStatusFromTask(status: TaskStatus): string {
  if (status === 'in_progress') return 'in_progress'
  if (status === 'blocked') return 'blocked'
  if (status === 'waiting_client') return 'waiting_client'
  if (status === 'done') return 'done'
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
    due_date: row.due_date ?? row.start_date ?? '',
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

  const plannerRows = ((plannerResult.data ?? []) as PlannerTaskRow[])
    .filter(row => !row.archived_at && !row.recurrence_rule)
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
    const rpcResult = await supabase.rpc('update_planner_task_status', { p_task_id: taskId, p_status: mappedStatus })
    if (!rpcResult.error || rpcResult.error.code !== 'PGRST202') return rpcResult
    return supabase.from(PLANNER_TASKS_TABLE).update({ status: mappedStatus }).eq('id', taskId).select().single()
  }

  const rpcResult = await supabase.rpc('update_command_centre_task_status', { p_task_id: id, p_status: status })
  if (!rpcResult.error || rpcResult.error.code !== 'PGRST202') return rpcResult
  return supabase.from(TABLE).update({ status }).eq('id', id).select().single()
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
  clientConfidence: 'matched' | 'suggested' | 'needs_review'
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

const CLIENT_ALIASES: Record<string, string[]> = {
  'Zooz Lifestyle WFF': ['WFF', 'Zooz', 'Lifestyle WFF'],
  'Madison Wear': ['Madison', 'Madisons'],
  'Bouwer & Coetzee': ['Bouwer', 'Bouwer & Coetsee', 'Bouwer and Coetzee'],
  'EHP Slaghuis': ['EHP', 'EHP slaguis', 'EHP slaghuis'],
  'Supa Quick BFN': ['Supa Quick BFN', 'BFN'],
  'Supa Quick Centurion': ['Supa Quick Centurion', 'Centurion'],
  'Wiseman Group': ['Wiseman', 'Wiseman group'],
  'Red Oak': ['Red Oak'],
  'Watch Addict': ['Watch Addict'],
  Loraclox: ['Loraclox'],
  Securiforce: ['Securiforce'],
  Germoparts: ['Germoparts'],
}

const COMMON_CLIENT_WORDS = new Set(['and', 'the', 'group', 'pty', 'ltd', 'cc', 'co', 'company', 'production', 'house', 'vir', 'for', 'in', 'on', 'of'])

function normaliseText(value: string) {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function tokenise(value: string) {
  return normaliseText(value).split(' ').filter(token => token.length > 1 && !COMMON_CLIENT_WORDS.has(token))
}

function getClientAliases(clientName: string) {
  const aliases = new Set<string>([clientName])
  const normalisedClient = normaliseText(clientName)
  for (const [canonical, values] of Object.entries(CLIENT_ALIASES)) {
    const normalisedCanonical = normaliseText(canonical)
    if (normalisedClient.includes(normalisedCanonical) || normalisedCanonical.includes(normalisedClient)) {
      aliases.add(canonical)
      values.forEach(alias => aliases.add(alias))
    }
  }
  const initials = clientName.split(/\s+/).map(part => part[0]).join('').toUpperCase()
  if (initials.length >= 2) aliases.add(initials)
  return Array.from(aliases).sort((a, b) => b.length - a.length)
}

function removeClientAlias(text: string, alias: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text
    .replace(new RegExp(`(^|\\b)${escaped}(\\b|$)`, 'i'), ' ')
    .replace(/\b(vir|for)\s*$/i, ' ')
    .replace(/^\s*(vir|for)\b/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tryMatchClient(text: string, clients: ClientOption[]) {
  const normalised = normaliseText(text)
  const textTokens = new Set(tokenise(text))
  let best: { client: ClientOption; alias: string; score: number } | null = null

  for (const client of clients) {
    for (const alias of getClientAliases(client.name)) {
      const aliasNorm = normaliseText(alias)
      const aliasTokens = tokenise(alias)
      let score = 0
      if (aliasNorm && new RegExp(`(^|\\s)${aliasNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(normalised)) {
        score = aliasTokens.length <= 1 ? 82 : 96
      } else if (aliasTokens.length > 0 && aliasTokens.every(token => textTokens.has(token))) {
        score = aliasTokens.length === 1 ? 58 : 88
      } else {
        const overlap = aliasTokens.filter(token => textTokens.has(token)).length
        if (overlap > 0) score = Math.round((overlap / aliasTokens.length) * 62)
      }
      if (!best || score > best.score || (score === best.score && alias.length > best.alias.length)) best = { client, alias, score }
    }
  }

  if (!best || best.score < 55) {
    return { clientId: null, clientName: null, confidence: 'needs_review' as const, remaining: text }
  }

  return {
    clientId: best.client.id,
    clientName: best.client.name,
    confidence: best.score >= 80 ? 'matched' as const : 'suggested' as const,
    remaining: removeClientAlias(text, best.alias) || text,
  }
}

function inferBucket(text: string, sectionBucket: TaskBucket | null): { bucket: TaskBucket; confident: boolean } {
  const lower = text.toLowerCase()
  if (/\b(website|web|landing page|google site|shopify|wordpress)\b/.test(lower)) return { bucket: 'Websites', confident: true }
  if (/\b(content guide|content plan|posting guide|caption guide|guideline)\b/.test(lower)) return { bucket: 'Content Guides', confident: true }
  if (/\b(video|bts|reel|liedjie|liedjue|audio|music|content run)\b/.test(lower)) return { bucket: 'Video', confident: true }
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

    const { clientId, clientName, confidence, remaining } = tryMatchClient(titleText, clients)
    titleText = remaining || titleText

    if (confidence === 'suggested') reviewReasons.push('Suggested client match')
    if (confidence === 'needs_review') reviewReasons.push('No confident client match')

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
      clientConfidence: reviewReasons.length > 0 && confidence === 'matched' ? 'needs_review' : confidence,
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

export function morningEditToInput(edit: MorningTaskEdit): TaskInput {
  const isManual = edit.clientOption === '__manual__'
  const selectedClientId = isManual || !edit.clientOption ? null : edit.clientOption
  return {
    title: edit.title,
    client_id: selectedClientId,
    client_name: isManual ? edit.manualClientName.trim() || null : edit.clientName,
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
