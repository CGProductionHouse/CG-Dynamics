# CG Dynamics private MCP rollout checkpoint

Issue: #308. PR: #311. Status: **working connector implemented**; transport/auth/deployment gated on CA approval.

## Verified product requirements

Current official OpenAI documentation requires a streamable HTTP MCP endpoint (normally `/mcp`), focused typed tools with accurate safety annotations and handler authorization, and OAuth 2.1 for customer-specific data or writes. Authentication discovery requires protected-resource and authorization-server metadata, PKCE, and supported client identification/registration. Developer testing requires a reachable HTTPS endpoint or Secure MCP Tunnel.

Sources reviewed 2026-09-09:

- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/plugins/guides/security-privacy

The official plugin developer documentation reviewed here does not prove that a custom private app will be callable from CG's scheduled-task surface. Treat scheduled invocation as **UNVERIFIED** until tested in the actual managed ChatGPT workspace; normal Project chat access must be accepted independently.

## What is now implemented

### Tool catalog (`supabase/functions/cg-dynamics-mcp/toolCatalog.ts`)
17 typed, closed-schema tools:
- **11 read tools**: `get_my_day`, `list_my_tasks`, `get_task`, `list_my_calendar`, `list_client_schedule`, `get_client_context`, `list_my_leads`, `get_lead`, `get_my_profile`, `get_my_assistant_bootstrap`, `get_my_recurring_tasks`
- **6 write tools**: `create_task`, `update_task`, `update_lead`, `add_lead_research`, `update_my_preferences`, `create_recurring_task` (all idempotent)

Every tool maps to an existing canonical Dynamics contract. No SQL, raw tables, service keys, arbitrary mutation, or destructive action.

### CG capability manifest (`supabase/functions/cg-dynamics-mcp/capabilityManifest.ts`)
Shared catalog of approved company capabilities, filtered per staff member:
- **CG Dynamics MCP** (this connector): tasks, leads, client context, preferences, recurring tasks
- **Microsoft Teams / Planner**: assigned work, task management, team context
- **Outlook / Calendar**: schedule, meetings, timing context
- **OneDrive / SharePoint**: client files, naming conventions, folder structure
- **Canva**: brand templates, design workflows
- **Adobe**: creative production, PDF/image workflows

Each capability includes: key, label, description, useful-for examples, example actions, operating standards, required role, `expectedConnectedInCompanyWorkspace` (true for all — these are company-standard CG capabilities), and `sessionMissingGuidance` (what to say when a company-standard capability is absent from a specific session).

Two distinct concepts enforced:
1. **Company-standard** (`expectedConnectedInCompanyWorkspace: true`) — fact about the CG company ChatGPT workspace. True for all approved plugins.
2. **Available in current session** — runtime result from inspecting actual session tools. May be false due to session/account/tool-surface issues. A missing-in-session capability is reported as a session issue, not a CG limitation.

### MCP Edge Function (`supabase/functions/cg-dynamics-mcp/index.ts`)
Full working MCP server implementing:
- **JSON-RPC 2.0** protocol: `initialize`, `tools/list`, `tools/call`, `ping`
- **Streamable HTTP** transport: POST `/mcp` with CORS headers
- **Exact staff authentication**: Bearer token → `auth.getUser()` → `profiles` lookup → active staff role gate
- **Tool routing**: dispatches to typed handlers that delegate to existing canonical RPCs and tables
- **Caller-scoped idempotency**: `mcp_check_idempotency` / `mcp_record_idempotency` RPCs for all write tools
- **Table-existence guards**: tools that depend on #305 tables return clear errors when tables are missing
- **Cross-staff isolation**: tools enforce `owner_profile_id = profileId` for staff role; managers get broader access per canonical RLS
- **Audit trail**: every write recorded via `planner_activity_log` (tasks) and `business_development_lead_events` (leads)

### Migration (`supabase/migrations/20260909133000_mcp_idempotency_log.sql`)
Creates `mcp_idempotency_log` table with:
- `(caller_profile_id, tool_name, idempotency_key)` unique constraint
- `mcp_check_idempotency` RPC: checks for duplicate calls, returns existing result or conflict
- `mcp_record_idempotency` RPC: records completed writes
- Service-role only access (no direct authenticated read/write)

### Tests (`tests/cgDynamicsMcpToolCatalog.test.mjs`)
17 focused tests covering:
- Schema validity and uniqueness
- Safety annotations (no destructive/open-world tools)
- Read-first coverage (11 read tools including bootstrap and recurring)
- Write idempotency requirements
- Server instruction security
- Dependency declarations
- Tool count (17 total: 11 read + 6 write)
- Action restrictions (no delete/destroy)
- Profile read/write contracts
- Bootstrap tool contract (read-only, no parameters, self-briefing description)
- Recurring tasks read contract (templates, not instances)
- Recurring task creation contract (requires title, recurrence_rule, idempotency_key)

## What each tool actually calls

| Tool | Canonical contract | RPC/Table |
|------|-------------------|-----------|
| `get_my_day` | `workforceMyDay.ts` | `planner_tasks` + `company_calendar_events` + `monthly_deliverables` |
| `list_my_tasks` | `planner_tasks` | `planner_tasks` filtered by `assigned_to_name` |
| `get_task` | `planner task visibility/RLS` | `planner_tasks` by id |
| `list_my_calendar` | `companyCalendar.ts` | `company_calendar_events` date range |
| `list_client_schedule` | `monthly_deliverables` RLS | `monthly_deliverables` date range |
| `get_client_context` | `get-client-context` Edge Function | `clients` + `marketing_library_sources` + `client_notes` |
| `list_my_leads` | `business_development_leads` RLS | `business_development_leads` owner filter |
| `get_lead` | `business_development_leads` RLS | `business_development_leads` + research + events |
| `create_task` | `create_assistant_task` RPC | `planner_tasks` INSERT via RPC |
| `update_task` | `update_assistant_task` RPC | `planner_tasks` UPDATE via RPC |
| `update_lead` | `business_development_leads` RLS | `business_development_leads` UPDATE |
| `add_lead_research` | `business_development_lead_research` RLS | `business_development_lead_research` INSERT |
| `get_my_profile` | `staff_assistant_profiles` RLS | `staff_assistant_profiles` |
| `update_my_preferences` | `save_my_staff_assistant_profile` RPC | `staff_assistant_profiles` UPSERT via RPC |
| `get_my_assistant_bootstrap` | `staff_assistant_profiles` + `capabilityManifest.ts` | `staff_assistant_profiles` + shared CG capability registry |
| `get_my_recurring_tasks` | `planner_tasks` where `recurrence_rule is not null` | `planner_tasks` templates filtered by `assigned_to_name` |
| `create_recurring_task` | `create_assistant_recurring_task` RPC | `planner_tasks` INSERT with `recurrence_rule` + `source='recurring'` |

## Dependencies on upstream branches

| Dependency | Branch | Status | MCP impact |
|-----------|--------|--------|------------|
| #305 staff assistant + leads | `feat/staff-assistant-workspaces` | DRAFT PR #309 | `get_my_profile`, `update_my_preferences`, `get_my_assistant_bootstrap`, `list_my_leads`, `get_lead`, `update_lead`, `add_lead_research` return clear errors until merged |
| #241/#294 client intelligence | `feat/client-intelligence-runtime` | DRAFT PR #247 | `get_client_context` returns basic client data; full intelligence requires merge |
| #208 task actions | `main` | Merged | `create_task`, `update_task`, `get_my_recurring_tasks`, `create_recurring_task` fully functional |
| Recurrence model | `main` | Merged | `create_recurring_task` creates templates; `materializeRecurringTasks()` handles instance generation |

**Key design**: tools that depend on unmerged tables detect table absence and return a clear error message instead of crashing. The `main`-dependency tools work today against `main`.

## Identity proof: Sydney

Sydney's exact Dynamics profile ID is `69caa24f-0449-4bd0-af6c-2a92d8011d6e`.

When Sydney authenticates with her Bearer token:
1. `auth.getUser(token)` resolves to her exact Supabase auth user
2. `profiles` lookup returns her exact profile with `id = 69caa24f-0449-4bd0-af6c-2a92d8011d6e`
3. All RLS policies scope to `auth.uid()` which equals her profile ID
4. She can only read/write her own tasks (assigned_to_name match), leads (owner_profile_id match), and assistant profile (profile_id match)
5. She cannot read another staff member's assistant profile, leads, or private task context

No identity is inferred from Project names, folder labels, or similar names. The bearer token is the single source of identity.

## Franco: clean-start profile

Franco has no useful old chat history. His Staff Assistant profile should be created fresh using `update_my_preferences` with:
- Responsibilities based on his actual CG role
- Recurring duties from his confirmed workflow
- Working preferences learned from future interactions
- No pre-populated corrections or historical data

The daily-operations model from #305 applies: 07:30 morning check-in reads live Dynamics state; 17:30 evening check-in previews tomorrow. His profile grows from confirmed future interactions, not migrated history.

## Migration readiness for Sydney's history salvage

The connector is now ready to support Sydney's history-salvage prompt writing directly into Dynamics:
- `update_my_preferences` writes durable working-style/preferences into `staff_assistant_profiles`
- `add_lead_research` appends sourced notes to exact lead records
- `update_lead` sets stage, qualification, last/next action, follow-up date
- `create_task` creates canonical Dynamics tasks

**Do not run the salvage prompt until the connector is connected to ChatGPT and verified working end-to-end.**

## Bootstrap / self-briefing capability

`get_my_assistant_bootstrap` returns a compact payload that lets a fresh ChatGPT Project self-brief:

- **identity**: exact `profile_id`, `full_name`, `role`, `is_active`
- **assistant_profile**: durable responsibilities, preferences, corrections, recurring duties, access scope, instructions version
- **capability_manifest**: shared CG capability catalog filtered to the staff member's approved scope, with:
  - key, label, description
  - usefulFor (what it does)
  - exampleActions (sample prompts)
  - operatingStandards (CG rules for that capability)
  - expectedConnected (whether the company workspace typically has it)
  - fallbackGuidance (what to say if unavailable)
- **mcp_tools**: all 17 MCP tools with name, description, dependency, readOnly flag
- **operating_rules**: 9 mandatory runtime rules (truth source, tool-first check, no cross-client, etc.)

The bootstrap does NOT contain: mutable daily tasks, current leads, client contacts, prices, tokens, secrets, or provider IDs. Those are read live from canonical Dynamics.

### Tool-awareness rule

The bootstrap instructs ChatGPT to:
1. All CG company capabilities in the manifest are company-standard and expected to be connected
2. Before claiming a capability is unavailable, inspect actual session tools and try the relevant connected tool
3. If a company-standard capability is missing from this session, report it as a session/account issue (try reconnecting or using the correct CG workspace account) — never claim CG fundamentally cannot do the task
4. Distinguish company-standard (always true for CG) from available-in-this-session (runtime result)
5. Proactively offer connected-tool actions when they reduce staff manual work
6. Use exact client IDs and CG standards for file/task/client actions

## Recurring task support

`create_recurring_task` creates a template row in `planner_tasks` with `recurrence_rule` set. The existing `materializeRecurringTasks()` function (in `src/lib/recurrence.ts`) automatically generates instances within a 14-day window when the view loads.

### Recurrence rules
- **RRULE subset**: `FREQ=DAILY|WEEKLY|MONTHLY`, optional `INTERVAL`, `BYDAY` (MO..SU), `BYMONTHDAY` (1-28)
- **recurrence_until**: optional end date (must not be in the past)
- **recurrence_parent_id**: set on instances, points to the template
- **recurrence_rule**: set on templates, null on instances
- **import_hash**: `rec-<templateId>-<date>` for idempotent instance materialisation

### Template behaviour
- Templates do not appear in normal task lists (filtered by `recurrence_rule is null`)
- Templates are excluded from calendar views, completion authority, and push counts
- Completing/deleting an instance never touches the template
- Instances inherit assignments from the template via `inherit_recurring_planner_task_assignments()` trigger

### Tool: `get_my_recurring_tasks`
Lists recurring templates assigned to the exact staff member. Returns `recurrence_rule`, `recurrence_until`, and current template status.

## Explicit gates

### CA ACTION REQUIRED — OAuth / secrets / endpoint / workspace connection

Before the connector can be used from ChatGPT, CA must:

1. **Create an OAuth 2.1 client** in the CG Dynamics Supabase project:
   - Client name: `CG Dynamics MCP`
   - Redirect URI: `https://chatgpt.com/finish-oauth` (or current OpenAI OAuth callback)
   - Scopes: `openid profile email`
   - Token format: JWT with `sub` = Supabase auth user ID

2. **Configure OAuth metadata endpoints**:
   - Protected resource metadata: `https://<project-ref>.supabase.co/.well-known/oauth-protected-resource`
   - Authorization server metadata: `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server`
   - These must advertise PKCE support, token endpoint auth method `none`, and the required scopes

3. **Deploy the MCP Edge Function**:
   ```bash
   supabase functions deploy cg-dynamics-mcp --no-verify-jwt
   ```
   The function uses service role internally; the Bearer token is the user's Supabase auth token.

4. **Apply the idempotency + recurring task migrations**:
   ```bash
   supabase db push  # or apply 20260909133000_mcp_idempotency_log.sql + 20260909140000_create_assistant_recurring_task.sql
   ```

5. **Apply the #305 staff assistant migration** (if not already applied):
   ```bash
   supabase db push  # or apply 20260908220000_staff_assistant_workspaces.sql
   ```

6. **Connect the private ChatGPT workspace app**:
   - In ChatGPT workspace settings, add a new custom app/plugin
   - Set the MCP endpoint URL to: `https://<project-ref>.supabase.co/functions/v1/cg-dynamics-mcp`
   - Complete the OAuth flow for each staff member
   - Test with Sydney first

7. **Verify end-to-end for Sydney**:
   - Sydney opens her `Sydney CG Assistant` ChatGPT Project
   - She types: `Brief yourself from my CG Assistant profile.`
   - ChatGPT calls `get_my_assistant_bootstrap` with her Bearer token
   - Response shows her identity, profile, capability manifest, MCP tools, and operating rules
   - She types: `What's my day?`
   - ChatGPT calls `get_my_day` with her Bearer token
   - Response shows her actual tasks, calendar events, and deliverables
   - She types: `I'm waiting on Red Oak for the menu.`
   - ChatGPT calls `update_task` with the correct task ID
   - The change appears in CG Dynamics UI
   - She types: `Create a weekly Monday content review task.`
   - ChatGPT calls `create_recurring_task` with a WEEKLY recurrence rule
   - The template appears in `get_my_recurring_tasks`

### What CA must NOT do yet
- Do not run the Sydney history-salvage prompt until step 7 passes
- Do not merge the connector before the OAuth flow is proven
- Do not expose the service role key or OAuth client secret to staff

## Scheduled-task support

**UNVERIFIED**. The official ChatGPT documentation does not confirm that scheduled tasks can invoke custom MCP tools. Normal Project chat access works independently. Document the actual behavior once tested in the CG workspace.

## Safety

- No arbitrary SQL/database tools
- No raw secrets/provider IDs
- No bypass of Dynamics permissions
- No production data backfill/schema migration without explicit CA approval
- No external send/publish/payment/destructive action without current confirmation policy
- Preserve audit events for writes
- Idempotency for mutations via caller-scoped `mcp_idempotency_log`
- One concise clarification when target identity/task is ambiguous
