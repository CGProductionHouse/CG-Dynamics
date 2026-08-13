# CG Dynamics — Canonical Project Continuity Handoff

Last updated: 2026-08-13 SAST
Status: CURRENT canonical handoff for ChatGPT, Claude Code, Codex, OpenCode and other agents
Repository: `CGProductionHouse/CG-Dynamics`
Production app: `https://cg-dynamics.vercel.app`

This file supersedes the 2026-08-06 continuity handoff. The older handoff is historical only.

## Mandatory start procedure

Before proposing or making changes:

1. Read `AGENTS.md`.
2. Read `CONTINUE-HERE.md`.
3. Read this file.
4. Read `docs/cg-dynamics-page-vision-and-milestones.md`.
5. Read `docs/current-product-game-plan.md`.
6. Read `docs/vision/CURRENT-MILESTONE.md`.
7. Check current `main`, open PRs and relevant issues.
8. Continue an existing PR when it already owns the requested area instead of creating duplicate work.
9. Production SQL/data changes require explicit CA approval.

GitHub `main` is source of truth for committed state; open PR state is source of truth for in-flight work.

## Current product checkpoint

Last product-code merge before the 2026-08-13 documentation refresh:

- `6c0dcc39fb1fe6caa6fbe11144296a5899baed3d`
- PR #194 — app-shell #181/#182 responsive rollout + IA consolidation.

Documentation-only continuity commits followed directly on `main`. Always fetch current `main` before coding.

Already merged and not to be reinvented:

- PR #188 — #176 completed-task authority.
- PR #189 — #177 Outlook identity and non-destructive reviewed supersession architecture.
- PR #190 — #180 Phase 1 UX cleanup.
- PR #191 — #180 Phase 2 Client Intelligence cleanup.
- PR #192 — explicit Client Portal visibility contract.
- PR #194 — shared responsive/layout + IA architecture. PR #193 was superseded/closed.

## Active mission — PR #195

PR #195 owns Issues #183 + #184 Marketing/Knowledge.

Branch: `feat/marketing-knowledge-workspace`
Reviewed head: `0295aa4c6af5add0c22fce1df2494446cc40c1d4`

Do not start a parallel Marketing/Knowledge rewrite.

Already delivered on the branch:

- canonical Marketing Library data layer retained; accidental parallel data layer removed;
- real `/admin/marketing` workspace;
- staff-safe shared Skill Card search;
- manager Marketing AI access;
- admin Sources/Review/Registration governance;
- live read-only evidence: 45 Library sources, 47 Skill Cards, 45 reviews, 16 platform knowledge items, 45 client-industry profiles, 0 Library documents/chunks;
- goldmine/source-pack files treated as containers, not flattened source substitutes;
- deterministic extraction: 216 distinct cited sources + 34 container references;
- conservative needs-review/reference-only phase-28a registration pipeline;
- isolated PostgreSQL validation reported clean/idempotent;
- Marketing Workflow excludes expired Skill Cards.

Final blocker before merge:

- freshness must be consistent everywhere using date-only `YYYY-MM-DD` because `review_expires_at` is a PostgreSQL date;
- CG Assistant skilled retrieval must select/pass `review_expires_at`;
- staff-safe `listActiveSharedSkillCards()` must exclude expired active cards;
- capability/status counts must not describe expired cards as current/live;
- regression tests must cover expired yesterday, today, future and null expiry.

Do not merge PR #195 until a newer commit resolves this and verification is green.

Production data modified by PR #195: NO.
Production migration applied by PR #195: NO.

## PR #175 — keep isolated

PR #175 owns staff invitation/auth lifecycle and remains a separate open draft. Do not overlap it from unrelated work. Real SMTP delivery and clean-session acceptance remain unproven.

## Product authorities

### Client Schedule

- `monthly_deliverables` is canonical Client Schedule truth.
- `/admin/client-schedule` is the content schedule editing surface.
- client-ready schedule/calendar views are projections.
- never create another schedule authority.

### Planner/work

- `planner_tasks` is operational task truth, separate from Client Schedule.
- completed-task authority was centralised in #176/#188; reuse it.

### Content

- one Content Run has one canonical Content Guideline.
- Content Guidelines are operational/client-content documents, not Marketing Library knowledge.

### WhatsApp / OneDrive

- WhatsApp remains actual client communication/approval; Dynamics never fakes a send.
- raw OneDrive media stays internal and must never be exposed to clients.

## CALENDAR LOCK

CG Calendar is the operational company calendar, not the content posting schedule.

Allowed: meetings, shoots, content runs, client events, deadlines, internal events, intentionally enabled dated Planner tasks.

Forbidden:

- adding `monthly_deliverables`/DP/F/Video/Reel package items to CG Calendar;
- merging CG Calendar and Client Schedule;
- treating missing scheduled posts in CG Calendar as a bug;
- redesigning Calendar because an unrelated mission touches UX/Marketing/navigation;
- deduplicating Outlook/native events by title alone;
- destructively deleting native/manual history;
- Microsoft/Outlook write-back.

### #177 current truth

Code architecture already merged in PR #189 (`64026b8a9811e6bda8500c81e67b478954a35ac0`). Issue remains open only because production rollout/acceptance is incomplete.

Do not create another Calendar dedupe architecture.

Pending migration order:

1. `20260809120000_calendar_outlook_identity.sql`
2. `20260809130000_client_portal_visibility_contract.sql`

No production migration without explicit CA approval. Do not replay obsolete client-portal phase scripts afterward.

Exact acceptance later: review only the Aug 24 2026 `MEETING - CG INTERNAL` native/Outlook pair, preserve Outlook badge/location `CG STUDIO`, retain native superseded audit history, hard-refresh and separately verify a Microsoft resync does not recreate the duplicate. Do not alter unrelated events.

## Client Portal visibility contract

PR #192 merged the code contract; production rollout remains separate.

- Client deliverables require real client-facing evidence (`sent_to_client_at`, `client_approved_at`, or `posted_at`). Internal production status alone never publishes.
- `due_date` is not a client calendar date.
- Company events require explicit audited `client_visible=true` publication.
- Historical events are not auto-published.
- Mixed deployment must fail closed; no unsafe fallback.

## #180/#181/#182 progress

- #180 remains open, but major UX phases already landed in #190/#191. Remaining work is targeted evidence-based cleanup.
- #181 remains open for authenticated device acceptance, but shared responsive architecture landed in #194. Do not create another layout system.
- #182 remains open for acceptance/refinement, but IA landed substantially in #194. Integrations owns setup/sync/import; System is diagnostics; Marketing is the knowledge parent; Users remains admin. Do not restore flat backend-tool navigation.

## Marketing/Knowledge rules

- source material is not automatically company knowledge;
- AI output is not trusted source material;
- draft/stale/retired material must not ground production answers;
- client knowledge stays client-isolated and client-ID linked;
- inactive clients do not pollute default knowledge;
- goldmine/source-pack markdown documents are containers; cited sources retain separate provenance/rights/review evidence.

## Client research

Canonical ledger: `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md`.

Complete through HMH Attorneys. Exact next client: **Human Auto**.

Do not research Human Auto automatically. Ask `Human Auto — skip or go?` and proceed only on `go`.

## Working method

- Claude Code gets large architecture/substantial implementation missions; do not micromanage it file-by-file.
- OpenCode handles bounded isolated fixes.
- Avoid chains of tiny overlapping PRs.
- Review actual GitHub output before merge advice.
- Prefer continuing an existing active PR to creating duplicate architecture.

## Immediate next actions

1. Finish freshness on same PR #195.
2. Re-run full verification and review newer head.
3. Merge #195 only after freshness is proven.
4. Keep production calendar/client-portal rollout separate and explicitly authorised.
5. Keep PR #175 isolated.
6. Continue client research only after CA explicitly says `go` for Human Auto.

## Anti-abortive-work check

Before editing ask:

- already solved on `main`?
- open PR already solving it?
- page contract says behavior is intentional?
- creating duplicate table/data layer/workspace?
- mixing CG Calendar with Client Schedule?
- weakening visibility/security for convenience?
- redoing #194 shell/navigation architecture?
- touching production SQL without approval?

If yes, stop and reconcile first.
