# Staff production-status RLS check

## What migration was added

File: `supabase/phase-6f-staff-production-status-rls.sql`

Adds a single new RLS policy on `public.monthly_deliverables`:

```
"monthly_deliverables: staff production status update"
```

## What it allows

Authenticated staff and team users (`role IN ('admin', 'team')`) can update a
monthly deliverable row **only** when the new `production_status` value is one
of the four production-tracking statuses:

| UI label               | Backend value             |
|------------------------|---------------------------|
| Not started            | `to_do`                   |
| In progress            | `in_progress`             |
| Ready for review       | `ready_internal_review`   |
| Awaiting client        | `ready_client_approval`   |

The `updated_at` column is handled automatically by the existing
`trg_monthly_deliverables_updated_at` trigger (no extra RLS needed).

## What it does NOT allow

Staff/team users cannot:

- Set final scheduling statuses: `approved`, `scheduled`, `posted`,
  `internal_changes`, `waiting_client`, `client_changes`, `blocked`, `moved`
- Update any other column (scheduled_date, posted_at, client_approved_at,
  package_id, template_id, client_id, month, deliverable_type, title, priority,
  assigned_to_user_id, assigned_to_name, moved_from_deliverable_id,
  replaced_by_request_id, archived_at)
- Insert new deliverables
- Delete deliverables

Admin users keep their existing full update rights via the unchanged
`"monthly_deliverables: admin update"` policy.

## How it enforces this at the DB layer

PostgreSQL ORs permissive policies. The new policy's `WITH CHECK` restricts
team users to the four allowed values. The existing admin policy's
`WITH CHECK` (derived from `using (is_admin())`) lets admins set any value.
A team user attempting to set `approved` or `scheduled` fails both policies
and is blocked.

See the inline comments in the migration SQL for the full OR-logic trace.

## Warning — NOT applied yet

**This migration has not been run against Supabase. Do not run it in
production without first running the verification queries below in the
Supabase SQL editor and confirming the results look correct.**

## Verification SQL

Run these in the Supabase SQL editor **after** applying the migration.

### 1. Confirm the new policy exists

```sql
select
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename  = 'monthly_deliverables'
order by policyname;
```

Expected: the query returns at least these policies:

| policyname                                             | cmd    |
|--------------------------------------------------------|--------|
| monthly_deliverables: admin delete                     | DELETE |
| monthly_deliverables: admin insert                     | INSERT |
| monthly_deliverables: admin update                     | UPDATE |
| monthly_deliverables: staff production status update   | UPDATE |
| monthly_deliverables: staff select                     | SELECT |

### 2. Confirm staff-allowed statuses are correct in the new policy

```sql
select with_check
from pg_policies
where schemaname = 'public'
  and tablename  = 'monthly_deliverables'
  and policyname = 'monthly_deliverables: staff production status update';
```

Expected `with_check` to contain:
- `is_staff()`
- `'to_do'`, `'in_progress'`, `'ready_internal_review'`, `'ready_client_approval'`

### 3. Confirm admin update policy is unchanged

```sql
select policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename  = 'monthly_deliverables'
  and policyname = 'monthly_deliverables: admin update';
```

Expected: `qual` = `is_admin()`, `with_check` = null (defaults to USING).

### 4. Smoke-test: simulate team user update (run as admin in SQL editor)

Replace `<team_user_id>` with an actual team-role user UUID from `profiles`.
Replace `<deliverable_id>` with any live `monthly_deliverables` UUID.

```sql
-- Temporarily set local role to simulate team user RLS check.
-- This is a read-only simulation — it does not actually change data.
set local role authenticated;
set local request.jwt.claims = '{"sub": "<team_user_id>"}';

-- This should SUCCEED (allowed status):
-- update public.monthly_deliverables
--   set production_status = 'in_progress'
-- where id = '<deliverable_id>'
-- returning id, production_status;

-- This should FAIL with RLS violation (disallowed status):
-- update public.monthly_deliverables
--   set production_status = 'approved'
-- where id = '<deliverable_id>'
-- returning id, production_status;
```

> Supabase SQL editor runs as the service-role key by default and bypasses
> RLS. To test RLS, use the `set local role` approach above, or test via
> the app itself after applying the migration.

### 5. Confirm no RLS policies changed for CG Hours

CG Hours is a separate system and does not touch `monthly_deliverables`.
The following query confirms no CG Hours tables are affected:

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename not in (
    'monthly_deliverables',
    'planner_boards',
    'planner_buckets',
    'planner_activity_log',
    'client_packages',
    'package_deliverable_templates'
  )
order by tablename, policyname;
```

Verify none of the listed policies have changed from their pre-migration state.
