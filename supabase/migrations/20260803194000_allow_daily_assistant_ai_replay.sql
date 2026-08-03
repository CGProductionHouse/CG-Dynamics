-- Allow the personal daily assistant to use the same short-lived,
-- service-only idempotency replay mechanism as the existing debrief flows.

alter table public.ai_usage_replays
  drop constraint if exists ai_usage_replays_kind_check;

alter table public.ai_usage_replays
  add constraint ai_usage_replays_kind_check
  check (kind in (
    'text_response',
    'suggestion_response',
    'debrief_transcript',
    'meeting_debrief_draft',
    'content_run_debrief_draft',
    'daily_assistant_draft'
  ));

create or replace function public.ai_finalize_usage_with_replay(
  p_request_id uuid,
  p_status text,
  p_latency_ms integer default null,
  p_safe_error_code text default null,
  p_billing_uncertain boolean default false,
  p_replay_fingerprint text default null,
  p_replay_kind text default null,
  p_replay_actor_id uuid default null,
  p_replay_payload jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_has_replay boolean := p_replay_kind is not null or p_replay_payload is not null
    or p_replay_fingerprint is not null or p_replay_actor_id is not null;
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if v_has_replay then
    if p_status <> 'succeeded'
      or p_replay_fingerprint is null or p_replay_actor_id is null or p_replay_payload is null
      or p_replay_kind not in (
        'text_response',
        'suggestion_response',
        'debrief_transcript',
        'meeting_debrief_draft',
        'content_run_debrief_draft',
        'daily_assistant_draft'
      )
      or p_replay_fingerprint !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(p_replay_payload) <> 'object'
      or octet_length(p_replay_payload::text) > 262144
      or not public.ai_replay_payload_is_safe(p_replay_payload) then
      raise exception 'Invalid AI replay';
    end if;
    if not exists (
      select 1 from public.ai_usage_requests request
      where request.id = p_request_id and request.actor_id = p_replay_actor_id
        and request.fingerprint = p_replay_fingerprint
        and request.status in ('reserved', 'succeeded')
    ) then
      raise exception 'AI replay request mismatch';
    end if;
    delete from public.ai_usage_replays where expires_at <= now();
    insert into public.ai_usage_replays(request_id, actor_id, fingerprint, kind, payload, expires_at)
    values (p_request_id, p_replay_actor_id, p_replay_fingerprint, p_replay_kind,
      p_replay_payload, now() + interval '15 minutes')
    on conflict (request_id, kind) do update set
      payload = excluded.payload, expires_at = excluded.expires_at, created_at = now();
  end if;
  v_result := public.ai_finalize_usage(
    p_request_id, p_status, p_latency_ms, p_safe_error_code, p_billing_uncertain
  );
  return v_result;
end;
$$;

revoke all on function public.ai_finalize_usage_with_replay(
  uuid, text, integer, text, boolean, text, text, uuid, jsonb
) from public, anon, authenticated;

grant execute on function public.ai_finalize_usage_with_replay(
  uuid, text, integer, text, boolean, text, text, uuid, jsonb
) to service_role;