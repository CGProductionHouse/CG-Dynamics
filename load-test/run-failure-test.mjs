/**
 * Failure injection tests for PR #202.
 * Tests HTTP 429 and Graph error code handling.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DB = 'supabase_db_repo-pr202';
const SEED_FILE = `${__dirname}/seed-load-test.sql`;
const MOCK_STATS = 'http://localhost:54325/__stats__';
const MOCK_RESET = 'http://localhost:54325/__reset__';
const MOCK_CONTROL = 'http://localhost:54325/__control__';

function psql(query) {
  const tmpSql = `${__dirname}/tmp-query.sql`;
  const singleLine = query.replace(/\s+/g, ' ');
  fs.writeFileSync(tmpSql, singleLine);
  execSync(`docker cp "${tmpSql}" ${DB}:/tmp/tmp-query.sql`);
  try {
    return execSync(
      `docker exec ${DB} psql -U postgres -d postgres -t -v ON_ERROR_STOP=0 -f /tmp/tmp-query.sql 2>&1`,
      { encoding: 'utf8', timeout: 30000 }
    ).trim();
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

async function resetMock() { await fetch(MOCK_RESET); }
async function getMockStats() { return await fetch(MOCK_STATS).then(r => r.json()); }
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
    const r = await fetch('http://127.0.0.1:54321/functions/v1/meta-sync-worker', {
      method: 'POST',
      headers: { 'x-worker-secret': 'load-test-secret-123', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { status: r.status };
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
  const res = psql(`SELECT status, total_items, completed_items, failed_items, cooldown_until, recovery_attempts FROM meta_sync_batches WHERE id = '${batchId}';`);
  const lines = res.split('\n').filter(l => l.trim());
  if (lines.length < 1) return { status: 'unknown', completed: 0, failed: 0, total: 0 };
  const dataLine = lines.length >= 2 ? lines[1] : lines[0];
  const parts = dataLine.split('|').map(x => x.trim());
  return {
    status: parts[0], total: parseInt(parts[1]) || 0, completed: parseInt(parts[2]) || 0,
    failed: parseInt(parts[3]) || 0, cooldown_until: parts[4] || null, recovery_attempts: parseInt(parts[5]) || 0,
  };
}

async function runTest(testName, control, laneCount, maxWaitSec = 180) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FAILURE INJECTION: ${testName}`);
  console.log(`${'='.repeat(60)}\n`);

  resetBatch();
  await resetMock();
  await new Promise(r => setTimeout(r, 500));
  await setMockControl(control);
  await new Promise(r => setTimeout(r, 500));

  const batchId = getBatchId();
  console.log(`Batch ID: ${batchId}`);

  const startWall = Date.now();
  await triggerWorker({ batchId, maxItems: 1, workerLanes: laneCount, startLanes: true });
  console.log(`Triggered with ${laneCount} lanes.`);

  let lastProgress = 0;
  let stalledSince = Date.now();
  const pollInterval = 3000;
  let elapsed = 0;

  while (elapsed < maxWaitSec * 1000) {
    await new Promise(r => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    const state = getBatchState(batchId);
    const stats = await getMockStats();
    const progress = state.completed + state.failed;

    if (progress > lastProgress) { lastProgress = progress; stalledSince = Date.now(); }

    console.log(`[${Math.floor(elapsed/1000)}s] status=${state.status}, completed=${state.completed}, failed=${state.failed}, 429s=${stats.http429s}, errors=${JSON.stringify(stats.errorCodes)}, graph_calls=${stats.graphCalls}`);

    if (state.status === 'completed') break;

    if (Date.now() - stalledSince > 20000 && progress < state.total) {
      console.log(`  [STALLED ${Math.round((Date.now()-stalledSince)/1000)}s] Manual re-trigger...`);
      await triggerWorker({ batchId, maxItems: 1, workerLanes: laneCount });
      stalledSince = Date.now();
    }
  }

  const durationMs = Date.now() - startWall;
  const finalStats = await getMockStats();
  const finalState = getBatchState(batchId);

  console.log(`\nTest complete in ${Math.round(durationMs/1000)}s`);
  console.log(`Items: ${finalState.completed}/${finalState.total} completed, ${finalState.failed} failed`);
  console.log(`429s: ${finalStats.http429s}`);
  console.log(`Error codes: ${JSON.stringify(finalStats.errorCodes)}`);
  console.log(`Cooldown until: ${finalState.cooldown_until}`);
  console.log(`Recovery attempts: ${finalState.recovery_attempts}`);

  // Check for duplicates/orphans
  const dupReports = psql(`SELECT COUNT(*) FROM reports r WHERE r.client_id IN (SELECT DISTINCT client_id FROM meta_sync_batch_items WHERE batch_id = '${batchId}') AND r.report_month_label IN (SELECT DISTINCT client_name || '_' || month FROM meta_sync_batch_items WHERE batch_id = '${batchId}') GROUP BY r.client_id, r.report_month_label, r.platform HAVING COUNT(*) > 1;`);
  console.log(`Duplicate reports: ${dupReports || 'none'}`);

  const dupPosts = psql(`SELECT COUNT(*) FROM posts p JOIN reports r ON p.report_id = r.id WHERE r.client_id IN (SELECT DISTINCT client_id FROM meta_sync_batch_items WHERE batch_id = '${batchId}') GROUP BY p.meta_post_id HAVING COUNT(*) > 1;`);
  console.log(`Duplicate posts: ${dupPosts || 'none'}`);

  const orphanItems = psql(`SELECT COUNT(*) FROM meta_sync_batch_items WHERE batch_id = '${batchId}' AND client_id NOT IN (SELECT id FROM clients WHERE name LIKE 'Load Test Client %');`);
  console.log(`Orphan items: ${orphanItems}`);

  const itemStatus = psql(`SELECT status, COUNT(*) FROM meta_sync_batch_items WHERE batch_id = '${batchId}' GROUP BY status ORDER BY status;`);
  console.log(`Item status breakdown: ${itemStatus}`);

  const totalAttempts = psql(`SELECT SUM(attempts) as total, MAX(attempts) as max FROM meta_sync_batch_items WHERE batch_id = '${batchId}';`);
  console.log(`Total attempts: ${totalAttempts}`);

  return {
    testName, laneCount, batchId, durationMs: Math.round(durationMs/1000),
    totalItems: finalState.total, completedItems: finalState.completed, failedItems: finalState.failed,
    graphCalls: finalStats.graphCalls, http429s: finalStats.http429s, errorCodes: finalStats.errorCodes,
    cooldownUntil: finalState.cooldown_until, recoveryAttempts: finalState.recovery_attempts,
    itemStatus, totalAttempts, orphanItems,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('PR #202 Failure Injection Tests');
console.log('=' .repeat(60));

const results = { timestamp: new Date().toISOString() };

try {
  // Test 1: HTTP 429 injection
  results.fail429 = await runTest('HTTP 429 RATE LIMIT', {
    rateLimited: true, rateLimitEveryN: 15,
    errorCodes: {}, slowResponse: false, slowMs: 0,
    dropTokenMap: false, returnEmpty: false,
    injectErrorAtCall: {}, disabledPages: [],
  }, 4, 180);

  // Test 2: Graph error codes
  results.failErrors = await runTest('GRAPH ERROR CODES 17/32/341', {
    rateLimited: false, rateLimitEveryN: 0,
    errorCodes: { '17': 10, '32': 15, '341': 20 },
    slowResponse: false, slowMs: 0,
    dropTokenMap: false, returnEmpty: false,
    injectErrorAtCall: {}, disabledPages: [],
  }, 4, 180);

  // Test 3: Stale reclaim (simulate by checking lease recovery)
  results.staleReclaim = await runTest('NO INJECTION (baseline for stale check)', {
    rateLimited: false, rateLimitEveryN: 0,
    errorCodes: {}, slowResponse: false, slowMs: 0,
    dropTokenMap: false, returnEmpty: false,
    injectErrorAtCall: {}, disabledPages: [],
  }, 4, 180);

  // Save results
  fs.writeFileSync(`${__dirname}/results-failure.json`, JSON.stringify(results, null, 2));
  console.log('\n\nResults saved to load-test/results-failure.json');

  console.log('\n' + '='.repeat(60));
  console.log('FAILURE INJECTION SUMMARY');
  console.log('='.repeat(60));
  console.log(`429 injection: ${results.fail429.wallTimeSeconds}s | ${results.fail429.completedItems}/${results.fail429.totalItems} completed | 429s=${results.fail429.http429s}`);
  console.log(`Error codes:   ${results.failErrors.wallTimeSeconds}s | ${results.failErrors.completedItems}/${results.failErrors.totalItems} completed | errors=${JSON.stringify(results.failErrors.errorCodes)}`);
  console.log(`No injection:  ${results.staleReclaim.wallTimeSeconds}s | ${results.staleReclaim.completedItems}/${results.staleReclaim.totalItems} completed`);

} catch (e) {
  console.error('Failure injection tests failed:', e.message);
  console.error(e.stack);
  process.exit(1);
}
