import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { listClients, type Client } from '../../lib/db/clients'
import { importMetaPosts, type ImportedMetaPostInput } from '../../lib/db/importedMetaPosts'
import { detectReportPeriod, formatReportPeriod } from '../../lib/reportPeriod'
import { formatNumber, shortCaption } from '../../lib/reportStats'

type Platform = 'facebook' | 'instagram' | 'tiktok'

interface ParsedMetaRow {
  rowNumber: number
  metaPostId: string | null
  publishTime: string | null
  caption: string | null
  description: string | null
  permalink: string | null
  postType: string | null
  reach: number
  views: number
  engagements: number
  reactions: number
  comments: number
  shares: number
  clicks: number
  videoViews: number
  raw: Record<string, string>
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"' && next === '"') {
      current += '"'
      i += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim())
      current = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(current.trim())
      if (row.some(cell => cell.length > 0)) rows.push(row)
      row = []
      current = ''
    } else {
      current += char
    }
  }

  row.push(current.trim())
  if (row.some(cell => cell.length > 0)) rows.push(row)

  const [headers, ...body] = rows
  if (!headers) return []

  return body.map(values => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header.trim().replace(/^\uFEFF/, '')] = values[index]?.trim() ?? ''
    })
    return record
  })
}

function getValue(row: Record<string, string>, aliases: string[]) {
  const normalized = Object.entries(row).map(([key, value]) => ({
    key: key.toLowerCase().replace(/[^a-z0-9]/g, ''),
    value,
  }))

  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '')
    const match = normalized.find(item => item.key === normalizedAlias)
    if (match?.value) return match.value
  }

  return ''
}

function numberValue(row: Record<string, string>, aliases: string[]) {
  const value = getValue(row, aliases)
  const cleaned = value.replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

function dateValue(row: Record<string, string>) {
  const value = getValue(row, [
    'Publish time',
    'Published time',
    'Post publish date',
  ])
  if (!value) return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeRows(rows: Record<string, string>[]): ParsedMetaRow[] {
  const normalizedRows = rows.map((row, index) => {
    const reactions = numberValue(row, ['Reactions', 'Likes', 'Lifetime post total reactions'])
    const comments = numberValue(row, ['Comments', 'Lifetime post comments'])
    const shares = numberValue(row, ['Shares', 'Lifetime post shares'])
    const title = getValue(row, ['Title', 'Post title'])
    const description = getValue(row, ['Description'])
    const clicks = numberValue(row, ['Post clicks', 'Clicks', 'Total clicks', 'Lifetime post clicks'])

    return {
      rowNumber: index + 1,
      metaPostId: getValue(row, ['Post ID', 'Meta post ID', 'Facebook post ID', 'Permalink ID']) || null,
      publishTime: dateValue(row),
      caption: title || description || null,
      description: description || null,
      permalink: getValue(row, ['Permalink', 'Post permalink', 'URL', 'Link']) || null,
      postType: getValue(row, ['Post type', 'Type', 'Media type']) || null,
      reach: numberValue(row, ['Reach', 'Lifetime post reach', 'Post reach']),
      views: numberValue(row, ['Views', 'Post views', 'Lifetime post views']),
      engagements: reactions + comments + shares,
      reactions,
      comments,
      shares,
      clicks,
      videoViews: numberValue(row, ['Video views', '3-second video views']),
      raw: row,
    }
  })

  const byPostId = new Map<string, ParsedMetaRow>()
  const withoutPostId: ParsedMetaRow[] = []

  normalizedRows.forEach(row => {
    if (!row.metaPostId) {
      withoutPostId.push(row)
      return
    }
    if (!byPostId.has(row.metaPostId)) byPostId.set(row.metaPostId, row)
  })

  return [...byPostId.values(), ...withoutPostId]
}

export default function ImportMetaCsv() {
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [platform, setPlatform] = useState<Platform>('facebook')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedMetaRow[]>([])
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [periodSource, setPeriodSource] = useState<'publish_time' | 'filename' | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function loadClients() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await listClients()
        if (error) {
          setError(error.message)
        } else {
          setClients(data)
          setClientId(data[0]?.id ?? '')
        }
      } catch (error) {
        setError(errorMessage(error, 'Could not load clients.'))
      } finally {
        setLoading(false)
      }
    }

    void loadClients()
  }, [])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setError(null)
    setSuccess(null)
    setRows([])
    setFileName(file?.name ?? null)
    setPeriodStart('')
    setPeriodEnd('')
    setPeriodSource(null)

    if (!file) return

    try {
      const text = await file.text()
      const parsed = normalizeRows(parseCsv(text))
      if (parsed.length === 0) {
        setError('No rows were found in this CSV.')
        return
      }
      const detectedPeriod = detectReportPeriod(
        parsed.map(row => row.publishTime),
        file.name
      )
      setRows(parsed)
      if (detectedPeriod) {
        setPeriodStart(detectedPeriod.start)
        setPeriodEnd(detectedPeriod.end)
        setPeriodSource(detectedPeriod.source)
      }
    } catch (error) {
      setError(errorMessage(error, 'Could not parse this CSV file.'))
    }
  }

  async function handleSave() {
    if (saving) return
    if (!clientId) {
      setError('Select a client before saving.')
      return
    }
    if (rows.length === 0) {
      setError('Upload and preview a CSV before saving.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const batchId = crypto.randomUUID()
      const payload: ImportedMetaPostInput[] = rows.map(row => ({
        client_id: clientId,
        source: 'meta_business_suite',
        platform,
        import_batch_id: batchId,
        source_file_name: fileName,
        row_number: row.rowNumber,
        meta_post_id: row.metaPostId,
        publish_time: row.publishTime,
        caption: row.caption,
        permalink: row.permalink,
        post_type: row.postType,
        reach: row.reach,
        impressions: row.views,
        engagements: row.engagements,
        reactions: row.reactions,
        comments: row.comments,
        shares: row.shares,
        clicks: row.clicks,
        video_views: row.videoViews,
        raw: row.raw,
      }))

      const { error } = await importMetaPosts(payload)
      if (error) {
        setError(error.message)
        return
      }

      setSuccess(`Saved ${rows.length} imported posts. You can now build a report from this data.`)
    } catch (error) {
      setError(errorMessage(error, 'Could not save imported posts.'))
    } finally {
      setSaving(false)
    }
  }

  const totals = rows.reduce(
    (sum, row) => ({
      reach: sum.reach + row.reach,
      views: sum.views + row.views,
      engagements: sum.engagements + row.engagements,
    }),
    { reach: 0, views: 0, engagements: 0 }
  )
  const hasPeriod = Boolean(periodStart && periodEnd)
  const detectedPeriodText = hasPeriod
    ? formatReportPeriod({ start: periodStart, end: periodEnd })
    : null

  return (
    <div className="w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Meta import</p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Import performance CSV</h1>
        <p className="text-sm text-brand-primary mt-2 max-w-2xl">
          Upload Meta Business Suite exports, preview the normalized metrics, then save them for report building.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 sm:p-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1.5">Client</label>
              <select
                value={clientId}
                onChange={event => setClientId(event.target.value)}
                disabled={loading}
                className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1.5">Platform</label>
              <select
                value={platform}
                onChange={event => setPlatform(event.target.value as Platform)}
                className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1.5">Meta CSV file</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-brand-primary file:mb-2 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-accent file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-brand-bg hover:file:brightness-110 sm:file:mb-0"
              />
            </div>

            {rows.length > 0 && (
              <div className="rounded-lg border border-brand-muted bg-brand-bg/60 p-3">
                <p className="text-sm font-medium text-white">
                  Detected period: {detectedPeriodText ?? 'No valid period found'}
                </p>
                {periodSource && (
                  <p className="mt-1 text-xs text-brand-primary">
                    Source: {periodSource === 'publish_time' ? 'Publish time' : 'CSV filename'}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="block text-xs text-brand-primary mb-1">Start</span>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={event => setPeriodStart(event.target.value)}
                      className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-brand-primary mb-1">End</span>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={event => setPeriodEnd(event.target.value)}
                      className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    />
                  </label>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {success && (
              <p className="text-sm text-brand-accent bg-brand-accent/10 border border-brand-accent/20 rounded-lg px-3 py-2">
                {success}
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || rows.length === 0 || !clientId}
              className="w-full bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving import...' : 'Save imported posts'}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Rows" value={formatNumber(rows.length)} />
          <MetricCard label="Reach" value={formatNumber(totals.reach)} />
          <MetricCard label="Views" value={formatNumber(totals.views)} />
          <MetricCard label="Engagements" value={formatNumber(totals.engagements)} />
        </section>
      </div>

      <section className="mt-6 bg-brand-surface border border-brand-muted rounded-xl overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-brand-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">CSV preview</h2>
            <p className="mt-1 break-words text-xs text-brand-primary">
              {fileName ? fileName : 'Upload a CSV to preview normalized post data.'}
            </p>
          </div>
          <span className="text-xs text-brand-primary">{formatNumber(totals.views)} views</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left border-b border-brand-muted">
                <th className="px-4 py-3 text-brand-primary font-medium">Post</th>
                <th className="px-4 py-3 text-brand-primary font-medium">Reach</th>
                <th className="px-4 py-3 text-brand-primary font-medium">Views</th>
                <th className="px-4 py-3 text-brand-primary font-medium">Engagements</th>
                <th className="px-4 py-3 text-brand-primary font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-brand-primary">
                    No CSV rows loaded yet.
                  </td>
                </tr>
              ) : (
                rows.slice(0, 25).map(row => (
                  <tr key={row.rowNumber} className="border-b border-brand-muted/70 last:border-0">
                    <td className="px-4 py-3 text-white min-w-80">
                      <p className="font-medium">{shortCaption(row.caption, `Row ${row.rowNumber}`)}</p>
                      <p className="text-xs text-brand-primary mt-1">{row.publishTime ?? 'No date found'}</p>
                    </td>
                    <td className="px-4 py-3 text-brand-primary">{formatNumber(row.reach)}</td>
                    <td className="px-4 py-3 text-brand-primary">{formatNumber(row.views)}</td>
                    <td className="px-4 py-3 text-brand-accent">{formatNumber(row.engagements)}</td>
                    <td className="px-4 py-3 text-brand-primary">{row.postType ?? 'Post'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-surface border border-brand-muted rounded-xl p-4 sm:p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-brand-primary sm:tracking-[0.18em]">{label}</p>
      <p className="text-2xl font-semibold text-white mt-3 break-words">{value}</p>
    </div>
  )
}
