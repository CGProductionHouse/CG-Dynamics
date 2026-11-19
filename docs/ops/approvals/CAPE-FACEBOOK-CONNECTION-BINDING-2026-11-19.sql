-- PREPARED ONLY. Requires CA approval before any production execution.
-- One exact mapping field plus its existing normal updated_at trigger.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '5s';
SET LOCAL TIME ZONE 'UTC';
LOCK TABLE public.meta_client_assets IN SHARE ROW EXCLUSIVE MODE;
DO $cape_binding$
DECLARE
  before_row jsonb;
  after_row jsonb;
  other_rows jsonb;
  affected integer;
BEGIN
  PERFORM 1 FROM public.clients
    WHERE id = '42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa' AND active IS TRUE FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cape client is no longer active'; END IF;
  PERFORM 1 FROM public.meta_connections
    WHERE id = '65d8f626-54d7-45fa-ac75-5348eb364540' AND status = 'connected'
      AND last_connected_at = '2026-11-19T15:43:19.424Z'::timestamptz
      AND scopes @> ARRAY['pages_show_list','pages_read_engagement','pages_manage_posts']::text[]
    FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed Meta connection or grant changed'; END IF;
  IF (SELECT count(*) FROM public.meta_connection_tokens
        WHERE connection_id = '65d8f626-54d7-45fa-ac75-5348eb364540') <> 1
    OR (SELECT count(*) FROM public.meta_connection_tokens
        WHERE connection_id = '65d8f626-54d7-45fa-ac75-5348eb364540'
          AND encrypted_access_token LIKE 'cg-meta-token:v1:%') <> 1
    THEN RAISE EXCEPTION 'Reviewed encrypted credential is unavailable'; END IF;
  IF (SELECT count(*) FROM public.meta_client_assets
        WHERE facebook_page_id = '262645554440912' AND is_active IS TRUE) <> 1
    THEN RAISE EXCEPTION 'Exact Page mapping is ambiguous'; END IF;
  SELECT to_jsonb(a) INTO STRICT before_row FROM public.meta_client_assets a
    WHERE id = '4441c144-d1c5-46b1-980f-9145280857fc'
      AND client_id = '42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa'
      AND facebook_page_id = '262645554440912'
      AND connection_id IS NULL AND is_active IS TRUE FOR UPDATE;
  IF md5(before_row::text) <> '4e2a9390b81f39dd079daca84b8fa70f'
    THEN RAISE EXCEPTION 'Reviewed Cape mapping changed'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb) INTO other_rows
    FROM public.meta_client_assets a WHERE id <> '4441c144-d1c5-46b1-980f-9145280857fc';
  UPDATE public.meta_client_assets SET connection_id = '65d8f626-54d7-45fa-ac75-5348eb364540'
    WHERE id = '4441c144-d1c5-46b1-980f-9145280857fc'
      AND client_id = '42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa'
      AND facebook_page_id = '262645554440912' AND connection_id IS NULL AND is_active IS TRUE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Expected exactly one Cape mapping'; END IF;
  SELECT to_jsonb(a) INTO STRICT after_row FROM public.meta_client_assets a
    WHERE id = '4441c144-d1c5-46b1-980f-9145280857fc';
  IF after_row->>'connection_id' <> '65d8f626-54d7-45fa-ac75-5348eb364540'
    OR (before_row - ARRAY['connection_id','updated_at']) IS DISTINCT FROM
       (after_row - ARRAY['connection_id','updated_at'])
    OR other_rows IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)
       FROM public.meta_client_assets a WHERE id <> '4441c144-d1c5-46b1-980f-9145280857fc')
    THEN RAISE EXCEPTION 'Unexpected mapping change; repair rolled back'; END IF;
END
$cape_binding$;
COMMIT;
