# CG Dynamics Access Control Matrix

## Role definitions

| Role | Profiles.role | Description |
|------|---------------|-------------|
| Admin | `admin` | Full system access, package management, user management |
| Manager | `manager` | Full operational access, Admin board, package classification |
| Staff | `staff` / `team` | Operational task access, no Admin board, own-task status changes |
| Client | `client` | Own published reports, content calendar read-only, no Ops Hub |

## Table access

### command_centre_tasks

| Operation | Admin | Manager | Staff/Team | Client |
|-----------|-------|---------|------------|--------|
| SELECT (all) | ✓ | ✓ | ✗ | ✗ |
| SELECT (non-Admin) | ✓ | ✓ | ✓ | ✗ |
| INSERT (Admin bucket) | ✓ | ✓ | ✗ | ✗ |
| INSERT (operational) | ✓ | ✓ | ✓ | ✗ |
| UPDATE (any) | ✓ | ✓ | ✗ | ✗ |
| UPDATE (own operational) | ✓ | ✓ | ✓ | ✗ |
| UPDATE (bucket to Admin) | ✓ | ✓ | ✗ | ✗ |
| DELETE | ✓ | ✓ | ✗ | ✗ |

### monthly_deliverables

| Operation | Admin | Manager | Staff/Team | Client |
|-----------|-------|---------|------------|--------|
| SELECT | ✓ | ✓ | ✓ | ✗ |
| INSERT | ✓ | ✓ | ✗ | ✗ |
| UPDATE (any) | ✓ | ✓ | ✗ | ✗ |
| UPDATE (production status only) | ✓ | ✓ | ✓ | ✗ |
| DELETE | ✓ | ✓ | ✗ | ✗ |

### client_packages, package_deliverable_templates

| Operation | Admin | Manager | Staff/Team | Client |
|-----------|-------|---------|------------|--------|
| SELECT | ✓ | ✓ | ✓ | ✗ |
| INSERT | ✓ | ✓ | ✗ | ✗ |
| UPDATE | ✓ | ✓ | ✗ | ✗ |
| DELETE | ✓ | ✓ | ✗ | ✗ |

### planner_boards, planner_buckets

Visibility follows `planner_boards.visibility`:
- `public_internal` / `staff`: all staff can read
- `admin_only`: admins only; managers cannot read these boards or their tasks,
  assignments, workload, or Planner activity
- INSERT/UPDATE/DELETE: managers only

### planner_tasks, planner_task_assignees

| Operation | Admin | Manager | Staff/Team | Client |
|-----------|-------|---------|------------|--------|
| Read tasks/assignments on visible boards | ✓ | ✓ | ✓ | ✗ |
| Create task with canonical assignees | ✓ | ✓ | ✗ | ✗ |
| Replace canonical assignees | ✓ | ✓ | ✗ | ✗ |
| Update status (any visible task) | ✓ | ✓ | ✗ | ✗ |
| Update status (canonically assigned task) | ✓ | ✓ | ✓ | ✗ |
| Direct hard delete task | ✗ | ✗ | ✗ | ✗ |
| Direct assignment-row INSERT/UPDATE/DELETE | ✗ | ✗ | ✗ | ✗ |
| Workload summary/details | ✓ | ✓ | ✗ | ✗ |

Task creation, drawer save, reassignment, and workload RPCs require an active
manager/admin profile and are limited to boards visible to the caller. Inactive
manager/admin profiles cannot use direct Planner task write policies. Staff
status changes use canonical `planner_task_assignees.profile_id = auth.uid()`.
The legacy exact-name fallback applies only to tasks with no canonical rows and
requires an active caller with a non-empty name that maps uniquely to their own
active workforce profile. Duplicate active profile names deny fallback. Position
`0` is primary; every assignment row is an assignee, and multi-assigned workload
counts once for each active assigned person.

Canonical RPCs update assignment rows and projections in one transaction and
audit only actual changes. Existing active-manager direct writes remain
compatible: every non-recurring direct insert logs `created` and resolves legacy
names into ordered canonical/unresolved assignments; every actual direct core
update logs `task_updated`. Direct legacy-name changes are synchronized and
audited with neutral `legacy_projection_sync` provenance, while direct unresolved
projection edits are blocked. Microsoft assignment names use that same inbound
normalization path; CG Dynamics never writes to Microsoft.

Direct task INSERT/UPDATE policies enforce board visibility on the target row.
Managers can write `public_internal`/`staff` boards but cannot insert into or
move tasks into `admin_only`; active admins may. UPDATE checks both the existing
row through `USING` and the proposed row through `WITH CHECK`. No authenticated
role has direct Planner task DELETE access. Operational removal is archival;
hard deletion is reserved for explicitly privileged server-side maintenance.

Workload summary and detail RPCs use the same visible, active-task scope. They
exclude Client Schedule, archived/history/completed work, and recurring
templates. Detail rows return safe task/board/bucket fields and ordered active
assignee IDs. Inactive-only assignments return no active IDs and count as
unassigned.

### Planner assignment directory

Admin, manager, staff and team roles may call the safe directory RPC. It returns
only active workforce `id`, `full_name`, `role` and `avatar_url`. Inactive
profiles and profiles without a real non-blank name are not selectable, but existing assignment rows can be read through
the visible-board assignment RPC with `is_active` so historical tasks still
render. This does not broaden `profiles` table RLS. Clients have no access.

### planner_activity_log

Managers/admins retain operational audit visibility on boards visible to their
role; only admins see `admin_only` Planner activity. Staff/team can read only
`planner_task` activity whose task is on a board visible to them. Authenticated
users have no direct activity-log INSERT/UPDATE/DELETE grant; guarded Planner
RPCs and server-side direct-write triggers own audit writes. Clients have no
access.

### profiles

| Operation | Admin | Manager | Staff/Team | Client |
|-----------|-------|---------|------------|--------|
| SELECT (own) | ✓ | ✓ | ✓ | ✓ |
| SELECT (all) | ✓ | ✗ | ✗ | ✗ |
| UPDATE (any) | ✓ | ✗ | ✗ | ✗ |

### AI Marketing artifacts

| Operation | Admin | Manager | Staff/Team | Client |
|-----------|-------|---------|------------|--------|
| Read internal artifacts/versions/history | ✓ | ✓ | ✓ | ✗ |
| Generate/regenerate/handoff draft | ✓ | ✓ | ✓ | ✗ |
| Request changes / return to specialist | ✓ | ✓ | ✓ | ✗ |
| Approve or reject current version | ✓ | ✓ | ✗ | ✗ |
| Direct table writes / history mutation | ✗ | ✗ | ✗ | ✗ |

Artifacts require an exact active `client_id`; optional campaign IDs must exist
for that same client. Versions, transitions, approvals and audit rows are
append-only. AI review never grants human approval, publishes, activates
knowledge, changes client records or spends advertising budget.

### clients

| Operation | Admin | Manager | Staff/Team | Client |
|-----------|-------|---------|------------|--------|
| SELECT | ✓ | ✓ | ✓ | own only |
| INSERT | ✓ | ✗ | ✗ | ✗ |
| UPDATE | ✓ | ✗ | ✗ | ✗ |
| DELETE | ✓ | ✗ | ✗ | ✗ |

### reports, posts

| Operation | Staff | Client |
|-----------|-------|--------|
| SELECT | all | own published only |
| INSERT | ✓ | ✗ |
| UPDATE | ✓ | ✗ |
| DELETE | ✓ | ✗ |

## Package classification fields

`package_action`, `quote_needed`, `admin_package_note`, `deliverable_id` on
`command_centre_tasks` are manager-write-only. Staff cannot set these fields
through RLS or the `admin_set_package_classification` RPC.

### Web Push subscriptions and delivery

| Operation | Admin | Manager | Staff/Team | Client |
|-----------|-------|---------|------------|--------|
| Register/status/unregister own device | yes | yes | yes | no |
| Read raw subscription endpoint/key material | no | no | no | no |
| Receive own notification push | yes | yes | yes | no |
| Receive another staff member's personal reminder | no | no | no | no |
| Process delivery queue | service role only | service role only | service role only | no |

The browser considers push active only when permission is granted, a browser subscription exists, and the same endpoint is active server-side for the signed-in user.
