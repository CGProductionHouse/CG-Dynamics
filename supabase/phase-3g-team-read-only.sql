-- ============================================================
-- CG Dynamics - Phase 3g global read-only team role
-- Run this once in the Supabase SQL editor.
--
-- Team members get GLOBAL READ-ONLY access:
--   * read all clients, reports, posts, imported data
--   * cannot create / edit / delete / import / publish anything
--   * cannot manage users or invites
-- Admins keep full write access. Clients are unchanged (own data only).
--
-- This is the real enforcement layer — the UI also hides write actions,
-- but these policies are what actually block a team member from writing.
-- ============================================================

-- ── A. TEAM INVITES ARE NOT LINKED TO A CLIENT ───────────────
-- A team invite has no client, so client_id must be allowed to be null.
alter table client_invites alter column client_id drop not null;


-- ── B. SPLIT "staff full access" INTO read (staff) + write (admin) ──
-- Previously is_staff() (admin OR team) had full ALL access on these
-- tables, which let team members write. We replace each ALL policy with
-- a staff SELECT policy plus admin-only insert/update/delete policies.

-- reports ----------------------------------------------------------------
drop policy if exists "reports: staff full access" on reports;

create policy "reports: staff read all"
  on reports for select using (is_staff());
create policy "reports: admin insert"
  on reports for insert with check (is_admin());
create policy "reports: admin update"
  on reports for update using (is_admin()) with check (is_admin());
create policy "reports: admin delete"
  on reports for delete using (is_admin());

-- posts ------------------------------------------------------------------
drop policy if exists "posts: staff full access" on posts;

create policy "posts: staff read all"
  on posts for select using (is_staff());
create policy "posts: admin insert"
  on posts for insert with check (is_admin());
create policy "posts: admin update"
  on posts for update using (is_admin()) with check (is_admin());
create policy "posts: admin delete"
  on posts for delete using (is_admin());

-- imported_meta_posts ----------------------------------------------------
drop policy if exists "imported_meta_posts: staff full access" on imported_meta_posts;

create policy "imported_meta_posts: staff read all"
  on imported_meta_posts for select using (is_staff());
create policy "imported_meta_posts: admin insert"
  on imported_meta_posts for insert with check (is_admin());
create policy "imported_meta_posts: admin update"
  on imported_meta_posts for update using (is_admin()) with check (is_admin());
create policy "imported_meta_posts: admin delete"
  on imported_meta_posts for delete using (is_admin());

-- client_requests --------------------------------------------------------
drop policy if exists "client_requests: staff full access" on client_requests;

create policy "client_requests: staff read all"
  on client_requests for select using (is_staff());
create policy "client_requests: admin write"
  on client_requests for all using (is_admin()) with check (is_admin());

-- NOTE: `clients` already restricts writes to admins (admin insert/update/
-- delete) with staff read, and `client_invites` is already admin-only, so
-- team members are read-only there without further change.
