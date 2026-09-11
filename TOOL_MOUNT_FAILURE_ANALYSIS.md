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
5. Call `run_microsoft_sync` with `range_start`/`range_end` to resume the stuck preview job

This is a **human/platform-only connector gate** — no coding workaround can force ChatGPT to refresh its local tool manifest view.

## Microsoft Durable-Sync Fix (Code Changes Applied)

### Root Cause
The `graphPages` function in `microsoft-transition-sync/index.ts` had a hard 5,000-record safety cap that truncated results and returned an error, causing the `2025 CLIENTS SCHEDULE` plan (>5,000 tasks) to stall.

### Solution: Bounded Continuation/Checkpointing
1. **Migration**: Added `pagination_cursor` column to `microsoft_sync_job_sources` table
2. **Job Machine**: Added `PAGINATION_BATCH_SIZE = 1000` constant and `pagination_cursor` to `JobSourceRow`
3. **Graph Fetching**: Modified `graphPages` to accept optional cursor, return `nextCursor`, and respect batch size
4. **Fetch Units**: Updated `fetchPlannerTasksUnit` and `fetchOutlookUnit` to pass/return cursors
5. **Job Processing**: Updated `job_process` to store cursor when pagination incomplete, only mark `complete` when `nextCursor` is null
6. **Retry Logic**: Clear `pagination_cursor` on `job_retry`

### Guarantees Preserved
- **Pagination**: Microsoft Graph `@odata.nextLink` used for resumable fetches
- **Source Completeness**: Source only marked `complete` when all pages fetched
- **Idempotency**: Each `job_process` call processes exactly one batch; repeat calls resume from cursor
- **Protected Rules**: No changes to MASTER CLIENT TO DO, Client Socials, or Client Schedule handling
- **No Silent Truncation**: Safety cap removed; large sources process in multiple bounded steps

## Acceptance Sequence (Once Tool Mount Works)
1. `resolve_project_context({ context_kind: "company_admin" })` → confirms company-admin context
2. `get_microsoft_sync_status` → shows stale 19 Aug 2026 run, SYNC STALE verdict
3. `run_microsoft_sync({ range_start: "2026-08-19", range_end: "2026-09-15" })` → starts new preview job
4. Poll `run_microsoft_sync({ job_id: "<returned>" })` until `finished: true` (multiple calls for 2025 CLIENTS SCHEDULE pagination)
5. `get_microsoft_sync_status` → shows fresh run, PASS verdict
6. `get_provider_health` → Meta/Google Ads/TikTok freshness
7. `run_provider_sync` for each mapped client → routine syncs
8. `find_content_runs` → discover upcoming Content Runs with OneDrive readiness
9. Morning Ops checkpoint → READY/FIXED/DEGRADED/CA ACTION

## Files Changed
- `supabase/migrations/20260910120000_microsoft_sync_pagination_cursor.sql` — DB migration
- `supabase/functions/microsoft-transition-sync/job-machine.ts` — PAGINATION_BATCH_SIZE, JobSourceRow.pagination_cursor
- `supabase/functions/microsoft-transition-sync/index.ts` — graphPages cursor support, fetch units, job_process pagination logic
- `tests/microsoftDurableJob.test.mjs` — Regression tests for pagination constants and types

## Tests
- `npm run build` — ✅ passes
- `node --test tests/microsoftDurableJob.test.mjs` — ✅ 8 tests pass (2 new pagination tests)

## Remaining CA/Platform Action
**Only**: ChatGPT connector refresh in company-admin Project to mount the 34-tool catalogue. No further code changes required.