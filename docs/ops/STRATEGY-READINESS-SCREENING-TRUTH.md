# Strategy release gate: screening is not strategy acceptance

7 October 2026, #513 / #668. No production amendment, approval or publication.

## Concrete defect and correction

The #567 generator previously called absence of a few forbidden phrases
`quality_review_passed`, reproduced for all 94 regenerated proposals. Its tests
asserted that blanket pass. This can pass a collection of voice rules and does not
establish a useful business game plan. It also stamped a fixed September date and
hard-coded production counts even when run later.

The generator now reports only `copy_screen_passed_requires_semantic_review` or
`blocked`. Semantic acceptance is never inferred from regexes, length, a client
name or matching hashes. Current-copy alignment is separate. Missing current rows
stay unavailable, not draft; missing counts stay null. Duplicate exact client/month
identities and altered proposal hashes fail closed. Generation time is separate
from the historical input observation. No approval/publication payload is emitted.

CLI execution requires an isolated `CG_STRATEGY_ARTIFACT_DIR`; default execution,
case/path aliases and output links into frozen evidence are denied. Importing the
pure builder performs no writes. Frozen reviewed artifacts are unchanged and are
historical receipts, **not current strategy quality certificates**. The existing
amendment compiler independently preserves revision/package/staff-content fences.

## Actual current production receipt, SELECT only

7 October production readback for active clients' September/October rows:
72 v3 drafts, 22 v2 drafts, 20 historical v1 drafts; zero frozen published strategy
snapshots in every partition. This confirms status/counts, NOT semantic quality.
The exact 94-row launch target is the existing 72+22 partition, not every new active
client nor the 20 non-applicable historical rows.

## Exact remaining review actions

For each exact row pin strategy ID/client/month/version/content hash, current
confirmed package receipt, source hashes/observation times and staff amendments.
Assess these separately, not by automatically changing the status above:

1. Business outcome and proposed priority, with client confirmation distinguished
   from CG's recommendation. No invented baseline, target or attributable uplift.
2. Audience's actual decision/problem and the evidence supporting it; unverified
   customer questions remain proposed tests, not claimed research findings.
3. A concrete creative choice and useful concepts within the confirmed quantities.
   Voice rules, footers, identity/isolation notes stay internal production guardrails.
4. Previous content/results and comparable metric definitions. Post identities prove
   a content history, not a winning format or sales result. Missing data is not zero.
5. Month-specific timing/learning/measurement. Holidays and industry context need
   relevant dated evidence; September and October need more than a changed label.
6. Exact-client provenance and client-safe copy. Names appearing in an isolation
   rule are review flags, not automatic proof of leakage or permission to reuse facts.

Mandatory negative fixtures: We Ar Fuels, Daisy & Co and Piek Group. A copy-screen
pass or nicer accordion does not satisfy these substantive decisions.

The committed remediation-a blocked inventory identifies 11 clients /22 rows:
Bloem Action Sports, Emoya Estate Driving Range, Forklift Trucks, Hino Trucks,
Human Auto, Jenkor, Red Oak, Toyota Bloemfontein, Vrystaat Kunstefees, WiseRide,
Zooz Lifestyle WFF. Its July–September gaps are **historical snapshot gaps**, not a
fresh assertion that those clients have no current posts/results. Eight clients
lack canonical reports in all three frozen months; Red Oak lacks in-month post
evidence in August/September; Vrystaat lacks July; Zooz lacks a reviewed current
runtime guide and current product/programme/WFF constraints despite post identities.
Do not invent replacements. Human Auto's separate research requires AGENTS' skip/go
decision. Resolve each gap from exact existing evidence where available before
requesting genuinely missing owner facts. Keep other safe lanes moving.

7 October bounded fresh readback supersedes blanket historical-gap assumptions:
Vrystaat now has 20 September and two October exact stored post identities (not
all covered by its published September23 cutoff). Its held v2 strategy rows are
unchanged. `STRATEGY-VRYSTAAT-REVIEW-PROPOSAL.md` supplies genuinely separate
September learning and October application-route concepts from the existing guide
and exact observed posts, with no invented quantities or application outcomes.
It flags Vlieks27/28 November source conflict rather than choosing a date. This
is internal proposed copy, NOT semantic acceptance/amendment/publication. The
two held rows are not automatically promoted and frozen reviewed artifacts stay
unchanged. Remaining eight clients' absent recent report/post rows are evidence
gaps, not zero results; Red Oak/Zooz require their own exact review.

## Local verification / release boundary

Run the generator only in a copied temporary evidence directory; compare frozen
hashes before/after. Run `tests/issue567StrategyReadiness.test.mjs`,
`tests/strategyArtifactIsolation.test.mjs`, and
`tests/strategyQualityAmendmentPlan.test.mjs`, followed by supported full suite,
local build, Node-script scoped ESLint and diff check. No browser/UI change here.

This correction supplies no production facts and does not modify the frontend.
Separately protected canonical amendments/approval/publication and backend release
remain required. #674 portal and #677 Content Director are separate existing PRs.
Vercel remains untouched, with Git automatic deployment OFF. Do not report
“only the frontend push remains” until the integrated role acceptance, actual
client-safe content and protected backend compatibility are established.
