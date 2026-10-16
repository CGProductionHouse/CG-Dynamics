# Integration recovery and release — 16 October 2026

CA explicitly requested updating the outstanding reporting/app work and going live,
with conservative usage. This receipt supersedes earlier connection-only status;
it is not a fleet client-launch certificate. Open owners #775/#662/#618 are untouched.

## Completed reporting recovery

- One existing shared Google Ads account refreshed 11 September–15 October.
  Canonical successful run `b5f7da69-70b1-4826-8faa-873fd3841ce9` saved 52 daily rows.
  Cape Lumber's exact-client audit confirms 15 October daily campaign rows and
  complete sync coverage. Other mapped clients with no campaign rows remain no-row,
  not invented zeros. No campaign settings or mappings changed.
- Applied only repository migration `20261016075631_google_ads_daily_refresh.sql`:
  the existing background queue constraint now admits `google_ads_refresh`.
  No new cron, browser grant or table was added.
- Deployed the existing Google Ads sync and worker from main `a665e09f`, then
  enabled only `GOOGLE_ADS_REFRESH_ENABLED=true`. The existing internal worker
  token was confirmed present by name only; no credential was retrieved/copied.
  Readback: `google-ads-sync` v51/JWT true, `background-worker` v60/JWT false.
  Setting a project-wide flag also advances function configuration versions;
  version increments alone are not proof of a source change.
- Existing scheduled worker requests returned HTTP 200 after release. There is
  no daily refresh queue row today because the just-completed manual refresh
  already covers the identical 35-day range. This is expected duplicate suppression,
  not proof that tomorrow's first scheduled provider call has completed.
  Rollback: set that one flag false; do not delete queue/history or metrics.

## Connector release correction

Full actual MCP Deno checking reproduced 242 errors, mostly the uninferred generic
`ReturnType<typeof createClient>` becoming an unusable unknown-schema client.
Use the SDK's explicit `SupabaseClient` type and the actual selected Planner-query
return type. Dynamic select projections keep their existing runtime record shape;
the strategy adapter uses the same structural boundary as the existing autopilot.
No auth, project-context, ownership, staff-version or idempotency fence is removed.

Checking also exposed real omissions: the lead reader did not SELECT the owner it
tested, and the preferences reader did not SELECT project identity it preserved.
The fix reads those exact fields, preserves the existing ChatGPT project identity,
and refuses preferences writes when the existing-row read fails. Foreign leads are
denied to both staff and team roles; deliberate manager/admin authority remains.
Governed default draft-email attachments retain stable keys; malformed collateral
is rejected. Email remains draft-only with no send or production email action.

Two failing-first executable handler regressions cover the field omissions;
the focused tests also cover foreign/team denial, read-error/no-write and governed
collateral. Three former source-string assertions now account for erased type
annotations; their row shaping, durable IDs and separate Calendar checks remain.
The selected Planner-query helper preserves all previous filters and pagination.

Verification: 3,859 pass / 19 intentional skips / zero failures in the supported
serial suite; 81 affected tests pass; latest handler cases and scoped lint pass.
The Windows Bash SES fixture is excluded, not passed. Docker-only checks remain
skipped. TypeScript/Vite production build emits app chunks; all THREE actual Edge
entrypoints now pass Deno checking, including the previously blocked MCP index.
Initial full attempt found three source-string test mismatches; corrected focused
and full runs pass. No production dependency/package version change was made.

MCP release/readback and authenticated acceptance are pending at this checkpoint.
Do not claim the merged #814/#816/#817 fixes live until the later receipt says so.

## Actual website journey, not just old snapshot age

Authenticated company-admin Performance selected each of the four exact clients,
October 2026. Actual reporting loads current traffic, with the month-in-progress
label, not the old stored September snapshots:

| Client | Visitors | Page views | Measurement boundary |
| --- | ---: | ---: | --- |
| Piek Group | 107 | 255 | One canonical enquiry; action tracking not configured. |
| Red Oak | 311 | 689 | 12 recorded visitor actions; no canonical enquiry form connection. |
| Emmanuel Funerals | 39 | 83 | Action tracking and canonical enquiry form not connected. |
| All Around PVC | 8 | 8 | Action tracking and canonical enquiry form not connected. |

These are time-of-check observations, not frozen published reports or promises of
complete attribution. No client report was republished or website instrumented.
The earlier statement about partial September snapshots describes stored published
report material, not the functioning live October traffic bridge.

## Exact external/release gates

- Meta: AV Event Life and Red Oak have access-block evidence. Zooz's exact failed
  run now establishes HTTP 403 `(#200) Missing Permissions` on Facebook posts,
  not an unexplained application failure. Do not repeat blind syncs or alter access.
- TikTok: all ten connected clients completed successful scheduled October syncs
  today, with complete video-list pagination. Video counts remain cumulative
  snapshots for videos published in the month, not account-wide monthly views.
- Client Schedule remains `monthly_deliverables`, separate from CG Calendar.
  Before/after: 3,654 rows, fingerprint `3a458808ca38636e58111d6a12ce56ed`.
  No completed-task conflict override or Teams write was performed.
- Current Vercel billing read: $9.42/$15, Pause ON, cycle ends 18 October.
  The existing $5 client-serving reserve leaves $0.58 before that reserve.
  No cloud build, deployment, promotion, cap/DNS or hosting configuration change.
  The next frontend release still needs the exact #679 packet and safe headroom;
  do not spend the client reserve to make a release report green.
- Both Dynamics domains plus the four listed client-site hosts returned HTTP 200.
  This proves bounded availability, not every-page visual/client-role acceptance.
- Source-held strategies, real dated posts, final assets and named-recipient Brand
  Hub checks remain separate. Nothing was invented or auto-published here.
