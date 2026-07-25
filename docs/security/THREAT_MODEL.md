# CG Dynamics Threat Model

## Client A accessing Client B data

- **Entry point**: Client portal (`/client/*`)
- **Affected asset**: `reports`, `posts`, `monthly_deliverables`
- **Existing control**: RLS policies check `my_client_id()` on every read.
  Quality gate tests verify cross-client isolation.
- **Remaining risk**: None if RLS is correctly applied and tested.
- **Remediation**: Already mitigated by RLS + quality gate tests.

## Client user accessing Operations Hub

- **Entry point**: `/admin/ops-hub`
- **Affected asset**: `command_centre_tasks`, `monthly_deliverables`
- **Existing control**: All Ops Hub tables have RLS requiring `is_staff()`.
  Client users have `role = 'client'` which is not in the staff role set.
- **Remaining risk**: None if RLS is enabled and correctly configured.
- **Remediation**: Already mitigated. Verified by access control tests.

## Normal staff reading private Admin tasks

- **Entry point**: Ops Hub Board/Admin tab, direct API queries
- **Affected asset**: `command_centre_tasks` with `bucket = 'Admin / To Do'`
- **Existing control BEFORE fix**: Single `is_staff()` SELECT policy exposing
  all tasks.
- **Existing control AFTER fix**: Separate SELECT policies — managers read all,
  staff read only `bucket != 'Admin / To Do'`.
- **Remaining risk**: Low. Policy is explicit. Clients cannot read any tasks.
- **Tests**: `opsHubQualityGate.test.mjs`

## Staff escalating role

- **Entry point**: Direct SQL, Supabase dashboard, user metadata manipulation
- **Affected asset**: `profiles.role`
- **Existing control**: Role is set via invite claim flow, not from user
  metadata. `handle_new_user()` trigger and `claim_invite()` RPC set role from
  `client_invites` table. No direct user update path.
- **Remaining risk**: Low. Profile update requires `is_admin()`.
- **Remediation**: Implement admin-only `profiles: staff updates all` policy.

## Staff reassigning task ownership

- **Entry point**: TaskDetailDrawer, direct API
- **Affected asset**: `command_centre_tasks.assigned_to_user_id`
- **Existing control**: UPDATE policies restrict staff to own tasks. No check
  on which fields are updated (RLS is row-level, not column-level).
- **Remaining risk**: Low — staff can only update tasks where they are the
  assignee or unassigned. They cannot reassign away from themselves.
- **Remediation**: Acceptable for current controlled beta. Future: add
  manager-only reassignment RPC.

## Package classification manipulation

- **Entry point**: TaskDetailDrawer, direct API
- **Affected asset**: `package_action`, `quote_needed`, `admin_package_note`
- **Existing control**: `admin_set_package_classification` SECURITY DEFINER RPC
  requires `is_manager()`. UPDATE RLS `WITH CHECK` prevents staff from writing
  these fields (Admin/To Do restriction).
- **Remaining risk**: Low. RPC is manager-gated.
- **Tests**: `opsHubQualityGate.test.mjs`

## Cross-client deliverable linking

- **Entry point**: Package classification UI
- **Affected asset**: `command_centre_tasks.deliverable_id`
- **Existing control**: `admin_set_package_classification` does not validate
  deliverable client_id matches task client_id. Frontend filters by client.
- **Remaining risk**: Medium. A manager could theoretically link a task to a
  deliverable of a different client via direct API.
- **Remediation**: Add client matching check to RPC.

## Mass assignment

- **Entry point**: `updateTask` in commandCentre.ts
- **Affected asset**: All `command_centre_tasks` columns
- **Existing control**: `ALLOWED_UPDATE_FIELDS` whitelist in `commandCentre.ts`.
  Frontend only sends whitelisted fields. Server-side: RLS row-level check.
  Package classification fields require manager role through RPC.
- **Remaining risk**: Low for frontend-originated requests. The whitelist is
  not enforced server-side on direct API calls.
- **Remediation**: Add a SECURITY DEFINER RPC for general task updates.

## Stored XSS through WhatsApp/task content

- **Entry point**: Any input field (title, notes, WhatsApp text)
- **Affected asset**: Browser rendering
- **Existing control**: React's default escaping. Content is rendered as text,
  not HTML.
- **Remaining risk**: Low. No dangerouslySetInnerHTML used for user content.
- **Remediation**: Continue using React's default escaping.

## Service-role key leakage

- **Entry point**: `.env.local`, Edge Function logs, git history
- **Affected asset**: Entire database
- **Existing control**: No service-role key in browser code. `.env.local` is
  gitignored. Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- **Remaining risk**: Low. Key is in Vercel environment variables, not in code.
- **Tests**: `.gitignore` includes `.env.local`.

## Stale concurrent task edits

- **Entry point**: Two staff editing same task simultaneously
- **Affected asset**: `command_centre_tasks`
- **Existing control**: Optimistic updates with rollback on error. No
  optimistic concurrency (`updated_at` check).
- **Remaining risk**: Medium. Last write wins; no conflict detection.
- **Remediation**: Future: add `updated_at` comparison to reject stale writes.

## Unrestricted exports

- **Entry point**: Browser DevTools, Supabase dashboard
- **Affected asset**: Any accessible data
- **Existing control**: RLS restricts what the browser can read. Supabase
  dashboard access requires project owner permissions.
- **Remaining risk**: Low. RLS is the boundary.
