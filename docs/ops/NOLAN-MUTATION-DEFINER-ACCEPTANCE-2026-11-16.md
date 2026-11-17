# Two high-risk mutation routes — isolated acceptance

Continues PR #990 from `af179815f1c5c1ebc3b63c14ffdc565aa7f703fd`.
Main remained `1c1bd36e486872b768d80cbffdf72ac33bacbd15` during verification;
PR995 remained `b7ae2749d1f1d7d1f32ff69e399a0cb1d445979c` and exclusively owns
`assistant_ownership_review_summary`. That function and shared AI/UI/plugin
files are unchanged. No production application, activation, deployment, merge,
browser attempt, external connector send or PR-description update.

## Exact before/after behavior

All earlier Nolan source/content/identity drafts are applied to the isolated
canonical replay **before** reproduction. Four genuine GoTrue password sessions
retain their original JWTs across profile deactivation, reactivation and role
changes. Only bounded generated synthetic identities/records are used.

| RPC | Confirmed before new draft | After new draft |
| --- | --- | --- |
| `assistant_update_video` | Inactive admin, manager and staff change the exact video's production status/note and append a Planner activity audit | Inactive admin/manager/staff/client receive 403 before any video or audit change |
| `apply_microsoft_sync_item` | Inactive admin changes exact Planner and monthly-deliverable titles, associates the isolated run and appends sync-ledger items | All inactive roles receive 403 before any source or ledger change |

Active client video mutation is denied. Active manager/staff/client sync mutation
is denied. Reactivation restores the original authorized behavior with the same
token. Demoting admin to manager immediately denies sync mutation with that old
token. Denial tests compare complete captured source timestamps/values and
audit/ledger counts, rather than treating an error response alone as proof.

`sql/nolan_mutation_definer_active.draft.sql` adds only a fully qualified
active-caller precondition to these two SECURITY DEFINER bodies. It requires
the earlier source-active helper, checks exact original/guarded body hashes and
is transactionally idempotent. No global helper or original staff/admin, client,
source identity, status, input, CAS or retry check is replaced. Both RPCs retain
their existing postgres/authenticated EXECUTE ACLs; anon and service_role remain
denied. Catalog tests assert all other inventoried definer bodies unchanged,
including the separately owned ownership-summary function.

## Side effects and valid behavior checked

Source inspection precedes execution. Video actions update canonical
`content_guide_ideas` and append `planner_activity_log`; moving to next month
clears the old deliverable link, resets production status and records the note.
Those active-staff behaviors remain executable; unsupported actions and a run
without the exact guideline reject without side effects.

The sync function reads/locks its settings and an `applying` run, updates the
selected destination with optimistic revision checks, then records an item.
The fixture alone creates one synthetic run and sets its local transition flag
active. No Microsoft connection, snapshot fetch, upstream write or external
send occurs. The existing PostgreSQL triggers run normally; no trigger or RLS
is disabled. The runtime has no external network or host-published ports.

Active admin updates both Planner and Client Schedule successfully. Reusing the
same run/item key makes no second source or ledger change. A stale expected
timestamp rejects and rolls back; paused transition state rejects. These checks
preserve the valid database-facing plugin/app contract without claiming hosted
plugin or service-session acceptance. These RPCs have no service-role grant to
preserve as an authorized execution path; this patch does not add one.

**Separate existing behavior:** both sync update branches return JSON `null`
despite successful source/ledger writes. The body assigns `result_id` through a
missing-ledger SELECT before an update, which can clear the supplied destination
ID; the update branches do not repopulate it. This was observed before and after
the guard and is not changed in this revocation-only tranche. Actual source
identity is verified from the fixture records; do not claim the returned UUID
or ledger destination proves that identity.

## Evidence and remaining limits

Runtime is the same cached official pinned PostgreSQL 17.12, GoTrue 2.197.0 and
PostgREST14.18 fixture: network-none/tmpfs database and shared isolated service
namespace, no exposed ports or production credentials. Canonical replay remains
202/213 files with the same eleven bounded gaps.

```sh
# Establish persisted bypasses before creating the proposed guard:
RUN_NOLAN_SOURCE_POLICY_TESTS=1 node --test tests/nolanMutationDefinerAuth.test.mjs
# Full before/after regression, including idempotent draft application:
RUN_NOLAN_SOURCE_POLICY_TESTS=1 RUN_NOLAN_MUTATION_DRAFT=1 \
  node --test tests/nolanMutationDefinerAuth.test.mjs
VITE_SUPABASE_URL=http://127.0.0.1:1 \
  VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key npm run build
```

Baseline: **4 passed, 0 failed/skipped**, 31.113 seconds. Full guarded selection:
**11 passed, 0 failed/skipped**, 40.947 seconds. Build passed (Vite 8.84 seconds),
scoped ESLint and `git diff --check` passed; owned containers were removed.
Logs: `/tmp/nolan-mutation-baseline.log`, `/tmp/nolan-mutation-guarded.log`,
`/tmp/nolan-mutation-build.log`. Unchanged broad suites were not rerun.

This closes two confirmed entry-point bypasses in an **unapplied proposal**, not
whole-system revocation. The sync create and CG Calendar branches were not
executed; their bodies remain unchanged behind the new common precondition.
`apply_content_run_debrief` remains the next identified unexecuted high-impact
mutation in the [106-entry inventory](NOLAN-DEFINER-ROUTE-INVENTORY-2026-11-16.json).
Other entries retain their explicit prior/unexecuted classification. PR995's
ownership-summary fix is not imported or claimed as applied here.
Revocation is tested between requests; concurrent deactivation of an already
running transaction and queued worker execution are not accepted by this test.

Rollout still requires explicit production authorization, target catalog/grant/
body verification and dependency ordering. No SQL is added to automatic
migrations. Both application activation and Git deployment guards remain false;
same-origin browser and physical-device gates remain unexecuted.
