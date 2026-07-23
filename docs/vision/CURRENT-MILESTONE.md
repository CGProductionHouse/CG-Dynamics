# Current Milestone

Last updated: 2026-07-23
Current milestone: Client Intelligence data truth and Cape Lumber benchmark
Status: Active

## Milestone goal

Make CG Dynamics a trustworthy, automated client reporting system before expanding AI strategy generation.

The immediate goal is to repair Meta reporting at the source, verify it against Meta Business Suite, make the Overview reflect only complete and comparable data, complete the Google Ads reporting flow, and use Cape Lumber as the first full benchmark client.

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

## Definition of done

This milestone is complete when:

- no automated connector stores unavailable metrics as zero;
- every client-facing metric has provenance;
- invalid comparisons are blocked by the data model;
- Meta parity is verified against Business Suite for Cape Lumber and representative clients;
- the Overview reflects only verified and compatible data;
- historical re-sync and recent-window refresh work automatically;
- Google Ads is synced and visible for Cape Lumber;
- Cape Lumber has a client-ready benchmark report and reviewed next-campaign strategy;
- the first relevant client and industry Skill Cards are active;
- tests, migrations, Edge Functions, Vercel preview and production verification all pass.

## Next milestone options

After this milestone, choose one primary direction:

1. Scale the verified reporting and specialist strategy system to all active clients.
2. Expand the Marketing Library and specialist-agent orchestration.
3. Improve Operations Hub daily usability.

Do not start all three as equal priorities.
