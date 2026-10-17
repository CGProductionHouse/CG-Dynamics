# Client mobile navigation keyboard repair — 17 October 2026

Authority: #668 / #389 / #381; release #679. Base main `38615f6d`.
Open PR #775 changes admin/onboarding navigation, not this client shell; #662/#618
remain untouched. No new shell, route, data source or product architecture.

## Live reproduction before code

Reused the already-authenticated in-app Forklift staff preview, not a client
login or impersonation. At a temporary 390x844 viewport:

1. Open the existing More button on Performance.
2. Press forward Tab: focus moves to BODY, bypassing the revealed Brand Hub link.
3. Focus that disclosed link using the supported locator keyboard action and
   press Escape: the panel closes but focus falls to BODY again.

Both failures were observed in the live DOM/accessibility state. The viewport was
reset immediately afterward. Live Performance says “No published report yet”;
that is a publication state, not evidence that the repaired Meta mapping failed.
No publication, authentication, account, provider or data action was performed.

An actual-component local browser regression then failed before the code change
at375px: expected forward Tab to reach Brand Hub, but active element was BODY.
Desktop navigation had passed before the failing phone assertion.

## Focused implementation

`src/components/client/ClientPortalShell.tsx`:

- Keep the revealed secondary navigation after its disclosure button in DOM tab
  order. Its existing absolute positioning and every design class stay unchanged.
- Retain a reference to More; Escape closes its open panel and returns focus to
  that same button. No automatic trap or new modal behavior.
- Existing mouse/touch clicks, link destinations, selected-client preview scope,
  roles, service visibility and desktop navigation remain unchanged.

`scripts/client-portal-shell-readonly-browser.mjs`:

- One-link disconnected-client menu: More → Tab → Brand Hub → Escape → More.
- Two-link connected-client menu: More → Tab → Leads → Tab → Brand Hub, with
  Escape returning to More. Enter reopens the menu; normal navigation still works.
- Cover normal client mode too, without supplying a client override to safe RPCs.
- Reuse all six routes, denied-role/no-write/error/empty/isolation assertions.

## Strategy lane continuity (separate from this code fix)

The existing normal company **Write Client Strategies** chat was idle when read.
Continued that same human-authorised Neshora/fleet assignment through the app's
message tool, then read its status ACTIVE. No new task, automation or paid model.
Latest #731 records the continuation: reconcile saved Neshora work first; leave
genuine owner gates explicit and continue the next unblocked existing October/
November draft using fresh exact-client eligibility. Preserve staff edits and
Human Auto skip/go; no invented scope, source activation or auto-publication.
Dispatch/active status does not prove any new saved strategy or completed result.
The latest author turn subsequently completed, but app readback exposes its answer
only as opaque reference3f6c2931-de68-43c8-a034-b177299b2fc2 while the thread-level
status still says active. Do not equate those signals. A handoff-only receipt
request was rejected as “already responding”; no second follow-up was accepted
or retried. Preserve the active writer and require actual canonical readback.

Independent fresh normal-connector Neshora November readback remains
`0018ace6-7f52-4b52-a411-ae34dbc89cb2`, version1, draft/no published version,
`CLIENT_EVIDENCE_UNVERIFIED` / `EXACT_STRATEGY_EVIDENCE_UNAVAILABLE`.
No unsupported draft replacement was authored by Codex. Work Chrome's existing
chat tab hit one transport failure; it was not retried or bypassed. In-app portal
testing remained available. No credentials or personal medical story text copied.

## Verification / release boundary

Focused10 unit tests pass. Final supported suite:3926total/3907pass/19intentional
skips/0fail. Two optional workstation PostgreSQL tests skipped with Docker stopped;
unsupported Windows Bash SES excluded, not passed. Full log: workstation Temp
`cg-client-mobile-keyboard-full-suite.log`. All15canonical browser fixtures pass;
logs `cg-mobile-keyboard-<fixture-name>.log`. Build, emitted application code,
scoped ESLint and diff checks pass. A local390px screenshot was visually inspected;
the approved appearance stays intact.
Desktop1440 and phone375/390/430 fixtures are synthetic, not a real-device/client-
role sign-off. Existing large index-bundle warning remains.

Self-review: approve source merge, no blocking correctness/security/scope issue.
No dependency, auth/RLS/secret, data/schema/Edge/config/provider/OAuth/permission,
package, client-ID/Hours or publication change in this code lane. No Vercel
operation. Frontend remains source-only until #679's exact fresh release packet.
This repair is not a whole-client/fleet launch certificate. The separate writer
requires actual canonical saved/readback receipts before claiming authoring done.
