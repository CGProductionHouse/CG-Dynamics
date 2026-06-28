-- ============================================================
-- CG Dynamics - Phase 4b CG Assistant audit logging
-- Run this once in the Supabase SQL editor before deploying the
-- cg-assistant-chat Edge Function in production.
--
-- This stores minimal request metadata for staff-facing assistant usage.
-- It does not store API keys, tool outputs, finance data, payroll data, or
-- confidential source records.
-- ============================================================

create table if not exists cg_assistant_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  role text,
  message text not null,
  prompt_category text,
  response_status text not null,
  restricted boolean not null default false,
  model text,
  tool_names text[] not null default '{}',
  error_message text,
  created_at timestamptz not null default now()
);

alter table cg_assistant_audit_logs
  add column if not exists prompt_category text;

alter table cg_assistant_audit_logs enable row level security;

drop policy if exists "cg assistant audit: admin read" on cg_assistant_audit_logs;
create policy "cg assistant audit: admin read"
  on cg_assistant_audit_logs for select using (is_admin());

-- Writes are performed by the server-side Edge Function using the server role.
-- There is intentionally no browser insert/update/delete policy.
