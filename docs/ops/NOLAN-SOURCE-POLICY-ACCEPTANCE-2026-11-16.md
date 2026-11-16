# Nolan source authorization draft — 16 November 2026

Continues PR #990 from `81cc5ac876b79b37b337fd1097fd6933ea9c0b3d`.
Remote branch remained at that head before commit. Main advanced from `f89fefe`
to `1c1bd36e486872b768d80cbffdf72ac33bacbd15`; its strategy/MCP changes were
inspected read-only and left untouched. No merge/rebase was performed. The
GitHub PR metadata read returned HTTP Forbidden; Git remote refs were verified.
This is an isolated reproduction and proposed server-side repair, **not evidence
of production exploitation or an applied production fix**. No live credentials,
data, migrations, deployment, merge or PR-description update were used.

## Reproduced exposure

Genuine GoTrue password sign-ins issued four JWTs. The tests retained those exact
tokens while the isolated database changed profile activation and role. Before
the draft, active and inactive callers returned identical counts:

| Source | Admin | Manager | Staff | Client |
| --- | ---: | ---: | ---: | ---: |
| Command Centre tasks | 1 | 1 | 0 | 0 |
| Planner tasks / canonical view / assignments, each | 1 | 1 | 1 | 0 |
| Planner activity | 2 | 2 | 2 | 0 |
| Planner boards | 6 | 5 | 5 | 0 |
| Planner buckets | 31 | 24 | 24 | 0 |
| Clients | 3 | 3 | 3 | 1 |
| Client aliases | 2 | 2 | 2 | 0 |
| Pipeline ideas | 2 | 2 | 2 | 0 |
| Monthly deliverables | 2 | 2 | 2 | 0 |
| Profiles, including self | 4 | 1 | 1 | 1 |

The legacy `is_staff`, `is_manager`, `is_admin` and `my_client_id` helpers consult
current profiles but omit activation. Permissive policies OR those predicates
with ownership branches. An inactive manager also successfully inserted a
synthetic task and called both `update_command_centre_task_status` and
`admin_set_package_classification`, receiving the task row. An inactive admin
could PATCH its own profile back to active. These are actual local API results.

## Bounded proposed fix

`sql/nolan_source_active_reads.draft.sql` remains outside automatic migrations.
It adds a stable SECURITY DEFINER boolean helper, owned by postgres, with
`search_path=pg_catalog`, fully qualified relations/functions and authenticated
execution only. Missing identity/profile returns false. It reads the caller's
current profile, not a role or activation claim in the JWT, and avoids profile
RLS recursion. Database service roles are not treated as user profiles.

Ten restrictive ALL policies protect the source tables above (excluding the
view and profiles). They AND the original permissive-policy result and enforce
both USING and WITH CHECK; they do not grant any new read or write capability.
Profiles receive restrictive SELECT with a self-read exception, plus separate
active-only INSERT/UPDATE/DELETE guards. This preserves revocation detection
without allowing an inactive admin to reactivate itself. Original permissive
policies are asserted byte-for-byte unchanged in the catalog.

The two Command Centre mutation RPCs receive an active-caller precondition;
existing role, assignment, status, same-client and duplicate-link rules remain.
The draft refuses unexpected prior RPC bodies rather than replacing newer
implementations. It refuses a missing RLS table or a canonical Planner view
without `security_invoker=true`. Reapplication is tested.

After applying the draft, every tested source returns zero rows to an inactive
caller except its own profile. Active counts remain exactly as above. The
manager's profile directory remains self-only. The client still sees its exact
own client and no foreign client. Admin-to-manager/staff/client role changes
take effect with the original JWT. Reactivation restores existing visibility.

The actual SDK module regression returns inactive manager counts **0 / 1 / 0 /
0 / 0** (task/staff/client/pipeline/monthly), versus **2 / 1 / 3 / 2 / 2** before.
The one retained profile is the caller's own revocation record. Existing workbook
authorization checks continue to reject and clear its displayed data.

## Equivalent routes and remaining boundary

Catalog inspection finds only `planner_tasks_canonical` among views referencing
the scoped sources; it is security-invoker. Genuine JWT tests cover assignment
directory/board-assignment and workload RPCs, plus client month-ahead post/event
RPCs. Their existing active checks already deny or return no records to inactive
callers. The actual decision modules continue to reject revoked profiles.

**This does not close system-wide revocation.** A wider catalog inventory of
authenticated-executable SECURITY DEFINER functions found adjacent routes.
The test specifically reproduces an inactive manager receiving the JSON summary
from `assistant_ownership_review_summary`; its definer bypasses table RLS and
checks only `is_manager`. This AI-owned route is deliberately unchanged to avoid
the concurrent AI lane. Source inspection also finds role-only gates in
`assistant_update_video` and `apply_microsoft_sync_item`, and no independent
active check in `client_portal_published_content_guidelines`; those paths were
not seeded/executed here and must not be described as proven exploitation.
`client_portal_post_assets` delegates to the active-checked month-ahead RPC.
These findings require a coordinated backend follow-up before any claim of
complete inactive-account isolation. No global helper replacement was made.

## Execution and rollout limits

Runtime: Node 24.19.0, Docker 28.4.0; cached official digest-pinned PostgreSQL
17.12, GoTrue 2.197.0, PostgREST 14.18 (pins in the fixture helper). PostgreSQL
uses `--network none` and tmpfs; services share its isolated network namespace.
No container publishes ports. Actual-app tests use loopback-only HTTP and real
service traffic through Docker exec; no session injection or browser emulation.

Canonical replay remains **202/213** files applied. The eleven previously
classified Storage/backfill/date/duplicate gaps remain explicit; no omitted
policy was approximated. Two synthetic aliases extend the existing fixture.
No real client identities were imported. Privileged fixture methods accept only
fixed operations against generated accounts/tasks and are not exposed through
the HTTP scenario endpoint or browser manifest.

Verification command:

```sh
RUN_NOLAN_SOURCE_POLICY_TESTS=1 RUN_NOLAN_SOURCE_API_TESTS=1 RUN_NOLAN_SAME_ORIGIN_TESTS=1 \
VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key \
node --test --test-concurrency=1 tests/nolanSourcePolicyAuth.test.mjs \
  tests/nolanSourceAdapterApi.test.mjs tests/nolanSameOriginAcceptance.test.mjs
```

The source-policy suite includes a passing characterization of the **remaining**
adjacent ownership-summary gap; a green suite is not a claim that gap is fixed.
Final combined result: **25 passed, 0 failed, 0 skipped**, 135.033 seconds
(14 policy/Auth checks, 8 actual-module checks, 3 same-origin harness checks).
`npm run build` passed (Vite 8.50 seconds, ordinary chunk-size warning), scoped
ESLint and `git diff --check` passed. All owned containers were removed.
Logs: `/tmp/nolan-policy-verified.log`, `/tmp/nolan-policy-build.log`; optional
isolated catalog inventory: `/tmp/nolan-policy-audit.json` (106 authenticated
source-referencing definer functions, an inventory rather than blanket acceptance).
Focused lint, diff checks and the production build use the same synthetic
port-1 environment. The unchanged broad suite and blocked browser engines are
not rerun. Same-origin authenticated UI and physical-device acceptance remain
unexecuted. Activation and Git deployment guards remain false.

Rollout requires a separately authorized database change after comparing the
actual target catalog, grants, helper owner and RPC bodies. ALL policies may
also remove UPDATE/DELETE visibility for inactive callers; that is intentional.
Service-role BYPASSRLS jobs remain outside these policies; authenticated jobs
without a valid active profile will be denied. Other definer RPCs can bypass
these policies and need the coordinated audit described above. The transaction
fails closed on prerequisite/body drift. Never roll back by silently restoring
the reproduced exposure; prepare and approve any rollback separately.
