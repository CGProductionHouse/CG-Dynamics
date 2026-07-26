# Microsoft preview — durable, resumable job

Last updated: 2026-07-26

## Problem

The single `microsoft-transition-sync` `fetch` request fetched Outlook **plus all
six Planner plans** — including the 4,306-task `2025 CLIENTS SCHEDULE` — in one
call, and timed out. The date range only bounded Outlook; Planner sources were
always fetched in full.

## Fix — a durable server-side job (no browser timeout, no hidden error)

- **Schema** (`phase-28a`): `microsoft_sync_jobs` + `microsoft_sync_job_sources`.
  Each configured source is a row with a bounded stage machine
  `queued → fetching_tasks → fetching_details → complete | failed`, persisting its
  records and a `pending_detail_ids` cursor. Admin-only RLS.
- **`job-machine.ts`** (pure, unit-tested): source enumeration, bounded detail
  batching (`DETAIL_BATCH_SIZE = 300`), progress, the completeness/apply gate, and
  snapshot assembly.
- **Edge Function actions**: `job_start`, `job_process`, `job_status`,
  `job_result`, `job_retry`, `job_latest`. Every `job_process` claims one source
  and does exactly **one bounded unit** (that source's tasks+buckets, or a single
  300-id detail batch), then returns — so no invocation approaches the Edge time
  limit even for a 4,000-task plan. The one-shot `fetch` action is retired (410).
- **Admin page**: starts a job, polls + drives per-source progress (queued /
  fetching / complete / failed with record counts and safe errors), can leave and
  return (`job_latest` resumes), and can **retry only failed sources**. The
  reconciliation preview is assembled and Apply is enabled **only when every
  required source completes** (`job_result` 409s otherwise).

## Preserved

The reconciliation engine, source registry (incl. `2025 CLIENTS SCHEDULE`),
pagination, conflict rules, completeness safeguards, and the one-way Microsoft
boundary — **fetch only, never a writeback** — are all unchanged.

## Verification

- Pure job state machine + snapshot assembly: `tests/microsoftDurableJob.test.mjs`
  (6 tests) — enumeration, bounded batching (4,306 tasks → 15 batches), pick order,
  completeness gate, apply blocked while incomplete, ordered assembly.
- `2025 CLIENTS SCHEDULE` / The Staffy reconciliation correctness:
  `tests/microsoftStaffySchedule.test.mjs` (from the prior fix).
- Full suite **544 pass**, build clean, function deployed (v19, `verify_jwt`,
  401 without auth).

## Remaining live step (credential boundary)

Running the **real production preview** requires the Microsoft Graph application
credentials exercised via an **authenticated admin** call — secrets this agent
must not handle and cannot invoke. A CG admin opens Client Schedule → Microsoft
sync → **Preview latest changes**: the job now fetches all six sources in
batches; each source shows its progress; on completion the reconciliation preview
appears (with The Staffy's July/August deliverables from `2025 CLIENTS SCHEDULE`),
and Apply unlocks. Failed sources can be retried without restarting.
