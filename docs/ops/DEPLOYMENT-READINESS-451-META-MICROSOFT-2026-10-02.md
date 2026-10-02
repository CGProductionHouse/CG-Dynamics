# Zero-Write Combined Deployment Readiness — `microsoft-transition-sync`, `background-worker`, `meta-connection-status`

**Authority**: #451 comment 5955857018, #623 comment 5955857018, #381. Base current main `2ce29344a78bcef5d4a96fd27a87a7a2699fb2ee` (includes Microsoft #639 merge `7ff12f492003c89ad164da42b2c92495560bd4ce` and Meta #642 merge `2c27e74fe0d798fdffff877d358a0fa13f355292`).

**No production deployment, migration, config change, secret rotation, provider action, or data write is authorized by this document.** This is a readiness assessment only. Explicit CA authorization required for each deployment step.

---

## 1. Deployed-vs-Main Parity Check

### 1.1 `microsoft-transition-sync` (v39, JWT=true)

**Current main head**: `2ce2934` (includes PR #639 merge)

| File | Main SHA | Key Changes Since Last Deploy |
|------|----------|-------------------------------|
| `index.ts` | 573 lines | CPU repair: automatic-system skips protected Client Schedule detail/assignee work; six-source completeness preserved; automatic apply reads only writable payloads; recovery requires exact `preview_job_id` + `trigger_type=agent`; July manual run excluded; `ok=true` only for `completed` |
| `automatic-reconciliation.ts` | - | Writable-source-only apply; validates counts/IDs; 1,650 mirror records from 7,500 coverage |
| `automatic-snapshot.ts` | - | Protected detail queue resume after enumeration complete; automatic completeness cache |
| `planner-details.ts` | - | `shouldFetchPlannerTaskDetails` logic for automatic vs manual |
| `job-machine.ts` | - | `planAutomaticSourceRecovery`, `planAutomaticApplyRecovery`, `planAutomaticSystemCycle`, pagination helpers |
| `assignee-lookup.ts` | - | Batched Graph assignee resolution |
| `bounded-workers.ts` | - | Concurrency control for Graph batches |

**Parity verification commands** (run against deployed function):
```bash
# Check deployed version header/metadata
curl -X POST https://<project>.supabase.co/functions/v1/microsoft-transition-sync \
  -H "Authorization: Bearer <service_role>" \
  -H "Content-Type: application/json" \
  -d '{"action":"status"}'
# Verify: connected=true, transitionStatus=active, freshness.lastSuccessfulReconciliationAt matches expected
# Verify: sources array shows 6 sources with correct names/types
```

**Expected deployed behavior** (post-#639):
- Automatic `system_cycle` advances one durable Microsoft source unit per invocation
- Six-source completeness: Calendar, To Do, MASTER CLIENT TO DO, CG Socials, Client Socials July 2026, 2025 CLIENTS SCHEDULE
- Protected Client Schedule (Client Socials + 2025 CLIENTS SCHEDULE) detail/assignee work skipped in automatic mode
- Manual/admin `job_result` still loads full snapshot with all detail work
- No `monthly_deliverables` writes in automatic path

### 1.2 `background-worker` (v27, JWT=false)

**Current main head**: `2ce2934` (includes PR #642 merge)

| File | Main SHA | Key Changes Since Last Deploy |
|------|----------|-------------------------------|
| `index.ts` | ~1186 lines | Meta terminal-bootstrap re-enqueue suppression via `metaFleetTerminalBackoff` (imported); fleet freshness enqueue bounded to 2 batches/invocation; active-work dedupe includes cooldown items; Microsoft-before-Meta ordering verified; stale batch reaper + lane recovery |

**Parity verification commands**:
```bash
# Invoke worker directly (requires service role)
curl -X POST https://<project>.supabase.co/functions/v1/background-worker \
  -H "Authorization: Bearer <service_role>" \
  -H "Content-Type: application/json" \
  -d '{}'
# Verify response includes: microsoftFreshness, reaped, laneRecoveries, fleetFreshness
# Verify: microsoftFreshness.ok=true, httpStatus=200
# Verify: fleetFreshness returns array (empty or with batch objects)
```

**Expected deployed behavior** (post-#642):
- Per-minute cron tick invokes this function
- Microsoft freshness advanced first (calls `microsoft-transition-sync` with `system_cycle`)
- Stalled Meta sync batches reaped (heartbeat > 120s, queued/running items remain)
- Meta sync lane recovery invoked for eligible lanes
- Fleet freshness enqueues proactive sync for due checkpoints (max 2 batches/invocation)
- Terminal bootstrap failures (Red Oak) suppressed via one-hour cooldown from failure
- No duplicate enqueue for asset+month with active queued/running work

### 1.3 `meta-connection-status` (JWT=true)

**Current main head**: `2ce2934`

| File | Main SHA | Key Changes Since Last Deploy |
|------|----------|-------------------------------|
| `index.ts` | 334 lines | Token validation cached 24h; `inspectMetaAccessToken` diagnostics; asset health projection with checkpoint + recovery overlay; `schemaReady` guard for migration-safe deployment |

**Parity verification commands**:
```bash
curl -X POST https://<project>.supabase.co/functions/v1/meta-connection-status \
  -H "Authorization: Bearer <user_jwt>" \
  -H "Content-Type: application/json" \
  -d '{}'
# Verify: connected=true, status=connected, assetHealth array populated
# Verify: tokenLifecycle.validation_state in {valid, unverified, expired, data_access_expired}
# Verify: schemaReady=true (migration applied)
```

**Expected deployed behavior**:
- Returns real-time connection status, token lifecycle, and per-asset/platform health
- `assetHealth` includes checkpoint evidence + recovery overlay (`retrying`, `cooldown_until`)
- Missing checkpoint → `STALE` with reason "Mapped platform has never completed its bootstrap checkpoint"
- Failed checkpoint with prior success → `PARTIAL` preserving original success timestamp
- Token re-validation only after 24h cache expiry

---

## 2. Exact Rollout Order

**Rationale**: `background-worker` calls `microsoft-transition-sync` and `meta-sync-worker`. `meta-connection-status` is independent read path. Deploy in dependency order.

| Step | Function | Verify Before Next Step |
|------|----------|-------------------------|
| 1 | `microsoft-transition-sync` | Status endpoint returns `connected=true`, 6 sources, `transitionStatus=active`. Manual `job_start` → `job_process` → `job_result` completes with 6-source snapshot. Automatic `system_cycle` returns `phase=fresh` or `phase=process` without error. |
| 2 | `background-worker` | Direct invocation returns `microsoftFreshness.ok=true`, `fleetFreshness` array (no `detail: 'META_SYNC_WORKER_SECRET not configured'`). Cron tick (pg_cron) shows successful execution in logs. |
| 3 | `meta-connection-status` | Authenticated call returns `connected=true`, `assetHealth` populated, `schemaReady=true`. Token validation works (no `configuration_error`). |

**Rollout timing**: Each step must be verified in production before proceeding. Minimum 15 minutes observation between steps.

---

## 3. Rollback Targets

| Function | Rollback Target | Rollback Command | Validation |
|----------|-----------------|------------------|------------|
| `microsoft-transition-sync` | Previous deployed version (pre-#639) | `supabase functions deploy microsoft-transition-sync --no-verify-jwt` (with previous bundle) | Status endpoint works; manual job flow works; automatic `system_cycle` returns `phase=fresh` or `degraded` without crash |
| `background-worker` | Previous deployed version (pre-#642) | `supabase functions deploy background-worker --verify-jwt=false` | Direct invocation works; cron tick succeeds; no Meta batch re-enqueue churn |
| `meta-connection-status` | Previous deployed version | `supabase functions deploy meta-connection-status --verify-jwt=true` | Authenticated call works; `assetHealth` returns (may use fallback token read if migration not applied) |

**Rollback trigger conditions** (any one):
- Function returns 5xx errors > 5% of invocations in 5 minutes
- `microsoft-transition-sync` automatic apply returns `status=failed` with new error class
- `background-worker` fleet freshness creates duplicate batches (same asset+month queued/running)
- `meta-connection-status` returns `schemaReady=false` persistently (migration not applied)

---

## 4. Post-Deploy Acceptance Criteria

### 4.1 `microsoft-transition-sync` — Automatic System Cycle

| Check | Expected | Evidence Source |
|-------|----------|-----------------|
| Six-source fetch completes | 6/6 sources `complete=true`, zero `failed` | `microsoft_sync_job_sources` for latest system job |
| Automatic apply runs | `microsoft_sync_runs` row: `trigger_type=agent`, `status=completed` | `microsoft_sync_runs` latest automatic run |
| Mirror records applied | ~1,650 records (writable sources only) | `microsoft_sync_runs.summary.applied` |
| Protected schedule excluded | `clientScheduleExcluded=5,850` (not zero) | `microsoft_sync_runs.summary.clientScheduleExcluded` |
| No CPU/546 errors | Zero `WORKER_RESOURCE_LIMIT` in Edge logs | Supabase Edge Function logs |
| Completion mirrors truthful | 18 previously active tasks → `done`/`cancelled` | `planner_tasks` + `outlook_events` join vs mirror |
| Health verdict | Integrations UI shows `PARTIAL` (recovery in progress) or `PASS` | `/admin/integrations` authenticated session |

### 4.2 `background-worker` — Fleet Freshness + Reaper

| Check | Expected | Evidence Source |
|-------|----------|-----------------|
| Microsoft-before-Meta ordering | `microsoftFreshness` completes before `reaped`/`fleetFreshness` | Worker response JSON order |
| Stalled batch reaper | Batches with heartbeat >120s get worker invoked | `meta_sync_batch_items` recovery notes |
| Lane recovery | Eligible lanes dispatched to `meta-sync-worker` | `meta_sync_lane_recovery_candidates` RPC results |
| Fleet freshness enqueue | Due checkpoints → batches created (max 2/invocation) | `meta_sync_batches` with `summary.via='fleet_freshness'` |
| Terminal bootstrap suppression | Red Oak FB: no new bootstrap batches for 1h from failure | `meta_sync_batch_items.cooldown_until` respected |
| No duplicate enqueue | Zero asset+month with multiple queued/running items | `meta_sync_batch_items` active-work dedupe |

### 4.3 `meta-connection-status` — Health Projection

| Check | Expected | Evidence Source |
|-------|----------|-----------------|
| Connected status | `connected=true`, `status=connected` | Function response |
| Token lifecycle | `validation_state=valid`, `lastValidatedAt` recent | Function response `tokenLifecycle` |
| Asset health projection | 42 clients / 42 assets / 67 platforms mapped | Function response `assetHealth` length |
| Freshness verdicts | 0 PASS, 0 FAILED, 1 STALE (Red Oak FB), 66 PARTIAL, 0 UNAVAILABLE | Function response `assetHealth[*].verdict` |
| Recovery overlay | Failed items show `retrying=true`, `cooldown_until` set | Function response `assetHealth[*].facebook/instagram.retrying` |
| Schema ready | `schemaReady=true` (migration applied) | Function response |

---

## 5. Environment Variables Required (Verify Deployed)

| Variable | `microsoft-transition-sync` | `background-worker` | `meta-connection-status` |
|----------|----------------------------|---------------------|--------------------------|
| `SUPABASE_URL` | ✓ | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | ✓ |
| `MICROSOFT_TENANT_ID` | ✓ | - | - |
| `MICROSOFT_CLIENT_ID` | ✓ | - | - |
| `MICROSOFT_CLIENT_SECRET` | ✓ | - | - |
| `MICROSOFT_SYNC_SOURCES_JSON` | ✓ | - | - |
| `MICROSOFT_SYNC_SYSTEM_USER_ID` | ✓ | - | - |
| `DAILY_FRESHNESS_WORKER_SECRET` | ✓ (32+ chars) | ✓ (same) | - |
| `META_SYNC_WORKER_SECRET` | - | ✓ | - |
| `META_SYNC_WORKER_URL` | - | ✓ (optional) | - |
| `META_APP_ID` | - | - | ✓ |
| `META_APP_SECRET` | - | - | ✓ |
| `WORKER_INTERNAL_TOKEN` | - | ✓ (32+ chars) | - |
| `WORKER_SYSTEM_PROFILE_ID` | - | ✓ | - |
| `VAPID_PUBLIC_KEY` | - | ✓ | - |
| `VAPID_PRIVATE_KEY` | - | ✓ | - |
| `VAPID_SUBJECT` | - | ✓ | - |

**Verify**: All variables present in Supabase Dashboard → Edge Functions → each function → Environment Variables.

---

## 6. Database Migration Prerequisites

| Migration | Required For | Status |
|-----------|--------------|--------|
| `20260809120000_calendar_outlook_identity.sql` | `microsoft-transition-sync` (Outlook identity columns) | **PENDING CA APPROVAL** |
| `20260809130000_client_portal_visibility_contract.sql` | `meta-connection-status` (token schema: `validation_state`, `last_validated_at`, etc.) | **PENDING CA APPROVAL** |
| Meta checkpoint/recovery columns (`cooldown_until`, `facebook_sync_state`, `instagram_sync_state`) | `background-worker` fleet freshness + `meta-connection-status` recovery overlay | Verify applied |

**Do not deploy any function until its required migrations are confirmed applied in production.**

---

## 7. Cron/Schedule Configuration (Verify)

| Schedule | Function | Expression | Status |
|----------|----------|------------|--------|
| `cg-background-worker` | `background-worker` | `* * * * *` (every minute) | Active in `cron.job` |
| Assistant push refresh | `cg-assistant-push-refresh` | `*/5 * * * *` | Active |

**Verify**: `SELECT * FROM cron.job WHERE jobname IN ('cg-background-worker', 'cg-assistant-push-refresh');`

---

## 8. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Microsoft automatic apply fails with new error | Low | High | Rollback `microsoft-transition-sync`; last verified mirror remains |
| Background worker CPU timeout on large fleet | Medium | Medium | Fleet freshness bounded to 2 batches; observe first 3 cron ticks |
| Meta connection status shows `schemaReady=false` | Low (migration pending) | Medium | Deploy `meta-connection-status` only after migration; fallback read path exists |
| Terminal bootstrap churn not fully suppressed | Low (tested) | Medium | Cooldown logic in `metaFleetTerminalBackoff`; verify `cooldown_until` respected |
| Token validation hits rate limit | Very Low | Low | 24h cache; `META_APP_SECRET` required |

---

## 9. Sign-Off Checklist (Each Step Requires CA Authorization)

```
[ ] CA authorizes `microsoft-transition-sync` deployment
[ ] Deploy `microsoft-transition-sync` v39 (JWT=true)
[ ] Verify: status endpoint, manual job flow, automatic system_cycle
[ ] CA authorizes `background-worker` deployment
[ ] Deploy `background-worker` v27 (JWT=false)
[ ] Verify: direct invocation, cron tick, Microsoft freshness advance, fleet freshness
[ ] CA authorizes `meta-connection-status` deployment
[ ] Deploy `meta-connection-status` (JWT=true)
[ ] Verify: authenticated call, assetHealth projection, token validation
[ ] CA authorizes production Microsoft reconciliation trigger (separate from code deploy)
[ ] Observe first full automatic reconciliation cycle
[ ] Verify: six-source completeness, automatic apply receipt, no 546 errors, truthful health
```

---

## 10. Current Blockers (Must Resolve Before Deployment)

1. **Migration `20260809120000_calendar_outlook_identity.sql` not applied** — Required for `microsoft-transition-sync` Outlook identity columns.
2. **Migration `20260809130000_client_portal_visibility_contract.sql` not applied** — Required for `meta-connection-status` token schema (`validation_state`, `last_validated_at`, `validation_error_code`, `validation_error_reason`, `data_access_expires_at`, `token_type`).
3. **`DAILY_FRESHNESS_WORKER_SECRET` and `META_SYNC_WORKER_SECRET` must be 32+ chars** — Verify in Supabase Dashboard.
4. **`META_APP_SECRET` must be configured** — Required for `meta-connection-status` token validation (Instagram standalone review prerequisite).
5. **Production Microsoft mirror is STALE** — Last full applied run 19 Aug 2026. Automatic reconciliation has not completed apply phase. Deployment does not fix this; live reconciliation must be separately authorized and observed.

---

## 11. Next Protected Actions (After Deployment)

1. **Explicit CA authorization** to trigger/observe live Microsoft automatic reconciliation (not a code deploy).
2. **Verify** six-source fetch → automatic apply → mirror counts → completion/cancellation truth → truthful Integrations health.
3. **Explicit CA authorization** for any explicit data repair (e.g., 18 stale task statuses, July manual run cleanup).
4. **Meta terminal bootstrap** — Red Oak access recovery requires exact owner/CA action (Page re-consent), not code change.
5. **Instagram standalone** — 25 unmapped identities; `META_APP_SECRET` + App Review/Live + exact-owner consent required.

---

**Document Owner**: Agent 01 (#451 lane)
**Review Required**: Supervisor (#381) + CA
**No Master Handover Edit**: This is a lane-specific readiness assessment.