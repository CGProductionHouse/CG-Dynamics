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

PR #819 merged as `e8ee9ed8e674ab99ea301834a50aeb1e6a2b759c` (source
`8d9160e53ac7fe10d32d5b513db4ad952d4a2084`). Released only `cg-dynamics-mcp`
as v66, preserving JWT false and existing custom authentication. Downloaded source
includes the validated-actor guideline fix and shared Meta reporting classifier.
Authenticated provider health now returns overall DEGRADED / Meta PARTIAL, not
the reproduced false PASS; Google reports the new 16 October successful sync.
Unauthenticated POST probes return 401 for MCP and Google sync.

Actual production draft-write acceptance: fresh discovery verified CASE's existing
31 October run `6adc6edb-7cb6-4523-a81d-540c54e9b9f7` belongs to exact client
`079df21e-783a-4648-b3fa-0acae6e68867` and had no guideline. One idempotency-keyed
`ensure_content_guideline` created canonical draft
`85743a32-8080-4eb5-bc9e-9ca89a533c53`; independent `get_content_run_plan` readback
matches client/run/month/status. It initially contains zero videos; creation is
not a claim that the scripts are written or published. The existing normal company
ChatGPT task has been asked to reuse its researched CASE brief and author/read back
package-bounded scripts through the repaired connector, not a paid generator.
No earlier run, staff wording, asset, folder mapping or approval was changed.

The normal ChatGPT pass saved two real concept rows and read them back, but
full-script updates then exposed a second defect: generic `computeInputHash`
passed Unicode script text into Latin-1-only `btoa`. Production logs show that
exact exception before the handler. The actual authored scripts are preserved in
the existing chat. New failing-first
tests reproduce punctuation, non-Latin text, emoji and long-script failures.
The correction preserves every legacy Latin-1 replay fingerprint; only previously
unexecutable Unicode input uses prefixed full UTF-8 SHA-256 through the existing
hash helper. All three log/write callsites await it. No authored text is stripped
or transliterated, no idempotency history is cleared, and no permission changes.
PR #820 merged as `29aea17bac5a6b4fd327153e3f672b43f0460d6d`, source
`47e4132797c82cc743ef57de286ffdc41ef1defe`, and was deployed as MCP v67.
The original custom authentication/JWT false contract remains unchanged.
Downloaded deployed index matches main after CRLF normalization, SHA-256
`610e1ea03293b4e42d6ce3e48e138a75daed5bad32acf81f4e1be9ac690be30a`.

Final Unicode release verification: 3,863 pass / 19 intentional skips / zero failures
in the full supported serial suite; 32 affected cases and all four fingerprint
regressions pass, TypeScript/Vite app build, full MCP Deno and scoped lint/diff pass.
The local browser checks below also pass with the corrected fixture. Self-review
found no blocking change; old Latin-1 keys and special strategy hash remain intact.

Concept IDs: `9e02c00c-b480-48f5-9bc6-571fbca5ad62` (The Job Before the Machine),
`034eee02-73da-43ac-a6f8-25e6e6fcac05` (Husqvarna: Bring the Model, Not a Guess).
Normal company ChatGPT then reused its existing authored document and saved only
`script`, `shot_breakdown` and `requirements` on these two existing rows. Its
full-text readback confirms the original timed sections and Unicode punctuation,
not merely concept titles or a status flag. Independent connector readback also
confirms both complete scripts: 1,260 and 1,029 characters, with shot breakdowns
351/326 and requirements 709/481 characters. Both now have scripts and remain
draft/unallocated; no new video rows, filming, scheduling, approval or publication.
Titles, objectives, hooks, CTAs, order and staff edits are preserved. The scripts
were authored in normal ChatGPT, not Codex or a separate paid generator.

Missing CASE short code blocks production-folder naming separately, not script
writing. Do not invent production mappings or infer folder readiness from this
successful write. All 61 active client short codes were null at this check.

Applied only reviewed `20261013225255_client_strategy_gold_projection.sql`:
future published snapshots preserve the ten allowlisted strategy fields. Self-checks
pass; anon/authenticated direct execute stays false. All 171 existing strategy rows
retain fingerprint `c0c1f61540df310cfe07ed705f84c7d4` before/after. Existing published
content was not backfilled or republished. #805's frontend remains a separate release.

## Explicit strategy amendments: deployed and accepted

The next normal-chat pass reproduced a missing capability, not another failed
strategy-writing model: automatic draft filling correctly preserved staff fields,
but had no intentional editorial amendment route. PR #822 adds the separately
guarded company-admin-only field amendment using the **existing** audited context
RPC, with exact old text, fresh source/version, citations and complete candidate
quality/package validation. Automatic gap-fill preservation is unchanged.

Merged source `f63c709a7800dfd30ed887275408c5893e0826f1` is deployed as MCP v68,
custom auth/JWT false unchanged. All 34 deployed files are accounted for: five
changed/new files match the reviewed checkout, 29 equal verified v67. Anonymous
POST remains 401. Full supported suite: **3,870 pass / 19 skips / zero failures**;
100 focused cases, full MCP Deno, app build/chunks and scoped lint/diff pass.

The existing ChatGPT plugin retained old metadata initially. Its Refresh tools
control completed without account/OAuth/permission changes; reopening the SAME
normal company conversation exposed the new action. That chat then saved and
fully read back **all 14 original corrections across 12 November drafts**.
Independent read-only revision comparison confirms 11 intended concept positions
and three gold test fields changed, with all unselected strategy/provenance and
concept-array lengths unchanged. CG/Piek/All Around PVC are v5; nine others v4.
All remain drafts, unpublished. The four citation mismatches were reconciled to
genuine current eligible sources, without source activation or fabricated IDs.

See `CHATGPT-STRATEGY-FIELD-AMENDMENTS.md` and the exact JSON receipt in
`strategy-review/2026-10-16-normal-chat-field-amendments.json`. This batch is done;
do not replay old proposals. No additional SQL/grant/secret/provider/package/
calendar/folder/permission/publication or Vercel operation for this release.

Microsoft readback at 11:08 UTC: latest automatic reconciliation
`eb22160d-9c2b-4b35-bba1-230ede8d3c9b` fetched all six sources, applied eight safe
changes, zero failures and 390 retained conflicts. It is PARTIAL, not fully fresh.
No additional manual sync or conflict override was run here.

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

## Readback and local browser acceptance

All deployed runtime source files compare exactly to the reviewed checkout after
CRLF normalization: MCP 33 files, worker 16, Google sync seven. SHA-256 manifest
receipts (ordered path + normalized file digest pairs):

- MCP v66: `c2b18c7a0071139cd7cbc34ab3a0837da5cd5a00c1bd7d637a915167bc6577c0`
- Worker v60: `1e6ed7e3978851ef5298d7a15ea312f6c709bb596ae011526192921be6368aca`
- Google sync v51: `a080a658ec27a8ab89d1c9590f720567f1c916bb0517a1a098a55e73e263046c`

Live migration ledger names/versions: `google_ads_daily_refresh` / `20261016104744`,
`client_strategy_gold_projection` / `20261016110543`. Do not replay original
repository timestamps or run broad migration repair.

Actual-component local fixtures pass desktop/375/390/430 for the complete portal
shell, Plan/scripts/package/calendar, report-cutoff Performance, Overview schedule,
Approvals and Brand Hub. Exact-client/month transitions, error-vs-empty states,
published asset links, no external network/real writes, no overflow and no browser
runtime errors are exercised. They are synthetic tests, NOT real client-role
production acceptance. The Plan fixture first failed because it supplied no package
receipt while expecting confirmed capacity. Its synthetic A now has a real-shaped
receipt, B remains unknown; the test asserts 1 video + 6 combined posters for A,
then no leaked quantities/unknown CTA for B. Production components were not relaxed.

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
