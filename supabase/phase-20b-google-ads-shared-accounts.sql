-- Phase 20b - Canonical Google Ads accounts and shared-account campaign mapping
-- Review in the Supabase SQL editor before applying.
-- Phase 20a tables must be empty when this migration is first applied.
-- Credentials and OAuth tokens remain in Edge Function secrets, never here.

-- 1. CANONICAL ACCOUNTS

create table if not exists public.google_ads_accounts (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        text not null unique check (customer_id ~ '^[0-9]+$'),
  account_name       text not null,
  currency_code      text not null,
  time_zone          text not null,
  account_mode       text check (account_mode in ('dedicated', 'shared')),
  is_active          boolean not null default true,
  last_discovered_at timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.google_ads_accounts is
  'Canonical Google Ads customer accounts discovered by service-role Edge Functions. Contains no credentials or tokens.';
comment on column public.google_ads_accounts.customer_id is
  'Google Ads customer ID in canonical digits-only form, without hyphens.';
comment on column public.google_ads_accounts.account_mode is
  'Null until a manager explicitly chooses dedicated or shared mapping mode.';


-- 2. DEDICATED AND SHARED MAPPINGS

alter table public.google_ads_account_links
  add column if not exists google_ads_account_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'google_ads_account_links_google_ads_account_id_fkey'
      and conrelid = 'public.google_ads_account_links'::regclass
  ) then
    alter table public.google_ads_account_links
      add constraint google_ads_account_links_google_ads_account_id_fkey
      foreign key (google_ads_account_id)
      references public.google_ads_accounts(id)
      on delete restrict;
  end if;
end;
$$;

drop index if exists public.google_ads_account_links_one_active_per_client_idx;

create unique index if not exists google_ads_account_links_one_active_dedicated_per_account_idx
  on public.google_ads_account_links (google_ads_account_id)
  where is_active;

create index if not exists google_ads_account_links_account_idx
  on public.google_ads_account_links (google_ads_account_id);

create table if not exists public.google_ads_campaign_links (
  id                    uuid primary key default gen_random_uuid(),
  google_ads_account_id uuid not null references public.google_ads_accounts(id) on delete restrict,
  customer_id           text not null check (customer_id ~ '^[0-9]+$'),
  campaign_id           text not null check (btrim(campaign_id) <> ''),
  campaign_name         text not null,
  client_id             uuid not null references public.clients(id) on delete restrict,
  is_active             boolean not null default true,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.google_ads_campaign_links is
  'Soft-deletable shared-account campaign-to-client mappings. One campaign may have only one active client mapping.';

create unique index if not exists google_ads_campaign_links_one_active_campaign_idx
  on public.google_ads_campaign_links (customer_id, campaign_id)
  where is_active;

create unique index if not exists google_ads_campaign_links_history_identity_idx
  on public.google_ads_campaign_links (google_ads_account_id, campaign_id, client_id);

create index if not exists google_ads_campaign_links_client_idx
  on public.google_ads_campaign_links (client_id)
  where is_active;

create index if not exists google_ads_campaign_links_account_idx
  on public.google_ads_campaign_links (google_ads_account_id);


-- 3. CANONICAL RAW METRICS AND ACCOUNT-LEVEL SYNC RUNS

alter table public.google_ads_campaign_daily_metrics
  add column if not exists google_ads_account_id uuid,
  add column if not exists campaign_type text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'google_ads_campaign_daily_metrics_google_ads_account_id_fkey'
      and conrelid = 'public.google_ads_campaign_daily_metrics'::regclass
  ) then
    alter table public.google_ads_campaign_daily_metrics
      add constraint google_ads_campaign_daily_metrics_google_ads_account_id_fkey
      foreign key (google_ads_account_id)
      references public.google_ads_accounts(id)
      on delete restrict;
  end if;
end;
$$;

alter table public.google_ads_campaign_daily_metrics
  alter column google_ads_account_id set not null,
  alter column account_link_id drop not null,
  alter column client_id drop not null;

drop index if exists public.google_ads_campaign_daily_metrics_upsert_idx;

create unique index if not exists google_ads_campaign_daily_metrics_account_campaign_date_idx
  on public.google_ads_campaign_daily_metrics (google_ads_account_id, campaign_id, metric_date);

create index if not exists google_ads_campaign_daily_metrics_account_date_idx
  on public.google_ads_campaign_daily_metrics (google_ads_account_id, metric_date desc);

alter table public.google_ads_sync_runs
  add column if not exists google_ads_account_id uuid,
  add column if not exists mapped_campaigns integer not null default 0,
  add column if not exists unmapped_campaigns integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'google_ads_sync_runs_google_ads_account_id_fkey'
      and conrelid = 'public.google_ads_sync_runs'::regclass
  ) then
    alter table public.google_ads_sync_runs
      add constraint google_ads_sync_runs_google_ads_account_id_fkey
      foreign key (google_ads_account_id)
      references public.google_ads_accounts(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'google_ads_sync_runs_mapped_campaigns_check'
      and conrelid = 'public.google_ads_sync_runs'::regclass
  ) then
    alter table public.google_ads_sync_runs
      add constraint google_ads_sync_runs_mapped_campaigns_check
      check (mapped_campaigns >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'google_ads_sync_runs_unmapped_campaigns_check'
      and conrelid = 'public.google_ads_sync_runs'::regclass
  ) then
    alter table public.google_ads_sync_runs
      add constraint google_ads_sync_runs_unmapped_campaigns_check
      check (unmapped_campaigns >= 0);
  end if;
end;
$$;

alter table public.google_ads_sync_runs
  alter column google_ads_account_id set not null,
  alter column account_link_id drop not null,
  alter column client_id drop not null;

create index if not exists google_ads_sync_runs_google_account_created_idx
  on public.google_ads_sync_runs (google_ads_account_id, created_at desc);


-- 4. UPDATED_AT AND MAPPING-INTEGRITY TRIGGERS

drop trigger if exists google_ads_accounts_set_updated_at on public.google_ads_accounts;
create trigger google_ads_accounts_set_updated_at
  before update on public.google_ads_accounts
  for each row execute function public.set_google_ads_updated_at();

drop trigger if exists google_ads_campaign_links_set_updated_at on public.google_ads_campaign_links;
create trigger google_ads_campaign_links_set_updated_at
  before update on public.google_ads_campaign_links
  for each row execute function public.set_google_ads_updated_at();

create or replace function public.validate_google_ads_account_mapping_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));

  if exists (
    select 1
    from public.google_ads_account_links al
    where al.google_ads_account_id = new.id
      and al.is_active
  ) and (not new.is_active or new.account_mode is distinct from 'dedicated') then
    raise exception 'Account with an active dedicated mapping must remain active and in dedicated mode';
  end if;

  if exists (
    select 1
    from public.google_ads_campaign_links cl
    where cl.google_ads_account_id = new.id
      and cl.is_active
  ) and (not new.is_active or new.account_mode is distinct from 'shared') then
    raise exception 'Account with active campaign mappings must remain active and in shared mode';
  end if;

  return new;
end;
$$;

create or replace function public.validate_google_ads_dedicated_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  account_row public.google_ads_accounts%rowtype;
begin
  if new.google_ads_account_id is null then
    if new.is_active then
      raise exception 'Active dedicated mappings require google_ads_account_id';
    end if;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.google_ads_account_id::text, 0));

  select * into account_row
  from public.google_ads_accounts
  where id = new.google_ads_account_id;

  if not found then
    raise exception 'Google Ads account not found';
  end if;

  if new.customer_id <> account_row.customer_id then
    raise exception 'Dedicated mapping customer_id must match its canonical account';
  end if;

  if new.is_active then
    if not account_row.is_active or account_row.account_mode is distinct from 'dedicated' then
      raise exception 'Active dedicated mappings require an active account in dedicated mode';
    end if;

    if exists (
      select 1
      from public.google_ads_campaign_links cl
      where cl.google_ads_account_id = new.google_ads_account_id
        and cl.is_active
    ) then
      raise exception 'Dedicated and shared campaign mappings cannot coexist';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_google_ads_campaign_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  account_row public.google_ads_accounts%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.google_ads_account_id::text, 0));

  select * into account_row
  from public.google_ads_accounts
  where id = new.google_ads_account_id;

  if not found then
    raise exception 'Google Ads account not found';
  end if;

  if new.customer_id <> account_row.customer_id then
    raise exception 'Campaign mapping customer_id must match its canonical account';
  end if;

  if new.is_active then
    if not account_row.is_active or account_row.account_mode is distinct from 'shared' then
      raise exception 'Active campaign mappings require an active account in shared mode';
    end if;

    if exists (
      select 1
      from public.google_ads_account_links al
      where al.google_ads_account_id = new.google_ads_account_id
        and al.is_active
    ) then
      raise exception 'Shared campaign and dedicated mappings cannot coexist';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_google_ads_campaign_link_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Google Ads campaign mappings must be deactivated, not deleted';
end;
$$;

drop trigger if exists google_ads_accounts_validate_mapping_state on public.google_ads_accounts;
create trigger google_ads_accounts_validate_mapping_state
  before update of account_mode, is_active on public.google_ads_accounts
  for each row execute function public.validate_google_ads_account_mapping_state();

drop trigger if exists google_ads_account_links_validate_dedicated on public.google_ads_account_links;
create trigger google_ads_account_links_validate_dedicated
  before insert or update of google_ads_account_id, customer_id, is_active
  on public.google_ads_account_links
  for each row execute function public.validate_google_ads_dedicated_link();

drop trigger if exists google_ads_campaign_links_validate_shared on public.google_ads_campaign_links;
create trigger google_ads_campaign_links_validate_shared
  before insert or update of google_ads_account_id, customer_id, is_active
  on public.google_ads_campaign_links
  for each row execute function public.validate_google_ads_campaign_link();

drop trigger if exists google_ads_campaign_links_prevent_delete on public.google_ads_campaign_links;
create trigger google_ads_campaign_links_prevent_delete
  before delete on public.google_ads_campaign_links
  for each row execute function public.prevent_google_ads_campaign_link_delete();


-- 5. SERVICE-ROLE-ONLY ATOMIC MODE AND MAPPING SAVES

create or replace function public.set_google_ads_account_mode(
  p_account_id uuid,
  p_account_mode text,
  p_confirm_mode_change boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.google_ads_accounts%rowtype;
begin
  if p_account_mode is null or p_account_mode not in ('dedicated', 'shared') then
    raise exception 'Account mode must be dedicated or shared';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));

  select * into account_row
  from public.google_ads_accounts
  where id = p_account_id
  for update;

  if not found or not account_row.is_active then
    raise exception 'Active Google Ads account not found';
  end if;

  if account_row.account_mode is not null
     and account_row.account_mode is distinct from p_account_mode
     and not coalesce(p_confirm_mode_change, false) then
    raise exception 'Changing account mode requires explicit confirmation';
  end if;

  if p_account_mode = 'dedicated' then
    update public.google_ads_campaign_links
    set is_active = false
    where google_ads_account_id = p_account_id
      and is_active;
  else
    update public.google_ads_account_links
    set is_active = false
    where google_ads_account_id = p_account_id
      and is_active;
  end if;

  update public.google_ads_accounts
  set account_mode = p_account_mode
  where id = p_account_id;
end;
$$;

revoke all on function public.set_google_ads_account_mode(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.set_google_ads_account_mode(uuid, text, boolean)
  to service_role;

-- p_campaign_mappings is the complete desired shared mapping set. Each item is
-- {campaign_id, campaign_name, client_id, is_active}; omitted existing rows are
-- deactivated. Any save over existing active mappings requires confirmation.

create or replace function public.save_google_ads_account_mapping(
  p_account_id uuid,
  p_account_mode text,
  p_confirm_mapping_changes boolean,
  p_dedicated_client_id uuid default null,
  p_campaign_mappings jsonb default '[]'::jsonb,
  p_created_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.google_ads_accounts%rowtype;
  mapping_count integer;
  distinct_mapping_count integer;
begin
  if p_account_mode is null or p_account_mode not in ('dedicated', 'shared') then
    raise exception 'Account mode must be dedicated or shared';
  end if;

  if jsonb_typeof(coalesce(p_campaign_mappings, '[]'::jsonb)) <> 'array' then
    raise exception 'Campaign mappings must be a JSON array';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));

  select * into account_row
  from public.google_ads_accounts
  where id = p_account_id
  for update;

  if not found or not account_row.is_active then
    raise exception 'Active Google Ads account not found';
  end if;

  if not coalesce(p_confirm_mapping_changes, false) and (
    exists (
      select 1 from public.google_ads_account_links
      where google_ads_account_id = p_account_id and is_active
    ) or exists (
      select 1 from public.google_ads_campaign_links
      where google_ads_account_id = p_account_id and is_active
    )
  ) then
    raise exception 'Existing mappings require explicit confirmation';
  end if;

  if p_account_mode = 'dedicated' then
    if p_dedicated_client_id is null then
      raise exception 'Dedicated mode requires an explicit client mapping';
    end if;
    if jsonb_array_length(coalesce(p_campaign_mappings, '[]'::jsonb)) <> 0 then
      raise exception 'Dedicated mode cannot include campaign mappings';
    end if;
  elsif p_dedicated_client_id is not null then
    raise exception 'Shared mode cannot include a dedicated client mapping';
  end if;

  if p_account_mode = 'shared' then
    select count(*), count(distinct btrim(item.campaign_id))
      into mapping_count, distinct_mapping_count
    from jsonb_to_recordset(coalesce(p_campaign_mappings, '[]'::jsonb)) as item(
      campaign_id text,
      campaign_name text,
      client_id uuid,
      is_active boolean
    );

    if mapping_count <> distinct_mapping_count then
      raise exception 'A campaign may appear only once in a mapping save';
    end if;
  end if;

  update public.google_ads_account_links
  set is_active = false
  where google_ads_account_id = p_account_id
    and is_active;

  update public.google_ads_campaign_links
  set is_active = false
  where google_ads_account_id = p_account_id
    and is_active;

  update public.google_ads_accounts
  set account_mode = p_account_mode
  where id = p_account_id;

  if p_account_mode = 'dedicated' then
    insert into public.google_ads_account_links (
      google_ads_account_id,
      client_id,
      customer_id,
      customer_name,
      currency_code,
      time_zone,
      is_active,
      created_by
    ) values (
      account_row.id,
      p_dedicated_client_id,
      account_row.customer_id,
      account_row.account_name,
      account_row.currency_code,
      account_row.time_zone,
      true,
      p_created_by
    )
    on conflict (client_id, customer_id) do update
      set google_ads_account_id = excluded.google_ads_account_id,
          customer_name = excluded.customer_name,
          currency_code = excluded.currency_code,
          time_zone = excluded.time_zone,
          is_active = true,
          created_by = excluded.created_by;
  else
    insert into public.google_ads_campaign_links (
      google_ads_account_id,
      customer_id,
      campaign_id,
      campaign_name,
      client_id,
      is_active,
      created_by
    )
    select
      account_row.id,
      account_row.customer_id,
      btrim(item.campaign_id),
      item.campaign_name,
      item.client_id,
      coalesce(item.is_active, true),
      p_created_by
    from jsonb_to_recordset(coalesce(p_campaign_mappings, '[]'::jsonb)) as item(
      campaign_id text,
      campaign_name text,
      client_id uuid,
      is_active boolean
    )
    where item.campaign_id is not null
      and btrim(item.campaign_id) <> ''
      and item.campaign_name is not null
      and item.client_id is not null
    on conflict (google_ads_account_id, campaign_id, client_id) do update
      set campaign_name = excluded.campaign_name,
          is_active = excluded.is_active,
          created_by = excluded.created_by;

    get diagnostics mapping_count = row_count;

    if mapping_count <> jsonb_array_length(coalesce(p_campaign_mappings, '[]'::jsonb)) then
      raise exception 'Every campaign mapping requires campaign_id, campaign_name, and client_id';
    end if;
  end if;
end;
$$;

revoke all on function public.save_google_ads_account_mapping(uuid, text, boolean, uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.save_google_ads_account_mapping(uuid, text, boolean, uuid, jsonb, uuid)
  to service_role;


-- 6. SERVICE-ROLE-ONLY ACCOUNT-KEYED RAW METRIC REPLACEMENT

create or replace function public.replace_google_ads_account_campaign_metrics(
  p_google_ads_account_id uuid,
  p_period_start date,
  p_period_end date,
  p_metrics jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.google_ads_accounts%rowtype;
  inserted_count integer;
begin
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Invalid Google Ads metric replacement range';
  end if;

  if jsonb_typeof(coalesce(p_metrics, '[]'::jsonb)) <> 'array' then
    raise exception 'Metrics must be a JSON array';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_google_ads_account_id::text, 0));

  select * into account_row
  from public.google_ads_accounts
  where id = p_google_ads_account_id
    and is_active
  for update;

  if not found then
    raise exception 'Active Google Ads account not found';
  end if;

  delete from public.google_ads_campaign_daily_metrics
  where google_ads_account_id = p_google_ads_account_id
    and metric_date between p_period_start and p_period_end;

  insert into public.google_ads_campaign_daily_metrics (
    google_ads_account_id,
    account_link_id,
    client_id,
    customer_id,
    campaign_id,
    campaign_name,
    campaign_status,
    campaign_type,
    metric_date,
    impressions,
    clicks,
    cost_micros,
    conversions,
    conversion_value
  )
  select
    account_row.id,
    null,
    null,
    account_row.customer_id,
    metric.campaign_id,
    metric.campaign_name,
    metric.campaign_status,
    metric.campaign_type,
    metric.metric_date,
    coalesce(metric.impressions, 0),
    coalesce(metric.clicks, 0),
    coalesce(metric.cost_micros, 0),
    coalesce(metric.conversions, 0),
    coalesce(metric.conversion_value, 0)
  from jsonb_to_recordset(coalesce(p_metrics, '[]'::jsonb)) as metric(
    campaign_id text,
    campaign_name text,
    campaign_status text,
    campaign_type text,
    metric_date date,
    impressions bigint,
    clicks bigint,
    cost_micros bigint,
    conversions numeric,
    conversion_value numeric
  )
  where metric.metric_date between p_period_start and p_period_end;

  get diagnostics inserted_count = row_count;

  if inserted_count <> jsonb_array_length(coalesce(p_metrics, '[]'::jsonb)) then
    raise exception 'Every metric row must fall within the replacement range';
  end if;

  return inserted_count;
end;
$$;

revoke all on function public.replace_google_ads_account_campaign_metrics(uuid, date, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_google_ads_account_campaign_metrics(uuid, date, date, jsonb)
  to service_role;

-- Preserve the Phase 20a RPC signature while routing dedicated-account callers
-- through the canonical account replacement path.
create or replace function public.replace_google_ads_campaign_metrics(
  p_account_link_id uuid,
  p_client_id uuid,
  p_customer_id text,
  p_period_start date,
  p_period_end date,
  p_metrics jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_account_id uuid;
begin
  select al.google_ads_account_id
    into canonical_account_id
  from public.google_ads_account_links al
  join public.google_ads_accounts a
    on a.id = al.google_ads_account_id
  where al.id = p_account_link_id
    and al.client_id = p_client_id
    and al.customer_id = p_customer_id
    and al.is_active
    and a.is_active
    and a.account_mode = 'dedicated';

  if canonical_account_id is null then
    raise exception 'Active canonical dedicated Google Ads account link not found';
  end if;

  return public.replace_google_ads_account_campaign_metrics(
    canonical_account_id,
    p_period_start,
    p_period_end,
    p_metrics
  );
end;
$$;

revoke all on function public.replace_google_ads_campaign_metrics(uuid, uuid, text, date, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_google_ads_campaign_metrics(uuid, uuid, text, date, date, jsonb)
  to service_role;


-- 7. MANAGER-ONLY CLIENT REPORTING
-- Dedicated accounts resolve through an active account link. Shared accounts
-- resolve each campaign through an active campaign link, excluding unmapped
-- campaigns without copying client_id into raw metric rows.

create or replace function public.get_google_ads_client_campaign_metrics(
  p_client_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  google_ads_account_id uuid,
  customer_id text,
  account_name text,
  currency_code text,
  time_zone text,
  campaign_id text,
  campaign_name text,
  campaign_status text,
  campaign_type text,
  metric_date date,
  impressions bigint,
  clicks bigint,
  cost_micros bigint,
  conversions numeric,
  conversion_value numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_manager(), false) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if p_client_id is null or p_period_start is null or p_period_end is null
     or p_period_end < p_period_start then
    raise exception 'Invalid Google Ads report parameters';
  end if;

  return query
  select
    m.google_ads_account_id,
    m.customer_id,
    a.account_name,
    a.currency_code,
    a.time_zone,
    m.campaign_id,
    m.campaign_name,
    m.campaign_status,
    m.campaign_type,
    m.metric_date,
    m.impressions,
    m.clicks,
    m.cost_micros,
    m.conversions,
    m.conversion_value
  from public.google_ads_campaign_daily_metrics m
  join public.google_ads_accounts a
    on a.id = m.google_ads_account_id
   and a.is_active
  where m.metric_date between p_period_start and p_period_end
    and (
      (
        a.account_mode = 'dedicated'
        and exists (
          select 1
          from public.google_ads_account_links al
          where al.google_ads_account_id = a.id
            and al.client_id = p_client_id
            and al.is_active
        )
      )
      or
      (
        a.account_mode = 'shared'
        and exists (
          select 1
          from public.google_ads_campaign_links cl
          where cl.google_ads_account_id = a.id
            and cl.customer_id = m.customer_id
            and cl.campaign_id = m.campaign_id
            and cl.client_id = p_client_id
            and cl.is_active
        )
      )
    )
  order by m.metric_date, m.campaign_name, m.campaign_id;
end;
$$;

revoke all on function public.get_google_ads_client_campaign_metrics(uuid, date, date)
  from public, anon;
grant execute on function public.get_google_ads_client_campaign_metrics(uuid, date, date)
  to authenticated;


-- 8. ROW-LEVEL SECURITY AND PRIVILEGES

alter table public.google_ads_accounts enable row level security;
alter table public.google_ads_campaign_links enable row level security;
alter table public.google_ads_campaign_daily_metrics enable row level security;
alter table public.google_ads_sync_runs enable row level security;

drop policy if exists "google_ads_accounts: manager select" on public.google_ads_accounts;
create policy "google_ads_accounts: manager select"
  on public.google_ads_accounts for select
  using (public.is_manager());

drop policy if exists "google_ads_campaign_links: manager select" on public.google_ads_campaign_links;
create policy "google_ads_campaign_links: manager select"
  on public.google_ads_campaign_links for select
  using (public.is_manager());

drop policy if exists "google_ads_campaign_daily_metrics: staff select"
  on public.google_ads_campaign_daily_metrics;
drop policy if exists "google_ads_campaign_daily_metrics: manager select"
  on public.google_ads_campaign_daily_metrics;
create policy "google_ads_campaign_daily_metrics: manager select"
  on public.google_ads_campaign_daily_metrics for select
  using (public.is_manager());

drop policy if exists "google_ads_sync_runs: manager select" on public.google_ads_sync_runs;
create policy "google_ads_sync_runs: manager select"
  on public.google_ads_sync_runs for select
  using (public.is_manager());

revoke all on public.google_ads_accounts from anon, authenticated;
revoke all on public.google_ads_campaign_links from anon, authenticated;
revoke all on public.google_ads_campaign_daily_metrics from anon, authenticated;
revoke all on public.google_ads_sync_runs from anon, authenticated;

grant select on public.google_ads_accounts to authenticated;
grant select on public.google_ads_campaign_links to authenticated;
grant select on public.google_ads_campaign_daily_metrics to authenticated;
grant select on public.google_ads_sync_runs to authenticated;

grant all on public.google_ads_accounts to service_role;
grant all on public.google_ads_campaign_links to service_role;
grant all on public.google_ads_campaign_daily_metrics to service_role;
grant all on public.google_ads_sync_runs to service_role;

revoke all on function public.validate_google_ads_account_mapping_state() from public, anon, authenticated;
revoke all on function public.validate_google_ads_dedicated_link() from public, anon, authenticated;
revoke all on function public.validate_google_ads_campaign_link() from public, anon, authenticated;
revoke all on function public.prevent_google_ads_campaign_link_delete() from public, anon, authenticated;
