# Definer-route follow-up — isolated acceptance only

Continues PR #990 from `1cf32c172394de02f2c0d7a211ac575ff373686f`.
No production SQL, deployment, activation, merge/rebase, browser attempt or
PR-description update. `assistant_ownership_review_summary` belongs exclusively
to PR995 (`codex/retire-staff-ai-20261116`, initially `6b4b757f`, later observed `b7ae2749`); neither its body
nor shared AI/plugin files are edited here.

## Confirmed routes and narrowly proposed changes

All reproductions use genuine GoTrue password JWTs, unchanged across profile
deactivation/reactivation. The earlier source-table guard is applied **before**
the baseline tests, proving these are definer bypasses of that guard.

| Route | Locally reproduced inactive exposure | Proposed guard |
| --- | --- | --- |
| `get_or_create_content_guideline(uuid)` | Admin/manager/staff retrieve the exact synthetic guideline | Require current active profile before existing staff check |
| `reorder_content_guideline_videos(uuid,uuid[])` | Admin/manager/staff successfully execute an exact-video reorder | Same active precondition; retain exact membership/count checks |
| `set_content_guideline_publication(uuid,boolean)` | Admin/manager/staff successfully publish the synthetic document | Same active precondition; retain complete-script/publication rules |
| `client_portal_published_content_guidelines(uuid,date)` | All four inactive roles receive the synthetic published video projection | Require current active profile; retain staff versus own-client selection |
| `cg_staff_identity_candidates()` | All four inactive roles retrieve active targets' normalized identity forms | Check caller activation separately from target activation; preserve actual database service-role execution |
| `cg_derived_identity_forms(uuid)` | All four inactive roles retrieve another synthetic profile's derived forms | Require active caller; lock search path to empty |

The four Content Guideline routes and derived-identity route have EXECUTE for
postgres/authenticated only; no anon/service-role grant. The candidate-identity
route also has its existing service-role grant. All ACLs are asserted unchanged.
The service exception checks PostgreSQL's current `role` setting, not user
metadata or whether a service account happens to have a profile. A real local
`SET LOCAL ROLE service_role` query confirms unchanged candidate results;
this check is database-role acceptance, not a fabricated GoTrue service JWT.

Drafts `sql/nolan_content_definer_active.draft.sql` and
`sql/nolan_identity_definer_active.draft.sql` require the earlier source guard.
Both remain outside automatic migrations. They reject unexpected original RPC
bodies and accept their own guarded bodies for idempotent reapplication. No
global role helper, client-ID selection rule, assignment store, table grant,
service-only worker RPC or public-link capability contract changes.

Tests prove inactive Content Guideline calls reject with 403 and inactive
identity calls return no rows. Reactivation restores results with the same JWT.
Active staff can still create a guideline and retry idempotently; foreign-video
reordering is rejected; unpublication hides the document from the client;
republishing restores it. A client-supplied foreign client ID still resolves to
the caller's own client, and manager-to-client demotion immediately removes the
manager's write capability. Active identity results are compared as unordered
sets because these SQL functions promise no order.

## Broader inventory and explicit remaining scope

[Machine-readable inventory](NOLAN-DEFINER-ROUTE-INVENTORY-2026-11-16.json)
records all 106 public SECURITY DEFINER catalog entries with authenticated
EXECUTE and a body referencing the selected operational tables, including exact
arguments, ACLs and anon/service privileges. 3 are trigger functions, not
ordinary callable RPCs. Inventory membership alone is not proof of exposure.
An `is_active` string in a function body is not proof of caller authorization:
the identity-candidate defect demonstrates why.

Real inactive-manager probes verify nested denial through
`save_content_creative_source` → `can_edit_content_deliverable` and
`client_portal_post_assets` → the month-ahead post projection. Their bodies are
unchanged. Public capability reads and invitation bootstrap require their own
authorization contracts; no indiscriminate active-profile gate is added there.

This is **not system-wide revocation acceptance**. The inventory marks unexecuted
routes honestly. `apply_microsoft_sync_item`, `apply_content_run_debrief` and
AI-owned `assistant_update_video` remain separate mutation-audit targets, not
proven fixed here. PR995 owns the already-reproduced ownership-summary exposure.
Existing active-client access to normalized identity forms is preserved, not
endorsed as a new directory policy; changing that existing active-role contract
requires a separate least-privilege review. No hosted plugin session was tested.

## Runtime, verification and integration base

Same independent cached, pinned PostgreSQL 17.12 / GoTrue 2.197.0 / PostgREST14.18
fixture as the previous receipt: network-none database, shared isolated service
namespace, tmpfs, no published ports or production credentials. Canonical replay
still applies 202/213 files with the eleven bounded prior gaps. Synthetic Content
Runs/guidelines attach to exact fixture client/video identities only.

Commands:

```sh
RUN_NOLAN_SOURCE_POLICY_TESTS=1 node --test --test-concurrency=1 \
  tests/nolanContentDefinerAuth.test.mjs tests/nolanSourcePolicyAuth.test.mjs
RUN_NOLAN_SOURCE_POLICY_TESTS=1 node --test tests/nolanContentDefinerAuth.test.mjs
VITE_SUPABASE_URL=http://127.0.0.1:1 \
  VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key npm run build
```

The second command corrects only the test's assumption of stable identity-row
ordering; it does not weaken any authorization assertion. Final definer selection: **14 passed, 0 failed, 0 skipped** (42.103 seconds).
The existing source-policy selection independently passed all **14** checks
(49.123 seconds), giving 28 distinct affected checks after the ordering correction.
Build passed (Vite 9.60 seconds); scoped ESLint and `git diff --check` passed.
Logs: `/tmp/nolan-definer-complete.log`, `/tmp/nolan-definer-affected.log`,
`/tmp/nolan-definer-build.log`. The unchanged full suite is not rerun.

Handover reconciliation was prepared in detached worktree
`/tmp/nolan-integration-1c1bd36` based on exact main
`1c1bd36e486872b768d80cbffdf72ac33bacbd15`. The reconciled document equals main's
complete document plus this candidate's Nolan entries, preserving the new Novus/
January strategy entry verbatim. Only that resolved document was copied back;
no main code or AI branch was merged/rebased. The resulting candidate passed a
read-only `git merge-tree --write-tree` check against that exact base with no
conflicts. All owned database/Auth/API containers were removed after testing.

Rollout remains separately gated on target catalog/body/grant comparison,
dependency order and explicit database authorization. All activation/deployment
guards remain false. Pending same-origin browser/device acceptance is unchanged.
