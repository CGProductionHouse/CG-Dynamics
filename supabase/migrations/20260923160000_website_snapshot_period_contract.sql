create or replace function public.save_website_report_snapshot(
  p_client_id uuid,
  p_period_start date,
  p_period_end date,
  p_snapshot jsonb,
  p_actor_id uuid
)
returns table (report_id uuid, snapshot_id uuid, revision integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_report public.reports%rowtype;
  v_snapshot_id uuid;
  v_revision integer;
  v_website_id bigint;
  v_source_state text;
  v_source_read_at timestamptz;
  v_client_name text;
  v_inclusive_period_end date;
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = p_actor_id
      and profile.is_active
      and profile.role in ('admin', 'manager')
  ) then raise exception 'Active manager access required' using errcode = '42501'; end if;

  if p_period_end <= p_period_start
    or p_snapshot ->> 'version' <> '1'
    or p_snapshot #>> '{identity,dynamicsClientId}' <> p_client_id::text
    or p_snapshot #>> '{identity,environment}' <> 'production'
    or p_snapshot #>> '{period,from}' <> p_period_start::text
    or p_snapshot #>> '{period,to}' <> p_period_end::text
  then raise exception 'Website report identity or period mismatch' using errcode = '22023'; end if;

  v_inclusive_period_end := p_period_end - 1;

  v_website_id := nullif(p_snapshot ->> 'websiteId', '')::bigint;
  v_source_state := p_snapshot #>> '{dataQuality,state}';
  v_source_read_at := nullif(p_snapshot #>> '{dataQuality,sourceReadAt}', '')::timestamptz;
  if v_website_id is null or v_website_id <= 0
    or v_source_state not in ('available', 'partial')
    or v_source_read_at is null
  then raise exception 'Website report is not snapshot-ready' using errcode = '22023'; end if;

  select client.name into v_client_name
  from public.clients client
  where client.id = p_client_id and client.active;
  if not found then raise exception 'Active client required' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_client_id::text || ':' || p_period_start::text, 0)
  );

  select report.* into v_report
  from public.reports report
  where report.client_id = p_client_id
    and report.platform is null
    and report.period_start = p_period_start
  for update;

  if not found then
    insert into public.reports (
      client_id, platform, period_start, period_end, status, report_title, created_by
    ) values (
      p_client_id, null, p_period_start, v_inclusive_period_end, 'draft',
      v_client_name || ' ' || to_char(p_period_start, 'FMMonth YYYY') || ' Report', p_actor_id
    ) returning * into v_report;
  elsif v_report.period_end is distinct from v_inclusive_period_end then
    raise exception 'Existing monthly report period requires review' using errcode = '23514';
  elsif v_report.status = 'published' then
    raise exception 'Published report cannot receive an unreviewed snapshot' using errcode = '23514';
  end if;

  select coalesce(max(item.revision), 0) + 1 into v_revision
  from public.website_report_snapshots item
  where item.report_id = v_report.id;

  insert into public.website_report_snapshots (
    report_id, client_id, website_id, revision, period_start, period_end,
    source_state, source_read_at, snapshot, created_by
  ) values (
    v_report.id, p_client_id, v_website_id, v_revision, p_period_start, p_period_end,
    v_source_state, v_source_read_at, p_snapshot, p_actor_id
  ) returning id into v_snapshot_id;

  update public.reports
  set website_report_snapshot_id = v_snapshot_id
  where id = v_report.id;

  return query select v_report.id, v_snapshot_id, v_revision;
end;
$$;

revoke all on function public.save_website_report_snapshot(uuid, date, date, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_website_report_snapshot(uuid, date, date, jsonb, uuid) to service_role;
