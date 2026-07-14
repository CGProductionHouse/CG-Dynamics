import type {
  MicrosoftImportSourceRecord,
  MicrosoftOutlookEventSource,
  MicrosoftPlannerTaskSource,
} from './microsoftImport'

// ── Microsoft 365 snapshot file (Option A: operator-assisted migration) ──────
//
// The deployed app never talks to Microsoft Graph. An operator with delegated
// organisational access (the coding-agent Microsoft connector, or Graph
// Explorer) exports a normalized JSON snapshot; an admin uploads it here and
// the preview/apply pipeline runs entirely in the browser against Supabase.
// The snapshot carries only titles, dates, IDs and notes — never tokens.

export const MICROSOFT_SNAPSHOT_FORMAT = 'cg-dynamics-microsoft-snapshot'
export const MICROSOFT_SNAPSHOT_VERSION = 1
export const MICROSOFT_SNAPSHOT_MAX_RECORDS = 5000

export interface MicrosoftSnapshot {
  format: typeof MICROSOFT_SNAPSHOT_FORMAT
  version: typeof MICROSOFT_SNAPSHOT_VERSION
  /** ISO timestamp of the Graph export — becomes microsoft_last_synced_at. */
  exportedAt: string
  /** Human note on who/what produced the export. Never a credential. */
  exportedBy: string
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
  return null
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
  if (parsed.version !== MICROSOFT_SNAPSHOT_VERSION) {
    return { snapshot: null, errors: [`"version" must be ${MICROSOFT_SNAPSHOT_VERSION}.`] }
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

  if (errors.length > 0) return { snapshot: null, errors }
  return {
    snapshot: {
      format: MICROSOFT_SNAPSHOT_FORMAT,
      version: MICROSOFT_SNAPSHOT_VERSION,
      exportedAt: parsed.exportedAt,
      exportedBy: parsed.exportedBy,
      records,
    },
    errors: [],
  }
}
