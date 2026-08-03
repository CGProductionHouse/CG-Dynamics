// ─────────────────────────────────────────────────────────────────────────────
// CG Assistant — deterministic action parser.
//
// Turns a natural-language instruction (English, Afrikaans, or mixed) into a
// structured ActionProposal that the UI shows for confirm/edit/cancel BEFORE any
// write. It is pure and side-effect free: it never mutates anything and never
// resolves a name it isn't sure about — ambiguity returns a clarification.
//
// The apply step (elsewhere) always runs through existing RLS-protected paths
// and the admin-approved schedule-change RPC, and is audited. This module only
// understands the request and proposes a preview.
// ─────────────────────────────────────────────────────────────────────────────

export type AssistantActionType =
  | 'calendar.create'
  | 'calendar.cancel'
  | 'task.create'
  | 'task.assign'
  | 'task.update'
  | 'schedule.propose'
  | 'video.move'
  | 'video.mark_shot'
  | 'job.enqueue'
  | 'memory.add'
  | 'microsoft.sync'
  | 'marketing.start'
  | 'marketing.continue'
  | 'marketing.list'
  | 'marketing.decide'

export interface ActionClient {
  id: string
  name: string
}

export interface ActionContext {
  today: string // YYYY-MM-DD (caller's local date)
  clients: ActionClient[]
  staffNames: string[]
  role: string // 'admin' | 'manager' | 'team' | ...
  currentClientId?: string | null
  currentClientName?: string | null
  currentTaskId?: string | null
  currentTaskName?: string | null
}

export interface ActionTarget {
  type: 'planner_task' | 'content_run'
  id: string
  label: string
}

export interface ActionProposal {
  type: AssistantActionType
  title: string // short human summary for the preview header
  // Structured, editable fields shown in the preview. Values are display-ready.
  fields: Record<string, string | number | null>
  clientId: string | null
  clientName: string | null
  target?: ActionTarget
  // Set when the signed-in role may not directly perform this — e.g. a schedule
  // change becomes a pending proposal needing admin approval.
  requiresApproval?: boolean
  approvalNote?: string
}

export interface Clarification {
  clarify: string
}

export type ParseResult = ActionProposal | Clarification | null

// ── Language dictionaries (EN + AF) ──────────────────────────────────────────

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, sondag: 0,
  monday: 1, mon: 1, maandag: 1,
  tuesday: 2, tue: 2, tues: 2, dinsdag: 2,
  wednesday: 3, wed: 3, woensdag: 3,
  thursday: 4, thu: 4, thurs: 4, donderdag: 4,
  friday: 5, fri: 5, vrydag: 5,
  saturday: 6, sat: 6, saterdag: 6,
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, een: 1, '1': 1,
  two: 2, twee: 2, '2': 2,
  three: 3, drie: 3, '3': 3,
  four: 4, vier: 4, '4': 4,
  five: 5, vyf: 5, '5': 5,
  six: 6, ses: 6, '6': 6,
  seven: 7, sewe: 7, '7': 7,
  eight: 8, agt: 8, '8': 8,
  nine: 9, nege: 9, '9': 9,
  ten: 10, tien: 10, '10': 10,
}

const CREATE_MEETING = /\b(add|create|schedule|book|set ?up|new|skep|maak|voeg|boek|skeduleer|reël|reel)\b/
const MEETING_NOUN = /\b(meeting|vergadering|event|afspraak|call|oproep)\b/
const CANCEL = /\b(cancel|kanselleer|delete|remove|verwyder|skrap)\b/
const ASSIGN = /\b(assign|toewys|wys .* toe|gee (?:die|hierdie)?\s*taak|gee vir)\b/
const TASK_NOUN = /\b(task|taak|to-?do|item)\b/
const MOVE = /\b(move|skuif|shift|verskuif|reschedule|herskeduleer)\b/
const THIS_TASK = /\b(this|hierdie|die)\s+(task|taak|item)\b/
const COMPLETE = /\b(complete|completed|done|klaar|voltooi|finish|afgehandel)\b/
const BLOCKED = /\b(block|blocked|geblokkeer|vasgevang|stuck|wag(?:tend)?)\b/
const VIDEO_NOUN = /\b(video|videos|clip)\b/
const MARK_SHOT = /\b(mark|merk)\b.*\b(shot|geskiet|geneem|filmed|opgeneem)\b/

// ── Date helpers (pure) ──────────────────────────────────────────────────────

function toISO(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseBaseDate(today: string): Date {
  const [y, m, d] = today.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

// Resolves a relative date phrase to an ISO date, or null if none present.
export function resolveRelativeDate(text: string, today: string): string | null {
  const base = parseBaseDate(today)
  const lower = text.toLowerCase()

  if (/\b(today|vandag)\b/.test(lower)) return toISO(base)
  if (/\b(tomorrow|more|môre)\b/.test(lower)) {
    const d = new Date(base); d.setUTCDate(d.getUTCDate() + 1); return toISO(d)
  }

  // Explicit ISO date.
  const iso = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]

  // Weekday, optionally prefixed by "next"/"volgende".
  for (const [word, dow] of Object.entries(WEEKDAYS)) {
    const re = new RegExp(`\\b(next |volgende )?${word}\\b`)
    const match = lower.match(re)
    if (match) {
      const wantNext = Boolean(match[1])
      const d = new Date(base)
      let delta = (dow - d.getUTCDay() + 7) % 7
      if (delta === 0) delta = 7 // never "today" for a named weekday
      if (wantNext && delta <= 7) {
        // "next <weekday>": the occurrence in the following week if this week's
        // is within a few days; keep it simple and add a week when it lands in
        // the current week.
        if (delta < 7) delta += 0 // the (dow - today + 7) already skips to next occurrence
      }
      d.setUTCDate(d.getUTCDate() + delta)
      return toISO(d)
    }
  }

  return null
}

// First day of next month (used for "next month").
export function firstOfNextMonth(today: string): string {
  const base = parseBaseDate(today)
  return toISO(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1)))
}

// "at 10", "om 10", "10:00", "10am" → "HH:MM" or null.
export function resolveTime(text: string): string | null {
  const lower = text.toLowerCase()
  const hhmm = lower.match(/\b(\d{1,2}):(\d{2})\b/)
  if (hhmm) return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`
  const at = lower.match(/\b(?:at|om)\s+(\d{1,2})\s*(am|pm)?\b/)
  if (at) {
    let h = Number(at[1])
    if (at[2] === 'pm' && h < 12) h += 12
    if (at[2] === 'am' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:00`
  }
  return null
}

// ── Name resolution ──────────────────────────────────────────────────────────

function findClient(text: string, clients: ActionClient[]): { matches: ActionClient[] } {
  const hay = ` ${text.toLowerCase()} `
  const matches = clients.filter(client => {
    const name = client.name.trim().toLowerCase()
    if (!name) return false
    if (hay.includes(` ${name} `)) return true
    return name.split(/[^a-z0-9]+/).filter(t => t.length >= 4).some(t => new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(hay))
  })
  return { matches }
}

function findStaff(text: string, staffNames: string[]): { matches: string[] } {
  const hay = ` ${text.toLowerCase()} `
  const matches = staffNames.filter(name => {
    const n = name.trim().toLowerCase()
    if (!n) return false
    // Match on first name or full name as a whole word.
    return n.split(/\s+/).concat([n]).some(part => part.length >= 2 && hay.includes(` ${part} `))
  })
  return { matches: [...new Set(matches)] }
}

function collectNumbers(text: string): number[] {
  const lower = text.toLowerCase()
  const found: number[] = []
  for (const token of lower.split(/[^a-z0-9]+/)) {
    if (token in NUMBER_WORDS) found.push(NUMBER_WORDS[token])
  }
  return [...new Set(found)]
}

// ── Meta Business sync intent ────────────────────────────────────────────────
// Lexical detector (EN + AF + mixed) for the meta_sync background job. Picks up
// natural phrasing that is not the tight "meta sync" / "sync meta" adjacency:
//   "sync all connected meta clients", "sync all Meta clients",
//   "refresh Meta data", "update all client Meta reports", "sync connected clients"
// plus Afrikaans/mixed equivalents. The brand word may even be absent when the
// sentence is explicitly "sync connected clients". This never guesses — it is a
// deterministic keyword match, and the result is a confirmable preview.
function isMetaSyncIntent(lower: string): boolean {
  // Explicit adjacency forms stay the fastest, most precise match.
  if (/\b(meta[\s-]?(?:sync|sinkronisering)|(?:sync|sinkroniseer)[\s-]?meta)\b/.test(lower)) return true

  // Sync/refresh/update verb + Meta brand + a sync-ish context word.
  const verb = /\b(?:sync(?:hroniz?e|hronise)?|sinkroniseer|synchroniseer|refresh|verfris|update|opdateer|run|voer uit)\b/.test(lower)
  const brand = /\b(?:meta|facebook|instagram)\b/.test(lower)
  const context = /\b(?:client|clients|kliënt|kliënte|connected|gekoppeld|report|reports|verslag|verslae|data|sinkronisering)\b/.test(lower)
  if (verb && brand && context) return true

  // Meta-less form: "sync connected clients" / "sinkroniseer gekoppelde kliënte".
  return /\b(?:sync|sinkroniseer|synchroniseer)\b/.test(lower) &&
    /\b(?:connected|gekoppeld)\b/.test(lower) &&
    /\b(?:client|clients|kliënt|kliënte)\b/.test(lower)
}

// ── Microsoft 365 sync intent ────────────────────────────────────────────────
// Lexical detector (EN + AF + mixed) for the controlled Microsoft transition
// sync (Planner + Outlook → reviewed reconciliation preview). Deterministic
// keyword matching only — the assistant never guesses whether Microsoft is
// connected; the confirmed action reads the live integration status first.
//   "run a microsoft sync", "sync microsoft", "sync planner", "pull outlook",
//   "sinkroniseer microsoft", "trek planner in", "microsoft 365 sync"
function isMicrosoftSyncIntent(lower: string): boolean {
  const brand = /\b(?:microsoft|microsoft\s?365|ms\s?365|office\s?365|planner|outlook|teams)\b/.test(lower)
  if (!brand) return false

  // Explicit adjacency forms.
  if (/\b(?:microsoft|planner|outlook|teams)[\s-]?(?:sync|sinkronisering)\b/.test(lower)) return true
  if (/\b(?:sync|sinkroniseer)[\s-]?(?:microsoft|planner|outlook|teams)\b/.test(lower)) return true

  // Verb + brand + sync-ish context.
  const verb = /\b(?:sync(?:hroniz?e|hronise)?|sinkroniseer|synchroniseer|refresh|verfris|update|opdateer|run|voer uit|pull|import|invoer|trek|reconcile|rekonsilieer)\b/.test(lower)
  const context = /\b(?:sync|sinkronisering|task|tasks|taak|take|plan|plans|schedule|skedule|calendar|kalender|data|preview|voorskou|reconciliation|rekonsiliasie|change|changes)\b/.test(lower)
  return verb && context
}

// Default bounded Outlook/Planner window: start of this month through the end
// of the fifth month ahead (a 6-month operating window). Always shown in the
// confirmation step so the admin can narrow or widen it before anything runs.
export function defaultMicrosoftSyncRange(today: string): { start: string; end: string } {
  const base = new Date(`${today}T12:00:00Z`)
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1))
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 6, 0))
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

// ── Marketing AI department intents ─────────────────────────────────────────
// Deterministic EN/AF/mixed detection for the Marketing AI specialist chain
// (Marketing Strategist -> Copywriting Agent -> Brand Guardian -> approval).
// Everything here only classifies the request and resolves the client; the
// controlled workflow, its evidence gate and its approval rules are untouched.

const MARKETING_NOUN = /\b(campaign|kampanje|strategy|strategie|marketing|copy|kopie|advert|advertensie|social copy|caption|onderskrif|ad copy|brand review|handelsmerk)\b/
const MARKETING_MAKE = /\b(create|build|make|draft|write|skryf|skep|bou|maak|ontwerp|plan|beplan|start|begin)\b/

/** "continue the marketing workflow" / "gaan voort met die bemarkingswerkvloei" */
function isMarketingContinue(lower: string): boolean {
  const cont = /\b(continue|carry on|next step|hand ?off|gaan voort|voortgaan|volgende stap|hervat)\b/.test(lower)
  const scope = /\b(marketing|bemarking|campaign|kampanje|workflow|werkvloei|artifact|draft|konsep|specialist|spesialis)\b/.test(lower)
  return cont && scope
}

/** "show me drafts awaiting approval" / "wys konsepte wat goedkeuring wag" */
function isMarketingList(lower: string): boolean {
  const show = /\b(show|list|what|which|wys|lys|watter)\b/.test(lower)
  const drafts = /\b(draft|drafts|konsep|konsepte|artifact|artifacts|version|versions|weergawe)\b/.test(lower)
  const pending = /\b(await|awaiting|pending|review|approval|goedkeuring|hersiening|wag)\b/.test(lower)
  return show && drafts && pending
}

/** approve / reject / request changes on the latest version. */
function marketingDecision(lower: string): 'approved' | 'rejected' | 'changes_requested' | null {
  // A decision names a DRAFT or VERSION. Requiring that keeps phrases like
  // "review this copy against the approved knowledge" — which merely contains
  // the word "approved" — from being read as an approval.
  const scope = /\b(draft|drafts|konsep|konsepte|version|versions|weergawe|artifact)\b/.test(lower)
  if (!scope) return null
  if (/\b(request changes|changes requested|vra veranderinge|verander|amend|revise|hersien)\b/.test(lower)) return 'changes_requested'
  if (/\b(reject|afkeur|verwerp|decline)\b/.test(lower)) return 'rejected'
  // Afrikaans splits "keur ... goed" around the object, so match both parts.
  if (/\b(approve|approved|goedkeur|sign ?off)\b/.test(lower)) return 'approved'
  if (/\bkeur\b/.test(lower) && /\bgoed\b/.test(lower)) return 'approved'
  return null
}

/** Which specialist a phrasing asks for, or null to route automatically. */
function marketingSpecialist(lower: string): string | null {
  if (/\b(brand review|review (?:this |the )?copy|on-?brand|brand guardian|handelsmerk|tone of voice)\b/.test(lower)) return 'brand_guardian'
  if (/\b(social copy|sosiale kopie|caption|onderskrif|ad copy|advertensiekopie|copywrit|write copy|skryf kopie|kopieskrywer|headline|opskrif)\b/.test(lower)) return 'copywriting_agent'
  // Bare "kopie"/"copy" with a writing verb also means copywriting.
  if (/\b(skryf|write|draft)\b/.test(lower) && /\b(kopie|copy)\b/.test(lower)) return 'copywriting_agent'
  if (/\b(strategy|strategie|strateeg|strategist)\b/.test(lower)) return 'marketing_strategist'
  return null
}

function isMarketingStart(lower: string): boolean {
  if (!MARKETING_NOUN.test(lower)) return false
  if (MARKETING_MAKE.test(lower)) return true
  // "review this copy against the client brand" reads as a request even without
  // an explicit make verb.
  return /\b(review|hersien|check|kyk na)\b/.test(lower)
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseAssistantAction(input: string, context: ActionContext): ParseResult {
  const raw = input.trim()
  if (!raw) return null
  const lower = raw.toLowerCase()

  // 0a. Durable per-user memory: "remember ..." / "onthou ...".
  const remember = raw.match(/^(?:remember|onthou)(?:\s+that|\s+dat)?[:\s]+(.+)/i)
  if (remember && remember[1].trim().length > 1) {
    return {
      type: 'memory.add',
      title: 'Remember this',
      fields: { note: remember[1].trim() },
      clientId: context.currentClientId ?? null,
      clientName: context.currentClientName ?? null,
    }
  }

  // 0a2. Marketing AI department. Checked before the sync detectors so campaign
  // phrasing can never be mistaken for an integration sync.
  {
    const decision = marketingDecision(lower)
    if (isMarketingList(lower)) {
      return {
        type: 'marketing.list',
        title: 'Marketing drafts awaiting review',
        fields: {},
        clientId: context.currentClientId ?? null,
        clientName: context.currentClientName ?? null,
      }
    }
    if (decision) {
      return {
        type: 'marketing.decide',
        title: decision === 'approved' ? 'Approve the latest marketing draft'
          : decision === 'rejected' ? 'Reject the latest marketing draft'
          : 'Request changes on the latest marketing draft',
        fields: { decision },
        clientId: context.currentClientId ?? null,
        clientName: context.currentClientName ?? null,
      }
    }
    if (isMarketingContinue(lower)) {
      const { matches } = findClient(lower, context.clients)
      if (matches.length > 1) return { clarify: `Which client — ${matches.map(m => m.name).join(' or ')}?` }
      const client = matches[0] ?? (context.currentClientId ? { id: context.currentClientId, name: context.currentClientName ?? 'this client' } : null)
      if (!client) return { clarify: 'Which client should I continue the marketing workflow for?' }
      return {
        type: 'marketing.continue',
        title: `Continue the marketing workflow for ${client.name}`,
        fields: {},
        clientId: client.id,
        clientName: client.name,
      }
    }
    if (isMarketingStart(lower)) {
      const { matches } = findClient(lower, context.clients)
      // Never guess the client. Ambiguity and absence both ask.
      if (matches.length > 1) return { clarify: `Which client — ${matches.map(m => m.name).join(' or ')}?` }
      const client = matches[0] ?? (context.currentClientId ? { id: context.currentClientId, name: context.currentClientName ?? 'this client' } : null)
      if (!client) return { clarify: 'Which active client is this marketing work for?' }
      const specialist = marketingSpecialist(lower)
      return {
        type: 'marketing.start',
        title: `Start marketing work for ${client.name}`,
        fields: {
          request: raw,
          specialist: specialist ?? 'auto',
        },
        clientId: client.id,
        clientName: client.name,
      }
    }
  }

  // 0b. Microsoft 365 controlled sync (Planner + Outlook reconciliation preview).
  // Checked BEFORE the Meta detector so Microsoft phrasing can never be routed
  // to a Meta sync. The action itself verifies the live integration state.
  if (isMicrosoftSyncIntent(lower)) {
    const range = defaultMicrosoftSyncRange(context.today)
    return {
      type: 'microsoft.sync',
      title: 'Run Microsoft 365 sync (Planner + Outlook preview)',
      fields: { range_start: range.start, range_end: range.end },
      clientId: null,
      clientName: null,
    }
  }

  // 0. Durable background jobs (Meta sync, report preparation).
  if (isMetaSyncIntent(lower)) {
    const syncPreviousMonth = /\bbaseline|previous month|vorige maand\b/.test(lower)
    return {
      type: 'job.enqueue',
      title: syncPreviousMonth ? 'Run Meta sync and also sync the previous month' : 'Run Meta sync',
      fields: { job: 'meta_sync', sync_previous_month: syncPreviousMonth ? 'yes' : 'no' },
      clientId: context.currentClientId ?? null,
      clientName: context.currentClientName ?? null,
    }
  }
  if (/\b(prepare|prep|generate|build|voorberei|opstel)\b/.test(lower) && /\b(report|reports|verslag|verslae)\b/.test(lower)) {
    return {
      type: 'job.enqueue',
      title: 'Prepare reports (background)',
      fields: { job: 'report_prep' },
      clientId: context.currentClientId ?? null,
      clientName: context.currentClientName ?? null,
    }
  }

  // 1. Mark video(s) as shot.
  if (MARK_SHOT.test(lower) && VIDEO_NOUN.test(lower)) {
    const numbers = collectNumbers(lower)
    if (numbers.length === 0) return { clarify: 'Which video numbers should I mark as shot?' }
    return {
      type: 'video.mark_shot',
      title: `Mark video${numbers.length > 1 ? 's' : ''} ${numbers.join(' & ')} as shot`,
      fields: { videos: numbers.join(', '), status: 'shot' },
      clientId: context.currentClientId ?? null,
      clientName: context.currentClientName ?? null,
    }
  }

  // 2. Move a video (schedule change to a video / deliverable) → proposal.
  if (MOVE.test(lower) && VIDEO_NOUN.test(lower)) {
    const numbers = collectNumbers(lower)
    if (numbers.length === 0) return { clarify: 'Which video number should I move?' }
    const target = /\bnext month\b|\bvolgende maand\b/.test(lower)
      ? firstOfNextMonth(context.today)
      : resolveRelativeDate(lower, context.today)
    if (!target) return { clarify: `When should video ${numbers[0]} move to? (e.g. a date or "next month")` }
    return {
      type: 'video.move',
      title: `Move video ${numbers[0]} to ${target}`,
      fields: { video: numbers[0], scheduled_date: target },
      clientId: context.currentClientId ?? null,
      clientName: context.currentClientName ?? null,
      requiresApproval: false,
    }
  }

  // 2b. Task status / completion / blocker (on "this task" / a task in context).
  if ((THIS_TASK.test(lower) || TASK_NOUN.test(lower)) && !ASSIGN.test(lower)) {
    if (COMPLETE.test(lower)) {
      if (!context.currentTaskId) return { clarify: 'Open the Planner task first so I know exactly which task to complete.' }
      return {
        type: 'task.update',
        title: 'Mark task complete',
        fields: { status: 'done' },
        clientId: context.currentClientId ?? null,
        clientName: context.currentClientName ?? null,
        target: { type: 'planner_task', id: context.currentTaskId, label: context.currentTaskName ?? 'Current Planner task' },
      }
    }
    if (BLOCKED.test(lower)) {
      if (!context.currentTaskId) return { clarify: 'Open the Planner task first so I know exactly which task to block.' }
      return {
        type: 'task.update',
        title: 'Mark task blocked',
        fields: { status: 'blocked' },
        clientId: context.currentClientId ?? null,
        clientName: context.currentClientName ?? null,
        target: { type: 'planner_task', id: context.currentTaskId, label: context.currentTaskName ?? 'Current Planner task' },
      }
    }
  }

  // 3. Assign / create a task.
  if ((ASSIGN.test(lower) || (TASK_NOUN.test(lower) && CREATE_MEETING.test(lower)))) {
    const isAssign = ASSIGN.test(lower)
    const staff = findStaff(lower, context.staffNames)
    if (isAssign && staff.matches.length === 0) return { clarify: 'Who should I assign this task to? I could not match a staff member.' }
    if (staff.matches.length > 1) return { clarify: `Did you mean ${staff.matches.join(' or ')}?` }
    const due = resolveRelativeDate(lower, context.today) // may be null → no due date, which is allowed
    const assignee = staff.matches[0] ?? null
    if (isAssign && !context.currentTaskId) return { clarify: 'Open the Planner task first so I know exactly which existing task to assign.' }
    // Task title: strip the command words for a readable default.
    const title = raw
    return {
      type: isAssign ? 'task.assign' : 'task.create',
      title: isAssign ? `Assign task to ${assignee}` : 'Create task',
      fields: {
        task: title,
        assignee,
        due_date: due, // null is valid — no due date when none was given
      },
      clientId: context.currentClientId ?? null,
      clientName: context.currentClientName ?? null,
      target: isAssign && context.currentTaskId
        ? { type: 'planner_task', id: context.currentTaskId, label: context.currentTaskName ?? 'Current Planner task' }
        : undefined,
      approvalNote: isAssign && due
        ? 'Assignment will be saved now. Change the due date separately on the task because the current backend cannot apply both atomically.'
        : undefined,
    }
  }

  // 4. Cancel a meeting/event.
  if (CANCEL.test(lower) && MEETING_NOUN.test(lower)) {
    const { matches } = findClient(lower, context.clients)
    return {
      type: 'calendar.cancel',
      title: 'Cancel meeting',
      fields: { match: raw, client: matches[0]?.name ?? context.currentClientName ?? null },
      clientId: matches[0]?.id ?? context.currentClientId ?? null,
      clientName: matches[0]?.name ?? context.currentClientName ?? null,
    }
  }

  // 5. Create a calendar meeting / event.
  if (CREATE_MEETING.test(lower) && MEETING_NOUN.test(lower)) {
    const date = resolveRelativeDate(lower, context.today)
    if (!date) return { clarify: 'What day is the meeting? (e.g. "next Tuesday", a weekday, or a date)' }
    const time = resolveTime(lower)
    const { matches } = findClient(lower, context.clients)
    if (matches.length > 1) return { clarify: `Which client — ${matches.map(m => m.name).join(' or ')}?` }
    const client = matches[0] ?? null
    const isAfrikaans = /vergadering|afspraak/.test(lower)
    const kind = /\bevent|geleentheid\b/.test(lower) ? 'event' : 'meeting'
    const title = client
      ? `${client.name} ${isAfrikaans ? 'vergadering' : 'meeting'}`
      : (kind === 'event' ? 'Event' : 'Meeting')
    return {
      type: 'calendar.create',
      title: `New ${kind}: ${title}`,
      fields: {
        title,
        date,
        time: time ?? null,
        event_type: kind === 'event' ? 'client_event' : 'meeting',
      },
      clientId: client?.id ?? null,
      clientName: client?.name ?? null,
    }
  }

  // 6. Propose a Client Schedule change (move a deliverable date / status).
  if (MOVE.test(lower) && /\b(schedule|skedule|deliverable|post|plasing|dp|reel|f\d)\b/.test(lower)) {
    const target = /\bnext month\b|\bvolgende maand\b/.test(lower) ? firstOfNextMonth(context.today) : resolveRelativeDate(lower, context.today)
    if (!target) return { clarify: 'What new date should the schedule item move to?' }
    return {
      type: 'schedule.propose',
      title: 'Propose Client Schedule change',
      fields: { new_date: target, note: raw },
      clientId: context.currentClientId ?? null,
      clientName: context.currentClientName ?? null,
      requiresApproval: true,
      approvalNote: 'Client Schedule changes stay pending until a manager or admin approves them.',
    }
  }

  return null
}
