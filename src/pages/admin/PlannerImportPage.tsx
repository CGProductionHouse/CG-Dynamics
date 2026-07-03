import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'
import { useAuth } from '../../contexts/AuthContext'
import { listPlannerBoards, type PlannerBoard } from '../../lib/planner'
import {
  applyApprovedRows,
  buildImportPreview,
  parsePlannerWorkbook,
  type ApplyResult,
  type ClassifiedRow,
  type ImportPreview,
} from '../../lib/plannerImport'

// Microsoft Planner import — preview-first, in the app.
//
// Flow: upload a Planner Excel export -> rows parse in the browser -> diffed
// against live planner_tasks (same import_hash recipe as the CLI script) ->
// creates / already-imported / conflicts are shown -> an admin approves
// exactly which rows to apply. Nothing is written before approval, conflicts
// are never auto-applied, and repeat applies are idempotent.

const KIND_BADGE: Record<ClassifiedRow['kind'], { label: string; cls: string }> = {
  create: { label: 'New', cls: 'border-brand-teal/30 bg-brand-teal/10 text-[#2dd4bf]' },
  exists: { label: 'Already imported', cls: 'border-white/10 bg-white/[0.04] text-brand-primary/50' },
  conflict: { label: 'Conflict', cls: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
}

export default function PlannerImportPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [boards, setBoards] = useState<PlannerBoard[]>([])
  const [boardId, setBoardId] = useState('')
  const [planName, setPlanName] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [approved, setApproved] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null)

  useEffect(() => {
    listPlannerBoards().then(({ data }) => {
      const rows = (data ?? []) as PlannerBoard[]
      setBoards(rows.filter(board => board.board_type !== 'client_schedule'))
    })
  }, [])

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setPreview(null)
    setApplyResult(null)
    setFileName(file.name)
    if (!planName.trim()) setPlanName(file.name.replace(/\.[^.]+$/, '').trim())
    file.arrayBuffer().then(setFileBuffer).catch(() => setError('Could not read the file.'))
  }

  async function handlePreview() {
    if (!fileBuffer || !boardId || !planName.trim()) return
    setWorking(true)
    setError(null)
    setApplyResult(null)
    try {
      const parsed = await parsePlannerWorkbook(fileBuffer, planName.trim())
      if (parsed.tasks.length === 0) {
        setError('No tasks found in the first sheet. Check that this is a Planner task export.')
        setPreview(null)
        return
      }
      const { preview: built, error: previewError } = await buildImportPreview(planName.trim(), parsed, boardId)
      if (previewError || !built) {
        setError(previewError ?? 'Could not build the preview.')
        setPreview(null)
        return
      }
      setPreview(built)
      // Clean creates are pre-approved; conflicts must be ticked deliberately.
      setApproved(new Set(built.rows.filter(row => row.kind === 'create').map(row => row.task.importHash)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse the workbook.')
      setPreview(null)
    } finally {
      setWorking(false)
    }
  }

  function toggleRow(hash: string) {
    setApproved(prev => {
      const next = new Set(prev)
      if (next.has(hash)) next.delete(hash)
      else next.add(hash)
      return next
    })
  }

  async function handleApply() {
    if (!preview || !boardId || approved.size === 0) return
    const approvedTasks = preview.rows
      .filter(row => row.kind !== 'exists' && approved.has(row.task.importHash))
      .map(row => row.task)
    const conflictCount = preview.rows.filter(row => row.kind === 'conflict' && approved.has(row.task.importHash)).length
    const confirmed = window.confirm(
      `Import ${approvedTasks.length} task(s) into this board${conflictCount > 0 ? ` (including ${conflictCount} flagged conflict(s))` : ''}? Already-imported rows are skipped automatically.`,
    )
    if (!confirmed) return
    setApplying(true)
    setError(null)
    try {
      const result = await applyApprovedRows(preview.planName, boardId, approvedTasks)
      setApplyResult(result)
      if (result.error) setError(result.error)
      else await handlePreview() // reclassify so applied rows now show as imported
    } finally {
      setApplying(false)
    }
  }

  const selectedBoard = useMemo(() => boards.find(board => board.id === boardId) ?? null, [boards, boardId])
  const approvableCount = preview
    ? preview.rows.filter(row => row.kind !== 'exists' && approved.has(row.task.importHash)).length
    : 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2b66f]">Planner</p>
        <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">Microsoft Planner Import</h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-primary/75">
          Upload a Planner task export, preview exactly what would change, then approve the rows to import.
          Nothing is written without approval, conflicts are flagged instead of overwritten, and re-importing
          the same file never duplicates tasks.
        </p>
      </div>

      {/* Step 1 — target + file */}
      <section className="mb-4 rounded-xl border border-white/8 bg-white/[0.035] p-4">
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-brand-primary/60">1 · Export and target</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-brand-primary">Target board</span>
            <select
              value={boardId}
              onChange={event => { setBoardId(event.target.value); setPreview(null); setApplyResult(null) }}
              className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
            >
              <option value="">Select a board…</option>
              {boards.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-brand-primary">Plan name (as in Teams)</span>
            <input
              value={planName}
              onChange={event => { setPlanName(event.target.value); setPreview(null) }}
              placeholder="e.g. To Do"
              className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder:text-brand-primary/40 focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
            <span className="mt-1 block text-[11px] text-brand-primary/50">
              Must match the plan name used by earlier imports so duplicates are recognised.
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-brand-primary">Planner Excel export (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="w-full text-sm text-brand-primary file:mr-3 file:rounded-lg file:border file:border-brand-muted file:bg-brand-bg file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            {fileName && <span className="mt-1 block truncate text-[11px] text-brand-primary/50">{fileName}</span>}
          </label>
        </div>
        <div className="mt-4">
          <ActionButton
            variant="primary"
            onClick={handlePreview}
            disabled={!fileBuffer || !boardId || !planName.trim() || working}
            loading={working}
          >
            {working ? 'Analysing…' : 'Preview import'}
          </ActionButton>
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      {applyResult && !applyResult.error && (
        <p className="mb-4 rounded-lg border border-brand-teal/25 bg-brand-teal/10 px-3 py-2 text-sm text-[#2dd4bf]">
          Imported {applyResult.tasksInserted} task(s)
          {applyResult.bucketsCreated > 0 ? `, created ${applyResult.bucketsCreated} bucket(s)` : ''}
          {applyResult.skippedAsDuplicates > 0 ? `, skipped ${applyResult.skippedAsDuplicates} duplicate(s)` : ''}.{' '}
          <Link to="/admin/planner" className="underline">Open Planner Board</Link>
        </p>
      )}

      {/* Step 2 — preview */}
      {preview && (
        <section className="rounded-xl border border-white/8 bg-white/[0.035]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/8 p-4">
            <h2 className="mr-2 text-sm font-black uppercase tracking-[0.14em] text-brand-primary/60">2 · Preview</h2>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${KIND_BADGE.create.cls}`}>{preview.counts.create} new</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${KIND_BADGE.conflict.cls}`}>{preview.counts.conflict} conflicts</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${KIND_BADGE.exists.cls}`}>{preview.counts.exists} already imported</span>
            {preview.newBucketNames.length > 0 && (
              <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-xs font-bold text-sky-300">
                {preview.newBucketNames.length} new bucket(s): {preview.newBucketNames.join(', ')}
              </span>
            )}
            <div className="ml-auto">
              <ActionButton
                variant="primary"
                onClick={handleApply}
                disabled={!isAdmin || approvableCount === 0 || applying}
                loading={applying}
              >
                {isAdmin ? `Import ${approvableCount} approved` : 'Admin only'}
              </ActionButton>
            </div>
          </div>

          {preview.warnings.length > 0 && (
            <div className="border-b border-white/8 bg-amber-400/[0.05] px-4 py-3">
              {preview.warnings.map(warning => (
                <p key={warning} className="text-xs leading-relaxed text-amber-200/80">{warning}</p>
              ))}
            </div>
          )}

          <ul className="divide-y divide-white/[0.05]">
            {preview.rows.map(row => {
              const badge = KIND_BADGE[row.kind]
              const checked = approved.has(row.task.importHash)
              return (
                <li key={row.task.importHash} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
                  {row.kind === 'exists' ? (
                    <span className="w-4 shrink-0" />
                  ) : (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRow(row.task.importHash)}
                      className="h-4 w-4 shrink-0 accent-[#2dd4bf]"
                    />
                  )}
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${row.kind === 'exists' ? 'text-brand-primary/45' : 'text-white'}`}>
                    {row.task.title}
                  </span>
                  <span className="shrink-0 text-xs text-brand-primary/55">{row.task.bucket}</span>
                  {row.task.dueDate && <span className="shrink-0 text-xs text-brand-primary/55">{row.task.dueDate}</span>}
                  {row.task.assignedTo && <span className="hidden shrink-0 text-xs text-brand-primary/45 sm:inline">@{row.task.assignedTo}</span>}
                  {row.reason && (
                    <p className="w-full pl-7 text-[11px] leading-relaxed text-amber-200/70">{row.reason}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {!preview && (
        <section className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-brand-primary/60">
          <p className="font-semibold text-brand-primary/80">How to export from Microsoft Planner</p>
          <p className="mt-1 leading-relaxed">
            In Teams / Planner open the plan → … → <span className="text-white/80">Export plan to Excel</span>, then upload
            the file here. Multi-workbook migrations (client schedule, packages, checklists) still use the CLI:
            <code className="ml-1 rounded bg-brand-bg px-1.5 py-0.5 text-xs text-white/70">node scripts/import-planner-exports.mjs --mode dry-run</code>
          </p>
          {selectedBoard && <p className="mt-2 text-xs text-brand-primary/50">Importing into: {selectedBoard.name}</p>}
        </section>
      )}
    </div>
  )
}
