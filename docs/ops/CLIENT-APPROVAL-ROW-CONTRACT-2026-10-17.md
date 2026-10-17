# Client approval queue row contract — 17 October 2026

Owner: #668 / #623; source base `b789d971` after documentation-only #834.

## Reproduced defect and repair

The actual client Approvals page checked only that the response was an array,
then cast every entry to `ContentReview`. A local `[null]` response passed that
check and failed rendering rather than showing the existing safe failure state.
The added actual-component 375px assertion failed before the runtime edit (safe
error heading never appeared). Internal-only review states could also reach the
client card through the unchecked cast. This is a local malformed-response
reproduction, not a claim those payloads were observed in production.

`projectClientReviewQueue` validates the existing public queue fields: unique
UUID, nonblank title/asset path, supported media/channel values, explicit-offset
real scheduled timestamp and client-review/approved states only. It copies only
the public fields and clones channels, so staff extras do not enter client state.
The whole queue fails closed rather than dropping bad rows into a false all-clear.
An actual `[]` remains a verified empty queue. Both normal client and named staff
preview use this same projection; the preview still pins client, required-client
approval, allowed states and internal approval in its existing query. The normal
RPC still derives ownership from the session, with no client override.

No styles, destinations, decision/upload writes, approval policy, auth, RPC
signature, schema, dependency or source-of-truth changes. Staff production rows
keep their existing reader. Open #775/#662/#618 were inspected and untouched.

## Verification

- Focused unit suite: 16 passed, zero failures. New contract groups cover malformed
  fields/envelopes, mixed bad rows, duplicates, internal states, date overflow,
  timestamps without offsets, supported media/offsets, allowlist and unchanged
  input. Existing identity/publication/role and real approval-action checks retained.
- Actual normal-client browser fixture: 375/390/430/1440, malformed/null rows,
  internal-state denial, true empty, mixed/approved history, failed media and
  synthetic decision failure. No real write or external network.
- Actual full-shell staff preview fixture: same four widths, malformed queue and
  existing six destinations, exact client changes, role denial and read-only checks.
- Local production build and emitted `client-schedule` app chunks PASS; scoped
  ESLint and diff checks PASS. Existing >500kB index warning unchanged.
- Full supported suite: **3,928 total / 3,909 passed / 19 intentional skips /
  zero failed/cancelled/todo**. All **15 canonical browser fixtures PASS**.
  Two optional workstation PostgreSQL checks were skipped with Docker stopped;
  unsupported Windows Bash SES fixture excluded, not passed.
- Phone 390px synthetic error screenshot visually inspected. Not a physical-device
  or authenticated client-role production pass.

Local logs: workstation Temp `cg-approval-contract-full-suite.log` and
`cg-approval-contract-<fixture>.log`. Existing CG Pay Playwright module/browser
used; no install/download, auth-copy script or credential transfer.

## Bounded live read-only checks

Existing signed-in staff preview for exact Forklift client
`4424ed69-7270-4d30-a1ea-0b77d76912df`: October Calendar route loads but exposes
no client-visible items. This is not proof of a completed posting plan and must
not be filled with guessed Planner dates. Client Schedule and operational Calendar
remain separate. No production mutation was performed to obtain test content.
The normal exact-client Client Schedule read for 1 October–30 November also
returned `deliverables:[]`, error null. The empty view is therefore consistent
with that bounded source read, not proof that Teams posting work is ready or an
invitation to copy operational Planner tasks into the posting calendar.

Normal CG connector reads at approximately 17:24 UTC:

- Cape Lumber Google Ads exact mapped campaign: 16 October daily rows through
  16 October, successful sync `2026-10-16T22:00:14.644+00:00`, range 12 Sep–16 Oct,
  51 account rows and one unmapped campaign. These are campaign facts, not verified
  sales or conversion-goal detail. No provider request/manual refresh invoked.
- Meta: 47 mapped clients, Facebook 46 PARTIAL + one STALE (Red Oak exact client
  `cdb11a82-339e-4b46-9b09-bde1a23efeaf`, permission/access blocked), Instagram
  20 PASS + nine PARTIAL. These are checkpoint verdicts, not native-post completeness
  or blanket reporting/publication acceptance. No grant or mapping changed.
- Ten TikTok connections active/not expired. A connection check does not establish
  complete monthly metrics or fresh content totals; earlier dated sync receipts
  remain separate.
- Microsoft run `d6edd7b9-407f-42e2-80c4-adf7588842b1` finished 14:28:11 UTC,
  six sources complete (147/182/934/517/339/5764 records), five safe applies,
  zero failed/remaining, **384 conflicts**, 1,775 skipped, 6,103 excluded Client
  Schedule candidates. Status partial/degraded, not fully reconciled. No force
  apply, audit deletion, Microsoft write or invented posting schedule.

## Strategy and release separation

#834 merged the existing OpenCode receipt branch and corrected independent-review
attribution. Ten saved October/November draft IDs/versions across Cape, Forklift,
RC, HMHI and Bohemia were independently re-read through the normal connector;
all unpublished. Full unchanged-field comparison is the writer's receipt, not a
second supervisor historical diff. The same normal **Write Client Strategies**
chat accepted the next five eligible clients from the Kundedienste cursor; at the
last check it was active, not another completed/save receipt. No duplicate author,
new automation or paid generation. Keep Human Auto and other exact evidence gates.

ZERO Vercel operations and protected production mutations in this lane. Automatic
Git deployment remains off. Frontend changes are source-only until #679's exact
fresh release packet and authentic changed-runtime acceptance. Source/content
review, publication, exact final assets/recipient safety and protected provider
decisions remain separate. Control Centre access still unavailable, not guessed.
