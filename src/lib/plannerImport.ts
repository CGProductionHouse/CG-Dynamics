import { supabase } from './supabase'
import type { PlannerTaskStatus, TaskPriority } from './planner'

// ── In-browser Microsoft Planner import preview ───────────────────────────────
//
// Parses a Microsoft Planner Excel export in the browser and diffs it against
// live planner_tasks BEFORE anything is written — the preview-first flow from
// docs/recurring-tasks-and-microsoft-import.md:
//   Microsoft data -> mapped preview -> conflict flags -> approve -> apply.
//
// Hash parity: import_hash uses the exact recipe from
// scripts/import-planner-exports.mjs — sha256(`plan|bucket|taskIdOrTitle|due`)
// — so rows already imported by the CLI script are recognised as existing and
// re-imports stay idempotent across both tools.

export interface ParsedPlannerTask {
  title: string
  bucket: string
  bucketIsPlannerId: boolean
  startDate: string | null
  dueDate: string | null
  originalTaskId: string | null
  assignedTo: string | null
  assignedLooksLikeId: boolean
  notes: string | null
  status: PlannerTaskStatus
  priority: TaskPriority
  importHash: string
}

export type ImportRowKind = 'create' | 'exists' | 'conflict'

export interface ClassifiedRow {
  task: ParsedPlannerTask
  kind: ImportRowKind
  /** Human reason for a conflict flag. */
  reason: string | null
}

export interface ImportPreview {
  planName: string
  rows: ClassifiedRow[]
  counts: { create: number; exists: number; conflict: number }
  newBucketNames: string[]
  warnings: string[]
}

function normalise(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
}

// Same tolerant header lookup as the CLI script.
function get(row: Record<string, unknown>, names: string[]): unknown {
  const entries = Object.entries(row)
  for (const name of names) {
    const direct = row[name]
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct
    const wanted = normalise(name)
    const match = entries.find(([key, value]) => normalise(key) === wanted && String(value ?? '').trim() !== '')
    if (match) return match[1]
  }
  return ''
}

function looksLikePlannerId(value: unknown): boolean {
  const text = String(value ?? '').trim()
  return /^[A-Za-z0-9_-]{16,}$/.test(text) && !/\s/.test(text)
}

function parseDateCell(value: unknown): string | null {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  }
  return null
}

function mapStatus(value: unknown): PlannerTaskStatus {
  const status = normalise(value)
  if (!status || status.includes('notstarted')) return 'to_do'
  if (status.includes('progress')) return 'in_progress'
  if (status.includes('complete') || status.includes('done')) return 'approved'
  return 'to_do'
}

function mapPriority(row: Record<string, unknown>, bucket: string): TaskPriority {
  const priority = normalise(get(row, ['Priority', 'Labels', 'Label']))
  const bucketName = normalise(bucket)
  if (priority.includes('urgent')) return 'urgent'
  if (bucketName.includes('clientrequest')) return 'client_request'
  return 'normal'
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

// Parses the first worksheet of a Planner export. xlsx is imported lazily so
// the (heavy) parser stays out of the main app bundle.
export async function parsePlannerWorkbook(buffer: ArrayBuffer, planName: string): Promise<{ tasks: ParsedPlannerTask[]; warnings: string[] }> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { tasks: [], warnings: ['Workbook has no sheets.'] }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '', raw: false })

  const warnings: string[] = []
  const tasks: ParsedPlannerTask[] = []
  for (const row of rows) {
    const title = String(get(row, ['Task Name', 'Title', 'Name'])).trim()
    if (!title) continue
    const bucket = String(get(row, ['Bucket Name', 'Bucket'])).trim() || 'Imported'
    const bucketIsPlannerId = looksLikePlannerId(bucket)
    const dueDate = parseDateCell(get(row, ['Due Date', 'Due date', 'Due']))
    const startDate = parseDateCell(get(row, ['Start Date', 'Start date', 'Start']))
    const originalTaskId = String(get(row, ['Task ID', 'Task Id', 'ID'])).trim() || null
    const assignedRaw = String(get(row, ['Assigned To', 'Assigned to', 'Assignees'])).trim()
    const assignedLooksLikeId = looksLikePlannerId(assignedRaw)
    // Identical recipe to scripts/import-planner-exports.mjs taskFromRow().
    const importHash = await sha256Hex(`${planName}|${bucket}|${originalTaskId ?? title}|${dueDate ?? ''}`)
    tasks.push({
      title,
      bucket,
      bucketIsPlannerId,
      startDate,
      dueDate,
      originalTaskId,
      assignedTo: assignedRaw && !assignedLooksLikeId ? assignedRaw.split(';')[0].trim() : null,
      assignedLooksLikeId,
      notes: String(get(row, ['Description', 'Notes', 'Task Description'])).trim() || null,
      status: mapStatus(get(row, ['Progress', 'Status'])),
      priority: mapPriority(row, bucket),
      importHash,
    })
  }
  if (tasks.some(task => task.bucketIsPlannerId)) {
    warnings.push('Some buckets are raw Planner IDs — this export lacks readable bucket names. Use the CLI importer (with its lookup sheets) for this file, or fix the export.')
  }
  if (tasks.some(task => task.assignedLooksLikeId)) {
    warnings.push('Some Assigned To values are raw Planner IDs and were left unassigned. Assign staff after import or use the CLI importer.')
  }
  return { tasks, warnings }
}

// Diff parsed tasks against live planner_tasks. Never writes.
export async function buildImportPreview(
  planName: string,
  parsed: { tasks: ParsedPlannerTask[]; warnings: string[] },
  boardId: string,
): Promise<{ preview: ImportPreview | null; error: string | null }> {
  const [taskResult, bucketResult] = await Promise.all([
    supabase.from('planner_tasks').select('import_hash, title, board_id'),
    supabase.from('planner_buckets').select('id, name').eq('board_id', boardId).is('archived_at', null),
  ])
  if (taskResult.error) return { preview: null, error: taskResult.error.message }
  if (bucketResult.error) return { preview: null, error: bucketResult.error.message }

  const existingHashes = new Set((taskResult.data ?? []).map(row => row.import_hash as string))
  const boardTitles = new Set(
    (taskResult.data ?? [])
      .filter(row => row.board_id === boardId)
      .map(row => normalise(row.title)),
  )
  const existingBucketNames = new Set((bucketResult.data ?? []).map(row => normalise(row.name)))

  const rows: ClassifiedRow[] = parsed.tasks.map(task => {
    if (existingHashes.has(task.importHash)) {
      return { task, kind: 'exists', reason: null }
    }
    if (boardTitles.has(normalise(task.title))) {
      return {
        task,
        kind: 'conflict',
        reason: 'A task with this title already exists on the board but with different details (date, bucket or ID). Review before importing to avoid a near-duplicate.',
      }
    }
    if (task.bucketIsPlannerId) {
      return { task, kind: 'conflict', reason: 'Bucket is a raw Planner ID — needs the CLI importer or a corrected export.' }
    }
    return { task, kind: 'create', reason: null }
  })

  const newBucketNames = [...new Set(
    rows
      .filter(row => row.kind !== 'exists' && !row.task.bucketIsPlannerId)
      .map(row => row.task.bucket)
      .filter(name => !existingBucketNames.has(normalise(name))),
  )]

  return {
    preview: {
      planName,
      rows,
      counts: {
        create: rows.filter(row => row.kind === 'create').length,
        exists: rows.filter(row => row.kind === 'exists').length,
        conflict: rows.filter(row => row.kind === 'conflict').length,
      },
      newBucketNames,
      warnings: parsed.warnings,
    },
    error: null,
  }
}

export interface ApplyResult {
  bucketsCreated: number
  tasksInserted: number
  skippedAsDuplicates: number
  error: string | null
}

// Apply ONLY the approved rows. Missing buckets are created first; tasks are
// inserted with onConflict(import_hash) ignoreDuplicates so a double-click or
// a repeat apply can never duplicate work. Admin-only by RLS (planner_tasks
// insert policy) — the UI also gates the button.
export async function applyApprovedRows(
  planName: string,
  boardId: string,
  approved: ParsedPlannerTask[],
): Promise<ApplyResult> {
  if (approved.length === 0) return { bucketsCreated: 0, tasksInserted: 0, skippedAsDuplicates: 0, error: null }

  const bucketResult = await supabase
    .from('planner_buckets')
    .select('id, name')
    .eq('board_id', boardId)
    .is('archived_at', null)
  if (bucketResult.error) return { bucketsCreated: 0, tasksInserted: 0, skippedAsDuplicates: 0, error: bucketResult.error.message }

  const bucketIdByName = new Map<string, string>(
    (bucketResult.data ?? []).map(row => [normalise(row.name), row.id as string]),
  )

  const missingNames = [...new Set(
    approved.map(task => task.bucket).filter(name => !bucketIdByName.has(normalise(name))),
  )]
  let bucketsCreated = 0
  if (missingNames.length > 0) {
    const { data: createdBuckets, error: bucketError } = await supabase
      .from('planner_buckets')
      .insert(missingNames.map((name, index) => ({ board_id: boardId, name, bucket_type: 'other', sort_order: 900 + index })))
      .select('id, name')
    if (bucketError) return { bucketsCreated: 0, tasksInserted: 0, skippedAsDuplicates: 0, error: `Could not create buckets: ${bucketError.message}` }
    for (const bucket of createdBuckets ?? []) bucketIdByName.set(normalise(bucket.name), bucket.id as string)
    bucketsCreated = createdBuckets?.length ?? 0
  }

  const rows = approved.map(task => ({
    board_id: boardId,
    bucket_id: bucketIdByName.get(normalise(task.bucket)) ?? null,
    title: task.title,
    client_id: null,
    client_name: null,
    assigned_to_name: task.assignedTo,
    status: task.status,
    priority: task.priority,
    start_date: task.startDate,
    due_date: task.dueDate,
    notes: task.notes,
    source: 'teams_import',
    original_plan_name: planName,
    original_bucket_name: task.bucket,
    original_task_id: task.originalTaskId,
    import_hash: task.importHash,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('planner_tasks')
    .upsert(rows, { onConflict: 'import_hash', ignoreDuplicates: true })
    .select('id')
  if (insertError) return { bucketsCreated, tasksInserted: 0, skippedAsDuplicates: 0, error: insertError.message }

  const insertedCount = inserted?.length ?? 0
  return {
    bucketsCreated,
    tasksInserted: insertedCount,
    skippedAsDuplicates: approved.length - insertedCount,
    error: null,
  }
}
