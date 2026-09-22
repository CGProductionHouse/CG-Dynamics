# #450/#451 production activation ledger — 22 September 2026

Authority: live inspection and the CA-approved activation originally executed against
`dd9215d4d8b8fbe04d91f013aba67fc39e4cae1d`, reconciled with GitHub `main`
`6d58eb5eb9be879e8cbc5722d1f12f1cedbe412f` on 22 September 2026.

## Activation execution status

- Configured both system profile variables to the auth-backed `CG Production House Admin` profile
  and configured two independent high-entropy worker secrets. Secret values are not recorded here.
- Kept `CONTENT_AUTOPILOT_ENABLED`, `CONTENT_AUTOPILOT_GENERATION` and
  `CONTENT_AUTOPILOT_VIDEO_FOLDERS` false. Production has zero Content Autopilot jobs.
- Applied and verified the explicitly approved prerequisite `20260918113000`, then the approved
  four migrations in order. `20260919100000_client_portal_remove_photography.sql` was not applied.
- Deployed the accepted dependency functions with their intended JWT modes. Current relevant
  versions include `microsoft-transition-sync` v31 (`verify_jwt=true`), `meta-sync-worker` v31
  (`verify_jwt=false`), `monthly-strategy-autopilot` v1 (`verify_jwt=true`) and
  `background-worker` v16 (`verify_jwt=false`).
- Meta fleet recovery is live and truthful. At 10:02 UTC it had 39 checkpoint rows for 57 mapped
  platforms, 37 carrying successful evidence, zero PASS, and no active batch. Missing evidence was
  not converted into zero or PASS. The first live fleet cycle later proved that the deployed
  `meta-sync-worker` predates #451 current-month `sync_kind='incremental'` support: current-month
  items are skipped and then selected again, while Red Oak's prior-month read truthfully fails for
  missing `pages_read_engagement`. At 10:48 UTC production had 45 checkpoints for 57 mapped
  platforms (42 successful, three failed). Current `meta-sync-worker` v31 was subsequently deployed
  under explicit CA approval. It correctly completed current-month incremental and historical work;
  checkpoints reached 51 of 57 by 11:18 UTC. Red Oak remains permission-blocked because the stored
  user token claims `pages_read_engagement` but cannot obtain Page access for exact Page
  `117937152934535` (`RedOak LHP`).
- Microsoft did not start a new job. The selected real admin actor also owns the stale 18 September
  preview, so the first implementation repeatedly tried to adopt that historical preview instead
  of starting today's job. The correction on `codex/451-activation-runtime-hardening` makes stale
  previews ineligible, requires both terminal stage and explicit completeness, and prevents recent
  terminal failure from spawning jobs every minute. After that correction deployed, the first
  direct cycle failed before job creation because its `-31`/`+370` range totalled 401 days against
  the existing 370-day guard. `codex/451-activation-range-fix` replaces it with a tested 369-day
  window. Its exact-main deploy then exposed a persistent server-bundler timeout on the function's
  legacy `esm.sh` Supabase client import; `codex/451-edge-dependency-resolution` moves that one import
  to the repository's established JSR source. The resulting live 5,371-record legacy Planner source
  then proved that a 300-detail unit can exceed the background worker's 20-second hand-off budget;
  `codex/451-detail-budget` narrows each durable unit to one normal four-request Graph wave (80 task
  details). No Microsoft write occurred.
- Under explicit CA approval, the existing `cg-background-worker` job was changed only from pg_net's
  default timeout to `timeout_milliseconds=30000`. Job ID 1, `* * * * *` cadence, PostgreSQL
  scheduler identity and background-worker endpoint are unchanged. Subsequent minute responses are
  HTTP 200 with `timed_out=false`, `contentAutopilotSchedule.state=disabled` and Microsoft success.
- Under a later explicit CA gate, `monthly-strategy-autopilot` v1 was deployed with gateway JWT
  verification and `background-worker` v16 was deployed without changing the existing cron. Live
  readback then proved the production `background_jobs_allowed_type` constraint still permits only
  `meta_sync` and `report_prep`, so the strategy job is truthfully rejected before admission. The
  isolated follow-up migration `20260922142000_extend_background_jobs_allowed_type_for_autopilots.sql`
  preserves those two values and adds only `monthly_strategy_autopilot` and `content_autopilot`.
  That migration is code-only and must not be applied before separate CA approval.

## Current live state

- Vercel production is green on `dd9215d4d8b8fbe04d91f013aba67fc39e4cae1d`.
- Existing `cg-background-worker` pg_cron job is active every minute with a 30-second HTTP timeout.
- Production has 37 exact Meta client/asset rows: 37 Facebook + 20 Instagram platforms. At 11:18
  UTC it had 51 checkpoints: 49 successful and two failed. Missing evidence remains non-PASS.
- Microsoft job `40569507-7f78-4e1b-afe0-79b7b06edb4b` is complete: all six required sources are
  complete, zero detail units remain pending, automatic retry count is one and no automatic failure
  was recorded. No `microsoft_sync_runs` apply row exists, so no apply occurred and the last verified
  mirror remained authoritative throughout. No Microsoft write occurred.
- Base durable jobs, Meta checkpointing, Microsoft durable import, OneDrive token/mapping tables,
  and the existing Content Guideline data model are present.
- Econofoods has one upcoming run, one guideline and three guideline ideas. It has no configured
  short code, client OneDrive mapping or run-folder mapping.

## Remaining not live / blocked

- Content Autopilot remains disabled; production has zero `content_autopilot` jobs. AI generation
  and OneDrive folder creation remain disabled.
- Monthly Strategy Autopilot and the updated worker are deployed, but production cannot admit their
  durable jobs until the exact four-type queue constraint migration above is reviewed, merged and
  separately approved for production application. Production still has zero
  `monthly_strategy_autopilot` and zero `content_autopilot` rows; all Content Autopilot flags remain
  false.
- Red Oak complete Meta evidence requires the connecting Facebook user to have Page access to exact
  Page `117937152934535`, then use Dynamics **Integrations → Meta → Reconnect Meta**, select
  `RedOak LHP` in the Facebook asset chooser and approve the already-requested
  `pages_read_engagement` permission. No broad app-scope expansion is indicated: the stored token
  already lists the required scope, while the exact Page-token read returns Graph code 10.
- The Client Portal Photography policy migration `20260919100000` remains intentionally unapplied.
- OneDrive OAuth functions/secrets and client/run mappings remain absent and separately gated.

## Exact protected activation sequence

Every numbered production mutation below requires CA approval at that gate.

The foundation/four migrations, identities/secrets, #451 functions, Meta worker and 30-second cron
timeout described above are already complete and must not be replayed. From the current state, the
remaining ordered sequence is:

1. Accept and merge the isolated exact-four-type constraint migration. With separate CA approval,
   apply only `20260922142000_extend_background_jobs_allowed_type_for_autopilots.sql`, then verify
   the check permits exactly `meta_sync`, `report_prep`, `monthly_strategy_autopilot` and
   `content_autopilot`. Do not alter RLS, RPCs, cron, functions, secrets or flags.
2. Observe one terminal `monthly_strategy_autopilot` durable job for the Johannesburg operating
   date. Verify current/next-month canonical draft receipts, exact client/month idempotency, truthful
   blockers and zero overwrite of existing staff-amended/approved/published strategies. Repeat worker
   invocation must reuse the same daily key.
3. Complete the narrow Red Oak exact-Page access/re-consent gate and verify stable Meta fleet evidence.
4. Only after strategy and Meta evidence pass, separately approve
   `CONTENT_AUTOPILOT_ENABLED=true`. Keep AI generation and OneDrive folder flags false; verify the
   content job was admitted only after the same-day strategy job succeeded.

The original executed activation runbook is retained below as historical evidence of the earlier
protected sequence.

1. Merge the launch-definition fix that adds a gateway-authenticated Microsoft internal call and a
   gated, once-per-Johannesburg-day Content Autopilot enqueue. Rebuild and deploy only from that exact
   accepted SHA.
2. Select one existing active admin profile that is backed by `auth.users`. Record its exact UUID as
   both `MICROSOFT_SYNC_SYSTEM_USER_ID` and `WORKER_SYSTEM_PROFILE_ID`; do not create a synthetic
   profile. Generate independent random values of at least 32 characters for
   `DAILY_FRESHNESS_WORKER_SECRET` and `WORKER_INTERNAL_TOKEN`.
3. Apply the four migrations above in timestamp order. After each, verify the exact history row,
   tables/columns/RPCs, RLS and service-role-only grants. Stop on any mismatch.
4. Deploy `microsoft-transition-sync` with gateway JWT verification enabled. Deploy
   `suggest-content-videos` and `content-run-onedrive-folder` with JWT verification enabled. Deploy
   `meta-connection-status` and `cg-dynamics-mcp` using their existing self-authenticated gateway
   settings. Deploy `meta-sync-worker` with its existing self-authenticated worker-secret contract;
   #451's scheduler and current-month incremental semantics depend on that accepted source. Refresh
   the ChatGPT connector action list after the MCP deploy.
5. Keep `CONTENT_AUTOPILOT_ENABLED=false`, `CONTENT_AUTOPILOT_GENERATION=false` and
   `CONTENT_AUTOPILOT_VIDEO_FOLDERS=false`. Deploy `background-worker` last. This immediately admits
   the Microsoft system cycle and Meta fleet recovery on the already-live minute cron, so treat this
   deploy as the first-live reconciliation gate—not as a passive deploy.
6. Observe evidence until terminal/bounded state: deployed source matches the accepted SHA; cron HTTP
   dispatch remains successful; Microsoft records a new system job/run with complete required-source
   coverage and an applied/completed terminal result (or truthful degraded/failed state while the
   previous verified mirror remains authoritative); Meta creates checkpoints for the 55 missing
   mapped platforms, isolates failures/retries, and never converts missing evidence to zero/PASS.
   Confirm Integrations, Meta detail and Microsoft status agree.
7. Only after Microsoft/Meta evidence is stable, set `CONTENT_AUTOPILOT_ENABLED=true`. The existing
   worker will enqueue one job keyed `content-autopilot:YYYY-MM-DD` in Africa/Johannesburg and will
   not duplicate it under concurrent minute ticks. Leave AI generation and OneDrive folder flags
   false for the first pass. Verify one terminal job plus a `content_autopilot_runs` evidence row;
   repeat invocation must reuse the same daily key and must not overwrite human content.
8. For full Econofoods folder readiness, separately approve the #225 gates: register the delegated
   personal-OneDrive app; set the exact OneDrive secrets; deploy `onedrive-oauth-start` and callback
   with self-authentication; complete one-time personal-account consent; configure the reviewed
   Econofoods short code; create exact durable client/run mappings; then enable
   `CONTENT_AUTOPILOT_VIDEO_FOLDERS=true`. Verify create-only durable IDs and staff-safe readiness;
   never rename, move or delete existing files.
9. Enable `CONTENT_AUTOPILOT_GENERATION=true` only as a separate CA decision after verifying the
   chosen AI provider/research grounding. Confirm only empty draft fields are persisted; no approved,
   published or human-authored content is overwritten.

Rollback is fail-closed: set the three Content Autopilot flags false; remove/rotate the two internal
worker secrets if necessary; redeploy the last known-good functions only if a code rollback is
required. Do not delete evidence rows, mappings, checkpoints or last verified mirrors. Pausing the
existing cron is a separate emergency production gate because it also stops unrelated durable jobs.
