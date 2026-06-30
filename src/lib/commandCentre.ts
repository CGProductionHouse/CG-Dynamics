import { supabase } from './supabase'

export type TaskBucket =
  | 'Client Requests'
  | 'Graphic Design'
  | 'Video'
  | 'Websites'
  | 'Admin / To Do'
  | 'Content Guides'
  | 'Once-off'
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

export type TaskSource = 'manual' | 'whatsapp_paste' | 'morning_list' | 'other'

export type PackageAction = 'use_slot' | 'addon' | 'move_work'

export interface CommandCentreTask {
  id: string
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

export async function listTasks() {
  return supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
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
  return supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select()
    .single()
}

export async function deleteTask(id: string) {
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
  'Client Requests',
  'Graphic Design',
  'Video',
  'Websites',
  'Admin / To Do',
  'Content Guides',
  'Once-off',
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
