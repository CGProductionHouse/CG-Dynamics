-- ============================================================
-- CG Dynamics — Phase 5c TikTok client-account mapping + fixes
--
-- Adds explicit, durable client_id to tiktok_connections so
-- every sync/publish/status request resolves to an exact
-- TikTok account ↔ CG client pair. Never use "first connected".
--
-- Also adds client_id to tiktok_oauth_states so the OAuth
-- callback knows which CG client the connection is for.
--
-- Also adds content_guideline_id and monthly_deliverable_id to
-- tiktok_publish_receipts so publishing integrates with the
-- canonical Content Run / approval workflow.
-- ============================================================


-- ── 1. Add client_id to tiktok_connections ──────────────────
-- Each TikTok connection is explicitly bound to one CG client.
-- A sync or publish for Client A cannot use Client B's connection.

alter table public.tiktok_connections
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

create index if not exists tiktok_connections_client_idx
  on public.tiktok_connections (client_id);

-- Unique constraint: one active TikTok connection per client
-- (allows multiple historical/revoked rows, but only one active)
CREATE UNIQUE INDEX IF NOT EXISTS tiktok_connections_one_active_per_client
  ON public.tiktok_connections (client_id)
  WHERE status = 'connected';


-- ── 2. Add client_id to tiktok_oauth_states ─────────────────
-- OAuth callback needs to know which CG client the connection is for.

alter table public.tiktok_oauth_states
  add column if not exists client_id uuid references public.clients(id) on delete cascade;


-- ── 3. Add canonical content linkage to publish receipts ────

alter table public.tiktok_publish_receipts
  add column if not exists content_guideline_id uuid references public.content_guidelines(id) on delete set null;

alter table public.tiktok_publish_receipts
  add column if not exists monthly_deliverable_id uuid references public.monthly_deliverables(id) on delete set null;

comment on column public.tiktok_publish_receipts.content_guideline_id is
  'Canonical content guideline this publish targets. Required for real publish.';

comment on column public.tiktok_publish_receipts.monthly_deliverable_id is
  'Canonical monthly deliverable this publish targets. Required for real publish.';


-- ── 3. Add approval status to publish receipts ──────────────
-- Publishing requires explicit approval gate.

alter table public.tiktok_publish_receipts
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected','expired'));

alter table public.tiktok_publish_receipts
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

alter table public.tiktok_publish_receipts
  add column if not exists approved_at timestamptz;

comment on column public.tiktok_publish_receipts.approval_status is
  'Approval gate for external publishing. Must be approved before provider write.';
