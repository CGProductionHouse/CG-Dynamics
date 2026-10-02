# #451 / #623 read-only rollout acceptance observer

This harness does not deploy, reconcile, sync, apply, repair, or invoke any Edge
handler (including `meta-connection-status`). Deployment authorization remains a
separate CA gate. No migration, dependency, credential, cron or config change.

## Run

Use Node 24 and this exact committed observer revision for both captures. An
existing privately provisioned `SUPABASE_ACCESS_TOKEN` with project database-read,
logs-read and functions-read access is required. Never paste it into commands,
receipts or GitHub. Missing access is a blocker, not permission to retrieve another
credential, create one, modify grants or fall back to a write-capable SQL endpoint.

Default `plan` is offline. The only capture requests are the fixed Supabase
Management API dedicated `/database/query/read-only` SELECT, aggregate logs GET
and function inventory GET. No retries or redirects; 30-second request bounds.
Schema absence, filtered RLS visibility, missing cron, invalid inventory/auth,
malformed envelopes or more than 20,000 rows in an evidence array stop capture.
No partial receipt is written. Existing files cannot be overwritten.

```powershell
node scripts/observe-freshness-rollout.mjs plan --from 2026-10-02T17:20:00Z --to 2026-10-02T17:30:00Z
node scripts/observe-freshness-rollout.mjs capture --phase pre --from 2026-10-02T17:20:00Z --to 2026-10-02T17:30:00Z --out C:/PrivateEvidence/freshness-pre.json
# AFTER separately authorized deployment and passive scheduler observation only:
node scripts/observe-freshness-rollout.mjs capture --phase post --from 2026-10-02T18:20:00Z --to 2026-10-02T18:30:00Z --out C:/PrivateEvidence/freshness-post.json
node scripts/observe-freshness-rollout.mjs compare --before C:/PrivateEvidence/freshness-pre.json --after C:/PrivateEvidence/freshness-post.json
```

Replace sample windows with actual closed UTC minute-aligned windows, 10–60
minutes long. Pre/post duration must match and windows must not overlap. Pin
receipt hash, source SHA, query hashes, DB observation clock, window, and the three
function versions/auth metadata. Hashes detect alteration, not independent signature
authenticity. Keep receipts private; publish only reviewed minimal summaries.
Windows bound logs/ticks/batch creation; DB evidence is its own single MVCC snapshot
at `observed_at`, not a historical DB reconstruction at the window end.

## Evidence and interpretation

- Microsoft: stored transition lifecycle; latest 20 jobs; all six sources of the newest job with counts,
  completeness/cursor/detail/error flags; linked apply runs, latest completed
  automatic run, and July manual applying identity/recovery metadata. APPLY must
  be terminal and exact-job-linked: fetch-only completion is not PASS. Raw upstream
  records are not returned. Completed/cancelled exact-ID cached mirror mismatches
  are evidence of unapplied stored truth, NOT a new live Microsoft read.
- Meta: dynamically discovered active exact-client mapped assets; checkpoints,
  monthly facts with original value/availability/source/age/run identity; recent
  or active durable items, safe classified errors, attempts, generation, cursor
  presence and cooldowns; window batches/actual item counts and minute-by-minute
  dispatch/batch creation. Existing terminal-backoff and canonical freshness
  helpers classify health. Independent assets stay independent. Missing values
  stay null. A blocked asset is not green; old facts remain identifiable.
- Runtime: aggregate HTTP 546/5xx and CPU-exceeded events for only the three
  rollout functions. Empty logs mean no observed events in that window, not
  runtime PASS. Cron dispatch success is not proof of handler completion or APPLY.
- Guards: full-row count/SHA-256 fingerprints of `monthly_deliverables`, native
  Planner, native Calendar, July manual runs, and each Microsoft plan (Client
  Schedule plan classified using existing authority). These prove only named
  scopes; they do not claim every unrelated production table was observed.
  No raw protected notes/content or credential fields are returned.
- Comparison: protected guards and scheduler identity/cadence/target/timeout;
  original complete/zero fact ages/values and checkpoint watermarks; age changes
  require matching exact-client/platform/month terminal platform-run evidence.
  It reports mismatches, never repairs them or emits blanket launch PASS.

## Passive post-rollout acceptance / stop conditions

Require six-source fetch AND exact automatic terminal APPLY, no new 546/CPU
recurrence, completed/cancelled mirror mismatches resolved, no adoption/change of
the July manual run and no protected Client Schedule/deliverable changes. Inspect
Meta blocked/healthy independence, bounded terminal cooldown, absence of doomed
per-minute bootstrap churn/empty batches, preserved verified facts/watermarks.
Compare later legitimate authenticated Integrations/Morning Ops wording to these
canonical receipts without calling a diagnostic status handler.

STOP on missing schema/access, new auth/function identity drift, protected guard
change, unexplained fact-age advance/regression, watermark regression, new CPU/546
failure, or terminal APPLY failure. Attribute normal concurrent staff edits before
drawing conclusions from guard differences. Record genuine STALE/PARTIAL/FAILED;
never manufacture PASS. Any rollback/deployment/reconciliation remains separately
protected and is not executable through this observer.

## Implementation-session evidence

The fixed SELECT and aggregate log query were exercised through authenticated
read-only Supabase tools; no Edge handlers or writes. The first SQL trial detected
duplicate historical mirror expansion above the guard limit; sources/mirrors were
then restricted to the newest job while preserving complete six-source coverage.
The 2026-10-02 17:20–17:30Z log window observed Microsoft 9 HTTP 546 and 20 CPU
events; worker 10 HTTP events / 0 HTTP 546. These are failures, not launch PASS.
The standalone CLI capture is blocked in this session by absence of a privately
provisioned `SUPABASE_ACCESS_TOKEN`; no credential fallback was attempted. No real
post-deployment receipt exists because deployment is not authorized in this lane.

Corrected SQL snapshot at 17:47:52Z: latest job `2f61bb61-3b27-416e-83f8-6b6cfa345e82`
complete, six complete sources / 7,509 fetched records (5,546 Client Schedule),
zero pending details; no automatic APPLY row. Legacy admin applying run
`1eb1aedc-e37e-4483-aab1-f0f3c3b29378` remains separate. Dynamic fleet: 42
assets, 66 checkpoints, 2,432 monthly facts, 373 platform runs; 10 window batches.
Protected counts: 3,654 monthly deliverables, 4,150 native Planner, 57 native
Calendar, 10 July manual runs. These are snapshot-specific evidence, not constants
in the observer. Lifecycle separately read back active; all required tables are
included in the final RLS visibility check.
