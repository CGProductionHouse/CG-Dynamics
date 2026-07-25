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
- `admin_only`: managers only
- INSERT/UPDATE/DELETE: managers only

### profiles

| Operation | Admin | Manager | Staff/Team | Client |
|-----------|-------|---------|------------|--------|
| SELECT (own) | ✓ | ✓ | ✓ | ✓ |
| SELECT (all) | ✓ | ✗ | ✗ | ✗ |
| UPDATE (any) | ✓ | ✗ | ✗ | ✗ |

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
