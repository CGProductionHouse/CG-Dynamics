# Client section navigation position — 17 October 2026

Owning #668/#389/#381; release #679. Base main `f0037e3b` (More-menu repair #832).
Existing #775 admin/onboarding and #662/#618 owners untouched.

## Reproduction and focused repair

Live authenticated Forklift staff preview at390x844: Overview's previous scroll
position remained when opening Plan (before144px /after247px). This is the
existing staff read-only preview, not a client-role acceptance claim. A generic
BODY End-key attempt timed out; a supported visible-navigation-link key action
and subsequent DOM/AX checks proved the retained position. No auth bypass or
data mutation; viewport reset afterward.

Actual local-shell reproduction must warm both route modules. A cold lazy-route
fallback can temporarily shorten the document and clamp scroll to zero, falsely
masking this bug. After warming Overview/Plan, the pre-fix375px assertion failed:
Plan remained130px down instead of starting at zero.

`ClientPortalShell.tsx` now observes only the exact client + resolved section.
A changed section/client on PUSH/REPLACE scrolls to the top using the existing
window; no new shell, route, storage or history system. POP navigation is left
to native history behavior. Month/tab/guide query changes inside a section do
not trigger a reset. Existing deep-guide scrolling and navigation design remain.

Extended `client-portal-shell-readonly-browser.mjs` verifies:

- Warm, genuinely scrolled Overview → Plan starts at top at375/390/430.
- An in-page Calendar tab query does not invoke a section reset.
- Back across query and section history does not invoke a forced reset.
- Forward PUSH to Plan and explicit selected-client switching do reset.
- Existing keyboard, exact-client, role-denial, no-write and error/empty checks
  remain; desktop1440 and normal client Dashboard fixture also run.

The test wraps window.scrollTo only to record calls, while forwarding every
call to the real browser implementation. Negative assertions do not confuse
native document-height clamping with an application-requested reset. The initial
positive client-switch assertion raced a passive effect; it now waits for that
observable effect rather than weakening the assertion or sleeping.

## Verification / boundary

10 focused unit tests pass. Final supported suite3926total/3907pass/19intentional
skips/0fail; two optional workstation PostgreSQL checks skipped with Docker stopped,
unsupported Windows Bash SES excluded, not passed. Temp full log:
`cg-client-section-scroll-full-suite.log`. All15canonical browser fixtures pass;
Temp logs `cg-section-scroll-<fixture-name>.log`. Build/app chunks/scoped lint/diff
pass; existing large index-bundle warning unchanged.

## Normal company writer result — independent readback

The handoff-only request was accepted after the prior writer returned idle.
Actual receipt is now on#731 comment6233461766, not merely an opaque chat answer.
Independent normal CG connector briefs confirm Novus Steel's October draft
`b12c6061-5dbd-4098-a626-3d8db992ded8` and November draft
`3770aac3-3e20-4bf2-900e-2bc092206c05`, bothv4/draft/unpublished. Selected test fields
explicitly preserve the September23 reporting boundary, separate shares from
enquiries and propose comparable tests; November has a four-week package-bound
game plan. Current concept counts remain1video/4photos/4posters. The writer's
receipt reports v3→v4 and all unselected fields unchanged; this code lane verified
current versions/content, not a separate complete before/after revision diff.

Neshora had zero new writes in that writer pass: Octoberv3, Novemberv1, source-
held/unpublished; scripts/19October run preserved. Exact source approval, short
code, clinical/service/participant consent, real slots and safe recipient/finals
remain owner decisions; no private story text repeated here. Writer next cursor:
Cape Lumber. Continued that same normal chat for the next five eligible clients
from this cursor with fresh evidence/version fences and a#731 receipt required;
no new task/automation/paid API or publication. Dispatch is not a saved-result claim.

Self-review: approve source merge, no blocking correctness/security/scope issue.
No CSS, destinations, package/client-ID/Hours, permissions, auth/RLS, data/schema,
Edge/config/provider/OAuth/secret or publication change in this code lane. No
Vercel operations. Source-only until the exact fresh #679 release packet; not
whole-fleet/client-role/physical-device acceptance. Current content/recipient/
provider gates and the existing normal company strategy writer remain separate.
