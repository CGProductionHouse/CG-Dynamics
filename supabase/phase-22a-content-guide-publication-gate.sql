-- ============================================================================
-- Phase 22a: Content guide publication gating
--
-- Adds a client_published_at timestamp to content_guide_ideas so staff can
-- gate individual guides for client visibility. A guide is client-visible only
-- when client_published_at IS NOT NULL. The existing status field remains for
-- internal workflow (idea → needs_review → approved → ...).
--
-- Also adds a client-safe RPC for the client portal to read published guides.
--
-- Read-only RPCs only — clients can never insert/update/delete.
-- ============================================================================

-- ── Add publication-gating column ──────────────────────────────────────────
alter table public.content_guide_ideas
  add column if not exists client_published_at timestamptz;

comment on column public.content_guide_ideas.client_published_at is
  'When set, the guide is visible to the client in their portal. Null means staff-only.';


-- ── Client-safe published guides RPC ────────────────────────────────────────
-- Returns only guides that have been published (client_published_at IS NOT NULL)
-- and whose status is approved or completed. Only exposes client-safe fields.

drop function if exists public.client_portal_published_guides(uuid, date);

create function public.client_portal_published_guides(
  p_client_id uuid,
  p_month date
)
returns table (
  row_key text,
  title text,
  deliverable_title text,
  objective text,
  hook text,
  script text,
  shot_breakdown text,
  cta text,
  visual_notes text,
  platform text,
  format text,
  canonical_name text,
  video_number int,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with caller as (
    select
      case
        when public.is_staff() then p_client_id
        else public.my_client_id()
      end as allowed_client_id
  )
  select
    'guide-' || substr(md5(g.id::text), 1, 16) as row_key,
    g.title,
    md.title as deliverable_title,
    g.objective,
    g.hook,
    g.script,
    g.shot_breakdown,
    g.cta,
    g.visual_notes,
    g.platform,
    g.format,
    g.canonical_name,
    g.video_number,
    g.client_published_at
  from public.content_guide_ideas g
  left join public.monthly_deliverables md on md.id = g.deliverable_id
  cross join caller c
  where c.allowed_client_id is not null
    and g.client_id = c.allowed_client_id
    and g.month = to_char(p_month, 'YYYY-MM')
    and g.client_published_at is not null
    and g.status in ('approved', 'completed')
  order by g.video_number nulls last, g.title;
$$;

revoke all on function public.client_portal_published_guides(uuid, date) from public, anon;
grant execute on function public.client_portal_published_guides(uuid, date) to authenticated;

comment on function public.client_portal_published_guides is
  'Returns client-safe published content guides for a given month. Staff may pass p_client_id for preview.';
