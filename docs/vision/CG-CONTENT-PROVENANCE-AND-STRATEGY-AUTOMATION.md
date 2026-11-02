# CG creative evidence and autonomous strategies

Owner direction: 2 November 2026. Implementation owners remain #668 (client
experience/reporting), #731 (normal company ChatGPT author) and #325 (staff/source
workflow). This is one design/acceptance contract, not a second launch checklist.

## Decision

Every eligible client's current/next strategy must reconcile current research,
actual production and observed results. Every client uses the shared concise visual
reader from PR931. Creative rankings and claims about CG work require positive
CG-creation evidence; simply managing or posting on a page is insufficient.

Keep whole-page results labelled as page results. They may include client/third-party
posts. CG creative rankings are a narrower subset and must never relabel the whole
page's reach, views, leads or sales as the result of CG-made content.

## Verified starting point

- The existing normal company ChatGPT task is now **CG Dynamics — Research & Strategy**,
  weekdays08:00/11:00/14:00/17:00 Africa/Johannesburg, same chat. Keep it as the author; do not add a Codex/paid-API
  author or reactivate the failed Work task. Source/connector availability is tested
  at execution; changing its prompt is not a successful unattended run.
- The current report statistics rank all eligible posts except explicit exclusions.
  `report_content_exclusions` is an exclusion mechanism, not positive creative origin.
  Current methodology's “CG-created or CG-managed” wording is too broad for this rule.
- Existing `client_portal_assets` / library/category/client mappings identify final
  assets. `monthly_deliverables` remains schedule truth; `content_review_versions`
  remains approval/version truth; `posts` and provider IDs remain publication truth.
  Extend these relationships, not a parallel calendar, work board or asset store.
- PR931's shared Plan/Performance reader is merged/source ready, not deployed. Its
  visual interface already applies to every client; no per-client redesign is needed.

## The automatic evidence chain

```text
CG source design / approved production export
                   ↓
Exact-client OneDrive final asset and immutable version/fingerprint
                   ↓
Verified match to a real social post and its platform ID
                   ↓
Period-correct observed performance for that post
                   ↓
CG-only creative learning → next-month strategy → new production
```

Record source creation and publication as separate facts. A third-party photo posted
by CG is not automatically CG-created. CG-designed graphics, CG-shot photography,
CG-edited videos and documented co-produced work may qualify when their actual
production lineage is verified. A logo, caption, file name or folder alone does not.

### 1. Discover finals without extra staff administration

Keep staff's existing final-export/upload workflow. Incrementally detect new/changed
files within verified exact-client final folders; do not make staff tag every upload,
paste post links, rename old archives or fill another checklist. Use stable drive/item
IDs and version/hash receipts, not folder names as identity. Record Canva design/page/
revision/export identity or the existing CG production export receipt where available.
Preserve the original asset instead of copying every file into another storage system.

Use supported Graph change notifications/delta for the connected account; fully follow
pagination and store a cursor only after a durable successful batch. Initial inventory
is bounded; later runs process changes. Verify account-type/permission support first.
Filter to registered client-final roots immediately; ignore unrelated root metadata
without persisting it. Do not broaden permissions or client file visibility implicitly.
An upload to a shared folder establishes a candidate, not proof of CG authorship.

### 2. Match finals to actual publication

Prefer a durable post ID already returned by the existing publishing workflow. When
staff publish elsewhere, automatically compare the final asset to the observed media
of that exact client's connected page, with platform/post IDs and publication time.

| Evidence | Automatic treatment |
| --- | --- |
| Verified CG production lineage plus exact durable asset/post link | Eligible CG match after scope/version checks |
| Verified lineage plus exact bytes or equivalent decoded pixels under documented normalisation | Eligible when unique within exact client and all media checks pass |
| Recompressed/cropped image, carousel or transcoded video | Candidate; use calibrated multi-signal matching and validated ambiguity rules |
| Same caption, logo, template, filename, date or uploader only | Insufficient; keep outside CG rankings |
| Conflicting/missing origin or media, cross-client match, common stock/repost | Quarantine; no CG credit |

Perceptual similarity alone is not proof: templates, stock photographs and logos cause
false positives. Candidate matching may combine normalised image features, text/layout,
exact source lineage and actual media; calibrate thresholds on labelled positive AND
adversarial negative pairs before enabling that class of automatic match. No invented
percentage threshold or “100% accurate” claim. Videos require bounded frame/sequence
evidence, not a matching cover. Mixed carousels require item-level scope; one matched
slide cannot certify the whole post. Platform/time is supporting context, not proof.

Retain an auditable evidence relation: client ID, source/version, creative origin,
provider/post ID, media-item coverage, method/version, decision, observed time and
superseding correction. Design exact schema only after existing-table/security review.
One creative may map to Facebook and Instagram independently; do not count it as two
created assets or combine reach into unique people. A later source edit must not erase
the old version that was actually published. Withdrawals/corrections remain auditable.

### 3. Rank CG work without distorting the report

Positive `verified CG creation AND verified asset/post match` is the allowlist.
Unknown, client-created and third-party posts cannot become top CG performers.
Exclusions still win. Enforce this in client-safe server projection, shared ranking
helpers AND strategy-brief evidence; a UI filter alone leaves the author contaminated.
Do not expose internal drive IDs, private URLs or matching diagnostics to clients.

Show up to two strongest verified CG creatives with actual images and a compact result;
if one qualifies, show one; if none qualify, omit the panel. Never fill a slot with an
unverified high-performing post. Whole-page totals remain unchanged and separately
labelled. Use equivalent metric definitions/windows; unknown is not zero; partial
metrics are not complete. Paid amplification is not proof of superior creative or sales.
Separate platform-specific results where aggregation is not valid. Existing historical
report/content approvals remain intact; no silent rewrite of approved narrative.

## Research and strategy loop for every client

Actual first-run constraint: the Monday-only task exhausted its tool budget after
34brief reads across17clients, with zero external checks/new saves. That is triage,
not completed research. One giant fleet pass is not a viable execution design.
The same task now runs bounded workday continuations: finish ONE eligible client
end to end per run, start a second only with sufficient budget, reserve at least
five calls for any save/readback/checkpoint. Do not bulk-scan briefs first. Track
brief-read separately from source-checked, strategy-reviewed and saved. Resume the
earliest eligible client missing its source review, not the last merely opened brief.
Once the weekly source cycle is complete, continuation runs check actionable changes
and otherwise exit quietly. Actual throughput and degraded-source coverage are
measured; twenty weekly wakes do not guarantee a completed fleet or justify paid overflow.

Coverage receipts must distinguish **discovered metadata**, **content inspected**,
**verified unavailable/empty**, **stale** and **not attempted** for each required source.
Canva design titles or an OneDrive root discovery do not count as inspection of the
current artwork/final folder. A reviewed-with-gaps strategy is not a fully researched
client. The first Delta pilot6580862805 exposed exactly this remaining gap: existing
drafts sensibly preserved, public/Teams research performed, but artwork/finals not
inspected. Continue those missing checks without repeating the whole pass. The proposed
runtime coverage validator must reject metadata-only “complete” claims, independently
of an assistant's prose or confident completion label.

The weekly author must page the canonical roster to completion, with a durable cursor
and per-client/current-month/next-month coverage. Continue unfinished clients before
repeating Cape or another easy client. A hard timeout or unavailable page is recorded as
partial coverage, never fleet completion. Use source fingerprints to avoid costly rereads
and unchanged rewrites, while still refreshing sources on their appropriate cadence.

For each eligible client, read actual current package/guide, owner/staff amendments,
incorporated meeting notes, current/next strategy, prior published performance/windows,
verified CG post evidence, actual Client Schedule/Teams progress, relevant WhatsApp
decisions, OneDrive finals, Canva/source artwork, company Drive/industry research and
attributable primary public business/market evidence. Distinguish actual observations,
approved facts and research hypotheses. Older themes/AI summaries are not current facts.

Reconcile `draft / in production / shared / approved / scheduled / posted` from existing
authorities before proposing work. File presence is not approval; WhatsApp approval
must identify the actual asset/version; a scheduled date is not proof of posting.
Existing work is reused/refined/tested deliberately, not presented as a new concept.
Respect package removals, once-off/deferred cases, staff ownership and specific holds.

Write one clear commercial goal, audience need, message, package-bounded creative ideas,
realistic next actions and measurable learning test. Use short action headlines and
simple client copy; keep source ledgers and detailed research internal. A hypothesis is
not a promised sales outcome. Known package information is not repeatedly requested.

Save only justified canonical draft gaps/amendments through the existing version/source-
fenced MCP tools, preserve staff text and published snapshots, and read back actual IDs,
versions and complete changed fields. Current eligible source IDs are required by the
connector; retain newly found source URLs/date/provenance for governed admission rather
than fabricate citations or auto-activate knowledge. A source gate blocks that dependency,
not all other clients. Current publication/permission controls are not bypassed.

## Unattended access must be real

The company ChatGPT task can use only connectors actually available to its scheduled
run. A signed-in personal Chrome WhatsApp tab is not proof that this task can read it.
WhatsApp groups need a verified, authorised unattended ingestion path. Investigate the
existing business integration's actual group/history support before adopting any API;
do not assume all app history/groups will be available. Do not migrate/disconnect the
business number, send client messages or install a scraping bridge as a hidden fix.

While a source is inaccessible, record its last successful check and exact gap, use
available supported evidence, and continue. Never advertise complete autonomous
WhatsApp coverage until a real scheduled ingestion/readback test passes. One-time
account consent may be required; no routine manual copying/tagging should be designed in.

## Cost, privacy and operational controls

- Prefer incremental OneDrive/provider events, idempotent bounded jobs and cached
  fingerprints. Avoid hourly full-fleet browser sweeps, full-video downloads on every
  sync, paid vision/generation calls or repeated Vercel builds.
- Use existing approved local/background or backend infrastructure after a reviewed
  rollout; no new paid provider, permission, schema or hosting operation by this plan.
- Read only whitelisted client business sources. Do not ingest personal chats or raw
  working folders into client-accessible storage. Keep client isolation and existing
  least-privilege/RLS/publication rules; treat all source text as untrusted evidence.
- Automatic routine successes are silent. Only new actionable exceptions, failed
  coverage that needs intervention or completed review-ready work warrant notification.
  Retry bounded transient failures, resume cursors and suppress duplicate alerts.
- Ambiguous matches remain safely unranked and can be reconsidered automatically when
  new evidence arrives. They do not create a manual queue that blocks every launch.

## Ordered implementation inside the existing launch mission

1. **Standing author policy:** strengthen the existing company Chat task; use bounded
   weekday08/11/14/17 continuation batches, normal Chat route and no-paid-generation rule. Read back saved
   settings. No new competing author. Retire the expired26Oct Codex overnight heartbeat.
2. **Strict attribution contract locally:** create deterministic regression fixtures
   for unknown-vs-verified origin and shared ranking/strategy filtering. Prepare the
   minimal client-safe data projection; no production SQL yet. Stop rewarding unknown
   origin as CG work; no synthetic backfill from managed-page membership.
3. **Asset-to-post prototype locally:** reuse exact library/approval/source/post IDs;
   test a bounded Cape corpus containing real CG work and real client/third-party
   negatives, similar templates, stock, crops, reposts, video covers and cross-client
   collisions. Add another distinct client before accepting general automatic matching.
4. **Incremental integration:** implement source/version receipts, change cursors,
   provider media joins, bounded retry/recovery, read-only MCP provenance/coverage.
   Prepare exact production schema/function/permission packet only if needed.
5. **Governed rollout:** reviewed local build/tests/device/browser/isolation acceptance,
   exact-approved production operations and ONE consolidated conservative release.
   Verify actual client-role CG rankings and actual scheduled source/read/save receipts.

Acceptance must prove zero known false-CG credits in the labelled corpus, measurable
coverage/precision limits, correct exclusion of unknowns, unchanged page totals, actual
current/next draft save/readback, preserved staff/published text, exact client isolation,
safe media links, cursor replay/recovery and375/390/430/desktop visual use. A green
fixture or saved prompt is not proof the production matcher or unattended access exists.

References: [Graph incremental drive changes](https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0)
and [OneDrive notification/delta model](https://devblogs.microsoft.com/microsoft365dev/onedrive-webhooks-and-large-uploads-with-microsoft-graph/).
Meta primary API pages returned429 during this bounded check; no WhatsApp group/history
capability assertion is based on third-party claims. Runtime capability must be verified.
