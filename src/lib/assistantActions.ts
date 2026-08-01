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
}

export interface ActionProposal {
  type: AssistantActionType
  title: string // short human summary for the preview header
  // Structured, editable fields shown in the preview. Values are display-ready.
  fields: Record<string, string | number | null>
  clientId: string | null
  clientName: string | null
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

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseAssistantAction(input: string, context: ActionContext): ParseResult {
  const raw = input.trim()
  if (!raw) return null
  const lower = raw.toLowerCase()

  // 0. Durable background jobs (Meta sync, report preparation).
  if (/\b(meta[\s-]?sync|sync meta)\b/.test(lower)) {
    const baseline = /\bbaseline|previous month|vorige maand\b/.test(lower)
    return {
      type: 'job.enqueue',
      title: baseline ? 'Run Meta sync (+ previous-month baseline)' : 'Run Meta sync',
      fields: { job: 'meta_sync', baseline: baseline ? 'yes' : 'no' },
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
      return {
        type: 'task.update',
        title: 'Mark task complete',
        fields: { status: 'done' },
        clientId: context.currentClientId ?? null,
        clientName: context.currentClientName ?? null,
      }
    }
    if (BLOCKED.test(lower)) {
      return {
        type: 'task.update',
        title: 'Mark task blocked',
        fields: { status: 'blocked' },
        clientId: context.currentClientId ?? null,
        clientName: context.currentClientName ?? null,
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
      approvalNote: 'Client Schedule changes stay pending until an Admin approves them.',
    }
  }

  return null
}
