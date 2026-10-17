# Report fact read contract — 17 October 2026

Owner #668/#623. Source base `bb615312` after merged #835 approval-row repair.

## Failing-first evidence

The actual Overview fixture returned `null` from the existing report-bound
`get_report_metric_facts` RPC. Before this repair, its expected unavailable
indicator did not appear: `null ?? []` became a successful empty fact set. A
missing status row likewise implied `normalizedAttempted=false`, potentially
allowing a legacy-report fallback without evidence that this is a legacy report.
Two new unit groups failed first: missing facts returned no error and extra
transport fields survived the cast. These are local transport fixtures, not
claims that production served those malformed payloads.

## Focused repair

`src/lib/db/reportingTruth.ts` now validates and copies the existing public fact
fields, preserving finite values (including zero), nullable unknowns and all
seven availability states. Missing/non-array/malformed rows fail as unavailable,
not a filtered successful subset. Dates and month syntax must be real; source,
aggregation and comparable-group fields remain nullable. No metric definition,
cross-platform arithmetic, aggregation/source semantics or provider sync changed.

The existing status aggregate must return its one typed row: boolean attempted,
safe nonnegative counts, ready count not exceeding total, no current facts with
a false attempt flag. PostgreSQL authority is
`supabase/phase-20e-facts-client-access-and-curation.sql`: this aggregate returns
one row even for a genuine legacy report. Genuine zero-count/no-attempt reports
remain legacy; an attempted-but-empty result stays attempted. Current counts are
not assumed equal to the visible fact count (registry/source filtering differs).

Thrown/failed reads return a sanitized error and no current/previous facts.
Normal Overview, client Performance and staff preview already check that error.
Existing RPC names/report-ID arguments/session ownership and published-report
access remain unchanged. No client/table/Edge/schema/auth/write-policy changes.

## Verification

- 48 focused unit tests PASS, including the two failing-first contract groups
  and existing rendered Meta/report comparison/availability/source tests.
- Actual Overview and normal-client Performance browser checks at1440/375/390/430:
  null facts, null status and failed reads are unavailable, not legacy/zero/empty;
  successful empty stays distinct and same-window100+200+300 views remain600.
  No external network, real credentials/writes, page errors or body overflow.
- A temporary fixture-order mistake was corrected: Performance assertions now
  follow Overview checks, rather than reloading Performance while expecting an
  Overview message. It was not a production defect or a passed run.
- Local build emitted actual application chunks; scoped ESLint/diff PASS.
  Full supported suite **3,930 total / 3,911 passed / 19 intentional skips /
  zero failed/cancelled/todo**; all **15 canonical browser fixtures PASS**.
  Two optional Docker/PostgreSQL checks skipped; Windows Bash SES fixture
  excluded, not passed. Existing >500kB index warning unchanged.

Workstation Temp logs: `cg-report-fact-contract-full-suite.log` and
`cg-report-fact-contract-<fixture>.log`. Existing CG Pay Playwright/browser reused;
no package/browser installation or auth/session transfer. Local fixture evidence
is not authenticated changed-runtime or physical-device acceptance.

## Concurrent bounded strategy continuation

Same normal company **Write Client Strategies** chat completed five more eligible
clients through its ordinary connector. Nine changed client/months, ten saves
(one exact Braize field correction), one accepted MadisonNovember left unchanged.
Fresh independent current IDs/versions/tests/November sequencing/concept counts
match. Full before/after preservation remains writer-attributed. The actual local
forbidden-copy gate passes all20current drafts across the last two batches, not
semantic approval. Receipt: `strategy-review/2026-10-17-normal-chat-second-batch.json`.

Same writer continues the remaining existing queue from exact Bouwer & Coetzee
cursor; next saved checkpoints are pending, not inferred from dispatch. Known
package/source gates preserved, HumanAuto not queried/researched. No Codex creative
substitute, new task/automation, paid generation, approval/publication or activation.

ZERO Vercel operations. Protected content/recipient/provider/release gates remain;
not all-client launch clearance. Other open775/662/618 untouched. Control Centre
exact access remains unavailable, no replacement invented.
