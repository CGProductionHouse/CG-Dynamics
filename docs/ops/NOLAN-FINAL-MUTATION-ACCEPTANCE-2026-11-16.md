# Final bounded mutation tranche — isolated evidence

Continues PR #990 from `832c0ccc297f0c0ee3e31f9bb5d36e46af51986c`.
No production database application, activation, deployment, merge, browser retry,
external connector send or PR-description edit. PR995 owns its separate
ownership-summary/model-free plugin work and is untouched.

## Debrief mutation

With all earlier Nolan drafts applied, genuine retained GoTrue JWTs for an
inactive admin, manager and author staff member still applied a synthetic
`apply_content_run_debrief`: video production note/status changed and the
debrief became `applied`. The new **unapplied**
`sql/nolan_debrief_active.draft.sql` adds only the current-active-profile
precondition before the existing staff/author/manager checks. Body hashes reject
unexpected target implementations; reapplication is idempotent. Original
postgres/authenticated execution grants are preserved; anon/service_role remain
denied. All other inventoried definer bodies are asserted unchanged.

After the draft, all four inactive roles receive 403 with no captured source,
audit, ledger or debrief changes. Active admin/manager and author staff still
apply successfully. Active client and non-author staff are denied. A repeated
already-finalized debrief is rejected without a second write. A two-action list
first changes the own video, then references the foreign guideline's video:
the second action raises and **the entire first action and finalization roll
back**. A subsequent valid retry succeeds. No fake transcript/provider call or
real client data is used: the fixture transcript is explicitly synthetic.

## Sync creation and Calendar coverage

Actual JWT calls to the already-guarded `apply_microsoft_sync_item` now execute:

- Planner create with the exact generated board/client identities and required
  synthetic `import_hash`;
- Client Schedule create with the exact client, November month, video code and
  second instance; no duplicate schedule authority;
- Calendar create for a distinct internal event with exact synthetic client/
  Outlook identifiers, remaining `client_visible=false`;
- Calendar update with expected revision, stale-revision rejection and pause
  rejection.

Each create returns a UUID and matching ledger destination ID, verified by an
active-admin API read of the actual table. Repeating each item key does not add
a destination or ledger item. All four inactive roles are denied across the
three creates and Calendar update; active manager/staff/client are likewise
denied. Complete captured counts/rows remain unchanged on rejection. Existing
active-role checks and execution grants are unchanged; no service-role grant,
hosted plugin call or Microsoft send is introduced.

The previously characterized **update** return/ledger destination `null` remains
unchanged, including Calendar update. Exact update effects are verified from
the known destination record, not inferred from that null reply. This tranche
does not opportunistically repair the separate return-value defect.

## Deterministic revocation boundary

`revocationBarrier` exists only in the isolated Node fixture, never the browser
manifest or scenario HTTP endpoint. A real PostgreSQL holder transaction locks
the exact Content Run, sync settings row or debrief row and makes an uncommitted
profile deactivation. A second session is the **actual JWT-backed PostgREST
mutation**, not SQL impersonation. The observer waits until `pg_stat_activity`
reports `wait_event_type='Lock'` and `pg_blocking_pids` identifies that precise
holder PID; only then does the holder commit. There are no timing sleeps or
mock race outcomes. Deadlines limit failures; `setImmediate` yields during
condition polling. Failure cleanup rolls back/releases the holder.

Observed for video update, sync update and debrief:

1. The RPC sees the previously committed active profile, passes its guard and
   blocks on the existing source lock.
2. The holder commits revocation and releases the lock.
3. The already-authorized mutation completes once, with its expected source/
   audit/ledger effects.
4. A fresh request dispatched after that confirmed commit returns 403 and adds
   no effect, even when it reuses the same JWT and request payload.

A fourth barrier takes an **isolated-fixture-only** ACCESS EXCLUSIVE profile-table
lock, delaying the authorization read itself. The already-started sync statement
still returns 200 after the holder commits revocation: its STABLE profile helper
uses the statement's pre-revocation visibility snapshot. A fresh request after
commit returns 403. This explicitly disproves a wall-clock promise that a commit
before the authorization read finishes must cancel an older statement.

**Accepted transaction semantics:** revocation governs a new RPC whose database
authorization snapshot is obtained after the revocation commit. An already
running statement with an older snapshot may finish, whether it is waiting
before or after the profile read. No production locking, global serialization,
in-flight cancellation or reversal of committed writes is added or promised.
Stronger revocation semantics would require a separately reviewed contract;
this receipt does not silently claim them.

## Results, integration and limits

Functional commit `dcf24f98098b5da0fc1c2ef217588989fd26a556`: **12 passed,
0 failed, 0 skipped**, 47.105 seconds. Local application build passed (Vite
7.55 seconds); scoped ESLint and diff checks passed.

Final synthetic effects are asserted: **three sync-created records, six ledger
items, eight applied/two draft debriefs, one video activity audit**. The six
ledger items comprise three creates, Calendar update and two deliberate
in-flight/snapshot probes. Failed/repeated requests add none. Calendar remains
separate from Client Schedule.

```sh
RUN_NOLAN_SOURCE_POLICY_TESTS=1 RUN_NOLAN_FINAL_DRAFT=1 \
  node --test tests/nolanFinalMutationAuth.test.mjs
VITE_SUPABASE_URL=http://127.0.0.1:1 \
  VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key npm run build
```

Runtime remains the cached official pinned PostgreSQL17.12/GoTrue2.197.0/
PostgREST14.18 fixture, network-none database with tmpfs and no published ports.
Canonical replay remains 202/213 files with the eleven disclosed prior gaps.
The first creation probe correctly rejected a fixture missing required
`import_hash`; the fixture payload was corrected, no schema constraint weakened.
The unchanged broad suite is not rerun. Browser/device acceptance stays open.

Main advanced to `62f7a88ad961468697bd24aecd48132bc38d1450`. The separate detached
worktree `/tmp/nolan-integration-62f7a88` preserves main's complete handover plus
the candidate's Nolan entries; no main or PR995 code is merged/rebased. PR995
was observed at `97c9eca443259ddbc23eb1fb53afb98b31e9cec2` during final checks.
Git HTTPS credentials became unavailable; the connected GitHub tool verifies
heads and can publish the exact tested tree with an expected-head lease. This
does not retry or edit the denied PR description.

The [106-entry inventory](NOLAN-DEFINER-ROUTE-INVENTORY-2026-11-16.json) retains
explicit unexecuted routes; it is not whole-system revocation acceptance. No new
route is added to this final tranche. Both production activation/deployment
guards remain false. Production rollout still needs explicit authorization,
target catalog/grant/body verification and dependency ordering.
