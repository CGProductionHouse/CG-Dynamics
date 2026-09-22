# #450/#451 production activation ledger — 22 September 2026

Authority: live inspection and the CA-approved activation against GitHub `main`
`03b5d49f6777469badb0b23a9e08c28f702af751` on 22 September 2026.

## Activation execution status

- Configured both system profile variables to the auth-backed `CG Production House Admin` profile
  and configured two independent high-entropy worker secrets. Secret values are not recorded here.
- Kept `CONTENT_AUTOPILOT_ENABLED`, `CONTENT_AUTOPILOT_GENERATION` and
  `CONTENT_AUTOPILOT_VIDEO_FOLDERS` false. Production has zero Content Autopilot jobs.
- Applied and verified the explicitly approved prerequisite `20260918113000`, then the approved
  four migrations in order. `20260919100000_client_portal_remove_photography.sql` was not applied.
- Deployed `microsoft-transition-sync` v27 and the other dependency functions with the intended JWT
  modes: `suggest-content-videos` v12, `content-run-onedrive-folder` v3,
  `meta-connection-status` v24 and `cg-dynamics-mcp` v15. Deployed `background-worker` v14 last.
- Meta fleet recovery is live and truthful. At 10:02 UTC it had 39 checkpoint rows for 57 mapped
  platforms, 37 carrying successful evidence, zero PASS, and no active batch. Missing evidence was
  not converted into zero or PASS. The first live fleet cycle later proved that the deployed
  `meta-sync-worker` predates #451 current-month `sync_kind='incremental'` support: current-month
  items are skipped and then selected again, while Red Oak's prior-month read truthfully fails for
  missing `pages_read_engagement`. At 10:48 UTC production had 45 checkpoints for 57 mapped
  platforms (42 successful, three failed). Deploying current `meta-sync-worker` is therefore an
  additional protected dependency gate; do not mistake the five-function deploy for a complete
  Meta runtime rollout.
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
- The existing cron cadence is correct, but its `net.http_post` command omits
  `timeout_milliseconds`, leaving pg_net's five-second default. New worker calls exceed that while
  durable downstream Meta work continues. Updating only that timeout is a new protected cron
  mutation and must be approved before final reconciliation acceptance.

## Already live

- Vercel production serves `f8e1ae8`; authenticated desktop/mobile acceptance passed.
- Existing `cg-background-worker` pg_cron job is active every minute. Its last 60 runs in the
  inspected hour all succeeded at the SQL/HTTP-dispatch layer.
- Production has 37 exact Meta client/asset rows: 37 Facebook + 20 Instagram platforms. It has
  only two checkpoints, both last successful on 17 September; 55 mapped platforms have no
  checkpoint. The UI therefore correctly reports STALE rather than PASS.
- Microsoft provider credentials/source manifest exist. The registry has one active plan and
  transition status is active. The last durable fetch job completed on 18 September with six source
  rows (five complete, one failed); the last fully applied reconciliation is older, from 19 August,
  with all six sources complete. Production Microsoft truth is therefore stale/partial, not fresh.
- Base durable jobs, Meta checkpointing, Microsoft durable import, OneDrive token/mapping tables,
  and the existing Content Guideline data model are present.
- Econofoods has one upcoming run, one guideline and three guideline ideas. It has no configured
  short code, client OneDrive mapping or run-folder mapping.

## Not live

The following committed migrations are absent from production, and their defining tables/RPCs are
also absent:

1. `20260921090000_content_production_autopilot.sql`
2. `20260921120000_daily_dynamics_service_reconciliation.sql`
3. `20260921140000_content_autopilot_corrections.sql`
4. `20260922120000_system_worker_profile.sql`

Do not use a blanket `supabase db push`: production migration history contains older remote/local
drift. Apply only these reviewed files, in timestamp order, and verify each history row and required
object before continuing.

The deployed functions are all behind current main: `background-worker` v12,
`microsoft-transition-sync` v25, `meta-connection-status` v22, `cg-dynamics-mcp` v13,
`suggest-content-videos` v10 and `content-run-onedrive-folder` v1. Downloaded production source
differs materially from main for every one of them. `onedrive-oauth-start` and
`onedrive-oauth-callback` are not deployed.

Existing provider secrets are present for Microsoft and Meta. These new runtime values are absent:

- `DAILY_FRESHNESS_WORKER_SECRET`
- `MICROSOFT_SYNC_SYSTEM_USER_ID`
- `WORKER_INTERNAL_TOKEN`
- `WORKER_SYSTEM_PROFILE_ID`
- `CONTENT_AUTOPILOT_ENABLED`
- the optional, separately gated `CONTENT_AUTOPILOT_GENERATION` and
  `CONTENT_AUTOPILOT_VIDEO_FOLDERS` flags
- all delegated OneDrive `ONEDRIVE_MS_*`, `ONEDRIVE_TOKEN_ENC_KEY` and
  `ONEDRIVE_OAUTH_SETUP_TOKEN` values

Two active, auth-backed admin profiles exist as candidates, but no identity was selected. Production
has zero configured client short codes, zero client OneDrive mappings, zero run-folder mappings and
zero delegated OneDrive token rows. Selection of a real system actor and all provider/mapping writes
remain CA gates.

## Exact protected activation sequence

Every numbered production mutation below requires CA approval at that gate.

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
