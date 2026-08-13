# Current Milestone

Last updated: 2026-08-13 SAST
Current milestone: **Marketing / Knowledge consolidation and resource operationalisation**
Status: **ACTIVE — implementation in PR #195; production writes not authorised**

Canonical current handoff:

- `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`

## Current main checkpoint

`main` at the start of this milestone update:

- `6c0dcc39fb1fe6caa6fbe11144296a5899baed3d`
- PR #194 merged: app-shell responsive rollout + information-architecture consolidation.

Do not treat the old Operations Hub milestone below as current. The Operations Hub foundation remains important, but the active implementation mission has moved on.

## Active implementation — PR #195

PR #195 combines Issues #183 and #184 into one substantial Marketing/Knowledge mission.

Branch:

- `feat/marketing-knowledge-workspace`

Reviewed head at this update:

- `0295aa4c6af5add0c22fce1df2494446cc40c1d4`

### Delivered on the branch

- One canonical Marketing Library domain layer; duplicate parallel layer removed.
- `/admin/marketing` is a real workspace rather than a card hub.
- Staff can search/read active shared Skill Cards.
- Managers can use Marketing AI.
- Admins retain source, review and registration governance.
- Live read-only production evidence confirmed 45 source records and 47 Skill Cards, while documents/chunks remain empty.
- Repository source registration was corrected from flattened goldmine-file rows to distinct cited-source extraction.
- Current extraction output: 216 deduplicated cited sources + 34 container references.
- Registration SQL is conservative, reference-only, needs-review, idempotent and reported validated in isolated PostgreSQL.
- Marketing Workflow excludes review-expired cards.

### Final blocker before merge

Freshness must be enforced consistently across all production consumers:

- `review_expires_at` is date-only and must be compared with a date-only `YYYY-MM-DD` clock.
- CG Assistant skilled retrieval must select/pass expiry.
- staff-safe `listActiveSharedSkillCards()` must exclude expired cards.
- capability/status counts must not report expired cards as current approved knowledge.
- tests must cover expired yesterday, expires today, future expiry and null expiry.

Do not merge #195 until a newer commit fixes this and verification is green.

## Important parallel work that must stay isolated

### PR #175 — staff invitations

PR #175 remains a separate open draft for the real staff invitation lifecycle.

Do not overlap auth/invitation/user-lifecycle work from unrelated missions.

### #177 Calendar duplicate rollout

The code fix is already merged through PR #189. Do not redesign the calendar or invent a new duplicate model.

Production acceptance remains separate and requires explicit approval.

Pending migration order:

1. `20260809120000_calendar_outlook_identity.sql`
2. `20260809130000_client_portal_visibility_contract.sql`

No production migration is authorised by this milestone document.

## Product authorities that must not drift

- `monthly_deliverables` is Client Schedule truth.
- Client Schedule and CG Calendar remain separate.
- CG Calendar is operational company events, not the content-posting schedule.
- Planner/Work remains separate from Client Schedule.
- completed-task authority delivered in #176/#188 must be reused, not reinvented.
- one Content Run has one canonical Content Guideline.
- WhatsApp remains client approval/communication.
- raw OneDrive media remains internal only.
- client portal visibility requires explicit/evidenced publication; no unsafe fallback.
- Marketing source material is not automatically trusted knowledge.
- stale/draft/retired knowledge must not ground production AI.

## UX / responsive / navigation state

Issues #180/#181/#182 remain open for acceptance and targeted cleanup, but major architecture already landed:

- #180 Phase 1: PR #190.
- #180 Phase 2: PR #191.
- Client Portal visibility prerequisite: PR #192.
- #181/#182 shared responsive + IA foundation/rollout: PR #194.

Do not launch another broad shell/navigation rewrite. Remaining work should come from authenticated QA and specific evidence-backed defects.

## Client research state

Canonical ledger:

- `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md`

Sequence is complete through **HMH Attorneys**.

Exact next client:

- **Human Auto**

Do not research Human Auto until CA explicitly says `go`.

## Immediate execution order

Unless CA redirects:

1. Finish the final freshness contract on **same PR #195**.
2. Verify tests, TypeScript, lint, build and Vercel.
3. Review and merge #195 only when genuinely ready.
4. Keep production calendar/client-portal migrations as a separately approved rollout.
5. Keep PR #175 isolated.
6. Resume client-by-client research only on CA's explicit `go`.

## Definition of done for this milestone

The current milestone is not done merely because the Marketing page renders.

Required before #183/#184 can be treated as substantially complete:

- one coherent Marketing/Knowledge workspace;
- staff-safe current approved knowledge search;
- source provenance and review-state governance;
- deterministic non-duplicating registration pipeline;
- no flattened source-container substitution;
- approved/current-only AI grounding across Marketing AI and CG Assistant;
- exact client isolation preserved;
- no production writes performed without approval;
- remaining production rollout/browser verification explicitly separated and documented.
