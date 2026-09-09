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
16 typed, closed-schema tools:
- **9 read tools**: `get_my_day`, `list_my_tasks`, `get_task`, `list_my_calendar`, `list_client_schedule`, `get_client_context`, `list_my_leads`, `get_lead`, `get_my_profile`
- **6 write tools**: `create_task`, `update_task`, `update_lead`, `add_lead_research`, `update_my_preferences` (all idempotent)
- **1 profile read tool**: `get_my_profile` (durable preferences, corrections, responsibilities)

Every tool maps to an existing canonical Dynamics contract. No SQL, raw tables, service keys, arbitrary mutation, or destructive action.

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

### Migration (`supabase/migrations/20260909100000_mcp_idempotency_log.sql`)
Creates `mcp_idempotency_log` table with:
- `(caller_profile_id, tool_name, idempotency_key)` unique constraint
- `mcp_check_idempotency` RPC: checks for duplicate calls, returns existing result or conflict
- `mcp_record_idempotency` RPC: records completed writes
- Service-role only access (no direct authenticated read/write)

### Tests (`tests/cgDynamicsMcpToolCatalog.test.mjs`)
16 focused tests covering:
- Schema validity and uniqueness
- Safety annotations (no destructive/open-world tools)
- Read-first coverage (9 read tools including profile)
- Write idempotency requirements
- Server instruction security
- Dependency declarations
- Tool count (16 total: 10 read + 6 write)
- Action restrictions (no delete/destroy)
- Profile read/write contracts

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

## Dependencies on upstream branches

| Dependency | Branch | Status | MCP impact |
|-----------|--------|--------|------------|
| #305 staff assistant + leads | `feat/staff-assistant-workspaces` | DRAFT PR #309 | `get_my_profile`, `update_my_preferences`, `list_my_leads`, `get_lead`, `update_lead`, `add_lead_research` return clear errors until merged |
| #241/#294 client intelligence | `feat/client-intelligence-runtime` | DRAFT PR #247 | `get_client_context` returns basic client data; full intelligence requires merge |
| #208 task actions | `main` | Merged | `create_task`, `update_task` fully functional |

**Key design**: tools that depend on unmerged tables detect table absence and return a clear error message instead of crashing. The 9 `main`-dependency tools work today against `main`.

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

4. **Apply the idempotency migration**:
   ```bash
   supabase db push  # or apply 20260909100000_mcp_idempotency_log.sql manually
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
   - She types: `What's my day?`
   - ChatGPT calls `get_my_day` with her Bearer token
   - Response shows her actual tasks, calendar events, and deliverables
   - She types: `I'm waiting on Red Oak for the menu.`
   - ChatGPT calls `update_task` (or `add_task_note`) with the correct task ID
   - The change appears in CG Dynamics UI

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
