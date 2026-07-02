# CLAUDE.md — Claude Code project memory

@AGENTS.md

The shared agent rules above (product direction, source of truth, workflow,
secrets, build/ship, reporting) apply to Claude Code too. Claude-specific
notes follow.

## Claude Code working style

- **Use plan mode for broad or cross-cutting changes.** Present the plan and
  get approval before large edits.
- **Audit before editing.** Prefer a strict repo audit (routes, data flow,
  build health, duplicate logic) over assumptions. Read the real files.
- **Use skills when relevant.** This repo ships skills under
  `.claude/skills/` — invoke the matching one before planning or implementing
  (see `docs/agent-operating-model.md`).
- **Repo docs beat conversation memory.** If something you remember disagrees
  with the repo (`AGENTS.md`, `docs/*`, the code), the repo wins. Re-check.
- **Persist important corrections.** When the user corrects direction, write it
  into the relevant `docs/*` file or these memory files (via `/memory` or a
  direct edit) so it survives context loss — don't rely on the conversation.

## Repo-specific reminders

- `monthly_deliverables` is the schedule source of truth; Client Schedule edits
  it, the client-ready calendar only reads it.
- Shared schedule helpers live in `src/lib/planner.ts`
  (`getEffectiveScheduleDate`, `toClientSafeStatus`,
  `normalizeScheduleStatus`). Reuse them; do not re-copy per page.
- Vite is pinned to 7.x for a real reason — see `AGENTS.md`.
- Many Supabase migrations are PREPARED but not applied. Check
  `docs/pending-supabase-migrations.md` before assuming a column exists.
