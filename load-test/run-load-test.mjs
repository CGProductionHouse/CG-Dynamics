/**
 * Load test harness for PR #202 — bounded parallel lanes for durable Meta sync.
 *
 * Tests:
 * 1. One-lane baseline (111 items, 1 lane)
 * 2. Four-lane parallel (111 items, 4 lanes)
 * 3. Failure injection (HTTP 429 + Graph error codes)
 *
 * Run: node load-test/run-load-test.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const WORKER_URL = 'http://127.0.0.1:54321/functions/v1/meta-sync-worker';
const WORKER_SECRET = 'load-test-secret-123';
const MOCK_STATS = 'http://localhost:54325/__stats__';
const MOCK_RESET = 'http://localhost:54325/__reset__';
const MOCK_CONTROL = 'http://localhost:54325/__control__';
const DB = 'supabase_db_repo-pr202';
const SEED_FILE = `${__dirname}/seed-load-test.sql`;

// Write SQL to a temp file on the host, copy to container, execute
function psql(query) {
  const tmpSql = `${__dirname}/tmp-query.sql`;
  const singleLine = query.replace(/\s+/g, ' ');
  fs.writeFileSync(tmpSql, singleLine);
  execSync(`docker cp "${tmpSql}" ${DB}:/tmp/tmp-query.sql`);
  try {
    const result = execSync(
      `docker exec ${DB} psql -U postgres -d postgres -t -v ON_ERROR_STOP=0 -f /tmp/tmp-query.sql 2>&1`,
      { encoding: 'utf8', timeout: 30000 }
    ).trim();
    return result;
  } catch (e) {
    return `ERROR: ${e.message}`;
  } finally {
    try { fs.unlinkSync(tmpSql); } catch {}
  }
}

function resetBatch() {
  execSync(`docker cp "${SEED_FILE}" ${DB}:/tmp/seed-load-test.sql`);
  execSync(`docker exec ${DB} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed-load-test.sql 2>&1`, { timeout: 30000 });
}

async function getMockStats() {
  return await fetch(MOCK_STATS).then(r => r.json());
}

async function resetMock() {
  await fetch(MOCK_RESET);
}

async function setMockControl(control) {
  await fetch(MOCK_CONTROL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(control),
  });
}

async function triggerWorker(payload, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'x-worker-secret': WORKER_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { status: r.status, text: await r.text() };
  } catch (e) {
    return { status: 0, text: e.name === 'AbortError' ? 'TIMEOUT' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

function getBatchId() {
  return psql("SELECT id FROM meta_sync_batches WHERE (summary->>'load_test')::text = 'true' LIMIT 1;").trim();
}

function getBatchState(batchId) {
  const res = psql(`SELECT status, total_items, completed_items, failed_items, started_at, finished_at, cooldown_until, recovery_attempts FROM meta_sync_batches WHERE id = '${batchId}';`);
  const lines = res.split('\n').filter(l => l.trim());
  if (lines.length < 1) return { status: 'unknown', completed: 0, failed: 0, total: 111, started_at: null, finished_at: null };
  // With -t flag, there's no header row, so data is in lines[0]
  const parts = (lines.length >= 2 ? lines[1] : lines[0]).split('|').map(x => x.trim());
  return {
    status: parts[0], total: parseInt(parts[1]) || 0,
    completed: parseInt(parts[2]) || 0,
    failed: parseInt(parts[3]) || 0,
    started_at: parts[4] || null,
    finished_at: parts[5] || null,
    cooldown_until: parts[6] || null,
    recovery_attempts: parseInt(parts[7]) || 0,
  };
}

function getDetailedMetrics(batchId) {
  return {
    itemStatus: psql(`SELECT status, COUNT(*) FROM meta_sync_batch_items WHERE batch_id = '${batchId}' GROUP BY status ORDER BY status;`),
    laneActivity: psql(`SELECT lane_id, COUNT(*) as claims FROM meta_sync_batch_lanes WHERE batch_id = '${batchId}' GROUP BY lane_id ORDER BY lane_id;`),
    syncRuns: psql(`SELECT sync_type, status, COUNT(*) FROM meta_sync_runs WHERE batch_item_id IN (SELECT id FROM meta_sync_batch_items WHERE batch_id = '${batchId}') GROUP BY sync_type, status ORDER BY sync_type;`),
    resumedItems: psql(`SELECT COUNT(*) as resumed FROM meta_sync_batch_items WHERE batch_id = '${batchId}' AND attempts > 0;`),
    totalAttempts: psql(`SELECT SUM(attempts) as total, MAX(attempts) as max FROM meta_sync_batch_items WHERE batch_id = '${batchId}';`),
    postCounts: psql(`SELECT COUNT(*) as total_posts FROM posts p JOIN reports r ON p.report_id = r.id WHERE r.client_id IN (SELECT client_id FROM meta_sync_batch_items WHERE batch_id = '${batchId}');`),
    duplicateReports: psql(`SELECT client_name, platform, COUNT(*) as dupes FROM reports r JOIN meta_sync_batch_items bi ON bi.client_id = r.client_id WHERE bi.batch_id = '${batchId}' AND r.report_title ILIKE '%Load Test%' AND r.platform IN ('facebook','instagram') GROUP BY client_name, platform, r.report_month_label HAVING COUNT(*) > 1 LIMIT 5;`),
    duplicatePosts: psql(`SELECT meta_post_id, COUNT(*) as cnt FROM posts p JOIN reports r ON p.report_id = r.id WHERE r.client_id IN (SELECT client_id FROM meta_sync_batch_items WHERE batch_id = '${batchId}') GROUP BY meta_post_id HAVING COUNT(*) > 1 LIMIT 5;`),
    contentMappings: psql(`SELECT COUNT(*) as total FROM meta_content_mappings WHERE client_id IN (SELECT DISTINCT client_id FROM meta_sync_batch_items WHERE batch_id = '${batchId}');`),
    metricFacts: psql(`SELECT platform, COUNT(*) as facts FROM platform_metric_facts_monthly WHERE client_id IN (SELECT DISTINCT client_id FROM meta_sync_batch_items WHERE batch_id = '${batchId}') GROUP BY platform;`),
    lanesCreated: psql(`SELECT COUNT(*) FROM meta_sync_batch_lanes WHERE batch_id = '${batchId}';`),
    orphanItems: psql(`SELECT COUNT(*) FROM meta_sync_batch_items WHERE batch_id = '${batchId}' AND client_id NOT IN (SELECT id FROM clients WHERE name LIKE 'Load Test Client %');`),
  };
}

async function runLoadTest(label, laneCount, maxWaitSec = 300) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`LOAD TEST: ${label}`);
  console.log(`${'='.repeat(60)}\n`);

  resetBatch();
  await resetMock();
  const batchId = getBatchId();
  console.log(`Batch ID: ${batchId}`);
  console.log(`Mock stats reset. Starting test...\n`);

  const startWall = Date.now();

  console.log(`Triggering worker with ${laneCount} lane(s)...`);
  const triggerResult = await triggerWorker({
    batchId,
    maxItems: 1,
    workerLanes: laneCount,
    startLanes: laneCount > 1 ? true : false,
  });
  console.log(`Initial trigger: ${triggerResult.status}`);

  let lastProgress = 0;
  let stalledSince = Date.now();
  const pollInterval = 2000;
  let elapsed = 0;

  while (elapsed < maxWaitSec * 1000) {
    await new Promise(r => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    const state = getBatchState(batchId);
    const stats = await getMockStats();
    const progress = state.completed + state.failed;

    if (progress > lastProgress) {
      lastProgress = progress;
      stalledSince = Date.now();
    }

    const running = parseInt(psql(`SELECT COUNT(*) FROM meta_sync_batch_items WHERE batch_id = '${batchId}' AND status = 'running';`));
    console.log(`[${Math.floor(elapsed/1000)}s] status=${state.status}, completed=${state.completed}, failed=${state.failed}, running=${running}, graph_calls=${stats.graphCalls}`);

    if (state.status === 'completed') break;

    if (Date.now() - stalledSince > 20000 && running === 0 && state.completed + state.failed < state.total) {
      console.log(`  [STALLED ${Math.round((Date.now()-stalledSince)/1000)}s] Manual re-trigger...`);
      await triggerWorker({ batchId, maxItems: 1, workerLanes: laneCount });
      stalledSince = Date.now();
    }
  }

  const endWall = Date.now();
  const durationMs = endWall - startWall;
  const finalStats = await getMockStats();
  const finalState = getBatchState(batchId);
  const detailed = getDetailedMetrics(batchId);

  console.log(`\nTest complete in ${Math.round(durationMs/1000)}s`);
  console.log(`Items: ${finalState.completed}/${finalState.total} completed, ${finalState.failed} failed`);
  console.log(`Graph calls: ${finalStats.graphCalls}`);
  console.log(`  Page tokens: ${finalStats.pageTokenCalls}`);
  console.log(`  Post listings: ${finalStats.postListingCalls}`);
  console.log(`  IG media: ${finalStats.igMediaListingCalls}`);
  console.log(`  Insights: ${finalStats.insightProbes}`);
  console.log(`  Page fields: ${finalStats.pageFieldProbes}`);
  console.log(`  429s: ${finalStats.http429s}`);
  console.log(`Item status: ${detailed.itemStatus}`);
  console.log(`Lane activity: ${detailed.laneActivity}`);
  console.log(`Sync runs: ${detailed.syncRuns}`);
  console.log(`Resumed items: ${detailed.resumedItems}`);
  console.log(`Total attempts: ${detailed.totalAttempts}`);
  console.log(`Posts synced: ${detailed.postCounts}`);

  return {
    label, laneCount, batchId,
    durationMs, wallTimeSeconds: Math.round(durationMs/1000),
    itemsPerMinute: (111 / (durationMs/60000)).toFixed(1),
    graphCalls: finalStats.graphCalls,
    http429s: finalStats.http429s,
    errorCodes: finalStats.errorCodes,
    pageTokenCalls: finalStats.pageTokenCalls,
    postListingCalls: finalStats.postListingCalls,
    igMediaListingCalls: finalStats.igMediaListingCalls,
    insightProbes: finalStats.insightProbes,
    pageFieldProbes: finalStats.pageFieldProbes,
    batchStatus: finalState.status,
    totalItems: finalState.total,
    completedItems: finalState.completed,
    failedItems: finalState.failed,
    itemStatus: detailed.itemStatus,
    laneActivity: detailed.laneActivity,
    syncRuns: detailed.syncRuns,
    resumedItems: detailed.resumedItems,
    totalAttempts: detailed.totalAttempts,
    postCounts: detailed.postCounts,
    duplicateReports: detailed.duplicateReports,
    duplicatePosts: detailed.duplicatePosts,
    contentMappings: detailed.contentMappings,
    metricFacts: detailed.metricFacts,
    lanesCreated: detailed.lanesCreated,
    orphanItems: detailed.orphanItems,
    cooldownUntil: finalState.cooldown_until,
    recoveryAttempts: finalState.recovery_attempts,
    startedAt: finalState.started_at,
    finishedAt: finalState.finished_at,
  };
}

async function runFailureInjectionTest(label, laneCount, control) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FAILURE INJECTION: ${label}`);
  console.log(`${'='.repeat(60)}\n`);

  resetBatch();
  await setMockControl(control);
  await new Promise(r => setTimeout(r, 500));
  await resetMock();

  const batchId = getBatchId();
  console.log(`Batch ID: ${batchId}`);

  const startWall = Date.now();

  await triggerWorker({
    batchId, maxItems: 1, workerLanes: laneCount, startLanes: true,
  });
  console.log(`Triggered with failure injection.`);

  let lastProgress = 0;
  let stalledSince = Date.now();
  let elapsed = 0;
  const maxWait = 120000;

  while (elapsed < maxWait) {
    await new Promise(r => setTimeout(r, 2000));
    elapsed += 2000;
    const state = getBatchState(batchId);
    const stats = await getMockStats();
    const progress = state.completed + state.failed;
    if (progress > lastProgress) { lastProgress = progress; stalledSince = Date.now(); }
    const running = parseInt(psql(`SELECT COUNT(*) FROM meta_sync_batch_items WHERE batch_id = '${batchId}' AND status = 'running';`));
    console.log(`[${Math.floor(elapsed/1000)}s] completed=${state.completed}, failed=${state.failed}, running=${running}, 429s=${stats.http429s}, errors=${JSON.stringify(stats.errorCodes)}`);
    if (state.status === 'completed') break;
    if (Date.now() - stalledSince > 20000 && running === 0 && state.completed + state.failed < state.total) {
      console.log(`  [STALLED] Manual re-trigger...`);
      await triggerWorker({ batchId, maxItems: 1, workerLanes: laneCount });
      stalledSince = Date.now();
    }
  }

  const durationMs = Date.now() - startWall;
  const finalStats = await getMockStats();
  const finalState = getBatchState(batchId);

  return {
    label, laneCount, batchId,
    durationMs, wallTimeSeconds: Math.round(durationMs/1000),
    graphCalls: finalStats.graphCalls,
    http429s: finalStats.http429s,
    errorCodes: finalStats.errorCodes,
    batchStatus: finalState.status,
    completedItems: finalState.completed,
    failedItems: finalState.failed,
    cooldownUntil: finalState.cooldown_until,
    recoveryAttempts: finalState.recovery_attempts,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('PR #202 Load Test Harness — bounded parallel lanes');
console.log('Environment: Local Supabase stack (Docker containers)');
console.log('Mock Meta Graph API: mock-meta-api container on supabase_network');
console.log('=' .repeat(60));

const results = { timestamp: new Date().toISOString() };

try {
  results.oneLane = await runLoadTest('ONE-LANE BASELINE', 1);
  results.fourLane = await runLoadTest('FOUR-LANE PARALLEL', 4);

  results.fail429 = await runFailureInjectionTest('HTTP 429 INJECTION', 4, {
    rateLimited: true, rateLimitEveryN: 20, errorCodes: {},
    slowResponse: false, slowMs: 0, dropTokenMap: false, returnEmpty: false,
    injectErrorAtCall: {}, disabledPages: [],
  });

  results.failErrors = await runFailureInjectionTest('GRAPH ERROR CODES', 4, {
    rateLimited: false, rateLimitEveryN: 0,
    errorCodes: { '17': 15, '32': 20, '341': 25 },
    slowResponse: false, slowMs: 0, dropTokenMap: false, returnEmpty: false,
    injectErrorAtCall: {}, disabledPages: [],
  });

  fs.writeFileSync('load-test/results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to load-test/results.json');

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY COMPARISON');
  console.log('='.repeat(60));
  console.log(`One lane:    ${results.oneLane.wallTimeSeconds}s | ${results.oneLane.itemsPerMinute} items/min | ${results.oneLane.graphCalls} calls | lanes: ${results.oneLane.laneActivity}`);
  console.log(`Four lanes:  ${results.fourLane.wallTimeSeconds}s | ${results.fourLane.itemsPerMinute} items/min | ${results.fourLane.graphCalls} calls | lanes: ${results.fourLane.laneActivity}`);
  const speedup = (results.oneLane.wallTimeSeconds / results.fourLane.wallTimeSeconds).toFixed(2);
  console.log(`Speedup: ${speedup}x`);

} catch (e) {
  console.error('Load test failed:', e.message);
  console.error(e.stack);
  process.exit(1);
}
