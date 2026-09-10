-- MCP dual-principal audit (#319).
-- Prepared only. Do not apply to production without explicit CA approval.
--
-- CG Production House shares ONE communal ChatGPT account with ONE OAuth connection signed
-- in as the company admin. The OAuth principal is therefore NOT the staff identity, so the
-- write audit must record BOTH:
--   • the communal connection principal that authorised the call, and
--   • the effective Project context the call actually acted for.
--
-- Additive only: existing columns, the unique index and the original
-- mcp_record_idempotency(uuid,text,uuid,text,text) signature are unchanged, so an
-- un-migrated environment keeps working.

alter table public.mcp_idempotency_log
  add column if not exists connection_principal_user_id uuid,
  add column if not exists effective_context_kind text,
  add column if not exists effective_staff_profile_id uuid references public.profiles(id) on delete restrict,
  add column if not exists effective_client_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mcp_idempotency_log_effective_context_kind'
  ) then
    alter table public.mcp_idempotency_log
      add constraint mcp_idempotency_log_effective_context_kind
      check (effective_context_kind is null or effective_context_kind in ('staff', 'client', 'company_admin'));
  end if;
end $$;

comment on column public.mcp_idempotency_log.connection_principal_user_id is
  'Communal OAuth/admin auth user that authorised the connector call. Never the effective Project subject.';
comment on column public.mcp_idempotency_log.effective_context_kind is
  'Project context the call acted for: staff, client or company_admin.';
comment on column public.mcp_idempotency_log.effective_staff_profile_id is
  'Exact canonical staff profile the call acted as, when effective_context_kind = staff.';
comment on column public.mcp_idempotency_log.effective_client_id is
  'Exact canonical client the call was pinned to, when effective_context_kind = client.';

create index if not exists mcp_idempotency_log_effective_context_idx
  on public.mcp_idempotency_log (effective_context_kind, effective_staff_profile_id, effective_client_id);

-- New overload. The original function is left in place as the fallback path.
create or replace function public.mcp_record_idempotency_with_context(
  p_caller_profile_id uuid,
  p_tool_name text,
  p_idempotency_key uuid,
  p_input_hash text,
  p_result_status text,
  p_connection_principal_user_id uuid,
  p_effective_context_kind text,
  p_effective_staff_profile_id uuid,
  p_effective_client_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mcp_idempotency_log (
    caller_profile_id, tool_name, idempotency_key, input_hash, result_status,
    connection_principal_user_id, effective_context_kind,
    effective_staff_profile_id, effective_client_id
  ) values (
    p_caller_profile_id, p_tool_name, p_idempotency_key, p_input_hash, p_result_status,
    p_connection_principal_user_id, p_effective_context_kind,
    p_effective_staff_profile_id, p_effective_client_id
  );
end;
$$;

revoke all on function public.mcp_record_idempotency_with_context(uuid, text, uuid, text, text, uuid, text, uuid, uuid) from public;
grant execute on function public.mcp_record_idempotency_with_context(uuid, text, uuid, text, text, uuid, text, uuid, uuid) to service_role;
