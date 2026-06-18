import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLocalDraft } from '../../hooks/useLocalDraft'
import { listClients, type Client } from '../../lib/db/clients'
import { importMetaPosts, type ImportedMetaPostInput } from '../../lib/db/importedMetaPosts'
import {
  MANUAL_SOURCE_LABELS,
  listManualMetricsForClient,
  upsertManualMetrics,
  type ManualPlatformMetric,
  type ManualSourceType,
} from '../../lib/db/manualMetrics'
import { upsertDraftReportForMonth } from '../../lib/db/reports'
import { detectReportPeriod, formatReportPeriod, isMonthComplete, reportMonth } from '../../lib/reportPeriod'
import { PLATFORM_LABELS, formatNumber, shortCaption, type Platform } from '../../lib/reportStats'

interface AutoReportLink {
  month: string
  reportId: string
  clientName: string
  created: boolean
  complete: boolean
}

function monthLongName(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
    .format(new Date(`${month}-01T00:00:00`))
}

// First and last calendar day of a YYYY-MM month, for reports created from a
// manual summary (which carries no per-post dates).
function monthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return { start: `${month}-01`, end: `${month}-01` }
  const year = Number(match[1])
  const monthIndex = Number(match[2])
  const end = new Date(Date.UTC(year, monthIndex, 0)).toISOString().slice(0, 10)
  return { start: `${month}-01`, end }
}

type ImportType = 'meta' | 'manual'

interface ParsedMetaRow {
  rowNumber: number
  metaPostId: string | null
  pageName: string | null
  accountUsername: string | null
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

interface ParsedManualRow {
  rowNumber: number
  clientCsv: string | null
  month: string
  platform: Platform
  sourceType: ManualSourceType
  views: number
  reach: number
  engagements: number
  accountsEngaged: number
  profileVisits: number
  externalLinkTaps: number
  followers: number
  topContentNotes: string | null
  contentTypeSplitNotes: string | null
  generalNotes: string | null
  error: string | null
}

type MetaExportType = 'facebook' | 'instagram'

const MANUAL_TEMPLATE = `client,month,platform,source_type,views,reach,engagements,accounts_engaged,profile_visits,external_link_taps,followers,top_content_notes,content_type_split_notes,general_notes
Red Oak,2026-05,instagram,manual_summary,12000,8000,950,420,210,35,5400,"Top reel: behind the scenes","60% reels, 30% carousels, 10% stories","Strong month, reels drove reach"`

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
      record[header.trim().replace(/^﻿/, '')] = values[index]?.trim() ?? ''
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

function detectMetaExportType(rows: Record<string, string>[]): MetaExportType {
  const firstRow = rows[0] ?? {}
  const normalizedHeaders = new Set(
    Object.keys(firstRow).map(header => header.toLowerCase().replace(/[^a-z0-9]/g, ''))
  )
  const hasInstagramHeaders =
    normalizedHeaders.has('accountusername') &&
    normalizedHeaders.has('likes') &&
    normalizedHeaders.has('saves')
  const hasInstagramPostType = rows.some(row => {
    const postType = getValue(row, ['Post type']).toLowerCase()
    return ['ig image', 'ig carousel', 'ig reel'].includes(postType)
  })

  return hasInstagramHeaders && hasInstagramPostType ? 'instagram' : 'facebook'
}

function normalizeRows(rows: Record<string, string>[], exportType = detectMetaExportType(rows)): ParsedMetaRow[] {
  const normalizedRows = rows.map((row, index) => {
    const likes = numberValue(row, ['Likes'])
    const reactions = exportType === 'instagram'
      ? likes
      : numberValue(row, ['Reactions', 'Likes', 'Lifetime post total reactions'])
    const comments = numberValue(row, ['Comments', 'Lifetime post comments'])
    const shares = numberValue(row, ['Shares', 'Lifetime post shares'])
    const saves = numberValue(row, ['Saves'])
    const explicitEngagements = numberValue(row, [
      'Reactions, Comments and Shares',
      'Engagements',
      'Post engagements',
    ])
    const title = getValue(row, ['Title', 'Post title'])
    const description = getValue(row, ['Description'])
    const clicks = numberValue(row, ['Post clicks', 'Clicks', 'Total clicks', 'Lifetime post clicks'])
    const metaPostId = getValue(row, ['Post ID']) || null
    const pageName = getValue(row, exportType === 'instagram' ? ['Account name'] : ['Page name']) || null
    const accountUsername = getValue(row, ['Account username']) || null
    const caption = exportType === 'instagram' ? description : title

    return {
      rowNumber: index + 1,
      metaPostId,
      pageName,
      accountUsername,
      publishTime: dateValue(row),
      caption: caption || null,
      description: description || null,
      permalink: getValue(row, ['Permalink', 'Post permalink', 'URL', 'Link']) || null,
      postType: getValue(row, ['Post type']) || null,
      reach: numberValue(row, ['Reach', 'Lifetime post reach', 'Post reach']),
      views: numberValue(row, ['Views', 'Post views', 'Lifetime post views']),
      engagements: exportType === 'instagram'
        ? likes + comments + shares + saves
        : explicitEngagements || reactions + comments + shares,
      reactions,
      comments,
      shares,
      clicks,
      videoViews: numberValue(row, ['Video views', '3-second video views']),
      raw: row,
    }
  })

  const byPostId = new Map<string, ParsedMetaRow>()

  normalizedRows.forEach(row => {
    if (!row.metaPostId) return
    if (!byPostId.has(row.metaPostId)) byPostId.set(row.metaPostId, row)
  })

  return [...byPostId.values()]
}

function normalizePlatform(value: string): Platform | null {
  const v = value.toLowerCase().replace(/[^a-z]/g, '')
  if (!v) return null
  if (v.includes('face') || v === 'fb') return 'facebook'
  if (v.includes('insta') || v === 'ig') return 'instagram'
  if (v.includes('tiktok') || v === 'tt') return 'tiktok'
  return null
}

function normalizeSourceType(value: string): ManualSourceType {
  const v = value.toLowerCase().replace(/[^a-z]/g, '')
  if (!v) return 'manual_summary'
  if (v === 'metacsv' || v.includes('metabusiness') || v === 'meta') return 'meta_csv'
  if (v === 'tiktokcsv' || v === 'tiktok') return 'tiktok_csv'
  if (v === 'other') return 'other'
  return 'manual_summary'
}

function normalizeManualRows(rows: Record<string, string>[], selectedPlatform: Platform): ParsedManualRow[] {
  return rows.map((row, index) => {
    const month = getValue(row, ['month']).trim()
    const csvPlatform = getValue(row, ['platform']).trim()
    const resolvedPlatform = csvPlatform ? normalizePlatform(csvPlatform) : selectedPlatform

    let error: string | null = null
    if (!/^\d{4}-\d{2}$/.test(month)) {
      error = `Row ${index + 1}: month must be in YYYY-MM format`
    } else if (csvPlatform && !resolvedPlatform) {
      error = `Row ${index + 1}: unknown platform "${csvPlatform}"`
    }

    return {
      rowNumber: index + 1,
      clientCsv: getValue(row, ['client', 'client name']) || null,
      month,
      platform: resolvedPlatform ?? selectedPlatform,
      sourceType: normalizeSourceType(getValue(row, ['source_type', 'source'])),
      views: numberValue(row, ['views']),
      reach: numberValue(row, ['reach']),
      engagements: numberValue(row, ['engagements', 'interactions']),
      accountsEngaged: numberValue(row, ['accounts_engaged']),
      profileVisits: numberValue(row, ['profile_visits']),
      externalLinkTaps: numberValue(row, ['external_link_taps', 'link taps']),
      followers: numberValue(row, ['followers']),
      topContentNotes: getValue(row, ['top_content_notes']) || null,
      contentTypeSplitNotes: getValue(row, ['content_type_split_notes']) || null,
      generalNotes: getValue(row, ['general_notes']) || null,
      error,
    }
  })
}

interface ImportSettingsDraft {
  importType: ImportType
  clientId: string
  platform: Platform
}

export default function ImportMetaCsv() {
  const { profile } = useAuth()
  const { getInitialDraft: getImportDraft, saveDraft: saveImportDraft, clearDraft: clearImportDraft, hasDraft: hasImportDraft } =
    useLocalDraft<ImportSettingsDraft>(`cg_import_${profile?.id ?? 'anon'}`)

  const [importType, setImportType] = useState<ImportType>('meta')
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [platform, setPlatform] = useState<Platform>('facebook')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedMetaRow[]>([])
  const [manualRows, setManualRows] = useState<ParsedManualRow[]>([])
  const [existingManualMetrics, setExistingManualMetrics] = useState<ManualPlatformMetric[]>([])
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [periodSource, setPeriodSource] = useState<'publish_time' | 'filename' | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [manualSaved, setManualSaved] = useState(false)
  const [settingsRestored, setSettingsRestored] = useState(false)
  const [autoReports, setAutoReports] = useState<AutoReportLink[]>([])
  const [incompleteMonths, setIncompleteMonths] = useState<string[]>([])

  useEffect(() => {
    async function loadClients() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await listClients('active')
        if (error) {
          setError(error.message)
        } else {
          setClients(data)
          const draft = getImportDraft()
          const validClientId =
            draft?.clientId && data.some(c => c.id === draft.clientId)
              ? draft.clientId
              : data[0]?.id ?? ''
          setClientId(validClientId)
          if (draft?.importType) setImportType(draft.importType)
          if (draft?.platform) setPlatform(draft.platform)
          if (draft) setSettingsRestored(true)
        }
      } catch (error) {
        setError(errorMessage(error, 'Could not load clients.'))
      } finally {
        setLoading(false)
      }
    }

    void loadClients()
  }, [])

  useEffect(() => {
    if (!clientId) {
      setExistingManualMetrics([])
      return
    }

    let active = true
    async function loadExistingManualMetrics() {
      const { data } = await listManualMetricsForClient(clientId)
      if (active) setExistingManualMetrics(data)
    }

    void loadExistingManualMetrics()
    return () => {
      active = false
    }
  }, [clientId])

  function resetPreview() {
    setRows([])
    setManualRows([])
    setFileName(null)
    setPeriodStart('')
    setPeriodEnd('')
    setPeriodSource(null)
    setError(null)
    setSuccess(null)
    setManualSaved(false)
    setAutoReports([])
    setIncompleteMonths([])
  }

  function handleImportTypeChange(nextType: ImportType) {
    setImportType(nextType)
    saveImportDraft({ importType: nextType, clientId, platform })
    resetPreview()
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setError(null)
    setSuccess(null)
    setManualSaved(false)
    setAutoReports([])
    setRows([])
    setManualRows([])
    setFileName(file?.name ?? null)
    setPeriodStart('')
    setPeriodEnd('')
    setPeriodSource(null)

    if (!file) return

    try {
      const text = await file.text()
      const csvRows = parseCsv(text)
      if (csvRows.length === 0) {
        setError('No rows were found in this CSV.')
        return
      }

      if (importType === 'manual') {
        const parsed = normalizeManualRows(csvRows, platform)
        setManualRows(parsed)
        return
      }

      const exportType = detectMetaExportType(csvRows)
      const parsed = normalizeRows(csvRows, exportType)
      if (parsed.length === 0) {
        setError('No rows were found in this CSV.')
        return
      }
      setPlatform(exportType)
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

  async function handleSaveMeta() {
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

      clearImportDraft()

      // Group imported posts by calendar month and separate complete from
      // incomplete months. Only complete past months get draft reports.
      const clientName = clients.find(c => c.id === clientId)?.name ?? 'Client'
      const monthSet = new Set<string>()
      rows.forEach(row => {
        if (row.publishTime) monthSet.add(reportMonth(row.publishTime))
      })
      if (monthSet.size === 0 && periodEnd) monthSet.add(reportMonth(periodEnd))

      const allMonths = [...monthSet].sort()
      const completeMths = allMonths.filter(isMonthComplete)
      const incompleteMths = allMonths.filter(m => !isMonthComplete(m))

      const links: AutoReportLink[] = []
      for (const month of completeMths) {
        const { start, end } = monthBounds(month)
        const result = await upsertDraftReportForMonth({
          clientId,
          clientName,
          periodStart: start,
          periodEnd: end,
          month,
          createdBy: profile?.id ?? null,
        })
        if (result.data) {
          links.push({ month, reportId: result.data.id, clientName, created: result.created, complete: true })
        }
      }

      setAutoReports(links)
      setIncompleteMonths(incompleteMths)

      if (completeMths.length > 0 && incompleteMths.length === 0) {
        if (links.length === 1) {
          setSuccess(`${clientName} · ${monthLongName(links[0].month)} report ${links[0].created ? 'created' : 'updated'} successfully.`)
        } else {
          setSuccess(`${clientName} · ${links.length} monthly reports updated successfully.`)
        }
      } else if (completeMths.length > 0 && incompleteMths.length > 0) {
        setSuccess(`${completeMths.map(monthLongName).join(', ')} report${completeMths.length > 1 ? 's' : ''} updated. ${incompleteMths.map(monthLongName).join(', ')} data imported.`)
      } else {
        // All months incomplete (e.g. current month data)
        setSuccess(`${rows.length} posts imported. ${incompleteMths.map(monthLongName).join(', ')} data saved but not available for client view yet.`)
      }
    } catch (error) {
      setError(errorMessage(error, 'Could not save imported posts.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveManual() {
    const firstError = manualRows.find(row => row.error)
    if (firstError?.error) {
      setError(firstError.error)
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      // Selected client is the source of truth. De-duplicate within the file
      // by month + platform so a single upsert never hits the same key twice.
      const byKey = new Map<string, ParsedManualRow>()
      manualRows.forEach(row => byKey.set(`${row.month}:${row.platform}`, row))

      const payload = [...byKey.values()].map(row => ({
        client_id: clientId,
        month: row.month,
        platform: row.platform,
        source_type: row.sourceType,
        views: row.views,
        reach: row.reach,
        engagements: row.engagements,
        accounts_engaged: row.accountsEngaged,
        profile_visits: row.profileVisits,
        external_link_taps: row.externalLinkTaps,
        followers: row.followers,
        top_content_notes: row.topContentNotes,
        content_type_split_notes: row.contentTypeSplitNotes,
        general_notes: row.generalNotes,
        created_by: profile?.id ?? null,
      }))

      const { error } = await upsertManualMetrics(payload)
      if (error) {
        setError(error.message)
        return
      }

      setManualSaved(true)
      clearImportDraft()

      // Auto-create draft reports for complete past months only. Incomplete
      // months (current or future) still save their manual metrics but are
      // flagged so the admin knows they are not yet client-viewable.
      const clientName = clients.find(c => c.id === clientId)?.name ?? 'Client'
      const allMonths = [...new Set(payload.map(row => row.month))].sort()
      const completeMths = allMonths.filter(isMonthComplete)
      const incompleteMths = allMonths.filter(m => !isMonthComplete(m))

      const links: AutoReportLink[] = []
      for (const month of completeMths) {
        const { start, end } = monthBounds(month)
        const result = await upsertDraftReportForMonth({
          clientId,
          clientName,
          periodStart: start,
          periodEnd: end,
          month,
          createdBy: profile?.id ?? null,
        })
        if (result.data) {
          links.push({ month, reportId: result.data.id, clientName, created: result.created, complete: true })
        }
      }

      setAutoReports(links)
      setIncompleteMonths(incompleteMths)

      if (completeMths.length === 1 && incompleteMths.length === 0) {
        setSuccess(`${clientName} · ${monthLongName(links[0].month)} report ${links[0].created ? 'created' : 'updated'} successfully.`)
      } else if (completeMths.length > 1 && incompleteMths.length === 0) {
        setSuccess(`${clientName} · ${links.length} monthly reports updated successfully.`)
      } else if (completeMths.length > 0 && incompleteMths.length > 0) {
        setSuccess(`${completeMths.map(monthLongName).join(', ')} report${completeMths.length > 1 ? 's' : ''} updated. ${incompleteMths.map(monthLongName).join(', ')} data saved.`)
      } else {
        setSuccess(`Saved ${payload.length} manual summary ${payload.length === 1 ? 'entry' : 'entries'} to Manual metrics.`)
      }
    } catch (error) {
      setError(errorMessage(error, 'Could not save manual summary metrics.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (saving) return
    if (!clientId) {
      setError('Select a client before saving.')
      return
    }
    if (importType === 'manual') {
      if (manualRows.length === 0) {
        setError('Upload and preview a manual summary CSV before saving.')
        return
      }
      await handleSaveManual()
      return
    }
    if (rows.length === 0) {
      setError('Upload and preview a CSV before saving.')
      return
    }
    await handleSaveMeta()
  }

  function handleDownloadTemplate() {
    const blob = new Blob([MANUAL_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'manual-summary-template.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const selectedClientName = clients.find(client => client.id === clientId)?.name ?? null
  const clientMismatch =
    importType === 'manual' &&
    selectedClientName !== null &&
    manualRows.some(row => row.clientCsv && row.clientCsv.toLowerCase() !== selectedClientName.toLowerCase())

  const metaTotals = rows.reduce(
    (sum, row) => ({
      reach: sum.reach + row.reach,
      views: sum.views + row.views,
      engagements: sum.engagements + row.engagements,
    }),
    { reach: 0, views: 0, engagements: 0 }
  )
  const manualTotals = manualRows.reduce(
    (sum, row) => ({
      reach: sum.reach + row.reach,
      views: sum.views + row.views,
      engagements: sum.engagements + row.engagements,
    }),
    { reach: 0, views: 0, engagements: 0 }
  )
  const totals = importType === 'manual' ? manualTotals : metaTotals
  const activeCount = importType === 'manual' ? manualRows.length : rows.length
  const manualPreviewTotals = manualRows.reduce(
    (sum, row) => ({
      accountsEngaged: sum.accountsEngaged + row.accountsEngaged,
      profileVisits: sum.profileVisits + row.profileVisits,
      externalLinkTaps: sum.externalLinkTaps + row.externalLinkTaps,
      followers: sum.followers + row.followers,
    }),
    { accountsEngaged: 0, profileVisits: 0, externalLinkTaps: 0, followers: 0 }
  )
  const existingManualKeys = new Set(
    existingManualMetrics.map(metric => `${metric.month}:${metric.platform}`)
  )
  const manualRowsUpdatingExisting = importType === 'manual'
    ? manualRows.filter(row => existingManualKeys.has(`${row.month}:${row.platform}`))
    : []

  const manualWarnings: string[] = []
  if (importType === 'manual' && manualRows.length > 0) {
    const sum = (pick: (row: ParsedManualRow) => number) => manualRows.reduce((acc, row) => acc + pick(row), 0)
    const totalEngagements = sum(row => row.engagements)
    const totalAccountsEngaged = sum(row => row.accountsEngaged)
    const totalProfileVisits = sum(row => row.profileVisits)
    const totalExternalLinkTaps = sum(row => row.externalLinkTaps)
    if (totalEngagements === 0) {
      manualWarnings.push('Engagements are 0. If this is not intentional, make sure the Instagram Interactions screenshot was included before creating the CSV.')
    }
    if (totalAccountsEngaged === 0) {
      manualWarnings.push('Accounts engaged is 0. This usually means the Instagram Interactions screen was not included.')
    }
    if (totalProfileVisits === 0 && totalExternalLinkTaps === 0) {
      manualWarnings.push('Profile activity data is missing or not visible.')
    }
    if (manualRows.some(row => row.platform === 'tiktok' && row.reach === 0)) {
      manualWarnings.push('TikTok reach is 0. Confirm this is the exported value before saving.')
    }
  }

  const hasPeriod = Boolean(periodStart && periodEnd)
  const detectedPeriodText = hasPeriod
    ? formatReportPeriod({ start: periodStart, end: periodEnd })
    : null

  return (
    <div className="w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Import</p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Import performance CSV</h1>
        <p className="text-sm text-brand-primary mt-2 max-w-2xl">
          Upload Meta Business Suite post exports, or a manual summary CSV (e.g. Instagram
          screenshots turned into a clean CSV), then save them for report building.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="bg-brand-surface border border-brand-muted rounded-xl p-4 sm:p-5">
          <div className="space-y-4">
            {settingsRestored && !fileName && (
              <div className="flex items-start gap-2 rounded-lg border border-sky-300/30 bg-sky-300/10 px-3 py-2.5">
                <p className="text-xs leading-relaxed text-sky-200">
                  Your import settings were restored. Please reselect the CSV file to continue.
                </p>
                <button
                  type="button"
                  onClick={() => setSettingsRestored(false)}
                  className="mt-0.5 shrink-0 text-xs text-sky-200/60 hover:text-sky-200 transition"
                >
                  ✕
                </button>
              </div>
            )}

            {hasImportDraft && !settingsRestored && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-brand-primary">Import settings saved on this device.</p>
                <button
                  type="button"
                  onClick={clearImportDraft}
                  className="text-xs text-brand-accent hover:brightness-110 transition"
                >
                  Clear
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1.5">Import type</label>
              <select
                value={importType}
                onChange={event => handleImportTypeChange(event.target.value as ImportType)}
                className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                <option value="meta">Meta Business Suite CSV</option>
                <option value="manual">Manual summary CSV</option>
              </select>
              <p className="mt-2 text-xs leading-relaxed text-brand-primary">
                {importType === 'meta'
                  ? 'Meta Business Suite CSV = post-level Facebook or Instagram export with one row per post.'
                  : 'Manual summary CSV = monthly platform totals captured from an exported dashboard or prepared summary sheet.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1.5">Client</label>
              <select
                value={clientId}
                onChange={event => {
                  const next = event.target.value
                  setClientId(next)
                  saveImportDraft({ importType, clientId: next, platform })
                }}
                disabled={loading}
                className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1.5">
                Platform{importType === 'manual' ? ' (default if CSV has no platform column)' : ''}
              </label>
              <select
                value={platform}
                onChange={event => {
                  const next = event.target.value as Platform
                  setPlatform(next)
                  saveImportDraft({ importType, clientId, platform: next })
                }}
                className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>

            {importType === 'manual' && (
              <div className="rounded-lg border border-brand-muted bg-brand-bg/60 p-3">
                <p className="text-sm font-medium text-white">Manual summary CSV format</p>
                <p className="mt-1 text-xs text-brand-primary">
                  Columns: client, month (YYYY-MM), platform, source_type, views, reach, engagements,
                  accounts_engaged, profile_visits, external_link_taps, followers, top_content_notes,
                  content_type_split_notes, general_notes. One or many rows.
                </p>
                <p className="mt-2 text-xs text-amber-300">
                  month must match the report month you want this to appear in. For a May 2026 report
                  use <span className="font-semibold">2026-05</span>. If an Instagram screenshot says
                  "Last 30 days", still choose the reporting month, not today's date.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="mt-3 rounded-lg border border-brand-muted px-3 py-2 text-xs text-brand-primary hover:text-white hover:border-white/30"
                >
                  Download manual summary CSV template
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-brand-accent mb-1.5">
                {importType === 'manual' ? 'Manual summary CSV file' : 'Meta CSV file'}
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-brand-primary file:mb-2 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-accent file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-brand-bg hover:file:brightness-110 sm:file:mb-0"
              />
            </div>

            {importType === 'meta' && rows.length > 0 && (
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

            {clientMismatch && (
              <p className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                Some rows have a different client column than the selected client. The selected
                client, {selectedClientName}, is the one that will receive this import.
              </p>
            )}

            {manualRowsUpdatingExisting.length > 0 && (
              <p className="text-xs text-brand-accent bg-brand-accent/10 border border-brand-accent/20 rounded-lg px-3 py-2">
                Existing summary will be updated for{' '}
                {manualRowsUpdatingExisting
                  .map(row => `${PLATFORM_LABELS[row.platform]} ${row.month}`)
                  .join(', ')}.
              </p>
            )}

            {manualWarnings.length > 0 && (
              <ul className="space-y-2">
                {manualWarnings.map(warning => (
                  <li
                    key={warning}
                    className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2"
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {success && (
              <div className="rounded-lg border border-brand-accent/20 bg-brand-accent/10 px-3 py-2">
                <p className="text-sm text-brand-accent">{success}</p>
                {autoReports.length > 1 && (
                  <p className="mt-1 text-xs text-brand-primary">
                    {autoReports.length} monthly reports were created or updated.
                  </p>
                )}
                {incompleteMonths.length > 0 && (
                  <p className="mt-1 text-xs text-amber-300">
                    {incompleteMonths.map(monthLongName).join(', ')} {incompleteMonths.length === 1 ? 'is' : 'are'} incomplete — not available for client view yet.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-3">
                  {autoReports.length > 0 ? (
                    <>
                      <Link
                        to={`/admin/reports/${autoReports[0].reportId}/edit`}
                        className="text-sm font-semibold text-brand-accent underline hover:brightness-110"
                      >
                        View report
                      </Link>
                      <Link
                        to={`/admin/reports/${autoReports[0].reportId}/edit`}
                        className="text-sm font-semibold text-brand-accent underline hover:brightness-110"
                      >
                        Edit strategy
                      </Link>
                      {autoReports[0].complete && (
                        <Link
                          to={`/admin/published?reportId=${autoReports[0].reportId}`}
                          className="text-sm font-semibold text-brand-accent underline hover:brightness-110"
                        >
                          View as client
                        </Link>
                      )}
                    </>
                  ) : (
                    <Link
                      to="/admin/reports/new"
                      className="text-sm font-semibold text-brand-accent underline hover:brightness-110"
                    >
                      Create report
                    </Link>
                  )}
                  {manualSaved && (
                    <Link
                      to="/admin/manual-metrics"
                      className="text-sm font-semibold text-brand-accent underline hover:brightness-110"
                    >
                      View in Manual metrics
                    </Link>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || activeCount === 0 || !clientId}
              className="w-full bg-brand-accent text-brand-bg font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving
                ? 'Saving...'
                : importType === 'manual'
                  ? 'Save manual summary metrics'
                  : 'Save imported posts'}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Rows" value={formatNumber(activeCount)} />
          <MetricCard label="Reach" value={formatNumber(totals.reach)} />
          <MetricCard label="Views" value={formatNumber(totals.views)} />
          <MetricCard label="Engagements" value={formatNumber(totals.engagements)} />
        </section>
      </div>

      {importType === 'manual' && manualRows.length > 0 && (
        <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Accounts engaged" value={formatNumber(manualPreviewTotals.accountsEngaged)} />
          <MetricCard label="Profile visits" value={formatNumber(manualPreviewTotals.profileVisits)} />
          <MetricCard label="External link taps" value={formatNumber(manualPreviewTotals.externalLinkTaps)} />
          <MetricCard label="Followers" value={formatNumber(manualPreviewTotals.followers)} />
        </section>
      )}

      <section className="mt-6 bg-brand-surface border border-brand-muted rounded-xl overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-brand-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">CSV preview</h2>
            <p className="mt-1 break-words text-xs text-brand-primary">
              {fileName
                ? fileName
                : importType === 'manual'
                  ? 'Upload a manual summary CSV to preview the rows.'
                  : 'Upload a CSV to preview normalized post data.'}
            </p>
          </div>
          <span className="text-xs text-brand-primary">{formatNumber(totals.views)} views</span>
        </div>

        {importType === 'manual' ? (
          <ManualPreview rows={manualRows} />
        ) : (
          <MetaPreview rows={rows} />
        )}
      </section>
    </div>
  )
}

function MetaPreview({ rows }: { rows: ParsedMetaRow[] }) {
  return (
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
  )
}

function notePreview(text: string | null) {
  if (!text) return '-'
  return text.length > 40 ? `${text.slice(0, 40)}...` : text
}

function ManualPreview({ rows }: { rows: ParsedManualRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-sm">
        <thead>
          <tr className="text-left border-b border-brand-muted">
            <th className="px-4 py-3 text-brand-primary font-medium">Month</th>
            <th className="px-4 py-3 text-brand-primary font-medium">Platform</th>
            <th className="px-4 py-3 text-brand-primary font-medium">Source</th>
            <th className="px-4 py-3 text-brand-primary font-medium">Reach</th>
            <th className="px-4 py-3 text-brand-primary font-medium">Views</th>
            <th className="px-4 py-3 text-brand-primary font-medium">Engagements</th>
            <th className="px-4 py-3 text-brand-primary font-medium">Accounts engaged</th>
            <th className="px-4 py-3 text-brand-primary font-medium">Profile visits</th>
            <th className="px-4 py-3 text-brand-primary font-medium">External link taps</th>
            <th className="px-4 py-3 text-brand-primary font-medium">Followers</th>
            <th className="px-4 py-3 text-brand-primary font-medium">Top content</th>
            <th className="px-4 py-3 text-brand-primary font-medium">Content split</th>
            <th className="px-4 py-3 text-brand-primary font-medium">General notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={13} className="px-4 py-10 text-center text-brand-primary">
                No CSV rows loaded yet.
              </td>
            </tr>
          ) : (
            rows.map(row => (
              <tr key={row.rowNumber} className="border-b border-brand-muted/70 last:border-0">
                <td className="px-4 py-3 text-white">
                  {row.month || '-'}
                  {row.error && <p className="text-xs text-red-400 mt-1">{row.error}</p>}
                </td>
                <td className="px-4 py-3 text-brand-primary">{PLATFORM_LABELS[row.platform]}</td>
                <td className="px-4 py-3 text-brand-primary">{MANUAL_SOURCE_LABELS[row.sourceType]}</td>
                <td className="px-4 py-3 text-brand-primary">{formatNumber(row.reach)}</td>
                <td className="px-4 py-3 text-brand-primary">{formatNumber(row.views)}</td>
                <td className="px-4 py-3 text-brand-accent">{formatNumber(row.engagements)}</td>
                <td className="px-4 py-3 text-brand-primary">{formatNumber(row.accountsEngaged)}</td>
                <td className="px-4 py-3 text-brand-primary">{formatNumber(row.profileVisits)}</td>
                <td className="px-4 py-3 text-brand-primary">{formatNumber(row.externalLinkTaps)}</td>
                <td className="px-4 py-3 text-brand-primary">{formatNumber(row.followers)}</td>
                <td className="px-4 py-3 text-brand-primary">{notePreview(row.topContentNotes)}</td>
                <td className="px-4 py-3 text-brand-primary">{notePreview(row.contentTypeSplitNotes)}</td>
                <td className="px-4 py-3 text-brand-primary">{notePreview(row.generalNotes)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
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
