-- ============================================================================
-- phase-25a — Social platform knowledge completion (AI Workforce social master)
--
-- Completes the phase-18b Platform Expert system for social media:
--   1. Organic vs paid distinction on surfaces AND knowledge (kept distinct).
--   2. Evidence strength on each knowledge item (mission requirement).
--   3. A change log so knowledge freshness / verification is tracked over time.
--   4. A refresh-review queue view surfacing knowledge that needs re-verification
--      (stale/retired/expired, or verified_current not re-checked in 120 days).
--
-- Additive and idempotent. RLS: admin manages; staff read (change log read-only).
-- No knowledge is seeded here (that is a reviewed data step). AI-generated output
-- is never a trusted source; unverified platform mechanics are never staff-visible.
-- ============================================================================

-- 1. Organic vs paid on surfaces (a surface can be organic, paid or shared).
alter table public.platform_surfaces
  add column if not exists surface_type text not null default 'organic'
    check (surface_type in ('organic', 'paid', 'shared'));

-- 2. Organic/paid channel + evidence strength on knowledge items.
alter table public.platform_knowledge_items
  add column if not exists channel text not null default 'organic'
    check (channel in ('organic', 'paid', 'both')),
  add column if not exists evidence_strength text not null default 'moderate'
    check (evidence_strength in ('strong', 'moderate', 'weak', 'anecdotal')),
  add column if not exists is_metric_definition boolean not null default false;

-- 3. Change log: every state / verification change is attributable.
create table if not exists public.platform_knowledge_change_log (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid not null references public.platform_knowledge_items(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  change_type text not null check (change_type in (
    'created', 'verified', 'state_change', 'edited', 'expired', 'retired', 'source_updated'
  )),
  previous_state text,
  new_state text,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.platform_knowledge_change_log is
  'Audit trail of Platform Expert knowledge changes: verification events and state transitions so freshness is provable.';

create index if not exists idx_platform_change_log_item on public.platform_knowledge_change_log(knowledge_item_id);
create index if not exists idx_platform_change_log_created on public.platform_knowledge_change_log(created_at);

alter table public.platform_knowledge_change_log enable row level security;

drop policy if exists "platform_change_log: admin all" on public.platform_knowledge_change_log;
create policy "platform_change_log: admin all"
  on public.platform_knowledge_change_log for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "platform_change_log: staff read" on public.platform_knowledge_change_log;
create policy "platform_change_log: staff read"
  on public.platform_knowledge_change_log for select
  using (public.is_staff());

-- 4. Refresh-review queue: what an admin needs to re-verify. Includes explicitly
--    stale/retired/disputed/expired items AND current items not re-verified in
--    120 days. SECURITY INVOKER view — RLS on the base table still applies.
create or replace view public.platform_knowledge_refresh_queue as
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
  k.knowledge_state in ('stale', 'retired', 'disputed')
  or (k.expires_at is not null and k.expires_at < current_date)
  or k.last_verified_at is null
  or k.last_verified_at < current_date - interval '120 days';

comment on view public.platform_knowledge_refresh_queue is
  'Platform knowledge needing re-verification. Admins use this to keep social-platform facts current; staff never rely on stale mechanics.';
