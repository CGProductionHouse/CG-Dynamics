# P540 — Monthly Strategy Autopilot Redeploy Runbook

**Issue:** #540 — P0 Strategy runtime parity: redeploy canonical `monthly-strategy-autopilot`
**Status:** READY FOR SUPERVISOR REVIEW
**Date:** 2026-09-27
**Prepared by:** OpenCode Agent (issue owner)

---

## 1. Drift Proof — Exact Current-Main vs Live v5

### Live Production (v5) — OLD LOGIC
The deployed `monthly-strategy-autopilot` v5 derives package readiness from:
- `client_packages` table (active row matching strategy month)
- `monthly_deliverables` table (deliverables scheduled for the month)

**Evidence of live failure (2026-09-23):**
- Neshora Oxygen package confirmed at 19:03Z
- At ~22:00Z the old autopilot seeded Sep/Oct drafts anyway with `PACKAGE_UNVERIFIED` blocker and generic placeholder strategy text
- Both rows remain draft, version 1, unamended, unapproved, unpublished
- **Root cause:** Live code treated `client_packages` + `monthly_deliverables` presence as "package ready", ignoring that `clients.package_settings` lacked a verification receipt

### Current Main (Canonical) — CORRECT LOGIC
The current `main` branch uses **only** `clients.package_settings` via `readPackageAuthority()`:

```typescript
// supabase/functions/_shared/monthlyStrategyAutopilot.ts:189
const packageAuthority = readPackageAuthority(client.package_settings)

// supabase/functions/_shared/monthlyStrategyAutopilot.ts:204
if (!packageAuthority.settings || !packageAuthority.verification) blockers.push('PACKAGE_UNVERIFIED')
```

**Key differences:**

| Aspect | Live v5 (Old) | Current Main (Canonical) |
|--------|---------------|--------------------------|
| Package authority source | `client_packages` + `monthly_deliverables` inference | `clients.package_settings` via `readPackageAuthority()` |
| Verification required | No (presence = ready) | Yes (explicit `verification` receipt with `confirmed_at`, `confirmed_by_profile_id`, `source_references`) |
| Empty/partial package | Treated as zero-filled ready package | Fails closed → `PACKAGE_UNVERIFIED` blocker |
| `client_packages` query | Used for readiness decision | Used ONLY for `seedContext.sources.client_package_id` provenance |
| `monthly_deliverables` | Used for readiness inference | Used ONLY for `deliverable_ids` provenance + calendar selections |

### Source-Level Diff (Canonical Module)

**Current main** (`supabase/functions/_shared/monthlyStrategyAutopilot.ts`):
```typescript
// Line 154-160: Fetches client_packages ONLY for seedContext provenance
sb.from('client_packages').select('id')
  .eq('client_id', clientId)
  .eq('status', 'active')
  .lt('start_date', nextMonth)
  .or(`end_date.is.null,end_date.gte.${strategyMonth}`)
  .order('start_date', { ascending: false })
  .limit(1).maybeSingle(),

// Line 189: CANONICAL package readiness decision
const packageAuthority = readPackageAuthority(client.package_settings)

// Line 204: Hard blocker if unverified
if (!packageAuthority.settings || !packageAuthority.verification) blockers.push('PACKAGE_UNVERIFIED')

// Line 295: client_packages ID used ONLY for provenance
client_package_id: (packageRow.data as Record<string, unknown> | null)?.id ?? null,
```

**Live v5** (inferred from incident): Used `client_packages` row existence + `monthly_deliverables` count to infer package readiness, bypassing `readPackageAuthority()`.

---

## 2. Test Parity — Regression/Parity Tests Added

New tests in `tests/monthlyStrategyAutopilot.test.mjs` that catch the old logic:

| Test | Purpose | Catches Old Logic |
|------|---------|-------------------|
| `package readiness uses canonical clients.package_settings via readPackageAuthority, not client_packages/monthly_deliverables inference` | Static source scan | `readPackageAuthority(client.package_settings)` present; `packageFromDeliverables` absent; no combined inference pattern |
| `client_packages table query exists only for seedContext provenance, not package readiness decision` | Ordering guard | `readPackageAuthority` call precedes blocker check; `client_packages` query result only used in `seedContext` |
| `confirmed monthly_deliverables without confirmed package_settings still produces PACKAGE_UNVERIFIED blocker` | Runtime behavior | 3 deliverables + active `client_packages` row → still blocked (0 drafts, 2 `PACKAGE_UNVERIFIED`) |
| `active client_packages row without confirmed package_settings still produces PACKAGE_UNVERIFIED blocker` | Runtime behavior | Active package row + partial `package_settings` → still blocked |
| `only confirmed package_settings with verification receipt allows draft creation` | Positive control | Full verification receipt → 2 drafts created, 0 blocked |

**All 5 new tests pass.** Existing 17 tests continue to pass.

---

## 3. Redeploy Package — Scope & Artifacts

### Scope: ONLY `monthly-strategy-autopilot` Edge Function

**Files to deploy (no other changes):**
1. `supabase/functions/monthly-strategy-autopilot/index.ts` (entrypoint, unchanged)
2. `supabase/functions/_shared/monthlyStrategyAutopilot.ts` (canonical logic, current main)
3. `supabase/functions/_shared/monthlyStrategyAutopilotSchedule.ts` (schedule helpers, unchanged)

**NOT included in this redeploy:**
- ❌ `background-worker` (parity not proven; separate gate if needed)
- ❌ Any database migrations (none required)
- ❌ Neshora row amendments (separate protected action)
- ❌ Strategy approval/publication (separate protected action)
- ❌ Ops handover edits (separate)

### Build Verification

```bash
# From repo root
npm run build
# Must exit 0 with app code in dist/assets/*.js
```

### Pre-Deploy Checklist

- [ ] `git status` clean on `main`
- [ ] `npm run build` passes
- [ ] All monthly strategy autopilot tests pass (`npm test -- tests/monthlyStrategyAutopilot.test.mjs`)
- [ ] All package authority tests pass (`npm test -- tests/activeClientPackageStrategyAuthority.test.mjs`)
- [ ] No open PRs touching `monthly-strategy-autopilot` or `_shared/monthlyStrategyAutopilot.ts`
- [ ] Supabase project target confirmed (production)
- [ ] `WORKER_INTERNAL_TOKEN`, `WORKER_SYSTEM_PROFILE_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` configured in production Edge Function env

---

## 4. Redeploy Procedure (Production-Safe)

### Step 1: Verify Current-Main Bundle
```bash
# Local verification
npm run build
npm test -- tests/monthlyStrategyAutopilot.test.mjs
npm test -- tests/activeClientPackageStrategyAuthority.test.mjs
npm test -- tests/monthlyStrategyWorkerIntegration.test.mjs
```

### Step 2: Deploy ONLY the Autopilot Function
```bash
# Using Supabase CLI (from repo root)
supabase functions deploy monthly-strategy-autopilot \
  --project-ref <PRODUCTION_PROJECT_REF> \
  --no-verify-jwt
```

**Expected:** Function deployed as new version (v6+). No scheduler changes. No background-worker changes.

### Step 3: Verify Live Bundle Parity (Read-Only Health Check)

**Immediate (within 5 min):**
```bash
# Invoke manually with worker token to verify new logic
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/monthly-strategy-autopilot \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "X-Internal-Worker-Token: <WORKER_INTERNAL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Verify response contains:**
- `ok: true` (or `207` with `ok: false` only if some clients failed prep)
- `blockers.PACKAGE_UNVERIFIED` present for clients without verified packages
- `drafts_created` > 0 only for clients with verified `package_settings`
- No `STRATEGY_PREPARATION_FAILED` errors

**Within 24h (next scheduled run):**
- Check background worker job log for `MONTHLY_STRATEGY_AUTOPILOT_JOB_TYPE`
- Confirm `jobStatus === 'succeeded'`
- Spot-check 2-3 clients: verified packages → drafts created; unverified → `PACKAGE_UNVERIFIED` blocker counted

### Step 4: Post-Deploy Monitoring (48h)

| Metric | Expected | Alert If |
|--------|----------|----------|
| `monthly_strategy_autopilot` invocations | 1/day (scheduled) | 0 or >2 |
| `PACKAGE_UNVERIFIED` blocker count | Non-zero (unverified clients exist) | Zero (would indicate old logic) |
| `drafts_created` | Matches verified-package clients | Exceeds verified count |
| `failed` | 0 | >0 |
| `STRATEGY_PREPARATION_FAILED` | 0 | >0 |

---

## 5. Protected Gates — What Happens Next (Separate Actions)

| Action | Authority | Timing |
|--------|-----------|--------|
| Amend Neshora Sep/Oct drafts (strategy_id=...) | Explicit CA gate + exact-client reviewed intelligence | After intelligence ready |
| Approve any strategy to `approved`/`published` | Protected gate (#391 RPC contract) | Never from autopilot |
| Deploy background-worker parity | Separate PR + supervisor review | Only if parity proven necessary |
| Update ops handover | Coordinator | After redeploy verified |

---

## 6. Rollback Procedure

If live verification fails (Step 3):
```bash
# Rollback to previous version (v5)
supabase functions deploy monthly-strategy-autopilot \
  --project-ref <PRODUCTION_PROJECT_REF> \
  --version <v5_VERSION_ID> \
  --no-verify-jwt
```
**Note:** Rollback restores old logic. Neshora drafts remain unamended. Do not amend rows under rollback.

---

## 7. Sign-Off

- [ ] Drift proven with source references ✅
- [ ] Regression/parity tests added and passing ✅
- [ ] Build passes ✅
- [ ] Redeploy scope limited to single function ✅
- [ ] No background-worker, migration, row amendment, or approval changes ✅
- [ ] Runbook complete — ready for supervisor review

**Next step:** Supervisor review → merge → deploy per Step 2 above.