-- Permit retry-safe browser creation on the existing UUID primary key only.
-- Preserve existing RLS, ordinary editable-column grants and protected fields.
-- No UPDATE(id), table-wide grants, provider/visibility grants or data changes.
grant insert (id) on public.company_calendar_events to authenticated;
