-- Phase 12a — Meta background sync queue tables
-- Review in Supabase SQL editor before applying.
-- Adds batch-run tracking so sync operations run in the background.

-- ── 1. META SYNC BATCHES ──────────────────────────────────────
-- A parent sync run created when a user clicks "Sync now".
-- Groups many client×month items into one operation.

create table if not exists public.meta_sync_batches (
  id                uuid primary key default gen_random_uuid(),
  mode              text not null check (mode in ('all','selected')),
  requested_by      uuid references public.profiles(id) on delete set null,
  status            text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  sync_range_months int not null default 3,
  total_items       int not null default 0,
  completed_items   int not null default 0,
  failed_items      int not null default 0,
  started_at        timestamptz,
  finished_at       timestamptz,
  summary           jsonb not null default '{}'::jsonb,
  error             text,
  created_at        timestamptz not null default now()
);

create index if not exists meta_sync_batches_status_idx
  on public.meta_sync_batches (status);

create index if not exists meta_sync_batches_created_idx
  on public.meta_sync_batches (created_at desc);

-- ── 2. META SYNC BATCH ITEMS ──────────────────────────────────
-- One row per client×month within a batch.
-- The worker processes these and updates status.

create table if not exists public.meta_sync_batch_items (
  id                uuid primary key default gen_random_uuid(),
  batch_id          uuid not null references public.meta_sync_batches(id) on delete cascade,
  client_id         uuid not null references public.clients(id) on delete cascade,
  client_name       text not null,
  month             text not null,
  status            text not null default 'queued' check (status in ('queued','running','completed','warning','failed','skipped')),
  attempts          int not null default 0,
  posts_synced      int not null default 0,
  reports_created   int not null default 0,
  reports_reused    int not null default 0,
  reports_updated   int not null default 0,
  warnings          jsonb not null default '[]'::jsonb,
  error             text,
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists meta_sync_batch_items_batch_idx
  on public.meta_sync_batch_items (batch_id);

create index if not exists meta_sync_batch_items_status_idx
  on public.meta_sync_batch_items (status);

-- ── 3. RLS — staff/admin select only ──────────────────────────

alter table public.meta_sync_batches enable row level security;
alter table public.meta_sync_batch_items enable row level security;

drop policy if exists "meta_sync_batches: staff select"
  on public.meta_sync_batches;

create policy "meta_sync_batches: staff select"
  on public.meta_sync_batches for select
  using (
    coalesce(
      (select role from public.profiles where id = auth.uid()) in ('admin','team'),
      false
    )
  );

drop policy if exists "meta_sync_batch_items: staff select"
  on public.meta_sync_batch_items;

create policy "meta_sync_batch_items: staff select"
  on public.meta_sync_batch_items for select
  using (
    coalesce(
      (select role from public.profiles where id = auth.uid()) in ('admin','team'),
      false
    )
  );

-- Service-role inserts/updates are handled by Edge Functions
-- (bypass RLS via the service_role key).

-- ── 4. ATOMIC CLAIM RPC ───────────────────────────────────────
-- Used by meta-sync-worker to safely claim queued items without
-- two workers racing on the same rows. Uses FOR UPDATE SKIP LOCKED
-- within a single atomic statement.

create or replace function public.claim_sync_batch_items(
  p_limit integer default 5,
  p_batch_id uuid default null
)
returns table (
  id                uuid,
  batch_id          uuid,
  client_id         uuid,
  client_name       text,
  month             text,
  status            text,
  attempts          int,
  posts_synced      int,
  reports_created   int,
  reports_reused    int,
  reports_updated   int,
  warnings          jsonb,
  error             text,
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz
)
language plpgsql
as $$
begin
  return query
  with claimed as (
    select i.id
    from public.meta_sync_batch_items i
    where i.status = 'queued'
      and (p_batch_id is null or i.batch_id = p_batch_id)
    order by i.created_at asc
    limit p_limit
    for update skip locked
  )
  update public.meta_sync_batch_items i
  set
    status = 'running',
    attempts = i.attempts + 1,
    started_at = now()
  from claimed
  where i.id = claimed.id
  returning i.*;
end;
$$;

-- ── 5. BATCH RECALCULATE RPC ──────────────────────────────────
-- Called after worker finishes processing items to update parent
-- batch totals and status. Idempotent — safe to call repeatedly.

create or replace function public.recalculate_batch_status(
  p_batch_id uuid
)
returns void
language plpgsql
as $$
declare
  v_total        int;
  v_completed    int;
  v_failed       int;
  v_running      int;
  v_queued       int;
begin
  select
    count(*),
    count(*) filter (where status in ('completed','warning','skipped')),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'running'),
    count(*) filter (where status = 'queued')
  into v_total, v_completed, v_failed, v_running, v_queued
  from public.meta_sync_batch_items
  where batch_id = p_batch_id;

  update public.meta_sync_batches
  set
    completed_items = v_completed,
    failed_items    = v_failed,
    status          = case
                        when v_queued = 0 and v_running = 0 then 'completed'
                        else 'running'
                      end,
    finished_at     = case
                        when v_queued = 0 and v_running = 0 then now()
                        else finished_at
                      end
  where id = p_batch_id;
end;
$$;
