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
| staff select public | SELECT | `is_staff() AND (visibility IN ('public_internal','staff') OR (visibility = 'admin_only' AND is_admin()))` |
| admin insert | INSERT | `is_admin()` |
| admin update | UPDATE | `is_admin()` |
| admin delete | DELETE | `is_admin()` |

## planner_buckets

| Policy | Type | Effect |
|--------|------|--------|
| staff select | SELECT | EXISTS (board visibility check) |
| admin insert | INSERT | `is_admin()` |
| admin update | UPDATE | `is_admin()` |
| admin delete | DELETE | `is_admin()` |

## planner_activity_log

| Policy | Type | Effect |
|--------|------|--------|
| staff select | SELECT | `is_staff()` |
| staff insert | INSERT | `is_staff()` |

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
| staff select | SELECT | `is_staff()` |
| manager insert | INSERT | `is_manager()` |
| manager update | UPDATE | `is_manager()` (USING + WITH CHECK) |
| manager delete | DELETE | `is_manager()` |

## Storage

Operations Hub files are private, manager-only access through signed URLs.
Client report PDFs use signed URLs with TTL expiry.
