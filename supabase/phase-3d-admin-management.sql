-- ============================================================
-- CG Dynamics - Phase 3d admin import/report management
-- Run this once in the Supabase SQL editor before using the
-- admin Reports list "last updated" field.
-- ============================================================

alter table reports add column if not exists updated_at timestamptz default now();
alter table reports add column if not exists report_month_label text;

create or replace function public.set_report_metadata()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.report_month_label = to_char(new.period_start, 'FMMonth YYYY');
  return new;
end;
$$;

drop trigger if exists reports_set_updated_at on reports;
drop trigger if exists reports_set_report_metadata on reports;

create trigger reports_set_report_metadata
  before insert or update on reports
  for each row execute procedure public.set_report_metadata();

update reports
set report_month_label = to_char(period_start, 'FMMonth YYYY')
where report_month_label is null;

create index if not exists reports_client_period_idx
  on reports (client_id, period_start, period_end);

create index if not exists reports_updated_at_idx
  on reports (updated_at);
