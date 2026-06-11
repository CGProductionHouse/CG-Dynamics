import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { listClients, type Client } from '../../lib/db/clients'
import { importMetaPosts, type ImportedMetaPostInput } from '../../lib/db/importedMetaPosts'
import { formatNumber, shortCaption } from '../../lib/reportStats'

type Platform = 'facebook' | 'instagram' | 'tiktok'

interface ParsedMetaRow {
  rowNumber: number
  metaPostId: string | null
  publishTime: string | null
  caption: string | null
  permalink: string | null
  postType: string | null
  reach: number
  impressions: number
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
      record[header.trim()] = values[index]?.trim() ?? ''
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
    'Created time',
    'Date',
    'Post publish date',
    'Post creation date',
  ])
  if (!value) return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeRows(rows: Record<string, string>[]): ParsedMetaRow[] {
  return rows.map((row, index) => {
    const reactions = numberValue(row, ['Reactions', 'Likes', 'Lifetime post total reactions'])
    const comments = numberValue(row, ['Comments', 'Lifetime post comments'])
    const shares = numberValue(row, ['Shares', 'Lifetime post shares'])
    const clicks = numberValue(row, ['Post clicks', 'Clicks', 'Total clicks', 'Lifetime post clicks'])
    const importedEngagements = numberValue(row, [
      'Engagements',
      'Post engagements',
      'Lifetime engaged users',
      'Lifetime post engaged users',
    ])

    return {
      rowNumber: index + 1,
      metaPostId: getValue(row, ['Post ID', 'Meta post ID', 'Facebook post ID', 'Permalink ID']) || null,
      publishTime: dateValue(row),
      caption: getValue(row, ['Caption', 'Post message', 'Description', 'Post text', 'Message']) || null,
      permalink: getValue(row, ['Permalink', 'Post permalink', 'URL', 'Link']) || null,
      postType: getValue(row, ['Post type', 'Type', 'Media type']) || null,
      reach: numberValue(row, ['Reach', 'Lifetime post reach', 'Post reach']),
      impressions: numberValue(row, ['Impressions', 'Lifetime post impressions', 'Views', 'Post views']),
      engagements: importedEngagements || reactions + comments + shares + clicks,
      reactions,
      comments,
      shares,
      clicks,
      videoViews: numberValue(row, ['Video views', '3-second video views', 'Views']),
      raw: row,
    }
  })
}

export default function ImportMetaCsv() {
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [platform, setPlatform] = useState<Platform>('facebook')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedMetaRow[]>([])
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

    if (!file) return

    try {
      const text = await file.text()
      const parsed = normalizeRows(parseCsv(text))
      if (parsed.length === 0) {
        setError('No rows were found in this CSV.')
        return
      }
      setRows(parsed)
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
        impressions: row.impressions,
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
      impressions: sum.impressions + row.impressions,
      engagements: sum.engagements + row.engagements,
    }),
    { reach: 0, impressions: 0, engagements: 0 }
  )

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Meta import</p>
        <h1 className="text-2xl font-semibold text-white">Import performance CSV</h1>
        <p className="text-sm text-brand-primary mt-2 max-w-2xl">
          Upload Meta Business Suite exports, preview the normalized metrics, then save them for report building.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="bg-brand-surface border border-brand-muted rounded-xl p-5">
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
                className="block w-full text-sm text-brand-primary file:mr-4 file:rounded-lg file:border-0 file:bg-brand-accent file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-brand-bg hover:file:brightness-110"
              />
            </div>

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

        <section className="grid grid-cols-3 gap-3">
          <MetricCard label="Rows" value={formatNumber(rows.length)} />
          <MetricCard label="Reach" value={formatNumber(totals.reach)} />
          <MetricCard label="Engagements" value={formatNumber(totals.engagements)} />
        </section>
      </div>

      <section className="mt-6 bg-brand-surface border border-brand-muted rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-muted flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">CSV preview</h2>
            <p className="text-xs text-brand-primary mt-1">
              {fileName ? fileName : 'Upload a CSV to preview normalized post data.'}
            </p>
          </div>
          <span className="text-xs text-brand-primary">{formatNumber(totals.impressions)} impressions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-brand-muted">
                <th className="px-4 py-3 text-brand-primary font-medium">Post</th>
                <th className="px-4 py-3 text-brand-primary font-medium">Reach</th>
                <th className="px-4 py-3 text-brand-primary font-medium">Impressions</th>
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
                    <td className="px-4 py-3 text-brand-primary">{formatNumber(row.impressions)}</td>
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
    <div className="bg-brand-surface border border-brand-muted rounded-xl p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-brand-primary">{label}</p>
      <p className="text-2xl font-semibold text-white mt-3">{value}</p>
    </div>
  )
}
