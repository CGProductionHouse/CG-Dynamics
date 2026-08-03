-- Production Marketing AI Department: persistent artifacts, immutable versions,
-- explicit handoffs, human decisions, and append-only audit.
-- Access model: active workforce may read and draft; only active managers/admins
-- may approve or reject. Client-role users have no policy and no RPC access.

create table public.ai_marketing_artifacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  campaign_id text,
  campaign_name text,
  originating_request text not null check (length(btrim(originating_request)) between 1 and 8000),
  requested_specialist text not null,
  current_specialist text not null check (current_specialist in (
    'marketing_strategist','copywriting_agent','creative_director','brand_guardian',
    'social_media_strategist','paid_ads_agent','content_planner'
  )),
  artifact_type text not null check (artifact_type in (
    'strategy_brief','copy_deck','creative_direction','brand_review',
    'social_strategy','paid_ads_plan','content_plan'
  )),
  status text not null default 'draft' check (status in (
    'draft','in_review','changes_requested','rejected','human_approved'
  )),
  current_version integer not null default 0 check (current_version >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((campaign_id is null and campaign_name is null) or campaign_id is not null)
);

create table public.ai_marketing_artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.ai_marketing_artifacts(id) on delete restrict,
  version integer not null check (version > 0),
  specialist text not null check (specialist in (
    'marketing_strategist','copywriting_agent','creative_director','brand_guardian',
    'social_media_strategist','paid_ads_agent','content_planner'
  )),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  evidence_card_ids uuid[] not null default '{}',
  evidence_source_ids uuid[] not null default '{}',
  platform_knowledge_ids uuid[] not null default '{}',
  provider text,
  model text,
  ai_usage_request_id uuid,
  parent_version_id uuid references public.ai_marketing_artifact_versions(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (artifact_id, version)
);

create table public.ai_marketing_artifact_transitions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.ai_marketing_artifacts(id) on delete restrict,
  version_id uuid references public.ai_marketing_artifact_versions(id) on delete restrict,
  action text not null check (action in (
    'created','regenerated','handed_off','changes_requested','returned','approved','rejected'
  )),
  from_specialist text,
  to_specialist text,
  note text check (note is null or length(note) <= 4000),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.ai_marketing_artifact_approvals (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.ai_marketing_artifacts(id) on delete restrict,
  version_id uuid not null references public.ai_marketing_artifact_versions(id) on delete restrict,
  decision text not null check (decision in ('approved','rejected','changes_requested','returned')),
  note text check (note is null or length(note) <= 4000),
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.ai_marketing_artifact_audit (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid references public.ai_marketing_artifacts(id) on delete restrict,
  version_id uuid references public.ai_marketing_artifact_versions(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index ai_marketing_artifacts_client_updated_idx
  on public.ai_marketing_artifacts(client_id, updated_at desc);
create index ai_marketing_versions_artifact_idx
  on public.ai_marketing_artifact_versions(artifact_id, version desc);
create index ai_marketing_transitions_artifact_idx
  on public.ai_marketing_artifact_transitions(artifact_id, created_at desc);
create index ai_marketing_approvals_artifact_idx
  on public.ai_marketing_artifact_approvals(artifact_id, created_at desc);

alter table public.ai_marketing_artifacts enable row level security;
alter table public.ai_marketing_artifacts force row level security;
alter table public.ai_marketing_artifact_versions enable row level security;
alter table public.ai_marketing_artifact_versions force row level security;
alter table public.ai_marketing_artifact_transitions enable row level security;
alter table public.ai_marketing_artifact_transitions force row level security;
alter table public.ai_marketing_artifact_approvals enable row level security;
alter table public.ai_marketing_artifact_approvals force row level security;
alter table public.ai_marketing_artifact_audit enable row level security;
alter table public.ai_marketing_artifact_audit force row level security;

create policy "ai marketing artifacts: active staff read"
  on public.ai_marketing_artifacts for select to authenticated
  using (public.is_staff() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true
  ));
create policy "ai marketing versions: active staff read"
  on public.ai_marketing_artifact_versions for select to authenticated
  using (public.is_staff() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true
  ));
create policy "ai marketing transitions: active staff read"
  on public.ai_marketing_artifact_transitions for select to authenticated
  using (public.is_staff() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true
  ));
create policy "ai marketing approvals: active staff read"
  on public.ai_marketing_artifact_approvals for select to authenticated
  using (public.is_staff() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true
  ));
create policy "ai marketing audit: manager read"
  on public.ai_marketing_artifact_audit for select to authenticated
  using (public.is_manager() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true
  ));

revoke all on public.ai_marketing_artifacts from anon, authenticated;
revoke all on public.ai_marketing_artifact_versions from anon, authenticated;
revoke all on public.ai_marketing_artifact_transitions from anon, authenticated;
revoke all on public.ai_marketing_artifact_approvals from anon, authenticated;
revoke all on public.ai_marketing_artifact_audit from anon, authenticated;
grant select on public.ai_marketing_artifacts to authenticated;
grant select on public.ai_marketing_artifact_versions to authenticated;
grant select on public.ai_marketing_artifact_transitions to authenticated;
grant select on public.ai_marketing_artifact_approvals to authenticated;
grant select on public.ai_marketing_artifact_audit to authenticated;
grant all on public.ai_marketing_artifacts to service_role;
grant all on public.ai_marketing_artifact_versions to service_role;
grant all on public.ai_marketing_artifact_transitions to service_role;
grant all on public.ai_marketing_artifact_approvals to service_role;
grant all on public.ai_marketing_artifact_audit to service_role;

create or replace function public.ai_marketing_campaign_options(p_client_id uuid)
returns table(campaign_id text, campaign_name text)
language sql
security definer
set search_path = public
as $$
  select distinct on (m.campaign_id) m.campaign_id, m.campaign_name
  from public.google_ads_campaign_daily_metrics m
  join public.clients c on c.id = m.client_id and c.active = true
  where m.client_id = p_client_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true and p.role in ('admin','manager','staff','team'))
  order by m.campaign_id, m.metric_date desc;
$$;

create or replace function public.ai_marketing_record_decision(
  p_artifact_id uuid,
  p_version_id uuid,
  p_decision text,
  p_note text default null,
  p_return_specialist text default null
) returns public.ai_marketing_artifacts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_artifact public.ai_marketing_artifacts%rowtype;
  v_version public.ai_marketing_artifact_versions%rowtype;
  v_status text;
  v_action text;
begin
  select * into v_profile from public.profiles where id = auth.uid() and is_active = true;
  if not found or v_profile.role not in ('admin','manager','staff','team') then
    raise exception 'Active staff access required';
  end if;
  if p_decision not in ('approved','rejected','changes_requested','returned') then
    raise exception 'Unsupported decision';
  end if;
  if p_decision in ('approved','rejected') and v_profile.role not in ('admin','manager') then
    raise exception 'Manager approval access required';
  end if;
  if p_return_specialist is not null and p_return_specialist not in (
    'marketing_strategist','copywriting_agent','creative_director','brand_guardian',
    'social_media_strategist','paid_ads_agent','content_planner'
  ) then raise exception 'Unsupported specialist'; end if;

  select * into v_artifact from public.ai_marketing_artifacts where id = p_artifact_id for update;
  if not found then raise exception 'Artifact not found'; end if;
  select * into v_version from public.ai_marketing_artifact_versions
    where id = p_version_id and artifact_id = p_artifact_id;
  if not found or v_version.version <> v_artifact.current_version then
    raise exception 'Decision must target the current version';
  end if;

  v_status := case p_decision
    when 'approved' then 'human_approved'
    when 'rejected' then 'rejected'
    else 'changes_requested'
  end;
  v_action := case p_decision when 'returned' then 'returned' else p_decision end;

  update public.ai_marketing_artifacts
  set status = v_status,
      current_specialist = coalesce(p_return_specialist, current_specialist),
      updated_at = now()
  where id = p_artifact_id returning * into v_artifact;

  insert into public.ai_marketing_artifact_approvals
    (artifact_id, version_id, decision, note, reviewer_id)
  values (p_artifact_id, p_version_id, p_decision, nullif(btrim(p_note), ''), auth.uid());
  insert into public.ai_marketing_artifact_transitions
    (artifact_id, version_id, action, from_specialist, to_specialist, note, actor_id)
  values (p_artifact_id, p_version_id, v_action, v_version.specialist,
          coalesce(p_return_specialist, v_version.specialist), nullif(btrim(p_note), ''), auth.uid());
  insert into public.ai_marketing_artifact_audit
    (artifact_id, version_id, actor_id, event, details)
  values (p_artifact_id, p_version_id, auth.uid(), 'human_' || p_decision,
          jsonb_build_object('return_specialist', p_return_specialist));
  return v_artifact;
end;
$$;

revoke all on function public.ai_marketing_campaign_options(uuid) from public, anon;
grant execute on function public.ai_marketing_campaign_options(uuid) to authenticated;
revoke all on function public.ai_marketing_record_decision(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.ai_marketing_record_decision(uuid, uuid, text, text, text) to authenticated;

create or replace function public.prevent_ai_marketing_history_mutation()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'AI Marketing history is append-only'; end;
$$;
create trigger ai_marketing_versions_immutable before update or delete on public.ai_marketing_artifact_versions
  for each row execute function public.prevent_ai_marketing_history_mutation();
create trigger ai_marketing_transitions_immutable before update or delete on public.ai_marketing_artifact_transitions
  for each row execute function public.prevent_ai_marketing_history_mutation();
create trigger ai_marketing_approvals_immutable before update or delete on public.ai_marketing_artifact_approvals
  for each row execute function public.prevent_ai_marketing_history_mutation();
create trigger ai_marketing_audit_immutable before update or delete on public.ai_marketing_artifact_audit
  for each row execute function public.prevent_ai_marketing_history_mutation();
