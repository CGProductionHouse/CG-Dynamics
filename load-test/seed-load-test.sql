-- ============================================================
-- Load test seed data for PR #202 controlled load test
-- Creates: 37 clients, Meta connection, 37 assets, batch with 111 items
-- Run on local Supabase only (non-production).
-- ============================================================

-- Clean up any previous test data
DELETE FROM public.meta_sync_batch_items WHERE batch_id IN (
    SELECT id FROM public.meta_sync_batches WHERE (summary->>'load_test')::text = 'true'
);
DELETE FROM public.meta_sync_batches WHERE (summary->>'load_test')::text = 'true';
DELETE FROM public.meta_client_assets WHERE facebook_page_id LIKE '1000000000000%';
DELETE FROM public.meta_connection_tokens WHERE connection_id IN (
    SELECT id FROM public.meta_connections WHERE meta_business_id = 'load-test-business'
);
DELETE FROM public.meta_connections WHERE meta_business_id = 'load-test-business';
DELETE FROM public.clients WHERE name LIKE 'Load Test Client %';

-- 1. Create a Meta connection (shared by all clients)
WITH conn_insert AS (
  INSERT INTO public.meta_connections (
    connected_by, meta_business_id, meta_business_name, status, scopes, last_connected_at
  ) VALUES (
    NULL, 'load-test-business', 'Load Test Business', 'connected',
    ARRAY['pages_show_list', 'pages_read_engagement', 'instagram_basic'],
    now()
  ) ON CONFLICT DO NOTHING RETURNING id
)
INSERT INTO public.meta_connection_tokens (
  connection_id, encrypted_access_token, token_expires_at
)
SELECT id, 'load-test-access-token', now() + interval '60 days' FROM conn_insert
ON CONFLICT DO NOTHING;

-- 2. Create 37 clients with deterministic UUIDs
WITH client_uuids AS (
  INSERT INTO public.clients (id, name, tier, active)
  SELECT
    ('00000000-0000-0000-0000-' || LPAD((100000 + g)::text, 12, '0'))::uuid,
    'Load Test Client ' || g,
    'premium',
    true
  FROM generate_series(1, 37) AS g
  RETURNING id, name, right(name, 2)::int AS num
),
conn AS (
  SELECT id FROM public.meta_connections WHERE meta_business_id = 'load-test-business' LIMIT 1
)
-- 3. Create 37 Meta client assets linking clients to page IDs and IG account IDs
INSERT INTO public.meta_client_assets (
  client_id, connection_id, facebook_page_id, facebook_page_name,
  instagram_account_id, instagram_username, is_active
)
SELECT
  cu.id,
  conn.id,
  ('100' || LPAD(cu.num::text, 13, '0')),
  'Client ' || cu.num,
  ('200' || LPAD(cu.num::text, 13, '0')),
  'client_' || cu.num,
  true
FROM client_uuids cu
CROSS JOIN conn;

-- 4. Create a sync batch with 111 items (37 clients × 3 months)
WITH batch AS (
  INSERT INTO public.meta_sync_batches (
    mode, requested_by, status, sync_range_months, total_items, summary
  ) VALUES (
    'selected', NULL, 'queued', 3, 111,
    '{"load_test": "true", "clientCount": 37, "months": ["2026-05", "2026-06", "2026-07"]}'::jsonb
  )
  RETURNING id
)
INSERT INTO public.meta_sync_batch_items (
  batch_id, client_id, client_name, month, status
)
SELECT
  b.id,
  c.id,
  c.name,
  m.month,
  'queued'
FROM batch b
CROSS JOIN public.clients c
CROSS JOIN (SELECT unnest(ARRAY['2026-05', '2026-06', '2026-07']) AS month) m
WHERE c.name LIKE 'Load Test Client %';
