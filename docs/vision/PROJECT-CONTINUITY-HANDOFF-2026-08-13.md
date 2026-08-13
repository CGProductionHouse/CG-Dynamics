# CG Dynamics — Canonical Project Continuity Handoff

Last updated: 2026-08-13 SAST
Status: **CURRENT canonical handoff for ChatGPT, Claude Code, Codex, OpenCode and other agents**
Repository: `CGProductionHouse/CG-Dynamics`
Production app: `https://cg-dynamics.vercel.app`

> This file supersedes the 2026-08-06 continuity handoff for current work. The older handoff is historical only.

## Mandatory start procedure

Before proposing or making changes:

1. Read `AGENTS.md`.
2. Read `CONTINUE-HERE.md`.
3. Read this file.
4. Read `docs/cg-dynamics-page-vision-and-milestones.md`.
5. Read `docs/current-product-game-plan.md`.
6. Read `docs/vision/CURRENT-MILESTONE.md`.
7. Check current `main`, open PRs and relevant issues on GitHub.
8. If an open PR already owns the requested area, continue/review that PR instead of starting duplicate work.
9. Do not infer production database state from merged migrations. Production SQL requires explicit evidence and explicit user approval.

GitHub `main` is the code/document source of truth. Open PR state is the source of truth for in-flight work.

## Repository checkpoint

Last product-code merge before this documentation refresh:

- `6c0dcc39fb1fe6caa6fbe11144296a5899baed3d`
- PR #194 — App shell #181/#182: responsive rollout + IA consolidation.

A documentation-only continuity refresh was then committed directly to `main` on 2026-08-13. Always fetch current `main` before coding rather than treating the product-code checkpoint above as the latest branch SHA.

Important merged work immediately before PR #194:

- PR #188 — completed-task authority for #176.
- PR #189 — durable Outlook identity + reviewed non-destructive duplicate resolution for #177.
- PR #190 — #180 Phase 1 core daily UX-noise cleanup.
- PR #191 — #180 Phase 2 Client Intelligence UX-noise cleanup.
- PR #192 — explicit Client Portal visibility contract and safe mixed-deployment behavior.
- PR #194 — shared responsive layout foundation/rollout + information-architecture consolidation. PR #193 was superseded and closed.

Do not re-implement these foundations from scratch.

## Active large implementation mission — PR #195

PR #195: `Marketing/Knowledge workspace on the canonical layer + #184 registration pipeline`

Branch: `feat/marketing-knowledge-workspace`
Reviewed head at this handoff: `0295aa4c6af5add0c22fce1df2494446cc40c1d4`

This is the active large Claude mission for Issues #183 + #184. Do not start a parallel Marketing/Knowledge rewrite.

### Already accomplished on PR #195

- Removed the accidental duplicate Marketing Library data model and returned to the canonical `src/lib/marketing-library/skillCardsData.ts` domain layer.
- `/admin/marketing` became a real shared Marketing/Knowledge workspace.
- Staff can search/read active shared Skill Cards through the existing staff-safe contract.
- Managers can access Marketing AI.
- Admins retain Sources, Review, Registration and governance functions.
- Marketing moved into daily staff navigation; clients remain excluded.
- Live read-only audit established 45 `marketing_library_sources`, 47 `skill_cards`, 45 `skill_card_reviews`, 16 `platform_knowledge_items`, 45 `client_industry_profiles`, and zero Library documents/chunks.
- Repository registration was corrected so source packs/goldmine files are containers, not substitutes for the distinct sources inside them.
- Deterministic cited-source extraction now produces 216 distinct cited sources plus 34 container references, all review-state/reference-only.
- `phase-28a` registration SQL was corrected to use allowed rights values and a valid partial-index conflict arbiter; isolated PostgreSQL validation was reported clean and idempotent.
- Manager Marketing AI route access was aligned with the workspace UI.
- Marketing Workflow production grounding now excludes review-expired cards.

### Final unresolved PR #195 blocker at this handoff

Freshness must be consistent across all production consumers before merge:

- `review_expires_at` is PostgreSQL `date`; compare it against one date-only `YYYY-MM-DD` value.
- Marketing Workflow must use that date consistently.
- CG Assistant skilled-agent production retrieval must select `review_expires_at` and pass the freshness date into `buildPlan`.
- `listActiveSharedSkillCards()` must exclude stale active cards so ordinary staff are not shown expired knowledge as current approved guidance.
- Marketing AI capability/status counts must not call expired active cards live/approved.
- Regression cases: expired yesterday excluded; expires today current; future current; null expiry current.

Do not merge PR #195 until a newer commit resolves this and the full tests/build are green.

Production data modified by PR #195 so far: NO.
Production migration applied by PR #195 so far: NO.

## Other active PR — PR #175 must not be overlapped

PR #175: real staff invitation lifecycle, activation and identity reconciliation.

Branch: `pr5/staff-invitation-lifecycle`
State: open draft.

Implemented foundation includes a dedicated `staff_invitations` state machine, truthful evidence constraints and invite/resend/cancel/expiry/reconciliation logic.

Still unproven:

- real SMTP delivery;
- clean-session acceptance/login;
- live resend/cancel/expiry browser flow.

Do not touch invitation/auth/user-lifecycle files during unrelated work unless CA explicitly redirects or #175 has first been reconciled with current main.

## Non-regression product authorities

### Client Schedule authority

- `monthly_deliverables` is the canonical content/client schedule source of truth.
- `/admin/client-schedule` is the operational editing surface.
- Client-ready schedule/calendar views are projections, not a second editing system.
- Do not invent another schedule table.
- Do not move Client Schedule editing into CG Calendar.

### Planner/work authority

- `planner_tasks` remains operational task management.
- Planner/Work is separate from `monthly_deliverables`.
- Completed-task behavior was centralised through #176/#188. Do not reintroduce screen-specific completion guesses.
- Completed history is retained; completed tasks must not return to active work because another screen interprets status differently.

### Content authority

- One Content Run has one canonical Content Guideline.
- Content Guidelines are operational/client-content documents, not Marketing Library knowledge.
- Do not merge the Marketing Library data model with Content Guidelines simply because both contain guidance.

### WhatsApp / OneDrive boundaries

- WhatsApp remains the actual client communication/approval channel for now.
- CG Dynamics tracks state; it must not fake a WhatsApp send.
- OneDrive remains internal raw-media storage.
- Raw media, internal OneDrive links/IDs and source-file metadata must never be exposed to clients.

## CALENDAR LOCK — do not redesign the calendar every mission

This section exists because repeated calendar reinterpretation has caused wasted work.

### CG Calendar purpose is fixed

`/admin/cg-calendar` is the operational company calendar.

It may contain meetings, shoots, content runs, client events, deadlines, internal company events and optional real dated Planner tasks where intentionally enabled.

It must not become the Client Schedule or content-post calendar.

### Forbidden CG Calendar regressions

Do not:

- inject `monthly_deliverables` into CG Calendar;
- add DP/F/Video/Reel package items as default calendar events;
- complain that scheduled posts are missing from CG Calendar;
- merge CG Calendar and Client Schedule;
- rebuild the calendar because a new mission touches navigation, responsive layout, Marketing, AI or content;
- deduplicate calendar items by title alone;
- destructively delete native/manual records to hide duplicates;
- write back to Microsoft/Outlook.

### #177 duplicate Outlook event — current truth

Issue #177 remains open because production rollout/acceptance is not complete, even though the code fix merged in PR #189 (`64026b8a9811e6bda8500c81e67b478954a35ac0`).

PR #189 established durable Outlook identity, reviewed candidate matching, non-destructive native-event supersession, fail-closed handling for cancelled/linked/content-run/conflicting states, no title-only merge, preserved source/audit history and read-only Microsoft upstream.

Do not start another calendar dedupe architecture. The remaining work is deployment/acceptance of the existing contract.

### Calendar production migration dependency

Required migration order:

1. `supabase/migrations/20260809120000_calendar_outlook_identity.sql`
2. `supabase/migrations/20260809130000_client_portal_visibility_contract.sql`

Do not apply either migration without explicit CA approval for production Supabase work.

Do not replay obsolete `phase-11a-client-portal-read-access.sql` or `phase-29a-client-portal-calendar-release.sql` after the visibility contract.

### #177 production acceptance case

Only after migration approval/application and separately authorised duplicate resolution:

- review the exact Aug 24 2026 `MEETING - CG INTERNAL` native + Outlook pair;
- preserve Outlook badge/location `CG STUDIO`;
- one active Outlook-backed logical event remains;
- native row remains as superseded audit history;
- hard refresh is stable;
- a separately authorised Microsoft resync does not recreate the duplicate.

Do not modify unrelated calendar events during this acceptance.

## Client Portal visibility contract — merged code, production rollout separate

PR #192 merged the explicit visibility contract at `98cdeb9b76e660ae93715e55784c145ab0c867dd`.

### Monthly deliverables

A client portal item requires own-client scope plus real client-facing evidence from `sent_to_client_at`, `client_approved_at` or `posted_at`.

Internal `production_status` alone never grants client visibility. `due_date` is not a client calendar date.

### Company calendar events

Company events are client-visible only after explicit `client_visible=true` publication with audit evidence. Historical events were not auto-published.

### Mixed deployment

Frontend must fail closed while the capability/migration is unavailable. Do not add an unsafe fallback.

## UX / responsive / navigation progress — do not restart the architecture

### #180 UX noise

Issue #180 remains open, but major phases already landed through PR #190 and PR #191. PR #192 was the client-visibility prerequisite discovered before client-portal Phase 3.

Remaining #180 work is targeted product QA/cleanup, not permission to redesign every screen again.

### #181 responsive system

Issue #181 remains open for final authenticated device acceptance, but PR #194 merged the shared layout system and broad gutter rollout.

Do not create a second responsive architecture. Reuse `src/lib/layout.ts` and `src/components/layout/PageShell.tsx`.

### #182 information architecture

Issue #182 remains open for acceptance/finishing, but the main structural work merged in PR #194.

Current direction: daily goal-based navigation; Integrations owns provider setup/sync/import; System is diagnostics; Marketing is the consolidated Marketing/Knowledge parent; Users remains admin; specialist backend routes may remain guarded deep links.

Do not restore the old flat top-level list of Microsoft Sync / Planner Import / Marketing AI / Skill Card Review / diagnostics.

## Marketing / Knowledge product contract

Issues #183 + #184 are one connected product mission currently implemented through PR #195.

Required long-term shape: one Marketing/Knowledge workspace with Library, reusable industry knowledge, active-client knowledge linked by client ID, Skills/Playbooks, Marketing AI, Review and Sources/provenance.

Knowledge rules:

- source material is not automatically company knowledge;
- AI-generated output is not trusted source material;
- drafts/stale/retired content must not ground production answers;
- client-specific knowledge stays isolated;
- inactive clients do not become permanent default noise;
- no client names hardcoded into reusable industry truth;
- history is retained when knowledge is superseded/retired.

The canonical repository resource inventory explicitly says whole goldmine files are containers. Distinct cited sources must carry their own provenance/rights/review evidence.

## Client research status

Canonical ledger: `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md`.

Current sequence has progressed through HMH Attorneys.

Exact next client: Human Auto.

Do not research Human Auto automatically. Ask CA `Human Auto — skip or go?` and proceed only on `go`.

## Current issue status agents must respect

- #176 closed — completed tasks authority implemented.
- #177 open — code merged in #189; production migration + exact acceptance remain.
- #180 open — UX cleanup partially delivered in #190/#191; remaining work should be evidence-based.
- #181 open — shared responsive system merged in #194; remaining acceptance/device verification.
- #182 open — IA overhaul largely merged in #194; remaining acceptance/refinement, not a restart.
- #183 open — active implementation in PR #195.
- #184 open — active implementation in PR #195; no parallel registration pipeline.

## Agent allocation / working method

CA's working preference:

- Claude Code gets large architecture and substantial implementation missions.
- Do not micromanage Claude file-by-file when the problem is architectural.
- OpenCode is for bounded implementation fixes and isolated tasks.
- Do not create chains of tiny PRs for one coherent product mission.
- Review real GitHub output before merge advice.
- One substantial active mission at a time unless work is clearly non-overlapping.

If a mission is already underway, improve the existing branch/PR instead of creating another parallel architecture.

## Production safety

Without explicit CA approval, agents must not apply production Supabase migrations, mutate production data, resolve #177 production duplicate records, publish/unpublish client calendar events, create historical visibility backfills, change Microsoft upstream data or invent production state from assumptions.

## Immediate next actions

Unless CA redirects:

1. Finish the final freshness-contract fix on existing PR #195.
2. Re-run full verification and review the new PR #195 head.
3. Merge #195 only after the freshness contract is proven and the PR is genuinely ready.
4. Keep production migration rollout (#189 then #192) as a separate explicitly authorised operation.
5. Keep PR #175 isolated until delivery/browser acceptance is resolved.
6. Continue client research only when CA explicitly answers `go` for Human Auto.

## Anti-abortive-work checklist

Before editing any area, ask:

- Is this already solved on `main`?
- Is an open PR already solving it?
- Is there a page contract saying this behavior is intentional?
- Am I about to create a duplicate table/data layer/workspace?
- Am I mixing CG Calendar with Client Schedule?
- Am I weakening a visibility/security contract for convenience?
- Am I redoing navigation/responsive architecture already merged in #194?
- Am I touching production SQL without explicit approval?

If yes, stop and reconcile existing work first.
