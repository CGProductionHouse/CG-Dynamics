-- ============================================================================
-- phase-24d — Active-client industry profiles (AI Workforce V2)
--
-- Admin-only, evidence-backed classification of ACTIVE clients. Industry is NEVER
-- inferred from a name: every active client is seeded as needs_research and only
-- promoted when official evidence is recorded. No inactive client is imported.
-- Additive and idempotent.
-- ============================================================================

create table if not exists public.client_industry_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  client_name text not null,
  official_website text,
  official_channels jsonb not null default '[]'::jsonb,
  primary_industry text,
  secondary_industry text,
  business_model text,
  primary_buyer text,
  other_decision_makers text,
  products_services text,
  geography text,
  sales_path text,
  confidence text not null default 'needs_research'
    check (confidence in ('high', 'medium', 'low', 'needs_research')),
  evidence_links jsonb not null default '[]'::jsonb,
  research_date date,
  review_state text not null default 'needs_research'
    check (review_state in ('draft', 'needs_research', 'needs_client_confirmation', 'needs_internal_review', 'reviewed', 'active', 'deprecated')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_industry_profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_industry_profiles' and policyname='cip_admin_read') then
    create policy cip_admin_read on public.client_industry_profiles for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_industry_profiles' and policyname='cip_admin_manage') then
    create policy cip_admin_manage on public.client_industry_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Seed EVERY active client as needs_research (no guessing). Idempotent.
insert into public.client_industry_profiles (client_id, client_name)
select c.id, c.name from public.clients c
where c.active = true
  and not exists (select 1 from public.client_industry_profiles p where p.client_id = c.id);

-- Researched classifications (official-source evidence, 2026-07-25).
-- RC-Polypipe — agriculture / irrigation / low-pressure field irrigation.
update public.client_industry_profiles set
  official_website = 'https://rcpolypipe.com/',
  primary_industry = 'Agriculture',
  secondary_industry = 'Irrigation & farm water management (low-pressure field irrigation)',
  business_model = 'Manufactures and sells HDPE field-irrigation piping to farmers',
  primary_buyer = 'Commercial and emerging farmers needing affordable field irrigation',
  products_services = 'UV-treated high-density polyethylene irrigation pipe (multiple diameters), for level or slightly-downgraded farmland',
  geography = 'South Africa',
  sales_path = 'Enquiry via WhatsApp / email; minimum order by weight',
  confidence = 'high',
  evidence_links = '["https://rcpolypipe.com/"]'::jsonb,
  research_date = current_date,
  review_state = 'needs_internal_review',
  notes = 'Classified from official site. NOT a general civil-pipe/plumbing/construction account. '
       || 'Product limits: level terrain only, cannot pump uphill, min ~1.8 m water head, pump 150k-350k L/h. '
       || 'The "94% more cost-effective" figure is a CLIENT-PUBLISHED marketing claim, not independent proof.',
  updated_at = now()
where client_id = '4f6106de-c437-404e-8cef-fbe848de0665';

-- Case Bloemfontein — agriculture / agricultural machinery dealership.
update public.client_industry_profiles set
  official_website = 'https://casebloemfontein.co.za/',
  primary_industry = 'Agriculture',
  secondary_industry = 'Agricultural machinery — equipment dealership & after-sales support',
  business_model = 'Multi-brand equipment dealership: sales, parts, workshop/service',
  primary_buyer = 'Commercial farmers and agricultural producers (Free State)',
  other_decision_makers = 'Farm managers, operators, procurement; construction & landscaping buyers for secondary lines',
  products_services = 'Case IH (tractors, harvesters, planters/seeding, tillage, hay & forage, application, precision, Northmec implements); CASE construction machinery; Husqvarna outdoor power; parts division; workshop & technical support',
  geography = 'Free State, South Africa (Bloemfontein & Ladybrand)',
  sales_path = 'Dealership enquiry; sales + parts + after-sales service',
  confidence = 'high',
  evidence_links = '["https://casebloemfontein.co.za/"]'::jsonb,
  research_date = current_date,
  review_state = 'needs_internal_review',
  notes = 'Primary classification is agricultural machinery/dealership — NOT reducible to product posters. '
       || 'Secondary: CASE construction machinery, Husqvarna outdoor power, parts & workshop/after-sales.',
  updated_at = now()
where client_id = '079df21e-783a-4648-b3fa-0acae6e68867';
