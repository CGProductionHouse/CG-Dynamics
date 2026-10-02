// Issue #405 M2B: pure Lead Inbox rules shared by the client portal and staff
// Website Performance. No Supabase import so the rules stay unit-testable.

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'closed_lost'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_QUALITIES = ['good', 'poor'] as const
export type LeadQuality = (typeof LEAD_QUALITIES)[number]

export const POOR_LEAD_REASONS = ['spam', 'wrong_service', 'out_of_area', 'no_budget', 'duplicate', 'unreachable', 'other'] as const
export type PoorLeadReason = (typeof POOR_LEAD_REASONS)[number]

/**
 * The only lead states a client can choose. Good lead = Qualified (which can later be
 * Won or Lost); Poor lead = Closed-Lost/disqualified with a reason. Mirrors the
 * database constraint, so contradictory status/quality pairs cannot be expressed.
 */
export const LEAD_OUTCOMES = ['new', 'contacted', 'good', 'won', 'lost', 'poor'] as const
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number]

export const LEAD_OUTCOME_LABELS: Record<LeadOutcome, string> = {
  new: 'New',
  contacted: 'Contacted',
  good: 'Good lead – Qualified',
  won: 'Won (good lead)',
  lost: 'Lost (good lead, did not go ahead)',
  poor: 'Poor lead – Closed out',
}

const OUTCOME_STATE: Record<LeadOutcome, { status: LeadStatus; quality: LeadQuality | null }> = {
  new: { status: 'new', quality: null },
  contacted: { status: 'contacted', quality: null },
  good: { status: 'qualified', quality: 'good' },
  won: { status: 'won', quality: 'good' },
  lost: { status: 'closed_lost', quality: 'good' },
  poor: { status: 'closed_lost', quality: 'poor' },
}

/** Returns the outcome for a valid status/quality pair, or null when the pair is contradictory. */
export function leadOutcome(status: LeadStatus, quality: LeadQuality | null): LeadOutcome | null {
  return LEAD_OUTCOMES.find((outcome) => OUTCOME_STATE[outcome].status === status && OUTCOME_STATE[outcome].quality === quality) ?? null
}

export function lifecycleForOutcome(outcome: LeadOutcome, poorReason: PoorLeadReason | null = null, poorNote: string | null = null): LeadLifecycleInput {
  const state = OUTCOME_STATE[outcome]
  return outcome === 'poor'
    ? { ...state, poorReason, poorNote }
    : { ...state, poorReason: null, poorNote: null }
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  won: 'Won',
  closed_lost: 'Closed – lost',
}

export const POOR_LEAD_REASON_LABELS: Record<PoorLeadReason, string> = {
  spam: 'Spam or fake',
  wrong_service: 'Wanted a service we do not offer',
  out_of_area: 'Outside our service area',
  no_budget: 'No budget',
  duplicate: 'Duplicate of another lead',
  unreachable: 'Could not reach them',
  other: 'Other (add a note)',
}

export interface LeadField {
  key: string
  label: string
  type: string
  value: string | boolean | null
}

export interface WebsiteLead {
  enquiryId: string
  receiptId: string
  acceptedAt: string
  websiteId: string
  formSchemaKey: string
  formSchemaVersion: number
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  fields: LeadField[]
  attribution: Record<string, string>
  status: LeadStatus
  quality: LeadQuality | null
  poorReason: PoorLeadReason | null
  poorNote: string | null
  lifecycleUpdatedAt: string | null
}

export interface LeadLifecycleInput {
  status: LeadStatus
  quality: LeadQuality | null
  poorReason: PoorLeadReason | null
  poorNote: string | null
}

export interface WebsiteLeadMetrics {
  state: 'available' | 'not_connected'
  period: { from: string; to: string; timezone: string }
  total: number
  new: number
  contacted: number
  qualified: number
  won: number
  closedLost: number
  lost: number
  good: number
  poor: number
  unreviewed: number
  qualificationRate: number | null
}

/** Mirrors the database rules so the form can explain a rejection before saving. */
export function validateLeadLifecycle(input: LeadLifecycleInput): string | null {
  if (!LEAD_STATUSES.includes(input.status)) return 'Choose a lead status.'
  if (input.quality !== null && !LEAD_QUALITIES.includes(input.quality)) return 'Choose Good or Poor.'
  if (!leadOutcome(input.status, input.quality)) {
    return 'Good leads are Qualified, Won or Lost; Poor leads are closed out; New and Contacted leads are not yet reviewed.'
  }
  const note = input.poorNote?.trim() || null
  if (input.quality === 'poor') {
    if (!input.poorReason || !POOR_LEAD_REASONS.includes(input.poorReason)) return 'A poor lead needs a reason.'
    if (input.poorReason === 'other' && !note) return 'Add a short note for “Other”.'
    if (note && note.length > 500) return 'Keep the note under 500 characters.'
  } else if (input.poorReason || note) {
    return 'Poor-lead reasons only apply to poor leads.'
  }
  return null
}

/** Normalises a lifecycle edit to exactly what the RPC accepts. */
export function normaliseLeadLifecycle(input: LeadLifecycleInput): LeadLifecycleInput {
  if (input.quality !== 'poor') return { status: input.status, quality: input.quality, poorReason: null, poorNote: null }
  return { ...input, poorNote: input.poorNote?.trim() || null }
}

/**
 * WhatsApp needs an international number. Numbers already in +/00 international
 * form are used as-is; a 10-digit local number with a leading 0 is treated as
 * South African (+27), matching CG's client base. Anything else gets no link.
 */
export function whatsappNumber(phone: string | null): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? digits : null
  if (digits.startsWith('00')) return digits.length - 2 >= 8 && digits.length - 2 <= 15 ? digits.slice(2) : null
  if (/^0\d{9}$/.test(digits)) return `27${digits.slice(1)}`
  return null
}

export interface LeadContactActions {
  call: string | null
  whatsapp: string | null
  email: string | null
}

/** Direct contact actions built only from the lead's stored contact fields. */
export function leadContactActions(lead: Pick<WebsiteLead, 'contactPhone' | 'contactEmail'>): LeadContactActions {
  const phone = lead.contactPhone?.trim() || null
  const telDigits = phone?.replace(/[^\d+]/g, '') ?? ''
  const wa = whatsappNumber(phone)
  const email = lead.contactEmail?.trim() || null
  return {
    call: telDigits.replace(/\D/g, '').length >= 6 ? `tel:${telDigits}` : null,
    whatsapp: wa ? `https://wa.me/${wa}` : null,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${encodeURIComponent(email).replace('%40', '@')}` : null,
  }
}

export function formatQualificationRate(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return '—'
  return `${Math.round(rate * 1000) / 10}%`
}

/** The M2B migration is not applied when PostgREST cannot find the RPC. */
export function isLeadInboxUnavailableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01') return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('could not find the function') || message.includes('schema cache')
}

const asString = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null

/** Strict row mapping: unknown lifecycle values are rejected rather than guessed. */
export function mapWebsiteLeadRow(row: Record<string, unknown>): WebsiteLead {
  const status = row.status as LeadStatus
  if (!LEAD_STATUSES.includes(status)) throw new Error('Lead status is not recognised.')
  const quality = (row.quality ?? null) as LeadQuality | null
  if (quality !== null && !LEAD_QUALITIES.includes(quality)) throw new Error('Lead quality is not recognised.')
  const poorReason = (row.poor_reason ?? null) as PoorLeadReason | null
  if (poorReason !== null && !POOR_LEAD_REASONS.includes(poorReason)) throw new Error('Poor-lead reason is not recognised.')
  if (!leadOutcome(status, quality)) throw new Error('Lead status and quality are contradictory.')
  const fields = Array.isArray(row.fields) ? row.fields : []
  const attribution = row.attribution && typeof row.attribution === 'object' ? row.attribution as Record<string, unknown> : {}
  return {
    enquiryId: String(row.enquiry_id),
    receiptId: String(row.receipt_id),
    acceptedAt: String(row.accepted_at),
    websiteId: String(row.website_editor_website_id),
    formSchemaKey: String(row.form_schema_key),
    formSchemaVersion: Number(row.form_schema_version),
    contactName: asString(row.contact_name),
    contactEmail: asString(row.contact_email),
    contactPhone: asString(row.contact_phone),
    fields: fields.flatMap((field) => {
      if (!field || typeof field !== 'object') return []
      const item = field as Record<string, unknown>
      const value = typeof item.value === 'string' || typeof item.value === 'boolean' ? item.value : null
      return [{ key: String(item.key), label: String(item.label ?? item.key), type: String(item.type), value }]
    }),
    attribution: Object.fromEntries(Object.entries(attribution).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    status,
    quality,
    poorReason,
    poorNote: asString(row.poor_note),
    lifecycleUpdatedAt: asString(row.lifecycle_updated_at),
  }
}

/**
 * Current reporting month (YYYY-MM) in Africa/Johannesburg, the reporting authority.
 * UTC would select the previous month between 00:00 and 02:00 SAST on the 1st.
 */
export function currentReportingMonth(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit' }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

/** Month window [from, to) used by Website Performance, as ISO dates. */
export function monthWindow(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  const from = `${month}-01`
  const to = new Date(`${from}T00:00:00Z`)
  to.setUTCMonth(to.getUTCMonth() + 1)
  return { from, to: to.toISOString().slice(0, 10) }
}
