import { supabase } from './supabase'

// CG Assistant canonical task actions. planner_tasks direct writes are
// manager-only via RLS; staff act through these audited SECURITY DEFINER RPCs
// (create_assistant_task / update_assistant_task) which enforce role rules,
// write the audit log, and notify the assignee. No hidden store, no bypass.

export interface CreateAssistantTaskInput {
  title: string
  assigneeName?: string | null
  dueDate?: string | null // null preserves "no due date"
  clientId?: string | null
  clientName?: string | null
  notes?: string | null
}

export async function createAssistantTask(input: CreateAssistantTaskInput) {
  return supabase.rpc('create_assistant_task', {
    p_title: input.title,
    p_assignee_name: input.assigneeName ?? null,
    p_due_date: input.dueDate ?? null,
    p_client_id: input.clientId ?? null,
    p_client_name: input.clientName ?? null,
    p_notes: input.notes ?? null,
  })
}

export type AssistantTaskAction = 'reassign' | 'assign' | 'due' | 'complete' | 'block' | 'comment'

export interface UpdateAssistantTaskInput {
  taskId: string
  action: AssistantTaskAction
  assigneeName?: string | null
  dueDate?: string | null
  comment?: string | null
}

export async function updateAssistantTask(input: UpdateAssistantTaskInput) {
  return supabase.rpc('update_assistant_task', {
    p_task_id: input.taskId,
    p_action: input.action,
    p_assignee_name: input.assigneeName ?? null,
    p_due_date: input.dueDate ?? null,
    p_comment: input.comment ?? null,
  })
}
