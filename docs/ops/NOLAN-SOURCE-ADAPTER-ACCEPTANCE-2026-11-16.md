# Nolan actual source adapters — 16 November 2026

Continues draft #990 from `ddf3bfa3bf25731d5eb2599180d43b86c645970c`.
Remote head and main `f89fefea70108bfe417953d00330476530aa9c4d` remained unchanged
through verification. No Control Centre search, alternate browser/host attempt,
production mutation, merge, deployment or PR-description edit.

## Genuine execution and bounded defect

The test bundles the **actual application modules** with esbuild, supplying only
the isolated URL/publishable-key definitions. It does not replace Supabase,
readers, auth or queries. The real shared Supabase instance signs in with GoTrue
password grants; actual modules issue JWT-backed PostgREST requests through the
same-origin fixture. No production environment files or copied sessions.

Readers exercised:

- `commandCentre.listTasks` and `listActiveClients`;
- `contentWorkflow.listStaffProfiles` and `listPipelineVideos`;
- `planner.listMonthlyDeliverablesByMonth`;
- `db/profiles.getProfile`, `nolanDecisionApi` and the candidate's new viewer check.

Fixture adds two explicitly synthetic clients, two monthly deliverables and two
linked pipeline ideas, alongside the existing synthetic task/profile/audit rows.
Exact UUIDs, `data_origin`, native task identity, ordered assignment, pipeline
client/deliverable identity and normalized month are asserted. No real client
identities were invented to make historical backfills pass.

Observed counts (task/staff directory/client directory/pipeline/monthly schedule):

| Signed-in profile | Counts | Interpretation |
| --- | --- | --- |
| Admin | 2 / 3 / 3 / 2 / 2 | All expected seeded source identities returned |
| Manager | 2 / 1 / 3 / 2 / 2 | Profile RLS exposes self only; another owner's name stays unavailable, never unassigned |
| Staff | 1 / 1 / 3 / 2 / 2 | Existing shared operational reads; Nolan manager/admin scope remains denied |
| Client | 0 / 0 / 1 / 0 / 0 | Own client only; no foreign task/video/schedule fixture disclosure |

No selection/identity/month-normalization defect was found in these five readers.
**A real deactivation boundary gap was reproduced:** after setting the synthetic
manager profile inactive, its existing session still read 2 / 1 / 3 / 2 / 2 rows
through the legacy source readers. Needs You RPCs correctly rejected that same
account immediately. The legacy role-based source policies do not independently
check `is_active` in this replay. This is not one of the eleven replay failures.

Bounded product repair: `withNolanVerifiedViewer` re-reads the current own profile
before **and after** the five-source refresh. Missing/error/foreign profile,
unknown or false active state, changed role, or local identity mismatch rejects
the refresh. `NolanOverview` then clears retained task/video/schedule/client/profile
data using its existing error path. Revocation during a read cannot publish its
returned rows. Restoration permits a new validated read. Open/focus/Refresh
perform this check; no instantaneous revocation subscription is claimed.

This is a **workbook display boundary**, not a replacement for server RLS. Direct
legacy API reads with an inactive existing session remain a separate release
security gate. No unrelated policy/migration or global AuthContext was changed,
and no server-side revocation fix is claimed.

Task-only source failure still retains explicitly stale rows while profile checks
succeed. Loss of profile verification clears the workbook instead of claiming
that stale data is still authorized. Recovery returns genuine current source rows.

## Replay scope

202/213 repository SQL files fully applied through the existing unchanged replay
helper. All five seeded source paths succeeded; none of the eleven known gaps
blocked these reads. Those gaps remain: two Storage-dependent files, seven
client-identity/FK-dependent historical files, one date/text publication-gate
failure, and one duplicate-source ordering failure. This does not certify every
write, publication path, client history or hosted extension. No legacy backfill,
SQL ordering, fake hosted service or unrelated migration was changed.

## Authored browser assertions — not executed

The existing normal-sandbox runner now includes:

- a genuine create RPC committed via `route.fetch`, followed by interruption of
  its response; frozen draft, exact retry key, same receipt and one displayed
  request are asserted;
- stale source revision at creation and at recipient response;
- profile deactivation with the existing signed-in session, rejected decision
  refresh, cleared Master data on Refresh, then restoration/recovery.

Private fixture controls exist only in the local test server. A fresh random
capability in the mode-0600 manifest authorizes a small fixed action list:
advance this run's synthetic decision source; deactivate/reactivate this run's
synthetic manager; fail/restore REST or task reads. They accept no arbitrary SQL,
record IDs or profiles. Missing capability and unknown operations are tested.
They do not inject an application session, change auth-user hashes, or grant any
production role. The capability is not compiled into the application or served
as a static asset. Browser credentials still enter the real login form.

No browser was launched. The authored additions are not browser or physical-device
acceptance. The approved normal-sandbox same-host browser requirement remains.

## Verification

Final affected command (no unchanged broad suite rerun):

```sh
RUN_NOLAN_SOURCE_API_TESTS=1 RUN_NOLAN_SAME_ORIGIN_TESTS=1 \
VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key \
node --test --test-concurrency=1 \
 tests/nolanSourceAdapterApi.test.mjs tests/nolanVerifiedViewer.test.mjs \
 tests/nolanSameOriginAcceptance.test.mjs tests/nolanSourceRead.test.mjs \
 tests/nolanReadContinuity.test.mjs tests/nolanOverview.test.mjs \
 tests/nolanReviewPreview.test.mjs
```

**35 passed, 0 failed, 0 skipped**, 96.06 seconds. Includes genuine service/API
execution, role negatives, exact provenance, task-only failure/stale recovery,
profile verification loss/recovery, revision rejection, idempotency and revoked
profile checks. Viewer unit tests also force revocation between awaited reads.
The original same-origin smoke and browser AST check remain green.

`npm run build` with the same port-1 synthetic environment passed: 446 modules,
Vite 6.94 seconds. Scoped ESLint and `git diff --check` pass; NolanOverview's
pre-existing set-state-in-effect lint exception remains explicit and unchanged.
Owned fixture containers were removed; no service remained after tests.

The delivered Library preview is unchanged. Its existing test harness only gained
a profile-reader adapter alias for compilation/contract regression coverage.
Production `NOLAN_DECISIONS_ACCEPTED` and Git deployment remain false.
