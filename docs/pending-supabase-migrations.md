# Pending Supabase migrations

**Status as of 2026-06-30 — neither migration has been applied.**

---

## 1. Pending migrations

| # | File | Applied | Idempotent | Purpose |
|---|---|---|---|---|
| A | `supabase/phase-6f-staff-production-status-rls.sql` | ❌ No | ✅ Yes | Lets staff update production statuses in Monthly Planner |
| B | `supabase/phase-7a-client-request-package-link.sql` | ❌ No | ✅ Yes | Adds package classification columns to `command_centre_tasks` |

### A — phase-6f (staff production status RLS)

- Adds one new RLS UPDATE policy on `monthly_deliverables`
- Policy name: `"monthly_deliverables: staff production status update"`
- Staff (`role = 'team'`) can only set: `to_do`, `in_progress`, `ready_internal_review`, `ready_client_approval`
- Admin keeps full update rights via the existing `"monthly_deliverables: admin update"` policy
- Uses `drop policy if exists` before `create policy` — safe to re-run
- No data changes. No table structure changes.
- **App depends on it:** staff saving production status changes in Monthly Planner will fail (RLS blocked) until this is applied

### B — phase-7a (client request package link)

- Adds 3 nullable columns to `command_centre_tasks`:
  - `package_action text` — `'use_slot' | 'addon' | 'move_work'`
  - `quote_needed boolean not null default false`
  - `admin_package_note text`
- Adds 2 partial indexes (`package_action is not null`, `quote_needed = true`)
- All column additions wrapped in `if not exists` checks — safe to re-run
- `deliverable_id` FK was already added by phase-6 and should already exist
- No data changes. No RLS changes.
- **App depends on it:** the Package action menu in Monthly Planner is currently a placeholder. Saving will not be wired until this migration is applied and the save logic is built.

---

## 2. Correct application order

Run **A before B**. Neither depends on the other, but A unblocks live staff usage faster.

```
1. phase-6f-staff-production-status-rls.sql
2. phase-7a-client-request-package-link.sql
```

---

## 3. Run instructions

### Open Supabase SQL editor

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New query**

---

### Step 1 — Run phase-6f

Paste and run the full contents of:

```
supabase/phase-6f-staff-production-status-rls.sql
```

Expected result: `Success. No rows returned.`

Then run the verification queries in section 4A below.

---

### Step 2 — Run phase-7a

Paste and run the full contents of:

```
supabase/phase-7a-client-request-package-link.sql
```

Expected result: `Success. No rows returned.`

Then run the verification queries in section 4B below.

---

## 4. Verification SQL

### 4A — Verify phase-6f

**Confirm the new policy exists:**

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename  = 'monthly_deliverables'
order by policyname;
```

Expected rows (minimum):

| policyname | cmd |
|---|---|
| monthly_deliverables: admin delete | DELETE |
| monthly_deliverables: admin insert | INSERT |
| monthly_deliverables: admin update | UPDATE |
| monthly_deliverables: staff production status update | UPDATE |
| monthly_deliverables: staff select | SELECT |

---

**Confirm the new policy's allowed statuses:**

```sql
select with_check
from pg_policies
where schemaname = 'public'
  and tablename  = 'monthly_deliverables'
  and policyname = 'monthly_deliverables: staff production status update';
```

`with_check` must contain:
- `is_staff()`
- `'to_do'`, `'in_progress'`, `'ready_internal_review'`, `'ready_client_approval'`

---

**Confirm admin update policy is unchanged:**

```sql
select policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename  = 'monthly_deliverables'
  and policyname = 'monthly_deliverables: admin update';
```

Expected: `qual = is_admin()`, `with_check = null`.

---

### 4B — Verify phase-7a

**Confirm new columns exist on command_centre_tasks:**

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'command_centre_tasks'
  and column_name  in (
    'deliverable_id',
    'package_action',
    'quote_needed',
    'admin_package_note'
  )
order by column_name;
```

Expected rows:

| column_name | data_type | is_nullable | column_default |
|---|---|---|---|
| admin_package_note | text | YES | null |
| deliverable_id | uuid | YES | null |
| package_action | text | YES | null |
| quote_needed | boolean | NO | false |

---

**Confirm indexes exist:**

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename  = 'command_centre_tasks'
  and indexname  in (
    'idx_command_centre_tasks_package_action',
    'idx_command_centre_tasks_quote_needed'
  );
```

Expected: 2 rows returned.

---

**Confirm existing tasks are untouched:**

```sql
select count(*) as total_tasks,
       count(package_action) as with_package_action,
       count(case when quote_needed then 1 end) as quote_needed_count
from public.command_centre_tasks;
```

Expected: `total_tasks` = your existing task count, `with_package_action = 0`, `quote_needed_count = 0`.

---

## 5. Rollback notes

**Do not roll back without a Supabase backup in place first.**

### Rollback phase-6f

```sql
drop policy if exists "monthly_deliverables: staff production status update"
  on public.monthly_deliverables;
```

Effect: staff can no longer save production status updates (UI will show errors or silently fail).

### Rollback phase-7a

```sql
alter table public.command_centre_tasks
  drop column if exists package_action,
  drop column if exists quote_needed,
  drop column if exists admin_package_note;

drop index if exists public.idx_command_centre_tasks_package_action;
drop index if exists public.idx_command_centre_tasks_quote_needed;
```

Effect: package classification fields removed. The placeholder Package action menu in Monthly Planner continues to show but remains non-functional (same as current state).

**Do not drop `deliverable_id` here** — it was added by phase-6 and may be in use elsewhere.

---

## 6. App dependency notes

| Migration | Not yet applied means... |
|---|---|
| phase-6f | Staff clicking the status dropdown in Monthly Planner will get an RLS error. Admins are unaffected. |
| phase-7a | Package action menu in Monthly Planner shows disabled placeholders. No saves are attempted. App loads normally. |

The app is safe to use before either migration is applied. Only the specific features above are blocked or inactive.

---

## 7. CG Hours

These migrations do not touch CG Hours tables, CG Hours schema, or any payroll/finance data. No CG Hours verification is needed.
