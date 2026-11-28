# 28 November — feedback check and delivery retry protection

Continued existing #948 / draft #956 ownership and worktree; no new branch,
agent, workbench or production service. Fresh origin/main fetched at b524a9f9;
existing draft #956 remains the graphic-designer lane. No merge/rebase of unrelated
work and no deployment. The hosting guard remains `git.deploymentEnabled=false`.

## Actual live review check

Opened the existing signed-in internal WhatsApp tab and exact CG Picasso Approvals.
Latest conversation item remains Thursday26November's Bloem review note. There is
no later feedback in that group at this check. The note now reads **Delivered**,
with actual Amonique/Ger-Marie mention buttons; this updates the earlier Sent
observation without rewriting its historical receipt. DP03/DP04 were also visible
as Delivered. Four original media receipts remain the authoritative earlier
delivery witnesses; no new full-set send, reply, forward or reaction was made.
Retained actual readback privately in `delivery-20261126/feedback-check-20261128.ax.txt`.

The owner's Canva/WhatsApp tabs stay open. No desktop takeover, credentials,
session extraction or reconnect request was needed. No creative approval is
inferred from delivery or absence of feedback. Existing formal pack/runtime,
source-project and January allocation/final approval limits remain unchanged.

## Implemented, exercised improvement

Added local `scripts/poster-studio/delivery-guard.mjs`, using existing Node built-ins
and `caption-guard.mjs`. It validates the selected artwork hash, PNG header size,
allocated UTF-8 caption hash/signature policy and private path containment. It
detects duplicate selections and prior same-client/destination payload witnesses,
including a renamed page/workbench. Sent/ambiguous messages stop blind retries;
orphan delivery statuses hold for actual live investigation. It does not send or
modify statuses, captions, photos or prior receipts. New receipt files use
exclusive creation. Shared skill/README document the actual contract and limits.

Actual four-file Bloem run: transport checks passed, **4 already recorded,
0 unrecorded, 0 transport holds**, automatic send false. Exit1 is the intended
duplicate stop, not a failed photo export. Retained private
`delivery-guard-20261128.private.json`; no private media/receipt copied into Git.
The11 new regression tests plus7 existing caption tests pass. They cover uncertain
sends, rename/re-caption retry traps, cross-client/destination isolation, tampered
bytes, wrong dimensions, captions, duplicate payloads, path escapes and refusing
to overwrite inputs/receipts. PNG header checks do not decode pixels or certify
source resolution, colour management or taste. Caller-supplied history is bounded
evidence, not an authenticated complete ledger.

Found an actual local retry hazard: the historical private `prepare_delivery.py`
would overwrite the current delivery manifest with `not sent` entries if rerun.
Backed up that helper privately and added an early existing-manifest stop before
any output write. Executed the refusal path; the current manifest SHA-256 remained
unchanged. A future revision must use a new directory and retain prior receipts.
No historical status was reset. Fresh TypeScript/Vite7.3.6 build passes; existing
Browserslist age/chunk-size warnings remain. No dependency update was attempted.

## Next practical step

Capture exact-version feedback when it arrives; amend only affected stable pages,
inspect real HD exports and deliver only changed authorised revisions with allocated
unsigned captions. No forward to Graphic Design Approvals until all approvals and
authoritative posting order are verified. R0 incremental; no new dependency,
schema/SQL, client publication, portal-final promotion, runtime release or Nolan
video change. Normal company-ChatGPT end-to-end execution remains unverified.
