# Report and approval read truth — 17 October 2026

Owning #668 / #389 / #381, release #679. Base main `3e068672` (Lead Inbox
repair #830). Open owners #775/#662/#618 are unchanged.

## Reproduced defects and repair

Two independent actual-reader regressions failed before their repairs:

- Staff `listPreviewReports` and `listPreviewApprovals` turned a successful null
  response into an apparently verified empty report/review list. A real persistent
  portal-shell browser also failed the expected unavailable-state assertion.
- Normal `listClientPublishedReports` and its published-post reader did the same.
  Missing child posts could make an incomplete report look like a real empty one.

Existing readers now reject missing/non-array list envelopes, discard data from
failed reads, contain rejected transport promises and return safe error messages.
Actual `[]` remains verified empty. Exact-client filters, client-safe fields,
publication/internal-approval predicates, frozen strategies and write boundaries
are unchanged. The normal client still uses only its existing safe RPCs with no
client override. No new table, authority, dependency, API or design.

Runtime files: `src/lib/clientPortalPreview.ts`, `src/lib/db/reports.ts`.
Tests: `tests/clientPortalPreview.test.mjs` and extended existing
`scripts/client-portal-shell-readonly-browser.mjs`.

The browser fixture exercises actual normal-client Dashboard and named staff
preview at 1440/375/390/430: missing reports, missing published posts, missing
preview approvals, real empty reports, persistent navigation, selected-client
switching, denied preview roles and zero write controls. All network responses
are synthetic localhost fixtures; this is not authenticated production acceptance.

## Passive production acceptance advanced

Only bounded SELECTs were used; no provider call, manual sync, token retrieval,
impersonation, mapping change, activation or publication.

- First automatic Google daily refresh independently succeeded on one attempt:
  job `6a9ca5f2-4ddb-43c8-93fe-793895d36086`, provider run
  `be331422-fd14-4717-9b74-7c84f57b372c`, operating date 17 October,
  12 September–16 October, 51 rows; completed 16 October 22:00:14 UTC.
  This supersedes the earlier “first future automatic run not yet proved” gate.
- Exact active account/customer/campaign joins show Cape Lumber has 16 daily rows
  in October through 16 October. Germoparts, Novus and RC-Polypipe still have no
  matching campaign rows; not zero performance, nor proven inactive campaigns.
  One provider campaign remains unmapped. No automatic campaign assignment.
- A direct legacy metric `client_id` join returned no rows because all 16 October
  rows are account-scoped with null legacy client ID. It is not the client
  projection authority; the mapping-aware query above is required.
- All 10 active connected TikToks have verified successful runs within the existing
  30-hour window. Their last successes are 16 October 08:52–08:56 UTC. Freshness
  does not turn cumulative/cohort API facts into full monthly account metrics.
- Latest observed Meta runs across the bounded 16–17 October read: 44 Facebook
  `partial/verified_partial`; Instagram 20 `success/verified` and 9
  `partial/verified_partial`. These counts are recent-run coverage, not the
  full active-client inventory or a completeness certificate.
- AV and Zooz Facebook checkpoints still fail with `provider_error`; this query
  returns no Red Oak Facebook checkpoint. No grant gate was cleared.
- The five older Ehrlich/HMHI/SecuriForce/Vrystaat native post IDs remain absent
  across stored reports. Provider-object eligibility remains unresolved; no blind
  insert, source substitution or invented monthly totals.

Exact bounded queries and selected results:
`strategy-review/2026-10-17-passive-integration-readback.json`.
No personal comment/patient data or credentials persisted.

## Verification and boundary

- Two actual-reader regression groups failed before repair; existing tests passed.
  Initial missing-env setup and mismatched local Playwright browser attempts are
  not reproduction evidence. Existing CG Pay Playwright1243 matches the installed
  local test browser; no package/browser download or user-session change.
- **20 focused tests pass**, including query predicates, publication allowlists,
  frozen strategy projection, normal client safe-RPC use and foreign-role denial.
- Final supported serial suite: **3926 total /3907 pass /19 intentional skips
  /0 fail**. Two optional disposable-Postgres checks skipped because Docker is
  stopped; unsupported Windows Bash SES excluded, not passed. Log: workstation
  Temp `cg-preview-read-truth-final-suite.log`. Earlier intermediate suite passed
  3906 but predates normal-client expansion and is not final-source acceptance.
- All **15 canonical local browser fixtures pass**, including extended actual
  Dashboard/client-preview shell at1440/375/390/430, no overflow/runtime errors,
  no mutation controls and only intercepted allowlisted local read requests.
  Temp logs: `cg-preview-final-<fixture-name>.log`.
- `npm run build`, emitted application `client-schedule` chunks, scoped ESLint and
  diff checks pass. Existing >500kB index-chunk warning unchanged.
- Self-review: approve source merge, no blocking correctness/security/scope issue.
  Existing RPC/auth/RLS/write and source authorities are unchanged; fail-closed
  errors do not discard legitimate empty lists. Not an independent review claim.

ZERO Vercel, production data/schema/Edge/config/secrets/provider/OAuth/permission
or strategy/report/asset publication changes. Frontend remains source-only pending
#679's exact fresh release packet. Staff edits, client IDs and CG Hours preserved.
No actual client-role login, real phone or whole-fleet launch signoff is claimed.
Existing normal-chat strategy authoring, exact source/scope, final assets,
recipient-safe Brand Hub and protected acceptance decisions remain separate.
