# Report content cutoff versus platform windows — #668 / PR #702

## Reproduction and correction

The previous read-only production receipt in `CLIENT-TIKTOK-ACCEPTANCE-2026-10-07.md`
proves Sep-23 published content reports receive Sep-30 normalized TikTok facts.
The existing exact-client/month RPC does not truncate monthly aggregates at the
content cutoff. The renderer previously implied one coverage/freshness date.
An actual-component regression reproduced the missing distinct disclosure before
the fix. No provider call, query, RPC, publication contract or stored value changes.

Report dates are now **Report content coverage** and **Content month to date**.
Each normalized metric carries its own **Recorded platform window**, without
inferring observation age from that window. Missing, invalid, impossible or
reversed bounds show **Platform window unavailable**. Account snapshots remain
snapshots, not growth. Observed zero, null, partial coverage, comparable full-month
behavior and exact-client guards remain intact. Never truncate or relabel the
Sep-30 aggregate as Sep-23, and never claim the window is a latest-sync timestamp.

## Exact local receipt

Tested source `474abab42a58cfd8212ae94602b22bb33e086fc6`, tree
`c4c6ab3555a8db9df58bb799fdba37cd1cd79ab4`. All twelve steps of
`node scripts/local-launch-acceptance.mjs --run` PASS: **3,731 tests /3,714 PASS /
17 intentional skips /0 failures**, TypeScript, local Vite 7.3.6 build and nine
actual-component responsive browser suites at desktop/375/390/430. The Windows
Bash SES fixture is excluded, not passed. Receipt completed 7 October 21:36 UTC
(23:36 Johannesburg): `%TEMP%/cg-local-launch-474abab42a58.json`, SHA256
`311a152f1d6a0e8b0ea884ffe6c3b5cd20b35ccbd343d348b5cc9fce66131439`.

An earlier full run on `b8e11bfdbf1140a7634e60db57cd6e551fe896e6` failed one
obsolete service-copy assertion: 3,713 PASS /1 failure /17 skips. It was corrected
and the entire runner rerun; that failed receipt is not acceptance evidence.
Scoped ESLint and `git diff --check` PASS. Emitted application bundle contains
the new window disclosure. Final receipt documentation changes no tested code.

Focused reporting/TikTok/isolation: 80 PASS; corrected service tests: 3 PASS.
Supplemental Approvals: 24 cases; strategy-review: 12 cases across four widths;
guideline/calendar/library/strategy contracts: 44 PASS. Nine integrated suites
cover portal shell, Plan, library/Brand Hub, report cutoff, saved/precise briefs,
knowledge review, service expansion and entitlement isolation. No captured page
runtime errors or body overflow in these fixtures. New report checks exercise both
Overview and TikTok with mixed windows, zero and missing bounds. Screenshot
`%TEMP%/cg-report-fact-window-375.png` visually inspected; other widths have matching
screenshots. This is a synthetic fixture (including JFJ branding), NOT real JFJ
TikTok evidence or authenticated production acceptance.

## Remaining genuine gates

No Vercel operations; Git automatic deployment remains OFF. No production
data/schema/Edge/config/provider/approval/publication action. Local fixture-configured
`dist` must never be uploaded as a production artifact. Current frontend release
and legitimate changed-runtime staff/client authentication remain #679 gated.

Four packages still need exact confirmation: Elcheck, JFJ Electrical, LHP Student
Village & Block and VCS Cleaning Solutions. Distinct working plans and actual
source references are recorded, not canonical strategy approvals. LHP utilities
conflict needs owner correction; VCS final offer terms need direct review. The
94 target drafts (72 v3 +22 held v2) need actual semantic/evidence decisions;
Zooz lacks current reviewed guide/programme evidence. Final portal assets and
report/strategy publication are separate protected business actions. Provider
consent remains separately owned. Tests cannot manufacture those facts or certify
the whole launch complete. Google Control Centre write-back remains unperformed
because no exact accessible tracker was established; GitHub/repo receipts are durable.
