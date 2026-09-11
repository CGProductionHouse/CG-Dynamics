# Tool-Mount Failure Analysis — ChatGPT/Platform Side

## Summary
The post-reconnect tool-mount failure where the ChatGPT runtime does not mount the current CG Dynamics company-admin tool catalogue **has no identified repository-side cause**. Repository/backend evidence shows the backend catalogue is healthy; the remaining gap is on the ChatGPT/platform side.

## Evidence

### 1. Backend Exposes 34-Tool Contract Correctly
- **Edge Function**: `cg-dynamics-mcp` version 6 deployed (PR #329, commit `a6ad664`)
- **MCP Endpoint**: `tools/list` returns all 34 tools with correct schemas, annotations, and security schemes
- **Tool Catalogue**: `toolCatalog.ts` defines 34 tools including all company-admin tools (`run_microsoft_sync`, `get_provider_health`, `run_provider_sync`, `find_content_runs`, `list_company_tasks`, `list_company_recurring_tasks`, `get_microsoft_sync_status`)
- **Authentication**: OAuth/PRM discovery contract works (metadata 200, expected unauthenticated challenge 401, CORS 200)
- **Invocation Logging**: `console.log('mcp method=${method} tool=${invokedTool}')` confirms tools are callable when invoked

### 2. No Repository-Side Changes Needed
- The `handleToolsList` function in `index.ts:2512-2524` correctly maps all `CG_DYNAMICS_MCP_TOOLS` to MCP tool objects with security schemes
- Per-tool OAuth declaration (`securitySchemes: CG_DYNAMICS_MCP_SECURITY_SCHEMES`) follows current OpenAI Plugins auth docs
- Project context resolution (`resolve_project_context`) works for `company_admin` kind (verified in production checkpoint)
- Transport layer is healthy — no code changes to OAuth, scopes, permissions, or connector architecture required

### 3. Observed Platform Behaviour (Not Internal Mechanics)
- The communal ChatGPT account holds one OAuth connection (company admin)
- After reconnect, ChatGPT must re-fetch the tool catalogue from the MCP endpoint
- The "34-tool catalogue" is live and correct at the endpoint; ChatGPT's UI has not refreshed its local view
- Repository/backend evidence proves **no identified repo-side fault**; it does not prove internal ChatGPT cache/session mechanics

### 4. Smallest Manual/Runtime Action (No Code Changes)
**CA action required**: In the company-admin ChatGPT Project:
1. Open the CG Dynamics connector settings
2. Disconnect and reconnect the CG Dynamics connector (or use "Refresh tools" if available)
3. Verify the tool list shows all 34 tools including company-admin tools
4. Call `resolve_project_context({ context_kind: "company_admin" })` to bootstrap
4. Call `get_microsoft_sync_status` to verify sync health
5. Only after the pagination fix is deployed (see Remaining actions): call `run_microsoft_sync` with `range_start`/`range_end` to start a **fresh** preview job. Do not resume the stuck job: its `2025 CLIENTS SCHEDULE` source was already truncated by the old cap. Starting a new job cancels the stuck one automatically.

This is a **human/platform-only connector gate** — no coding workaround can force ChatGPT to refresh its local tool manifest view.

## Microsoft Durable-Sync Fix (Code Changes Applied)

### Root Cause
The `graphPages` function in `microsoft-transition-sync/index.ts` had a hard 5,000-record safety cap that truncated results and returned an error, causing the `2025 CLIENTS SCHEDULE` plan (>5,000 tasks) to stall.

### Solution: Bounded Continuation/Checkpointing
1. **Migration** (prepared, not applied): adds a nullable `pagination_cursor` column to `microsoft_sync_job_sources`.
2. **Pure pagination logic in `job-machine.ts`**, called by `index.ts` and unit-tested directly:
   - `paginateGraph` consumes Graph pages whole and checkpoints only on `@odata.nextLink`, so no page is ever re-read. It returns once a bounded batch (`PAGINATION_BATCH_SIZE`) is held.
   - `accumulatePlannerPage` / `accumulateOutlookPage` append each batch to the persisted records (deduplicated by source id). Planner detail work is marked per task and survives page boundaries.
   - `planSourceUpdate` is the single transition rule: an error **fails** the source (retryable); a cursor keeps paging; pending detail work moves to `fetching_details`; otherwise the source completes.
3. **`job_process`** loads only the source it is fetching; status polls do not load record payloads.
4. **`job_retry`** re-queues a failed source from scratch (`retrySourceReset`).

### Guarantees
- **No silent truncation:** the 5,000-record cap is gone; large plans are fetched across several bounded `job_process` calls.
- **Completeness:** a source completes only after every page is fetched and every pending detail id is drained. A failed required source blocks apply.
- **No stuck jobs:** a failing page, a repeating page link, or a runaway cursor chain (`MAX_PAGINATION_STEPS`) fails the source instead of retrying it forever.
- **Idempotency:** a step that crashes before persisting is simply re-run from the same cursor; overlap is deduplicated.
- **Protected rules:** no changes to MASTER CLIENT TO DO, Client Socials or Client Schedule handling.

## Acceptance Sequence (Once Tool Mount Works)
1. `resolve_project_context({ context_kind: "company_admin" })` → confirms company-admin context
2. `get_microsoft_sync_status` → shows stale 19 Aug 2026 run, SYNC STALE verdict
3. `run_microsoft_sync({ range_start: "2026-08-19", range_end: "2026-09-15" })` → starts new preview job
4. Poll `run_microsoft_sync({ job_id: "<returned>" })` until `finished: true` (several calls for 2025 CLIENTS SCHEDULE). Confirm no source is `failed` and that 2025 CLIENTS SCHEDULE reports more than 5,000 records.
5. `get_microsoft_sync_status` → shows fresh run, PASS verdict
6. `get_provider_health` → Meta/Google Ads/TikTok freshness
7. `run_provider_sync` for each mapped client → routine syncs
8. `find_content_runs` → discover upcoming Content Runs with OneDrive readiness
9. Morning Ops checkpoint → READY/FIXED/DEGRADED/CA ACTION

## Files Changed
- `supabase/migrations/20260910120000_microsoft_sync_pagination_cursor.sql` — additive nullable column (prepared, not applied)
- `supabase/functions/microsoft-transition-sync/job-machine.ts` — pure pagination, accumulation and transition logic
- `supabase/functions/microsoft-transition-sync/index.ts` — Graph I/O wired to that logic; lean status queries
- `tests/microsoftDurableJob.test.mjs` — drives the production functions against a fake Graph

## Tests
- `node --test tests/microsoftDurableJob.test.mjs` — 27 pass, including a 6,300-task / 7-page plan, page-1 + final-page detail ids surviving resume, oversized pages, a failing page, retry, crash-before-persist replay, a looping page link, Outlook, and a wiring test proving `index.ts` calls the tested functions.
- `node --test tests/microsoft*.test.mjs` — 178 pass.
- ESLint clean on the changed files; strict `tsc` clean on `job-machine.ts`. (`index.ts` is a Deno function; no Deno toolchain was available to type-check it.)

## Remaining CA Actions (in order)
The connector refresh alone does **not** fix the 5,000-record stall: production still runs the old capped code until steps 2 and 3 are done.

1. Review and merge this PR.
2. Apply `20260910120000_microsoft_sync_pagination_cursor.sql` to production.
3. Deploy the `microsoft-transition-sync` Edge Function.
4. Refresh the CG Dynamics connector in the company-admin ChatGPT Project (the separate tool-mount issue above).
5. Run the acceptance sequence above with a **fresh** preview job.
