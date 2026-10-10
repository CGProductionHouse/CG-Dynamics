-- #731 local-only exact-client context review acceptance.
-- Run with scripts/local-db-acceptance.sh on a disposable repo database only.
\set ON_ERROR_STOP on
set search_path = public, extensions;

insert into auth.users (id) values
  ('71173100-0000-4000-8000-000000000001'),
  ('71173100-0000-4000-8000-000000000002'),
  ('71173100-0000-4000-8000-000000000003')
on conflict (id) do nothing;
insert into public.profiles (id, full_name, role, is_active) values
  ('71173100-0000-4000-8000-000000000001', 'Local Manager', 'manager', true),
  ('71173100-0000-4000-8000-000000000002', 'Local Staff', 'staff', true),
  ('71173100-0000-4000-8000-000000000003', 'Inactive Manager', 'manager', false)
on conflict (id) do update
  set full_name = excluded.full_name, role = excluded.role, is_active = excluded.is_active;
insert into public.clients (id, name, active) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Local Client A', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Local Client B', true);
insert into public.client_context_updates (
  id, client_id, update_kind, title, body, decisions, unresolved,
  recorded_by_profile_id, connection_principal_user_id, idempotency_key
) values
  ('aaaa0000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'meeting_outcome', 'A decision', 'Test one buyer question', '[]', '[]', '71173100-0000-4000-8000-000000000001', '71173100-0000-4000-8000-000000000001', 'aaaa0000-0000-4000-8000-000000000011'),
  ('aaaa0000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'meeting_outcome', 'Another A decision', 'Do not use this source', '[]', '[]', '71173100-0000-4000-8000-000000000001', '71173100-0000-4000-8000-000000000001', 'aaaa0000-0000-4000-8000-000000000012'),
  ('bbbb0000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'meeting_outcome', 'B decision', 'Other client private source', '[]', '[]', '71173100-0000-4000-8000-000000000001', '71173100-0000-4000-8000-000000000001', 'bbbb0000-0000-4000-8000-000000000011');

set role authenticated;
select set_config('request.jwt.claim.sub', '71173100-0000-4000-8000-000000000002', false);
do $$ begin
  perform public.review_client_context_update('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaa0000-0000-4000-8000-000000000001', 'unreviewed', 'incorporated');
  raise exception 'staff role unexpectedly reviewed a source';
exception when others then
  if sqlerrm not like '%Active manager access required%' then raise; end if;
end $$;

select set_config('request.jwt.claim.sub', '71173100-0000-4000-8000-000000000003', false);
do $$ begin
  perform public.review_client_context_update('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaa0000-0000-4000-8000-000000000001', 'unreviewed', 'incorporated');
  raise exception 'inactive manager unexpectedly reviewed a source';
exception when others then
  if sqlerrm not like '%Active manager access required%' then raise; end if;
end $$;

select set_config('request.jwt.claim.sub', '71173100-0000-4000-8000-000000000001', false);
do $$ begin
  perform public.review_client_context_update('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbb0000-0000-4000-8000-000000000001', 'unreviewed', 'incorporated');
  raise exception 'cross-client update unexpectedly reviewed';
exception when others then
  if sqlerrm not like '%Exact client update not found%' then raise; end if;
end $$;
do $$ begin
  perform public.review_client_context_update('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaa0000-0000-4000-8000-000000000001', 'unreviewed', 'published');
  raise exception 'invalid decision unexpectedly accepted';
exception when others then
  if sqlerrm not like '%Exact unreviewed update and decision required%' then raise; end if;
end $$;

do $$ declare v_receipt jsonb; begin
  v_receipt := public.review_client_context_update('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaa0000-0000-4000-8000-000000000001', 'unreviewed', 'incorporated');
  if v_receipt->>'review_state' <> 'incorporated' or v_receipt->>'replayed' <> 'false'
      or v_receipt->>'reviewed_by_profile_id' <> '71173100-0000-4000-8000-000000000001'
      or v_receipt->>'reviewed_at' is null then raise exception 'manager receipt incomplete'; end if;
  v_receipt := public.review_client_context_update('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaa0000-0000-4000-8000-000000000001', 'unreviewed', 'incorporated');
  if v_receipt->>'replayed' <> 'true' then raise exception 'repeat decision did not replay'; end if;
end $$;
do $$ begin
  perform public.review_client_context_update('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaa0000-0000-4000-8000-000000000001', 'unreviewed', 'rejected');
  raise exception 'opposite decision unexpectedly accepted';
exception when others then
  if sqlerrm not like '%Client update review conflict%' then raise; end if;
end $$;
do $$ declare v_receipt jsonb; begin
  v_receipt := public.review_client_context_update('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaa0000-0000-4000-8000-000000000002', 'unreviewed', 'rejected');
  if v_receipt->>'review_state' <> 'rejected' then raise exception 'explicit rejection failed'; end if;
end $$;
do $$ begin
  update public.client_context_updates set review_state = 'rejected'
    where id = 'bbbb0000-0000-4000-8000-000000000001';
  raise exception 'direct authenticated table update unexpectedly succeeded';
exception when insufficient_privilege then null;
end $$;
reset role;

set role anon;
do $$ begin
  perform public.review_client_context_update('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbb0000-0000-4000-8000-000000000001', 'unreviewed', 'incorporated');
  raise exception 'anonymous caller unexpectedly reviewed a source';
exception when insufficient_privilege then null;
end $$;
reset role;

do $$ begin
  if (select count(*) from public.client_context_updates where client_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and reviewed_at is not null and reviewed_by_profile_id = '71173100-0000-4000-8000-000000000001') <> 2 then
    raise exception 'audit actor/time missing';
  end if;
  if (select review_state from public.client_context_updates where id = 'bbbb0000-0000-4000-8000-000000000001') <> 'unreviewed' then
    raise exception 'other client source changed';
  end if;
end $$;
select 'ALL #731 CONTEXT REVIEW CHECKS PASSED' as result;
