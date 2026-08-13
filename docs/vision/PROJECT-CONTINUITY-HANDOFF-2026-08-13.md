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

Documentation-only continuity commits were then made directly on `main` on 2026-08-13. Always fetch current `main` before coding rather than treating the product-code checkpoint above as the latest branch SHA.

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

- One canonical Marketing Library domain layer; accidental parallel data layer removed.
- `/admin/marketing` is a real shared workspace.
- Staff can search/read active shared Skill Cards; managers can access Marketing AI; admins retain Sources/Review/Registration governance.
- Live read-only audit established 45 sources, 47 Skill Cards, 45 reviews, 16 platform knowledge items, 45 client-industry profiles and zero Library documents/chunks.
- Source registration was corrected so goldmine/source-pack files are containers, not substitutes for the distinct sources they cite.
- Deterministic extraction now produces 216 distinct cited sources + 34 container references, all review-state/reference-only.
- `phase-28a` registration SQL uses conservative rights states, a valid partial-index conflict arbiter and was reported clean/idempotent in isolated PostgreSQL; production was not changed.
- Manager Marketing AI access was aligned.
- Marketing Workflow production grounding now excludes review-expired cards.

### Final unresolved PR #195 blocker at this handoff

Freshness must be consistent across all production consumers before merge:

- `review_expires_at` is PostgreSQL `date`; use one date-only `YYYY-MM-DD` comparison clock.
- CG Assistant skilled-agent production retrieval must select `review_expires_at` and pass the freshness date into `buildPlan`.
- `listActiveSharedSkillCards()` must exclude stale active cards.
- Marketing AI capability/status counts must not call expired cards live/approved.
- Regression cases: expired yesterday excluded; expires today current; future current; null expiry current.

Do not merge PR #195 until a newer commit resolves this and verification is green.

Production data modified by PR #195 so far: NO.
Production migration applied by PR #195 so far: NO.

## Other active PR — PR #175 must not be overlapped

PR #175 owns the staff invitation lifecycle. It remains an open draft; real SMTP delivery and clean-session browser acceptance remain unproven. Avoid overlapping its auth/invite/user-lifecycle work unless CA explicitly redirects.

## Non-regression product authorities

### Client Schedule

- `monthly_deliverables` is canonical Client Schedule truth.
- `/admin/client-schedule` is the operational editing surface.
- Client-ready schedule/calendar views are projections.
- Never create another schedule table or move Client Schedule editing into CG Calendar.

### Planner/work

- `planner_tasks` is operational task truth and remains separate from `monthly_deliverables`.
- Completed-task behavior was centralised through #176/#188. Do not reintroduce screen-specific completion guesses.

### Content

- One Content Run has one canonical Content Guideline.
- Content Guidelines are operational/client-content documents, not Marketing Library knowledge.

### WhatsApp / OneDrive

- WhatsApp remains the real client approval/communication channel; Dynamics tracks state but never fakes sends.
- OneDrive raw media is internal only; never expose raw media, internal links/IDs or source-file metadata to clients.

## CALENDAR LOCK — do not redesign the calendar every mission

`/admin/cg-calendar` is the operational company calendar. It may contain meetings, shoots, content runs, client events, deadlines, internal company events and intentionally enabled dated Planner tasks.

It must not become the Client Schedule/content-post calendar.

Do not:

- inject `monthly_deliverables` into CG Calendar;
- add DP/F/Video/Reel package items as default Calendar events;
- treat missing scheduled posts in CG Calendar as a defect;
- merge CG Calendar and Client Schedule;
- rebuild Calendar because another mission touches navigation, responsive layout, Marketing, AI or content;
- deduplicate Outlook/native events by title alone;
- destructively delete native/manual history to hide duplicates;
- write back to Microsoft/Outlook.

### #177 current truth

Issue #177 remains open because production rollout/acceptance is incomplete. The code architecture already merged in PR #189 (`64026b8a9811e6bda8500c81e67b478954a35ac0`). It established durable Outlook identity, reviewed candidate matching, non-destructive supersession, fail-closed protection, no title-only merge, preserved audit history and read-only Microsoft upstream.

Do not start another Calendar dedupe architecture.

### Pending production migration order

1. `supabase/migrations/20260809120000_calendar_outlook_identity.sql`
2. `supabase/migrations/20260809130000_client_portal_visibility_contract.sql`

Do not apply either without explicit CA approval. Do not replay obsolete client-portal phase scripts after the visibility contract.

### #177 acceptance

After authorised migration + separately authorised duplicate resolution, review only the exact Aug 24 2026 `MEETING - CG INTERNAL` native/Outlook pair, preserve `CG STUDIO`, retain the native audit row as superseded history, hard-refresh, and separately verify Microsoft resync does not recreate it. Do not modify unrelated events.

## Client Portal visibility contract

PR #192 merged the code contract. Production rollout is separate.

- Client deliverables require real client-facing evidence (`sent_to_client_at`, `client_approved_at` or `posted_at`); internal `production_status` alone never publishes.
- `due_date` is not a client calendar date.
- Company events require explicit audited `client_visible=true` publication.
- Historical events were not auto-published.
- Frontend must fail closed while capability/migration is unavailable; no unsafe fallback.

## UX / responsive / navigation progress — do not restart architecture

- #180 remains open but major cleanup phases landed through #190/#191; #192 was the visibility prerequisite. Remaining work is evidence-based QA/cleanup.
- #181 remains open for authenticated device acceptance, but shared layout architecture landed in #194. Reuse `src/lib/layout.ts` and `src/components/layout/PageShell.tsx`.
- #182 remains open for acceptance/refinement, but main IA work landed in #194. Integrations owns provider setup/sync/import; System is diagnostics; Marketing is the consolidated knowledge parent; Users remains admin. Do not restore the old flat backend-tool menu.

## Marketing / Knowledge product contract

Issues #183/#184 are one connected mission owned by PR #195.

- source material is not automatically company knowledge;
- AI-generated output is not trusted source material;
- draft/stale/retired material must not ground production answers;
- client-specific knowledge remains isolated and linked by client ID;
- inactive clients do not become default noise;
- reusable industry truth does not hardcode client names;
- goldmine/source-pack Markdown files are containers; distinct cited sources retain their own provenance/rights/review evidence.

## Client research status

Canonical ledger: `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md`.

Sequence is complete through HMH Attorneys. Exact next client: **Human Auto**.

Do not start Human Auto automatically. Ask CA `Human Auto — skip or go?` and proceed only on `go`.

## Issue status agents must respect

- #176 closed — completed-task authority implemented.
- #177 open — code merged in #189; production rollout/acceptance remains.
- #180 open — partially delivered; evidence-based cleanup only.
- #181 open — shared responsive system merged; device acceptance remains.
- #182 open — IA largely merged; acceptance/refinement only.
- #183 open — active PR #195.
- #184 open — active PR #195; no parallel registration pipeline.

## Agent allocation

- Claude Code gets large architecture/substantial implementation missions; do not micromanage it file-by-file.
- OpenCode handles bounded isolated fixes.
- Do not create chains of tiny PRs for one coherent mission.
- Review actual GitHub output before merge advice.
- Prefer improving an existing active PR over creating overlapping work.

## Production safety

Without explicit CA approval, agents must not apply production Supabase migrations, mutate production data, resolve #177 production duplicate records, publish/unpublish client calendar events, create historical visibility backfills, change Microsoft upstream data or invent production state.

## Immediate next actions

1. Finish the final freshness-contract fix on same PR #195.
2. Re-run full verification and review its newer head.
3. Merge #195 only after freshness is proven.
4. Keep calendar/client-portal production migration rollout separate and explicitly authorised.
5. Keep PR #175 isolated.
6. Continue client research only after CA explicitly says `go` for Human Auto.

## Anti-abortive-work checklist

Before editing:

- Is this already solved on `main`?
- Is an open PR already solving it?
- Is there a page contract saying the behavior is intentional?
- Am I creating a duplicate table/data layer/workspace?
- Am I mixing CG Calendar with Client Schedule?
- Am I weakening a visibility/security contract for convenience?
- Am I redoing responsive/navigation architecture already merged in #194?
- Am I touching production SQL without explicit approval?

If yes, stop and reconcile existing work first.
