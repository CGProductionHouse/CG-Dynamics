# Content Guideline client design and ChatGPT acceptance — #896

CA requested a premium branded guideline, a separate client link, easy normal
ChatGPT authoring in personal/company accounts, and the existing calendar chain.
Branch: `codex/guideline-client-design-20261027`. Frontend remains local/PR.
Later exact CA-approved connector release is recorded below; zero Vercel.

## Latest owner visual correction — portal styling

CA rejected the separate flat green/cream presentation. That earlier visual is
**not accepted**. Follow-up branch `codex/guideline-portal-style-20261027` matches
the existing client portal: near-black panel, white/slate typography, existing
bright teal/orange accent line and restrained corner light, white pill action,
subtle outlined cards. Removed the separate green/cream script treatment and
extra cover labels; reduced the cover size. No global client portal restyling.

The actual shared presenter is now previewed inside the actual ClientPortalShell,
including the real desktop navigation and mobile bottom navigation. Only local
fixture identity/lead reads are stubbed. New images are
`%TEMP%/cg-guideline-portal-fold-1440.png` and `cg-guideline-portal-fold-390.png`
(also full-page/all375/390/430). Prior `cg-guideline-design-*` images remain
historical rejected references. The local review URL is unchanged.

All four browser widths pass script fidelity, video jumps, direction disclosure,
client link/clipboard refusal, private saved-draft preview and retained unsaved
edits/no overflow. Existing focused tests23/23, app build/bundle, scoped lint and
diff pass. This is a visual-only presenter/fixture correction: no backend, API,
auth, data, content publication, global navigation or Vercel changes.
Visual acceptance remains CA's; do not label the revised design owner-approved.

## Design and source references

Read the existing OneDrive **Toyota Content Guide.pdf** (23 September) and
**Wiseman Group Content Guide_SEPT.pdf** (22 September), discovered under their
exact client folders. They contain numbered concepts, full dialogue, scene
directions and end frames. These are design/workflow references, NOT permission
to publish old concepts, admit research or copy content between clients.

The actual shared `ContentGuidelineDocument` now supplies:

- CG-branded cover and the client's existing logo, actual filming date/month.
- Numbered video lineup with direct in-document jumps.
- Complete scripts on a high-contrast reading surface, preserving line breaks.
- Objective/opening and optional filming/visual direction; no empty-field noise.
- A client link copied from the published projection. Clipboard refusal exposes
  the correct selectable client URL rather than suggesting an admin address.

The existing staff editor has **View client layout / Back to editing**. It uses
only an explicit client-safe field projection of saved videos. Drafts are labelled
private and have no share button; unsaved staff edits survive preview. Existing
publishing remains deliberate and unchanged. For an exact published link, use
**Preview as client → Copy guideline link** on the required document.
Published preview now follows `guideline.month`, matching the canonical RPC,
instead of using a potentially different first shoot-coverage month. A focused
regression pins this link correction; it does not rewrite a document's dates.

Links use `/client/plan?tab=guidelines&month=…&guide=…`; client sign-in and the
existing server-pinned own-published-content RPC remain required. This is NOT a
new anonymous/bearer-token sharing system. No internal run name, notes, assignees,
production state, raw OneDrive references or IDs are added to the client view.

## Concrete normal ChatGPT defect and correction

Live read-only `resolve_project_context → get_my_assistant_bootstrap →
find_content_runs → list_content_guideline_videos` succeeded for the existing
company-admin connection. The exact CASE October run returned two videos and
`has_script=true`, but omitted both complete scripts and filming direction.
That made list/edit/read-back verification incomplete.

Regression RED reproduced `script === undefined`. The narrow staff Assistant
projection now returns the already-selected **script, shot_breakdown,
requirements and visual_notes**. Explicit fields only; no spread of internal
notes or storage fields. Tool guidance tells ChatGPT to read before editing,
write only named fields, and reread to verify. No tools/scopes/auth were added.
The projection is also used by readiness reads, so these now include that same
saved brief; client portal reads remain a separate, publication-bound RPC.

Canonical normal-chat workflow (no second paid AI generation):

1. Resolve the real Project context; retain it on every call.
2. Find the exact existing Content Run by canonical client/event/date.
3. Ensure its one guideline only when missing; list the saved videos first.
4. ChatGPT writes the draft using `add_content_guideline_video` or narrow
   `update_content_guideline_video` with an idempotency key. Do not invoke the
   separately provider-funded generator merely to save ChatGPT's wording.
5. Re-read and verify the complete saved text. Reorder through the existing
   canonical reorder action, not a fabricated video-number field.
6. Link only an existing same-client video/reel Client Schedule slot, or leave
   legitimately unallocated. Never create a shoot/date/contractual slot to fill
   a gap. CG Calendar's event/run relationship stays separate from posting dates.
7. A manager/admin reviews and deliberately publishes the full document, then
   copies its client link. MCP draft authoring cannot publish it.

## Verification boundaries

The local browser fixture uses actual presentation and staff editor components,
synthetic sample creative and a disposable browser profile. Screenshots are
clearly marked **DESIGN PREVIEW / SAMPLE CONTENT / NOT PUBLISHED**. No samples
are inserted into production or claimed as a client's approved creative.

Actual live reads confirmed missing context on some real runs: one had no exact
client, others no guideline/mapping, and CASE videos were unallocated. This
design pass does not claim to have repaired or published those protected records.
Existing calendar/staff reconciliation ownership remains separate.

Local tests exercise complete scripts, same-client linkage, actual update handler
preserving unrelated fields/refusing a foreign client, publication boundaries,
context policy, mobile navigation and private draft preview. They do not prove
both separate ChatGPT accounts' live consent/session state. Live write acceptance
requires an owner-approved exact draft and read-back in each real account.

The backend projection/tool-description change was initially source-only; CA's
later exact approval and verified v73 release are recorded below. The frontend
is still not deployed. No migration, live SQL/data, provider generation,
file/share permission, publication, Microsoft or Vercel change.

Existing PRs #867/#866/#842 own the return-to-review button; their action is not
duplicated here. No new dependency, schedule authority or Guideline document.

Security reference: [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api).
Existing grant/RLS/role/publication boundaries remain intact. Changelog Markdown
fetch was unsupported by the web reader; no Supabase SDK/API/schema changed.

## Local verification receipt

Full-run runtime/test source: `90a282115ed8cf3fa4cc9561830baa6cb1223de3`, PR #897.
The later document-month preview correction and its new test passed the final
three-file38/38 focused run. Do not reattribute the earlier4210-test count to the
later test/source revision.

- New actual-component browser fixture passes **1440/375/390/430**: complete
  script fidelity, direct video jumps, direction disclosure, no overflow/runtime
  errors, exact client URL, denied-clipboard fallback, private staff draft preview,
  saved-only display and retained unsaved script when returning to editing.
- Existing actual Plan/calendar four-width fixture passes: exact client/month
  transitions, old-response fencing, read-only network, error/empty states,
  keyboard tabs and Calendar → exact guideline scope retained.
- Focused nine-file suite142/142 passed, then the added actual-handler integration
  test passed in the final15/15 MCP guideline group. Do not add these overlapping
  counts together as distinct tests.
- Full supported run: **4210 total /4179 pass /5 fail /26 declared skips**.
  All five failures were the existing SNS PKI tests' `spawnSync openssl ENOENT`,
  not guideline assertions. After adding the already-installed Git OpenSSL to
  that process's PATH, both exact affected test files passed **18/18**, including
  all five original failures. No remaining assertion failure was observed. This
  is a full run plus bounded environment-corrected rerun, NOT a fictitious single
  all-green full-suite receipt. Unsupported Windows Bash SES setup stays excluded;
  skipped SQL groups are not relabelled passed from old receipts.
- Initial unconfigured full attempt was stopped on missing fixture Supabase env;
  the counts above use only the loopback/public-fixture configured run. No auth
  files or production credentials were copied.
- TypeScript/Vite actual app build and actual app strings/chunks verified;
  scoped lint/diff clean. Whole lint0errors/17 pre-existing warnings outside this
  change. Both changed backend files also pass an explicit TypeScript no-emit
  check. Native Deno unavailable in PATH; no tool installation was attempted.

Proof remains workstation-local in `%TEMP%`: `cg-guideline-design-1440.png`,
`cg-guideline-design-375.png`, `cg-guideline-design-390.png`,
`cg-guideline-design-430.png`, matching `cg-guideline-design-fold-*.png`,
`cg-guideline-full-configured-20261027.log`, `cg-guideline-openssl-final-20261027.log`,
`cg-guideline-lint-20261027.log`. UI sample is also left open at loopback port53994.
No screenshots, sample content or generated dist are production assets.

Both real personal/company ChatGPT account sessions remain distinct acceptance
surfaces; the current connection and local context/handler tests do not prove
another account's consent. PR app-attachment attempted once; existing100-item
limit refused it. GitHub PR/issue remain the durable handoff.

## Later actual normal-chat account acceptance — 27 October

The earlier account-session limitation above is now superseded for **read-only
acceptance**, not live content mutation:

- Company Work Chrome, a new CA CG Assistant Project conversation in normal
  ChatGPT: plugin found the correct existing CASE October run, read both complete
  saved scripts/direction, distinguished other dated runs, and described narrow
  hook/script amendment and read-back without changing links. No generation API.
- Personal Plus Chrome, normal Chat mode: initial requests through both installed
  Dynamics connections returned internal tool errors. Refreshing tools first also
  failed. Legitimate existing-account Reconnect completed for CG Dynamics and
  then CG Dynamics Personal Refresh; account permission remains Allow low-risk.
  No credential copying, scope expansion, new app, uninstall or auth bypass.
- A fresh personal CG Dynamics test resolved canonical Christie-Ann staff context,
  read bootstrap and the same complete saved guide. The first full-name lookup
  was refused; canonical profile name succeeded. Effective team/staff context
  was retained; this is not an admin escalation.
- A separate follow-up explicitly using only Personal Refresh also passed:
  canonical staff resolution, two saved videos, complete scripts/shots/requirements,
  and truthful null visual_notes. No fallback to the other app.
- Both real accounts correctly distinguished an existing CG Calendar event from
  unallocated Client Schedule slots. The selected guide's two videos currently
  have no posting allocations; the tests did not fabricate dates or edit Teams.
- No live guideline ensure/add/update/reorder/link/publish was called by these
  read-only tests. Actual narrow save/read-back preservation remains proven by
  the deterministic handler test, not a claimed real client amendment.

Successful company/personal conversations are retained in their respective browser
profiles. Private links/evidence summary: `%TEMP%/cg-guideline-account-acceptance-20261027.json`.
Browser response rendering was initially delayed; settled responses were read to
completion. A proof screenshot capture timed out; no screenshot success is claimed.
The existing four-width design images are actual local component previews, not
screenshots of deployed client content.

Current main was merged into this branch, retaining the approved CG Hoursv74
repair and both operational handovers. Combined guideline/Hours regression suites
pass56/56, app TypeScript/Vite build/app chunks/scoped lint/diff pass. No new
frontend/runtime change was invented merely because one account's connection failed.

## Current client rollout boundary

Public app HTML/module read returnsHTTP200 and still serves the older guideline
component (`index-BC1puXgn.js`, `ClientContentGuidesPage-a1U1k9Dp.js`); the new
shared branded document/copy-link module is absent. Source readiness is not a
frontend deployment. Vercel Git deployment guard remainsOFF; no Vercel operation.

Fresh SELECT-only stored-content snapshot: October56 draft/1 published monthly
strategy, November57 drafts/0 published; October10 draft guidelines/0 published,
no November guideline rows. These are row/publication counts, not strategy-quality
or launch-cohort acceptance. Strategy authoring/admission/editorial remains #731.
Brand Hub remains41 enabled/17 private libraries with41 published assets.
Meta's old stored-consent gate has cleared: connected + valid encrypted token,
last validated25October, data access expiry23January2027. No token value read,
provider call, refresh or claim that every client's metrics are complete/current.

Client rollout still needs deliberate review/publication of exact ready content,
real posting allocations through the staff owner, actual client-role/password and
phone acceptance retained by CA, and a separately approved conservative frontend
release. Do not publish generic filler or expose drafts to turn these counts green.

## Exact approved connector release — live 27 October

CA answered **Approve exact guideline connector fix** in this chat. Authority:
only the reviewed guideline projection and tool-description files in the existing
MCP backend, preserving all other hosted code/auth/permissions. No Vercel or
client-content mutation authority was added.

- Verified exact Dynamics project `ehtjfntukiwbgptqgbzy` ACTIVE_HEALTHY.
- Existing `cg-dynamics-mcp` v72:40 hosted files, JWTfalse, import-mapfalse.
- Built from the actual hosted snapshot, NOT a wholesale main/PR deployment.
  Only `contentGuidelineActions.ts`'s seven-line explicit script/direction
  addition and the one `toolCatalog.ts` description changed. All other38 files
  byte-identical; all56 tool names/schemas/annotations unchanged.
- Hosted-derived candidate executable assertions and explicit TypeScript check
  pass;44 focused MCP/catalog tests pass. Baseline/rollback saved privately in
  `%TEMP%/cg-guideline-mcp-release-20261027`. No credentials were retrieved/copied.
- Fresh pre-release guard confirmed the same version/settings/all40 source files.
  Released ONCE as **v73**, statusACTIVE, same JWT/import settings.
- Actual hosted read-back matches **all40 candidate files byte for byte**;
  the other38 hosted files remain byte-identical to the original.
- Bundle SHA256: `88df12f65b479f7cfd06654661eebfc61d02a327feda0570cffdf2a0aee7c2aa`.
  Candidate source-array SHA256:
  `8598fe6e8c4cba07c8ce3b2596f99297cf7eff82f0815c0632951d0a2d33f63c`.
- Anonymous and invalid-bearer tools/list POST canaries both401.
- Actual signed-in normal connector read of the existing CASE October run now
  returns two complete scripts (1260/1029 characters), shots (351/326 characters),
  requirements and visual direction. An independent canonical `get_content_run_plan`
  read matches both scripts and shot directions exactly; no truncation/rewrite.
  Draft/unallocated states retained; nothing saved, approved or published.
- Bootstrap initially returned one transport Internal error. One bounded read
  retry succeeded with the updated full-script description and explicit normal
  ChatGPT guidance. No redeploy, auth bypass or retry loop.

This establishes the released read-back repair on the connected account. It does
not claim production draft-writing acceptance in two different account sessions,
complete calendar/mapping reconciliation, or that the new frontend design is live.
No SQL/data/schema/config/secret/permission/Microsoft/content change or Vercel.
Rollback, if ever needed under incident authority, is the saved exact40-file v72
source/settings; do not replace unrelated code from main or alter security settings.
