# Client Intelligence — audit, architecture and roadmap

Last updated: 2026-07-23
Status: Active roadmap

## Purpose

Client Intelligence is the client-facing value layer of CG Dynamics.

It must automatically collect trustworthy performance data, explain what happened, connect activity to commercial intent, show what CG recommends next, and remain premium enough to send directly to clients.

The detailed Meta data architecture and research basis now lives in:

- `docs/client-intelligence/META-REPORTING-TRUTH-STRATEGY.md`

## A. Current product position

### Already strong

- Premium client-facing visual language.
- Monthly reports and platform tabs.
- Post-level Meta content records.
- Null-aware helper functions in parts of the reporting model.
- Admin data-health concepts.
- Google Ads account discovery, shared-account campaign mapping and client-isolated reporting.
- Google Ads dashboard loading for admin preview and published client reports.
- Marketing Library and Skill Card foundations for future specialist agents.

### Current critical weakness

The reporting stack is not yet consistently truthful across the full data path.

The current Meta connector can treat unavailable Facebook Page visibility metrics as database zero values while Instagram totals are available. The Overview can then present partial visibility as all-channel performance and compare it with a previous month built from different source coverage.

This creates false movement, weak narratives and unsafe recommendation inputs.

Client Intelligence must therefore solve data truth before expanding AI strategy.

## B. Non-negotiable reporting principles

1. Missing is not zero.
2. Every metric has provenance.
3. Month-on-month movement requires compatible definitions.
4. Unique audiences are not summed across platforms.
5. Organic visibility, audience response, paid demand and commercial intent remain distinct.
6. Connector failures become internal alerts, not client performance claims.
7. AI strategy consumes verified evidence, not raw tables or incomplete totals.
8. Client-facing strategy is reviewed before publication.

## C. Target data architecture

### 1. Connector adapters

Each platform owns its authentication, API version, metric map, request rules, retries and safe errors.

Initial adapters:

- Meta Facebook Pages.
- Meta Instagram professional accounts.
- Google Ads.

### 2. Raw source snapshots

Store or reference safe source responses before transformation so every displayed number can be traced back to the platform response.

### 3. Canonical metric registry

The registry defines:

- canonical concept;
- platform source metric;
- API version;
- aggregation method;
- whether the metric is safe for client display;
- whether it can be summed across platforms;
- which historical definitions are comparable;
- retirement or migration status.

### 4. Normalized facts

Build reproducible daily and monthly facts from source snapshots. Automated API truth should no longer depend on overloading generic manual metric rows.

### 5. Data-quality and comparability engine

Every client/platform/month receives a quality state and comparison eligibility.

### 6. Client presentation

The report uses only client-safe normalized facts. Technical source diagnostics remain admin-only.

### 7. Strategy evidence package

Verified metrics, valid comparisons, eligible CG content, Google Ads results, active-client knowledge and relevant Skill Cards become a reviewed strategy input.

## D. Client dashboard information architecture

### Cover and context

- Client identity.
- Report month.
- Status.
- Reporting freshness and client-safe source note.

### Overview

Do not force all channels into one headline total.

Use clearly separated sections:

- Brand visibility.
- Audience response.
- Paid demand.
- Commercial intent.
- What changed and why.
- CG strategy and next campaign.

### Platform tabs

- Facebook.
- Instagram.
- Google Ads when mapped and synced.
- Future connectors only when real data exists.

### Content intelligence

- Top performing content.
- Admin curation for CG-created or CG-managed highlights.
- Raw page winner remains available in admin diagnostics.
- Excluded content stays in truthful aggregate totals but is not used as positive strategy evidence.

### Month ahead

- Scheduled content.
- Shoots and events.
- Client actions required.

### Strategy

The client report must show:

- observed outcome;
- commercial meaning;
- platform role;
- next campaign recommendation;
- audience and offer;
- content requirement;
- KPI and test period;
- what CG needs from the client.

## E. Active roadmap phases

### Phase 20d — Meta reporting truth and parity

Status: Active

- Desktop-agent comparison of Meta Business Suite, Graph API, Supabase and CG Dynamics.
- Confirm current Graph API version, Page token, permissions, metric replacements, parameters and date rules.
- Stop persisting unavailable metrics as zero.
- Introduce provenance, completeness and compatibility.
- Add idempotent historical re-sync and recent-period rollback refresh.
- Verify Cape Lumber and representative client configurations.

### Phase 20e — Overview and publication quality gate

- Remove unsafe all-channel claims.
- Block invalid comparisons.
- Add verified/partial/not-comparable/sync-error states.
- Prevent publication of misleading client reports.
- Add connector freshness and health monitoring.

### Phase 20f — Cape Lumber benchmark intelligence

- Complete Meta parity.
- Run Google Ads sync.
- Curate featured CG content.
- Activate Cape Lumber client knowledge and construction/timber Skill Cards.
- Generate and review the first evidence-based sales and campaign strategy.
- Establish the benchmark report structure for future clients.

### Phase 21 — Scale specialist intelligence

- Expand verified reporting patterns to all active clients.
- Add industry specialists.
- Add strategy review and approval workflow.
- Track whether recommendations were implemented and what they produced.

### Future platform connectors

Add TikTok, LinkedIn, website analytics and SEO only through the same connector/provenance architecture. Do not add platform tabs that rely on manual monthly patching.

## F. Cape Lumber definition of success

Cape Lumber becomes the first complete reference client when:

- Meta Business Suite and API results are explainably aligned for the same calendar month;
- Facebook and Instagram remain correctly defined and separated;
- Google Ads campaign data is synced and isolated to Cape Lumber;
- every client-facing movement is comparable;
- the Overview communicates channel roles and commercial meaning;
- featured content represents CG-created or CG-managed work;
- the strategy identifies the next best sales campaign and why;
- the client can clearly see what CG learned, what CG is changing and how success will be measured.

## G. Long-term outcome

Client Intelligence should become a monthly marketing command centre that is difficult to replace because it combines:

- trustworthy first-party data;
- client and industry knowledge;
- creative and paid-media performance;
- operational plans;
- reviewed specialist strategy;
- a permanent learning history.

The moat is not a prettier chart. The moat is reliable data, explainable strategy and accumulated client intelligence.
