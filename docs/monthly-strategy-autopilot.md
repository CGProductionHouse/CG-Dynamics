# Monthly Strategy Autopilot (#463)

This is the automatic preparation lane for the canonical #391 monthly strategy.
It does not add a strategy store or a scheduler.

## Contract

- `monthly_client_strategies` remains the only monthly strategy authority.
- One pass scans every active client with real pagination and targets the current
  Johannesburg operating month plus the next month.
- The pass first checks the exact `client_id + strategy_month`. If a row exists,
  it is left untouched. This includes staff-amended, approved and published rows.
- New rows are written only through `seed_monthly_client_strategy`. The #391 RPC
  provides the transaction lock, unique ownership, draft status, revision receipt,
  staff-system actor check and idempotent replay behavior.
- Seeds use only exact-client or approved shared sources: prior canonical strategy,
  prior published report/posts, reviewed client guide/context, confirmed package and
  Client Schedule, exact-client CG Calendar events, the canonical SA content calendar,
  and active governed Marketing Library cards.
- Missing package or deliverable truth produces `PACKAGE_UNVERIFIED`; it never
  causes invented scope.
- The client projection remains unchanged and published-only.

## Content Guideline alignment

The existing #450 suggestion flow now reads bounded canonical monthly strategy
context for the exact client and requested coverage months. It remains the same
Content Guideline system and does not overwrite saved guideline videos or create
a circular generation path.

## Deferred activation handoff

`monthly-strategy-autopilot` is an internal-token-only Edge Function prepared for
the existing daily operating cycle. Agent 01 owns the shared worker and production
activation lane. After this PR is accepted, that lane may add one call before the
existing Content Autopilot step. That later action requires the already-defined
`WORKER_INTERNAL_TOKEN` and auth-backed `WORKER_SYSTEM_PROFILE_ID`.

This PR does **not** modify `background-worker`, cron/scheduler configuration,
Microsoft/Meta sync, secrets, production data, or deployed functions.
