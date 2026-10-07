# Connected TikTok: production evidence versus client presentation

7 October 2026 · #668 / #505 / #381. SELECT-only, authenticated existing staff
Chrome acceptance; no provider sync, data publication, config or Vercel action.

At 19:42 UTC there were **10 active connected canonical TikTok accounts**. Each
had 16 stored September/October facts. All September facts were **partial**;
zero values in that evidence must not be promoted to complete observed monthly
totals. October's latest verification does not refresh September's fact age.

| Exact client | Latest fact verification UTC, Oct 7 | September published report | Client browser evidence |
| --- | --- | --- | --- |
| Braize | 14:47:03 | Yes, cutoff Sep 23 | Settled authenticated Overview renders TikTok facts; tab action transport timed out; not counted as clicked-tab acceptance |
| CG Production House | 14:46:10 | Yes, cutoff Sep 23 | Settled authenticated TikTok tab, 2,359 partial views |
| Dulux Paint & Paper Bloemfontein | 14:48:02 | Yes, cutoff Sep 23 | Desktop Overview + TikTok tab; 375px TikTok tab |
| Forklift Trucks | 14:45:05 | No September/October report | Cannot claim published client performance; connection is not publication |
| Madison Wear | 14:48:04 | Yes, cutoff Sep 23 | Settled authenticated TikTok tab, partial zero views / 4 account videos |
| Neshora Oxygen | 14:49:02 | No September/October report | Cannot claim published client performance; connection is not publication |
| Red Oak | 14:49:11 | Yes, cutoff Sep 30 | Desktop Overview + TikTok tab |
| Staffordshire | 14:47:05 | Yes, cutoff Sep 23 | Settled authenticated TikTok tab, 8,650 partial views |
| Watch Addict | 14:46:12 | Yes, cutoff Sep 23 | Settled authenticated TikTok tab, partial zero views / 23 account videos |
| Wiseman Group | 14:45:08 | Yes, cutoff Sep 23 | Settled authenticated TikTok tab, 194 partial views; no captured error logs |

All eight clients with September reports had October drafts, not client-published
October reports. All Around PVC had historical September facts but was not in
the ten current connections; preserve published history without pretending that
it proves a current connected account. No connection/provider change is needed
to retain already authorised historical reporting truth.

## Reproduced defect and narrow local fix

Red Oak's real September tab displayed 57,944 video views, 174 account videos,
6,582 followers and 52,555 account likes with partial coverage. Account video,
following and likes snapshots were all mislabelled **Current followers snapshot
at the latest sync**. This is both the wrong metric and an unsupported freshness
statement for historical report data.

The local shared snapshot label becomes **Account snapshot for this report · not
monthly growth**. No metric values, availability, rankings or provider behavior
change. An actual-component SSR regression failed before the edit and passed
afterward. It verifies TikTok facts render without Coming soon, partial coverage
remains labelled, explicit zero remains numeric, missing stays nonnumeric, snapshot
metrics cannot become monthly growth and inputs remain unchanged.

Dulux's existing production 375px tab had viewport 375, document/body scroll width
360 and no captured error-level console entries. This is authenticated **old
deployed UI** acceptance, not proof the local fix is released. The old package
layout and Best platform dash are already addressed in unreleased main changes;
do not recreate those fixes or deploy to Vercel to obtain this receipt.

## Newly reproduced period-contract issue — next bounded code lane

**Locally resolved by PR #702, not yet released:** exact per-metric recorded
windows now appear separately from report content coverage. No truncation,
provider read, SQL change or inferred observation timestamp. Full pinned local
receipt is `REPORT-FACT-WINDOW-ACCEPTANCE-2026-10-07.md`. The following original
production reproduction remains historical evidence, not a still-unfixed code task.

Braize/Dulux published reports disclose Sep 1–23, while normalized TikTok facts
read back with Sep 1–30 bounds and Sep 30 verification. The current production
`get_report_metric_facts` function filters exact client, permitted metric and current/
previous month, **not the published cutoff**. Browser output mixes those facts
under the report's Sep-23 coverage statement without stating their own window.
This was a reproduced evidence/presentation contradiction, not accepted launch truth.

Do not truncate an already aggregated provider fact, relabel it Sep-23, invent a
zero or call a provider to repair it. The next lane must reproduce the exact
report-bound contract and decide explicitly whether facts outside its cutoff are
withheld or clearly separated as live monthly evidence under an approved contract.
Preserve exact-client/RLS/publication guards and historical fact ages. Any required
additive database change must stay unapplied until separately authorised.

## Remaining acceptance

- Authenticated changed-local-runtime acceptance (no token copying/auth bypass).
- Seven published clients' actual TikTok tabs and Braize's Overview were inspected;
  Braize clicked-tab acceptance and remaining mobile controls are not complete.
  No retry loops if transport fails. DB evidence is not browser acceptance.
- Exact original source cutoff/observation age retained through the projection.
- Forklift/Neshora need the existing reviewed report workflow, not fake figures or
  auto-publication. Keep this protected business action distinct from code repair.
- No guarantee of sales from TikTok video response or account totals.

## Pinned local verification — PR #701

Runtime/test candidate `e978bbecc12524bfc875d0df0d52839b0e19df31`, tree
`4617e816eb60b44f42f380cd0f0e7afc6bac3cb8`: full supported suite **3,731 total /
3,714 PASS /17 intentional skips /0 failures**. All twelve local runner steps
PASS: full suite, TypeScript, Vite 7.3.6 production build and nine actual-component
browser fixtures covering desktop/375/390/430, portal shell, Plan, library,
report cutoff, saved/precise briefs, knowledge review, service expansion and
entitlement isolation. Scoped ESLint/diff check PASS. Emitted application bundle
contains the corrected snapshot wording. These fixtures use disposable/local
data: not authenticated changed-production acceptance and not a deployable
production-configured artifact.

Receipt `%TEMP%/cg-local-launch-e978bbecc125.json`, SHA256
`05544e1aa66ab776f82a1632dda61b592b96876028e2012d84e9bdd1ccab7744`.
The first full run failed only its old snapshot-copy assertion; corrected and
rerun fully, not ignored. Standalone Meta renderer tests require local fixture
env: 47 PASS after supplying it. Earlier 108 nearest tests also PASS.
The final receipt/doc follow-through does not alter the pinned runtime or tests.
