# #451 automatic Microsoft CPU repair — local proof, not production activation

Authority: #451 comment 5955553538 and #623 / #381. Base current main
`52de08810304e25258e1e0dbfc24de83a9d22ae7` (the newer Website transport
merge does not change this Microsoft lane). Master handover intentionally untouched.

## Reproduced before changing runtime code

`tests/microsoftAutomaticRuntime.test.mjs` builds six sources / 7,500 records:

| Source | Records | Automatic domain |
|---|---:|---|
| Operational Outlook calendar | 150 | CG Calendar |
| To Do | 800 | Planner |
| MASTER CLIENT TO DO | 200 | Planner |
| CG Socials | 500 | Planner |
| Client Socials - July 2026 | 350 | Protected Client Schedule |
| 2025 CLIENTS SCHEDULE | 5,500 | Protected Client Schedule |

Baseline: 5,850 protected detail requests, even for completed schedule tasks;
7,350 assignee references; all 7,500 records assembled/mapped before schedule
exclusion. Existing reconciliation recalculates exact-source completeness by
scanning the full mapped input for every item, repeatedly generating keys and
sets. Baseline local assembly/reconciliation measured 25,877ms before editing
and 27,072ms in the focused verification run. This reproduces expensive work;
it is not an assertion that workstation wall time equals hosted Edge CPU time.

## Narrow automatic-system changes

- Reuse `resolveMicrosoftPlanMapping`, not another plan routing list.
- Enumerate/fetch every required source and preserve its durable counts, IDs,
  errors, ranges and completeness. Source completeness means complete enumeration
  plus the enrichment required for that path; protected schedule enrichment is
  not required for automatic mirrors and is not claimed to have been performed.
- Skip protected schedule detail and assignee work only for authenticated
  `system_cycle`. Operational Planner details retain the existing policy.
- Resume old unnecessary protected detail queues only after enumeration is
  complete, record counts agree, no cursor remains and no error is present.
  Failed/incomplete evidence is not turned into success.
- Automatic apply reads coverage metadata for all six sources, then reads
  `records` only for exact writable source-row IDs in that job. It validates
  mirror payload counts and exact source IDs/names before preparing a snapshot.
- The automatic snapshot contains 1,650 mirror records, while its six-source
  coverage still totals 7,500. Protected excluded count is 5,850, not zero merely
  because those payloads are intentionally absent.
- Reconciliation caches each source's exact-count/unique-ID completeness once
  per automatic preparation call. Manual/admin callers retain their default
  behavior. Exact-ID duplicate conflicts, native-calendar review, optimistic
  locks and source-removal guards remain canonical.
- Automatic target reads use the existing paginated-row helper instead of a
  first-1,000-row assumption. Protected-plan targets cannot become automatic
  removals due to omission of protected payloads.
- Automatic recovery/status queries require both exact `preview_job_id` and
  `trigger_type=agent`. The July manual applying run (no preview link) cannot
  be adopted. Existing recovery budget, leases/generation fencing, unique
  automatic-run index, item-audit keys and automatic RPC stay unchanged.
- Apply responses set `ok=true` only for `completed`, not `partial`/`applying`.
  Nothing masks HTTP 546 or changes freshness thresholds/health wording.
- Adjacent Edge annotations use `SupabaseClient` rather than generic
  `ReturnType<typeof createClient>`, and correctly accept PostgREST PromiseLike
  RPC builders. These are type-only corrections, not auth/config changes.

Manual `job_result` still loads and assembles the full snapshot. Manual detail
defaults and full-preview output/parity are exercised explicitly. No protected
schedule records are flattened into Planner; no `monthly_deliverables` path was
added or invoked.

## Deterministic acceptance

The 11 new regressions cover baseline/repaired work; six-source truth;
manual parity; safe resume; incomplete/error/cursor/count/foreign-ID denial;
5,500-task pagination, crash replay and exact-ID dedupe; exact-client mapping and
ambiguity; real loader payload selection; 18 existing linked tasks completing to
`done`; Outlook cancellation; lease loss; paginated target reads; idempotent item
replay; failed inner execution never PASS; agent-only recovery and budget bounds.

Focused-run repaired assembly/reconciliation: **68.3ms**, 1,650 mirror records,
1,500 assignee references, zero protected detail requests. Generous regression
guard: under 2,000ms local pure preparation. Mock apply/crash/two replays:
**314.2ms**, 1,650 unique audit identities, no duplicate mutation, zero protected
writes. These measurements exclude real Graph/DB latency and do not establish
production freshness success.

Verification commands (harmless local test URL/key; existing Git OpenSSL on PATH
is needed by current-main SNS tests):

```powershell
node --test tests/microsoftAutomaticRuntime.test.mjs tests/microsoftDurableJob.test.mjs tests/microsoftTransitionSync.test.mjs tests/microsoftApplyRecovery.test.mjs tests/microsoftPagination.test.mjs tests/dailyDynamicsFreshness.test.mjs tests/microsoftAssigneeLookup.test.mjs
node --test tests/*.test.mjs
npm run build
npx eslint src/lib/microsoftSync.ts supabase/functions/microsoft-transition-sync/automatic-snapshot.ts supabase/functions/microsoft-transition-sync/automatic-reconciliation.ts supabase/functions/microsoft-transition-sync/index.ts supabase/functions/microsoft-transition-sync/planner-details.ts tests/microsoftAutomaticRuntime.test.mjs
git diff --check
```

Focused: 145 passed, no failures/skips. Full suite: 3,442 tests, 3,426 passed,
16 skipped, no failures. Build/scoped lint/diff PASS. Separate Deno 2.9.6 Edge
check passed with a local check-only ImportMeta declaration, the shared bare
Supabase import mapped to the existing JSR SDK, and sloppy imports matching the
repository's extensionless shared TypeScript imports; no repo config/dependency
or production configuration was changed. Final exact-head Vercel evidence is
recorded in the PR/owning issues, not assumed from the local build.

## Protected rollout remains separate

Draft PR / supervisor review first. No migration or cron/secret/config change is
needed in this patch. After acceptance and explicit CA authorization: deploy
only the reviewed `microsoft-transition-sync` bundle; verify deployed source
parity; observe the existing scheduler's full six-source collection and exact
automatic apply receipt; separately authorize any explicit reconciliation/data
repair. Do not replay or resume the July manual run. Do not repair the 18 live
task statuses by hand. Stop on coverage, identity, fencing or runtime failure;
last verified mirror remains authoritative and freshness must remain degraded.

Post-deployment evidence must include full source counts, actual automatic run
and terminal apply counts, no new 546/CPU errors, completion/cancellation truth,
no Client Schedule writes and truthful Integrations health. Local fixtures and
Vercel preview cannot substitute for this protected production acceptance.

No production reconciliation, migration, Edge deploy, cron/config/secret change,
provider work or production data mutation occurred. **No Microsoft writes occurred.**
