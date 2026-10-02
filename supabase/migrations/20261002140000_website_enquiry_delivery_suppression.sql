-- Issue #405: auditable suppression of website enquiry delivery jobs before email activation.
--
-- Adds a terminal `suppressed` delivery state so an acceptance/test enquiry's outbox job can
-- be cancelled before any provider worker runs, without deleting enquiry evidence. The
-- claim RPC only leases `pending` jobs, so a suppressed job can never be sent.
-- Creates no rows and changes no existing job.

begin;

alter table public.website_enquiry_delivery_jobs
  drop constraint website_enquiry_delivery_jobs_delivery_state_check,
  add constraint website_enquiry_delivery_jobs_delivery_state_check check (
    delivery_state in ('pending', 'leased', 'accepted', 'delivered', 'bounced', 'failed', 'uncertain', 'reconcile', 'suppressed')
  ),
  add column suppressed_at timestamptz,
  add column suppressed_by uuid references public.profiles(id) on delete restrict,
  add column suppression_reason text check (
    suppression_reason is null or suppression_reason in ('acceptance_test', 'duplicate', 'spam', 'client_request', 'other')
  ),
  add column suppression_note text check (
    suppression_note is null or char_length(btrim(suppression_note)) between 1 and 500
  ),
  add column suppressed_from_state text check (
    suppressed_from_state is null or suppressed_from_state in ('pending', 'failed', 'reconcile')
  ),
  add constraint website_enquiry_delivery_suppression_complete check (
    (delivery_state = 'suppressed') = (
      suppressed_at is not null and suppressed_by is not null
      and suppression_reason is not null and suppressed_from_state is not null
    )
  ),
  add constraint website_enquiry_delivery_suppression_other_note check (
    suppression_reason is distinct from 'other' or suppression_note is not null
  );

comment on column public.website_enquiry_delivery_jobs.suppressed_from_state is
  'State the job was in when an admin/manager suppressed it. Suppression is terminal: a suppressed job is never claimed or sent.';

-- Suppresses one not-yet-sent delivery job. Only active CG admins/managers may do this.
-- Allowed only from states where no provider has accepted the message:
--   pending (never attempted), failed (terminal failure), reconcile (ambiguous; suppressing
--   forgoes the idempotent replay and is recorded). Leased (in flight) and any accepted /
--   delivered / bounced job is refused. Row lock serialises against the claim RPC, whose
--   FOR UPDATE SKIP LOCKED skips a job being suppressed.
create or replace function public.suppress_website_enquiry_delivery(
  p_job_id uuid,
  p_reason text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_job public.website_enquiry_delivery_jobs%rowtype;
  v_note text := nullif(btrim(p_note), '');
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null or not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor and profile.is_active and profile.role in ('admin', 'manager')
  ) then
    raise exception 'Active CG admin or manager access required' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('acceptance_test', 'duplicate', 'spam', 'client_request', 'other') then
    raise exception 'Suppression reason is invalid' using errcode = '22023';
  end if;
  if p_reason = 'other' and v_note is null then
    raise exception 'An "other" suppression requires a note' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Suppression note is too long' using errcode = '22023';
  end if;

  select job.* into v_job
  from public.website_enquiry_delivery_jobs job
  where job.id = p_job_id
  for update;
  if not found then
    return jsonb_build_object('applied', false, 'reason', 'not_found');
  end if;
  if v_job.delivery_state = 'suppressed' then
    return jsonb_build_object('applied', false, 'reason', 'already_suppressed', 'state', 'suppressed');
  end if;
  if v_job.delivery_state not in ('pending', 'failed', 'reconcile') then
    return jsonb_build_object('applied', false, 'reason', 'not_suppressible', 'state', v_job.delivery_state);
  end if;

  update public.website_enquiry_delivery_jobs job
  set delivery_state = 'suppressed',
      suppressed_from_state = v_job.delivery_state,
      suppressed_at = v_now,
      suppressed_by = v_actor,
      suppression_reason = p_reason,
      suppression_note = v_note,
      reconcile_reason = null,
      updated_at = v_now
  where job.id = p_job_id;

  return jsonb_build_object('applied', true, 'state', 'suppressed', 'from', v_job.delivery_state, 'at', v_now);
end;
$$;

-- Read-only pre-activation preflight for CG admins/managers: every job a worker could still
-- send (pending/reconcile), with only the fields needed to decide suppression. No message body.
create or replace function public.website_enquiry_delivery_preflight()
returns table (
  job_id uuid,
  delivery_state text,
  attempt_count integer,
  enquiry_id uuid,
  receipt_id uuid,
  accepted_at timestamptz,
  client_name text,
  website_editor_website_id text,
  environment text,
  recipient_email_snapshot text,
  contact_email text,
  subject text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager')
  ) then
    raise exception 'Active CG admin or manager access required' using errcode = '42501';
  end if;

  return query
  select job.id, job.delivery_state, job.attempt_count, enquiry.id, enquiry.receipt_id, enquiry.accepted_at,
         client.name, enquiry.website_editor_website_id, enquiry.environment,
         job.recipient_email_snapshot, enquiry.contact_snapshot ->> 'email',
         enquiry.canonical_payload #>> '{answers,subject}'
  from public.website_enquiry_delivery_jobs job
  join public.website_enquiries enquiry on enquiry.id = job.enquiry_id and enquiry.client_id = job.client_id
  join public.clients client on client.id = job.client_id
  where job.delivery_state in ('pending', 'reconcile')
  order by enquiry.accepted_at, job.id;
end;
$$;

revoke all on function public.suppress_website_enquiry_delivery(uuid, text, text) from public, anon;
revoke all on function public.website_enquiry_delivery_preflight() from public, anon;
grant execute on function public.suppress_website_enquiry_delivery(uuid, text, text) to authenticated;
grant execute on function public.website_enquiry_delivery_preflight() to authenticated;

commit;
