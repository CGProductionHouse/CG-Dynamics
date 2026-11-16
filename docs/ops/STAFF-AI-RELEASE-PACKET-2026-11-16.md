# PR #995 staged release packet — 16 November 2026

Status: PREPARED, NOT RELEASE AUTHORITY. No production connection, hosted acceptance,
PR merge to main, production migration application or deployment was used for this readiness pass. Current main was integrated into this candidate only. The final
preparation commit is identified in the task handoff; freeze its exact SHA before any
release. Recovered candidate: `0b1a7b895bdb9597450a289cd23993ef35aff510`. Main integration commit: `092f929d66f11a64d275f09be12d47cb8573b551`. The tested code SHA is recorded in the combined receipt below; the receipt-only final head is reported in the task handoff.

## Scope and compatibility freeze

- Main inspected: `34c4552ec5108d1bb0aab49140da7ee2807de08b` (#998 Content-directions evidence fix), integrated with its exact tests and Madison handover preserved.
- Independent workbook candidate inspected: `49136f9c693f83565605d2fcdc7dc1b5807e697c`.
  A `git merge-tree --write-tree` preview found only the ops handover conflict; runtime
  and test files merge without textual conflicts. This is not an actual merge or proof
  of whole-app behavioral compatibility. Preserve both handovers when combining.
- Workbook source, policies and shared active-account helpers remain unedited. Its five
  guard drafts were read verbatim from that pinned commit and applied ONLY inside the
  disposable database for compatibility checks. Its `assistant_update_video`,
  `apply_microsoft_sync_item` and `client_portal_published_content_guidelines` ownership
  remains separate. #995 owns only its narrow ownership-summary guard.
- Existing 59 connector tools remain; five additive tools yield 64 (32 read annotations,
  32 write annotations). All five plugin skills remain; the original four are preserved.
  Local connected-tool metadata still exposes 59 tools and none of the five additions.
  No production connector call was made; this is schema visibility, not live acceptance.
- Preserved My Assistant, Today/Leads, staff profiles, Library/Review/Sources/Registration,
  canonical guidelines and shared router/skills consumers. `/admin/assistant` redirects
  to `/admin/my-assistant`; no old query triggers generation. Full coverage and intentional
  raw-text/campaign limits: [retirement receipt](STAFF-AI-RETIREMENT-2026-11-16.md).

## Completed local gates and their limits

Local frontend/tool versions: Node 24.19.0, TypeScript 6.0.3, Vite 7.3.6 and React
19.2.6 from the existing lockfile/install; no dependency files changed. Native Deno
2.9.6 / TypeScript 6.0.3 checked the complete dependency graphs of
`cg-dynamics-mcp/index.ts`, `cg-assistant-chat/index.ts` and
`marketing-workflow/index.ts`. Command:

```sh
DENO_DIR=/tmp/cg-retire-deno-cache "$CG_DENO_BINARY" check \
  --config=scripts/fixtures/marketing-deno-check.json --no-lock \
  --node-modules-dir=none --sloppy-imports \
  supabase/functions/cg-dynamics-mcp/index.ts \
  supabase/functions/cg-assistant-chat/index.ts \
  supabase/functions/marketing-workflow/index.ts
```

This PASS has explicit compatibility conditions. This environment denies `esm.sh` with
HTTP 403; the as-authored remote-import check is BLOCKED. The validation-only import map
uses actual npm Supabase SDK 2.106.2 for `@2` and 2.49.8 for the existing pinned import.
Existing type-only imports reach extensionless frontend imports and `import.meta.env`;
`--sloppy-imports` and a declaration matching the frontend env shape admit those types.
No runtime source/import/provider config was changed to make the check pass. Before
release, run the actual target bundler/checker with its real dependency resolution and
record resolved versions. Do not advertise this local map as hosted compilation proof.

`scripts/marketing-isolated-auth-acceptance.mjs` uses real GoTrue password sign-in,
PostgREST JWT validation, the repository's canonical SQL and native Deno HTTP handlers.
It has no mocked auth, fake user bearer or production env. Local service-role tokens and
passwords are generated only for the disposable stack and never printed. Source helper
and optional workbook guard drafts are byte-checked against workbook `49136f9c`; no copy
of its security logic is maintained here. The shared replay helper records eleven known
historical empty-database/storage/backfill gaps, not a falsely clean whole-schema replay.
The observed replay applied 205 files with those eleven known gaps. Local role/schema
bootstrap supplies Supabase-style public API default grants; Storage/vault/cron/network
extensions are not emulated. Every new #995 migration must apply successfully or the
run fails. All five added MCP tools were exercised successfully through real HTTP.

| Local component | Pinned version / image digest |
| --- | --- |
| PostgreSQL | 17.12, `postgres@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7` |
| Supabase Auth | 2.197.0, `supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b` |
| PostgREST | 14.18, `postgrest/postgrest@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf` |

PostgreSQL has `--network none` and tmpfs storage. Auth/REST share only that container's
loopback namespace. No host port bindings or mounts. A temporary host-loopback gateway
uses `docker exec` as byte transport; Deno is allowed network only to 127.0.0.1. The REST
authenticator is neither superuser nor BYPASSRLS. Containers are removed in reverse order.
Local email auto-confirm avoids sending mail; email confirmation/delivery is not tested.

Verified assertions include real signup without metadata role promotion; canonical
human review and activation; admin/staff/manager/client and exact-client/source denial;
private storage-path exclusion; native MCP source/draft operations and original-result
retry; direct private-RPC denial; immediate profile-inactivity denial with an already
issued JWT; active/inactive manager ownership-summary behavior; retired endpoint 410
for active staff/manager/admin and 403/401 for inappropriate identities; unchanged model
usage/artifact counts during retired calls. Workbook draft guards apply unchanged and
all five MCP tools, retries, foreign-client/role/inactive denials and retired endpoints pass afterward. The new debrief guard admits active-admin missing-record validation and denies the same JWT immediately after deactivation. This is a guard compatibility check, not a duplicate of the workbook owner’s full debrief mutation suite. This is real LOCAL integration,
not hosted Supabase, installed ChatGPT/Nolan, browser, physical-phone or whole-workbook
acceptance. Final command/count receipts are in the task handoff and local JSON report.

To reproduce, fetch the pinned workbook object read-only, extract its
`tests/helpers/nolanCanonicalSchema.mjs` and five `docs/ops/sql/nolan_*_active*.draft.sql`
files to an isolated temporary directory, and cache the exact images above. Set:

```sh
CG_CANONICAL_REPLAY_MODULE=/tmp/cg-release-canonical-replay.mjs \
CG_DENO_BINARY=/tmp/cg-release-tools/node_modules/.bin/deno \
CG_DENO_CHECK_CONFIG="$PWD/scripts/fixtures/marketing-deno-check.json" \
CG_WORKBOOK_DRAFT_DIR=/tmp/cg-release-workbook-drafts \
DENO_DIR=/tmp/cg-retire-deno-cache \
node scripts/marketing-isolated-auth-acceptance.mjs
```

The five exact draft basenames are `nolan_source_active_reads`,
`nolan_identity_definer_active`, `nolan_content_definer_active`,
`nolan_mutation_definer_active`, and `nolan_debrief_active`. Do not substitute altered files or apply them outside
this isolated test without their owner's review and separate release authority.

## Ordered staged release and approval owners

1. **Coordinator + #995/#990 reviewers: freeze and review.** Pin the final SHA, fresh main,
   candidate migration hashes and all three Edge dependency closures. Confirm no owner
   has superseded a shared deployed function. Decide whether to combine #990 security
   fixes or sequence independent packets; #995 must not publish a second copy of them.
   Review native/local regression receipts and intentional retirements. Do not treat a
   clean textual merge as shared release approval.
2. **Staging owner: authorize an isolated hosted target and identities.** Supply an
   existing authorized nonproduction Supabase target and frontend origin, or approve
   provisioning separately. Need normal admin, manager, staff, client and inactive test
   identities plus two synthetic clients and explicitly authorized fixture records.
   Preserve the target's real auth/JWT/RLS settings; no copied production sessions,
   new production credentials, elevated users or security toggles. There is no verified
   staging project/origin or hosted test-user access supplied to this task.
3. **Database owner: prerequisite and migration gate.** Inspect actual staging catalogs
   and migration history, including Marketing artifact tables, phase-23a rights/document/
   chunk schema, exact `skill_cards.client_scope_key`, canonical revision-bound review
   functions/triggers and profiles. Do NOT replay all historical phases/backfills/seeds.
   Stop on unexpected existing overloads or schema drift. Review/apply these exact
   additive files in timestamp order, only to the authorized staging target:
   - `20261116160000_model_free_marketing_connector.sql`: private receipt ledger and
     six-argument service-only RPC (Project-client argument defaults null).
   - `20261116170000_guard_assistant_ownership_summary.sql`: exact active-auth.uid guard.
   - `20261116180000_governed_marketing_source_activation.sql`: authenticated-admin
     adapter delegating to canonical activation; no service/anon grant.
   Verify grants, FORCE RLS on receipts, real account deactivation, cross-client/version
   denials and immutable history. Actual supported Postgres/extensions must match the
   required `sha256`, UUID/advisory-lock and canonical JSON/review functions; versions
   above are tested local versions, not claims about hosted production.
4. **Backend release owner: stage MCP, then retirement handlers.** Deploy the candidate
   `cg-dynamics-mcp` complete dependency closure, including both new Marketing modules,
   index/catalog and unchanged canonical shared modules. Preserve all existing tool
   names, OAuth discovery and actual captured `verify_jwt`/body-auth settings. Confirm
   64 tools and execute authorized positive/negative cases below before proceeding.
   Deploy only the retirement entry-point changes for `cg-assistant-chat` and
   `marketing-workflow` with their complete reviewed shared dependencies; never delete
   the shared directories or providers. Verify active-staff 410/no usage/no artifacts.
5. **Plugin owner + normal staff operators: stage installed acceptance.** Use the existing
   company connection and exact per-call Project context. Refresh tool discovery only
   after MCP is staged; load the candidate plugin skill package by commit (manifest
   has no independent semver). Do not create replacement/per-person connectors or change
   OAuth scopes/secrets. Verify in BOTH ChatGPT and Nolan: all original skills still
   operate and the five new tools are visible; run explicit, bounded synthetic source,
   draft, human-decision and activation cases with exact IDs. Tool metadata alone is
   insufficient. Keep the production package/connection unchanged until approved.
6. **Frontend/staff acceptance owner: stage exact build.** Build once with legitimate
   staging configuration, accept admin/staff/manager/client routes on desktop and phone
   widths, old links, notification links, no composer/generation controls, retained My
   Assistant Today/Leads/setup and Marketing archive/review. Verify client route denial.
   Synthetic local `dist` is NOT a deployable production artifact. No native Deno or API
   result substitutes for these browser/physical-device checks.
7. **CA + release operator: authorize production packet under #679.** The packet must
   contain exact repo/SHA/team/project/environment, current-cycle timestamped usage,
   delayed-billing allowance, remaining headroom, approved MAX incremental spend,
   serving/storage reserve, captured rollback deployment AND all affected Edge closures/
   JWT settings, pre/post affected-domain uptime probes, named operator and stop rules.
   Historical target references only: frontend project `cg-dynamics`
   (`prj_jHVsExoStNjI7ikqlJyXZx26Ahuu`) / team `cg-dynamics-projects`
   (`team_SK5vvWv1AIXFkPNV8JFYL205`); backend handoff names project
   `ehtjfntukiwbgptqgbzy`. Reconfirm targets through separately authorized inventory;
   this pass intentionally did not access production. Previous October deployment IDs
   and the historical MCP v83 receipt are NOT current rollback/version evidence.
8. **Approved operator: one coordinated production window.** Repeat authorized drift/
   prerequisite checks; apply reviewed migrations; deploy MCP and verify retained/new
   capabilities; update/refresh the approved plugin package; retire the two HTTP model
   paths; then promote the accepted frontend. Use the documented local production-target
   prebuild → one prebuilt `--skip-domain` staging upload → acceptance → promotion of
   the SAME deployment, with no rebuild. If Sensitive env values are redacted, stop:
   never upload `[SENSITIVE]` or synthetic configuration. Any alternative cloud build
   needs explicit budget/attempt authorization. Preserve `git.deploymentEnabled=false`.

No automatic GitHub workflow releases #995. Existing workflows are coding-worker lanes
and an unrelated website-enquiry test pipeline. They are not migration/Edge/frontend
release automation or production approval. Push and merge do not authorize deployment.
At 50% of approved extra spend reassess; at 75% stop discretionary work; at the reserve
or cap stop new builds. Stop immediately for unexpected drift, cross-client leakage,
failed auth/JWT gates, provider invocation, wrong assets or client-site outage.

## Smoke checks and rollback preservation

- Missing/tampered bearer denied; client-role/inactive accounts denied; keep canonical
  OAuth discovery public exactly as before. Test a still-issued JWT after deactivation.
- Generic and specialist retrieval return approved/current cards, usable structured
  guidance, exact-client/branch isolation and bounded continuations. All source text is
  data, never instructions. Raw text requires verified public-domain rights on BOTH rows.
- Source read/activation: explicit company-admin ADMIN, current hash, prior human review,
  trusted source and confirmation; manager/staff/client, stale hash, foreign document,
  unreviewed or rights-unknown text denied. Check real reviewer/audit identity.
- Artifact draft/read/retry: exact client, active actor/connection, same IDs on retry,
  changed-key/input conflicts, stale version and foreign evidence/campaign denied.
  Client Projects use their pinned client/principal; actual client-role users stay denied.
  No reassignment/removal of existing campaign binding. Human approve/reject remains
  manager/admin-only. No publication or provider-generation side effects.
- Retired chat/default/unknown and Marketing run return 410 for active permitted staff;
  inappropriate identities remain denied. Usage requests/attempts and generated artifact
  counts do not increase in the isolated fixture. In live smoke checks, require no usage
  or generated artifact attributable to the probe; do not stop unrelated legitimate
  shared workloads or mistake their concurrent activity for probe generation. Shared
  monthly strategy/meeting/debrief/skill consumers retain
  their contracts; do not run provider-funded smoke generation without separate authority.
- Browser: `/admin/assistant?...` replace-redirects to My Assistant without executing old
  prompts; no floating composer, request/generate/regenerate/handoff controls; saved
  artifact versions/compare/review remain. Reload stale browser bundles normally.

Before release capture exact current closures, permissions and deployment identifiers.
If a new MCP route fails, restore its prior reviewed closure or forward-fix the adapter;
leave append-only artifacts, activation reviews, receipts, profiles and credentials
intact. Do not drop tables, reverse migrations by deleting data, globally revoke roles,
or replay old schema. A database repair is a separately reviewed forward migration.
Keep the narrow inactive-account guard and retired HTTP handlers fail-closed during a
frontend rollback. Reverting to a frontend with old buttons may temporarily re-expose
unusable UI; it must NOT restore provider generation. Prefer the last compatible
retirement frontend or a bounded forward fix. Restoring any generation path requires
an explicit new owner decision. Re-read current versions before rollback to avoid
reverting an intervening owner's release.

## What can happen next, and what cannot yet

Existing access can rerun local Docker Auth/REST/native-Deno/regression/build/lint checks,
review pinned workbook/main compatibility, and prepare source artifacts. Those checks
have been carried out; rerun after any material candidate change. No production calls
are necessary to repeat them.

The shortest defensible route to live is ONE authorized staging target + legitimate test
identities → unmodified hosted dependency/JWT/RLS and installed ChatGPT/Nolan/browser
acceptance → exact-SHA #679 approval with fresh budgets/rollback inventory → one staged
production release in the order above. Staging setup/access and installed interactive
sessions are missing inputs, not coding failures that a mock can resolve. Current
production inventory/billing checks and every production application/deployment need
separate explicit authorization. No need to rebuild the feature or duplicate #990.

PR-description publication remains previously rejected by automatic review and was not
retried. This committed packet and the task handoff are the current review evidence;
the old PR body is not a current parity or release receipt.

## Final combined verification receipt

[Machine-readable receipt](STAFF-AI-COMBINED-VERIFICATION-2026-11-16.json) pins tested
code `412fa43cec6cd75e164e5689b0cea4e01152cf6e`, main `34c4552e`, workbook
`49136f9c`, and temporary combined tree `f18282fe7b42adbf1fd8f642a48ffef2d161c4fa`.
Candidate: 456/456 selected tests, production TypeScript/Vite build, lint zero errors
(17 warnings), all three native Deno dependency graphs, and nine real-Auth assertion
groups passed. Combined tree: 503/503 selected tests and production build passed.
The combined tree has identical Edge, monthly-strategy parser and dependency files;
workbook source was never absorbed into this candidate. Log digests preserve provenance;
raw logs remain local and are not hosted CI artifacts.

The final refetch found main `206f4df9cc845a1b818f96fa4ab43ef1922b7772` (#1000),
which only removes the hourly dispatch schedule. It was integrated in
`6df3bfb70e5ad76b78b0039414fd4a79960dab9c` after testing. That workflow delta was
inspected, not executed; application/test source is byte-identical to the tested head.
Workbook remains `49136f9c693f83565605d2fcdc7dc1b5807e697c`. Final receipt changes
are documentation only. This does not extend acceptance to later remote advancement.
Hosted target compilation/JWT/RLS, installed ChatGPT/Nolan and authenticated browser
acceptance, exact-SHA approval, current budget/reserve and rollback inventory remain
required before release. No cloud operation was performed.
