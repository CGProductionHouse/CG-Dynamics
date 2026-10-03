# Microsoft automatic apply continuation — 3 October 2026

This receipt supersedes the initial #664 statement that terminal apply merely needed observation. Production v51 created the correctly attributed run, then hit CPU limits during unbounded item application. The observed run `36ecb850-0868-47e3-83fa-e91cebc813ed` had 1,185 durable item acknowledgements: 248 applied, 937 skipped, with 214 conflicts and 5,946 protected schedule exclusions. Source fetch remained 6/6 and 7,575 records. Never report fetch completion as apply PASS.

## Safety response and repair

Per the accepted rollout stop/rollback contract, restored the pre-repair v50 source/config as inventory v52. Complete source readback: original EZBR `60c3002158e4c39bc92bd263961f3c927af951f138def94a627e9ecf77b360ce`, JWT=true, original root map, zero source mismatches. No data rollback, manual job trigger, cron/secret/provider change or upstream Microsoft write. Rollback alone does not repair freshness.

New automatic-only repair bounds each invocation to 200 pending mirror items. Existing canonical `microsoft_sync_run_items` receipts provide applied/skipped totals and exact source item keys, avoiding replay work and duplicate application. Reads paginate; read failure or successful transport without durable acknowledgement never becomes verified success.

Normal yields persist a `continuationReady` marker, pending count and truthful durable totals in the existing run summary. The next existing scheduler cycle claims the exact run/job/agent/status/recovery-generation/summary through one atomic compare-and-set, then resumes the same run. The marker is cleared under a fresh lease before executing anything. Concurrent ticks cannot acquire the same handoff. Manual/terminal/foreign job/changed generation/changed summary holds are rejected. No second queue, scheduler, schema, RPC, permission or source authority is introduced.

Deliberate continuation does not consume the existing three-attempt crashed recovery budget. Actual crashes still use the existing ten-minute leased service RPC and generation fencing; successful receipts survive. Inner failures terminalize failed/partial with remaining work stated, rather than an infinite yield. Conflicts remain partial; no automatic staff-overwrite or protected Client Schedule work is introduced.

## Executable evidence

Production-sized fixture: 7,500 records, 5,500 Client Schedule; all six source counts retained. 1,650 writable mirrors complete in nine passes, each <=200 calls, exactly 1,650 unique durable audit keys and no replay calls; crash recovery count stays zero for normal yields. A simulated crash/replay preserves attribution, completed tasks become done, cancellation remains safe, protected schedule writes are forbidden. Additional tests cover concurrent claim denial, foreign/manual/terminal/mutated handoffs, unreadable receipts, failed passes with unprocessed count, and transport success without audit evidence.

## Post-rollout acceptance

Read the exact existing agent run and source/item acknowledgements, not a manual handler. Require terminal status and real totals, no new CPU/546 recurrence, original July manual identity intact, unchanged protected schedule/native fingerprints, completed/cancelled mirrors reconciled, and no duplicate durable keys. A partial conflict outcome remains partial. Meta workerv38/statusv44 are unaffected; Red Oak owner permission cooldown remains truthful. Any source/JWT/map mismatch, duplicate/fencing/protected-row mutation or CPU recurrence stops the sequence and invokes only the accepted rollback boundary.

No Microsoft writes occurred.
