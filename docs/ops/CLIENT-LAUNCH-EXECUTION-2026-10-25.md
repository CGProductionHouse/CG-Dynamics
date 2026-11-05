# Client launch execution — local-first continuation

## 5 November — research-to-product application: website event truth

Continues this execution matrix and #433; no second launch checklist. Entry main
`d95a4132`; focused branch `codex/research-client-measurement-truth`. Open PR inspection
found no competing owner for this client-report change. Staff/Teams/calendar, strategies
(#731), and the future Insights feature (#737) retain their existing authorities.

### Source and review boundaries

Latest saved research found and actually read:

- [4 November Search Reporting, Discovery & Corrections](https://docs.google.com/document/d/1NBdj1Cp5_q9LkYNAmG9PtaEIeogp-z-ConhFzebHPfc/edit),
  run `DIR261104A_0840_SearchMeasurementCorrections`.
- [Structured 70-record evidence](https://docs.google.com/document/d/1OG5AG2ja2m1Y3BLMIpv22wc3BucsoWbQplSLz1f8wqs/edit)
  and [continuation](https://docs.google.com/document/d/1Nk3LCIdRNPX2UtSXLN0FQTlYbLxFHGLlwqMwluUuwDs/edit).
- Compared the [2 November release](https://docs.google.com/document/d/1JaKgYzG0SsobRxm10FoxqOEzQ01kr2BB9qkYiud6mng/edit)
  and current #433/#737/#893/#731. A bounded newer-research search returned no records;
  this is not a claim that all research or client accounts have been exhausted.

The November release has 24 sources, seven findings/seven implementation cards and
30 coverage families. Its records are `needs_review`, `activation_allowed:false`.
The September root release pointer remains unchanged. No research card was silently
activated, imported as trusted company guidance or published to clients. Historical
October source-persistence gaps stay with the research lane.

| Finding | Application / exact limit |
| --- | --- |
| AI-search visibility, traffic and business outcomes are different measures | Fixed the existing website event-to-enquiry mislabelling below. No AI-lead/sales attribution is inferred. |
| Search-origin social/video discovery differs from native views | Confirmed [Google's property-specific guide](https://developers.google.com/search/docs/monitor-debug/analyze-social-video-content). No new Search Console integration or native-view summation; exact property access/data is not established. |
| Generative-AI Search Console impressions are visibility evidence | Confirmed the [dated Google report announcement](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports). No additional impressions added to existing totals, no assumed API/account access. |
| DSA correction must supersede the older generic timeline | Independently read [Google's June 11 update](https://blog.google/products/ads-commerce/dsa-upgrade-to-ai-max-2026/): DSA starts February 2027; ACA and campaign broad match retain September 2026. Preserved as a sourced review correction; no campaign or budget writes. |
| Draft legal guidance, API sunsets and research claims need applicability/method checks | No legal claim promoted to enacted law, LinkedIn dependency assumed, or foreign/vendor finding presented as guaranteed South African sales. These remain research/owner review items, not new application features. |

### Reproduced defect and focused correction

The published client website panel called `conversions.byType.enquiry_submit`
**Submitted enquiries**. The existing staff dashboard and its regression establish
that received/qualified/won enquiries come only from canonical #405 lead metrics,
not provider action aggregates. A real `ClientReportView` SSR regression first failed
against that old label using nine tracked actions, including seven form events.

The same existing snapshot panel now uses **Website activity / Contact actions**,
**Form submissions**, and one concise line: clicks/form events do not confirm enquiries
or sales. The helper is named `formSubmissions`; absent, malformed and duplicate event
aggregates stay unavailable, preserving a valid zero. It neither sums duplicates nor
substitutes total actions for forms. The immutable published snapshot, original counts,
client-safe RPC boundary and canonical lead system are unchanged.

Verification actually performed for this delta:

- 30/30 focused tests: rendered report, missing/invalid/duplicate/zero events, canonical
  lead separation, published snapshot boundary, source attribution, client isolation and
  stale-selection render recovery. No skips. Initial red regression retained privately.
- Existing read-only report browser fixture extended, not a second harness:
  1440/375/390/430px pass, correct count/label, no private IDs, horizontal overflow or
  runtime errors. Requests restricted to loopback GETs; no real session/credential used.
- `npm run build` (TypeScript + Vite 7), actual emitted application route/text verification,
  scoped ESLint and `git diff --check` pass. Existing Browserslist-age/chunk-size advisories
  remain; no package installation or dependency change. This does not rerun or supersede
  the separately recorded whole-suite, native-account or physical-phone acceptance.
- Private visual receipts: `%TEMP%/cg-website-form-events-{1440,375,390,430}.png`.
  These are clearly synthetic examples, not live website figures.

### Future news section — preserve #737 ownership

CA reiterated that a small industry/social update section is a **future** addition,
after current launch work. Add this product preference to existing #737: concise visual
cards with what changed, why it matters, CG's actual response/status, source and date;
industry/client relevance and corrections/expiry must remain visible. Reuse governed
research intake, exact-revision editorial approval and immutable client-safe publication.
Keep common industry updates separate from private client-specific applications. Never
claim research is already deployed/applied, automatically approve research or expose raw
staff evidence. No route/schema/news implementation is introduced by this change.

Release status: source only; no Vercel, Supabase/backend, provider, campaign, permission,
mapping, package, strategy or asset changes. This does not close the separate client
publication/password/physical-phone/content gates. Exact Control Centre document/range
is still unverified; no speculative tracker mutation.

## 5 November — exact-approved MCP reporting-health release completed

The source fix in merged PR #951 (`297abb0c`) is now LIVE as MCP **77**, after
CA's explicit exact three-file approval. Fresh pre-release read-back matched hosted
76; independent post-release read-back matches all 40 candidate files, with only
index/opsActions/toolCatalog changed and 37 files byte-identical. Existing custom
authentication/JWT/import settings remain unchanged; unauthenticated tools/list
returns 401 plus WWW-Authenticate. Normal authenticated connector fleet check:
10/10 exact TikTok clients return PARTIAL/refreshPending, overall DEGRADED, with
the correct last-success timestamps. The prior false-PASS defect is closed live.
No forced resync, provider/OAuth/secret/permission/mapping/data/content change or
Vercel usage. This does not grant or claim every client's final launch acceptance.
Private live receipt `%TEMP%/cg-reporting-truth-live-receipt-20261105.json`, SHA256
`4f337fc0f37876fcbc5f1568813f62cc450e122fae51895741450f116778d294`.
The source-only approval status in the detailed pre-release evidence below is now
historical. #944 frontend delta, exact-client publication, Emmanuel access and
owner login/physical-phone acceptance stay separately gated in this matrix.

## 5 November — native Meta comparison and connector truth fix

Read-only continuation of the existing launch matrix, not a second fleet checklist.
Current main at entry: `680dabb5`. No Vercel, production data, provider refresh,
OAuth, permission, campaign, budget, content or strategy publication changes.

Actual company Chrome Meta Results and the live Dynamics client preview were checked.
Meta's date picker was visibly set to 1–31 October in Pacific Time. The first custom
textbox edit did not persist; it was rejected as evidence and replaced with Meta's
Last month preset. Native daily chart rows, dates and complete DOM observations are
preserved privately in `%TEMP%/cg-meta-native-comparison-20261105.json` (SHA256
`567fced6baef9e460fca3a2e1495b068706096e1829cda47c2e8c55d59ddb5f8`).

| Exact comparison | Native source | Dynamics stored/displayed | Result |
| --- | --- | --- | --- |
| Cape Facebook, 1–31 Oct | Views 18,525; visits 285; daily follows 6 | 18,525 / 285 / 6; published October client preview | Exact match |
| Cape Instagram, 1–31 Oct | Instagram-only views 1,716; reach 348; interactions 95; visits 26; follows 12 | Same five values in published October client preview | Exact match |
| Germoparts Facebook, 1–30 Oct | First 30 native daily rows: views 19,344; visits 933; follows 13 | Same three values; stored window explicitly ends 30 Oct | Exact match for recorded window; not a full-month certification |
| Emmanuel Facebook, 1–30 Oct | First 30 native daily rows: views 90,731; visits 4,694; follows 29 | Same three stored values | Exact match for recorded window; October report remains unpublished |

Important definitions: Cape's Meta Instagram headline is 11,154 combined views,
including 9,438 Facebook views and 1,716 Instagram views. Dynamics correctly uses
1,716 for Instagram; importing the combined headline would double-count Facebook.
Facebook `page_post_engagements` (Cape 995) is a different, broader API metric from
Meta's Content interactions (908). The portal labels it **post engagements**, not
content interactions. Native daily viewer sums were inspected but NEVER used as
monthly unique viewers. Native follows chart sums can also differ from its headline;
the stored source is explicitly `page_daily_follows`, not net growth.

Emmanuel's actual client preview currently opens its published September report,
truthfully showing 1–29 September platform windows. No unpublished October figures
were represented as client-visible. Later Germoparts Instagram browser interaction
hit debugger/focus transport failures; bounded recovery read the page but did not
complete an exact 1–30 October comparison. No auth bypass or repeated consent retry.
This is targeted native parity evidence, not a new 62-client/physical-phone certificate.

Fresh all-provider read-back: Meta 47 mapped clients / 76 platform checkpoints,
20 PASS / 55 PARTIAL / one STALE. Germoparts Facebook access has recovered naturally;
remaining Facebook failures are Emmanuel and held AV, plus held Red Oak stale.
PARTIAL still means incomplete metric coverage, not fabricated zero. Complete stored
monthly-fact identity joins find zero numeric Meta/TikTok cross-client mismatches
and zero numeric rows marked unavailable. This does not prove every metric exists.
Google's natural 4 November 22:00 UTC sync succeeded. Cape October remains available:
31 dates / 40,497 impressions / 1,337 clicks / R2,199.24, matching prior native acceptance.
Both exact-approved Germoparts/Novus mappings remain live; no re-save or forced resync.

Concrete new defect: the normal connector returns TikTok `overall=PASS`,
`state=connected`, `degraded=false` while its own evidence says `needs_refresh`
and `token_expired=true`. All ten connections currently have this shape. Their last
successful exact-account jobs were 4 November 03:07–03:11 UTC, within the existing
30-hour threshold at this check. This is refresh pending, not evidence of revoked
access or a demand for manual reconnection. The existing scheduler deliberately
queues only after that threshold; no job/schedule change is proposed.

Source fix adds a read-only TikTok reporting projection to the existing MCP handler:
canonical access/coverage/completeness/freshness plus timestamp validation and pending
refresh now determine its verdict. Missing/unreadable evidence stays UNAVAILABLE;
partial/stale is never PASS. Connection-only sync admission and automatic recovery
are unchanged. Only whitelisted health fields are returned; no raw run summaries,
tokens, provider IDs or private diagnostic payloads are added. This is SOURCE ONLY
until exact production approval; the live MCP remains version 76.

Verification: live-shaped red test reproduced `connected` versus expected degraded.
141 focused reporting checks passed after correcting the dummy publishable-key fixture
environment; the final changed-helper/recovery set passes 68 tests with zero skips.
Strict helper TypeScript, scoped lint, diff, app build and actual 124-file emitted
app-bundle check pass. The first strict TS invocation needed TypeScript 6's
`--ignoreConfig`; the corrected command passes. Existing full 4,253-test/24-browser
acceptance remains historical and was not re-run or attributed to this backend change.
No client design, RLS, permissions or write path changed; self-review found no blocking
scope/security issue. No independent agent review or new client-password test claimed.

Exact prepared backend packet: `%TEMP%/cg-reporting-truth-release-20261105.json`,
SHA256 `0d5959f53232622e9258ac561c119df84eb289d73a7cbe1a9893e440fa049ff1`.
It surgically patches hosted MCP 76's index, opsActions and toolCatalog only,
preserving all 37 other hosted files and entrypoint/JWT/import settings. The actual
hosted candidate helper passes a local SSR behavior check. No new dependency or
TikTok status/sync function deployment is needed (hosted status 48 already returns
the canonical health evidence). Fresh hosted drift check is mandatory before release.

### Proven reporting-app patterns reviewed for this exact problem

| Product / primary source | How its reporting works | Dynamics application |
| --- | --- | --- |
| [Sprout Social discrepancy guide](https://support.sproutsocial.com/hc/en-us/articles/38269086191757-Troubleshooting-Metric-Discrepancies-Between-Sprout-Social-and-Native-Network-Reports) and [time zones](https://support.sproutsocial.com/hc/en-us/articles/360053912232-Reporting-Time-Zones) | Separates lifetime post performance from activity during the period; documents network/API limits, collection frequency and Pacific profile reporting. | Compare exact source/aggregation/timezone/window, not similar labels. Retain existing per-fact windows, snapshot labels, comparison eligibility and non-additive unique reach rules. |
| [Buffer analytics discrepancies](https://support.buffer.com/articles/why-your-data-in-buffer-insights-might-look-different-from-native-analytics-CryTKTdV0u) | Missing daily data stays a gap, distinct from observed zero; limited historical backfill and “as of” evidence are explicit; refreshes preserve connection history. | Preserve NULL/unavailable and genuine zero. Keep the #944 unavailable-panel source fix and explicit windows; never disconnect/reconnect blindly or replace partial data with zero. |
| [Agorapulse reporting FAQ](https://support.agorapulse.com/en/articles/11066949-reports-frequently-asked-questions-faqs) | Audience activity and lifetime performance of posts published in the period are separate; API reporting is delayed and valid access is necessary. Paid detail requires the relevant ad-account connection. | Keep account totals separate from CG-attributed creative performance; retain cohort/lifetime TikTok labels. New connector health fix distinguishes OAuth presence from usable reporting. Paid Meta/TikTok backbone remains separately held, not invented from organic stats. |

These are documented behavioral patterns, not access to proprietary implementation.
They validate the current architecture; no broad rewrite, paid subscription, manual
tagging process or second reporting system was introduced. Remaining launch gates
stay in this existing matrix: exact-client content/publication, #325 initial schedule
allocation, #396 recipient/download acceptance, Emmanuel provider access and owner
password/physical-phone acceptance. Held/excluded clients remain held/excluded.

## 4 November — both exact-approved Google campaign links are live

CA approved Germoparts campaign 24413585918 and historical Novus campaign 24189935204.
Exactly two mappings were inserted for the existing shared account 495-150-6884;
independent read-back confirms nine total mappings and all seven original rows
byte-for-byte unchanged. Both client identities were checked against active canonical
records. The Novus mapping is active for historical reporting; its Google campaign
remains paused/ended. No campaign, budget, permission, schema, Edge, resync or Vercel
change occurred.

The normal company-browser save stalled at its native confirmation while Chrome was
minimised; tab focus and dialog recovery also failed. Independent database checks
confirmed no save occurred before fallback. The exact approved links were then saved
with one guarded administrative INSERT: shared-account/customer/client/evidence and
original-seven-row checks, conflict/partial-state rejection and replay-safe no-op.
created_by is NULL to record administrative execution without app-user impersonation.
The inaccessible agent confirmation tab was not used as success evidence.

Normal Dynamics company-admin read-only connector now returns each intended campaign
under its exact client. Germoparts October: 1,647 impressions, 65 clicks, R184.09 from
two stored days. Novus September: 12,231 impressions, 658 clicks, R2,221.91 from 27
stored days (30 across the whole 29 August–27 September campaign). These match the
previously verified Google UI. The account summaries remain PARTIAL because unrelated
historical mappings lack period rows; that state was not relabelled complete. Real
client-role/password acceptance remains separate; no new browser acceptance is claimed.

Private SQL `%TEMP%/cg-approved-google-links-20261104.sql`, SHA256
`0b56234a3fa10fe25680f66215218cc185368debddbe61bc8335322f5d014ff7`.
Private read-back `%TEMP%/cg-approved-google-links-receipt-20261104.json`, SHA256
`5814041f26eed225fe7d6312d9ad267db4707ebd0411099b62e3d41011284b4c`.
This supersedes the two pending mapping approvals in the 3 November review. #435 owns
provider follow-up; strategy/content/calendar/Meta access gates are unchanged. This
handover change is documentation only; no repeated application build or whole-fleet
sweep is needed. The exact Google Control Centre reference is still unavailable.

## 3 November — #941 exact-approved date-follow fix LIVE

Migration applied and five function bodies/ACL/RLS read back. Existing Teams backend
**v78→79**: reviewed index+new helper, all18files verified,16others byte-identical,
JWT/import map retained; unauthenticated401. Cape8already-shared source-verified
date-follow grants enabled in place through approved optimistic management SQL;
8truthful management audits,0other-client grants, all previous dates/content/
approvals/posting fields unchanged. Existing UI cannot re-share already-shared dates;
no hide/re-share, auth impersonation or Microsoft write. Actual preview8dates and
Video repost verified. Google October31daily rows exactly match displayed
R2,199.24/40,497impressions/1,337clicks/3.30%.
No Vercel or forced provider/system cycle. Next natural cycle unobserved; roughly3h
cadence, general staff mirror83conflicts remains separate. Connector bounded read
retries recovered after transient failures. Real password/phone/download acceptance
remains owner-held; unknown-CG highlights stay hidden. Full receipt and boundaries:
[Cape acceptance](CAPE-LUMBER-LAUNCH-REVIEW-2026-11-02.md).

## 3 November — visual client frontend live

The single governed prebuilt release is complete: source `626bd308`,
deployment `dpl_HMKqEahvYRDx6fVuNDbmn1oAfiq5`, entry `index-D7qCW55q.js`.
One 2.6 MB differential upload; 15 staged and 15 public hashes verified; same-deployment
promotion, five relevant URLs HTTP 200, no remote compilation or second deploy.
Actual Cape preview checked at 375/390/430/1440: visual strategy formats, November/
December, package, mobile calendar and Brand Hub/new-window logo. No physical-phone
or password acceptance inferred. Included usage $10.43→$10.63, on-demand $0/$15,
Pause ON; delayed counters are not per-release attribution. Full receipt is in the
Cape acceptance document. Automatic source refresh remains; no new code/data changes.

## 3 November — exact reporting backend approval completed

PR #938's four helpers are live: MCP 76, monthly preparation 49, Meta manual sync 90
and worker 77. All 85 hosted files read back: four changed, 81 otherwise identical;
entrypoints/imports/authentication unchanged. Normal authenticated Cape November
brief returns unavailable CG creative coverage and no unverified post seed citations;
published strategy version 10 and immutable-strategy gate are preserved. Returned
live Meta parser passes the exact single-day and adversarial proof locally. No bulk
resync, strategy/data/schema/config/secret/campaign change or Vercel usage.

Receipt and observed runtime limits are in the existing provider acceptance/handover.
This supersedes pending-backend status below. Frontend guard/PR #931 reader, positive
creative matcher, staff-owned automatic schedule refresh and owner password/phone
acceptance remain separately tracked; this is not a fleet launch declaration.

## 3 November — reporting safeguards source verified; repost label live

Exact-approved PR937 SQL is LIVE; actual Cape client preview says Video repost25Nov,
8planned dates. All8direct Teams dates currently match, but future automatic source
refresh remains staff#325. No posting/client approval inferred from completed tasks.

Client CG highlights now fail closed in SOURCE without independent creation+post proof;
unknown posts omitted, page totals retained, top2bounded, no raw/provider origin claims.
Normal strategy preparation stops seeding unknown page winners. The automatic proof
producer/matcher remains future work; do not describe it as deployed. The exact one-day
Meta unique-viewer parser bug is fixed locally while monthly no-summing stays intact.

4222supported tests pass/24existing skips/0fail, mandatory PostgreSQL, build/app bundle,
backendTS/scopedlint/diff and all24canonical browser fixtures. The one fixture-only
correction and stale own preview-port cleanup are transparently reconciled against
unchanged runtime84b0e929; detailed receipt in ops handover/Cape acceptance. Four exact
backend helper updates are prepared, approval PENDING; frontend guard+PR931 reader
await one governed release. Zero Vercel. No new schema/dependency/strategy/publication.
RedOak's held consent issue and deferred MetaAds/TikTokAds#936 do not block Cape.

## 3 November — current Cape correction and exact remaining release gates

Owner clarified Monique's25November item is an existing-video REPOST. Restored the
same source-linked row, with explicit internal reuse title/notes; package remains
zero NEW videos,3photos+4posters+GoogleAds and recurring video template inactive.
Actual preview8planned dates/0shoots, normal editor shows REPOST VIDEO. Narrow static
repost-label projection is tested locally, production application awaits exact approval.
No Vercel use. [Current receipt](CAPE-LUMBER-LAUNCH-REVIEW-2026-11-02.md).

GoogleAds complete through2November from existing scheduled sync; no manual refresh.
Cape Meta connection authorised/last scheduled sync successful, IGverified/FBpartial;
not all metrics complete. TikTok not connected for Cape; no fabricated coverage.
Automatic Microsoft run still EXCLUDES ClientSchedule (6205source rows), staff#325
owns the durable-ID/freshness resolution; do not claim automatic posting-date parity.
Remaining launch work: that source acceptance, strict CG-only ranking/provenance or
fail-closed removal of unverified rankings, then source-ready PR931 visual reader's
single governed release and owner password/physical-phone check. Cape report and both
strategies are already published. MetaAds/TikTokAds deferred backend-only#936, not a
client launch blocker. Existing normal Chat author remains#731; no competing plan.

## 2 November — Cape consolidated changes are LIVE

Frontend85b107a3,dpl_DvWScLPuXvGDUvptz9DcmnWeZYPL:one local production prebuild,
one2.5MBprebuilt upload,14hashes then same-deployment promotion. Full exact frontend
4212pass/24explicit skips/all23browsers; no cloud npm/Vite compile or extra deployment.
Image/calendar migrations exact-approved and live. Normal UI shared ONLY8real Cape
Novemberdates; independent source/status/approval fields unchanged,otherclients0shared.
Both owner-approved strategies now published normally:Novemberv9/Decemberv6,after a
real normal-Chat zero-text-change provenance repair through exact-approved MCPv75.
No weakened approval guard. Actual preview shows both plans,8dates,confirmedpackage,
20,241recordedviews,correctGoogleAds,real post images,truthfulApprovals and safe logo.
Phone375/390/430 anddesktop1440checked,nativeviewportreset. [Exact current release and
acceptance](CAPE-LUMBER-LAUNCH-REVIEW-2026-11-02.md). #679packet6578078321;
#731author6577811280/publication6578102958. Primary.co.za andCapeofficialsiteHTTP200;
.comTLSchecks unresolved, noDNSchange. Password/physicalphone andglobalMetaowner gates
remain separately retained; no whole-fleet certificate. DOCS ONLY: do not redeploy this.

## 2 November — actual dated Cape import completed; remaining publication separated

The prior monthly-working-board-only source inference is superseded: existing recurring
master contains8real dated Cape November items. Normal reviewed import run
`3b8b24f1-022d-420f-8d42-28cd240673f0` applied exactly8/0fail/0conflict at12:05:16UTC,
no removals/config/Microsoft writes. Capped100-task source is not fleet completeness.
Client planned-date disclosure is a reproduced product gap, now a narrow manager-only
existing Client Schedule source fix with exact revision/auth/audit/isolation controls.
New date-sharing migration and actual sharing await exact approval; no fake content
approval/publication. #3256576732122 owns source correction and client-lane boundary.

Approved post-image RPC change is live, metrics/auth/ACL/advisor baseline unchanged;
frontend visuals remain release-gated. Baselinef53 full frozen local acceptance all22
browsers passed; new candidate must earn its own receipt. No Vercel operations here.
Normal Chat author package amendment is blocked by existing draft format reconciliation,
not missing invoice confirmation; v6/v3 preserved, #7316576397097. Continue existing
authority without competing strategy writer. [Detailed Cape receipt](CAPE-LUMBER-LAUNCH-REVIEW-2026-11-02.md).

## 2 November — invoice package corrected; real November Teams work identified

Owner invoices and explicit instruction supersede Cape's wrong no-video exclusion.
Normal guarded UI saved1video/month+7combinedposters/photos(existing4DP/3F retained),
socialmanagement,Contentguide,GoogleAds; audited GoogleAds entitlement included/rev1.
Independent canonical readbacks and live preview verify. No guessed shoot/other quota,
campaign budget or financial commitment; no SQL/provider/other-client write.

Cape DOES have8NovemberTeams tasks, but0Novembermonthly_deliverables. Earlier dated
projection did not prove absence. Novemberplan is omitted from current sync allowlist,
automatic apply excludes ClientSchedule, and the real name lacks manual-parser year.
All8undated;5completion flags are not posted evidence. Existing staff #325 owns reviewed
source-month admission/import/disclosure; exact source/task handoff6575792092. Do not
claim Teams/calendars fully integrated or invent source dates to make a grid look full.

Local client package/calendar visual source is tested175/175 plus actual-component
and compiled real-App/SDK desktop375/390/430 journeys, build/bundle/lint/diff. Imported
icons and exact confirmed service lines only; no extra API work/dependency or private
receipt output. New frontend and PR924 image projection remain release-gated, noVercel.
[Current Cape receipt](CAPE-LUMBER-LAUNCH-REVIEW-2026-11-02.md). #731 normal Chat author
has updated package evidence6575989662; no competing writer or interrupted active task.

## 2 November — normal Chat writer and native weekly task verified

Standalone Work-routed task `6ae862ef803081908fe734ac6035a4cd` failed execution
acceptance and is **PAUSED**. The normal company Chat author has now saved/read back
Cape November **v6** and December **v3**, changing only the sourced test-and-change
field while preserving staff decisions and complete plans; both remain drafts.
[Exact receipt](https://github.com/CGProductionHouse/CG-Dynamics/issues/731#issuecomment-6575066951).

The working normal author created native task `6ae868361b6c81918b6b333508a47a50`,
**CG Dynamics Weekly Strategies — Chat**, Monday08:00SAST/next9November/no end,
attached to [that same ordinary Chat](https://chatgpt.com/c/6ae83742-bff8-83e9-8aaa-7756976836d7).
UI schedule/active readback pass. Its Run now returned to that SAME normal chat
and started live exact-client research/briefs, recovering a bulk orchestration limit
with smaller batches. Follow #731 for completed save receipts; this is not fleet
completion or strategy publication. No paid generator, Vercel, revived Codex heartbeat
or staff/calendar changes. The older December one-off remains historical/completed.

## 2 November — visual post gallery (local candidate only)

CA's Cape Facebook screenshot exposed a text-only, duplicate winning-post presentation.
PR924/main5e1907ac completes the #668 imported-icon/media-card source: each ranked post once,
compact exact-definition metrics, expandable captions and image preview, safe original
post links, same accepted portal palette. Overview shares the card; staff curation is
preserved. 231 relevant tests, disposable PostgreSQL media/role isolation, actual
gallery/cutoff/full-preview desktop/375/390/430 browsers, build/app-bundle/lint/diff pass.
Real Cape public images were visually checked in local desktop/390 screenshots.

The additive existing-RPC public `image_url` migration is prepared, NOT applied.
Frontend and migration must receive their appropriate release gates together; no
Vercel or production changes occurred. Existing published report and live release below
are unchanged. Do not claim that source-only visual proof is deployed client acceptance
or repeat the completed October publication/provider sync.

## 2 November — Cape Lumber is the first launch client

Continue this exact client before the fleet list below. [Cape acceptance receipt](CAPE-LUMBER-LAUNCH-REVIEW-2026-11-02.md).
Google October traffic/cost match native UI and the actual client panel; nightly
sync covers1November. Cape-only completed October Meta refresh succeeded, reused
one report and synced37posts; actual FB/IG windows now1–31October. Logo View and
actual download identity pass; confirmed package seven combined posters.

**October publication is now COMPLETE.** PR922 repaired the native confirmation
with an in-app exact-client/month dialog and was released once conservatively
as source `3c58c898` / deployment `dpl_ARCpGYJm5BHHgYvgR71UZBhifREC`. Normal UI
publication and independent read-back confirm report
`93d58684-7913-4c57-9d4e-b2168e2a9a03` published 2 November 08:41:50 UTC, full
1–31 October. Actual client preview selects October; Google traffic/cost matches
native, 20,241 recorded social views, actual 375/390/430 navigation/no overflow
pass. Full 4,201 pass / 24 skips / all 21 browser fixtures; one local prebuild,
one 2.5 MB prebuilt upload, ten staged hashes, same-deployment promotion. No cloud
compilation or backend/config/permission change. See the exact Cape receipt above.

Next normal ChatGPT/#731 author refreshes/reviews the existing strategy against
published October findings, preserving staff edits. November v5/December v2
remain drafts; busy/failed-loading existing author chat was not interrupted and
no duplicate writer/new prompt/successful run is claimed. Dated
November/December schedule read has zero rows; separate staff owner settles real
posting dates/visibility. Client password/physical phone/Meta consent gates remain.
No campaign/permission/strategy/calendar publication changes. No docs-only deploy.

## 28 October live-release override

The client frontend is **LIVE** on www.cgdynamics.co.za at source `7eb0473f`,
deployment `dpl_7LxXqAEsdZhGVCdtWHjYSz8JfV3w`. CA explicitly authorised this
release. [Exact receipt, verification and remaining owner gates](CLIENT-PORTAL-LIVE-RELEASE-2026-10-28.md).
One local prebuild/one 2.5 MB differential prebuilt upload/same-deployment promotion,
zero cloud compilation; no further Vercel operation for this handoff. Full frozen
acceptance 4,201 pass/24 skips/zero failures, all 20 browser fixtures; bounded actual
live client preview/mobile/package/guideline/PNG acceptance passed. Billing read
after release: $7.36/$20 included, $0/$15 on-demand, Pause ON; counters lag.

Next is exact-client review/approved-content rollout, preserving the existing
ordered list below and #731 authoring ownership. **Meta owner re-consent remains:**
new UI and metadata confirm one legacy/zero encrypted token envelopes; approved
encryption implementation is live, but an old credential is not migrated by a
frontend release. Visible Reconnect Meta is now accessible; never backfill/copy
the token or suppress its warning. Bohemia Page access, actual owner password/
physical-phone and native-PDF recipient exceptions remain as recorded. No client
content, package, strategy, asset or permission was published/changed by release.

## 27 October provider/client acceptance — current override

CA clarified that event capture and shop-opening highlights do not require scripted
Content Guidelines. Madison Wear, The Staffordshire and HMHI must not be queued as
missing-guideline launch blockers. Existing source-import receipt remains complete;
no calendar, Content Run, scope, dates or production statuses were changed.

This pass used the normal company-admin connector and the legitimate signed-in
company Chrome admin interface. It did not repeat the completed all-client
Overview/Approvals/Brand Hub sweep or enter any staff account.

- **Meta:** 47 mapped clients/assets, 76 platform checkpoints.44 Facebook and
  29 Instagram successful checkpoints are dated27October.20 Instagram checkpoints
  PASS;44 Facebook +9 Instagram retain partial metric coverage. These are current
  refreshes, not a full-metric fleet pass. Active **Bohemia Quick Stop** has a Page
  permission/access error after an earlier successful27October run; do not retry
  away the permission gate. AV's failed Facebook checkpoint and Red Oak's absent
  checkpoint remain held-client exceptions. No new mappings or OAuth changes.
- **TikTok:** actual exact-account integration health inspected for all9 connected
  non-held clients: Braize, CG Production House, Dulux Paint & Paper Bloemfontein,
  Forklift Trucks, Madison Wear, Neshora Oxygen, The Staffordshire, Watch Addict
  and Wiseman Group. Each shows connected / complete coverage / complete
  completeness / fresh. This describes successful ingestion, **not** complete
  October activity analytics. Braize's actual October draft shows today's
  TikTok success but partial current-month facts, real cohort zeros and separate
  account snapshots. Red Oak remains held.40 additional queue entries lack a
  connected account; recurring social scope alone does not prove a TikTok exists.
  No reconnect, manual bulk sync or fabricated account mapping.
- **Google Ads:** all7 existing campaign mappings across Cape Lumber, Germoparts,
  Novus Steel and RC-Polypipe were audited for1–26October. One requested routine
  Cape/shared-account refresh1–27October succeeded:
  run `ea0785ed-5275-4896-9903-2b8617bbc798`, finished18:31:44UTC,
  one account/27 daily rows/zero failures. Independent exact-client audit confirms
 27 October days and complete requested-range sync. Today is still provisional.
  No campaign, budget or mapping changed. The other3 clients' existing mapped
  campaigns have no rows; #435's first-party paused/removed/ended evidence remains
  the explanation, not zero activity or permission to substitute another campaign.
  The17October handover already proves automatic nightly Google refresh; the older
 13October “no cadence” receipt is historical.
- **Actual report review:** Braize's October report remains a private draft;
  Client View refuses to expose it. Staff review renders current FB/IG platform
  windows through26October, today's verified probes and partial TikTok facts.
  Facebook unique viewers are unavailable, while5 other Facebook metrics and
  all8 Instagram metrics are definitive. No unavailable metric was coerced to0.
  Current stored facts do not imply a published October report.
- **Reproduced and fixed locally:** staff Overview simultaneously rendered verified
  account figures and a legacy “account total not synced” summary. The legacy
  diagnostic now appears only for legacy reports. Normalized reports retain the
  metric-level ConnectorDataHealth table, including missing/permission/partial
  states; client routes still display no staff diagnostics. Three actual-render
  regressions first failed2/3 then pass3/3. Combined88 focused tests pass.
  Actual component browser checks at1440/375/390/430 additionally verify the
  normalized-health table, absence of legacy contradictions, client-role removal
  and no page overflow/runtime errors. Existing cutoff/keyboard/website/Google
  checks remain green. TypeScript/Vite build and actual app-bundle check,
  scoped lint and diff check pass. No full-suite rerun is attributed to this
  narrow staff-diagnostic change. Build uses local fixture public configuration;
  its dist must never be uploaded. Private logs: %TEMP%/cg-provider27-*.log.
- The live older Meta screen still displays a storage-hardening warning; pending
  source70f255c5 already distinguishes unknown status and removes unconditional
  plaintext copy. Do not treat that old UI text as a new decrypted-token audit or
  repeat the already approved backend rollout. No token value was read.

### Exact-client launch double-check — 3 November, FULL UI PASS RECORDED

Canonical62active-directory rows individually inventoried through read-only queries.
This replaces the27October provider-only table; it is not another checklist.
V/F/DP are independently confirmed fields, not newly inferred package quantities.
“0 canonical rows” refers only to November/December monthly_deliverables, never proof
that Teams has no work. Calendar/import owner remains#325. Draft is a stored state,
not a claim that the normal ChatGPT source owner has not reviewed it. #731 owns
content/source/editorial; nothing below auto-approves or publishes. Disabled/missing
optional services on non-recurring/project clients are not manufactured launch defects.

All62directory records now have actual desktop journeys (61new plus Cape's prior
live acceptance), and all62have390px Overview/Plan/Calendar/Package journeys.
1,016new desktop panels,248mobile panels and four375/430secondary-navigation
checks and two supplementary Piek Leads views are recorded. No unresolved page reads or horizontal overflow. Piek's Calendar
read recovered by direct normal navigation; original timeouts remain in the receipt.
Strict heading/selected-tab/current-next-month evidence checks also pass.
These are admin previews, not all-client content readiness or password acceptance. Private authoritative per-page receipt:
`%TEMP%/cg-client-fleet-ui-v3-20261103.json` (imports the valid v2 completed records). The earlier v1 closure-associated
artifact is INVALID and never counts toward acceptance. One60s browser control
timeout interrupted an earlier BloemActionSports visit; it was subsequently fully
rechecked. v3 saves after each panel and bounds each browser call; no partial visit
is counted as a completed client.
No customer-password/physical-phone acceptance is inferred from admin previews.
Mobile receipt `%TEMP%/cg-client-fleet-mobile-20261103.json`; supplementary Piek
read `%TEMP%/cg-client-fleet-ui-recovered-20261103.json`;375/430menu receipt
`%TEMP%/cg-client-fleet-mobile-extra-20261103.json`. Viewport override restored.
No "To confirm" package placeholders were found in the completed UI snapshots.
Elcheck/JFJ show6combinedphoto/poster assets+1video; VCS8posters+1video.

Final source readback at17:40UTC still has only Cape published for November/December
and only Cape's8November canonical posting rows. That is not absence of Teams work.
There are41enabled libraries; the remaining21include17private holds and fourunmapped
held/excluded/cohort records.46existingexact-clientportal accounts;16unprovisioned.
22records have no published report; some are project/non-recurring clients. The table
records scope and publication, rather than automatically inventing launch blockers.

Provider readbacks: Meta47mappedclients/76platformcheckpoints:20PASS,55PARTIAL,
1STALE. Facebookaccessfailures Germoparts/Emmanuel/heldAV; heldRedOak stale.
TikTok10connectedclients have Novemberfacts lastverified2Nov21UTC; partial
cohort/account measures stay distinct. Exact Googleaccount/customer/campaign join
confirms Cape33dailyrows1Oct–2Nov. Germoparts' newer24413585918("GERMOPARTS2026")
had4rows30Oct–2Nov and was unassigned at that readback (linked4Nov); oldGermoparts mappings, threeNovus mappings
and RC-Polypipe have0October-or-newer rows. No live settings/ownership inference,
new mapping, campaign edit or resync was made. #435 retains exact provider review.
The first directdaily.client_id join returned0because that legacynullablefield is
NULL; it was corrected to the real account+customer+campaign projection identity,
not misreported as Cape having no data.

Final quarantine acceptance exposed an empty selected TikTok panel after all figures
were withheld. A focused local reader fix now gates on actual hasValue lines instead
of non-empty section metadata, reuses the existing unavailable state and preserves
genuinezero/partial figures. Red-before-green SSR regression and65focusedchecks pass;
four-width local browser proof/full exact-candidate acceptance are recorded in the
PR handover. Production quarantine is already live; this tiny UI fix is source-only
until a separately governed frontend release. No Vercel operation in this audit.

Final local acceptance of frozen candidate `8c678308219e` is PASS: 4,253 total /
4,229 pass / 24 existing skips / zero failures, mandatory PostgreSQL fixtures,
TypeScript/Vite, actual app bundle and all24browser fixtures (27steps, stable clean
source). Receipt `%TEMP%/cg-local-launch-8c678308219e.json`, SHA256
`c0e96a196a4f8dce9fdc2c9092f7f999c3e0a064b29554810c7ed4cb95a9c6f3`.
First full run's five missing-OpenSSL PATH failures and original logs are preserved;
corrected with the existing process-local Git OpenSSL, no source/config changes.
68 confirmed package-quantity comparisons matched actual UI; 1,240 mobile navigation
measurements were visible, minimum56pxhigh. Piek's entitled Leads view also passed
actual desktop/mobile More navigation; private supplemental receipt
`%TEMP%/cg-client-fleet-leads-20261103.json`.

Actual company Google Ads UI subsequently verified all9campaign statuses and business
creative. Cape is active; native October R2,199.24 matches stored data. Old Germoparts,
Novus and RC-Polypipe campaigns are paused/removed. Both exact missing links were approved and saved on4November: activeGermoparts
24413585918 and historicalpaused/endedNovus24189935204. Normal connector read-back
matches the already verified source totals; nine mappings total, seven originals
byte-identical. The 4November receipt above records the guarded administrative
fallback after browser confirmation failed. No campaign/budget/resync change. #435
retains provider ownership. This supersedes the earlier pending-approval state.



| Client | Confirmed scope / hold | Nov / Dec strategy | Latest published report | Nov / Dec client dates | Brand Hub | Portal account | Actual UI evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Agri-Secure | No recurring social | draft / Absent | None published | 0 canonical rows / 0 canonical rows | Private / 0 assets | Not provisioned | 16 desktop panels; mobile 390px: 4 views; no overflow |
| All Around PVC | V1 / F3 / DP3 | draft / draft | 2026-09-30 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow; TikTok 8-row repair live |
| AV Event Life | Owner hold | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | No mapping | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow; Facebook access gate |
| Bat Hill Royale | Flexible / confirmed fields only | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Bloem Action Sports | V1 / F4 / DP4 | draft / draft | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Bloem Marble & Granite | V2 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Bloem Vascular | No recurring social | draft / draft | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Not provisioned | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Bohemia Quick Stop | DP2 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Bouwer & Coetzee Attorneys | V1 / DP7 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Braize | F4 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| C&L Innovations | F2 / DP2 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Cape Lumber | F3 / DP4 | published / published | 2026-10-31 | 8 shared / 8 rows / 0 canonical rows | Enabled / 1 assets | Enabled | Prior live acceptance + natural8/0/0; mobile 390px: 4 views; no overflow |
| Case Bloemfontein | V2 / DP12 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Central Canvas | V1 / F4 / DP3 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| CG Production House | V4 / F8 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Daisy & Co | V1 / F3 / DP3 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Delta Gas | V1 / F3 / DP3 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Dulux Paint & Paper Bloemfontein | V2 / F4 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Econofoods | V5 | draft / draft | None published | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Ehrlich Park Butchery | V1 / F3 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Elcheck | V1 / F3 / DP3 | Absent / Absent | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Not provisioned | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Emmanuel Funerals | V1 / F3 / DP4 | draft / draft | 2026-09-30 | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow; Facebook access gate |
| Emoya Estate Driving Range | V1 / F4 / DP4 | draft / draft | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Not provisioned | 17 desktop panels; mobile 390px: 4 views; no overflow |
| First Technology Central | No recurring social | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Forklift Trucks | V1 / F3 / DP3 | draft / draft | None published | 0 canonical rows / 0 canonical rows | Private / 0 assets | Not provisioned | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Germoparts | V2 / DP12 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow; Facebook access gate; approved Google link live |
| Hino Trucks | V2 | draft / draft | None published | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| HMHI | DP3 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Human Auto | V3 | draft / draft | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Not provisioned | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Ipopeng Office Supplies | No recurring social | draft / draft | None published | 0 canonical rows / 0 canonical rows | Private / 0 assets | Not provisioned | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Jenkor | V1 / DP3 | draft / draft | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| JFJ Electrical | V1 / F3 / DP3 | Absent / Absent | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Not provisioned | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Jodrico Killian | Owner cohort decision | Absent / Absent | None published | 0 canonical rows / 0 canonical rows | No mapping | Not provisioned | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Kundedienste | No recurring social | draft / Absent | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| LHP Student Village & Block | Once-off / later | Absent / Absent | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Not provisioned | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Local Deli | No recurring social | draft / draft | 2026-07-31 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Loraclox | F3 / DP3 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Madison Wear | V2 / F8 / DP8 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Mimosa Mall | No recurring social | draft / draft | None published | 0 canonical rows / 0 canonical rows | Private / 0 assets | Not provisioned | 16 desktop panels; mobile 390px: 4 views; no overflow |
| NCNA | No recurring social | draft / draft | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Not provisioned | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Neshora Oxygen | V1 / F4 / DP4 | draft / Absent | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Not provisioned | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Novus Steel | V1 / F4 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow; approved historical Google link live |
| Peyper Bonds | V1 / F3 / DP3 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Piek Group | V4 / DP12 | draft / draft | 2026-09-30 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow; Calendar read recovered |
| PSG Bloemfontein | V1 / DP3 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| RC-Polypipe | V1 / F3 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow; approved historical Google link live |
| Red Oak | Owner hold | draft / draft | 2026-09-30 | 0 canonical rows / 0 canonical rows | No mapping | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Rusoord Farmstay | No recurring social | draft / Absent | None published | 0 canonical rows / 0 canonical rows | Private / 0 assets | Not provisioned | 16 desktop panels; mobile 390px: 4 views; no overflow |
| SecuriForce | V4 / F4 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Supa Quick BFN | V1 / DP3 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Supa Quick Centurion | V1 / DP3 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| TBS Brokers | F4 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| The Staffordshire | V4 / F4 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Tobich Optics | F4 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Toyota Bloemfontein | V4 | draft / draft | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| VCS Cleaning Solutions | V1 / DP8 | Absent / Absent | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Not provisioned | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Vrystaat Kunstefees | Flexible / confirmed fields only | draft / Absent | 2026-09-23 | 0 canonical rows / 0 canonical rows | Private / 0 assets | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |
| Watch Addict | V1 / F1 / DP2 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| We Ar Fuels | V1 / F4 / DP3 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Wiseman Group | V1 / F4 / DP4 | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Enabled | 17 desktop panels; mobile 390px: 4 views; no overflow |
| WiseRide | F2 / DP2 | draft / draft | None published | 0 canonical rows / 0 canonical rows | Enabled / 1 assets | Not provisioned | 17 desktop panels; mobile 390px: 4 views; no overflow |
| Zooz Lifestyle WFF | Not active for launch | draft / draft | 2026-09-23 | 0 canonical rows / 0 canonical rows | No mapping | Enabled | 16 desktop panels; mobile 390px: 4 views; no overflow |

### Continue the existing launch sequence

1. Keep #731's strategy/content review and publication separate from provider
   freshness. The new branded guideline source and this diagnostic repair are
   local/source releases until the approved frontend packet is executed.
2. Resolve **Bohemia's Page access** through the legitimate owner/provider path;
   preserve useful previously verified figures and their dates meanwhile.
   Do not block the other clients on held AV/Red Oak.
3. Review each launch candidate's already existing confirmed package, published
   strategy/report/guide, safe Brand Hub and staff-owned real posting allocations.
   Missing optional services must stay hidden; no empty content or extra scope.
4. CA's own client login and physical-phone check is the final owner acceptance.
   Admin previews and local fixtures do not replace it.
5. Only then prepare the single exact #679 release packet for the combined
   verified frontend source, smoke-test the released client journey and roll out
   client logins in reviewed groups. No invite messages or Vercel operation were
   performed in this pass.

Owner: current Codex client lane, starting main `3d7616d5`. No Vercel operations.
This is an ordered execution list, not a replacement product architecture or a
claim that protected production/content work is already complete.

**Later25October execution:** CA approved the exact Google and Meta backend
packets. Google safeguard is live55; Meta readers/key/callback are deployed in
the reviewed order, but the existing token still needs Facebook consent before
encrypted-row acceptance. Docker is now running; both mandatory SQL fixtures,
all20 browsers and the canonical frozen8353e75f suite pass, with24 declared skips.
Separately16 Instagram SQL checks and1 registry check pass;7 optional staff
PGlite groups remain unverified. Exact release/acceptance/rollback facts:
[PROVIDER-BACKEND-ROLLOUT-ACCEPTANCE-2026-10-25.md](PROVIDER-BACKEND-ROLLOUT-ACCEPTANCE-2026-10-25.md).
The earlier source-only receipts below are historical, not current deploy status.

| Order | Item and completion evidence | State / next action |
| --- | --- | --- | --- |
| 1 | Reconcile #668/#623/#505/#435/#731/#381, current review packet and open PRs | Done. No provider-integrity PR owner found. Onboarding and guideline/video PRs remain separate. Staff/Teams and normal ChatGPT strategy owners unchanged. |
| 2 | Google Ads ingestion: reproduce malformed-success handling; preserve existing data instead of accepting a partial/invalid response as an empty replacement | Source repair reviewed/merged PR885 (`dea0d349`). RED then GREEN actual adapter/HTTP regressions,89/89 Google tests, scoped lint/build/diff. Bad batches/rows reject before replacement; verified empties/zeros/optional settings survive. No provider calls, mappings or production sync. |
| 3 | Meta token-storage warning: inspect every consumer and prepare one staged, backwards-compatible hardening packet | Source reviewed/merged PR886 (`d1f37226`). Authenticated envelope, four dual-format readers, fail-closed writer and truthful status;273 focused tests plus the full receipt below. Exact protected rollout in META-TOKEN-STORAGE-HARDENING-2026-10-25.md. No key/config/deployment/data changes. |
| 4 | Finish remaining exact-client TikTok read-only panel sampling | Done25October. Staffordshire, Watch Addict and Wiseman settled panels load; combined with prior six, nine active connected-client panels inspected (held Red Oak excluded). Partial September figures/real zeros retained; old live labels await source release. Private receipt `%TEMP%/cg-remaining-tiktok-panels-readonly-20261025.json`. Not full monthly/provider completeness. |
| 5 | Reconcile remaining source/asset gates into exact owner actions | Done: #731 retains admission/editorial/publication; recurring source-held Hino, Neshora, WiseRide, Econofoods, Elcheck, Human Auto, Jenkor, JFJ, VCS, Toyota. Piek October requires exact editorial republish; do not replay older Braize/CG November v5 over v6. Human Auto GO resolved but not source-admitted; new Jenkor research needs skip/go. No second writer. Brand Hub17 safe-folder skips remain private under existing logo-only approval; Jodrico requires launch-scope review. Staff owner retains real posting/disclosure and Neshora run-folder/short-code actions. No unapproved file promotion or package inference. |
| 6 | Verify final source changes and update owning issues/#381/handover | Done for frozen7b911566:4208 total/4182 pass/26 explicit skips/0 fail, TypeScript/Vite actual app and all20 canonical browser fixtures at1440/375/390/430, stable tree. Whole lint0errors/17existingwarnings; Deno closure passes. Two SQL fixtures/device/client-role limitations retained. |
| 7 | Close the additional Meta start/TikTok helper compile errors | Type-only follow-up: nine errors reproduced on unchanged baseline; explicit existing SDK client types fix generic unknown-schema inference. Existing auth/refresh/provider calls unchanged; emitted JS byte-identical.388 focused Meta/TikTok tests, Deno/build/scoped lint/diff pass. Earlier full receipt is not reattributed to this later source head. |
| 8 | Run the previously blocked local PostgreSQL checks after CA starts Docker | Done. Both mandatory SQL fixtures pass; canonical frozen8353e75f4208total/4184pass/24skips/0fail, all20browsers/build/stable tree. Separately16Instagram SQL and1registry check pass;7optional staff PGlite groups remain separate. |
| 9 | Apply only the separately CA-approved provider backend packets | Google two-file guard released/read back, no sync or mapping/data changes. Meta four readers → private dedicated key → callback deployed and read back. Existing connection/47mappings unchanged. Final encrypted-row acceptance awaits CA Facebook consent; blank provider panel is not bypassed. No Vercel. |
| 10 | Close actual Brand Hub file-window acceptance beyond prior listings | Later continuation:37 unique actual image Views pass; all41 published libraries accounted for, with Case/Emoya/Germoparts native-PDF renders and LHP URL-policy denial explicitly unverified. Original portal/exact client/no referrer retained. No denied-window workaround, publication or duplicate listing sweep. See CLIENT-FILE-ACCESS-ACCEPTANCE-2026-10-25.md; earlier eight-client receipt remains historical. |
| 11 | Continue the renewed overnight mission without redundant reports or protected writes | Existing heartbeat updated ACTIVE hourly, ending 08:00 SAST 26 October. Current receipts/ownership in saved prompt; no duplicate strategy writer/staff lane or repeat backend releases. Continue remaining safe acceptance only when legitimate browser transport is available; otherwise preserve exact gates and stop unchanged retry/audit loops. |
| 12 | Reproduce and fix slow authorisation losing the browser's file-window gesture | Source ea5eaad6: six-second grant/normal popup blocking reproduces missing View window, then gesture-time isolated reservation fixes it. Slow View/Download, actual synthetic attachment bytes/filename, blocked/closed/abandoned windows and scope fencing pass1440/375/390/430. Frozen full4208total/4184pass/24skips, all20browsers/build/stable tree, focused27tests/scoped lint/diff pass. Whole lint0errors/17existingwarnings. No Vercel/backend/data change; source-only until separate release packet. |

## Exact verification and current acceptance boundaries

PR886 tested head `7b9115666b5547f907dcac45bebe4c342fe0a9f6`, private receipt
`%TEMP%/cg-client-nondb-7b9115666b55.json`, SHA256
`7E404279BE1191680344560011EA316AE7858D854D282CCDEDF37E516720FEFE`.
This is supported **non-database local** acceptance, not a production launch
certificate. Fresh bounded Docker info still cannot reach the server; no shared
restart/reset, local-stack install or SQL/production workaround was attempted.
Fixture-configured `dist` must NEVER be uploaded.

25October read-only November connector checks reconfirm all ten recurring source
holds above. Their package evidence is available. Six ready guides do not supply
eligible substantive commercial evidence; Elcheck/JFJ/Neshora/VCS also lack the
client-evidence gate. Three of those (Elcheck/JFJ/VCS) have no November row; seven
existing v1 drafts are untouched. This is an exact source-owner queue, not a new
manual strategy-writing task or permission to publish generic filler.

Read-only hosted baseline: eight functions/65 files captured privately. Meta
callback70/status66/assets70/manual-sync87/worker74; Google sync53, Meta start71,
TikTok sync49. Meta JWT settings false, Google/TikTok true, all unchanged.
Offline five-function Meta candidate has56 files and cached-only Deno closure
passes. It preserves older hosted callback/assets helper behavior instead of
replacing it wholesale. Callback's existing duplicate identical `availability`
property was minimally removed in that **private candidate only** to pass Deno;
this exception must be part of any exact release review, not silently deployed.
Worker/manual shared helper changes are type-only with identical compiled/minified
runtime; other hosted files are preserved. Offline Google candidate also passes
Deno with only its two intended files changed. No hosted/config/data write.
Private packets are preparation only: re-read current versions before release.
The Meta offline manifest SHA256 is
`8AAEB71086F0C59A071BD164020B0C52F9AA2EF23ECBFD157E251619A673940C`.

No Vercel, production keys/SQL/schema/Edge/provider/mappings/permissions, package,
strategy or asset publication occurred. Runtime design/navigation is unchanged.
Staff/Teams and ChatGPT strategy lanes are not claimed completed by this pass.

## Google evidence — do not rediscover or guess replacements

#435 comment6155838102 records the first-party cause of the older missing mapped
campaign facts: Germoparts paused/removed, RC paused and Novus removed. The newer
25 October stored-data check finds Cape through24October and no October rows for
those other mapped clients. These are not measured zero and do not prove the daily
worker failed. An enabled configuration is not proof a campaign is still serving
(the previously discovered unmapped Novus campaign had already ended). Keep exact
current identities until a separately authorised provider/mapping decision.

The malformed-response ingestion risk being tested is independent: it is NOT
asserted to have caused those three production gaps.

## Protected release and acceptance queue

Later approved backend work is now recorded in the rollout receipt above; do
not repeat those deployments. Only the existing-token renewal/actual encrypted
row acceptance remains in that bounded Meta packet. All other authority below
continues to require its exact approval.

- No Vercel/cloud builds, previews, upload, promotion, hosting or spend changes.
- No production SQL/schema/Edge/config/secrets/provider/OAuth/mapping changes.
- No package inference, strategy approval/publication, file publication or sharing.
- Genuine client-password and physical-phone acceptance remain CA-retained.
- The two mandatory disposable SQL fixtures now pass. Full-suite24skips remain
  accurately recorded;16Instagram and1registry check passed separately, leaving
  seven optional staff PGlite groups outside this local client acceptance.
- Source-ready code and read-only admin preview are not whole-app launch acceptance.

Current detailed prior receipts: `CLIENT-PORTAL-REVIEW-2026-10-25.md`.
