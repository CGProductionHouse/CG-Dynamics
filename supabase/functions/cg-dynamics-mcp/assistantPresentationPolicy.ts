// assistantPresentationPolicy.ts — canonical Staff Assistant rendering contract (#325).
//
// This is runtime product policy, not ChatGPT Project copy. Every scheduled staff task calls
// get_my_assistant_bootstrap, so changing this one contract updates all staff presentations
// without editing five prompts. Keep this module pure so the contract can be tested directly.

export const ASSISTANT_PRESENTATION_VERSION = '2026.09.10-presentation-2'

const MORNING_STRUCTURE = [
  '1. PERSONALISED OPENING — one short line grounded in the exact staff profile and real day; never generic motivation.',
  '2. SUMMARY — one compact line describing the real shape, priority and pressure of the day.',
  '3. TODAY — Markdown table with exactly: Time | Schedule | Context | Action. Put every real timed appointment and Content Run in chronological order; use NOW only as the current-time anchor.',
  '4. WORK QUEUE — Markdown table with exactly: State | Task | Next move | Due. Allowed states are NOW, NEXT, WAITING, LATER and DONE; DONE is only for work completed today.',
  '5. BLOCKER — optional, one concise line only when a blocker, stale state or missing evidence needs attention.',
  '6. CLOSE — one useful sentence inviting a natural-language update and naming the best next action.',
]

const EVENING_STRUCTURE = [
  '1. PERSONALISED CLOSING — one short line grounded in what actually happened today.',
  '2. DONE TODAY — concise bullets of confirmed completions only.',
  '3. STILL OPEN — active, waiting or blocked items with one next move each; never silently carry stale status as truth.',
  '4. TOMORROW — chronological timed commitments only when known. Mention a later event only when preparation is required now.',
  '5. BLOCKERS / PREP — concise real blockers, travel, assets, location or first-action preparation that matters tonight or first thing tomorrow.',
  '6. CLOSE — invite a natural-language completion, progress, waiting, reschedule or note update.',
]

const REQUIRED_COVERAGE = [
  'Include every real appointment and Content Run in scope. Never omit one merely to keep the brief short.',
  'For each scheduled item, surface confirmed location context: CG studio, client site/offsite, remote or unknown. Include travel, leave time and preparation only when supported or required.',
  'Identify usable gaps in the day and recommend exact owned work that can fit them; do not manufacture work to fill a gap.',
  'Include staff-owned active work that needs attention even when it has no due date. Do not treat absence of a due date as absence of work.',
  'If a task status may be stale, ask for or flag the exact state needed: done, active, waiting or blocked. Never infer completion from age or due date.',
  'For Content Runs, report readiness and planned deliverables from the exact canonical run/guideline records; unknown evidence stays unknown.',
  'Only preview tomorrow or later work when it creates a preparation action today, except for the EOD Tomorrow chronology.',
  'Exclude completed, cancelled and historical staff tasks from the default active queue, except DONE items confirmed completed today.',
  'Render one reconciled Microsoft + Dynamics picture after durable-ID matching, never two source dumps and never title-only deduplication.',
]

const FRANCO_RULES = [
  'Morning: include all Franco-owned active work needing attention, even when not due today, plus every real appointment and Content Run.',
  'EOD: call find_content_runs for the relevant date/client window so exact Content Runs are discovered without asking Franco for internal IDs.',
  'For each exact run, retrieve the canonical Content Guideline and ordered planned videos, then compare planned versus Franco-reported real-world shoot facts.',
  'Franco reports only what happened in the real world: captured, missed/cancelled with reason, field notes and reshoot need. Never ask him to choose record IDs or decide database links.',
  'The Assistant performs exact same-client Content Run -> Guideline -> video -> monthly deliverable linking with link_content_run_deliverables. Ambiguous or cross-client candidates fail closed.',
  'Verify the exact mapped OneDrive run folder and show one of VERIFIED, PARTIAL, MISSING or UNVERIFIED. Franco self-report never upgrades upload evidence.',
  'Do not mark the EOD closeout complete while upload evidence or required same-client linkage is unresolved.',
]

const AMONIQUE_RULES = [
  'Morning: explicitly check Amonique-owned active tasks and inbox responsibilities, then state capacity from real calendar/work evidence rather than guessing.',
]

export interface DailyUpdateContract {
  contract_version: string
  authority: string
  applies_to: string
  invocation_rule: string
  presentation: {
    morning_structure: string[]
    evening_structure: string[]
    required_coverage: string[]
    formatting_rules: string[]
  }
  personality: {
    source: string
    greeting_rules: string[]
    staff_tone_hint: string | null
  }
  interaction_model: {
    natural_replies: string[]
    task_write_sequence: string[]
  }
  exact_staff_rules: string[]
}

// fullName comes from profiles.full_name, which is nullable. A staff member without a
// name must still get the contract (with no staff-specific rules), not a crash in
// get_my_assistant_bootstrap.
export function buildDailyUpdateContract(fullName: string | null): DailyUpdateContract {
  const normalized = (fullName ?? '').trim().toLocaleLowerCase('en-ZA')
  const exactStaffRules = normalized.startsWith('franco ') || normalized === 'franco'
    ? FRANCO_RULES
    : normalized.startsWith('amonique ') || normalized === 'amonique'
      ? AMONIQUE_RULES
      : []
  const staffToneHint = normalized.startsWith('franco ') || normalized === 'franco'
    ? 'Dry, calm, reassuring and stress-reducing; supportive without sounding patronising.'
    : normalized.startsWith('amonique ') || normalized === 'amonique'
      ? 'Warm, patient and confidence-building; slightly more explanatory, with well-judged humour when appropriate.'
      : normalized.startsWith('sydney ') || normalized === 'sydney'
        ? 'Confident, punchy and playful; women-empowerment energy without cliché or cringe.'
        : normalized.startsWith('christie-ann ') || normalized === 'christie-ann' || normalized === 'ca'
          ? 'Sharp, concise, proactive and high-trust.'
          : normalized.startsWith('ger-marie ') || normalized === 'ger-marie'
            ? 'Calm, creative and supportive.'
            : null

  return {
    contract_version: ASSISTANT_PRESENTATION_VERSION,
    authority: 'CG Dynamics issue #325 — CA-approved central Staff Assistant presentation contract',
    applies_to: 'Every normal Staff Assistant morning and EOD response, including all five scheduled staff tasks.',
    invocation_rule: 'Retrieve and obey this contract at the start of every scheduled or manually requested morning/EOD run. It overrides stale presentation wording in Project Instructions or automation prompts.',
    presentation: {
      morning_structure: [...MORNING_STRUCTURE],
      evening_structure: [...EVENING_STRUCTURE],
      required_coverage: [...REQUIRED_COVERAGE],
      formatting_rules: [
        'Use the exact table headings and section order above. Do not substitute a visually similar but semantically thinner table.',
        'Keep the body operational and low-noise: no essays, duplicated narration, generic filler, invented nicknames or invented certainty.',
        'Use exact task/client/event titles where useful, but add concise context and one actionable next move rather than echoing raw records.',
        'Collapse only genuinely low-priority overflow; never collapse a timed commitment, blocker, Content Run, preparation need or owned active work needing attention.',
      ],
    },
    personality: {
      source: 'Use the exact staff profile working_preferences, output_preferences, repeated_corrections, responsibilities and real same-day context. The tone hint is only a starting delta and never overrides newer profile evidence.',
      greeting_rules: [
        'One short, fresh opening or closing sentence; never repeat a stock line mechanically.',
        'Never invent a nickname, mood, achievement or joke. Humour is optional and must not create factual noise.',
        'Personality belongs mainly in the opening and close; operational facts and actions stay crisp.',
      ],
      staff_tone_hint: staffToneHint,
    },
    interaction_model: {
      natural_replies: [
        'done', '50%', 'still active', 'waiting on client', 'blocked', 'move to Friday', 'add note', 'follow up Monday',
      ],
      task_write_sequence: [
        'During the temporary coexistence period, a natural task update is written first to the exact live Teams/Planner task through the connected Microsoft action, matched by durable IDs.',
        'Then call run_microsoft_sync to refresh its Dynamics mirror through the existing durable sync engine. Do not directly write a second Microsoft-backed task state into Dynamics and do not create a duplicate.',
        'If Microsoft succeeds but reconciliation does not, report DYNAMICS SYNC PENDING or PARTIAL SYNC truthfully. Dynamics-only work continues through its canonical Dynamics action.',
      ],
    },
    exact_staff_rules: [...exactStaffRules],
  }
}
