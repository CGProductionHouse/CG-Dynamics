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

To be completed after migration, Edge Function and frontend deployment:

- recovery run ID;
- applied now / previously applied / still failed counts;
- duplicate checks across Planner, Client Schedule and CG Calendar;
- Content Run/calendar linkage checks;
- authenticated desktop/mobile browser checks.

No reconciliation history is deleted.
