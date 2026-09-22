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

## Shared-worker integration

`monthly-strategy-autopilot` is an internal-token-only Edge Function prepared for
the existing daily operating cycle. The shared worker now enqueues one durable job
per Johannesburg operating date with the idempotency key
`monthly-strategy-autopilot:YYYY-MM-DD`. The existing queue's three-attempt recovery
contract remains the bounded retry authority.

The strategy job is scheduled before daily Content Autopilot. Content Autopilot is
withheld until that exact daily strategy job has succeeded, so concurrent minute
ticks cannot let content preparation overtake strategy preparation. The three
Content Autopilot feature flags remain unchanged and off in production.

This integration reuses the existing cron, `WORKER_INTERNAL_TOKEN` and auth-backed
`WORKER_SYSTEM_PROFILE_ID`. It adds no scheduler, schema, migration or strategy
store. Deploying `monthly-strategy-autopilot` and the updated `background-worker`
remains a separate protected production gate.
