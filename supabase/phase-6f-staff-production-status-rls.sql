-- ============================================================
-- Phase 6F: Staff production-status RLS for monthly_deliverables
--
-- Context
-- -------
-- The UI now lets team/staff users select only production-tracking
-- statuses (not_started, in_progress, ready_review, awaiting_client)
-- which map to backend values:
--   not_started       -> to_do
--   in_progress       -> in_progress
--   ready_review      -> ready_internal_review
--   awaiting_client   -> ready_client_approval
--
-- Final scheduling statuses (meta_drafts -> approved,
-- scheduled_posted -> scheduled) remain admin-only in the UI.
-- This migration enforces the same restriction at the RLS layer.
--
-- Existing policies unchanged
-- ---------------------------
--   "monthly_deliverables: staff select"  -- no change
--   "monthly_deliverables: admin insert"  -- no change
--   "monthly_deliverables: admin update"  -- no change (admin keeps full update)
--   "monthly_deliverables: admin delete"  -- no change
--
-- How the new policy works with permissive OR logic
-- -------------------------------------------------
-- PostgreSQL ORs permissive policies. So:
--   Admin sets any status:
--     admin policy WITH CHECK → is_admin() = true → PASS
--   Team sets allowed status (to_do / in_progress / ready_internal_review / ready_client_approval):
--     admin policy WITH CHECK → is_admin() = false → FAIL
--     staff policy WITH CHECK → is_staff() AND status IN (allowed) → true AND true → PASS
--   Team sets disallowed status (approved / scheduled / etc.):
--     admin policy WITH CHECK → false → FAIL
--     staff policy WITH CHECK → is_staff() AND status IN (allowed) → true AND false → FAIL
--     Combined → FAIL → blocked ✓
--
-- Column-level note
-- -----------------
-- RLS cannot enforce "only production_status changed" at the row level
-- without a security-definer function or a trigger. The frontend only
-- sends production_status in updateMonthlyDeliverableStatus(). The
-- updated_at trigger fires automatically. No other fields are sent.
-- If stricter column isolation is required later, add a security-definer
-- RPC (e.g. rpc_staff_set_production_status) that accepts (id, status)
-- and performs the update server-side.
--
-- NOT APPLIED YET. Review docs/staff-status-rls-check.md before running.
-- ============================================================

-- Idempotent: drop if an earlier draft of this policy exists.
drop policy if exists "monthly_deliverables: staff production status update"
  on public.monthly_deliverables;

-- Allow authenticated staff/team members to update production_status
-- to the four production-tracking values only.
-- Admins are unaffected: they continue to pass via the existing
-- "monthly_deliverables: admin update" policy (is_admin() WITH CHECK).
create policy "monthly_deliverables: staff production status update"
  on public.monthly_deliverables for update
  using (is_staff())
  with check (
    is_staff()
    and production_status in (
      'to_do',
      'in_progress',
      'ready_internal_review',
      'ready_client_approval'
    )
  );
