-- MCP connector: caller-scoped idempotency log for write tools.
-- Prepared only. Do not apply to production without explicit CA approval.

create table if not exists public.mcp_idempotency_log (
  id uuid primary key default gen_random_uuid(),
  caller_profile_id uuid not null references public.profiles(id) on delete restrict,
  tool_name text not null,
  idempotency_key uuid not null,
  input_hash text not null,
  result_status text not null default 'success',
  created_at timestamptz not null default now(),
  constraint mcp_idempotency_log_tool_name check (char_length(tool_name) between 1 and 80),
  constraint mcp_idempotency_log_result_status check (result_status in ('success', 'error', 'idempotent_repeat'))
);

comment on table public.mcp_idempotency_log is
  'Append-only audit of MCP write-tool invocations. One row per (caller, tool, idempotency_key). Duplicate calls return the original result without re-executing the mutation.';

create unique index if not exists mcp_idempotency_log_caller_tool_key_idx
  on public.mcp_idempotency_log (caller_profile_id, tool_name, idempotency_key);

alter table public.mcp_idempotency_log enable row level security;

drop policy if exists "MCP idempotency log is service-managed" on public.mcp_idempotency_log;
-- No direct authenticated read/write. The Edge Function uses service role.
revoke all on public.mcp_idempotency_log from anon, authenticated;

create or replace function public.mcp_check_idempotency(
  p_caller_profile_id uuid,
  p_tool_name text,
  p_idempotency_key uuid,
  p_input_hash text
)
returns table (
  already_executed boolean,
  existing_result jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing record;
begin
  select result_status, input_hash into v_existing
  from public.mcp_idempotency_log
  where caller_profile_id = p_caller_profile_id
    and tool_name = p_tool_name
    and idempotency_key = p_idempotency_key;

  if v_existing is not null then
    if v_existing.input_hash = p_input_hash then
      return query select true, jsonb_build_object(
        'status', v_existing.result_status,
        'message', 'Idempotent repeat — original result returned without re-execution.'
      );
    else
      return query select true, jsonb_build_object(
        'status', 'conflict',
        'message', 'Same idempotency key used with different inputs. Provide a new key.'
      );
    end if;
  else
    return query select false, null::jsonb;
  end if;
end;
$$;

revoke all on function public.mcp_check_idempotency(uuid, text, uuid, text) from public;
grant execute on function public.mcp_check_idempotency(uuid, text, uuid, text) to service_role;

create or replace function public.mcp_record_idempotency(
  p_caller_profile_id uuid,
  p_tool_name text,
  p_idempotency_key uuid,
  p_input_hash text,
  p_result_status text default 'success'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mcp_idempotency_log (
    caller_profile_id, tool_name, idempotency_key, input_hash, result_status
  ) values (
    p_caller_profile_id, p_tool_name, p_idempotency_key, p_input_hash, p_result_status
  );
end;
$$;

revoke all on function public.mcp_record_idempotency(uuid, text, uuid, text, text) from public;
grant execute on function public.mcp_record_idempotency(uuid, text, uuid, text, text) to service_role;
