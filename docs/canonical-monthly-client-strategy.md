# Canonical monthly client strategy contract

Issue: #391

Migration: `20260917173138_canonical_monthly_client_strategy.sql`

Production status: prepared only; not applied

## Authority and coexistence

`monthly_client_strategies` is the canonical owner for one exact `client_id` and one explicit target `strategy_month` (stored as the first day of the month). The unique database constraint prevents two canonical strategies for the same client-month.

The strategy content remains the existing `StrategyData` version 1 shape from `src/lib/strategyEngine.ts`. GuidedStrategy can therefore edit the same fields without a parallel JSON contract.

`reports.strategy_data` remains historical report evidence. It is not migrated, re-keyed, or rewritten. The latest published report ending before the target month may seed a new monthly strategy, and `seeded_from_report_id` records that provenance. A report ending in or after the target month is rejected as seed evidence, removing the old “month N report contains month N+1 strategy” ambiguity from canonical ownership.

## Automatic baseline

`prepareMonthlyStrategySeed()` assembles a conservative draft from existing sources:

- exact active client and package configuration;
- the target month's `monthly_deliverables`;
- the previous canonical monthly strategy, or previous published report strategy when no canonical predecessor exists;
- incorporated exact-client context updates, including their reviewed body/decision content;
- bounded strategy-safe snippets from the exact client's runtime-ready guide (contact, freshness, unresolved-fact and guardrail sections are excluded);
- exact-client company calendar events;
- deterministic South African calendar moments from `src/lib/contentCalendar.ts`.

Calendar moments are all recorded as considered. At most three deterministic moments are selected when their suggested formats overlap the target month's real deliverables. Exact client events are selected; shoots/content runs are context only. Repeated seed calls never replace an existing client-month row.

The baseline prefers incorporated context, prior verified strategy evidence and approved guide signals. Every guide/update snippet actually used is recorded in `seed_context.intelligence_evidence`. When those richer authorities are absent, the draft names only the client and the deliverable mix already recorded for that month, plus an explicit instruction to confirm priorities before adding offers, events or campaign claims. It does not invent audience, promotion or product facts, and remains an unpublished staff-editable draft.

## Lifecycle and audit

All writes use guarded RPCs; authenticated roles have no direct table write grants.

1. `seed_monthly_client_strategy` creates only when the exact client-month is missing.
2. `amend_monthly_client_strategy` requires the expected version, records before/after JSON, returns the working copy to draft, and preserves the last published snapshot.
3. `transition_monthly_client_strategy` requires draft → approved → published.
4. Every transition writes an append-only `monthly_client_strategy_revisions` row with actor, exact client/month, version, before/after state, idempotency key, and durable receipt.

An authenticated browser call can act only as `auth.uid()`. A future service-role CG Assistant action must still supply an exact active staff actor plus exact client, month, expected version, and idempotency key. Fuzzy names are not accepted at this seam.

## Client projection

Publishing copies the existing `client_safe_strategy_data()` whitelist projection into `published_strategy_data`. The client RPC returns only the caller's linked client, exact requested month, safe strategy snapshot, and publication time. It does not return canonical/internal IDs, seed context, internal notes, draft AI metadata, actors, revisions, or unpublished work.

Staff amendments after publication do not silently alter the prior client snapshot. A later approved publish replaces it explicitly.

## Rollout

The migration creates schema/RPCs only and performs no backfill or production data mutation. Applying it to production requires a separate explicit CA approval. Existing report strategies continue to render before and after rollout.
