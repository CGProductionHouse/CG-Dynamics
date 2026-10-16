-- SELECT-only repair verification. No credentials or provider payloads.
-- Supersedes the corresponding empty/FB-only mapping observations in the
-- earlier native audit; original client identities and historical posts remain.
SELECT c.name, a.id AS mapping_id, a.client_id, a.facebook_page_id,
       a.instagram_account_id, a.instagram_username,
       a.ad_account_id, a.instagram_not_applicable, a.is_active
FROM meta_client_assets a JOIN clients c ON c.id = a.client_id
WHERE a.client_id IN (
  '7b7d244f-77b4-4b2a-88f0-8ce3f7e1c202',
  'aece5a86-c962-4234-a1fe-7904c20f03ff',
  '3c20fae1-8e91-41d5-98eb-1c331600e6e3',
  '504113ee-fba9-4993-807e-a86066615212',
  '4236a60a-990f-484f-8d19-13d2f92fbe3b',
  '2b953772-e791-4dff-a278-d4dd3521f02e'
) ORDER BY c.name;

SELECT c.name, k.platform, k.last_successful_at, k.next_due_at,
       k.last_status, k.last_health_state, k.high_watermark_at, k.last_error_code
FROM meta_asset_sync_checkpoints k JOIN clients c ON c.id = k.client_id
WHERE k.client_id IN (
  '7b7d244f-77b4-4b2a-88f0-8ce3f7e1c202',
  'aece5a86-c962-4234-a1fe-7904c20f03ff',
  '3c20fae1-8e91-41d5-98eb-1c331600e6e3',
  '504113ee-fba9-4993-807e-a86066615212',
  '4236a60a-990f-484f-8d19-13d2f92fbe3b',
  '2b953772-e791-4dff-a278-d4dd3521f02e'
) ORDER BY c.name, k.platform;

SELECT c.name, r.id AS report_id, r.period_start, r.period_end, r.status,
       count(p.id) AS imported_posts
FROM reports r JOIN clients c ON c.id = r.client_id
LEFT JOIN posts p ON p.report_id = r.id
WHERE r.client_id IN (
  '7b7d244f-77b4-4b2a-88f0-8ce3f7e1c202',
  'aece5a86-c962-4234-a1fe-7904c20f03ff',
  '3c20fae1-8e91-41d5-98eb-1c331600e6e3',
  '504113ee-fba9-4993-807e-a86066615212'
) AND r.period_start >= '2026-09-01' AND r.period_start < '2026-11-01'
GROUP BY c.name, r.id ORDER BY c.name, r.period_start;

SELECT c.name, f.platform, f.metric_key, f.value, f.availability,
       f.period_start, f.period_end, f.verified_at
FROM platform_metric_facts_monthly f JOIN clients c ON c.id = f.client_id
WHERE f.client_id IN (
  '7b7d244f-77b4-4b2a-88f0-8ce3f7e1c202',
  'aece5a86-c962-4234-a1fe-7904c20f03ff',
  '3c20fae1-8e91-41d5-98eb-1c331600e6e3',
  '504113ee-fba9-4993-807e-a86066615212',
  '4236a60a-990f-484f-8d19-13d2f92fbe3b',
  '2b953772-e791-4dff-a278-d4dd3521f02e'
) AND f.period_month = '2026-10' AND f.metric_key = 'brand_views'
ORDER BY c.name, f.platform;

-- Real Meta-mapped rows behind the misleading first-page Manual fallback label.
SELECT c.name, r.id AS report_id, count(DISTINCT p.id) AS post_count,
       count(DISTINCT m.post_id) AS mapped_post_count
FROM reports r JOIN clients c ON c.id = r.client_id
LEFT JOIN posts p ON p.report_id = r.id
LEFT JOIN meta_content_mappings m ON m.report_id = r.id AND m.post_id = p.id
WHERE r.client_id IN (
  '7b7d244f-77b4-4b2a-88f0-8ce3f7e1c202',
  'aece5a86-c962-4234-a1fe-7904c20f03ff',
  '3c20fae1-8e91-41d5-98eb-1c331600e6e3',
  '504113ee-fba9-4993-807e-a86066615212'
) AND r.period_start = '2026-10-01'
GROUP BY c.name, r.id ORDER BY c.name;

-- Do not confuse photo object identity with story identity. This additional
-- permalink check also returns none; it is not a provider-object eligibility test.
SELECT c.name, p.meta_post_id, p.permalink, p.publish_time, r.id AS report_id
FROM posts p JOIN reports r ON r.id = p.report_id
JOIN clients c ON c.id = r.client_id
WHERE p.permalink LIKE '%1551335327010846%'
   OR p.permalink LIKE '%1979003833321539%'
   OR p.permalink LIKE '%1751385370329586%'
   OR p.permalink LIKE '%1569849948505224%'
   OR p.permalink LIKE '%1568586765298209%';

-- After v68 complete102-Page discovery, Forklift was exposed at Page101 and
-- explicitly linked through the ordinary admin workflow (not through SQL).
SELECT id AS mapping_id, client_id, facebook_page_id, instagram_account_id,
       instagram_username, ad_account_id, instagram_not_applicable, is_active
FROM meta_client_assets
WHERE client_id = '4424ed69-7270-4d30-a1ea-0b77d76912df';

SELECT platform, last_status, last_health_state, last_successful_at,
       high_watermark_at, next_due_at, last_error_code
FROM meta_asset_sync_checkpoints
WHERE client_id = '4424ed69-7270-4d30-a1ea-0b77d76912df'
ORDER BY platform;

SELECT r.id, r.period_start, r.period_end, r.status, count(p.id) AS imported_posts
FROM reports r LEFT JOIN posts p ON p.report_id = r.id
WHERE r.client_id = '4424ed69-7270-4d30-a1ea-0b77d76912df'
GROUP BY r.id ORDER BY r.period_start DESC;
