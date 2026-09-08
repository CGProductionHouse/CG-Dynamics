-- Issue #305: one exact staff profile -> one personal Dynamics workspace.
-- Prepared only. Do not apply to production without explicit CA approval.

create table if not exists public.staff_assistant_profiles (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  responsibilities text[] not null default '{}',
  recurring_duties text[] not null default '{}',
  working_preferences text[] not null default '{}',
  output_preferences text[] not null default '{}',
  lead_research_criteria text[] not null default '{}',
  repeated_corrections text[] not null default '{}',
  common_task_types text[] not null default '{}',
  approved_access_scope text[] not null default '{}',
  chatgpt_project_name text,
  chatgpt_project_url text,
  chatgpt_project_reference text,
  project_instructions text not null default '',
  instructions_version integer not null default 1 check (instructions_version > 0),
  instructions_refreshed_at timestamptz,
  instructions_applied_at timestamptz,
  profile_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_assistant_project_name_length check (char_length(coalesce(chatgpt_project_name, '')) <= 160),
  constraint staff_assistant_project_url_length check (char_length(coalesce(chatgpt_project_url, '')) <= 500),
  constraint staff_assistant_project_reference_length check (char_length(coalesce(chatgpt_project_reference, '')) <= 200),
  constraint staff_assistant_instructions_length check (char_length(project_instructions) <= 12000),
  constraint staff_assistant_project_url_safe check (
    chatgpt_project_url is null
    or chatgpt_project_url = ''
    or chatgpt_project_url ~ '^https://chatgpt\.com/(g/|project/|projects/)'
  )
);

comment on table public.staff_assistant_profiles is
  'Private durable staff operating configuration and recoverable ChatGPT Project instructions. Never stores daily tasks, schedules, client facts, tokens, or lead state.';
comment on column public.staff_assistant_profiles.chatgpt_project_reference is
  'Optional non-secret human/project reference. Hidden from the manager setup-health projection.';

alter table public.staff_assistant_profiles enable row level security;

drop policy if exists "Staff read own assistant profile" on public.staff_assistant_profiles;
create policy "Staff read own assistant profile"
on public.staff_assistant_profiles for select
using (
  profile_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_active, true)
      and p.role in ('admin', 'manager', 'staff', 'team')
  )
);

drop policy if exists "Admins read staff assistant profiles" on public.staff_assistant_profiles;
create policy "Admins read staff assistant profiles"
on public.staff_assistant_profiles for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_active, true) and p.role = 'admin'
  )
);

revoke all on public.staff_assistant_profiles from anon, authenticated;
grant select on public.staff_assistant_profiles to authenticated;

create or replace function public.save_my_staff_assistant_profile(
  p_responsibilities text[] default '{}',
  p_recurring_duties text[] default '{}',
  p_working_preferences text[] default '{}',
  p_output_preferences text[] default '{}',
  p_lead_research_criteria text[] default '{}',
  p_repeated_corrections text[] default '{}',
  p_common_task_types text[] default '{}',
  p_chatgpt_project_name text default null,
  p_chatgpt_project_url text default null,
  p_project_instructions text default '',
  p_confirm_instructions_applied boolean default false
)
returns public.staff_assistant_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_existing public.staff_assistant_profiles%rowtype;
  v_result public.staff_assistant_profiles%rowtype;
  v_project_url text := nullif(btrim(coalesce(p_chatgpt_project_url, '')), '');
  v_project_name text := nullif(btrim(coalesce(p_chatgpt_project_name, '')), '');
  v_instructions text := btrim(coalesce(p_project_instructions, ''));
  v_version integer := 1;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or not coalesce(v_profile.is_active, true)
     or v_profile.role not in ('admin', 'manager', 'staff', 'team') then
    raise exception 'Active staff profile required';
  end if;

  if v_project_url is not null and v_project_url !~ '^https://chatgpt\.com/(g/|project/|projects/)' then
    raise exception 'Only a ChatGPT Project URL can be linked';
  end if;
  if char_length(v_instructions) > 12000 then
    raise exception 'Project Instructions are too long';
  end if;

  select * into v_existing
  from public.staff_assistant_profiles
  where profile_id = auth.uid()
  for update;

  if v_existing.profile_id is not null then
    v_version := case
      when v_existing.project_instructions is distinct from v_instructions
        then v_existing.instructions_version + 1
      else v_existing.instructions_version
    end;
  end if;

  insert into public.staff_assistant_profiles (
    profile_id, responsibilities, recurring_duties, working_preferences,
    output_preferences, lead_research_criteria, repeated_corrections,
    common_task_types, chatgpt_project_name, chatgpt_project_url,
    project_instructions, instructions_version, instructions_refreshed_at,
    instructions_applied_at, profile_verified_at, updated_at
  ) values (
    auth.uid(), coalesce(p_responsibilities, '{}'), coalesce(p_recurring_duties, '{}'),
    coalesce(p_working_preferences, '{}'), coalesce(p_output_preferences, '{}'),
    coalesce(p_lead_research_criteria, '{}'), coalesce(p_repeated_corrections, '{}'),
    coalesce(p_common_task_types, '{}'), v_project_name, v_project_url,
    v_instructions, v_version, now(),
    case when p_confirm_instructions_applied then now() else null end,
    now(), now()
  )
  on conflict (profile_id) do update set
    responsibilities = excluded.responsibilities,
    recurring_duties = excluded.recurring_duties,
    working_preferences = excluded.working_preferences,
    output_preferences = excluded.output_preferences,
    lead_research_criteria = excluded.lead_research_criteria,
    repeated_corrections = excluded.repeated_corrections,
    common_task_types = excluded.common_task_types,
    chatgpt_project_name = excluded.chatgpt_project_name,
    chatgpt_project_url = excluded.chatgpt_project_url,
    project_instructions = excluded.project_instructions,
    instructions_version = excluded.instructions_version,
    instructions_refreshed_at = case
      when public.staff_assistant_profiles.project_instructions is distinct from excluded.project_instructions
        then now()
      else public.staff_assistant_profiles.instructions_refreshed_at
    end,
    instructions_applied_at = case
      when p_confirm_instructions_applied then now()
      when public.staff_assistant_profiles.project_instructions is distinct from excluded.project_instructions then null
      else public.staff_assistant_profiles.instructions_applied_at
    end,
    profile_verified_at = now(),
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.save_my_staff_assistant_profile(text[], text[], text[], text[], text[], text[], text[], text, text, text, boolean) from public;
grant execute on function public.save_my_staff_assistant_profile(text[], text[], text[], text[], text[], text[], text[], text, text, text, boolean) to authenticated;

create or replace function public.list_staff_assistant_setup_health()
returns table (
  profile_id uuid,
  full_name text,
  role text,
  is_active boolean,
  project_name text,
  project_url text,
  setup_status text,
  instructions_status text,
  last_refreshed_at timestamptz,
  profile_verified_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_active, true)
      and p.role in ('admin', 'manager')
  ) then
    raise exception 'Manager access required';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.role::text,
    coalesce(p.is_active, true),
    sap.chatgpt_project_name,
    sap.chatgpt_project_url,
    case
      when sap.profile_id is null then 'workspace_missing'
      when nullif(sap.chatgpt_project_url, '') is null then 'project_unlinked'
      when nullif(sap.project_instructions, '') is null then 'instructions_missing'
      when sap.instructions_applied_at is null then 'instructions_not_confirmed'
      else 'ready'
    end,
    case
      when sap.profile_id is null or nullif(sap.project_instructions, '') is null then 'missing'
      when sap.instructions_applied_at is null then 'generated'
      when sap.instructions_applied_at < sap.instructions_refreshed_at then 'refresh_required'
      else 'applied'
    end,
    sap.instructions_refreshed_at,
    sap.profile_verified_at
  from public.profiles p
  left join public.staff_assistant_profiles sap on sap.profile_id = p.id
  where coalesce(p.is_active, true)
    and p.role in ('admin', 'manager', 'staff', 'team')
  order by lower(coalesce(p.full_name, p.email, p.id::text));
end;
$$;

revoke all on function public.list_staff_assistant_setup_health() from public;
grant execute on function public.list_staff_assistant_setup_health() to authenticated;

create table if not exists public.business_development_leads (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  company_name text not null,
  website_url text,
  industry text,
  location text,
  contact_name text,
  contact_title text,
  contact_email text,
  contact_phone text,
  stage text not null default 'researching' check (stage in (
    'researching', 'ready_for_outreach', 'attempted_contact', 'contacted',
    'engaged', 'qualified', 'proposal_or_quote', 'converted', 'lost',
    'invalid', 'duplicate', 'do_not_contact'
  )),
  qualification_summary text,
  next_step text,
  next_step_at timestamptz,
  source_kind text not null default 'public_research',
  source_url text,
  confidence text not null default 'needs_review' check (confidence in ('needs_review', 'supported', 'verified', 'conflicting')),
  do_not_contact boolean not null default false,
  converted_client_id uuid references public.clients(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_development_company_required check (char_length(btrim(company_name)) between 1 and 200),
  constraint business_development_source_url_length check (char_length(coalesce(source_url, '')) <= 1000),
  constraint business_development_website_url_length check (char_length(coalesce(website_url, '')) <= 500),
  constraint business_development_conversion_consistent check (
    (stage = 'converted' and converted_client_id is not null)
    or (stage <> 'converted' and converted_client_id is null)
  )
);

comment on table public.business_development_leads is
  'Canonical internal CG business-development prospects. Not a client record, Planner task, Assistant memory item, or client-owned leads CRM.';

create index if not exists business_development_leads_owner_stage_idx
  on public.business_development_leads (owner_profile_id, stage, next_step_at)
  where archived_at is null;
create index if not exists business_development_leads_company_idx
  on public.business_development_leads (lower(company_name));

create or replace function public.set_business_development_lead_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_development_leads_updated_at on public.business_development_leads;
create trigger business_development_leads_updated_at
before update on public.business_development_leads
for each row execute function public.set_business_development_lead_updated_at();

alter table public.business_development_leads enable row level security;

drop policy if exists "Lead owner or manager reads leads" on public.business_development_leads;
create policy "Lead owner or manager reads leads"
on public.business_development_leads for select
using (
  owner_profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_active, true) and p.role in ('admin', 'manager')
  )
);

drop policy if exists "Active staff creates own leads" on public.business_development_leads;
create policy "Active staff creates own leads"
on public.business_development_leads for insert
with check (
  owner_profile_id = auth.uid()
  and created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_active, true) and p.role in ('admin', 'manager', 'staff', 'team')
  )
);

drop policy if exists "Lead owner or manager updates leads" on public.business_development_leads;
create policy "Lead owner or manager updates leads"
on public.business_development_leads for update
using (
  owner_profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_active, true) and p.role in ('admin', 'manager')
  )
)
with check (
  owner_profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_active, true) and p.role in ('admin', 'manager')
  )
);

revoke all on public.business_development_leads from anon, authenticated;
grant select on public.business_development_leads to authenticated;
grant insert (company_name, website_url, industry, location, contact_name, contact_title,
  contact_email, contact_phone, stage, qualification_summary, next_step, next_step_at,
  source_kind, source_url, confidence, do_not_contact)
on public.business_development_leads to authenticated;
grant update (company_name, website_url, industry, location, contact_name, contact_title,
  contact_email, contact_phone, stage, qualification_summary, next_step, next_step_at,
  source_kind, source_url, confidence, do_not_contact, archived_at)
on public.business_development_leads to authenticated;

create table if not exists public.business_development_lead_research (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.business_development_leads(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  entry_type text not null default 'observation' check (entry_type in ('observation', 'source', 'qualification', 'outreach_result', 'correction')),
  summary text not null,
  source_url text,
  source_title text,
  observed_at timestamptz,
  confidence text not null default 'needs_review' check (confidence in ('needs_review', 'supported', 'verified', 'conflicting')),
  supersedes_entry_id uuid references public.business_development_lead_research(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint business_development_research_summary_required check (char_length(btrim(summary)) between 1 and 4000),
  constraint business_development_research_source_url_length check (char_length(coalesce(source_url, '')) <= 1000)
);

comment on table public.business_development_lead_research is
  'Append-only attributed lead research. Stores concise findings and provenance, never copied full webpages or ChatGPT-only history.';

create index if not exists business_development_lead_research_lead_idx
  on public.business_development_lead_research (lead_id, created_at desc);

alter table public.business_development_lead_research enable row level security;

drop policy if exists "Visible lead research can be read" on public.business_development_lead_research;
create policy "Visible lead research can be read"
on public.business_development_lead_research for select
using (
  exists (
    select 1 from public.business_development_leads l
    where l.id = lead_id
      and (
        l.owner_profile_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and coalesce(p.is_active, true) and p.role in ('admin', 'manager')
        )
      )
  )
);

drop policy if exists "Visible lead research can be appended" on public.business_development_lead_research;
create policy "Visible lead research can be appended"
on public.business_development_lead_research for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.business_development_leads l
    where l.id = lead_id
      and l.archived_at is null
      and (
        l.owner_profile_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and coalesce(p.is_active, true) and p.role in ('admin', 'manager')
        )
      )
  )
);

revoke all on public.business_development_lead_research from anon, authenticated;
grant select on public.business_development_lead_research to authenticated;
grant insert (lead_id, entry_type, summary, source_url, source_title, observed_at, confidence, supersedes_entry_id)
on public.business_development_lead_research to authenticated;

-- No browser hard-delete grant exists for either lead table. Conversion remains
-- a future explicit manager/admin workflow and cannot be asserted by this UI.
