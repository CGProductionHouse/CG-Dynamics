# CG Hours through the CG Dynamics Assistant — 27 October 2026

Owner: [#898](https://github.com/CGProductionHouse/CG-Dynamics/issues/898).
Reviewed code: [PR #899](https://github.com/CGProductionHouse/CG-Dynamics/pull/899),
`4d3b1ab2` (open; no production release).

## Scope and live evidence

CA requested normal ChatGPT staff work narration → canonical CG Hours logging,
especially reducing Franco's daily administration. CA's assistant may be used for
testing; staff conversations/timesheets remain untouched.

- Live connector resolved CA's exact active staff context and successfully read
  27 October ordinary hours, optional travel, canonical clients and work types.
  The day had no entries; that is a successful read, not a logging shortfall.
- SELECT-only comparison of the two projects verified active immutable mappings
  for all six active team/manager profiles, including Franco. The two admin/system
  identities are not staff logging identities. No mapping or permission changes.
- Live CA bootstrap exposes all four logging/read/correction tools. No runtime
  daily hours workflow is currently returned. Hosted MCP baseline is ACTIVE v73.
- The company Chrome session was reachable, but navigation/state calls repeatedly
  timed out. Bounded recovery stopped. Normal CA ChatGPT conversation execution
  is **unverified**, not passed from the direct connector call.
- The screenshot establishes a claimed reminder configuration, not durable hours
  writes. No Franco chat, reminder, automation or timesheet was edited.

## Reproduced defects and focused repair

1. Creating/correcting 4.1 hours failed because multiplication produced
   245.99999999999997 minutes. Shared strict conversion now accepts floating-point
   representation noise for exact whole minutes, rejects genuine fractional
   minutes/non-numbers/out-of-range values. All 1,440 minute durations tested.
2. Tool schemas required at least 15 minutes while the canonical Hours backend
   supports one minute. Create/correct now match that existing backend boundary.
3. Malformed success responses/server failures could say nothing was changed even
   when persistence was uncertain. Fallbacks now claim no success, advise reading
   the day and retaining the same retry key.
4. Staff bootstrap now supplies a shared hours workflow on every outcome, including
   missing workspace/profile lookup failure. Company-admin gets no staff authority.
   The existing coexistence/task/calendar/mail/presentation policies are preserved.

The assistant is instructed to read/reconcile the day, resolve canonical CG Hours
IDs, capture only explicitly supplied/confirmed work and duration, ask one concise
question for missing facts, use the same key on retries, correct the original
entry instead of duplicating a recap, and verify saved records by read-back.
Calendar/task completion never establishes worked hours. Confirmed small tasks do
not need a new form or repeated conversational approval. Kilometres attach to an
existing owned draft entry; no invented travel duration or reimbursement.

## Verification and limits

- Initial regressions reproduced duration/schema/workflow failures before repair.
- Final Dynamics MCP/CG Hours suites: 394 total /393 pass /1 explicit skip /
  0 failure; focused handler/transport suites18/18.
- Existing CG Hours canonical staff-logger suite: 120/120 (local fixtures). Covers
  ownership, inactive/missing identity mappings, locked/approved weeks, audit,
  duplicate retries, correction and km boundaries. That repository was not edited.
- Hosted-derived candidate actual handler/bootstrap tests: 10/10.
- Actual TypeScript/Vite app build passes; emitted app routes verified. Scoped
  ESLint, pure Edge TypeScript check and diff whitespace checks pass.
- No new live time/km entry, correction, submit, approval or payroll action.
  Thus new live write→read-back and ordinary ChatGPT UI acceptance remain unverified.
  Do not fabricate a payroll-affecting test entry to remove that boundary.

## Exact proposed backend release (not executed)

Project `ehtjfntukiwbgptqgbzy`, existing function `cg-dynamics-mcp`, baseline v73.
Private source-only rollback/candidate packet:
`C:/Users/chris/AppData/Local/Temp/cg-hours-mcp-release-20261027/`.
Candidate SHA256:
`356653c0995d0062c0728f16b0b6d30c8065de45e6c113dc04875cc3e34f0ec8`.

Only three hosted-derived files differ: `index.ts`, `cgHoursStaffLogger.ts`,
`toolCatalog.ts`. Other37 files are byte-identical, including the approved guideline
read-back repair from v73. No whole-main bundle replacement. Keep all40 files,
JWTfalse/import-mapfalse, internal OAuth, permissions and secrets unchanged.
No new tool, dependency, table, schema, provider configuration or Vercel operation.

CA approval is required before that exact production backend update. Immediately
before release recheck version/hash; stop on drift rather than overwrite another
owner's runtime. After approval: deploy once, verify40/40 hosted bytes/settings,
unauthenticated rejection, live CA bootstrap policy and read-only day. Verify the
actual ChatGPT catalogue accepts small entries; if its action snapshot is stale,
refresh/review that existing app through its legitimate owner workflow. Never
weaken server rules or use another staff identity to work around it.

For genuine live write acceptance use only an exact CA-confirmed work segment,
client/date/duration and retained retry key. Check returned draft id, same-key replay
and canonical day read-back. Staff review and submit their week manually in CG Hours.
No reminder changes, Vercel or new live business data were authorised by this packet.
