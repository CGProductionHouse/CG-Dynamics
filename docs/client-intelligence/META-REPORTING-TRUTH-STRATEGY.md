# Meta Reporting Truth and Sustainable Client Intelligence Strategy

Last updated: 2026-07-23
Status: Active product and implementation strategy
Division: Client Intelligence, with AI Workforce dependencies

## Purpose

CG Dynamics must become a trustworthy client intelligence system, not a dashboard that merely displays whatever numbers are easiest to retrieve.

The system must automatically collect the strongest available first-party performance data, preserve its definition and source, refuse invalid comparisons, and translate verified evidence into a clear commercial strategy.

This document defines the non-negotiable architecture for Meta reporting, cross-platform overview reporting, data quality, client-facing interpretation and future AI strategy generation.

## Why this strategy exists

The production Meta connector currently creates a serious reporting failure:

- Instagram account totals are imported.
- Facebook Page views and reach are treated as unavailable.
- The current sync writes Facebook views and reach as numeric zero values.
- The client Overview then treats those zero values as real, complete data.
- Instagram-only visibility can be labelled as all channels together.
- Current and previous months can be compared even when they were produced by different metric definitions or source coverage.
- Rules-based recommendations can then interpret incomplete data as a genuine performance decline.

This violates the central Client Intelligence goal: reports must explain what happened, why it matters and what CG should do next using truthful evidence.

## Source-of-truth hierarchy

For platform reporting, sources are ranked as follows.

### Tier 1 — first-party platform truth

- Meta Business Suite Insights for parity verification.
- Meta Graph API responses from supported endpoints and metrics.
- Official Meta platform documentation, changelog, permissions documentation and official Postman workspaces.
- Google Ads API responses and official Google documentation.

### Tier 2 — established connector implementation patterns

Used to guide architecture, not to override first-party platform definitions.

- Fivetran connector schema, historical re-sync, rollback sync and connector-health patterns.
- Supermetrics documented refresh-window and API-delay practices.
- Other established reporting platforms where their own documentation explains data provenance, report filtering and AI-summary review.

### Tier 3 — internal operational evidence

- Production sync logs.
- Stored source payloads.
- Cross-client parity tests.
- Repeated discrepancies found between platform UI, API and CG Dynamics.

AI output is never a source.

## Research findings that shape the architecture

### Meta Page Insights requirements

Meta's official Page Insights documentation requires:

- a Page Access Token;
- `pages_read_engagement`;
- `read_insights`;
- a user who can perform the Page analyze task.

The official endpoint is `/{page-id}/insights`, with metrics requested individually or in carefully compatible groups. The documentation also states that daily `since` and `until` responses must be interpreted using their `end_time` behaviour rather than assumed to be a simple inclusive calendar range.

### Meta metrics are versioned and change over time

Meta has repeatedly deprecated Page Insights metrics. Connector vendors had to add replacement media-view and unique-media-view fields and update their schemas. Therefore:

- the Graph API version must be configurable;
- metric names may not be permanent database meaning;
- deprecated metrics must never silently become zero;
- new and old metric definitions must not be compared without an explicit compatibility rule.

### Professional connectors separate extraction from reporting

Fivetran's documented architecture demonstrates several durable patterns:

- a source connector has its own status and sync history;
- historical re-syncs are supported;
- recent reporting periods may be refreshed again through rollback windows because platforms revise metrics;
- raw source tables and report transformations are separate concerns;
- data integrity checks and connector alerts are treated as product features.

CG Dynamics should adopt these patterns at an appropriate scale without adding an unnecessary permanent third-party subscription.

## Strategic decision

CG Dynamics will keep direct Meta Graph API integration as the production source.

External connectors may be used temporarily as parity benchmarks during investigation, but they are not the default production dependency unless a first-party API limitation is proven and documented.

The permanent architecture is:

1. Platform connector adapters.
2. Raw immutable source snapshots.
3. Canonical metric registry.
4. Normalized daily and monthly facts.
5. Data-quality and comparability engine.
6. Client-safe report presentation.
7. Evidence package for reviewed strategy generation.
8. Connector health monitoring and automatic re-sync.

## Non-negotiable data rules

### Missing is not zero

The system must distinguish:

- `0`: the platform returned a valid numeric zero;
- `null`: the platform did not return a value;
- `unavailable`: the metric is unsupported, deprecated or blocked by permissions;
- `partial`: only part of the required source coverage succeeded;
- `error`: the request or parsing failed.

Unavailable, partial, missing and error values may never be persisted or rendered as zero.

### Every metric needs provenance

Every stored reporting fact must be traceable to:

- platform;
- connected asset;
- source endpoint;
- source metric name;
- Graph/API version;
- token class used, without storing or exposing token values;
- requested period;
- platform timezone and normalized business timezone;
- aggregation method;
- response shape (`values`, `total_value`, lifetime field or reconstructed post sum);
- retrieved timestamp;
- completeness state;
- source payload reference or safe raw snapshot;
- connector implementation version.

### Comparisons require equivalent definitions

A percentage movement may render only when both periods have:

- the same platform;
- the same canonical metric;
- compatible source metric definitions;
- the same aggregation method;
- equivalent period length and boundaries;
- complete data coverage;
- no known source migration that invalidates comparison.

When comparability fails, show a neutral explanation such as:

> Comparison unavailable because the source metric changed.

Never show a red or green percentage derived from incompatible data.

### Cross-platform metrics are not automatically additive

Views, reach, unique viewers, impressions and interactions have different platform definitions.

The system may sum only metrics whose registry explicitly allows cross-platform addition.

In particular:

- reach or unique viewers must not be summed across platforms because people overlap;
- Facebook media views and Instagram views may be presented beside each other, but must not be called one audience figure without a verified additive definition;
- Google Ads impressions must remain labelled paid demand and not be merged into organic social visibility;
- current follower snapshots are not follower growth.

## Meta connector architecture

### 1. Version policy

- Remove hardcoded dependency on Graph API v22 as the assumed reporting contract.
- Read the supported production version from one controlled server-side configuration.
- Record the version on every source snapshot and normalized fact.
- Add an alert before the configured version approaches retirement.
- Maintain a versioned metric map and migration notes.

### 2. Authentication and permissions

The connector must verify and surface, by name only:

- Page Access Token availability;
- `pages_read_engagement`;
- `read_insights`;
- Page analyze access;
- Instagram insight permissions used by the active authentication model;
- token expiry or invalidation;
- app access level or review requirement where applicable.

Tokens remain server-side, encrypted and redacted from every response, log and screenshot.

### 3. Live metric discovery and parity

Before replacing any production metric definition, the connector must test candidate metrics individually against a real Page and exact calendar month.

For each candidate record:

- supported or unsupported;
- returned value;
- metric period;
- `values` or `total_value` response;
- required parameters;
- error code and subcode;
- safe trace ID;
- API version;
- token class.

The initial benchmark is Cape Lumber, using the exact June 2026 Business Suite date range and displayed figures. The desktop agent must compare:

1. Meta Business Suite.
2. Direct Graph API responses.
3. Supabase stored facts.
4. CG Dynamics admin preview.
5. CG Dynamics client-facing report.

Every displayed client number must be traceable backwards through those layers.

### 4. Fetch metrics independently

One unsupported metric must not cancel all supported metrics.

- Group only metrics that share compatible parameter requirements.
- Fall back to individual requests when necessary.
- Preserve successful values and record failures separately.
- Do not write a platform row merely because one unrelated field succeeded.

### 5. Date and timezone discipline

- Store the platform asset timezone.
- Request full calendar-month boundaries in the platform's expected format.
- Normalize reporting periods to the business reporting timezone, currently Africa/Johannesburg.
- Test `since`, `until` and daily `end_time` behaviour against Meta's documented rules.
- Record the exact request bounds on every sync run.
- Never compare a rolling 28-day UI value with a calendar-month API total.

### 6. Raw snapshots and normalized facts

The connector should persist a safe raw snapshot or source response reference before transforming data.

Recommended logical layers:

- `platform_sync_runs`: one operational record per connector execution.
- `platform_metric_snapshots`: source metric responses and provenance.
- `platform_metric_facts_daily`: normalized daily facts where available.
- `platform_metric_facts_monthly`: reproducible monthly facts built from snapshots/daily facts.
- `metric_registry`: canonical definitions and compatibility rules.

Existing tables may be migrated incrementally, but the permanent design must not overload `manual_platform_metrics` as the canonical home for automated API truth.

### 7. Idempotent re-sync and rollback window

- A completed month can be safely re-synced.
- Re-sync replaces or versions facts for the same source, asset, metric and period without duplicates.
- Recent periods are refreshed automatically because Meta may revise delayed metrics.
- Store previous snapshots or audit metadata when a source value changes materially.
- A failed re-sync must not destroy the last verified dataset.

Recommended schedule:

- regular current-period operational sync for internal visibility;
- completed-month finalization sync after month end;
- automatic rollback refresh of the recently completed month;
- explicit historical re-sync capability for repairs and metric migrations.

## Data-quality and connector-health engine

Each platform, client and month receives an internal quality state:

- `verified`;
- `verified_partial`;
- `not_comparable`;
- `sync_error`;
- `permission_blocked`;
- `reconnection_required`;
- `metric_migration_required`.

The engine checks:

- required metrics returned;
- values unexpectedly all zero;
- current value deviates abnormally from recent history;
- platform coverage changed between comparison periods;
- source definition changed;
- stale sync timestamp;
- token or permission failure;
- unsupported/deprecated metric response;
- UI/API parity test status.

A sudden loss of a metric is an integration incident, not a client performance result.

Reports with invalid comparisons or falsely complete combined totals must be blocked from publication until recalculated or clearly represented as partial.

## Client Overview strategy

The Overview must complement the actual data imported. It must not force all sources into one oversized number.

### Recommended information architecture

#### Brand visibility

Show the strongest verified visibility signals separately:

- Facebook media views;
- Facebook unique media viewers where supported;
- Instagram views;
- Instagram reach;
- platform-specific movement when comparable.

Do not sum unique audiences.

#### Audience response

- Facebook content interactions using the closest official supported account-level definition;
- Instagram total interactions;
- profile visits;
- follows gained during the period;
- current audience snapshots labelled separately.

#### Paid demand

- Google Ads impressions;
- clicks;
- spend;
- conversions;
- conversion value;
- campaign-level outcomes.

#### Commercial intent

Where verified and available:

- website clicks;
- messaging contacts;
- calls;
- forms;
- directions/local actions;
- tracked enquiries and sales outcomes.

### Overview narrative rules

The narrative should explain channel roles rather than invent a combined total. Example structure:

> Facebook delivered the largest verified visibility volume. Instagram improved audience response month on month. Google Search produced the clearest high-intent traffic. CG will therefore use social content to build product understanding and Google to capture active demand.

A narrative may be generated only from a verified evidence package.

## Strategy Intelligence evidence package

AI strategy must not receive raw database chaos.

The server prepares an approved evidence package containing:

- verified current-period metrics;
- only valid prior-period comparisons;
- metric definitions and limitations;
- eligible CG-created or CG-managed top content;
- excluded content as negative/admin context only;
- Google Ads campaign results;
- client objectives and approved knowledge;
- relevant industry and platform Skill Cards;
- previous strategy and implementation status;
- measured outcomes of previous recommendations.

The agent output must internally separate:

- observed fact;
- interpretation;
- strategic hypothesis;
- recommended action;
- platform choice;
- test design;
- success measure;
- assumption;
- confidence;
- supporting metric and Skill Card IDs.

Client-facing strategy remains human reviewed before publication.

## Cape Lumber pilot acceptance criteria

Cape Lumber is the first complete parity and strategy pilot because the client requests recurring reports and has both organic social and Google Ads activity.

The June 2026 report may be considered trustworthy only when:

- the exact Facebook Page and Instagram assets are confirmed;
- Meta Business Suite uses the exact June 1–30 calendar range;
- the API metric definitions and date boundaries are recorded;
- Facebook views/media views are imported automatically;
- Facebook unique viewers or the supported replacement are imported automatically when the API exposes them;
- Facebook content interactions use a documented supported definition or are clearly labelled reconstructed;
- Instagram figures remain separate and correctly defined;
- the Overview no longer labels Instagram-only visibility as all channels together;
- May-to-June percentages render only for comparable definitions;
- Google Ads is synced and mapped to Cape Lumber campaigns;
- every client-facing number has provenance;
- the client report and Business Suite are explainably aligned;
- strategy generation is withheld until the data-quality gate passes.

The current screenshots used as the investigation benchmark indicate approximate June Facebook Business Suite values of 17.0K views, 6.6K viewers, 769 content interactions and 3 follows. These are verification targets, not hardcoded production values.

## Cross-client acceptance criteria

Before claiming the connector is fixed globally, test:

- Cape Lumber;
- one Facebook-heavy client;
- one Instagram-heavy client;
- one client with both platforms;
- one client with legitimately zero activity;
- one client with a permission or disconnected-asset state.

For each, verify API response, stored fact, admin preview and client-facing output.

## Third-party connector policy

A mature connector such as Fivetran, Supermetrics or another established platform may be used during diagnosis to compare metric availability and architecture.

Permanent use requires an explicit decision covering:

- recurring cost;
- client/account limits;
- data ownership;
- metric parity;
- refresh latency;
- API version responsiveness;
- vendor lock-in;
- whether the connector can preserve the provenance and client isolation CG Dynamics requires.

The default remains direct API integration because CG Dynamics must connect performance, content, operations and specialist strategy in one controlled system.

## Desktop-agent implementation sequence

### Phase 1 — real-world parity investigation

- Authenticate in Microsoft Edge.
- Inspect Meta Business Suite and Meta Developers.
- Use Graph API Explorer, official Meta Postman requests and safe local scripts.
- Compare Business Suite, API, database and app.
- Identify exact working metrics, permissions, parameters and date rules.

### Phase 2 — connector repair

- Upgrade configurable API version.
- Implement supported Facebook Page metrics.
- stop writing unavailable values as zero;
- preserve raw snapshots and provenance;
- add per-metric error handling;
- add idempotent historical re-sync.

### Phase 3 — truth and comparability model

- Add or migrate the canonical metric registry.
- Add completeness and comparability states.
- repair affected historical months;
- block invalid comparisons;
- add connector-health monitoring.

### Phase 4 — client report correction

- Rebuild Overview from verified channel roles.
- remove unsafe all-channel totals;
- show platform-specific evidence cleanly;
- update source labels and data-health states;
- keep technical diagnostics admin-only.

### Phase 5 — Cape Lumber strategy pilot

- Sync Meta and Google Ads.
- curate CG-created top content;
- activate client and construction/timber Skill Cards;
- generate reviewed evidence-based strategy;
- present next campaign, rationale, channel choice, KPI and test plan.

## Definition of done

This strategy is complete only when:

- no automated connector stores unavailable metrics as zero;
- every client-facing metric has provenance;
- invalid month-on-month comparisons are impossible;
- Meta Business Suite parity is verified for Cape Lumber and representative clients;
- the Overview reflects the actual verified data available;
- re-sync and rollback behaviour is automatic;
- connector failures become internal alerts, not client performance claims;
- strategy generation uses only the approved evidence package;
- production deployment, re-sync and client-view verification have passed.

## Sources consulted

Primary and official sources:

- Meta, Get Page Insights: https://developers.facebook.com/docs/platforminsights/page
- Meta, Page Insights help: https://www.facebook.com/help/268680253165747/
- Meta, differences between Page views, reach and impressions: https://www.facebook.com/help/274400362581037/
- Meta official Facebook API Postman workspace: https://www.postman.com/meta/facebook/overview
- Meta official Instagram Insights Postman workspace: https://www.postman.com/meta/instagram/folder/23987686-f659d7d1-d74c-44e4-9192-9b1e8694c511

Established connector architecture references:

- Fivetran Facebook Pages connector setup: https://fivetran.com/docs/connectors/applications/facebook-pages/setup-guide
- Fivetran Facebook Pages changelog: https://fivetran.com/docs/connectors/applications/facebook-pages/changelog
- Fivetran sync and rollback architecture: https://fivetran.com/docs/core-concepts/syncoverview
- Fivetran historical re-sync: https://fivetran.com/docs/connectors/troubleshooting/re-sync-a-connector

These sources guide investigation and architecture. Exact production metric names must still be confirmed by current official Meta documentation and live API responses before implementation is declared complete.
