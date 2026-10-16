# Client portal navigation repairs — 16 October 2026

Owning launch contract: #668; library: #396; release: #679; supervisor: #381.
Base: main `4ad9c39ff04d0d2d15e62c9cc95398208f42578d`.
Existing open owners #775/#662/#618 were inspected and not modified.

## Reproduced defects and minimal repairs

1. Overview's **Calendar / Open calendar** anchors both pointed to `/client/plan`,
   whose default tab is Strategy. Actual-component browser regression failed
   `client/1440: calendar must not open Strategy` (actual tab null). Both actions
   now explicitly select `tab=calendar` and the Overview's displayed working month.
   The existing ClientPortalLink adapter keeps exact-client staff preview intact;
   normal client navigation never supplies a client override. The regression
   clicks the visible responsive action and mounts the actual Plan/Calendar,
   checking selected-tab state, heading, client/month and destination overflow.
2. Brand Hub **year switch during an in-flight month read** retained `loading=true`
   after incrementing the request generation. The old response was correctly
   ignored, but no request could clear the stranded spinner. Delayed-response
   actual-component test failed with one unexpected status indicator. The year
   selection handler now resets loading. Old-month data remains fenced; the new
   year stays free of the old files, and a subsequent ordinary month read works.

Runtime files: `src/pages/client/ClientPortalHome.tsx`,
`src/features/client-portal-library/ClientPortalLibrary.tsx`.
Regressions extend the existing `scripts/client-overview-schedule-browser.mjs`
and `scripts/client-library-readonly-browser.mjs`; no second test architecture.

## Verification actually performed

- Final supported serial suite: **3918 total, 3899 pass, 19 intentional skips,
  0 failures**. Optional disposable-Postgres checks explicitly skipped with Docker
  unavailable; existing unsupported Windows Bash SES fixture excluded, not passed.
  Full log: workstation Temp `cg-portal-navigation-final-full-suite.log`.
- 48 focused portal/current-month/preview/library tests pass. A preliminary
  parallel focused run logged the existing Vite HMR-port contention but had no
  failed assertions; final full run is serial.
- All **14 canonical local browser fixtures** from `local-launch-acceptance.mjs`
  pass: shell, Overview schedule/facts, Plan, strategy review, approvals, library,
  Brand Hub setup, report cutoff, saved-context editor, precise-edit editor,
  Skill Card review, service expansion and entitlement resolution.
- New regressions pass desktop1440 and mobile375/390/430, including both normal
  client read paths and exact staff-preview Calendar navigation. Synthetic network
  guards prohibit external/provider actions; explicit editor writes in unrelated
  existing fixtures are intercepted locally only. No live draft write is claimed.
- Local `npm run build`, application-code bundle verification (`client-schedule`),
  scoped ESLint for both changed components and `git diff --check` pass. Existing
  >500kB chunk warning remains; no dependency or build/runtime config changed.
- Review: existing router/preview helper reused; event-handler loading reset does
  not add an effect or fetch; request sequencing preserved; no role/client-scope
  or client-publication boundary weakened. Approved visual design unchanged.

The initially selected cached Playwright package expected an absent browser.
Verification used the already-installed CG Pay Playwright package and matching
local browser instead. No installation/download or other project's file change.

## Live evidence and separate authoring owner

Authenticated read-only Forklift staff preview retains exact client
`4424ed69-7270-4d30-a1ea-0b77d76912df`: October/November Plan options, unpublished
October strategy, confirmed **1 video +6 posters** (no unknown quantity cards),
empty client-visible October calendar and empty approval queue. Empty visible
records do not prove that upstream operational work is absent. No publication,
schedule repair or actual client-role/mobile acceptance occurred in this pass.

The existing normal company ChatGPT **Write Client Strategies** chat
`6ace9b70-d30c-83ea-a4a0-014cf0c66381` was found idle via app thread inventory.
Recent human turns prioritise Neshora's existing Content Guideline and full plan.
The requested continuation was sent to that same chat using the prior direct
human authorisation to run it, preserving its latest assignment and staff edits.
The browser transport failed once; no credential copying or retry loop followed.
ChatGPT reply bodies are returned as content references by read_thread, not actual
strategy payloads; they were not treated as implemented/approved facts.

Fresh read-only CG connector November Neshora brief still returns
`CLIENT_EVIDENCE_UNVERIFIED` / `EXACT_STRATEGY_EVIDENCE_UNAVAILABLE`, canonical draft
`0018ace6-7f52-4b52-a411-ae34dbc89cb2`, version1. Its known package was not requested
again. The writer must return real saved/read-back document IDs/versions, not only
an authored response. Do not publish or replace source gates to force success.

## Production/release boundary and next action

**Zero Vercel operations; zero production SQL/data/schema/Edge/config/secret,
OAuth/permission, strategy/report/asset publication changes.** Git deployment
guard remains OFF. These two UI repairs are source-ready, **not deployed**.

Continue the exact #451 repair queue and normal-chat Neshora authoring results;
retain protected provider grants, source/scope, approved finals/recipient access,
owner publication and genuine client-role acceptance gates. Prepare a single
verified frontend release only under #679's exact fresh approved packet. This is
not an all-client launch sign-off. GitHub/#381/handover are updated; the previously
inaccessible Google Control Centre reference was not guessed or replaced.
