import { useEffect, useMemo, useState } from 'react'
import { listClients, type Client } from '../../lib/db/clients'
import {
  deleteImportGroup,
  listImportGroups,
  type ImportedMetaPostGroup,
} from '../../lib/db/importedMetaPosts'
import { formatReportPeriod } from '../../lib/reportPeriod'
import { formatNumber } from '../../lib/reportStats'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function periodLabel(group: ImportedMetaPostGroup) {
  if (!group.period_start || !group.period_end) return 'Unknown period'
  return formatReportPeriod({ start: group.period_start, end: group.period_end })
}

export default function ImportsManagement() {
  const [clients, setClients] = useState<Client[]>([])
  const [groups, setGroups] = useState<ImportedMetaPostGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<ImportedMetaPostGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const clientNameById = useMemo(() => {
    return new Map(clients.map(client => [client.id, client.name]))
  }, [clients])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [clientsRes, groupsRes] = await Promise.all([listClients(), listImportGroups()])
      const loadError = clientsRes.error ?? groupsRes.error
      if (loadError) {
        setError(loadError.message)
        return
      }
      setClients(clientsRes.data)
      setGroups(groupsRes.data)
    } catch (error) {
      setError(errorMessage(error, 'Could not load imports.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleDelete(group: ImportedMetaPostGroup) {
    const clientName = clientNameById.get(group.client_id) ?? group.client_id
    const deleteMode = group.can_delete_by_batch
      ? 'this import batch only'
      : 'all imported posts matching this client, platform, source file, and detected period'
    const confirmed = window.confirm(
      `Delete imported CSV data for ${clientName} (${periodLabel(group)})?\n\nThis will delete ${deleteMode}.\n\nIt will not delete the client and it will not delete reports.`
    )
    if (!confirmed) return

    setDeletingKey(group.key)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await deleteImportGroup(group)
      if (error) {
        setError(error.message)
        return
      }
      setSuccess(`Deleted import data for ${clientName} (${periodLabel(group)}).`)
      setSelectedGroup(null)
      await load()
    } catch (error) {
      setError(errorMessage(error, 'Could not delete this import.'))
    } finally {
      setDeletingKey(null)
    }
  }

  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Imports</p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Import management</h1>
        <p className="text-sm text-brand-primary mt-2 max-w-2xl">
          Review uploaded CSV imports and remove incorrect imported post data without deleting clients or reports.
        </p>
      </div>

      {error && <Message tone="error" text={error} />}
      {success && <Message tone="success" text={success} />}

      {loading ? (
        <p className="text-sm text-brand-primary">Loading imports...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-brand-muted bg-brand-surface p-8 text-center text-sm text-brand-primary">
          No imports found.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const clientName = clientNameById.get(group.client_id) ?? group.client_id
            return (
              <article key={group.key} className="rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                  <div>
                    <h2 className="text-base font-semibold text-white">{clientName}</h2>
                    <p className="mt-1 text-sm text-brand-primary">{periodLabel(group)}</p>
                    <p className="mt-1 text-xs text-brand-primary break-words">
                      {group.source_file_name ?? 'No source filename'} | {group.platform}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MiniStat label="Posts" value={formatNumber(group.post_count)} />
                    <MiniStat label="Reach" value={formatNumber(group.total_reach)} />
                    <MiniStat label="Views" value={formatNumber(group.total_views)} />
                    <MiniStat label="Eng." value={formatNumber(group.total_engagements)} />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <button
                      type="button"
                      onClick={() => setSelectedGroup(group)}
                      className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white"
                    >
                      View details
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(group)}
                      disabled={deletingKey === group.key}
                      className="rounded-lg border border-red-400/30 px-3 py-2 text-sm text-red-300 hover:bg-red-400/10 disabled:opacity-60"
                    >
                      {deletingKey === group.key ? 'Deleting...' : 'Delete import'}
                    </button>
                  </div>
                </div>
                <p className="mt-4 text-xs text-brand-primary">Imported {formatDateTime(group.created_at)}</p>
              </article>
            )
          })}
        </div>
      )}

      {selectedGroup && (
        <div className="mt-6 rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Import details</h2>
              <p className="mt-1 text-sm text-brand-primary">
                {clientNameById.get(selectedGroup.client_id) ?? selectedGroup.client_id} | {periodLabel(selectedGroup)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedGroup(null)}
              className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white"
            >
              Close
            </button>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Import date" value={formatDateTime(selectedGroup.created_at)} />
            <Detail label="Delete mode" value={selectedGroup.can_delete_by_batch ? 'Batch linked' : 'Client + period fallback'} />
            <Detail label="Batch ID" value={selectedGroup.import_batch_id ?? 'Not available'} />
            <Detail label="Source file" value={selectedGroup.source_file_name ?? 'Not available'} />
          </dl>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-muted bg-brand-bg/60 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-brand-primary">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white break-words">{value}</p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-muted bg-brand-bg/60 p-3">
      <dt className="text-xs text-brand-primary">{label}</dt>
      <dd className="mt-1 text-sm text-white break-words">{value}</dd>
    </div>
  )
}

function Message({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  const styles = tone === 'success'
    ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'
  return <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>{text}</p>
}
