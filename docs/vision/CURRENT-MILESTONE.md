# Current Milestone

Last updated: 2026-07-27
Current milestone: Client-facing completion and trust
Status: Active — all branches merged into main; implementation proceeding in parallel.

## Completed and in production (merged to main)

- **Meta reporting truth** — availability-aware facts (unavailable ≠ zero), FB/IG
  separated, no cross-platform unique-audience sums, comparability gate. Live (PR #43).
- **Unified client portal foundation** — `/client`, `/client/performance`,
  `/client/campaigns`, `/client/content-calendar`; report-bound RPCs; published
  reports only; own-client isolation. Live (PR #44).
- **Google Ads reporting** — client-isolated, honest disconnected states, no
  conversions-as-revenue. Live.
- **Microsoft deterministic reconciliation engine** — tolerant parser,
  `link_existing`, `package_template_create`, phase-21a/21b live (apply contract
  v2, backward compatible). Admin-only, beta-labelled (PR #45).
- **Controlled beta** — released via PR #46; main at `1bfa8e1`.
- **Client-facing trust quality gate** — enforced invariants for client isolation,
  published-only content, unavailable≠zero, cross-client safety. Live (PR #47, main `c80eb35`).

## Active milestone goal — client-facing completion and trust

Move from controlled beta to a complete, trustworthy client-facing release: an
enforced client-visible quality gate, Performance/Campaigns/Content-Calendar
completion, the full monthly content-guide workspace, and reviewed forward-looking
strategy — every client-visible claim accurate, evidence-backed, published and
premium. See "Remaining client-facing work" below and `docs/vision/PARKING-LOT.md`.

### Remaining client-facing work

1. **Microsoft live dated fetch → apply → verify** (auth-gated; see PARKING-LOT).
   Requires authenticated admin or service-role session to invoke
   `microsoft-transition-sync`. The Edge Function is deployed at v12; the
   reconciliation engine, `link_existing`, `package_template_create`,
   phase-21a/21b apply paths are all live. What remains is the live Graph fetch
   — blocked by lack of browser+session in automation.
2. **Authenticated client portal end-to-end QA** — isolation, loading/empty/error
   states, mobile layout, security boundaries are verified at the code/test level.
   Live visual QA with a real client account requires a drivable browser.
3. **Performance Dashboard completion** — summary cards, platform separation,
   unavailable≠zero rendering, comparability gate, Google Ads separate from
   organic — all shipped. Needs visual polish on the existing Meta-truth model.
4. **Campaigns completion** — Google Ads foundation (objective, lifecycle, spend,
   impressions, clicks, CTR, CPC) is shipped. Needs completion of CG review,
   next-optimisation display, Meta Ads and TikTok Ads audit.
5. **Content Calendar completion** — client calendar shipped. Needs package-count
   reconciliation with Client Schedule, canonical deliverable identity
   enforcement, content-guide link integration, mobile agenda.
6. **Full monthly content-guide workspace** — new module (migration + RLS + UI +
   tests). Not started. Tracked in PARKING-LOT.
7. **Forward-looking reviewed strategy thread** — new module. Not started.
   Tracked in PARKING-LOT.

## Original data-truth goal (delivered)

Make CG Dynamics a trustworthy, automated client reporting system before expanding AI strategy generation. Meta reporting truth, the Overview comparability gate, and Google Ads reporting are delivered and live; Cape Lumber's stored data was the diagnostic benchmark.

The system must answer:

1. What happened?
2. Why does it matter commercially?
3. What should CG do next?

It may only answer those questions from verified evidence.

## Why this milestone is active now

The Marketing Library and Skill Card foundation remains essential, but the current client dashboard has exposed a more urgent dependency: AI strategy is unsafe when the underlying metrics are incomplete or incomparable.

The production Meta connector currently treats unavailable Facebook visibility metrics as zero and can compare them with older months that used different source coverage. This creates false declines and weakens client trust.

Data truth is therefore the required foundation for the next Client Intelligence and AI Workforce work.

## Source strategy

The implementation must follow:

- `docs/vision/CG-DYNAMICS-MASTER-GOAL-TRACKER.md`
- `docs/client-intelligence-roadmap.md`
- `docs/client-intelligence/META-REPORTING-TRUTH-STRATEGY.md`
- `docs/marketing-library/README.md`

The detailed Meta architecture, research sources, acceptance criteria and desktop-agent sequence live in the Meta Reporting Truth strategy document.

## Scope for the remaining delivery sprint (2026-07-27)

The Meta truth, Google Ads, unified portal, Microsoft engine, controlled-beta
launch, and quality gate are complete in production. The sprint now completes
every remaining item:

1. **Microsoft live dated parity** — attempt every authenticated route; if
   blocked, document the exact blocker and continue.
2. **Client portal completion** — add comprehensive integration tests for
   loading, empty, error, expired-session, mobile, back/forward navigation and
   security boundary scenarios.
3. **Performance Dashboard polish** — verify platform separation, USA/IG
   unavailable rendering, comparability gate, Google Ads organic separation,
   mobile layout, honest no-data states.
4. **Campaigns completion** — verify Google Ads objective/lifecycle/review/
   optimisation; audit Meta Ads and TikTok Ads with honest disconnected states.
5. **Content Calendar completion** — reconcile package counts, enforce canonical
   deliverable identity, add mobile agenda, add tests.
6. **Full monthly content-guide workspace** — new module.
7. **Forward-looking reviewed strategy** — new module.
8. **Final quality gate** — audit every client-visible route, metric, label,
   comparison, empty state, error state, permission boundary and responsive layout.
9. **Documentation** — update every status file to reflect production reality.
10. **Release** — merge, deploy, verify.

Items 6 and 7 are new modules; everything else is completion on shipped foundations.

## Scope for this milestone

### 1. Meta API truth and parity

- Compare Meta Business Suite, direct Graph API responses, Supabase records and CG Dynamics client output.
- Use Cape Lumber June 2026 as the first exact parity benchmark.
- Confirm current supported metrics, Graph API version, Page token type, permissions, parameters, date boundaries and response parsing.
- Upgrade the connector from hardcoded assumptions to versioned, configurable metric definitions.
- Never use manual monthly figures or CSV patching as the production solution.

### 2. Canonical metric and provenance model

- Distinguish valid zero, missing, unavailable, partial and error states.
- Record metric source, endpoint, API version, period, aggregation method, timezone, completeness and retrieval time.
- Preserve safe source snapshots or references.
- Stop treating automated API truth as generic manual metrics.
- Add compatibility rules for month-on-month comparisons.

### 3. Re-sync and connector health

- Support safe idempotent historical re-sync.
- Refresh recent reporting windows automatically because platform metrics may be revised.
- Preserve the last verified dataset when a re-sync fails.
- Detect deprecated metrics, missing permissions, stale data, unexpected all-zero results and abnormal drops.
- Treat connector failures as internal incidents, not client performance results.

### 4. Client Overview correction

- Remove unsafe all-channel claims.
- Never sum overlapping unique audiences.
- Keep organic social visibility, audience response, paid demand and commercial intent conceptually separate.
- Show platform-specific metrics clearly when they are not safely additive.
- Render movement only when current and previous periods use compatible definitions.
- Update client narratives only after the data-quality gate passes.

### 5. Google Ads completion

- Run the first authorized monthly Google Ads sync for mapped campaigns.
- Verify campaign-to-client isolation.
- Display Google Ads automatically in the existing premium Client Dashboard.
- Keep Google Ads paid-media results separate from Meta organic totals.

### 6. Cape Lumber benchmark report

Complete a client-ready Cape Lumber report containing:

- verified Meta figures;
- synced Google Ads performance;
- accurate platform and month comparisons;
- curated CG-created or CG-managed featured content;
- clear data provenance and client-safe methodology wording;
- a reviewed sales and campaign strategy;
- the proposed next campaign, platform choice, KPI and test plan.

### 7. Marketing Library and AI Workforce dependency

The Marketing Library foundation is retained, not abandoned.

During this milestone:

- create only the Skill Cards needed for verified platform interpretation, reporting methodology and the Cape Lumber/construction-timber pilot;
- do not generate generic strategy from an unsourced model prompt;
- prepare a structured evidence package for future agents;
- require human review before strategy becomes client-visible.

## Out of scope for this milestone

- Broad autonomous agent rollout across every client.
- Large unsourced industry libraries.
- Automated poster generation.
- Full Operations Hub task-manager rebuild.
- CG Hours integration.
- Payroll or confidential staff financial data.
- Permanent dependency on a paid third-party reporting connector without an explicit architecture and cost decision.

## Representative-client validation

Before the Meta connector is considered fixed globally, validate:

- Cape Lumber;
- one Facebook-heavy client;
- one Instagram-heavy client;
- one client with both platforms;
- one client with genuine zero activity;
- one disconnected or permission-blocked state.

For each, trace API response to database fact, admin preview and client-facing output.

## Definition of done for this sprint

1. **Microsoft live parity**: attempted every auth route; exact blocker documented.
   If blocked, cannot be claimed done — deferred to PARKING-LOT.
2. **Client portal QA**: integration tests cover loading, empty, error,
   expired-session, mobile, back/forward nav, security boundaries.
3. **Performance Dashboard**: platform separation verified; unavailable≠zero
   confirmed; comparability gate working; Google Ads separated; mobile layout
   polished; no-data/honest states in place.
4. **Campaigns**: Google Ads objective/lifecycle/spend/impressions/clicks/CTR/CPC
   verified; Meta Ads / TikTok Ads audited with honest disconnected states.
5. **Content Calendar**: package counts correct; canonical deliverable identity
   enforced; mobile agenda present; test coverage for navigation/types/dates/dupes.
6. **Content-guide workspace**: new module — migration + RLS + UI + tests.
   Demonstrably better than current one-video-at-a-time form.
7. **Forward-looking strategy**: structured evidence→meaning→platform→action→
   calendar→KPI module; review-gated; tested.
8. **Final quality gate**: every client-visible route audited; every metric,
   label, comparison, empty state, error state, permission boundary verified.
9. **Documentation**: CURRENT-MILESTONE, PARKING-LOT, MASTER-GOAL-TRACKER,
   client-intelligence-roadmap, microsoft-365-import-map all reflect reality.
10. **Release**: all achievable PRs merged; build passes; tests pass; production
    deployment verified.

After this sprint, the next primary milestone is **Operations Hub: Teams/Planner replacement**.

---

## 2026-07-27 Controlled Beta Launch

CG Dynamics ships a controlled production beta for CG staff and selected clients.
Launch-critical: stable deploy, auth, role/client isolation, client portal, Meta
reporting truth, Google Ads where configured, honest empty/disconnected states.
Microsoft transition reconciliation ships **admin-only, preview-before-apply,
beta-labelled**; live dated package-parity verification remains pending and
Microsoft Planner stays the source of truth until it is reviewed. See
`docs/releases/2026-07-27-controlled-beta-launch.md`.
