-- Phase 29b: close production advisor findings without changing business data.
-- Additive and idempotent.

create or replace view public.platform_knowledge_refresh_queue
with (security_invoker = true, security_barrier = true)
as
select
  k.id,
  k.platform_expert_id,
  p.slug as platform_slug,
  k.surface_id,
  k.title,
  k.knowledge_state,
  k.channel,
  k.confidence,
  k.evidence_strength,
  k.territory,
  k.last_verified_at,
  k.expires_at,
  case
    when k.knowledge_state in ('stale', 'retired') then 'retired_or_stale'
    when k.knowledge_state = 'disputed' then 'disputed'
    when k.expires_at is not null and k.expires_at < current_date then 'expired'
    when k.last_verified_at is null then 'never_verified'
    when k.last_verified_at < current_date - interval '120 days' then 'overdue_reverify'
    else 'ok'
  end as refresh_reason
from public.platform_knowledge_items k
join public.platform_experts p on p.id = k.platform_expert_id
where
  public.is_admin()
  and (
    k.knowledge_state in ('stale', 'retired', 'disputed')
    or (k.expires_at is not null and k.expires_at < current_date)
    or k.last_verified_at is null
    or k.last_verified_at < current_date - interval '120 days'
  );

comment on view public.platform_knowledge_refresh_queue is
  'Admin-only platform knowledge re-verification queue. Runs with caller rights so base-table RLS remains authoritative.';

revoke all on public.platform_knowledge_refresh_queue from public, anon;
grant select on public.platform_knowledge_refresh_queue to authenticated;

alter function public.is_staff() set search_path = public, pg_temp;
alter function public.is_manager() set search_path = public, pg_temp;
alter function public.is_admin() set search_path = public, pg_temp;
alter function public.my_client_id() set search_path = public, pg_temp;

revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_manager() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.my_client_id() from public, anon;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_client_id() to authenticated;

-- This function is an auth.users trigger target, not a public RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
