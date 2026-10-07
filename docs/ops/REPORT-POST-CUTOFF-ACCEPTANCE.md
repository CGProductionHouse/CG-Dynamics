# Published report content cutoff — local acceptance, 7 October 2026

Owning acceptance: #668 / #389. No production or Vercel operation.

## Reproduced contradiction

Read-only canonical evidence for Vrystaat Kunstefees September report
`87b4f217-3fe7-4b57-94a4-46222025606f`: published, 1–23 September 2026.
Later September post rows are attached to the same report. The actual client
reader normalized every period to the full month, allowing a later post into
totals, rankings and featured content while displaying the earlier cutoff.
The deterministic actual-render regression failed before the correction.

## Narrow correction

Published MTD post-derived presentation respects the stored inclusive cutoff.
Meta retains the existing America/Los_Angeles half-open day boundary; other
platforms retain the existing UTC boundary. Undated/invalid-time posts cannot
prove MTD membership. Published full months and staff draft full-month previews
are unchanged. No report/post row, normalized fact, RPC, provider period,
approval, publication or ingestion behavior is changed. This is not a claim
that a stored report is an immutable snapshot or that all fact sources share
one observation age.

## Executed verification

- Four new actual-render regressions: cutoff excludes later high performer;
  full-month extension admits it; Pacific end-of-day and explicit zero; UTC
  cutoff plus missing/invalid times; staff draft behavior preserved.
- Nearest reporting suites: 54 PASS.
- Full supported suite: 3,626 total / 3,609 PASS / 17 intentional skips / 0 fail.
  Windows Bash-only SES fixture excluded explicitly, not passed.
- Local TypeScript/Vite build, scoped TS/Node/browser ESLint and diff check PASS.
  Existing >500 kB bundle warning unchanged.
- `scripts/report-cutoff-readonly-browser.mjs`: real ClientReportView Overview
  and Facebook at 1440/375/390/430, synthetic exact report only, localhost GETs
  only, observed zero retained, no later highlight/overflow/page error. 375px
  screenshot visually inspected. TEMP `cg-report-cutoff-{width}.png`.

Authenticated changed-code production acceptance remains a future release
gate, not replaced by these synthetic checks. Automatic Vercel builds remain
disabled; no deployment, data mutation or strategy transition occurred.

## Continued client-report truth correction

The real local screenshot exposed another unsupported client-facing promise:
legacy heuristics recommended increasing posting below eight posts and extending
Facebook formats to Instagram regardless of confirmed scope, connected channel,
business priority or actual format evidence. Overview/platform recommendation
sections and canned future-plan insight fallbacks are removed from this renderer.
Stored staff insight, observed metrics, curation and canonical monthly strategy
remain; no helper's staff diagnostic or strategy-generation contract was replaced.
No generic doctrine is substituted for the removed text.

A new actual-render positive control then reproduced draft working-copy props
rendering without a staff-preview flag. Server reads already enforce publication;
the renderer now independently requires `published` on client views. Approved
working copy is not the frozen published projection. Staff diagnostics still
permits clearly labelled draft preview. No status or stored strategy is changed.

Two additional tests prove absence of manufactured advice for one observed post
at stronger and weak metric levels; published strategy renders while draft,
approved, unknown and missing status do not; staff draft still labels correctly.
Actual localhost browser now executes synthetic draft-to-published React state
change (no request/write) and confirms recommendations remain absent in Overview
and Facebook at all four widths. Final focused reporting/presentation:59 PASS.
Final supported full suite:3,628 total /3,611 PASS /17 intentional skips /0 fail;
Windows Bash-only SES excluded. Fresh local build/scoped lint/diff PASS.
