import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import XLSX from 'xlsx'

const ROOT = process.cwd()
const EXPORT_DIR = path.join(ROOT, 'docs', 'planner-exports')
const GENERATED_DIR = path.join(ROOT, 'scripts', 'generated')
const PREVIEW_JSON = path.join(GENERATED_DIR, 'planner-import-preview.json')
const PREVIEW_SQL = path.join(GENERATED_DIR, 'planner-import-preview.sql')

const FILES = [
  { file: '2025 CLIENTS SCHEDULE.xlsx', plan: '2025 CLIENTS SCHEDULE', kind: 'client_schedule', boardSlug: 'client-schedule' },
  { file: 'To Do.xlsx', plan: 'To Do', kind: 'planner_tasks', boardSlug: 'operations-todo' },
  { file: 'Client Websites.xlsx', plan: 'Client Websites', kind: 'planner_tasks', boardSlug: 'client-websites' },
  { file: 'ADMIN CHECK LIST.xlsx', plan: 'ADMIN CHECK LIST', kind: 'admin_tasks', boardSlug: 'admin-check-list' },
]

const PACKAGE_TYPES = ['dp', 'photo', 'video', 'reel']

function argValue(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`)
  return idx === -1 ? fallback : process.argv[idx + 1]
}

function normalise(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function ensureGeneratedDir() {
  fs.mkdirSync(GENERATED_DIR, { recursive: true })
}

function get(row, names) {
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

function parseDate(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }

  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

function monthStart(date) {
  if (!date) return null
  return `${date.slice(0, 7)}-01`
}

function detectPackageDeliverable(title) {
  const text = String(title ?? '').trim()
  const patterns = [
    { type: 'dp', regex: /\bDP\s*[-_ ]?(\d+)\b/i, code: 'DP' },
    { type: 'photo', regex: /\bF\s*[-_ ]?(\d+)\b/i, code: 'F' },
    { type: 'video', regex: /\bVideo\s*[-_ ]?(\d+)\b/i, code: 'Video' },
    { type: 'reel', regex: /\bReel\s*[-_ ]?(\d+)\b/i, code: 'Reel' },
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern.regex)
    if (match) {
      const instance = Number(match[1])
      return {
        type: pattern.type,
        code: pattern.type === 'video' || pattern.type === 'reel' ? `${pattern.code} ${instance}` : `${pattern.code}${instance}`,
        instance,
      }
    }
  }
  return null
}

function mapStatus(value, planKind) {
  const status = normalise(value)
  if (!status || status.includes('notstarted')) return 'to_do'
  if (status.includes('progress')) return 'in_progress'
  if (status.includes('complete') || status.includes('done')) {
    return planKind === 'client_schedule' ? 'scheduled' : 'approved'
  }
  return 'to_do'
}

function mapPriority(row, bucket) {
  const priority = normalise(get(row, ['Priority', 'Labels', 'Label']))
  const bucketName = normalise(bucket)
  if (priority.includes('urgent')) return 'urgent'
  if (bucketName.includes('clientrequest')) return 'client_request'
  return 'normal'
}

function parseChecklist(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return []
  return raw.split(/;|\n/).map(item => item.trim()).filter(Boolean)
}

function readRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheets = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
    sheets.push({ sheetName, rows })
  }
  return sheets
}

function isImportTaskSheet(sheetName) {
  return normalise(sheetName) === 'tasks'
}

function taskFromRow(row, source) {
  const title = String(get(row, ['Task Name', 'Title', 'Name'])).trim()
  const bucket = String(get(row, ['Bucket Name', 'Bucket'])).trim() || 'Imported'
  const dueDate = parseDate(get(row, ['Due Date', 'Due date', 'Due']))
  const startDate = parseDate(get(row, ['Start Date', 'Start date', 'Start']))
  const originalTaskId = String(get(row, ['Task ID', 'Task Id', 'ID'])).trim() || null
  const assignedTo = String(get(row, ['Assigned To', 'Assigned to', 'Assignees'])).trim() || null
  const notes = String(get(row, ['Description', 'Notes', 'Task Description'])).trim() || null
  const progress = get(row, ['Progress', 'Status'])

  if (!title) return null

  return {
    title,
    bucket,
    startDate,
    dueDate,
    originalTaskId,
    assignedTo,
    notes,
    checklist: parseChecklist(get(row, ['Checklist Items', 'Checklist'])),
    status: mapStatus(progress, source.kind),
    priority: mapPriority(row, bucket),
    plan: source.plan,
    kind: source.kind,
    boardSlug: source.boardSlug,
    importHash: hash(`${source.plan}|${bucket}|${originalTaskId ?? title}|${dueDate ?? ''}`),
  }
}

function buildPreview() {
  const preview = {
    generatedAt: new Date().toISOString(),
    mode: 'dry-run',
    filesFound: [],
    filesMissing: [],
    sheetsRead: [],
    boardsDetected: new Set(),
    bucketsDetected: new Set(),
    tasksDetected: 0,
    clientScheduleCardsDetected: 0,
    packageDeliverablesDetected: 0,
    clientsMatched: [],
    clientsUnmatched: [],
    clientBucketsDetected: [],
    plannerTasksPrepared: [],
    adminTasksPrepared: [],
    clientPackagesPrepared: [],
    packageTemplatesPrepared: [],
    monthlyDeliverablesPrepared: [],
    duplicateEstimate: {
      importHashProtectedPlannerTasks: 0,
      packageUniqueConstraintProtected: 'client_packages active check + package_deliverable_templates(package_id, code) + monthly_deliverables unique constraints',
    },
    warnings: [],
  }

  for (const source of FILES) {
    const filePath = path.join(EXPORT_DIR, source.file)
    if (!fs.existsSync(filePath)) {
      preview.filesMissing.push(source.file)
      continue
    }

    preview.filesFound.push(source.file)
    preview.boardsDetected.add(source.plan)
    const sheets = readRows(filePath)
    for (const { sheetName, rows } of sheets) {
      preview.sheetsRead.push({ file: source.file, sheet: sheetName, rows: rows.length })
      if (!isImportTaskSheet(sheetName)) continue
      for (const row of rows) {
        const task = taskFromRow(row, source)
        if (!task) continue
        preview.tasksDetected += 1
        preview.bucketsDetected.add(task.bucket)

        if (source.kind === 'client_schedule') {
          preview.clientScheduleCardsDetected += 1
          const detected = detectPackageDeliverable(task.title)
          if (!detected) {
            preview.warnings.push({ type: 'unknown_client_schedule_card', bucket: task.bucket, title: task.title })
            continue
          }
          const dueOrStart = task.dueDate ?? task.startDate
          const month = monthStart(dueOrStart)
          if (!month) {
            preview.warnings.push({ type: 'missing_month_date', bucket: task.bucket, title: task.title })
            continue
          }

          preview.packageDeliverablesDetected += 1
          if (!preview.clientBucketsDetected.some(client => client.bucket === task.bucket)) {
            preview.clientBucketsDetected.push({ bucket: task.bucket, normalised: normalise(task.bucket), match: 'resolved_in_generated_sql' })
          }

          preview.monthlyDeliverablesPrepared.push({
            clientBucket: task.bucket,
            clientMatch: 'resolved_in_generated_sql',
            month,
            dueDate: task.dueDate,
            startDate: task.startDate,
            title: task.title,
            assignedTo: task.assignedTo,
            notes: task.notes,
            status: task.status,
            priority: task.priority,
            ...detected,
            importHash: task.importHash,
          })
          continue
        }

        const prepared = {
          boardSlug: source.boardSlug,
          plan: source.plan,
          bucket: task.bucket,
          title: task.title,
          assignedTo: task.assignedTo,
          startDate: task.startDate,
          dueDate: task.dueDate,
          status: task.status,
          priority: task.priority,
          notes: task.notes,
          checklist: task.checklist,
          originalTaskId: task.originalTaskId,
          importHash: task.importHash,
        }

        if (source.kind === 'admin_tasks') preview.adminTasksPrepared.push(prepared)
        else preview.plannerTasksPrepared.push(prepared)
      }
    }
  }

  const byClient = new Map()
  for (const deliverable of preview.monthlyDeliverablesPrepared) {
    const current = byClient.get(deliverable.clientBucket) ?? { dp: 0, photo: 0, video: 0, reel: 0 }
    current[deliverable.type] = Math.max(current[deliverable.type], deliverable.instance)
    byClient.set(deliverable.clientBucket, current)
  }

  for (const [clientBucket, counts] of byClient.entries()) {
    preview.clientPackagesPrepared.push({ clientBucket, packageName: 'Monthly Content Package', match: 'resolved_in_generated_sql' })
    for (const type of PACKAGE_TYPES) {
      for (let i = 1; i <= counts[type]; i++) {
        const code = type === 'video' ? `Video ${i}` : type === 'reel' ? `Reel ${i}` : type === 'photo' ? `F${i}` : `DP${i}`
        preview.packageTemplatesPrepared.push({ clientBucket, type, code, titleTemplate: code, countPerMonth: 1 })
      }
    }
  }

  preview.clientsUnmatched = preview.clientBucketsDetected.map(client => ({
    bucket: client.bucket,
    reason: 'Not checked offline; generated SQL matches against public.clients.name with normalised comparison.',
  }))
  preview.duplicateEstimate.importHashProtectedPlannerTasks = preview.plannerTasksPrepared.length + preview.adminTasksPrepared.length

  preview.boardsDetected = Array.from(preview.boardsDetected)
  preview.bucketsDetected = Array.from(preview.bucketsDetected)
  return preview
}

function sql(value) {
  if (value === null || value === undefined || value === '') return 'null'
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlJson(value) {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
}

function normalisedClientPredicate(bucket) {
  return `lower(regexp_replace(coalesce(c.name, ''), '[^a-z0-9]+', '', 'g')) = ${sql(normalise(bucket))}`
}

function generateSql(preview) {
  const lines = [
    '-- ============================================================',
    '-- CG Dynamics Teams Planner import preview',
    `-- Generated at: ${preview.generatedAt}`,
    '-- REVIEW BEFORE RUNNING. This script is idempotent and non-destructive.',
    '-- It does not delete, drop, truncate, or alter existing imported data.',
    '-- Run supabase/phase-6e-teams-planner-import.sql before this file.',
    '-- ============================================================',
    '',
  ]

  if (preview.filesMissing.length > 0) {
    lines.push('-- Missing local export files:')
    for (const file of preview.filesMissing) lines.push(`-- - ${file}`)
    lines.push('')
  }

  lines.push('-- Client matching happens at SQL runtime using normalised public.clients.name.')
  lines.push('-- Buckets that do not match an existing client will insert no package/monthly rows and need manual review.')
  lines.push('')

  for (const pkg of preview.clientPackagesPrepared) {
    lines.push(`-- Package for client bucket: ${pkg.clientBucket}`)
    lines.push('insert into public.client_packages (client_id, package_name, status, start_date, notes)')
    lines.push(`select c.id, 'Monthly Content Package', 'active', current_date, 'Prepared from Teams Planner Excel dry-run'`)
    lines.push('from public.clients c')
    lines.push(`where ${normalisedClientPredicate(pkg.clientBucket)}`)
    lines.push('  and not exists (')
    lines.push('    select 1 from public.client_packages p')
    lines.push("    where p.client_id = c.id and p.status = 'active' and p.archived_at is null")
    lines.push('  );')
    lines.push('')
  }

  for (const template of preview.packageTemplatesPrepared) {
    lines.push(`-- Template ${template.code} for ${template.clientBucket}`)
    lines.push('insert into public.package_deliverable_templates (package_id, code, deliverable_type, title_template, count_per_month, sort_order)')
    lines.push(`select p.id, ${sql(template.code)}, ${sql(template.type)}, ${sql(template.titleTemplate)}, 1, ${Number(template.code.match(/(\d+)/)?.[1] ?? 1)}`)
    lines.push('from public.clients c')
    lines.push('join public.client_packages p on p.client_id = c.id and p.status = \'active\' and p.archived_at is null')
    lines.push(`where ${normalisedClientPredicate(template.clientBucket)}`)
    lines.push('on conflict (package_id, code) do nothing;')
    lines.push('')
  }

  for (const item of preview.monthlyDeliverablesPrepared) {
    lines.push(`-- Monthly deliverable ${item.code} for ${item.clientBucket} (${item.month})`)
    lines.push('insert into public.monthly_deliverables (client_id, package_id, template_id, month, code, instance_number, title, deliverable_type, production_status, priority, assigned_to_name, due_date, notes)')
    lines.push(`select c.id, p.id, t.id, ${sql(item.month)}::date, ${sql(item.code)}, ${item.instance}, ${sql(item.title)}, ${sql(item.type)}, ${sql(item.status)}, ${sql(item.priority)}, ${sql(item.assignedTo)}, ${item.dueDate ? `${sql(item.dueDate)}::date` : 'null'}, ${sql(item.notes)}`)
    lines.push('from public.clients c')
    lines.push('join public.client_packages p on p.client_id = c.id and p.status = \'active\' and p.archived_at is null')
    lines.push(`join public.package_deliverable_templates t on t.package_id = p.id and t.code = ${sql(item.code)} and t.active = true`)
    lines.push(`where ${normalisedClientPredicate(item.clientBucket)}`)
    lines.push('on conflict do nothing;')
    lines.push('')
  }

  const plannerTasks = [...preview.plannerTasksPrepared, ...preview.adminTasksPrepared]
  for (const task of plannerTasks) {
    lines.push(`-- Planner task: ${task.plan} / ${task.bucket} / ${task.title}`)
    lines.push('insert into public.planner_tasks (board_id, bucket_id, title, assigned_to_name, status, priority, start_date, due_date, notes, checklist, source, original_plan_name, original_bucket_name, original_task_id, import_hash)')
    lines.push(`select b.id, bk.id, ${sql(task.title)}, ${sql(task.assignedTo)}, ${sql(task.status)}, ${sql(task.priority)}, ${task.startDate ? `${sql(task.startDate)}::date` : 'null'}, ${task.dueDate ? `${sql(task.dueDate)}::date` : 'null'}, ${sql(task.notes)}, ${sqlJson(task.checklist)}, 'teams_import', ${sql(task.plan)}, ${sql(task.bucket)}, ${sql(task.originalTaskId)}, ${sql(task.importHash)}`)
    lines.push('from public.planner_boards b')
    lines.push(`left join public.planner_buckets bk on bk.board_id = b.id and lower(bk.name) = lower(${sql(task.bucket)})`)
    lines.push(`where b.slug = ${sql(task.boardSlug)}`)
    lines.push('on conflict (import_hash) do nothing;')
    lines.push('')
  }

  if (preview.warnings.length > 0) {
    lines.push('-- Manual review warnings:')
    for (const warning of preview.warnings) lines.push(`-- ${JSON.stringify(warning).replace(/\r?\n/g, ' ')}`)
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function printSummary(preview) {
  console.log('Teams Planner import preview')
  console.log('----------------------------')
  console.log(`Files found: ${preview.filesFound.length}`)
  for (const file of preview.filesFound) console.log(`  - ${file}`)
  console.log(`Files missing: ${preview.filesMissing.length}`)
  for (const file of preview.filesMissing) console.log(`  - ${file}`)
  console.log(`Sheets read: ${preview.sheetsRead.length}`)
  console.log(`Boards detected: ${preview.boardsDetected.length}`)
  console.log(`Buckets detected: ${preview.bucketsDetected.length}`)
  console.log(`Tasks detected: ${preview.tasksDetected}`)
  console.log(`Client schedule cards detected: ${preview.clientScheduleCardsDetected}`)
  console.log(`Package deliverables detected: ${preview.packageDeliverablesDetected}`)
  console.log(`Clients matched: ${preview.clientsMatched.length}`)
  console.log(`Clients unmatched/manual review: ${preview.clientsUnmatched.length}`)
  console.log(`Planner tasks prepared: ${preview.plannerTasksPrepared.length}`)
  console.log(`Admin tasks prepared: ${preview.adminTasksPrepared.length}`)
  console.log(`Package templates prepared: ${preview.packageTemplatesPrepared.length}`)
  console.log(`Monthly deliverables prepared: ${preview.monthlyDeliverablesPrepared.length}`)
  console.log(`Warnings: ${preview.warnings.length}`)
  console.log(`JSON preview: ${path.relative(ROOT, PREVIEW_JSON)}`)
}

const mode = argValue('mode', 'dry-run')
if (!['dry-run', 'generate-sql'].includes(mode)) {
  console.error('Usage: node scripts/import-planner-exports.mjs --mode dry-run|generate-sql')
  process.exit(1)
}

ensureGeneratedDir()
const preview = buildPreview()
preview.mode = mode
fs.writeFileSync(PREVIEW_JSON, JSON.stringify(preview, null, 2))
printSummary(preview)

if (mode === 'generate-sql') {
  fs.writeFileSync(PREVIEW_SQL, generateSql(preview))
  console.log(`SQL preview: ${path.relative(ROOT, PREVIEW_SQL)}`)
}
