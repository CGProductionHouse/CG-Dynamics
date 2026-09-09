-- Canonical private client contacts and caption-footer policy (#294 / #241).
-- Repo-only preparation: production application and data backfill remain approval-gated.
begin;

alter table public.skill_cards
  add column if not exists client_scope_key text;

comment on column public.skill_cards.client_scope_key is
  'Optional exact entity/sub-brand/branch key. Scoped retrieval never falls back to another or unscoped entity.';

create index if not exists idx_skill_cards_exact_client_scope
  on public.skill_cards (active_client_id, client_scope_key, status)
  where client_specific = true;

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  scope_key text,
  scope_label text,
  contact_type text not null check (contact_type in (
    'phone','whatsapp','email','website','address','booking','quote','order','other'
  )),
  display_label text not null check (length(trim(display_label)) > 0),
  person_name text,
  person_role text,
  value text not null check (length(trim(value)) > 0),
  approved_for_caption boolean not null default false,
  blocks_caption boolean not null default false,
  visibility text not null default 'unverified_hold' check (visibility in (
    'public_marketing','internal_only','client_portal_only','unverified_hold'
  )),
  allowed_purposes text[] not null default '{}',
  provenance_summary text not null check (length(trim(provenance_summary)) > 0),
  source_reference text,
  observed_at timestamptz,
  last_verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  freshness_state text not null default 'stale_unverified' check (freshness_state in (
    'current_verified','possible_change','stale_unverified','historical','rejected'
  )),
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active','superseded')),
  superseded_by_contact_id uuid references public.client_contacts(id) on delete set null,
  platforms text[] not null default '{}',
  content_modes text[] not null default '{}',
  footer_order integer not null default 100 check (footer_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope_key is null or length(trim(scope_key)) > 0),
  check (not approved_for_caption or visibility = 'public_marketing'),
  check (lifecycle_state <> 'superseded' or superseded_by_contact_id is not null),
  check (superseded_by_contact_id is null or superseded_by_contact_id <> id)
);

create index if not exists idx_client_contacts_runtime
  on public.client_contacts (client_id, scope_key, lifecycle_state, visibility, freshness_state);

create unique index if not exists uq_client_contacts_identity_value
  on public.client_contacts (client_id, coalesce(scope_key, ''), contact_type, value);

create table if not exists public.client_contact_footer_policies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  scope_key text,
  scope_label text,
  content_mode text not null default 'caption' check (length(trim(content_mode)) > 0),
  platform text,
  requirement text not null default 'optional' check (requirement in ('mandatory','optional','omitted')),
  format_template text,
  review_state text not null default 'unverified_hold' check (review_state in ('current_verified','unverified_hold')),
  provenance_summary text not null check (length(trim(provenance_summary)) > 0),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope_key is null or length(trim(scope_key)) > 0),
  check (platform is null or length(trim(platform)) > 0)
);

create unique index if not exists uq_client_footer_policy_scope_mode_platform
  on public.client_contact_footer_policies (
    client_id,
    coalesce(scope_key, ''),
    content_mode,
    coalesce(platform, '')
  );

alter table public.client_contacts enable row level security;
alter table public.client_contact_footer_policies enable row level security;

drop policy if exists client_contacts_manager_all on public.client_contacts;
drop policy if exists client_contacts_manager_insert on public.client_contacts;
create policy client_contacts_manager_insert on public.client_contacts
  for insert with check (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager')
  ));
drop policy if exists client_contacts_manager_update on public.client_contacts;
create policy client_contacts_manager_update on public.client_contacts
  for update using (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager')
  )) with check (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager')
  ));
drop policy if exists client_contacts_staff_read on public.client_contacts;
create policy client_contacts_staff_read on public.client_contacts
  for select using (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
  ));

drop policy if exists client_contact_footer_policies_manager_all on public.client_contact_footer_policies;
create policy client_contact_footer_policies_manager_all on public.client_contact_footer_policies
  for all using (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager')
  )) with check (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager')
  ));
drop policy if exists client_contact_footer_policies_staff_read on public.client_contact_footer_policies;
create policy client_contact_footer_policies_staff_read on public.client_contact_footer_policies
  for select using (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
  ));

revoke all on table public.client_contacts from anon;
revoke all on table public.client_contact_footer_policies from anon;
grant select on table public.client_contacts to authenticated;
grant select on table public.client_contact_footer_policies to authenticated;
grant insert, update on table public.client_contacts to authenticated;
revoke delete on table public.client_contacts from authenticated;
grant insert, update, delete on table public.client_contact_footer_policies to authenticated;

create or replace function public.set_client_contact_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.preserve_client_contact_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.client_id is distinct from old.client_id
    or new.scope_key is distinct from old.scope_key
    or new.contact_type is distinct from old.contact_type
    or new.value is distinct from old.value then
    raise exception 'Contact identity/value is immutable; insert a successor and supersede this record';
  end if;
  if old.lifecycle_state = 'superseded' and new.lifecycle_state <> 'superseded' then
    raise exception 'A superseded contact cannot be reactivated';
  end if;
  return new;
end $$;

drop trigger if exists set_client_contacts_updated_at on public.client_contacts;
create trigger set_client_contacts_updated_at before update on public.client_contacts
  for each row execute function public.set_client_contact_updated_at();
drop trigger if exists preserve_client_contact_history on public.client_contacts;
create trigger preserve_client_contact_history before update on public.client_contacts
  for each row execute function public.preserve_client_contact_history();
drop trigger if exists set_client_footer_policies_updated_at on public.client_contact_footer_policies;
create trigger set_client_footer_policies_updated_at before update on public.client_contact_footer_policies
  for each row execute function public.set_client_contact_updated_at();

commit;
