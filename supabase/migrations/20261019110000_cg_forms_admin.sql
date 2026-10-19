-- Admin-only CG Forms inbox and subscriber management. The website's intake
-- capability cannot call these functions; all client/applicant data stays out
-- of direct anon/authenticated table grants.
begin;

create or replace function public.cg_form_submissions(p_client_id uuid, p_limit integer default 50)
returns table (
  receipt_id uuid, purpose text, accepted_at timestamptz,
  website_editor_website_id text, contact jsonb, fields jsonb,
  delivery_states jsonb
)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active) then
    raise exception 'Not authorized for CG Forms' using errcode = '42501';
  end if;
  if p_client_id is null or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Invalid CG Forms query' using errcode = '22023';
  end if;
  return query
  select e.receipt_id, e.purpose, e.accepted_at, e.website_editor_website_id,
    e.contact_snapshot,
    coalesce((select jsonb_agg(jsonb_build_object(
      'key', d.value ->> 'key',
      'label', coalesce(d.value ->> 'label', d.value ->> 'key'),
      'value', e.canonical_payload #> array['answers', d.value ->> 'key']) order by d.ordinality)
      from jsonb_array_elements(s.field_definitions) with ordinality d
      where e.canonical_payload -> 'answers' ? (d.value ->> 'key')), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('state', j.delivery_state, 'updated_at', j.updated_at)
      order by j.created_at) from public.website_enquiry_delivery_jobs j where j.enquiry_id = e.id), '[]'::jsonb)
  from public.website_enquiries e
  join public.website_form_schemas s on s.id = e.form_schema_id and s.endpoint_id = e.endpoint_id
  where e.client_id = p_client_id and e.environment = 'production'
    and e.purpose in ('application', 'booking_request')
  order by e.accepted_at desc, e.id desc
  limit p_limit;
end;
$$;

create or replace function public.cg_form_subscribers(p_client_id uuid, p_limit integer default 100)
returns table (endpoint_id uuid, website_editor_website_id text, normalized_email text, status text,
  consent_at timestamptz, consent_receipt_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active) then
    raise exception 'Not authorized for CG Forms' using errcode = '42501';
  end if;
  if p_client_id is null or p_limit is null or p_limit not between 1 and 500 then
    raise exception 'Invalid CG Forms query' using errcode = '22023';
  end if;
  return query
  select subscriber.endpoint_id, endpoint.website_editor_website_id, subscriber.normalized_email,
    subscriber.status, subscriber.consent_at, subscriber.consent_receipt_id
  from public.website_subscribers subscriber
  join public.website_enquiry_endpoints endpoint on endpoint.id = subscriber.endpoint_id
    and endpoint.client_id = subscriber.client_id
  where subscriber.client_id = p_client_id and endpoint.environment = 'production'
  order by subscriber.consent_at desc, subscriber.normalized_email
  limit p_limit;
end;
$$;

create or replace function public.cg_form_unsubscribe(p_client_id uuid, p_endpoint_id uuid, p_email text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_changed integer;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active) then
    raise exception 'Not authorized for CG Forms' using errcode = '42501';
  end if;
  if p_client_id is null or p_endpoint_id is null or p_email is null or char_length(p_email) > 320 then
    raise exception 'Invalid CG Forms unsubscribe' using errcode = '22023';
  end if;
  update public.website_subscribers subscriber
  set status = 'unsubscribed'
  where subscriber.client_id = p_client_id and subscriber.endpoint_id = p_endpoint_id
    and subscriber.normalized_email = lower(btrim(p_email)) and subscriber.status = 'subscribed'
    and exists (select 1 from public.website_enquiry_endpoints endpoint
      where endpoint.id = p_endpoint_id and endpoint.client_id = p_client_id and endpoint.environment = 'production');
  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

revoke all on function public.cg_form_submissions(uuid, integer) from public, anon;
revoke all on function public.cg_form_subscribers(uuid, integer) from public, anon;
revoke all on function public.cg_form_unsubscribe(uuid, uuid, text) from public, anon;
grant execute on function public.cg_form_submissions(uuid, integer) to authenticated;
grant execute on function public.cg_form_subscribers(uuid, integer) to authenticated;
grant execute on function public.cg_form_unsubscribe(uuid, uuid, text) to authenticated;

commit;
