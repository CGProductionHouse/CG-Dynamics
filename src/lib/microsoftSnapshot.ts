import type {
  MicrosoftImportSourceRecord,
  MicrosoftOutlookEventSource,
  MicrosoftPlannerTaskSource,
} from './microsoftImport'

// Normalized audit/transport contract shared by the in-app Graph fetcher and
// connected agents. It carries mapped source data and completeness, never tokens.

export const MICROSOFT_SNAPSHOT_FORMAT = 'cg-dynamics-microsoft-snapshot'
export const MICROSOFT_SNAPSHOT_VERSION = 2
export const MICROSOFT_SNAPSHOT_MAX_RECORDS = 5000

export interface MicrosoftSnapshotSource {
  sourceType: 'outlook_calendar' | 'planner_plan'
  sourceId: string
  sourceName: string
  complete: boolean
  rangeStart: string | null
  rangeEnd: string | null
  recordCount: number
  safeError: string | null
}

export interface MicrosoftSnapshot {
  format: typeof MICROSOFT_SNAPSHOT_FORMAT
  version: 1 | typeof MICROSOFT_SNAPSHOT_VERSION
  /** ISO timestamp of the Graph export — becomes microsoft_last_synced_at. */
  exportedAt: string
  /** Human note on who/what produced the export. Never a credential. */
  exportedBy: string
  triggerType: 'admin' | 'agent'
  sources: MicrosoftSnapshotSource[]
  records: MicrosoftImportSourceRecord[]
}

export interface MicrosoftSnapshotParseResult {
  snapshot: MicrosoftSnapshot | null
  /** Structural problems. A non-empty list means the file was rejected. */
  errors: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string')
}

function outlookRecordError(row: Record<string, unknown>): string | null {
  const record = row as Partial<MicrosoftOutlookEventSource>
  if (typeof record.sourceCalendarId !== 'string') return 'sourceCalendarId must be a string'
  if (typeof record.sourceEventId !== 'string') return 'sourceEventId must be a string'
  if (typeof record.title !== 'string') return 'title must be a string'
  if (!optionalString(record.safeSummary)) return 'safeSummary must be a string or null'
  if (typeof record.startDate !== 'string') return 'startDate must be a string'
  if (!optionalString(record.endDate)) return 'endDate must be a string or null'
  if (typeof record.allDay !== 'boolean') return 'allDay must be a boolean'
  if (!optionalString(record.location)) return 'location must be a string or null'
  if (typeof record.cancelled !== 'boolean') return 'cancelled must be a boolean'
  if (!stringArray(record.assigneeMicrosoftIds)) return 'assigneeMicrosoftIds must be a string array'
  if (record.sourceModifiedAt !== undefined && !optionalString(record.sourceModifiedAt)) return 'sourceModifiedAt must be a string or null'
  if (record.sourceModifiedAt && Number.isNaN(Date.parse(record.sourceModifiedAt))) return 'sourceModifiedAt must be an ISO timestamp'
  if (record.private !== undefined && typeof record.private !== 'boolean') return 'private must be a boolean'
  return null
}

function plannerRecordError(row: Record<string, unknown>): string | null {
  const record = row as Partial<MicrosoftPlannerTaskSource>
  if (typeof record.sourcePlanId !== 'string') return 'sourcePlanId must be a string'
  if (typeof record.sourcePlanName !== 'string') return 'sourcePlanName must be a string'
  if (typeof record.sourceBucketId !== 'string') return 'sourceBucketId must be a string'
  if (typeof record.sourceBucketName !== 'string') return 'sourceBucketName must be a string'
  if (typeof record.sourceTaskId !== 'string') return 'sourceTaskId must be a string'
  if (typeof record.title !== 'string') return 'title must be a string'
  if (!optionalString(record.description)) return 'description must be a string or null'
  if (!optionalString(record.startDate)) return 'startDate must be a string or null'
  if (!optionalString(record.dueDate)) return 'dueDate must be a string or null'
  if (!stringArray(record.assigneeMicrosoftIds)) return 'assigneeMicrosoftIds must be a string array'
  if (record.percentComplete !== null && typeof record.percentComplete !== 'number') {
    return 'percentComplete must be a number or null'
  }
  if (typeof record.percentComplete === 'number' && (record.percentComplete < 0 || record.percentComplete > 100)) return 'percentComplete must be between 0 and 100'
  if (record.sourceModifiedAt !== undefined && !optionalString(record.sourceModifiedAt)) return 'sourceModifiedAt must be a string or null'
  if (record.sourceModifiedAt && Number.isNaN(Date.parse(record.sourceModifiedAt))) return 'sourceModifiedAt must be an ISO timestamp'
  return null
}

function sourceError(value: unknown): string | null {
  if (!isRecord(value)) return 'must be an object'
  if (value.sourceType !== 'outlook_calendar' && value.sourceType !== 'planner_plan') return 'sourceType is invalid'
  if (typeof value.sourceId !== 'string' || !value.sourceId.trim()) return 'sourceId is required'
  if (typeof value.sourceName !== 'string' || !value.sourceName.trim()) return 'sourceName is required'
  if (typeof value.complete !== 'boolean') return 'complete must be a boolean'
  if (!optionalString(value.rangeStart) || !optionalString(value.rangeEnd)) return 'range values must be strings or null'
  if (!Number.isInteger(value.recordCount) || (value.recordCount as number) < 0) return 'recordCount must be a non-negative integer'
  if (!optionalString(value.safeError)) return 'safeError must be a string or null'
  if (value.complete === true && value.safeError !== null) return 'a complete source cannot include safeError'
  if (value.sourceType === 'outlook_calendar') {
    if (typeof value.rangeStart !== 'string' || typeof value.rangeEnd !== 'string') return 'complete Outlook scope requires rangeStart and rangeEnd'
    const start = Date.parse(value.rangeStart)
    const end = Date.parse(value.rangeEnd)
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 'Outlook range is invalid'
    if (end - start > 370 * 24 * 60 * 60 * 1000) return 'Outlook range cannot exceed 370 days'
  } else if (value.rangeStart !== null || value.rangeEnd !== null) return 'Planner sources cannot declare calendar ranges'
  return null
}

function incompleteV1Sources(records: MicrosoftImportSourceRecord[]): MicrosoftSnapshotSource[] {
  const sources = new Map<string, MicrosoftSnapshotSource>()
  for (const record of records) {
    const sourceType = record.sourceType === 'outlook_event' ? 'outlook_calendar' : 'planner_plan'
    const sourceId = record.sourceType === 'outlook_event' ? record.sourceCalendarId : record.sourcePlanId
    const sourceName = record.sourceType === 'outlook_event' ? 'Outlook Calendar' : record.sourcePlanName
    const key = `${sourceType}:${sourceId}`
    const current = sources.get(key)
    if (current) current.recordCount += 1
    else sources.set(key, { sourceType, sourceId, sourceName, complete: false, rangeStart: null, rangeEnd: null, recordCount: 1, safeError: 'Legacy version 1 snapshot has no completeness proof.' })
  }
  return [...sources.values()]
}

// Strict structural validation. Content-level problems (blank IDs, bad dates,
// unknown plans, unmatched clients) are deliberately NOT rejected here — the
// preview layer classifies those as conflicts so the admin can see them.
export function parseMicrosoftSnapshot(rawText: string): MicrosoftSnapshotParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { snapshot: null, errors: ['The file is not valid JSON.'] }
  }
  if (!isRecord(parsed)) return { snapshot: null, errors: ['The snapshot must be a JSON object.'] }
  if (parsed.format !== MICROSOFT_SNAPSHOT_FORMAT) {
    return { snapshot: null, errors: [`"format" must be "${MICROSOFT_SNAPSHOT_FORMAT}".`] }
  }
  if (parsed.version !== 1 && parsed.version !== MICROSOFT_SNAPSHOT_VERSION) {
    return { snapshot: null, errors: [`"version" must be 1 or ${MICROSOFT_SNAPSHOT_VERSION}.`] }
  }
  if (typeof parsed.exportedAt !== 'string' || Number.isNaN(Date.parse(parsed.exportedAt))) {
    return { snapshot: null, errors: ['"exportedAt" must be a valid ISO timestamp.'] }
  }
  if (typeof parsed.exportedBy !== 'string' || !parsed.exportedBy.trim()) {
    return { snapshot: null, errors: ['"exportedBy" must describe who produced the export.'] }
  }
  if (!Array.isArray(parsed.records)) {
    return { snapshot: null, errors: ['"records" must be an array.'] }
  }
  if (parsed.records.length > MICROSOFT_SNAPSHOT_MAX_RECORDS) {
    return { snapshot: null, errors: [`Snapshots are capped at ${MICROSOFT_SNAPSHOT_MAX_RECORDS} records. Split the export.`] }
  }

  const errors: string[] = []
  const sources: MicrosoftSnapshotSource[] = []
  if (parsed.version === MICROSOFT_SNAPSHOT_VERSION) {
    if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
      return { snapshot: null, errors: ['Version 2 snapshots require a non-empty "sources" array.'] }
    }
    parsed.sources.forEach((source, index) => {
      const problem = sourceError(source)
      if (problem) errors.push(`Source ${index + 1}: ${problem}.`)
      else sources.push(source as unknown as MicrosoftSnapshotSource)
    })
    const sourceKeys = sources.map(source => `${source.sourceType}:${source.sourceId}`)
    if (new Set(sourceKeys).size !== sourceKeys.length) errors.push('The sources array contains a duplicate source declaration.')
  }

  const records: MicrosoftImportSourceRecord[] = []
  parsed.records.forEach((row, index) => {
    if (!isRecord(row)) {
      errors.push(`Record ${index + 1}: must be an object.`)
      return
    }
    if (row.sourceType === 'outlook_event') {
      const problem = outlookRecordError(row)
      if (problem) errors.push(`Record ${index + 1} (outlook_event): ${problem}.`)
      else records.push(row as unknown as MicrosoftOutlookEventSource)
      return
    }
    if (row.sourceType === 'planner_task') {
      const problem = plannerRecordError(row)
      if (problem) errors.push(`Record ${index + 1} (planner_task): ${problem}.`)
      else records.push(row as unknown as MicrosoftPlannerTaskSource)
      return
    }
    errors.push(`Record ${index + 1}: sourceType must be "outlook_event" or "planner_task".`)
  })

  if (parsed.version === MICROSOFT_SNAPSHOT_VERSION) {
    for (const source of sources) {
      const count = records.filter(record => source.sourceType === 'outlook_calendar'
        ? record.sourceType === 'outlook_event' && record.sourceCalendarId === source.sourceId
        : record.sourceType === 'planner_task' && record.sourcePlanId === source.sourceId).length
      if (count !== source.recordCount) errors.push(`Source "${source.sourceName}" declares ${source.recordCount} records but contains ${count}.`)
    }
    for (const record of records) {
      const declared = sources.some(source => source.sourceType === (record.sourceType === 'outlook_event' ? 'outlook_calendar' : 'planner_plan')
        && source.sourceId === (record.sourceType === 'outlook_event' ? record.sourceCalendarId : record.sourcePlanId))
      if (!declared) errors.push(`Record source "${record.sourceType === 'outlook_event' ? record.sourceCalendarId : record.sourcePlanId}" is not declared in sources.`)
    }
  }

  if (errors.length > 0) return { snapshot: null, errors }
  return {
    snapshot: {
      format: MICROSOFT_SNAPSHOT_FORMAT,
      version: parsed.version as 1 | typeof MICROSOFT_SNAPSHOT_VERSION,
      exportedAt: parsed.exportedAt,
      exportedBy: parsed.exportedBy,
      triggerType: parsed.triggerType === 'agent' ? 'agent' : 'admin',
      sources: parsed.version === 1 ? incompleteV1Sources(records) : sources,
      records,
    },
    errors: [],
  }
}
