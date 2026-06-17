import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLocalDraft } from '../../hooks/useLocalDraft'
import { listClients, type Client } from '../../lib/db/clients'
import { PLATFORMS, PLATFORM_LABELS, formatNumber, type Platform } from '../../lib/reportStats'
import {
  MANUAL_SOURCE_LABELS,
  deleteManualMetric,
  listManualMetrics,
  saveManualMetric,
  type ManualPlatformMetric,
  type ManualSourceType,
} from '../../lib/db/manualMetrics'

const SOURCE_TYPES: ManualSourceType[] = ['meta_csv', 'manual_summary', 'tiktok_csv', 'other']

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7)
}

function monthLabel(month: string) {
  const parsed = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return month
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(parsed)
}

interface FormState {
  clientId: string
  month: string
  platform: Platform
  sourceType: ManualSourceType
  views: string
  reach: string
  engagements: string
  accountsEngaged: string
  profileVisits: string
  externalLinkTaps: string
  followers: string
  topContentNotes: string
  contentTypeSplitNotes: string
  generalNotes: string
}

function emptyForm(clientId: string): FormState {
  return {
    clientId,
    month: currentMonthValue(),
    platform: 'instagram',
    sourceType: 'manual_summary',
    views: '',
    reach: '',
    engagements: '',
    accountsEngaged: '',
    profileVisits: '',
    externalLinkTaps: '',
    followers: '',
    topContentNotes: '',
    contentTypeSplitNotes: '',
    generalNotes: '',
  }
}

function formFromMetric(metric: ManualPlatformMetric): FormState {
  return {
    clientId: metric.client_id,
    month: metric.month,
    platform: metric.platform,
    sourceType: metric.source_type,
    views: String(metric.views),
    reach: String(metric.reach),
    engagements: String(metric.engagements),
    accountsEngaged: String(metric.accounts_engaged),
    profileVisits: String(metric.profile_visits),
    externalLinkTaps: String(metric.external_link_taps),
    followers: String(metric.followers),
    topContentNotes: metric.top_content_notes ?? '',
    contentTypeSplitNotes: metric.content_type_split_notes ?? '',
    generalNotes: metric.general_notes ?? '',
  }
}

function toInt(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function ManualMetricsAdmin() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { getInitialDraft: getMetricsDraft, saveDraft: saveMetricsDraft, clearDraft: clearMetricsDraft, hasDraft: hasMetricsDraft } =
    useLocalDraft<FormState>(`cg_manual_${profile?.id ?? 'anon'}`)

  const [clients, setClients] = useState<Client[]>([])
  const [metrics, setMetrics] = useState<ManualPlatformMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm(''))
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const clientNameById = useMemo(
    () => new Map(clients.map(client => [client.id, client.name])),
    [clients]
  )

  async function load(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoading(true)
    setError(null)
    try {
      const [clientsRes, metricsRes] = await Promise.all([listClients(), listManualMetrics()])
      const loadError = clientsRes.error ?? metricsRes.error
      if (loadError) {
        setError(loadError.message)
        return
      }
      setClients(clientsRes.data)
      setMetrics(metricsRes.data)
      setForm(current => {
        if (current.clientId) return current
        const draft = getMetricsDraft()
        if (draft?.clientId && clientsRes.data.some(c => c.id === draft.clientId)) return draft
        return emptyForm(clientsRes.data[0]?.id ?? '')
      })
    } catch (error) {
      setError(errorMessage(error, 'Could not load manual metrics.'))
    } finally {
      if (!options.silent) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateForm(key: keyof FormState, value: string) {
    const next = { ...form, [key]: value }
    setForm(next)
    if (!editingId) saveMetricsDraft(next)
  }

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm(clients[0]?.id ?? ''))
    setSuccess(null)
    setError(null)
  }

  function startEdit(metric: ManualPlatformMetric) {
    setEditingId(metric.id)
    setForm(formFromMetric(metric))
    setSuccess(null)
    setError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving || !isAdmin) return
    if (!form.clientId) {
      setError('Select a client.')
      return
    }
    if (!form.month) {
      setError('Select a month.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await saveManualMetric({
        id: editingId ?? undefined,
        client_id: form.clientId,
        month: form.month,
        platform: form.platform,
        source_type: form.sourceType,
        views: toInt(form.views),
        reach: toInt(form.reach),
        engagements: toInt(form.engagements),
        accounts_engaged: toInt(form.accountsEngaged),
        profile_visits: toInt(form.profileVisits),
        external_link_taps: toInt(form.externalLinkTaps),
        followers: toInt(form.followers),
        top_content_notes: form.topContentNotes.trim() || null,
        content_type_split_notes: form.contentTypeSplitNotes.trim() || null,
        general_notes: form.generalNotes.trim() || null,
        created_by: profile?.id ?? null,
      })
      if (error) {
        const isDuplicate = error.message.toLowerCase().includes('duplicate')
        setError(
          isDuplicate
            ? 'Manual metrics already exist for this client, month and platform. Edit the existing entry instead.'
            : error.message
        )
        return
      }
      setSuccess(editingId ? 'Manual metrics updated.' : 'Manual metrics saved.')
      if (!editingId) clearMetricsDraft()
      setEditingId(null)
      setForm(emptyForm(form.clientId))
      await load({ silent: true })
    } catch (error) {
      setError(errorMessage(error, 'Could not save manual metrics.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(metric: ManualPlatformMetric) {
    const confirmed = window.confirm(
      `Delete ${PLATFORM_LABELS[metric.platform]} manual metrics for ${clientNameById.get(metric.client_id) ?? metric.client_id} (${monthLabel(metric.month)})?`
    )
    if (!confirmed) return

    setBusyId(metric.id)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await deleteManualMetric(metric.id)
      if (error) {
        setError(error.message)
        return
      }
      setSuccess('Manual metrics deleted.')
      if (editingId === metric.id) startCreate()
      await load({ silent: true })
    } catch (error) {
      setError(errorMessage(error, 'Could not delete manual metrics.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Manual metrics</h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-primary">
            Enter aggregate platform numbers by hand when a reliable CSV export is not available
            (e.g. Instagram not connected to Meta Business Suite, or varying TikTok exports). These
            feed into the client's master monthly report alongside CSV imports.
          </p>
        </div>
        {isAdmin && editingId && (
          <button
            type="button"
            onClick={startCreate}
            className="rounded-lg border border-brand-muted px-4 py-2.5 text-sm text-brand-primary hover:text-white"
          >
            New entry
          </button>
        )}
      </div>

      {error && <Message tone="error" text={error} />}
      {success && <Message tone="success" text={success} />}

      {isAdmin && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">
            {editingId ? 'Edit manual metrics' : 'Add manual metrics'}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Client">
              <select
                value={form.clientId}
                onChange={event => updateForm('clientId', event.target.value)}
                disabled={loading}
                className={selectClass}
              >
                {clients.length === 0 && <option value="">No clients</option>}
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Month">
              <input
                type="month"
                value={form.month}
                onChange={event => updateForm('month', event.target.value)}
                className={selectClass}
              />
            </Field>
            <Field label="Platform">
              <select
                value={form.platform}
                onChange={event => updateForm('platform', event.target.value as Platform)}
                className={selectClass}
              >
                {PLATFORMS.map(platform => (
                  <option key={platform} value={platform}>{PLATFORM_LABELS[platform]}</option>
                ))}
              </select>
            </Field>
            <Field label="Source type">
              <select
                value={form.sourceType}
                onChange={event => updateForm('sourceType', event.target.value as ManualSourceType)}
                className={selectClass}
              >
                {SOURCE_TYPES.map(type => (
                  <option key={type} value={type}>{MANUAL_SOURCE_LABELS[type]}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="Views" value={form.views} onChange={value => updateForm('views', value)} />
            <NumberField label="Reach" value={form.reach} onChange={value => updateForm('reach', value)} />
            <NumberField label="Engagements / interactions" value={form.engagements} onChange={value => updateForm('engagements', value)} />
            <NumberField label="Accounts engaged" value={form.accountsEngaged} onChange={value => updateForm('accountsEngaged', value)} />
            <NumberField label="Profile visits" value={form.profileVisits} onChange={value => updateForm('profileVisits', value)} />
            <NumberField label="External link taps" value={form.externalLinkTaps} onChange={value => updateForm('externalLinkTaps', value)} />
            <NumberField label="Followers" value={form.followers} onChange={value => updateForm('followers', value)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <TextAreaField label="Top content notes" value={form.topContentNotes} onChange={value => updateForm('topContentNotes', value)} />
            <TextAreaField label="Content type split notes" value={form.contentTypeSplitNotes} onChange={value => updateForm('contentTypeSplitNotes', value)} />
            <TextAreaField label="General notes" value={form.generalNotes} onChange={value => updateForm('generalNotes', value)} />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-bg hover:brightness-110 transition disabled:opacity-60 sm:w-auto"
            >
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Save manual metrics'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={startCreate}
                disabled={saving}
                className="rounded-lg border border-brand-muted px-4 py-2.5 text-sm text-brand-primary hover:text-white"
              >
                Cancel edit
              </button>
            )}
            {!editingId && hasMetricsDraft && (
              <div className="flex items-center gap-3 sm:ml-auto">
                <p className="text-xs text-brand-primary">Draft saved on this device.</p>
                <button
                  type="button"
                  onClick={() => {
                    clearMetricsDraft()
                    setForm(emptyForm(clients[0]?.id ?? ''))
                  }}
                  disabled={saving}
                  className="text-xs text-brand-accent hover:brightness-110 transition disabled:opacity-60"
                >
                  Clear draft
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-brand-primary">Loading manual metrics...</p>
      ) : metrics.length === 0 ? (
        <div className="rounded-xl border border-brand-muted bg-brand-surface p-8 text-center text-sm text-brand-primary">
          No manual metrics yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-muted bg-brand-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-muted text-left">
                <th className="px-4 py-3 font-medium text-brand-primary">Client</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Month</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Platform</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Source</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Reach</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Views</th>
                <th className="px-4 py-3 font-medium text-brand-primary">Eng.</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {metrics.map(metric => (
                <tr key={metric.id} className="border-b border-brand-muted last:border-0">
                  <td className="px-4 py-3 text-white">{clientNameById.get(metric.client_id) ?? metric.client_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-brand-primary">{monthLabel(metric.month)}</td>
                  <td className="px-4 py-3 text-brand-primary">{PLATFORM_LABELS[metric.platform]}</td>
                  <td className="px-4 py-3 text-brand-primary">{MANUAL_SOURCE_LABELS[metric.source_type]}</td>
                  <td className="px-4 py-3 text-brand-primary">{formatNumber(metric.reach)}</td>
                  <td className="px-4 py-3 text-brand-primary">{formatNumber(metric.views)}</td>
                  <td className="px-4 py-3 text-brand-primary">{formatNumber(metric.engagements)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEdit(metric)}
                          className="text-xs text-brand-primary hover:text-brand-accent"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(metric)}
                          disabled={busyId === metric.id}
                          className="text-xs text-red-300 hover:text-red-200 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const selectClass =
  'w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-accent mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="0"
        className={selectClass}
      />
    </Field>
  )
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={4}
        className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
      />
    </Field>
  )
}

function Message({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  const styles = tone === 'success'
    ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'
  return <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>{text}</p>
}
