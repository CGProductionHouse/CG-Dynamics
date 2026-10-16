-- Read-only reproducibility queries for the native browser audit.
-- Observed 16 October 2026. Re-running does not reproduce the browser UI state.
-- No provider requests, data writes, credentials, raw payloads or private comments.

-- Ehrlich: exact native post ID was absent across every stored report/client.
SELECT p.meta_post_id, p.publish_time, r.client_id, r.id AS report_id,
       r.period_start, r.period_end, r.status
FROM posts p
JOIN reports r ON r.id = p.report_id
WHERE p.meta_post_id LIKE '%1551335327010846%';

-- Compare the post observation with the current durable worker checkpoint.
SELECT platform, last_sync_kind, last_status, last_health_state,
       last_successful_at, high_watermark_at, last_error_code
FROM meta_asset_sync_checkpoints
WHERE client_id = 'ec643c75-51f5-4839-829f-3f5b7f48829a';

-- Account facts are not per-post metrics, and period_month is YYYY-MM text.
SELECT platform, metric_key, source_metric, value, availability,
       aggregation, period_start, period_end, verified_at
FROM platform_metric_facts_monthly
WHERE client_id = 'ec643c75-51f5-4839-829f-3f5b7f48829a'
  AND period_month = '2026-10'
ORDER BY platform, metric_key;

-- Bouwer's local-display first-day post needs exact provider timestamp review;
-- do not insert it into October based on Johannesburg date alone.
SELECT p.meta_post_id, p.publish_time, r.id AS report_id,
       r.period_start, r.period_end, r.status
FROM posts p
JOIN reports r ON r.id = p.report_id
WHERE r.client_id = '8e448cf9-1534-4ba1-89a4-93e4c8b83d2f'
  AND (p.meta_post_id LIKE '%122128552868918576%'
       OR p.publish_time >= '2026-10-01');

-- CG/Central Canvas: checkpoint freshness is separate from completed-day bounds.
SELECT c.name, k.platform, k.last_successful_at, k.next_due_at,
       k.last_status, k.last_health_state
FROM meta_asset_sync_checkpoints k
JOIN clients c ON c.id = k.client_id
WHERE k.client_id IN ('c27d2185-08e4-4c49-be48-2572564ceecf',
                      '6b313cac-283e-48c4-9df6-ba43af2f7353')
ORDER BY c.name, k.platform;

-- Existing Elcheck/Forklift accounts were independently observed in native Meta.
-- Empty results here are app integration gaps, not evidence of no native activity.
SELECT client_id, facebook_page_id, facebook_page_name,
       instagram_account_id, instagram_username, is_active
FROM meta_client_assets
WHERE client_id IN ('7b7d244f-77b4-4b2a-88f0-8ce3f7e1c202',
                    '4424ed69-7270-4d30-a1ea-0b77d76912df');

-- HMHI: older native public post absent; API eligibility still unverified.
SELECT p.meta_post_id, p.publish_time, r.client_id, r.id AS report_id
FROM posts p JOIN reports r ON r.id = p.report_id
WHERE p.meta_post_id LIKE '%1979003833321539%';

SELECT platform, last_status, last_health_state, last_successful_at,
       high_watermark_at, last_error_code
FROM meta_asset_sync_checkpoints
WHERE client_id = '572555e0-d4d0-404a-8d67-beeeeed6a1f2';

-- Further native older Facebook posts absent while IG companions were stored.
SELECT p.meta_post_id, p.publish_time, r.client_id, r.id AS report_id
FROM posts p JOIN reports r ON r.id = p.report_id
WHERE p.meta_post_id LIKE '%1751385370329586%'
   OR p.meta_post_id LIKE '%1569849948505224%'
   OR p.meta_post_id LIKE '%1568586765298209%';

SELECT client_id, platform, last_successful_at, last_status,
       last_health_state, high_watermark_at, last_error_code
FROM meta_asset_sync_checkpoints
WHERE client_id IN ('917d6f7c-1c2a-4c20-82f0-daa41b9062f5',
                    '1f0406bb-d643-4b83-bc3e-b1ebe87eeb89');

-- Small same-window UI/API differences are retained, not overwritten.
SELECT client_id, platform, metric_key, value, period_start, period_end, verified_at
FROM platform_metric_facts_monthly
WHERE period_month = '2026-10' AND metric_key = 'brand_views'
  AND ((client_id = '4f6106de-c437-404e-8cef-fbe848de0665' AND platform = 'facebook')
    OR (client_id = 'e1cb958e-3f68-4a77-b5ea-b471ea62bdef' AND platform = 'facebook')
    OR (client_id = '1f0406bb-d643-4b83-bc3e-b1ebe87eeb89' AND platform = 'instagram'));

-- WiseRide has no app row; Novus/We Ar Fuels have Facebook-only app mappings.
SELECT client_id, facebook_page_id, instagram_account_id, instagram_username, is_active
FROM meta_client_assets
WHERE client_id IN ('504113ee-fba9-4993-807e-a86066615212',
                    '4236a60a-990f-484f-8d19-13d2f92fbe3b',
                    '2b953772-e791-4dff-a278-d4dd3521f02e');
