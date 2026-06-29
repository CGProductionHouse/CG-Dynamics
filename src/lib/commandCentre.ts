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

export const KNOWN_STAFF = ['Sydney', 'Ger-Marie', 'Franco', 'KG', 'Amonique', 'CA']
