# Microsoft apply recovery - 28 July 2026

## Incident

The completed durable preview job was:

- Job: `4d1a57b5-2cb1-43f5-b07a-ce2de9a27a0a`
- Exported: 27 July 2026 20:17 SAST
- Sources: 6/6 complete
- Records: 6,298
- Reviewed executable actions: 32
- Conflicts excluded: 1,775

The 32-button count was correct: 15 creates, 3 updates and 14 completion
transitions. Run history displayed only create/update preview counts, which is
why the screen appeared to account for only 18 actions.

## Exact production sequence

The first apply was run `dde6506f-79c6-4091-9905-41f15a5aaf66`:

- status: `partial`;
- 27 applied;
- 5 failed;
- 6,266 unchanged/conflict/skipped audit rows;
- all 1,775 conflicts remained untouched.

The 27 successful actions were:

- 5 CG Calendar creates;
- 5 Planner creates;
- 5 Client Schedule creates;
- 3 Client Schedule updates;
- 9 Client Schedule completion transitions.

The five failures were Planner completion transitions for:

- `END OF DAY UPDATE - DAILY`;
- `TIKTOK POST`;
- `VIDEO - STANDARD`;
- `VIDEO - SHORT FORM`;
- `F - STUDIO (CLIENT PHOTOS)`.

Production still had the original five-state `planner_tasks_status_check`, which
did not permit `done`. The current Microsoft mapper correctly maps a linked
100%-complete operational task to `done`, so all five transactions were rejected
without modifying their destination rows.

The user then ran the same reviewed snapshot again on 28 July at 09:12 SAST.
That run was `40fde14d-1a04-40ff-a08b-678562aa5712`:

- status: `failed`;
- 0 applied;
- 32 failed;
- 1,775 conflicts remained untouched.

It replayed stale actions instead of rebuilding against current CG data. The 27
already-applied actions were rejected by source-key/natural-key uniqueness or
the destination `updated_at` guard. The original five Planner completions failed
again on the same status constraint. The second run made no destination writes.

## Recovery design

Migration `20260728123000_microsoft_apply_recovery.sql`:

- repairs the Planner operational status constraint to the phase-16a contract;
- links runs to their persisted durable preview job;
- stores stable identities for the exact reviewed executable actions;
- backfills the two historical runs from their audit ledgers;
- retains existing admin-only RLS;
- does not store Microsoft credentials or new raw payload copies.

The admin page restores the persisted preview job without fetching Microsoft,
reconciles it against current canonical rows, and then:

- recognises the 27 matching rows as previously applied;
- offers only the five unapplied Planner completions for retry;
- blocks any action whose classification changed;
- blocks any destination with a newer CG-owned edit;
- leaves all 1,775 conflicts excluded;
- preserves removal approval only when it was explicitly recorded by the new
  flow (legacy failed removals fail closed);
- processes only executable reviewed actions through the existing per-item
  transactional apply RPC.

The Edge Function now keeps a preview job's `exported_at` immutable when its
stored result is read again. Microsoft remains read-only throughout.

## Production recovery verification

Migration `20260728123000` and Edge Function version 20 were deployed before
the recovery. The frontend was exercised through the protected Vercel preview
for commit `2698390` with an authenticated production admin session.

At 13:40 SAST, the failed run reconstructed the exact reviewed plan before any
write:

- 27 previously applied;
- 5 retryable now;
- 0 not attempted;
- 1,775 conflicts untouched.

Recovery run `cc435d92-26bb-46d2-9620-e8575219422d` then completed with:

- 5 applied now;
- 27 previously applied;
- 0 still failed;
- 1,775 conflicts untouched;
- retry link to failed run `40fde14d-1a04-40ff-a08b-678562aa5712`;
- preview link to job `4d1a57b5-2cb1-43f5-b07a-ce2de9a27a0a` and its original
  `2026-07-27T18:17:16.665Z` export timestamp.

An authenticated read through production RLS confirmed five reviewed audit
rows, all `complete`, all `applied`, all targeting Planner, with no safe errors.
The five canonical Planner tasks now have status `done`. The run contained no
create, update, Client Schedule, CG Calendar or Content Run action, so recovery
could not duplicate or modify those previously successful destinations.

Authenticated browser checks confirmed:

- the failed and partial history counts rendered correctly;
- the recovery panel listed only the exact five failed titles;
- the successful result rendered the recovery run ID and final counts;
- all five tasks appeared as `Done` in their Planner history boards;
- Planner loaded at desktop and mobile widths without page-level horizontal
  overflow;
- the recovery apply produced no failed HTTP responses.

The database and Edge Function are deployed. Merge and production frontend
deployment of commit `2698390` remain required to expose the recovery controls
outside the protected preview.

No reconciliation history is deleted.
