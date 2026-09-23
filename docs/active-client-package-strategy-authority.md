# Active-client package and strategy authority

Issue: #494

Migration: `20260923110000_active_client_package_strategy_authority.sql`

Production status: prepared only; not applied

## Package authority

`clients.package_settings` remains the package-settings authority. No second package store is introduced. Existing `client_packages`, package templates and `monthly_deliverables` remain useful schedule and production evidence, but they do not silently establish contractual scope.

A package is authoritative only when every numeric and boolean field is explicitly present and the JSON contains a server-authored version 1 `verification` receipt. Explicit zero is valid. Missing, malformed, legacy partial and old zero-placeholder JSON remains unverified.

`confirm_client_package_settings` is the only application path that creates that receipt. It:

- requires an active admin and an exact active client UUID;
- validates every package value without defaulting blanks;
- records evidence, retained inference/uncertainty, source references, actor and timestamp;
- updates the existing `clients.package_settings` JSON atomically;
- appends before/after evidence to the existing `planner_activity_log`.

Direct package edits remain backwards compatible but automatically remove verification, so changed scope must be explicitly reconfirmed. Inactive clients cannot be confirmed and the Clients screen defaults to the active-client queue.

## Strategy authority

`monthly_client_strategies` remains the only monthly strategy store. Manual preparation and Monthly Strategy Autopilot now fail closed before seeding when either the package is unverified or no exact-client intelligence/previous-work evidence exists. Client Schedule counts are execution evidence, not package inference.

Seed provenance records the package confirmation timestamp/actor/sources, exact guide/context/report/post/deliverable IDs, and only approved active unexpired Marketing Library cards routed to the marketing strategist or content planner. Automatic drafts remain drafts and never overwrite existing client-month rows.

The strategy JSON version remains 1 and now defensively supports a `goldStandard` section covering objective, audience/intent, message, format rationale, tests/changes, pillars/hooks, avoidances, channel integration, success signals and the package-bounded game plan. Approval is rejected when any section is absent, merely generic, lacks exact-client provenance, or the live package is not confirmed. Existing staff amendments, approval and publication actions remain separate.

## Activation gate

The migration is not applied by this PR. After supervisor acceptance, production application requires separate CA approval. Existing active clients then remain unverified until reviewed one by one; there is deliberately no bulk backfill or automatic confirmation.
