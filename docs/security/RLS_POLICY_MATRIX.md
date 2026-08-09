# CG Dynamics RLS Policy Matrix

## command_centre_tasks

| Policy | Type | Effect |
|--------|------|--------|
| manager select all | SELECT | `is_manager()` |
| staff select operational | SELECT | `is_staff() AND bucket != 'Admin / To Do'` |
| staff insert operational | INSERT | `is_staff() AND bucket != 'Admin / To Do'` |
| manager insert admin | INSERT | `is_manager() AND bucket = 'Admin / To Do'` |
| manager update | UPDATE | `is_manager()` (USING + WITH CHECK) |
| staff update operational | UPDATE | `is_staff() AND bucket != 'Admin / To Do' AND (assigned_to_user_id IS NULL OR assigned_to_user_id = auth.uid())` (USING + WITH CHECK) |
| manager delete | DELETE | `is_manager()` |

## monthly_deliverables

| Policy | Type | Effect |
|--------|------|--------|
| staff select | SELECT | `is_staff()` |
| admin insert | INSERT | `is_admin()` |
| admin update | UPDATE | `is_admin()` |
| staff production status update | UPDATE | `is_staff() AND production_status IN ('to_do','in_progress','ready_internal_review','ready_client_approval')` |
| admin delete | DELETE | `is_admin()` |

Clients have no direct SELECT policy. The client portal projection requires an
active client profile, own `client_id`, an eligible unarchived deliverable, and
at least one explicit disclosure timestamp. Status alone never grants access,
and the projection never substitutes internal `due_date` for a client schedule
date. Client reassignment is rejected while disclosure or posting evidence
exists, preserving history until an explicit reconciliation process is used.

## company_calendar_events

| Policy | Type | Effect |
|--------|------|--------|
| staff select | SELECT | `is_staff()` |
| active manager insert | INSERT | Manager/admin event fields only; `client_visible` defaults false |
| active manager update | UPDATE | Non-superseded rows and an explicit field allowlist that excludes client-visibility audit columns |
| active manager delete | DELETE | Non-superseded rows only |
| client direct access | SELECT/WRITE | No policy; client-safe RPC projection only |

`set_company_calendar_event_client_visibility` is the sole authenticated write
path for event publication state. It requires an active manager/admin, locks the
event, and validates client linkage, event type, cancellation, and supersession.
Microsoft does not own or write this state. A database constraint requires every
`client_visible = true` row to have both visibility audit fields populated; a
false row permits either a null pair or a complete explicit-off pair.

## client_packages

| Policy | Type | Effect |
|--------|------|--------|
| admin all | ALL | `is_admin()` |
| staff select | SELECT | `is_staff()` |

## package_deliverable_templates

| Policy | Type | Effect |
|--------|------|--------|
| admin all | ALL | `is_admin()` |
| staff select | SELECT | `is_staff()` |

## planner_boards

| Policy | Type | Effect |
|--------|------|--------|
| staff select visible | SELECT | `is_staff() AND (visibility IN ('public_internal','staff') OR (visibility = 'admin_only' AND is_admin()))` |
| admin insert | INSERT | `is_admin()` |
| admin update | UPDATE | `is_admin()` |
| admin delete | DELETE | `is_admin()` |

## planner_buckets

| Policy | Type | Effect |
|--------|------|--------|
| staff select visible | SELECT | EXISTS (board visibility check; `admin_only` requires `is_admin()`) |
| admin insert | INSERT | `is_admin()` |
| admin update | UPDATE | `is_admin()` |
| admin delete | DELETE | `is_admin()` |

## planner_activity_log

| Policy | Type | Effect |
|--------|------|--------|
| visible Planner task select | SELECT | Planner activity follows board visibility; `admin_only` requires `is_admin()`. Managers/admins retain non-Planner operational audit visibility |
| direct write | INSERT/UPDATE/DELETE | No authenticated grant or policy; assignment/status RPCs write audit rows |

## profiles

| Policy | Type | Effect |
|--------|------|--------|
| read own row | SELECT | `id = auth.uid()` |
| admin reads all | SELECT | `is_admin()` |
| admin updates all | UPDATE | `is_admin()` |

## clients

| Policy | Type | Effect |
|--------|------|--------|
| staff reads all | SELECT | `is_staff()` |
| client reads own | SELECT | `id = my_client_id()` |
| admin insert | INSERT | `is_admin()` |
| admin update | UPDATE | `is_admin()` |
| admin delete | DELETE | `is_admin()` |

## reports

| Policy | Type | Effect |
|--------|------|--------|
| staff full access | ALL | `is_staff()` |
| client reads own published | SELECT | `status = 'published' AND client_id = my_client_id()` |

## posts

| Policy | Type | Effect |
|--------|------|--------|
| staff full access | ALL | `is_staff()` |
| client reads own published | SELECT | EXISTS on reports (published + own) |

## client_requests

| Policy | Type | Effect |
|--------|------|--------|
| staff full access | ALL | `is_staff()` |

## planner_tasks

| Policy | Type | Effect |
|--------|------|--------|
| staff select visible boards | SELECT | `is_staff()` + board visibility; `admin_only` requires `is_admin()` |
| active manager visible-board insert | INSERT | `is_active_planner_manager()` + target board visibility; `admin_only` requires `is_admin()` |
| active manager visible-board update | UPDATE | USING checks the old board and WITH CHECK checks the proposed board; `admin_only` requires `is_admin()` |
| direct hard delete | DELETE | No authenticated policy. Operational removal is archival; only explicitly privileged server functions may hard-delete |

## planner_task_assignees

| Policy | Type | Effect |
|--------|------|--------|
| staff select visible boards | SELECT | `is_staff()` + parent task board visibility; `admin_only` requires `is_admin()` |
| direct write | INSERT/UPDATE/DELETE | No authenticated grant or policy; manager-only RPCs validate active workforce profiles and write transactionally |

`list_planner_assignment_directory` exposes only active workforce `id`,
non-blank `full_name`, `role`, and `avatar_url`. `list_planner_board_assignments` exposes
the same safe profile fields plus position and `is_active` for historical
assignments on visible boards. Clients cannot execute either RPC. The
active-manager/admin workload summary and detail RPCs exclude archived tasks, recurring templates,
completed/history statuses, the client-schedule board, and boards not visible to
the caller. A task with multiple active assignees counts once for each active
assignee. Tasks with no active canonical assignee, including inactive-only
assignments, contribute to the reported unassigned total.

New `source = 'recurring'` Planner instances with a `recurrence_parent_id`
inherit the parent's canonical assignment positions, legacy name projections,
and unresolved imported identities through a fixed-path server-side trigger.
The recurrence trigger function has no API execute grant and writes no
user-facing activity event. It requires an active manager/admin caller, a real
recurrence template on the same board, and caller visibility to that board;
`admin_only` requires admin.

All unguarded non-recurring Planner inserts and legacy assignment-name changes,
including Microsoft inbound writes, run through a server-side canonicalization
trigger. Only unique case-insensitive exact matches to active, named workforce
profiles become canonical assignment rows; unmatched/ambiguous names remain in
`unresolved_assignee_names`. A separate guarded audit trigger records `created`
for direct inserts and `task_updated` for actual direct core changes using neutral
`direct_write` provenance. Canonical create/reassign/drawer-save/status RPCs set
transaction-local guards and write their own audit events, preventing duplicates.
Direct unresolved projection edits remain blocked. Ordered assignment no-ops
preserve `assigned_at`. The status RPC rejects inactive callers and ambiguous
legacy-name fallback.

## Storage

Operations Hub files are private, manager-only access through signed URLs.
Client report PDFs use signed URLs with TTL expiry.
